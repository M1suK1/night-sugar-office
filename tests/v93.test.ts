import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { shouldAutoGenerate } from '../src/autoGenerate.ts';

test('v93 开局那一夜不自动补提案：首夜由本地内容摆桌，不能照着默认名册起草', () => {
  const fresh = createInitialState();
  const opened = { ...fresh, prologueSeen: true, generatedDay: 13 };
  assert.equal(opened.day, 14);
  assert.equal(shouldAutoGenerate(opened, true, 14), false, '第 14 夜不补');
  assert.equal(shouldAutoGenerate({ ...opened, day: 15 }, true, 14), true, '第 15 夜开始照常');
});

test('v93 序章没看完就不生成：初始化途中不许让叙事者写提案', () => {
  const state = { day: 20, generatedDay: 19, prologueSeen: false };
  assert.equal(shouldAutoGenerate(state, true, 14), false, '序章未看＝还在初始化');
  assert.equal(shouldAutoGenerate({ ...state, prologueSeen: true }, true, 14), true);
});
