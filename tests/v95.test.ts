import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING_CARDS, OPENING_CARD_BYTES, OPENING_IMPORT_CARDS } from '../src/opening.ts';
import { CARD_FILE_BYTES_MAX } from '../src/fileLimits.ts';

test('v95 开局的选人池上限是 30 人', () => {
  assert.equal(OPENING_CARDS, 30);
  assert.ok(OPENING_CARD_BYTES > CARD_FILE_BYTES_MAX, '读卡预算跟着放宽，才能铺满 30 人');
});

test('v101 开局只读 9 张，剩下的从卡库按需导入', () => {
  assert.equal(OPENING_IMPORT_CARDS, 9);
  assert.ok(OPENING_IMPORT_CARDS < OPENING_CARDS, '开局读的张数要小于池子上限，否则「按需导入」没意义');
});
