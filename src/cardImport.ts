/**
 * 契约卡的分批读取。
 *
 * 一张带 1024 立绘的卡约 2–3MB。一次性把 20 张读进内存、解析成 `Girl`、再写进 state，
 * 峰值会落在「原文 + 解析结果 + state 快照」三份上，低配机器直接 OOM。
 *
 * 这里只负责把要读的卡切成批次：既限张数也限字节——小卡一批能多读几张，
 * 大卡一批只读一两张。真正逐批取原文的是 `cardboxCards`，逐批写进 state 的是调用方
 * （`App` 的开局与卡库导入），这样每批解析完就能被回收。
 */
import type { CardBoxEntry } from './cardbox.ts';

/** 一批最多几张卡。 */
export const CARD_BATCH_MAX = 6;
/** 一批最多读多少字节的卡面原文（约等于 4 张大立绘卡）。 */
export const CARD_BATCH_BYTES = 4 * 1024 * 1024;

/** 按「张数 + 字节」切批；第一批哪怕超预算也会带上一张，避免死循环。 */
export function planCardBatches(
  entries: CardBoxEntry[],
  maxCards = CARD_BATCH_MAX,
  maxBytes = CARD_BATCH_BYTES,
): CardBoxEntry[][] {
  const cardLimit = Math.max(1, Math.floor(maxCards));
  const byteLimit = Math.max(0, maxBytes);
  const batches: CardBoxEntry[][] = [];
  let current: CardBoxEntry[] = [];
  let bytes = 0;
  for (const entry of entries) {
    const size = Number.isFinite(entry.bytes) ? entry.bytes : 0;
    if (current.length && (current.length >= cardLimit || bytes + size > byteLimit)) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(entry);
    bytes += size;
  }
  if (current.length) batches.push(current);
  return batches;
}
