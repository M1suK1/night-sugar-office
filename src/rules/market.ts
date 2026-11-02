import { factionInfo, items } from '../content/items.ts';
import { factionPrice, marketSize, marketUpgradeCost } from '../economy.ts';
import { tierOf } from '../items.ts';
import type { Equipment, EquipmentTier, FactionId, GameState, Girl, MarketStockEntry } from '../types.ts';
import { hashText } from './core.ts';
// v35 从 src/game.ts 拆出：市场窗口、货架与价格。

export function marketPool(state: GameState): Girl[] {
  return state.candidates;
}

/** 当前等级开几个窗口；坏档里的等级先按 1 级算。 */

/** 当前等级开几个窗口；坏档里的等级先按 1 级算。 */
export function marketWindowSize(state: GameState): number {
  return marketSize(Number.isFinite(state.marketLevel) ? state.marketLevel : 1);
}

/** 今日真正摆在市场里的候选：一天只开这么多个窗口，售出的留占位，次日换一批。 */

/** 今日真正摆在市场里的候选：一天只开这么多个窗口，售出的留占位，次日换一批。 */
export interface MarketSlot {
  id: string;
  girl?: Girl;
  sold: boolean;
}

/** 窗口的完整槽位：售出的候选人已经离开池子，但 window id 仍保留，显示为售罄。 */

/** 窗口的完整槽位：售出的候选人已经离开池子，但 window id 仍保留，显示为售罄。 */
export function marketSlots(state: GameState): MarketSlot[] {
  const size = marketWindowSize(state);
  const byId = new Map(state.candidates.map(girl => [girl.id, girl]));
  const sold = new Set(state.marketSold ?? []);
  const ids = (state.marketWindow ?? []).length
    ? state.marketWindow ?? []
    : state.candidates.slice(0, size).map(girl => girl.id);
  const slots: MarketSlot[] = [];
  for (const id of ids.slice(0, size)) {
    const girl = byId.get(id);
    if (girl) slots.push({ id, girl, sold: false });
    else if (sold.has(id)) slots.push({ id, sold: true });
  }
  return slots;
}

export function marketWindow(state: GameState): Girl[] {
  return marketSlots(state).flatMap(slot => slot.girl ? [slot.girl] : []);
}

/** 把窗口对齐到池子与当前等级：`fill` 用来开新窗，默认只裁掉已经不在池子里的人。 */

/** 把窗口对齐到池子与当前等级：`fill` 用来开新窗，默认只裁掉已经不在池子里的人。 */
export function normalizeMarketWindow(state: GameState, fill = false): void {
  const size = marketWindowSize(state);
  const alive = new Set(state.candidates.map(girl => girl.id));
  const sold = new Set(state.marketSold ?? []);
  const kept = (state.marketWindow ?? []).filter(id => alive.has(id) || sold.has(id));
  if (fill) {
    for (const girl of state.candidates) {
      if (kept.length >= size) break;
      if (!kept.includes(girl.id)) kept.push(girl.id);
    }
  }
  state.marketWindow = kept.slice(0, size);
}

/** 新来的候选当天就摆到窗口最前；窗口满了就顶掉最旧的一位（人还留在池子里）。 */

/** 新来的候选当天就摆到窗口最前；窗口满了就顶掉最旧的一位（人还留在池子里）。 */
export function unshiftMarketWindow(state: GameState, id: string): void {
  // 当天已经有售罄占位时，新卡只进候选池，明日再参与挂牌；不顶掉今天的空位。
  if ((state.marketSold ?? []).length) return;
  const size = marketWindowSize(state);
  const window = (state.marketWindow ?? []).filter(item => item !== id);
  state.marketWindow = [id, ...window].slice(0, size);
}

export function factionStanding(state: GameState, faction: FactionId): number {
  return state.factions[faction]?.standing ?? 0;
}

export function marketUpgrade(state: GameState): { cost: number | null; size: number } {
  return { cost: marketUpgradeCost(state.marketLevel), size: marketSize(state.marketLevel) };
}

export function itemPrice(state: GameState, item: Equipment): number {
  const standing = factionStanding(state, item.faction);
  const rebate = state.inventory['permit'] ? 0.9 : 1;
  return Math.round(factionPrice(item, standing) * rebate);
}

/**
 * 换日清理：只把过期的原生候选清掉。
 *
 * v27 起市场不再自己造人——候选者的唯一来源是契约卡库（`refillMarket`），
 * 没有卡就空着，由界面提示玩家去加卡。这里保留过期逻辑，是为了让老档里
 * 还挂着的原生候选照常到期，不留下永远占位的旧面孔。
 */
