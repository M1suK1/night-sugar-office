import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';

test('v235 六人会议的 cast 不会被截成五人', () => {
  const state = createInitialState();
  const six = state.girls.slice(0, 5).map(girl => ({ ...girl, status: 'idle' as const }));
  six.push({ ...six[0]!, id: 'sixth-girl', name: '第六位' });
  state.girls = six;
  const started = act(state, {
    type: 'startMeeting',
    plan: {
      title: '六人会议', placeId: 'lounge', placeName: '会客厅',
      attendeeIds: six.map(girl => girl.id), buys: '',
    },
  });
  assert.equal(started.ok, true, started.message);
  const event = started.state.events.find(item => item.meeting)!;
  assert.equal(event.cast?.length, 6);
  const opened = act(started.state, {
    type: 'startStorySession', eventId: event.id, cast: six.map(girl => girl.id),
    opening: '会客厅里坐满了人。', lines: [], options: [],
  });
  assert.equal(opened.ok, true, opened.message);
  assert.equal(opened.state.events.find(item => item.id === event.id)?.cast?.length, 6);
});
