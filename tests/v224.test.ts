import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { addEvent } from '../src/rules/storyCore.ts';
import { openingContext } from '../src/llm.ts';

const blockOf = (context: string) => context.split('【在场的人】')[1]?.split('【你】')[0] ?? '';

test('v224 在场的人不再重复主角档案', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const other = state.girls[1]!;
  const event = addEvent(state, girl, '雨里的访客', '她在门口停下。', 'test');
  event.cast = [girl.id, other.id];
  const block = blockOf(openingContext(state, event));
  assert.ok(block.includes(other.name), '其他在场者要保留');
  assert.ok(!block.includes(`${girl.name}（${girl.id}）`), '主角档案不该再出现');
  assert.ok(block.includes('主角的资料见【她是谁】'));
});

test('v224 只有主角时，在场的人只留一句指引', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const event = addEvent(state, girl, '一个人的夜', '她坐在窗边。', 'test');
  event.cast = [girl.id];
  const block = blockOf(openingContext(state, event));
  assert.ok(block.includes('只有她和你'));
  assert.ok(!block.includes(`${girl.name}（${girl.id}）`));
});
