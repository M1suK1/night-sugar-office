import test from 'node:test';
import assert from 'node:assert/strict';
import { STORY_LAST_TURN_LIMIT, storyRecapHistory } from '../src/llm.ts';
import type { CharacterEvent, StoryTurn } from '../src/types.ts';

const openingText = '开场旁白。'.repeat(240);
const openingTurn = {
  id: 't1', role: 'narrator', text: openingText,
  lines: [{ speakerId: 'g1', speakerName: '爱丽丝', expression: 'calm', text: '欢迎你们来。' }],
} as StoryTurn;
const event = { opening: openingText } as CharacterEvent;

test('v234 第一轮续写时回放完整开场与开场台词', () => {
  const history = storyRecapHistory(event, [openingTurn]);
  assert.ok(history.startsWith('上一轮原文：'), history.slice(0, 30));
  assert.ok(!history.startsWith('开场：'));
  assert.ok(history.includes(openingText), '开场旁白不能被截成 400 字');
  assert.ok(history.includes('爱丽丝：「欢迎你们来。」'), '开场台词也要带上');
});

test('v234 开场超长时仍按 3000 字上限截断', () => {
  const long = { ...openingTurn, text: '长'.repeat(4000), lines: [] } as StoryTurn;
  const history = storyRecapHistory({ opening: long.text } as CharacterEvent, [long]);
  assert.ok(history.length <= STORY_LAST_TURN_LIMIT + '上一轮原文：\n'.length);
});

test('v234 有多轮时上一轮回放原文、更早轮次只留总结', () => {
  const first = {
    id: 't2', role: 'narrator', text: '第一轮的旁白'.repeat(20), summary: '第一轮总结：她把茶推过来。',
  } as StoryTurn;
  const second = {
    id: 't3', role: 'narrator', text: '第二轮的旁白', summary: '第二轮总结：雨停了。',
  } as StoryTurn;
  const history = storyRecapHistory(event, [openingTurn, first, second]);
  assert.ok(history.startsWith('开场：'), '开场仍只保留摘要');
  assert.ok(history.includes('第一轮总结：她把茶推过来。'));
  assert.ok(!history.includes('第一轮的旁白'.repeat(20)), '更早轮次不回放原文');
  assert.ok(history.includes('上一轮原文：\n第二轮的旁白'), '上一轮保留原文');
});
