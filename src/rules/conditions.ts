import { pickTraits } from '../content/traits.ts';
import { pensionFor } from '../contracts.ts';
import { WITCH_STAGE_AT, corruptionStage, effectiveMaxHp } from '../economy.ts';
import { loadBalance } from '../balance.ts';
import type { GameState, Girl, StatKey } from '../types.ts';
import { book, clone, dateLabel, hashText } from './core.ts';
import { spawnWitchConfrontation } from './witchEvent.ts';
// v35 从 src/game.ts 拆出：侵蚀、药瘾、特性与年金。

/** 魔女化的自动阈值：读数值规则里的「魔女化阈值」，不再写死 70。 */
export function witchThreshold(): number {
  return Math.max(1, Math.min(100, Math.round(loadBalance().corruptionThreshold)));
}

/**
 * 把「侵蚀已经到线、但还不是魔女」的状态补上（v245）。
 *
 * 旧档、或从别处直接写侵蚀的路径都可能漏掉变身；日结时兜一次。
 * 只补状态，不弹对峙——那不是刚发生的转变。
 */
/**
 * 她此刻「该不该」处于魔女化形态（v252）。
 *
 * 形态不是一次性开关，而是由侵蚀与药效共同决定的：
 *  - 越过 70 是不可逆阶段，永远锁着；
 *  - 没过 70、但侵蚀到了魔女化阈值：有药压着就是普通形态，没药才锁；
 *  - 侵蚀掉回阈值以下（净化、休整）：本来就该是普通形态。
 */
export function shouldBeWitch(state: GameState, girl: Girl): boolean {
  const corruption = girl.corruption ?? 0;
  if (corruption >= WITCH_STAGE_AT) return true;
  if (corruption < witchThreshold()) return false;
  return (girl.drugUntilDay ?? 0) <= state.day;
}

/**
 * 把立绘形态与「侵蚀 + 药效」对齐。返回 true 表示这一次是新锁成魔女化。
 *
 * 解锁也在这里做：侵蚀被净化到阈值以下、或药效正压着时，她会立刻回到普通立绘。
 * 旧档里「侵蚀已经降下来却还锁着」的情况也靠它修回来。
 */
export function reconcileWitch(state: GameState, girl: Girl): boolean {
  if (girl.dead || girl.retired) return false;
  const want = shouldBeWitch(state, girl);
  if (want === Boolean(girl.witch)) return false;
  girl.witch = want;
  girl.withdrawalDays = 0;
  if (want) girl.drugUntilDay = Math.max(girl.drugUntilDay ?? 0, state.day + 10);
  return want;
}

/** 旧名保留：日结时把「侵蚀到线但还没变身 / 已经掉回来却还锁着」补上。 */
export function syncWitchState(state: GameState, girl: Girl): boolean {
  return reconcileWitch(state, girl);
}

/**
 * 用一支月光抑制剂把她从魔女形态压回普通形态（v252）。
 *
 * 这是「用抑制剂」的唯一出处：诊所的注射按钮、魔女立绘弹窗的压制按钮都走这里，
 * 免得两条路径各写一份、其中一条忘了解除形态锁定。
 *
 * 规则：侵蚀越过 70 就是不可逆魔女化，药只能续命；没越过就立刻退出魔女形态、
 * 换回普通立绘。压制只是压住——药效过期后侵蚀还过线，她会重新被锁成魔女。
 */
export function suppressWitchWithDrug(state: GameState, girl: Girl): { ok: true; stock: number } | { ok: false; message: string } {
  if ((girl.corruption ?? 0) >= WITCH_STAGE_AT) {
    return { ok: false, message: `${girl.name}已经越过那条线：月光抑制剂只能续命，压不回普通形态。唯一解除方式是记忆重塑。` };
  }
  if ((state.inventory['moon-drug'] ?? 0) <= 0) return { ok: false, message: '仓库里没有月光抑制剂，压不回去。' };
  state.inventory['moon-drug'] -= 1;
  girl.witch = false;
  girl.drugUntilDay = Math.max(girl.drugUntilDay ?? 0, state.day + 10);
  girl.withdrawalDays = 0;
  girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + 20);
  return { ok: true, stock: state.inventory['moon-drug'] };
}

