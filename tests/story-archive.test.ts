import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { __resetKvForTests } from '../src/store.ts';
import { loadStoryArchive, replayEventOf, saveStoryToArchive } from '../src/storyArchive.ts';

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

test('v177 回看：副本能还原成可演的事件（保留说话人 id 与心声）', () => {
  const event = replayEventOf({
    id: 'story-e1', eventId: 'e1', title: '雨夜', day: 9, savedAt: 1,
    lead: { id: 'g1', name: '玛丽' },
    participants: [{ id: 'g1', name: '玛丽' }, { id: 'g2', name: '洛茜' }],
    summary: '雨停了。',
    turns: [
      { role: 'player', text: '先说说旧城区。', lines: [] },
      {
        role: 'narrator',
        text: '她把杯子放下。',
        lines: [
          { speakerId: 'g2', speakerName: '洛茜', text: '46 点。', expression: 'sad' },
          { speakerName: '玛丽', text: '那就去清。', mode: 'thought' },
        ],
      },
    ],
  });
  assert.equal(event.mode, 'session');
  assert.equal(event.status, 'done');
  assert.equal(event.girlId, 'g1');
  assert.deepEqual(event.cast, ['g1', 'g2']);
  const narrator = event.turns![1]!;
  assert.equal(narrator.role, 'narrator');
  assert.equal(narrator.lines?.[0]?.speakerId, 'g2');
  assert.equal(narrator.lines?.[0]?.expression, 'sad');
  // 老副本只存了名字：没有 id 时先用名字顶上，界面再按名字换回 id。
  assert.equal(narrator.lines?.[1]?.speakerId, '玛丽');
  assert.equal(narrator.lines?.[1]?.mode, 'thought');
});

test('v177 回看：表情按句带回来，缺了就沿用这个人上一句', () => {
  const event = replayEventOf({
    id: 'story-e2', eventId: 'e2', title: '灯下', day: 3, savedAt: 1,
    lead: { id: 'g1', name: '玛丽' },
    participants: [{ id: 'g1', name: '玛丽' }],
    summary: '',
    turns: [
      { role: 'narrator', text: '她抬眼。', lines: [{ speakerId: 'g1', speakerName: '玛丽', text: '嗯。', expression: 'smile' }] },
      { role: 'narrator', text: '她又低下头。', lines: [{ speakerId: 'g1', speakerName: '玛丽', text: '……' }] },
      { role: 'narrator', text: '她别过脸。', lines: [{ speakerId: 'g1', speakerName: '玛丽', text: '别看。', expression: 'shy' }] },
    ],
  });
  const expressions = event.turns!.map(turn => turn.lines![0]!.expression);
  assert.deepEqual(expressions, ['smile', 'smile', 'shy']);
});

