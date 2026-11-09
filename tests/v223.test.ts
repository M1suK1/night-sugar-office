import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { addEvent } from '../src/rules/storyCore.ts';
import { eventClockLabel } from '../src/storySession.ts';
import { openingContext } from '../src/llm.ts';
import { archiveStoryRecord, replayEventOf } from '../src/storyArchive.ts';

test('v223 角色事件记录发生时刻，界面标签带日期与时间', () => {
  const state = createInitialState();
  state.minutes = 1290;
  const girl = state.girls[0]!;
  const event = addEvent(state, girl, '雨里的访客', '她在门口停下。', 'test');
  assert.equal(event.minutes, 1290);
  assert.equal(eventClockLabel(event), `第 ${state.day} 日 · 21:30`);
});

test('v223 旧事件没有 minutes 时只显示第几日', () => {
  assert.equal(eventClockLabel({ day: 7 }), '第 7 日');
});

test('v223 角色剧情的提示词带上现在的时间', () => {
  const state = createInitialState();
  state.minutes = 1290;
  const girl = state.girls[0]!;
  const event = addEvent(state, girl, '雨里的访客', '她在门口停下。', 'test');
  const context = openingContext(state, event);
  assert.ok(context.includes(`【现在的时间】第 ${state.day} 日 21:30`), context.slice(0, 300));
});

test('v223 剧情副本与回放也保留发生时间', () => {
  const state = createInitialState();
  state.minutes = 1290;
  const girl = state.girls[0]!;
  const event = addEvent(state, girl, '雨里的访客', '她在门口停下。', 'test');
  const archived = archiveStoryRecord(event, state);
  assert.equal(archived.minutes, 1290);
  assert.equal(replayEventOf(archived).minutes, 1290);
});
