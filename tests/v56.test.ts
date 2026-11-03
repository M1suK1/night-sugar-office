import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';
import { CARD_BOX_MAX_BYTES } from '../src/cardbox.ts';
import { OPENING_CARD_BYTES } from '../src/opening.ts';
import { SLOT_BYTES_LIMIT } from '../src/saves.ts';
import { CARD_FILE_BYTES_MAX, SAVE_FILE_BYTES_MAX, cardFileGuard, formatBytes, saveFileGuard } from '../src/fileLimits.ts';

/**
 * 造一张十兆级的 PNG 卡：`data/cards/` 里现成的几张是 10–22MB，
 * 体积来自「立绘 + 魔女化 + 衣柜 + 一堆表情差分」而不是单张巨图（单图另有 2.8MB 上限）。
 */
function pngCard(copies: number): string {
  const state = createInitialState();
  const card = buildGirlCard(state.girls[0]!, { day: state.day });
  const png = `data:image/png;base64,${'A'.repeat(1_100_000)}`;
  card.girl.portrait = png;
  card.girl.importedVariants = Object.fromEntries(
    Array.from({ length: copies }, (_, index) => [`custom:slot${index}:calm`, png]),
  );
  return JSON.stringify(card, null, 2);
}

test('v56 十兆级的 PNG 契约卡不再被 8MB 拦住', () => {
  const text = pngCard(8);
  assert.ok(text.length > 8_000_000, '这份卡确实超过了旧闸口的 8MB');
  assert.equal(cardFileGuard(text.length).ok, true, '十兆的卡是正常体积');
  const parsed = parseGirlCard(text);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
});

test('v56 只有明显不是卡的文件才拦，并报出两边体积', () => {
  const tooBig = cardFileGuard(25 * 1024 * 1024);
  assert.equal(tooBig.ok, false);
  assert.match(tooBig.message ?? '', /25\.0MB/);
  assert.match(tooBig.message ?? '', /24\.0MB/);
  assert.equal(cardFileGuard(CARD_FILE_BYTES_MAX).ok, true, '正好等于上限仍然可以导入');
  assert.equal(formatBytes(12.4 * 1024 * 1024), '12.4MB');
});

test('v56 存档闸口跟着存档位走，不再卡在 6MB', () => {
  assert.equal(saveFileGuard(7_000_000).ok, true);
  assert.equal(saveFileGuard(SAVE_FILE_BYTES_MAX).ok, true);
  assert.equal(saveFileGuard(SAVE_FILE_BYTES_MAX + 1).ok, false);
});

test('v56 三个上限同源：卡库、开局选人池、导入闸口', () => {
  assert.equal(CARD_BOX_MAX_BYTES, CARD_FILE_BYTES_MAX);
  // v95：开局选人池放到 30 人，读卡预算必须比「单张卡上限」宽，
  // 否则铺不满池子（其余的人靠市场按缺口逐日补）。其它两个上限仍与单卡上限同源。
  assert.ok(OPENING_CARD_BYTES >= CARD_FILE_BYTES_MAX, '开局读卡预算不小于单卡上限');
  assert.equal(OPENING_CARD_BYTES, CARD_FILE_BYTES_MAX * 2);
  assert.equal(SAVE_FILE_BYTES_MAX, SLOT_BYTES_LIMIT);
});
