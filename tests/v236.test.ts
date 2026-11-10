import test from 'node:test';
import assert from 'node:assert/strict';
import { storyRecapHistory } from '../src/llm.ts';
import type { CharacterEvent, StoryTurn } from '../src/types.ts';

const narration = '第一段旁白。\n第二段旁白。\n第三段旁白。';
const turn = {
  id: 't1', role: 'narrator', text: narration,
  lines: [
    { speakerId: 'g1', speakerName: '爱丽丝', expression: 'calm', text: '第一句。', after: 1 },
    { speakerId: 'g1', speakerName: '爱丽丝', expression: 'shy', text: '第二句。', after: 2 },
  ],
} as StoryTurn;

test('v236 上一轮原文按 after 把台词插回旁白', () => {
  const history = storyRecapHistory({ opening: narration } as CharacterEvent, [turn]);
  const first = history.indexOf('第一段旁白');
  const firstLine = history.indexOf('爱丽丝：「第一句。」');
  const second = history.indexOf('第二段旁白');
  const secondLine = history.indexOf('爱丽丝：「第二句。」');
  const third = history.indexOf('第三段旁白');
  assert.ok(first >= 0 && firstLine > first);
  assert.ok(second > firstLine);
  assert.ok(secondLine > second);
  assert.ok(third > secondLine);
});

test('v236 非开场轮次的原文也同样交织', () => {
  const event = { opening: '很长的开场'.repeat(100) } as CharacterEvent;
  const previous = { ...turn, id: 't2', text: narration, summary: '总结' } as StoryTurn;
  const history = storyRecapHistory(event, [turn, previous]);
  assert.ok(history.includes('上一轮原文：\n第一段旁白。\n爱丽丝：「第一句。」\n第二段旁白。'), history);
});
