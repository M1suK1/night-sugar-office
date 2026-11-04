/**
 * 交互剧情的滚动位置：新的一轮出现时停在它的开头，而不是滚到结尾。
 *
 * 以前是 `scrollTo({ top: scrollHeight })`：模型一回来画面就跳到最后一字，
 * 等于先把结局摊在眼前。这里把它算成一个纯函数，方便测。
 */
export function scrollTopForNewTurn(input: {
  /** 这一轮的 id。 */
  turnId: string;
  /** 上一次已经定位过的轮次 id。 */
  lastScrolledId: string;
  /** 滚动容器的顶部在视口里的位置。 */
  boxTop: number;
  /** 这一轮节点的顶部在视口里的位置。 */
  nodeTop: number;
  /** 容器当前滚到哪。 */
  scrollTop: number;
  /** 开头留一点余白，别把第一行贴着上边框。 */
  margin?: number;
}): number | null {
  if (!input.turnId || input.turnId === input.lastScrolledId) return null;
  const margin = input.margin ?? 12;
  const target = input.scrollTop + (input.nodeTop - input.boxTop) - margin;
  return Math.max(0, Math.round(target));
}
