import type { BossTemplate, GameState, MonsterSpec, MonsterTemplate, StatKey } from '../types.ts';
import { monsters } from './monsters.ts';
import { customBossTemplates } from './library.ts';

/**
 * Boss 池。首只不是空月——空月是背景里的终焉，不是能排进日程的东西。
 * 王座是城里真能长出来的那种麻烦：甜味被抽干，椅子长高一截。
 */
export const bosses: BossTemplate[] = [{
  id: 'boss-candy-throne', name: '糖霜王座', title: '加冕的蛀牙',
  blurb: '整条商业街所沉淀的甜美记忆在某个暴雨深夜被彻底抽干。废弃游乐场中央的石膏王座破土疯长，一尊由浓稠结晶糖霜自我塑形的狂暴天灾端坐其上，冷酷地将整座街区剥落的温度与味觉熔铸为属于自己的冠冕。',
  monsterId: 'candy-throne',
  maxHp: 2400,
  // 心防由共情推出（v25）：180 共情 = 360 心防，要 4–5 发共情技才破。
  stats: { magic: 96, insight: 88, agility: 72, empathy: 180 },
  phases: [
    { atHpPct: 1.00, skillIds: ['boss-sugar-crown', 'boss-clock-hands'], line: '它以干瘪骨指将沉重糖冠按压至头顶，整座城区的防护灯网瞬间黯淡了一格。' },
    { atHpPct: 0.62, skillIds: ['boss-sugar-crown', 'boss-mirror-litany'], addIds: ['sugar-moth', 'sugar-moth'], line: '王座底座在刺耳蜂鸣中融化坍塌，翻滚的沸腾糖浆化作缠绕队员脚踝的致命泥沼。' },
    { atHpPct: 0.30, skillIds: ['boss-tide-of-names', 'boss-clock-hands'], line: '它猛然裂开层叠利齿的巨口，自深渊般的颌骨深处狂暴呕吐出数以千计早已殉职的名字。' },
  ],
  reward: 5200, duration: 90, recommendedLevel: 6, color: '#F2A0C0',
  firstDay: 10, defeatGapDays: 10, pollutionPressure: 3,
}];

/** 内置 + 工坊自建；同 id 时以工坊的为准，方便玩家改数值。 */
export function bossTemplates(state?: Pick<GameState, 'customBosses'>): BossTemplate[] {
  const map = new Map<string, BossTemplate>();
  for (const boss of bosses) map.set(boss.id, boss);
  // 内容库是唯一的存放处，state 里那份只是运行期快照——冲突时以内容库为准。
  for (const boss of state?.customBosses ?? []) if (boss?.id) map.set(boss.id, boss);
  for (const boss of customBossTemplates()) if (boss?.id) map.set(boss.id, boss);
  return [...map.values()];
}

export function bossTemplateOf(state: GameState | undefined, id: string | undefined | null): BossTemplate | undefined {
  if (!id) return undefined;
  return bossTemplates(state).find(boss => boss.id === id);
}

/** 按循环轮着来：第一次首只，后面依次下一只（以后再往池子里加）。 */
export function pickBoss(state: GameState): BossTemplate {
  const pool = bossTemplates(state);
  const index = Math.max(0, state.bossCycle) % pool.length;
  return pool[index];
}

/** 当前这轮的 Boss 模板；旧存档没有 template 字段时按首只算。 */
export function currentBoss(state: GameState): BossTemplate | undefined {
  return bossTemplateOf(state, state.boss?.template ?? bosses[0].id);
}

export const BOSS_MONSTER_PREFIX = 'boss-mon-';

/** 找不到本体魔物时的兜底立绘，保证工坊预览不是空白。 */
const FALLBACK_SPEC: MonsterSpec = {
  bodyPlan: 'humanoid', scale: 1.5, appendages: 6, core: '糖',
  palette: { body: '#5A2038', shade: '#2B0E1B', rim: '#FFC7DE' },
  aura: '花瓣', motif: '糖',
};

/**
 * 把模板合成为一份「Boss 版魔物」副本：战力、心防、三阶段技能都写死在副本上，
 * 于是战斗里既有的 bossPhaseSkillIds 换组逻辑不用改。
 */
export function spawnBossMonster(state: GameState, boss: BossTemplate): string {
  const id = `${BOSS_MONSTER_PREFIX}${boss.id}`;
  const base = state.customMonsters.find(item => item.id === id)
    ?? state.customMonsters.find(item => item.id === boss.monsterId)
    ?? monsters.find(item => item.id === boss.monsterId);
  const stats: Record<StatKey, number> = {
    magic: boss.stats.magic ?? base?.stats.magic ?? 70,
    insight: boss.stats.insight ?? base?.stats.insight ?? 70,
    agility: boss.stats.agility ?? base?.stats.agility ?? 70,
    empathy: boss.stats.empathy ?? base?.stats.empathy ?? 70,
  };
  const template: MonsterTemplate = {
    id,
    name: boss.name,
    epithet: boss.title,
    rank: '王座',
    element: base?.element ?? '糖霜系',
    color: boss.color,
    maxHp: boss.maxHp,
    maxSpirit: stats.empathy * 2,
    stats,
    skillIds: boss.phases[0]?.skillIds ?? [],
    bossPhaseSkillIds: boss.phases[boss.phases.length - 1]?.skillIds ?? [],
    bossPhases: boss.phases,
    rules: [],
    trait: base?.trait ?? '血越少，招式越狠：三个阶段各换一组技能。',
    description: boss.blurb,
    spec: base?.spec ?? FALLBACK_SPEC,
    codex: base?.codex ?? { habit: '坐在游乐场中央，等有人来把它请下去。', weakness: '它的冠是甜的，冠下面的东西不是。' },
  };
  const index = state.customMonsters.findIndex(item => item.id === id);
  if (index >= 0) state.customMonsters[index] = template;
  else state.customMonsters.push(template);
  return id;
}
