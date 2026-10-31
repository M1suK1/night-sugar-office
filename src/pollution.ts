/**
 * 辖区污染度。
 *
 * 污染是**辖区状态**，不是临时战斗 buff：它每天自己往上爬，只在玩家完成委托时被压下去。
 * 三方势力不改变自然涨幅，只改变「完成委托后净化掉多少」——所以城市变脏是共同背景，
 * 玩家能选择的只是把哪一块擦干净。
 *
 * 委托生成时会把当时的环境、污染度与当主一起冻结进 `Mission`，
 * 这样派遣之后辖区易主或被人净化，都不会回头改掉已经放出去的这一单。
 */
import { districts, type DistrictId } from './districts.ts';
import { FACTION_ORDER } from './territories.ts';
import type { DistrictEffect } from './districts.ts';
import type { FactionId, GameState, Mission, WorkKind } from './types.ts';
import { factionPurification } from './factions.ts';

export const POLLUTION_MAX = 100;
export const POLLUTION_MIN = 0;

export type PollutionTier = 'clean' | 'hazy' | 'murky' | 'deep' | 'calamity';

export interface PollutionEffect {
  enemyHpPct: number;
  enemyPowerPct: number;
  targetPct: number;
  rewardPct: number;
  fatigueFlat: number;
  corruptionFlat: number;
}

export interface PollutionForecast {
  level: number;
  tier: PollutionTier;
  dailyRise: number;
  /** 只在调用方传入 `mission` 时才有值；没有具体委托时 UI 不显示净化估算。 */
  estimatedRelief?: number;
  effect: PollutionEffect;
}

/** 委托生成时冻结的净化口径，不随辖区易主变化。 */
export interface PollutionSnapshot {
  /** 派遣时的当主。 */
  owner: FactionId;
  /** 委托时长（分钟）。 */
  duration: number;
  /** 委托类型。 */
  work: WorkKind;
}

/** 九区初始污染：主题基线，不随机，保证同一版本开局观感一致。 */
const INITIAL_POLLUTION: Record<DistrictId, number> = {
  candy: 6,
  station: 22,
  plaza: 10,
  greenhouse: 16,
  cathedral: 38,
  crossroad: 30,
  oldtown: 46,
  clocktower: 26,
  docks: 34,
};

export const pollutionTierNames: Record<PollutionTier, string> = {
  clean: '清洁',
  hazy: '微浊',
  murky: '浑浊',
  deep: '深染',
  calamity: '灾厄',
};

/** 地图与图例用色。 */
export const pollutionTierColors: Record<PollutionTier, string> = {
  clean: '#8fd3c7',
  hazy: '#c9b36a',
  murky: '#c08a5e',
  deep: '#9b6bc4',
  calamity: '#c04f6a',
};

export const pollutionTierOrder: PollutionTier[] = ['clean', 'hazy', 'murky', 'deep', 'calamity'];

export function clampPollution(value: number): number {
  if (!Number.isFinite(value)) return POLLUTION_MIN;
  return Math.max(POLLUTION_MIN, Math.min(POLLUTION_MAX, Math.round(value)));
}

export function pollutionTier(level: number): PollutionTier {
  const value = clampPollution(level);
  if (value >= 80) return 'calamity';
  if (value >= 60) return 'deep';
  if (value >= 40) return 'murky';
  if (value >= 20) return 'hazy';
  return 'clean';
}

export function pollutionTierLabel(level: number): string {
  return pollutionTierNames[pollutionTier(level)];
}

/** 污染带来的全部数值后果；四舍五入后使用，避免面板与结算出现小数分叉。 */
export function pollutionEffect(level: number): PollutionEffect {
  const value = clampPollution(level);
  return {
    enemyHpPct: Math.round(value * 0.32),
    enemyPowerPct: Math.round(value * 0.18),
    targetPct: Math.round(value * 0.10),
    rewardPct: Math.round(value * 0.16),
    fatigueFlat: Math.floor(value / 20),
    corruptionFlat: value >= 80 ? 2 : value >= 50 ? 1 : 0,
  };
}

/** 每天自然上升：只由当前等级决定，任何势力都不加也不减。 */
export function pollutionDailyRise(level: number): number {
  return 1 + Math.floor(clampPollution(level) / 30);
}

/** 完成一次委托能净化多少；`snapshot.owner` 决定势力加成。 */
export function pollutionRelief(snapshot: PollutionSnapshot): number {
  const base = 5 + Math.floor(Math.max(0, snapshot.duration) / 30) + (snapshot.work === 'combat' ? 1 : 0);
  return base + factionPurification(snapshot.owner).relief;
}

/** 失败/击退时的污染上升；比净化小得多，只作为「没办成」的代价。 */
export function pollutionPenalty(snapshot: PollutionSnapshot): number {
  return snapshot.work === 'combat' ? 2 : 1;
}

/** 从委托上取快照；旧委托没有快照时回退到当前当主。 */
export function pollutionSnapshotOf(state: GameState, mission: Mission): PollutionSnapshot {
  const district = mission.district;
  const fallback: FactionId = district ? state.territories?.[district] ?? FACTION_ORDER[0] : FACTION_ORDER[0];
  return {
    owner: mission.ownerAtSpawn ?? fallback,
    duration: mission.duration,
    work: mission.work,
  };
}

