import test from 'node:test';
import assert from 'node:assert/strict';
import { pensionArrears, pensionFor } from '../src/contracts.ts';
import type { Girl } from '../src/types.ts';

const girl = (level: number, pensionMissed = 0) => ({ level, pensionMissed } as Girl);

test('v185 退休金整体下调到原来的一半', () => {
  // 原公式：round(240 + 等级 × 160)
  assert.equal(pensionFor(girl(1)), 200);
  assert.equal(pensionFor(girl(5)), 520);
  assert.equal(pensionFor(girl(10)), 920);
});

test('v185 欠缴按新标准累计', () => {
  assert.equal(pensionArrears(girl(5, 3)), 1560);
  assert.equal(pensionArrears(girl(5, 0)), 0);
});