/**
 * 诊所注射：把一支月光抑制剂打进她体内（v252）。
 *
 * 与「压力形」不同，这条路在越过 70 之后仍然可用——只是那时它只剩续命：
 * 断药倒计时清零、药效续上，形态仍然是魔女。
 */
export function useMoonDrug(state: GameState, girl: Girl): { ok: true; stock: number; unlocked: boolean } | { ok: false; message: string } {
  const corruption = girl.corruption ?? 0;
  if (girl.witch && corruption < WITCH_STAGE_AT) {
    const result = suppressWitchWithDrug(state, girl);
    return result.ok ? { ...result, unlocked: true } : result;
  }
  if ((state.inventory['moon-drug'] ?? 0) <= 0) return { ok: false, message: '仓库里没有月光抑制剂。' };
  state.inventory['moon-drug'] -= 1;
  girl.drugUntilDay = Math.max(girl.drugUntilDay ?? 0, state.day + 10);
  girl.withdrawalDays = 0;
  girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + 20);
  return { ok: true, stock: state.inventory['moon-drug'], unlocked: false };
}

export function addCorruption(state: GameState, girl: Girl, amount: number): void {
  if (!amount || girl.dead || girl.retired) return;
  const before = corruptionStage(girl.corruption ?? 0);
  girl.corruption = Math.max(0, Math.min(100, Math.round((girl.corruption ?? 0) + amount)));
  const after = corruptionStage(girl.corruption);
  if (after > before) {
    state.logs.unshift({ id: `log-corrupt-${girl.id}-${girl.corruption}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}的侵蚀进入「${['澄明', '浅蚀', '深蚀', '魔女'][after]}」阶段。${after === 3 ? '她的影子长出了不属于人类的角。' : '她的共情正在被某种东西缓慢替换。'}` });
  }
  // v245/v252：到阈值就自动变身，与设置项、调试命令、手动切换同一口径；
  // 药效压着、或侵蚀还没到线都不会锁。只有「这一次新锁上」才排对峙。
  const threshold = witchThreshold();
  if (!girl.witch && reconcileWitch(state, girl)) {
    state.logs.unshift({ id: `log-witch-auto-${girl.id}-${state.day}-${state.minutes}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}的侵蚀越过 ${threshold}，立绘锁定在魔女化形态——要靠月光抑制剂才能压回去。` });
    // v240：跨过魔女线的那一刻就排一段对峙，界面立刻弹出。
    spawnWitchConfrontation(state, girl);
  }
}

export function drugTick(state: GameState, girl: Girl): void {
  if (girl.dead) return;
  // 旧档或漏触发的情况：日结时把「侵蚀到线但还没变身」的补上。
  syncWitchState(state, girl);
  if (!girl.witch) return;
  if ((girl.drugUntilDay ?? 0) > state.day) { girl.withdrawalDays = 0; return; }
  if ((state.inventory['moon-drug'] ?? 0) > 0) {
    state.inventory['moon-drug'] -= 1;
    girl.drugUntilDay = state.day + 10;
    girl.withdrawalDays = 0;
    // 药灌下去就压住：没越过 70 的话，形态也跟着退回普通立绘。
    if ((girl.corruption ?? 0) < WITCH_STAGE_AT) girl.witch = false;
    state.logs.unshift({ id: `log-drug-${girl.id}-${state.day}`, time: dateLabel(state.day, 0), kind: 'clinic', text: `仓库中的月蚀抑制剂被用于${girl.name}，药效延长至第 ${girl.drugUntilDay} 日。` });
    return;
  }
  girl.withdrawalDays = (girl.withdrawalDays ?? 0) + 1;
  const step = girl.withdrawalDays;
  const damage = step <= 3 ? 8 : step <= 6 ? 14 : step <= 9 ? 22 : 40;
  girl.hp = Math.max(0, girl.hp - damage);
  if (step === 1) state.logs.unshift({ id: `log-withdraw-${girl.id}-${state.day}`, time: dateLabel(state.day, 0), kind: 'clinic', text: `${girl.name}断药了。她把自己锁在宿舍里，说只是需要一点时间。` });
  if (girl.hp <= 0 || step >= 10) {
    girl.hp = 0; girl.dead = true; girl.status = 'retired'; girl.retired = true; girl.diedAt = dateLabel(state.day, 0);
    state.memorial.unshift({ girl: clone(girl), diedAt: girl.diedAt, cause: '断药。月蚀侵蚀吞掉了最后一点自我。', epitaph: '她终于不必再数着药片过日子。', lastBattleId: '' });
    state.logs.unshift({ id: `log-death-drug-${girl.id}`, time: dateLabel(state.day, 0), kind: 'memorial', text: `${girl.name}在断药第 ${step} 日停止了呼吸。事务所为她保留了那盏调到最暗的灯。` });
    state.girls = state.girls.filter(g => g.id !== girl.id);
  }
}


