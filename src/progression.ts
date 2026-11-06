import type { Archetype, Girl, Mission, StatKey } from './types';
import { effectiveGuard } from './economy.ts';
import { missionBaseExp } from './missionReward.ts';

export const MAX_LEVEL = 10;
/** 每级可分配的四维点数（手动模式）。 */
export const POINTS_PER_LEVEL = 10;
/** 每级提升的最大生命；生命成长不占四维点。 */
export const HP_PER_LEVEL = 10;
/** 自动模式按职阶给出的主/副属性，与手动同值，避免两种模式成长速度不同。 */
export const AUTO_MAIN_POINTS = 6;
export const AUTO_SECONDARY_POINTS = 4;
/** 加点上限；战斗内部的临时加成不受这条限制。 */
export const STAT_ALLOC_CAP = 120;

export type LevelUpMode = 'auto' | 'manual';

export interface LevelUpResult {
  leveled: boolean;
  levels: number;
  from: number;
  to: number;
  /** 本次升级新拿到的可分配点数；自动模式为 0。 */
  points: number;
}

/**
 * 等级经验需求：二次曲线。
 *
 * 旧版是 60 + 20 × (level - 1) 的线性曲线，高难委托很容易被半级封顶压平；
 * v165 改成 60 + 18 × (level - 1) + 3 × (level - 1)²，前两级几乎不变，
 * 后面逐级拉长，让高难委托的经验优势有意义。
 */
export function expNeeded(level: number): number {
  if (level >= MAX_LEVEL) return 0;
  const step = Math.max(0, level - 1);
  return 60 + 18 * step + 3 * step * step;
}

/**
 * 一次委托给一位少女的经验。
 *
 * 基础值由魔物阶级/数量 × 时长（战斗）或难度 × 时长（调查）决定；
 * 单次最多升 1 级：拿到不超过「到下一级还差多少」，溢出丢弃。
 */
