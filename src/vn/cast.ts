/**
 * 舞台站位顺序（v99）。
 *
 * 多人同场时：先到的人站左边，后来的人从右侧进场；已经站好的人不会因为
 * 谁开口就换位置（否则每句台词都在洗牌，看着很吵）。
 * 离场的人直接从队列里去掉，不影响其他人的相对顺序。
 */
export function mergeCastOrder(order: readonly string[], castIds: readonly string[], speakingId = ''): readonly string[] {
  const next = order.filter(id => castIds.includes(id));
  for (const id of castIds) if (!next.includes(id)) next.push(id);
  if (speakingId && !next.includes(speakingId)) next.push(speakingId);
  const same = next.length === order.length && next.every((id, at) => id === order[at]);
  // 没变化就把原数组还回去，React 才知道不用重渲染。
  return same ? order : next;
}