export const conditionCatalog = [  { name: '夜惊', kind: 'debuff' as const, description: '连续几晚在同一个时刻惊醒，白天会下意识避开钟声。', stat: 'insight' as StatKey, amount: -3 },
  { name: '手部震颤', kind: 'debuff' as const, description: '握笔时手指会轻轻发抖，写下的字比平时更用力。', stat: 'agility' as StatKey, amount: -4 },
  { name: '幻听', kind: 'debuff' as const, description: '在安静的房间里，偶尔会听见并不存在的汽笛。', stat: 'empathy' as StatKey, amount: -3 },
  { name: '过度警觉', kind: 'buff' as const, description: '很难真正放松，但危险靠近时她总是第一个察觉。', stat: 'insight' as StatKey, amount: 4 },
  { name: '甜食安抚', kind: 'buff' as const, description: '随身带着糖，情绪低落时会好得快一点。', stat: 'empathy' as StatKey, amount: 2 },
];

export function addCondition(state: GameState, girl: Girl, source: string): void {
  const seed = hashText(girl.id + state.day + source);
  const base = conditionCatalog[seed % conditionCatalog.length];
  girl.conditions.push({ id: `cond-${girl.id}-${seed.toString(16)}`, name: base.name, kind: base.kind, source, description: base.description, remaining: 3, removable: true, stat: base.stat, amount: base.amount });
  state.logs.unshift({ id: `log-cond-${girl.id}-${seed}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}在「${source}」之后出现了「${base.name}」。${base.description}` });
}

export function gainTrait(state: GameState, girl: Girl, source: string, chance = 0.35): void {
  if (!girl.traits || girl.dead) return;
  const seed = hashText(`${girl.id}:${state.day}:${state.minutes}:${source}:${girl.traits.length}`);
  if (seed % 100 >= chance * 100) return;
  const [trait] = pickTraits(seed, 1, girl.traits.map(t => t.id));
  if (!trait) return;
  girl.traits.push({ ...trait, gainedAt: dateLabel(state.day, state.minutes) });
  state.logs.unshift({ id: `log-trait-${girl.id}-${trait.id}-${seed}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}在「${source}」之后显露出新的特性「${trait.name}」。${trait.description}` });
}

export function tickConditions(girl: Girl, days: number): void {
  for (const condition of girl.conditions) condition.remaining -= days;
  girl.conditions = girl.conditions.filter(condition => condition.remaining > 0);
}

export function accruePension(state: GameState, days: number): void {
  let paid = 0;
  let missing = 0;
  for (const girl of state.girls) {
    if (girl.dead || !girl.retired) continue;
    for (let i = 0; i < days; i++) {
      const daily = Math.max(1, Math.round(pensionFor(girl) / 10));
      if (state.gold - paid - daily >= 0) paid += daily;
      else missing += daily;
    }
  }
  if (paid) { state.gold -= paid; book(state, state.day, -paid); }
  if (missing) {
    state.pensionDebt += missing;
    state.logs.unshift({ id: `log-pension-${state.day}-${state.pensionDebt}`, time: dateLabel(state.day, state.minutes), kind: 'finance', text: `退休金账户出现 ${missing} 星砂缺口，已记入事务所欠款。`, delta: -missing });
  }
  for (const girl of state.girls) {
    if (girl.dead || girl.retired) continue;
    if (state.day > girl.contractEndDay) girl.pensionMissed = Math.min(60, girl.pensionMissed + days);
  }
}
