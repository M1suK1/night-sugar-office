import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { focusGirlOf } from '../src/storyFocus.ts';
import { resolveMacros } from '../src/promptMacros.ts';

const event = (overrides: Record<string, unknown>) => ({ id: 'e1', girlId: '', cast: [], title: '午夜人工转换', hook: '', scenes: [], turns: [], stage: 0, ...overrides }) as never;

test('v73 焦点角色优先取事件的主人', () => {
  const state = createInitialState();
  const owner = state.girls[1]!;
  assert.equal(focusGirlOf(state, event({ girlId: owner.id, cast: [state.girls[0]!.id] }))?.id, owner.id);
});

test('v73 没有主人时退到 cast 第一位，再退到名册里第一个能出勤的人', () => {
  const state = createInitialState();
  const casted = state.girls[2]!;
  assert.equal(focusGirlOf(state, event({ cast: [casted.id, state.girls[3]!.id] }))?.id, casted.id);
  const fallback = focusGirlOf(state, event({ cast: ['player'] }));
  assert.ok(fallback, '至少要给出一个人');
  assert.equal(typeof fallback!.id, 'string');
  assert.ok(state.girls.some(girl => girl.id === fallback!.id), '兜底的人来自名册');
});

test('v73 带着 focus 时「她是谁」会渲染真名，缺了才是「没有指定主角」', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const withFocus = resolveMacros('{{heroine}}', { state, focus: girl }).text;
  assert.match(withFocus, new RegExp(girl.name));
  assert.doesNotMatch(withFocus, /没有指定主角/);
  const without = resolveMacros('{{heroine}}', { state }).text;
  assert.match(without, /没有指定主角/, '这才是你截图里看到的文案');
});
