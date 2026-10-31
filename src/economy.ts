import type { Equipment, GameState, Girl, StatKey } from './types';
import { getItem } from './content/items.ts';
import { guardMax } from './spirit.ts';

export const statOrder: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];

export function corruptionStage(value: number): 0 | 1 | 2 | 3 {
  if (value >= 70) return 3;
  if (value >= 40) return 2;
  if (value >= 1) return 1;
  return 0;
}
export const corruptionLabels = ['澄明', '浅蚀', '深蚀', '魔女'] as const;
export const corruptionHints = [
  '她的影子仍然完整。',
  '偶尔会听见她对着空处低声说话。',
  '瞳色开始不稳定，袖口出现无法解释的纹路。',
  '她已经越过那条线。月蚀庭称这种状态为“魔女”。',
] as const;

export function corruptionMultipliers(value: number): { empathy: number; other: number } {
  const stage = corruptionStage(value);
  if (stage === 3) return { empathy: 0.75, other: 1.15 };
  if (stage === 2) return { empathy: 0.88, other: 1.08 };
  if (stage === 1) return { empathy: 0.95, other: 1.03 };
  return { empathy: 1, other: 1 };
}

export function equipmentOf(girl: Girl): Equipment[] {
  return [getItem(girl.equipment?.weapon), getItem(girl.equipment?.charm)].filter((item): item is Equipment => Boolean(item));
}

export function effectiveStats(girl: Girl, state?: GameState): Record<StatKey, number> {
  const raw: Record<StatKey, number> = { ...girl.stats };
  for (const item of equipmentOf(girl)) {
    for (const key of statOrder) raw[key] += item.stats?.[key] ?? 0;
  }
  const mult = corruptionMultipliers(girl.corruption ?? 0);
  const out = {} as Record<StatKey, number>;
  for (const key of statOrder) out[key] = Math.round(raw[key] * (key === 'empathy' ? mult.empathy : mult.other));
  if (state && state.reputation >= 75) for (const key of statOrder) out[key] += 2;
  if (girl.conditions) for (const condition of girl.conditions) {
    if (condition.remaining > 0 && condition.stat && condition.amount) out[condition.stat] += condition.amount;
  }
  for (const key of statOrder) out[key] = Math.max(10, out[key]);
  return out;
}

export function effectiveMaxHp(girl: Girl): number {
  const bonus = equipmentOf(girl).reduce((sum, item) => sum + (item.maxHpBonus ?? 0), 0);
  return Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08))) + bonus;
}
/** 装备提供的气势百分比加成合计。 */
export function spiritBonusPctOf(girl: Girl): number {
  return equipmentOf(girl).reduce((sum, item) => sum + (item.spiritBonusPct ?? 0), 0);
}

/**
 * 心防上限 = 面板共情 × 2 + 装备百分比，再减去疤痕带来的上限损失。
 *
 * 光看 `girl.maxSpirit` 是不够的：升级、换装、长疤都会立刻改变这个值，
 * 所以每次要用的时候重算，字段只作为缓存。
 */
export function effectiveGuard(girl: Girl): number {
  const base = guardMax({ stats: { empathy: effectiveStats(girl).empathy } }, spiritBonusPctOf(girl));
  const scar = girl.scars.reduce((sum, sc) => sum + (sc.effect.kind === 'maxSpirit' ? Math.abs(sc.effect.amount) : 0), 0);
  return Math.max(10, base - scar);
}

/** 兼容旧名：共情值现在就是心防条，读的是同一个上限。 */
export function effectiveMaxSpirit(girl: Girl): number {
  return effectiveGuard(girl);
}

export const cityStages = [
  { min: 0, name: '崩坏', color: '#D96A7A', note: '委托稀少，候选者不愿靠近。' },
  { min: 20, name: '动荡', color: '#D9956A', note: '街道仍在运转，但没人敢走夜路。' },
  { min: 40, name: '维持', color: '#C9B07A', note: '事务所被允许继续营业。' },
  { min: 60, name: '安定', color: '#9CC9D2', note: '市民开始记得夜班的名字。' },
  { min: 75, name: '信赖', color: '#F1A7C6', note: '队伍在全城获得 +2 共鸣。' },
  { min: 90, name: '灯火', color: '#FFD6E5', note: '城市愿意把最好的东西留给你们。' },
] as const;
export function cityStage(reputation: number) {
  return [...cityStages].reverse().find(stage => reputation >= stage.min) ?? cityStages[0];
}

export function marketSize(level: number): number {
  return 1 + Math.max(1, Math.min(4, level));
}
export function marketUpgradeCost(level: number): number | null {
  return ([0, 6000, 12000, 24000] as const)[Math.min(3, Math.max(0, level))] ?? null;
}
export function advancedCost(level: number): { gold: number; stability: number } {
  return { gold: 1200 * level, stability: [0, 1, 2, 4, 6, 9, 12][Math.max(1, Math.min(6, level))] ?? 12 };
}
export function factionPrice(item: Equipment, standing: number): number {
  const factor = standing < 30 ? 1.1 : standing >= 80 ? 0.9 : standing >= 60 ? 0.95 : 1;
  return Math.round(item.price * factor);
}
export function factionAttitude(standing: number): { label: string; discount: string; tone: 'cold' | 'neutral' | 'warm' | 'ally' } {
  if (standing >= 80) return { label: '盟约', discount: '货架 −10%', tone: 'ally' };
  if (standing >= 60) return { label: '亲善', discount: '货架 −5%', tone: 'warm' };
  if (standing >= 30) return { label: '中立', discount: '标准原价', tone: 'neutral' };
  return { label: '戒备', discount: '货架 +10%', tone: 'cold' };
}
export function contractDiscount(state: GameState): number {
  return state.inventory['permit'] ? 10 : 0;
}
