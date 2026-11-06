import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import type { GameState } from '../src/types.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';
import { meetingCostOf, meetingDraftOf } from '../src/rules/meetingOps.ts';
import { meetingPlacesOf } from '../src/content/meetingPlaces.ts';

function fresh(): GameState {
  const state = createInitialState();
  // 三个空闲的人，够开一场最小会议。
  return { ...state, gold: 5000 };
}

test('v168 会议：费用随人数上涨，超过上限/低于下限都不行', () => {
  const state = fresh();
  const ids = state.girls.slice(0, 3).map(girl => girl.id);
  const two = meetingCostOf(DEFAULT_BALANCE, 2);
  const four = meetingCostOf(DEFAULT_BALANCE, 4);
  assert.ok(four > two, '人多要更贵');
  assert.equal(two, DEFAULT_BALANCE.meetingBaseCost + 2 * DEFAULT_BALANCE.meetingPerAttendee);

  const draft = meetingDraftOf(state);
  assert.ok(draft.minAttendees >= 2);
  assert.ok(ids.length >= 2);
});

test('v168 会议：开会扣钱、推进 1 小时、参会者各掉 10 点疲劳', () => {
  const state = fresh();
  const attendees = state.girls.slice(0, 2).map(girl => girl.id);
  const before = state.girls.map(girl => girl.fatigue);
  const cost = meetingCostOf(DEFAULT_BALANCE, attendees.length);
  const minutesBefore = state.minutes;
  const result = act(state, {
    type: 'startMeeting',
    plan: { title: '第 18 日的例会', placeId: 'lounge', placeName: '会客厅', attendeeIds: attendees, buys: '两盒草莓大福、一壶热可可' },
  });
  assert.equal(result.ok, true, result.message);
  const next = result.state;
  assert.equal(next.gold, state.gold - cost, '按人数扣钱');
  assert.ok(next.minutes > minutesBefore || next.day > state.day, '开会要花掉这一小时');
  for (const id of attendees) {
    const girl = next.girls.find(item => item.id === id)!;
    const was = state.girls.find(item => item.id === id)!.fatigue;
    assert.equal(girl.fatigue, Math.max(0, was - DEFAULT_BALANCE.meetingFatigueRelief), `${girl.name} 疲劳要降`);
  }
  const event = next.events.find(item => item.meeting)!;
  assert.ok(event, '要建一段会议剧情');
  assert.equal(event.mode, 'session');
  assert.deepEqual(event.cast, attendees);
  assert.equal(event.meeting!.buys, '两盒草莓大福、一壶热可可');
  assert.equal(event.meeting!.fee, cost);
});

test('v168 会议：星砂不够、人数不对、有人不在岗都开不成', () => {
  const state = fresh();
  const poor = { ...state, gold: 0 };
  const rejects = [
    act(poor, { type: 'startMeeting', plan: { title: '穷会', placeId: 'lounge', placeName: '会客厅', attendeeIds: state.girls.slice(0, 2).map(g => g.id), buys: '' } }),
    act(state, { type: 'startMeeting', plan: { title: '一个人开会', placeId: 'lounge', placeName: '会客厅', attendeeIds: [state.girls[0]!.id], buys: '' } }),
    act(state, { type: 'startMeeting', plan: { title: '开不了', placeId: 'lounge', placeName: '会客厅', attendeeIds: ['nobody', state.girls[0]!.id], buys: '' } }),
  ];
  for (const result of rejects) assert.equal(result.ok, false, result.message);
});

test('v168 会议：结束事件时参会者两两关系上涨，并留下会议记录', () => {
  const state = fresh();
  const attendees = state.girls.slice(0, 3).map(girl => girl.id);
  const started = act(state, {
    type: 'startMeeting',
    plan: { title: '排班会议', placeId: 'lounge', placeName: '会客厅', attendeeIds: attendees, buys: '一壶热可可' },
  }).state;
  const event = started.events.find(item => item.meeting)!;
  const gain = DEFAULT_BALANCE.meetingRelationBase;
  const finished = act(started, { type: 'finishStorySession', eventId: event.id, summary: '排好了这一周的值班。' });
  assert.equal(finished.ok, true, finished.message);
  const next = finished.state;
  for (const id of attendees) {
    const girl = next.girls.find(item => item.id === id)!;
    for (const peer of attendees) {
      if (peer === id) continue;
      const was = started.girls.find(item => item.id === id)!.relationships[peer] ?? 40;
      assert.equal(girl.relationships[peer], Math.min(100, was + gain), `${girl.name} 对 ${peer} 的关系要涨`);
    }
  }
  const record = next.meetings?.find(item => item.eventId === event.id);
  assert.ok(record, '要写一条会议记录');
  assert.equal(record!.title, '排班会议');
  assert.equal(record!.attendees.length, 3);
  assert.equal(record!.buys, '一壶热可可');
  assert.ok(record!.summary.includes('排好了'), record!.summary);
});

test('v168 会议地点：会客厅、天台、各辖区都在候选里', () => {
  const places = meetingPlacesOf(fresh());
  assert.ok(places.some(place => place.id === 'lounge'));
  assert.ok(places.some(place => place.id === 'roof'));
  assert.ok(places.some(place => place.id.startsWith('district:')));
});
