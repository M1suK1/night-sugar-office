import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoOpenStory } from '../src/storySession.ts';
import type { CharacterEvent } from '../src/types.ts';

function event(over: Partial<CharacterEvent> = {}): CharacterEvent {
  return {
    id: 'ev-1', girlId: 'g1', title: '雨里的访客', hook: '她在门口站了很久。',
    scenes: [], stage: 0, status: 'active', day: 14, source: 'llm', badge: false,
    mode: 'session', turns: [], ...over,
  };
}

test('v186 蓝图事件自带开场白：没有玩家 seed 也要直接开场', () => {
  const graphEvent = event({ opening: '她站在门口，伞尖滴着水。' });
  assert.equal(shouldAutoOpenStory(graphEvent), true);
});

test('v186 没有开场白的约谈 / 会议仍等玩家先写', () => {
  assert.equal(shouldAutoOpenStory(event()), false);
  assert.equal(shouldAutoOpenStory(event({ hookInPrompt: false, playerSeed: undefined })), false);
});

test('v186 玩家已经写下 seed：照常开场', () => {
  assert.equal(shouldAutoOpenStory(event({ playerSeed: '' })), true);
  assert.equal(shouldAutoOpenStory(event({ playerSeed: '我递了帖子。' })), true);
});

test('v186 已经有对白、已经结束、不是交互模式都不重复开场', () => {
  assert.equal(shouldAutoOpenStory(event({ opening: '开场。', turns: [{ id: 't1', role: 'narrator', text: '开场。' }] })), false);
  assert.equal(shouldAutoOpenStory(event({ opening: '开场。', status: 'done' })), false);
  assert.equal(shouldAutoOpenStory(event({ opening: '开场。', mode: 'story' })), false);
});

test('v186 只有空白开场白不算开场', () => {
  assert.equal(shouldAutoOpenStory(event({ opening: '   ' })), false);
});
