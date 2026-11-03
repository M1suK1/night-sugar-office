import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGeneratedDay, shouldAutoGenerate } from '../src/autoGenerate.ts';

test('v89 旧档没有 generatedDay 时记成今天：读档不生成，换日照常触发', () => {
  assert.equal(normalizeGeneratedDay(14, undefined), 14, '缺字段 → 今天');
  assert.equal(normalizeGeneratedDay(14, 'x'), 14, '脏数据也按今天');
  const loaded = { day: 14, generatedDay: normalizeGeneratedDay(14, undefined) };
  assert.equal(shouldAutoGenerate(loaded, true), false, '刚读档不该立刻补一次');
  const nextNight = { ...loaded, day: 15 };
  assert.equal(shouldAutoGenerate(nextNight, true), true, '第二天 20:00 应该补');
});

test('v89 已有的日号不会被改到未来，也不会被清成 0', () => {
  assert.equal(normalizeGeneratedDay(20, 18), 18, '落后就保留，等着后面补');
  assert.equal(normalizeGeneratedDay(20, 25), 20, '超前（时钟乱跳）就压回今天，避免永远不生成');
  assert.equal(normalizeGeneratedDay(20, 0), 1, '至少是 1');
  assert.equal(shouldAutoGenerate({ day: 20, generatedDay: normalizeGeneratedDay(20, 25) }, true), false);
});