/** 该委托是否按「当前辖区」回退估算，UI 用来加“按当前辖区估算”的注脚。 */
export function pollutionIsEstimated(mission: Mission): boolean {
  return !mission.ownerAtSpawn;
}

export function pollutionForecast(state: GameState, district: DistrictId, mission?: Mission): PollutionForecast {
  const level = clampPollution(state.pollution?.[district] ?? INITIAL_POLLUTION[district]);
  const forecast: PollutionForecast = {
    level,
    tier: pollutionTier(level),
    dailyRise: pollutionDailyRise(level),
    effect: pollutionEffect(level),
  };
  if (mission) forecast.estimatedRelief = pollutionRelief(pollutionSnapshotOf(state, mission));
  return forecast;
}

export function initialPollution(): Record<DistrictId, number> {
  return { ...INITIAL_POLLUTION };
}

/** 补齐缺失辖区、截断越界值；不抛错，只修复。 */
export function repairPollution(raw: Partial<Record<DistrictId, number>> | undefined): Record<DistrictId, number> {
  const map = initialPollution();
  if (!raw || typeof raw !== 'object') return map;
  for (const id of Object.keys(map) as DistrictId[]) {
    const value = raw[id];
    if (typeof value === 'number') map[id] = clampPollution(value);
  }
  return map;
}

/** 把所有数值字段加起来；缺省 0。用于静态地形 + 当主 + 污染三合一。 */
export function mergeDistrictEffects(...effects: Array<Partial<DistrictEffect> | undefined>): DistrictEffect {
  const merged: DistrictEffect = {};
  for (const effect of effects) {
    if (!effect) continue;
    for (const [key, value] of Object.entries(effect) as [keyof DistrictEffect, number | undefined][]) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) continue;
      merged[key] = (merged[key] ?? 0) + value;
    }
  }
  return merged;
}

/** 城市平均污染，用于地图图例。 */
export function cityAveragePollution(state: GameState): number {
  const ids = Object.keys(INITIAL_POLLUTION) as DistrictId[];
  const sum = ids.reduce((total, id) => total + clampPollution(state.pollution?.[id] ?? INITIAL_POLLUTION[id]), 0);
  return Math.round(sum / Math.max(1, ids.length));
}

/** 污染最高的一块辖区，供夜间事件摘要挑重点。 */
export function dirtiestDistrict(state: GameState): { id: DistrictId; level: number } {
  const ids = Object.keys(INITIAL_POLLUTION) as DistrictId[];
  let best: { id: DistrictId; level: number } = { id: ids[0], level: 0 };
  for (const id of ids) {
    const level = clampPollution(state.pollution?.[id] ?? INITIAL_POLLUTION[id]);
    if (level > best.level) best = { id, level };
  }
  return best;
}

/** 辖区名取静态表，避免 UI 各自拼。 */
export function districtName(id: DistrictId): string {
  return districts[id].name;
}

export function pollutionLines(effect: PollutionEffect): string[] {
  const lines: string[] = [];
  if (effect.enemyHpPct) lines.push(`魔物生命 +${effect.enemyHpPct}%`);
  if (effect.enemyPowerPct) lines.push(`魔物属性 +${effect.enemyPowerPct}%`);
  if (effect.fatigueFlat) lines.push(`疲劳 +${effect.fatigueFlat}`);
  if (effect.corruptionFlat) lines.push(`侵蚀 +${effect.corruptionFlat}`);
  return lines;
}

/** 本轮第几天：Boss 被击败当天把 `cycleStartDay` 重置，于是下一次从 1 开始。 */
export function cycleDay(state: GameState): number {
  return Math.max(1, state.day - (state.cycleStartDay ?? 1) + 1);
}

/**
 * 污染地板：净化的下限，随时间抬高，第十天到 30。
 *
 * 地板是这轮循环的压迫感来源——擦干净的地方睡一觉又脏回来，越靠后越擦不动。
 */
export function pollutionFloor(state: GameState): number {
  return Math.min(30, cycleDay(state) * 3);
}

/** 完成委托后的实际值：擦不到地板以下。 */
export function purifyTo(state: GameState, level: number, relief: number): number {
  return clampPollution(Math.max(pollutionFloor(state), level - relief));
}

/** 按辖区自身污染度给难度权重，四档整数权重合计 100。 */
export function difficultyWeights(pollution: number): Record<'低危' | '中危' | '高危' | '绝望', number> {
  if (pollution >= 80) return { 低危: 5, 中危: 25, 高危: 45, 绝望: 25 };
  if (pollution >= 60) return { 低危: 15, 中危: 35, 高危: 35, 绝望: 15 };
  if (pollution >= 40) return { 低危: 30, 中危: 40, 高危: 22, 绝望: 8 };
  if (pollution >= 20) return { 低危: 50, 中危: 38, 高危: 12, 绝望: 0 };
  return { 低危: 70, 中危: 28, 高危: 2, 绝望: 0 };
}
