import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { shouldAutoGenerate } from '../src/autoGenerate.ts';

test('v76 载入存档不再触发一次生成：日号没变就不补', () => {
  const state = createInitialState();
  assert.equal(state.generatedDay, state.day, '新档把开局日记成「已补过」');
  assert.equal(shouldAutoGenerate(state, true), false, '首帧不该发请求');
  assert.equal(shouldAutoGenerate({ day: 20, generatedDay: 20 }, true), false, '读档同理');
});

test('v76 真的换日才补，而且补过就不会重放', () => {
  assert.equal(shouldAutoGenerate({ day: 21, generatedDay: 20 }, true), true);
  assert.equal(shouldAutoGenerate({ day: 21, generatedDay: 21 }, true), false, '补过之后不再触发');
  assert.equal(shouldAutoGenerate({ day: 21, generatedDay: 20 }, false), false, '开关关掉就不补');
  assert.equal(shouldAutoGenerate({ day: 21 }, true), false, '缺字段时按「就是今天」处理，避免读档补发');
});
