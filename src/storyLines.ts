/**
 * 把一轮剧情的旁白与台词交织成一条时间线。
 *
 * 模型写的台词以前全部堆在正文之后，读起来像「先读完一篇小说，再看几句对白」。
 * 现在每句台词可以带 `after`（插在第几段旁白之后）；没写或不合理就均匀铺开，
 * 至少不会整段塌在结尾。
 */
export interface StorySegment {
  kind: 'narration' | 'line';
  /** 旁白段落下标 / 台词下标，渲染时当 key 用。 */
  index: number;
}

/** 均匀铺开：k 句台词分到 P 段旁白的 P+1 个空档里。 */
export function spreadAfter(count: number, paragraphs: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, index) => Math.min(paragraphs, Math.round((index + 1) * paragraphs / (count + 1))));
}

/** 只要知道「插在第几段之后」就行，旁白/台词的其余字段与这里无关。 */
export interface Placeable {
  after?: number;
}

/**
 * 把「模型写的 after」变成真正能用的落点（v100 / v110 修正）。
 *
 * 规则：
 *  1. 写了 after 就照它放，换算到当前块数，越界的夹到两端；
 *  2. 没写 after 的那几句用均匀位置补齐；
 *  3. 只有当**每一句都声称自己在最末尾**（而旁白不止一段）时才整批退回均匀铺开——
 *     那是「模型偷懒全写 after=99」的情况。
 *
 * v110 修正：以前只要一半以上落在末尾就整批退回均匀铺开，
 * 结果 after=0 的台词被从开头拽到中间、after=1/2 的也失去了本来该在的位置。
 */
export function placeLines(rawAfter: readonly (number | undefined)[], rawParagraphs: number, chunks: number): number[] {
  const count = rawAfter.length;
  if (count <= 0) return [];
  const spread = spreadAfter(count, chunks);
  const span = Math.max(1, rawParagraphs);
  const stated = rawAfter.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!stated.length) return spread;

  const placed = rawAfter.map((value, at) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return spread[at]!;
    const clamped = Math.max(0, Math.min(span, value));
    return Math.min(chunks, Math.round((clamped / span) * chunks));
  });

  // 所有台词都说自己要在最后（多半是随手写了很大的数）：均匀铺开更好读。
  const allClaimEnd = stated.length === count && stated.every(value => Math.max(0, Math.min(span, Number(value))) >= span);
  if (allClaimEnd && count > 1 && chunks > 1) return spread;
  return placed;
}

/** 按「每句台词插在第几个空档」拼出交织时间线。 */
export function segmentsFromPositions(paragraphs: number, positions: readonly number[]): StorySegment[] {
  const buckets = new Map<number, number[]>();
  positions.forEach((position, index) => {
    const at = Math.max(0, Math.min(paragraphs, Math.round(position)));
    const list = buckets.get(at) ?? [];
    list.push(index);
    buckets.set(at, list);
  });
  const segments: StorySegment[] = [];
  for (let at = 0; at <= paragraphs; at += 1) {
    for (const index of buckets.get(at) ?? []) segments.push({ kind: 'line', index });
    if (at < paragraphs) segments.push({ kind: 'narration', index: at });
  }
  return segments;
}

export function interleaveTurn(paragraphs: string[], lines: readonly Placeable[]): StorySegment[] {
  const total = paragraphs.length;
  const positions = placeLines(lines.map(line => line.after), Math.max(1, total), total);
  return segmentsFromPositions(total, positions);
}
