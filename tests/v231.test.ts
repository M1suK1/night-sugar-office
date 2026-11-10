import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';
import { OATH_RING_COST } from '../src/rules/oathOps.ts';
import { sanitizeMeetingRecords } from '../src/rules/meetingSettle.ts';
import { openingContext } from '../src/llm.ts';

const oathReady = () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.bond = 100;
  girl.status = 'idle';
  state.gold = OATH_RING_COST + 5000;
  return { state, girl };
};

const weddingStarted = () => {
  const { state, girl } = oathReady();
  const mate = state.girls[1]!;
  mate.status = 'idle';
  const oath = act(state, { type: 'oath', girlId: girl.id });
  assert.equal(oath.ok, true, oath.message);
  const started = act(oath.state, {
    type: 'startMeeting',
    plan: {
      title: '与她的婚礼', kind: 'wedding', partnerId: girl.id,
      placeId: 'lounge', placeName: '会客厅', attendeeIds: [girl.id, mate.id], buys: '捧花',
    },
  });
  assert.equal(started.ok, true, started.message);
  const event = started.state.events.find(item => item.meeting?.kind === 'wedding');
  assert.ok(event);
  return { state: started.state, girl, event: event! };
};

test('v231 满羁绊并付得起戒指才能誓约', () => {
  const lowBond = createInitialState();
  lowBond.girls[0]!.bond = 99;
  assert.equal(act(lowBond, { type: 'oath', girlId: lowBond.girls[0]!.id }).ok, false);

  const poor = createInitialState();
  poor.girls[0]!.bond = 100;
  poor.gold = OATH_RING_COST - 1;
  assert.equal(act(poor, { type: 'oath', girlId: poor.girls[0]!.id }).ok, false);

  const { state, girl } = oathReady();
  const done = act(state, { type: 'oath', girlId: girl.id });
  assert.equal(done.ok, true, done.message);
  assert.equal(done.state.gold, state.gold - OATH_RING_COST);
  assert.equal(done.state.girls[0]!.oath?.day, state.day);
  assert.equal(act(done.state, { type: 'oath', girlId: girl.id }).ok, false, '不能重复誓约');
});

test('v231 誓约后才能举行婚礼，且婚礼消耗一小时', () => {
  const { state, girl } = oathReady();
  const mate = state.girls[1]!;
  mate.status = 'idle';
  const rejected = act(state, {
    type: 'startMeeting',
    plan: { title: '婚礼', kind: 'wedding', partnerId: girl.id, placeId: 'lounge', placeName: '会客厅', attendeeIds: [girl.id, mate.id], buys: '' },
  });
  assert.equal(rejected.ok, false);

  const wedding = weddingStarted();
  assert.equal(wedding.event.meeting?.partnerId, girl.id);
  assert.equal(wedding.event.girlId, girl.id, '剧情主角是新娘');
  const minutes = (wedding.state.day - state.day) * 1440 + (wedding.state.minutes - state.minutes);
  assert.equal(minutes, DEFAULT_BALANCE.meetingMinutes);
});

test('v231 婚礼收尾才落账，第二次婚礼被拒', () => {
  const { state, girl, event } = weddingStarted();
  const done = act(state, { type: 'finishStorySession', eventId: event.id, summary: '婚礼结束。' });
  assert.equal(done.ok, true, done.message);
  const married = done.state.girls.find(item => item.id === girl.id)!;
  assert.equal(married.wedding?.eventId, event.id);
  const record = done.state.meetings?.[0];
  assert.equal(record?.kind, 'wedding');
  assert.equal(record?.partnerId, girl.id);
  assert.equal(record?.partnerName, girl.name);

  const mate = done.state.girls[1]!;
  const again = act(done.state, {
    type: 'startMeeting',
    plan: { title: '再办一次', kind: 'wedding', partnerId: girl.id, placeId: 'lounge', placeName: '会客厅', attendeeIds: [girl.id, mate.id], buys: '' },
  });
  assert.equal(again.ok, false);
  assert.match(again.message, /办过了/);
});

test('v231 婚礼提示词按婚礼写，不按会议写', () => {
  const { state, event } = weddingStarted();
  const context = openingContext(state, event);
  assert.ok(context.includes('【这是一场婚礼】'), context.slice(0, 300));
  assert.ok(context.includes('誓词'));
});

test('v231 旧会议记录缺 kind 时按普通会议处理', () => {
  const records = sanitizeMeetingRecords([{
    id: 'm1', eventId: 'e1', title: '旧会', placeName: '会客厅', attendees: [],
    buys: '', fee: 100, summary: '', relationshipGain: 2, day: 3, at: '第 3 日',
  }]);
  assert.equal(records[0]?.kind, 'meeting');
  assert.equal(records[0]?.partnerId, undefined);
});

test('v231 婚礼进行中不能再开第二场', () => {
  const { state, girl } = weddingStarted();
  const mate = state.girls[1]!;
  const again = act(state, {
    type: 'startMeeting',
    plan: { title: '补办一场', kind: 'wedding', partnerId: girl.id, placeId: 'lounge', placeName: '会客厅', attendeeIds: [girl.id, mate.id], buys: '' },
  });
  assert.equal(again.ok, false);
  assert.match(again.message, /进行中/);
});
