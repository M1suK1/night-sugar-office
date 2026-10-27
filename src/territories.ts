/**
 * 三方势力的辖区归属。
 *
 * 九个辖区在开局时随机（但按种子确定）分成三份，每方三区；不要求连成一片。
 * 归属不写进 `districts.ts` 的静态环境，而是在生成委托与绘制面板时叠加，
 * 这样易主只影响之后放出的委托，不会追溯改掉已经挂在地图上的任务。
 */
import { districts, districtOrder, type DistrictEffect, type DistrictId } from './districts.ts';
import type { FactionId, GameState } from './types.ts';

export const FACTION_ORDER: FactionId[] = ['witch', 'association', 'government'];

export const factionName: Record<FactionId, string> = {
  witch: '月蚀',
  association: '星灯',
  government: '市役所',
};

/** 地图着色与图例用色。 */
export const factionColor: Record<FactionId, string> = {
  witch: '#a06bd8',
  association: '#f3aec9',
  government: '#7fc8c0',
};

/** 占据某辖区给委托带来的额外修正。 */
export const factionEffect: Record<FactionId, Partial<DistrictEffect>> = {
  witch: { targetPct: 6, rewardPct: 12 },
  association: { rewardPct: 8, fatigueFlat: 2 },
  government: { targetPct: -4, reputationFlat: 1 },
};

/** 单一势力最多能占几个区；超过后易主请求改为索要金钱。 */
import { loadBalance } from './balance.ts';

export const TERRITORY_LIMIT = 5;

export type TerritoryMap = Record<DistrictId, FactionId>;
export type TerritoryLogEntry = { day: number; minutes: number; district: DistrictId; from: FactionId; to: FactionId };

function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * 按种子把九个辖区打散，前三给月蚀、中三给星灯、后三给市役所。
 * 同一份存档迁移时用同一个种子，版图不会在每次读档时跳变。
 */
export function assignTerritories(seed: string): TerritoryMap {
  const shuffled = [...districtOrder].sort((a, b) => fnv1a(`${seed}:${a}`) - fnv1a(`${seed}:${b}`));
  const map = {} as TerritoryMap;
  shuffled.forEach((id, index) => {
    map[id] = FACTION_ORDER[Math.min(FACTION_ORDER.length - 1, Math.floor(index / 3))];
  });
  return map;
}

/** 补齐缺失的辖区（旧存档 / 损坏数据），已有归属保留。 */
export function repairTerritories(current: Partial<TerritoryMap> | undefined, seed: string): TerritoryMap {
  const fallback = assignTerritories(seed);
  const map = { ...fallback };
  for (const id of districtOrder) {
    const owner = current?.[id];
    if (owner && FACTION_ORDER.includes(owner)) map[id] = owner;
  }
  return map;
}

export function territoryCounts(map: TerritoryMap): Record<FactionId, number> {
  const counts: Record<FactionId, number> = { witch: 0, association: 0, government: 0 };
  for (const id of districtOrder) counts[map[id]] += 1;
  return counts;
}

export function ownedDistricts(map: TerritoryMap, faction: FactionId): DistrictId[] {
  return districtOrder.filter(id => map[id] === faction);
}

/** 环境效果 + 归属势力效果；返回新的对象，不改动静态数据。 */
export function effectiveDistrictEffect(map: TerritoryMap, districtId: DistrictId): DistrictEffect {
  const base = districts[districtId].effect;
  const extra = factionEffect[map[districtId]];
  const merged: DistrictEffect = { ...base };
  for (const [key, value] of Object.entries(extra) as [keyof DistrictEffect, number][]) {
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

/** 势力层单独拿出来给面板分组显示。 */
export function territoryEffectLines(faction: FactionId): { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }[] {
  const effect = factionEffect[faction];
  const lines: { label: string; value: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
  if (effect.targetPct) lines.push({ label: '调查目标', value: `${effect.targetPct > 0 ? '+' : ''}${effect.targetPct}%`, tone: effect.targetPct < 0 ? 'good' : 'bad' });
  if (effect.rewardPct) lines.push({ label: '委托报酬', value: `+${effect.rewardPct}%`, tone: 'good' });
  if (effect.fatigueFlat) lines.push({ label: '结算疲劳', value: `${effect.fatigueFlat > 0 ? '+' : ''}${effect.fatigueFlat}`, tone: effect.fatigueFlat > 0 ? 'bad' : 'good' });
  if (effect.reputationFlat) lines.push({ label: '成功声望', value: `+${effect.reputationFlat}`, tone: 'good' });
  return lines;
}

export function territoryOwner(state: Pick<GameState, 'territories'>, districtId: DistrictId): FactionId {
  return state.territories?.[districtId] ?? assignTerritories('fallback')[districtId];
}

/** 该势力还能不能再吃下一个区。 */
export function canClaim(map: TerritoryMap, faction: FactionId): boolean {
  const limit = loadBalance().territoryLimit;
  return (territoryCounts(map)[faction] ?? 0) < limit;
}
