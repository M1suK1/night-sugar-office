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
 * 把「模型写的 after」变成真正能用的落点（v100）。
 *
 * 实测模型经常只给第一句写 after（或者干脆写了个超出段数的值），
 * 照搬就会：第一句插对了，其余全被夹到末尾。所以这里做三件事：
 *  1. 按原始段数把 after 换算到当前块数，并保证不倒退；
 *  2. 没写 after 的那几句用均匀位置补齐；
 *  3. 若一半以上被挤到结尾（或全挤在最前面），说明这批 after 没有区分度，整批退回均匀铺开。
 */
export function placeLines(rawAfter: readonly (number | undefined)[], rawParagraphs: number, chunks: number): number[] {
  const count = rawAfter.length;
  if (count <= 0) return [];
  const spread = spreadAfter(count, chunks);
  const stated = rawAfter.filter(value => typeof value === 'number' && Number.isFinite(value)).length;
  if (stated === 0 || chunks <= 1) return spread;

  const span = Math.max(1, rawParagraphs);
  const placed = rawAfter.map((value, at) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return spread[at]!;
    const clamped = Math.max(0, Math.min(span, value));
    return Math.min(chunks, Math.round((clamped / span) * chunks));
  });

  const stuckAtEnd = placed.filter(position => position >= chunks).length;
  const stuckAtStart = placed.filter(position => position <= 0).length;
  if (count > 1 && (stuckAtEnd > count / 2 || stuckAtStart > count / 2)) return spread;
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
