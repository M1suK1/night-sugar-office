import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { __resetKvForTests } from '../src/store.ts';
import { loadStoryArchive, saveStoryToArchive } from '../src/storyArchive.ts';

function meetingState() {
  const state = createInitialState();
  return { ...state, gold: 5000 };
}

test('v176 剧情副本：演完之后能单独存下来并读回', async () => {
  __resetKvForTests();
  const state = meetingState();
  const attendees = state.girls.slice(0, 2).map(girl => girl.id);
  const started = act(state, {
    type: 'startMeeting',
    plan: { title: '保留副本的会', placeId: 'lounge', placeName: '会客厅', attendeeIds: attendees, buys: '一壶热可可' },
  }).state;
  const event = started.events.find(item => item.meeting)!;
  let next = act(started, { type: 'appendStoryTurn', eventId: event.id, turn: { id: 'p1', role: 'player', text: '先说排班。', lines: [], at: 1 } }).state;
  next = act(next, { type: 'appendStoryTurn', eventId: event.id, turn: { id: 'n1', role: 'narrator', text: '她把本子翻开。', lines: [], at: 2 } }).state;
  next = act(next, { type: 'finishStorySession', eventId: event.id, summary: '排好了班。' }).state;
  const finished = next.events.find(item => item.id === event.id)!;

  assert.equal(await saveStoryToArchive(finished, next), true);
  const list = await loadStoryArchive();
  assert.equal(list.length, 1);
  const saved = list[0]!;
  assert.equal(saved.title, '保留副本的会');
  assert.equal(saved.summary, '排好了班。');
  assert.ok(saved.turns.length >= 2, '逐轮对白要留下');
  assert.deepEqual(saved.participants.map(person => person.id).sort(), [...attendees].sort());
  assert.ok(!JSON.stringify(saved).includes('data:image'), '副本里不该带 data URL 立绘');
});

test('v176 剧情副本：同一段重复保存只留一份，删了存档也还在', async () => {
  __resetKvForTests();
  const state = meetingState();
  const attendees = state.girls.slice(0, 2).map(girl => girl.id);
  const started = act(state, {
    type: 'startMeeting',
    plan: { title: '重复保存', placeId: 'lounge', placeName: '会客厅', attendeeIds: attendees, buys: '' },
  }).state;
  const event = started.events.find(item => item.meeting)!;
  await saveStoryToArchive(event, started);
  await saveStoryToArchive(event, started);
  const list = await loadStoryArchive();
  assert.equal(list.length, 1);

  // 副本存在自己的键里：换浏览器/换存档都还在。
  assert.equal((await loadStoryArchive()).length, 1);
});