export function refreshMarket(state: GameState): void {
  state.candidates = state.candidates.filter(g => g.custom || (g.candidateUntilDay ?? 0) > state.day);
  // 换日轮换：今天挂在窗口里的几位挪到队尾，明天换一批面孔；池子不够一天窗口就不用转。
  const size = marketWindowSize(state);
  if (state.marketDay < state.day && state.candidates.length > size) {
    const shift = size % state.candidates.length;
    state.candidates = [...state.candidates.slice(shift), ...state.candidates.slice(0, shift)];
  }
  state.marketDay = state.day;
  state.marketWindow = [];
  state.marketSold = [];
  normalizeMarketWindow(state, true);
}

/** 商店的阶级权重：市场等级越高，高阶级越常出现。 */

/** 商店的阶级权重：市场等级越高，高阶级越常出现。 */
export const STOCK_TIER_WEIGHT: Record<number, number[]> = {
  1: [55, 30, 12, 3, 0],
  2: [40, 32, 20, 7, 1],
  3: [28, 30, 24, 14, 4],
  4: [18, 26, 28, 20, 8],
  5: [10, 20, 30, 28, 12],
};

export interface StockOptions {
  /** 该势力当前声望：门槛不够的装备不摆出来。 */
  standing?: number;
  /** 市场等级：决定阶级权重。 */
  marketLevel?: number;
}

export function stockWeights(marketLevel: number): number[] {
  const level = Math.max(1, Math.min(5, Math.round(marketLevel)));
  return STOCK_TIER_WEIGHT[level] ?? STOCK_TIER_WEIGHT[5];
}

/** 不带保底的抽取：三件互不重复，按阶级加权。 */

/** 不带保底的抽取：三件互不重复，按阶级加权。 */
export function stockPicks(faction: FactionId, day: number, standing: number, marketLevel: number): Equipment[] {
  const pool = items.filter(item => item.faction === faction && item.standingReq <= standing);
  if (!pool.length) return [];
  const weights = stockWeights(marketLevel);
  const picked: Equipment[] = [];
  for (let index = 0; index < 3; index++) {
    // 先抽阶级，再从这一档里抽具体的一件；抽空了就往低阶退。
    for (let attempt = 0; attempt < 4; attempt++) {
      const roll = hashText(`${faction}:${day}:${index}:${attempt}`);
      const tiers: EquipmentTier[] = [1, 2, 3, 4, 5];
      const usable = tiers.filter(tier => weights[tier - 1] > 0 && pool.some(item => tierOf(item) === tier && !picked.includes(item)));
      if (!usable.length) break;
      const total = usable.reduce((sum, tier) => sum + weights[tier - 1], 0);
      let target = roll % total;
      let chosenTier: EquipmentTier = usable[usable.length - 1];
      for (const tier of usable) {
        if (target < weights[tier - 1]) { chosenTier = tier; break; }
        target -= weights[tier - 1];
      }
      const bag = pool.filter(item => tierOf(item) === chosenTier && !picked.includes(item));
      if (!bag.length) continue;
      picked.push(bag[hashText(`${faction}:${day}:${index}:${attempt}:item`) % bag.length]);
      break;
    }
  }
  return picked;
}

/** 连续五个商店日没出四阶以上时，今天第一件强制四阶。 */

/** 连续五个商店日没出四阶以上时，今天第一件强制四阶。 */
export function topTierStreakBroken(faction: FactionId, day: number, standing: number, marketLevel: number): boolean {
  if (day <= 5) return false;
  for (let back = 1; back <= 5; back++) {
    if (stockPicks(faction, day - back, standing, marketLevel).some(item => tierOf(item) >= 4)) return false;
  }
  return true;
}

export function makeFactionStock(faction: FactionId, day: number, options: StockOptions = {}): MarketStockEntry[] {
  const standing = options.standing ?? 100;
  const marketLevel = options.marketLevel ?? 1;
  const picked = stockPicks(faction, day, standing, marketLevel);
  if (!picked.length) return [];
  if (marketLevel >= 3 && topTierStreakBroken(faction, day, standing, marketLevel)) {
    const bag = items.filter(item => item.faction === faction && item.standingReq <= standing && tierOf(item) >= 4);
    if (bag.length) picked[0] = bag[hashText(`${faction}:${day}:top`) % bag.length];
  }
  return picked.map((item, index) => ({ id: `stock-${faction}-${day}-${index}`, itemId: item.id, faction, sold: false }));
}

export function makeMarketStock(day: number, options: StockOptions = {}): MarketStockEntry[] {
  return (Object.keys(factionInfo) as FactionId[]).flatMap(faction => makeFactionStock(faction, day, options));
}
