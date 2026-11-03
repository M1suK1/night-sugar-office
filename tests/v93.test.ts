import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { shouldAutoGenerate } from '../src/autoGenerate.ts';

test('v93 序章看完 + 编成定下才补提案，首夜也不再等一天', () => {
  const fresh = createInitialState();
  const ready = { ...fresh, prologueSeen: true, startersPicked: true, generatedDay: 13 };
  assert.equal(ready.day, 14);
  assert.equal(shouldAutoGenerate(ready, true), true, '第 14 夜就允许补，不再硬性等到 15');
});

test('v93 初始化没结束就不生成：序章未看、编成未定都算', () => {
  assert.equal(shouldAutoGenerate({ day: 20, generatedDay: 19, prologueSeen: false, startersPicked: true }, true), false);
  assert.equal(shouldAutoGenerate({ day: 20, generatedDay: 19, prologueSeen: true, startersPicked: false }, true), false);
  assert.equal(shouldAutoGenerate({ day: 20, generatedDay: 19, prologueSeen: true, blank: true }, true), true, '空白档没有编成这一步，直接放行');
  assert.equal(shouldAutoGenerate({ day: 20, generatedDay: 20, prologueSeen: true, startersPicked: true }, true), false, '同一天补过就不再补');
});