export function missionExp(girl: Girl, mission: Mission): number {
  const need = expNeeded(girl.level);
  if (need <= 0) return 0;
  const remaining = Math.max(0, need - Math.max(0, girl.exp ?? 0));
  return Math.min(missionBaseExp(mission), remaining);
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

/**
 * 把某份数值从 `fromLevel` 换算到 `toLevel`（v159）。
 *
 * 势力名册不跑 `grantExp`，只会改 level；这里负责把四维补到对应等级：
 * 先回推到 1 级基准，再按自动升级（主 +6 / 副 +4，上限 120）加到目标级。
 */
export function statsAtLevel(
  stats: Record<StatKey, number>,
  fromLevel: number,
  toLevel: number,
  archetype?: Archetype,
): Record<StatKey, number> {
  const from = Math.max(1, Math.min(MAX_LEVEL, Math.round(fromLevel || 1)));
  const to = Math.max(1, Math.min(MAX_LEVEL, Math.round(toLevel || 1)));
  const [main, secondary] = growthFor(archetype);
  // 自动升级的成长量是固定值（不是卡面的 2/1），回推和加成都用同一套系数，重复换算才不会膨胀。
  const out = { ...stats };
  out[main] = Math.max(20, out[main] - (from - 1) * AUTO_MAIN_POINTS);
  out[secondary] = Math.max(20, out[secondary] - (from - 1) * AUTO_SECONDARY_POINTS);
  const levels = Math.max(0, to - 1);
  out[main] = Math.min(STAT_ALLOC_CAP, out[main] + levels * AUTO_MAIN_POINTS);
  out[secondary] = Math.min(STAT_ALLOC_CAP, out[secondary] + levels * AUTO_SECONDARY_POINTS);
  return out;
}

/**
 * 结算经验与升级。
 *
 * `manual` 只发点数，让玩家自己分配到四维；`auto` 按职阶直接加主/副属性。
 * 两种模式每级都是 10 点等值成长，最大生命每级 +10。
 */
export function grantExp(girl: Girl, amount: number, mode: LevelUpMode = 'auto'): LevelUpResult {
  const from = girl.level;
  if (girl.level >= MAX_LEVEL || girl.dead || girl.retired || amount <= 0) {
    return { leveled: false, levels: 0, from, to: from, points: 0 };
  }
  girl.exp += amount;
  let levels = 0;
  while (girl.level < MAX_LEVEL) {
    const need = expNeeded(girl.level);
    if (need <= 0 || girl.exp < need) break;
    girl.exp -= need;
    girl.level += 1;
    levels += 1;
    // 上限的唯一真源是 baseMaxHp（疤痕按比例削它）；只改 maxHp 会被战后重算抹掉，
    // 这就是「每级该 +10 却没生效」的原因。
    girl.baseMaxHp = Math.max(girl.baseMaxHp ?? girl.maxHp, girl.maxHp) + HP_PER_LEVEL;
    recomputeMaxHp(girl);
    girl.hp = Math.min(girl.maxHp, girl.hp + HP_PER_LEVEL);
    if (mode === 'manual') {
      girl.unspentPoints = (girl.unspentPoints ?? 0) + POINTS_PER_LEVEL;
    } else {
      const [main, secondary] = growthFor(girl.archetype);
      girl.stats[main] = Math.min(STAT_ALLOC_CAP, girl.stats[main] + AUTO_MAIN_POINTS);
      girl.stats[secondary] = Math.min(STAT_ALLOC_CAP, girl.stats[secondary] + AUTO_SECONDARY_POINTS);
    }
    // 心防不是独立数值：共情涨了，心防跟着涨。
    girl.maxSpirit = effectiveGuard(girl);
    girl.spirit = girl.maxSpirit;
  }
  if (girl.level >= MAX_LEVEL) girl.exp = 0;
  return { leveled: levels > 0, levels, from, to: girl.level, points: mode === 'manual' ? levels * POINTS_PER_LEVEL : 0 };
}

/** 按基础上限与疤痕重算当前上限：升级、留疤之后都走这里。 */
export function recomputeMaxHp(girl: Girl): void {
  const base = Math.max(40, girl.baseMaxHp ?? girl.maxHp);
  girl.baseMaxHp = base;
  girl.maxHp = Math.max(40, Math.round(base * Math.max(0.4, 1 - girl.scars.length * 0.08)));
}

/** 把一点（或几点）可分配点数加到四维上。校验交给调用方给出界面文案。 */
export function allocatePoint(girl: Girl, stat: StatKey, amount = 1): { ok: boolean; message: string } {
  const points = Math.max(1, Math.floor(amount));
  const available = girl.unspentPoints ?? 0;
  if (girl.dead || girl.retired) return { ok: false, message: '她已经不在值夜名册上了。' };
  if (available <= 0) return { ok: false, message: '没有可分配的点数，先让她升一级。' };
  if (points > available) return { ok: false, message: `只剩 ${available} 点可分配。` };
  if (girl.stats[stat] + points > STAT_ALLOC_CAP) return { ok: false, message: `这项属性最高只能到 ${STAT_ALLOC_CAP}。` };
  girl.stats[stat] += points;
  girl.unspentPoints = available - points;
  girl.maxSpirit = effectiveGuard(girl);
  girl.spirit = Math.min(girl.spirit, girl.maxSpirit);
  return { ok: true, message: `已把 ${points} 点加到${statLabel[stat]}。` };
}

export const statLabel: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };
export const statHint: Record<StatKey, string> = {
  magic: '决定伤害倍率。',
  insight: '决定命中率。',
  agility: '决定闪避与先手速度。',
  empathy: '决定心防与护持。',
};

export function progressLabel(girl: Girl): string {
  if (girl.level >= MAX_LEVEL) return 'MAX';
  return `${girl.exp} / ${expNeeded(girl.level)}`;
}
