import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_LAST_TURN_LIMIT, storyRecapHistory } from '../src/llm.ts';
import type { CharacterEvent, StoryTurn } from '../src/types.ts';

const event = { opening: '开场旁白'.repeat(200) } as CharacterEvent;

test('v225 上一轮的旁白与台词原样进历史', () => {
  const text = '雨停在门口。'.repeat(300);
  const turns = [
    { id: 't1', role: 'narrator', text: event.opening! },
    { id: 't2', role: 'narrator', text: '第一轮旁白', summary: '第一轮总结。' },
    {
      id: 't3',
      role: 'narrator',
      text,
      summary: '第二轮总结。',
      lines: [
        { speakerId: 'g1', speakerName: '爱丽丝', expression: 'calm', text: '请把门留一条缝。' },
        { speakerId: 'player', speakerName: '你', expression: 'calm', text: '好。' },
      ],
    },
  ] as StoryTurn[];
  const history = storyRecapHistory(event, turns);
  assert.ok(history.includes(text), '上一轮旁白不能被截成 400 字');
  assert.ok(history.includes('爱丽丝：「请把门留一条缝。」'), '上一轮台词也要带上');
  assert.ok(!history.includes('第一轮旁白'), '更早的轮次不回放原文');
  assert.ok(history.includes('第一轮总结。'));
});

test('v225 只有开场时把开场原文作为上一轮', () => {
  const turns = [{ id: 't1', role: 'narrator', text: event.opening! }] as StoryTurn[];
  const history = storyRecapHistory(event, turns);
  assert.ok(history.startsWith('上一轮原文：'));
  assert.ok(history.includes(event.opening!));
});

test('v225 超过 8 轮时仍以最近的上一轮为原文', () => {
  const turns = [{ id: 't0', role: 'narrator', text: event.opening! }] as StoryTurn[];
  for (let index = 1; index <= 10; index += 1) {
    turns.push({ id: 't' + index, role: 'narrator', text: '第' + index + '轮原文', summary: '第' + index + '轮总结' } as StoryTurn);
  }
  const history = storyRecapHistory(event, turns);
  assert.ok(history.includes('第10轮原文'));
  assert.ok(!history.includes('第9轮原文'));
  assert.ok(history.includes('第3轮总结'), '保留最近 8 轮的总结');
  assert.ok(!history.includes('第2轮总结'));
});

test('v225 上一轮原文超过 3000 字才截断', () => {
  const text = '长'.repeat(4000);
  const turns = [
    { id: 't1', role: 'narrator', text: event.opening! },
    { id: 't2', role: 'narrator', text, summary: '总结。' },
  ] as StoryTurn[];
  const history = storyRecapHistory(event, turns);
  assert.equal(STORY_LAST_TURN_LIMIT, 3000);
  assert.ok(history.includes('长'.repeat(3000)), '3000 字以内整段保留');
  assert.ok(!history.includes('长'.repeat(3001)), '超过 3000 字才截断');
});
