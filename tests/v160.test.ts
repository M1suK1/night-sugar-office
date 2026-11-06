import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { buildSummonEvent, maybeSummon, meetEventId } from '../src/rules/summon.ts';
import type { GameState } from '../src/types.ts';

function withLeader(faction: 'association' | 'government' | 'witch' = 'association'): GameState {
  const state = createInitialState();
  const leader = customLeaderOf(faction, subjectOfCustom({
    id: 'leader-test', name: '测试首领', factionTag: faction, level: 1, color: '#fff',
    portrait: '', stats: { magic: 60, insight: 60, agility: 60, empathy: 60 }, skillIds: [],
  }));
  return {
    ...state,
    customFactionLeaders: [leader],
    factionRoster: { ...state.factionRoster, [faction]: { leaderId: leader.id, memberIds: ['member-1'] } },
  };
}

test('v160 召见用当前编成的首领，而不是静态空席', () => {
  const state = withLeader('association');
  const event = buildSummonEvent(state, 'association');
  assert.ok(event);
  assert.equal(event!.girlId, 'leader-test');
  assert.deepEqual(event!.cast, ['leader-test']);
  assert.ok(event!.title.includes('测试首领'));
  assert.ok(event!.hook.includes('测试首领'));
  assert.equal(event!.badge, true);
  assert.equal(event!.mode, 'session');
});

test('v160 空席不会触发召见', () => {
  const state = createInitialState();
  assert.equal(buildSummonEvent(state, 'government'), undefined);
  assert.equal(maybeSummon(state), undefined);
});

test('v160 主动约见：一天一方只建一次事件，可以直接打开', () => {
  const state = withLeader('witch');
  const first = act(state, { type: 'meetLeader', faction: 'witch' });
  assert.equal(first.ok, true, first.message);
  const id = meetEventId(state, 'witch');
  const event = first.state.events.find(entry => entry.id === id);
  assert.ok(event, '约见事件已写入');
  assert.equal(event!.girlId, 'leader-test');
  assert.deepEqual(event!.cast, ['leader-test']);
  assert.equal(event!.day, state.day);
  const second = act(first.state, { type: 'meetLeader', faction: 'witch' });
  assert.equal(second.ok, true);
  assert.equal(second.state.events.filter(entry => entry.id === id).length, 1, '同一天不重复建');
});

test('v160 空席时主动约见会被拒绝', () => {
  const state = createInitialState();
  const result = act(state, { type: 'meetLeader', faction: 'association' });
  assert.equal(result.ok, false);
  assert.match(result.message, /还没有首领/);
});
