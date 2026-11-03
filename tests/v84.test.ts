import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { finishedSessionEvents } from '../src/rules/storyEvent.ts';
import type { CharacterEvent, GameState } from '../src/types.ts';

function event(id: string, day: number, patch: Partial<CharacterEvent> = {}): CharacterEvent {
  return {
    id, girlId: 'g1', title: id, hook: '', scenes: [], stage: 0, status: 'active',
    day, source: 'llm', badge: true, mode: 'session', turns: [], ...patch,
  } as unknown as CharacterEvent;
}

function withEvents(...list: CharacterEvent[]): GameState {
  return { ...createInitialState(), events: list };
}

test('v84 回忆只收演完的会话，按日期倒序', () => {
  const state = withEvents(
    event('old', 12, { status: 'done' }),
    event('live', 15),
    event('new', 18, { status: 'done' }),
    event('legacy', 14, { sessionDone: true }),
    event('other-girl', 19, { status: 'done', girlId: 'g2' }),
  );
  const list = finishedSessionEvents(state, 'g1').map(item => item.id);
  assert.deepEqual(list, ['new', 'legacy', 'old'], '倒序、只收这位少女、结束的才算');
});

test('v84 没有演完的剧情时回忆是空列表', () => {
  const state = withEvents(event('live', 15));
  assert.deepEqual(finishedSessionEvents(state, 'g1'), []);
});
