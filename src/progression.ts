import type { Archetype, Girl, StatKey } from './types';
import { effectiveGuard } from './economy.ts';

export const MAX_LEVEL = 10;

export function expNeeded(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  return 60 + 20 * (level - 1);
}
export function battleExp(recommendedLevel: number): number {
  return 30 + 10 * (Math.max(1, Math.min(MAX_LEVEL, recommendedLevel)) - 1);
}
export function investigationExp(recommendedLevel: number): number {
  return Math.round(battleExp(recommendedLevel) / 2);
}
export function growthFor(archetype: Archetype = '输出'): [StatKey, StatKey] {
  if (archetype === '输出') return ['magic', 'agility'];
  if (archetype === '守护') return ['empathy', 'magic'];
  if (archetype === '控制') return ['insight', 'agility'];
  if (archetype === '治愈') return ['empathy', 'magic'];
  if (archetype === '侦查') return ['insight', 'agility'];
  return ['magic', 'agility'];
}
export function baseStatsAt(stats: Record<StatKey, number>, level: number, archetype?: Archetype): Record<StatKey, number> {
  const [main, secondary] = growthFor(archetype);
  const out = { ...stats };
  out[main] = Math.max(20, out[main] - (level - 1) * 2);
  out[secondary] = Math.max(20, out[secondary] - (level - 1));
  return out;
}
export function grantExp(girl: Girl, amount: number): boolean {
  if (girl.level >= MAX_LEVEL || girl.dead || girl.retired || amount <= 0) return false;
  const need = expNeeded(girl.level);
  if (girl.exp + amount < need) {
    girl.exp += amount;
    return false;
  }
  const [main, secondary] = growthFor(girl.archetype);
  girl.exp = Math.max(0, girl.exp + amount - need);
  girl.level += 1;
  girl.stats[main] += 2;
  girl.stats[secondary] += 1;
  girl.maxHp += 4;
  girl.hp = Math.min(girl.maxHp, girl.hp + 4);
  // 心防不是独立数值：共情涨了，心防跟着涨。
  girl.maxSpirit = effectiveGuard(girl);
  girl.spirit = girl.maxSpirit;
  return true;
}
export function progressLabel(girl: Girl): string {
  if (girl.level >= MAX_LEVEL) return 'MAX';
  return `${girl.exp} / ${expNeeded(girl.level)}`;
}
