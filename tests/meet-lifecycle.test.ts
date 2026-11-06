import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import type { GameState } from '../src/types.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { applyMeetLeader, buildMeetEvent, meetEventId } from '../src/rules/summon.ts';

function person(id: string, name: string, factionTag: 'association' | 'government' | 'witch', level: number) {
  return subjectOfCustom({
    id, name, factionTag, level, color: '#8a7bd6', portrait: '',
    stats: { magic: 60, insight: 60, agility: 60, empathy: 60 }, skillIds: [],
    title: '测试', codename: name, quote: '站住。',
  });
}

function stateWithLeader(): GameState {
  const base = createInitialState();
  return {
    ...base,
    customFactionLeaders: [customLeaderOf('witch', person('L1', '青灯', 'witch', 10))],
    customFactionGirls: [customGirlOf('witch', person('M1', '纸鸢', 'witch', 8))],
    factionRoster: { ...base.factionRoster!, witch: { leaderId: 'L1', memberIds: ['M1'] } },
  };
}

test('v168 约谈：建好之后一直是「进行中」，退出对话框不会把它算作已约见', () => {
  const state = stateWithLeader();
  const result = applyMeetLeader(state, { type: 'meetLeader', faction: 'witch' });
  assert.equal(result.ok, true, result.message);
  const event = result.state.events.find(item => item.id === meetEventId(result.state, 'witch'))!;
  assert.equal(event.status, 'active', '退出只是离开，事件要还开着');
  assert.equal(event.sessionDone, undefined);
  assert.equal(event.mode, 'session');
});

test('v168 约谈：只有结束事件才收尾，收尾之后仍然留在存档里可以回看', () => {
  const state = stateWithLeader();
  const started = applyMeetLeader(state, { type: 'meetLeader', faction: 'witch' }).state;
  const id = meetEventId(started, 'witch');
  // 谈了两轮
  let next = act(started, { type: 'appendStoryTurn', eventId: id, turn: { id: 'p1', role: 'player', text: '我把帖子递过去。', lines: [], at: 1 } }).state;
  next = act(next, { type: 'appendStoryTurn', eventId: id, turn: { id: 'n1', role: 'narrator', text: '她把帖子按在灯下看。', lines: [], at: 2 } }).state;
  assert.equal(next.events.find(item => item.id === id)!.status, 'active', '谈完两轮也还没结束');

  const finished = act(next, { type: 'finishStorySession', eventId: id, summary: '见了一面，她答应明晚给答复。' });
  assert.equal(finished.ok, true, finished.message);
  const event = finished.state.events.find(item => item.id === id)!;
  assert.equal(event.status, 'done');
  assert.equal(event.sessionDone, true);
  assert.equal((event.turns ?? []).length, 2, '对话原文要留着给回看');
  assert.ok(event.summary?.length, '收尾要有摘要');
});

test('v168 约谈：同一天不会开出第二段，重复点只是回到原来那段', () => {
  const state = stateWithLeader();
  const first = applyMeetLeader(state, { type: 'meetLeader', faction: 'witch' }).state;
  const again = applyMeetLeader(first, { type: 'meetLeader', faction: 'witch' });
  assert.equal(again.ok, true);
  assert.equal(again.state.events.filter(item => item.id === meetEventId(state, 'witch')).length, 1);
  assert.equal(
    buildMeetEvent(state, 'witch', '青灯', 'L1').id,
    meetEventId(state, 'witch'),
    '事件 id 固定，界面才能按它回看',
  );
});
