import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { resolveMacros } from '../src/promptMacros.ts';
import { eventMemoryBlock } from '../src/llm.ts';
import type { CharacterEvent, GameState } from '../src/types.ts';

/** v252：{{history.events}} 把已收尾的剧情与会议摘要喂给预设。 */

const stateWithEvents = (): { state: GameState; girlId: string } => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const girl = state.girls[0]!;
  const make = (id: string, title: string, summary: string | undefined, extra: Partial<CharacterEvent> = {}): CharacterEvent => ({
    id, girlId: girl.id, title, hook: '', scenes: [], stage: 0, status: 'done',
    day: 3, source: 'llm', badge: false, summary, ...extra,
  } as CharacterEvent);
  state.events = [
    make('e1', '雨夜的门口', '她在雨里等了你两个小时，最后什么也没问。'),
    make('e2', '没有摘要的一场', undefined),
    make('e3', '旧教堂的约定', '她把戒指收进手套，说等下次再谈。'),
    make('e4', '别人的事', '和你无关的摘要。', { girlId: 'someone-else' }),
    ...state.events,
  ];
  return { state, girlId: girl.id };
};

test('v252 宏输出已收尾的事件摘要，带数量参数', () => {
  const { state, girlId } = stateWithEvents();
  const girl = state.girls.find(g => g.id === girlId)!;
  const all = resolveMacros('{{history.events}}', { state, focus: girl }).text;
  assert.match(all, /雨夜的门口：她在雨里等了你两个小时/);
  assert.match(all, /旧教堂的约定：她把戒指收进手套/);
  assert.equal(all.includes('没有摘要的一场'), false, '没有摘要的不算');
  assert.equal(all.includes('别人的事'), false, '不是她的事件不算');

  const one = resolveMacros('{{history.events:1}}', { state, focus: girl }).text;
  assert.equal(one.split('\n').filter(Boolean).length, 1);
});

test('v252 没有指定主角时给出提示而不是空字符串', () => {
  const { state } = stateWithEvents();
  assert.equal(resolveMacros('{{history.events}}', { state }).text, '（本任务没有指定主角）');
});

test('v252 正文里的【你们之前发生过的】在预设写了宏时不再重复', () => {
  const { state, girlId } = stateWithEvents();
  const plain = eventMemoryBlock(state, girlId);
  assert.match(plain, /^【你们之前发生过的】/);
  assert.match(plain, /雨夜的门口/);

  const withMacro = eventMemoryBlock(state, girlId, { entries: [{ content: '【她的过往】\n{{history.events}}' }] } as never);
  assert.equal(withMacro, '', '预设已经写了宏，正文就让位');
});

test('v252 一件都没有时正文不插入空段', () => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  for (const event of state.events) event.status = 'active';
  assert.equal(eventMemoryBlock(state, state.girls[0]!.id), '');
});
