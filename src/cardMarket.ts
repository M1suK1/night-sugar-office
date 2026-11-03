/**
 * 市场补货：候选者只从契约卡库来。
 *
 * v27 起本地不再随机造候选、叙事者也不再生成候选者；市场缺人就按 `addedAt`
 * 从卡库里拿还没用过的卡补上，卡用完就空着，由界面提示玩家去加卡。
 * 这里全是纯函数，方便直接测；真正写入状态的是 `GameAction.refillMarket`。
 */
import type { CardBoxEntry } from './cardbox.ts';
import type { GameState } from './types.ts';
import { marketSize } from './economy.ts';

/** 已经被用掉的卡编号：名册、候选、编进三方的首领与随从都算。 */
export function usedCardIds(state: GameState): Set<string> {
  const used = new Set<string>();
  for (const girl of [...state.girls, ...state.candidates]) {
    if (girl.cardId) used.add(girl.cardId);
  }
  for (const leader of state.customFactionLeaders ?? []) {
    if (leader.cardId) used.add(leader.cardId);
  }
  for (const girl of state.customFactionGirls ?? []) {
    if (girl.cardId) used.add(girl.cardId);
  }
  return used;
}

/** 市场还缺几个位置。 */
export function marketCardGap(state: GameState): number {
  return Math.max(0, state.poolLimits.candidates - state.candidates.length);
}

/** 卡库里还没用过的卡，按最近导入优先。 */
export function unusedCards(box: CardBoxEntry[], state: GameState, limit = Number.POSITIVE_INFINITY): CardBoxEntry[] {
  const used = usedCardIds(state);
  return [...box]
    .filter(entry => !used.has(entry.hash))
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, Math.max(0, limit));
}

/**
 * 再按「卡面总量」截一刀：开局不该为了摆满选人池上限把几十 MB 立绘读进内存。
 *
 * 至少收一张（第一张哪怕超预算也要收，否则开局没人可选），之后超出预算就停，
 * 剩下的留在卡库等市场按缺口补货。
 */
export function pickWithinBytes(entries: CardBoxEntry[], limit: number, budget: number): CardBoxEntry[] {
  const picked: CardBoxEntry[] = [];
  let bytes = 0;
  for (const entry of entries) {
    if (picked.length >= limit) break;
    const size = Number.isFinite(entry.bytes) ? entry.bytes : 0;
    if (picked.length && bytes + size > budget) break;
    picked.push(entry);
    bytes += size;
  }
  return picked;
}

/** 卡库是不是已经完全用光（没有可补的卡）。 */export function cardBoxExhausted(box: CardBoxEntry[], state: GameState): boolean {
  return unusedCards(box, state, 1).length === 0;
}

/**
 * 该不该催玩家加卡：没有可补的卡，而且池子快撑不满今天的窗口了。
 * 只是「没补满」不算——20 张开局后池子里还有十几位，不该马上催。
 */
export function marketNeedsCards(state: GameState, box: CardBoxEntry[]): boolean {
  if (state.candidates.length > marketSize(state.marketLevel)) return false;
  return cardBoxExhausted(box, state);
}
