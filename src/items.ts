import type { Equipment, EquipmentTier } from './types.ts';

/**
 * 装备阶级。数据里可以没有 `tier`（旧存档、内容包、LLM 生成的装备都可能缺），
 * 缺省时按价格反推，保证任何一件装备都能落到某一档上。
 */
export const TIER_LABEL: Record<EquipmentTier, string> = { 1: '一阶', 2: '二阶', 3: '三阶', 4: '四阶', 5: '五阶' };
export const TIER_COLOR: Record<EquipmentTier, string> = { 1: '#8fa3a0', 2: '#7fb2c9', 3: '#9b8fd0', 4: '#c9a86a', 5: '#e0709a' };
/** 每一档的声望门槛：五阶只认关系，八十点以后才有货。 */
export const TIER_STANDING: Record<EquipmentTier, number> = { 1: 0, 2: 20, 3: 35, 4: 50, 5: 80 };
export const TIER_ORDER: EquipmentTier[] = [1, 2, 3, 4, 5];

/** 价格 → 阶级的兜底推断，与内容里的价格带一致。 */
export function tierFromPrice(price: number): EquipmentTier {
  if (!Number.isFinite(price) || price < 1200) return 1;
  if (price < 2600) return 2;
  if (price < 5000) return 3;
  if (price < 9000) return 4;
  return 5;
}

export function tierOf(item: Pick<Equipment, 'tier' | 'price'>): EquipmentTier {
  const tier = item.tier;
  if (tier === 1 || tier === 2 || tier === 3 || tier === 4 || tier === 5) return tier;
  return tierFromPrice(item.price);
}

export function tierLabel(item: Pick<Equipment, 'tier' | 'price'>): string {
  return TIER_LABEL[tierOf(item)];
}

/** 阶级对应的声望门槛；内容里写得更低就按内容的来，只用来兜住漏写的条目。 */
export function tierStanding(item: Pick<Equipment, 'tier' | 'price' | 'standingReq'>): number {
  return Math.max(item.standingReq, TIER_STANDING[tierOf(item)]);
}
