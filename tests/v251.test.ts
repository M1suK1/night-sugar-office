import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import type { CharacterEvent, GameState, StoryTurn } from '../src/types.ts';

/** v251：思维链跟着剧情轮次存下来，回看时能在原文上方展开。 */

const sessionState = (): { state: GameState; event: CharacterEvent } => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const girl = state.girls[0]!;
  const event = {
    id: 'ev-1', girlId: girl.id, title: '雨夜的对峙', hook: '她在门口等你。', scenes: [],
    stage: 0, status: 'active', day: state.day, source: 'template', badge: true,
    mode: 'session', cast: [girl.id], opening: '', turns: [], sessionDone: false,
  } as CharacterEvent;
  state.events = [event, ...state.events];
  return { state, event };
};

test('v251 续写的思维链跟着这一轮存下来', () => {
  const { state, event } = sessionState();
  const turn: StoryTurn = {
    id: 'turn-n-1', role: 'narrator', text: '她把伞收了起来。', summary: '她把伞收起来。',
    lines: [], options: [], reasoning: '先想她为什么不肯进来。', at: 1,
  };
  const result = act(state, { type: 'appendStoryTurn', eventId: event.id, turn });
  assert.equal(result.ok, true, result.message);
  const saved = result.state.events.find(item => item.id === event.id)!.turns![0]!;
  assert.equal(saved.reasoning, '先想她为什么不肯进来。');
});

test('v251 开场白的思维链落在第一轮叙述上', () => {
  const { state, event } = sessionState();
  const result = act(state, {
    type: 'startStorySession', eventId: event.id, cast: [event.girlId],
    opening: '门开了一条缝。', lines: [], options: [], seed: '', reasoning: '先立一个不肯进门的理由。',
  });
  assert.equal(result.ok, true, result.message);
  const turns = result.state.events.find(item => item.id === event.id)!.turns!;
  assert.equal(turns.at(-1)!.role, 'narrator');
  assert.equal(turns.at(-1)!.reasoning, '先立一个不肯进门的理由。');
});

test('v251 重写替换后思维链跟着新的一版', () => {
  const { state, event } = sessionState();
  const first = act(state, {
    type: 'startStorySession', eventId: event.id, cast: [event.girlId],
    opening: '门开了一条缝。', lines: [], options: [], seed: '', reasoning: '旧的想法',
  });
  const turnId = first.state.events.find(item => item.id === event.id)!.turns!.at(-1)!.id;
  const replaced = act(first.state, {
    type: 'replaceStoryTurn', eventId: event.id, turnId,
    turn: { id: turnId, role: 'narrator', text: '门关着。', summary: '门关着。', lines: [], options: [], at: 2, reasoning: '换个写法' } as StoryTurn,
  });
  assert.equal(replaced.ok, true, replaced.message);
  assert.equal(replaced.state.events.find(item => item.id === event.id)!.turns!.at(-1)!.reasoning, '换个写法');
});

test('v251 旧档没有思维链照常读，字段缺省为 undefined', () => {
  const { state, event } = sessionState();
  const result = act(state, {
    type: 'startStorySession', eventId: event.id, cast: [event.girlId],
    opening: '门开了一条缝。', lines: [], options: [], seed: '',
  });
  assert.equal(result.ok, true, result.message);
  const turns = result.state.events.find(item => item.id === event.id)!.turns!;
  assert.equal(turns.at(-1)!.reasoning, undefined);
});
