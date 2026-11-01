/**
 * 市场补货：候选者只从契约卡库来。
 *
 * v27 起本地不再随机造候选、叙事者也不再生成候选者；市场缺人就按 `addedAt`
 * 从卡库里拿还没用过的卡补上，卡用完就空着，由界面提示玩家去加卡。
 * 这里全是纯函数，方便直接测；真正写入状态的是 `GameAction.refillMarket`。
 */
import type { CardBoxEntry } from './cardbox.ts';
import type { GameState } from './types.ts';

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

/** 卡库是不是已经完全用光（没有可补的卡）。 */
export function cardBoxExhausted(box: CardBoxEntry[], state: GameState): boolean {
  return unusedCards(box, state, 1).length === 0;
}

/**
 * 该不该催玩家加卡：没有可补的卡，而且市场真的快没人了（候选 ≤ 2）。
 * 只是「没补满」不算——20 张开局后市场还有十几位，不该马上催。
 */
export function marketNeedsCards(state: GameState, box: CardBoxEntry[]): boolean {
  if (state.candidates.length > 2) return false;
  return cardBoxExhausted(box, state);
}
