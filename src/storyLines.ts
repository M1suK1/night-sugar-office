/**
 * 把一轮剧情的旁白与台词交织成一条时间线。
 *
 * 模型写的台词以前全部堆在正文之后，读起来像「先读完一篇小说，再看几句对白」。
 * 现在每句台词可以带 \`after\`（插在第几段旁白之后）；没写就按位置均匀铺开，
 * 至少不会整段塌在结尾。
 */
import type { StoryLine } from './types.ts';

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

export function interleaveTurn(paragraphs: string[], lines: StoryLine[]): StorySegment[] {
  const total = paragraphs.length;
  const explicit = lines.some(line => typeof line.after === 'number');
  const positions = explicit
    ? lines.map(line => Math.max(0, Math.min(total, typeof line.after === 'number' ? Math.round(line.after) : total)))
    : spreadAfter(lines.length, total);
  const buckets = new Map<number, number[]>();
  positions.forEach((position, index) => {
    const list = buckets.get(position) ?? [];
    list.push(index);
    buckets.set(position, list);
  });
  const segments: StorySegment[] = [];
  for (let at = 0; at <= total; at += 1) {
    for (const index of buckets.get(at) ?? []) segments.push({ kind: 'line', index });
    if (at < total) segments.push({ kind: 'narration', index: at });
  }
  return segments;
}
