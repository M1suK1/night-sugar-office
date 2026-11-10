import { pickTraits } from '../content/traits.ts';
import { pensionFor } from '../contracts.ts';
import { corruptionStage } from '../economy.ts';
import type { GameState, Girl, StatKey } from '../types.ts';
import { book, clone, dateLabel, hashText } from './core.ts';
import { spawnWitchConfrontation } from './witchEvent.ts';
// v35 从 src/game.ts 拆出：侵蚀、药瘾、特性与年金。

export function addCorruption(state: GameState, girl: Girl, amount: number): void {
  if (!amount || girl.dead || girl.retired) return;
  const before = corruptionStage(girl.corruption ?? 0);
  girl.corruption = Math.max(0, Math.min(100, Math.round((girl.corruption ?? 0) + amount)));
  const after = corruptionStage(girl.corruption);
  if (after > before) {
    state.logs.unshift({ id: `log-corrupt-${girl.id}-${girl.corruption}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}的侵蚀进入「${['澄明', '浅蚀', '深蚀', '魔女'][after]}」阶段。${after === 3 ? '她的影子长出了不属于人类的角。' : '她的共情正在被某种东西缓慢替换。'}` });
    if (after === 3) {
      girl.witch = true;
      girl.drugUntilDay = Math.max(girl.drugUntilDay ?? 0, state.day + 10);
      girl.withdrawalDays = 0;
      // v240：跨过魔女线的那一刻就排一段对峙，界面立刻弹出。
      spawnWitchConfrontation(state, girl);
    }
  }
}

export function drugTick(state: GameState, girl: Girl): void {
  if (!girl.witch || girl.dead) return;
  if ((girl.drugUntilDay ?? 0) >= state.day) { girl.withdrawalDays = 0; return; }
  if ((state.inventory['moon-drug'] ?? 0) > 0) {
    state.inventory['moon-drug'] -= 1;
    girl.drugUntilDay = state.day + 10;
    girl.withdrawalDays = 0;
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
