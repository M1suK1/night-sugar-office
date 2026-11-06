/**
 * 原文模式的三格轮转（v152）。
 *
 * 单侧三人时站位是 A（前排左）/ B（前排右）/ C（后排）。
 * 悬停后排 C 的台词，三人整体轮转一格：
 *   A → C（退到后排）、B → A、C → B（走到前排）。
 * 悬停前排的人不动；其余人数维持原顺序。
 *
 * 纯函数：组件只保存 rotate 的次数或当前顺序，这里不碰 DOM。
 */
export function rotateSide(order: readonly string[], hoveredId: string): readonly string[] {
  if (order.length !== 3) return order;
  if (!hoveredId || !order.includes(hoveredId)) return order;
  // 只有后排（第三格）的人开口/被悬停时才轮转。
  if (order[2] !== hoveredId) return order;
  return [order[1]!, order[2]!, order[0]!];
}
