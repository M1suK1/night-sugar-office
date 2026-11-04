import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING_CARDS, OPENING_CARD_BYTES, OPENING_IMPORT_CARDS } from '../src/opening.ts';
import { CARD_FILE_BYTES_MAX } from '../src/fileLimits.ts';

test('v95 开局的选人池上限是 30 人', () => {
  assert.equal(OPENING_CARDS, 30);
  assert.ok(OPENING_CARD_BYTES > CARD_FILE_BYTES_MAX, '读卡预算跟着放宽，才能铺满 30 人');
});

test('v105 开局一次读满选人池，编成界面才看得全', () => {
  assert.equal(OPENING_IMPORT_CARDS, OPENING_CARDS, '开局读的卡数要等于池子上限');
  assert.equal(OPENING_IMPORT_CARDS, 30);
});
