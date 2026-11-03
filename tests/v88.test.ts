import test from 'node:test';
import assert from 'node:assert/strict';
import { autoOpinionRoll } from '../src/rules/battle.ts';

test('v88 击退不再生成默认议题', () => {
  for (const day of [14, 15, 16, 20, 33]) {
    assert.equal(autoOpinionRoll('repelled', 'g1', 'm1', day), false, '无论掷到什么都不要');
  }
  assert.equal(autoOpinionRoll('victory', 'g1', 'm1', 14), false, '胜利本来就走另一支');
});

test('v88 失败与僵持仍然可能递议题，而且同一天结果固定', () => {
  let hits = 0;
  for (let day = 1; day <= 200; day += 1) {
    const first = autoOpinionRoll('defeat', 'g1', 'm1', day);
    assert.equal(autoOpinionRoll('defeat', 'g1', 'm1', day), first, '同一存档同一天不重掷');
    if (first) hits += 1;
  }
  assert.ok(hits > 20 && hits < 90, `28% 的掷点大致命中，实际 ${hits}/200`);
});
