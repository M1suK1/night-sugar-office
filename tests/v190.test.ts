import test from 'node:test';
import assert from 'node:assert/strict';
import { expressionAtTurn } from '../src/storySession.ts';
import type { StoryTurn } from '../src/types.ts';

const turn = (id: string, role: 'narrator' | 'player', lines: StoryTurn['lines'] = []): StoryTurn => ({ id, role, text: 'x', lines });

const turns: StoryTurn[] = [
  turn('n1', 'narrator', [{ speakerId: 'g1', speakerName: '雾眠', expression: 'calm', text: '嗯。' }]),
  turn('p1', 'player'),
  turn('n2', 'narrator', [
    { speakerId: 'g1', speakerName: '雾眠', expression: 'smile', text: '你来了。' },
    { speakerId: 'g2', speakerName: '灯', expression: 'surprise', text: '欸？' },
  ]),
  turn('n3', 'narrator', [{ speakerId: 'g1', speakerName: '雾眠', expression: 'shy', text: '别看。' }]),
];

test('v190 回看第一屏用的是读到那一轮的表情，不是结局那张脸', () => {
  assert.deepEqual(expressionAtTurn(turns, 'n1'), { id: 'g1', expression: 'calm' });
  assert.deepEqual(expressionAtTurn(turns, 'n2'), { id: 'g2', expression: 'surprise' });
  assert.deepEqual(expressionAtTurn(turns, 'n3'), { id: 'g1', expression: 'shy' });
});

test('v190 读到玩家发言那一轮，沿用她上一句的表情', () => {
  assert.deepEqual(expressionAtTurn(turns, 'p1'), { id: 'g1', expression: 'calm' });
});

test('v190 没有阅读位置时取最后一句，行为与以前一致', () => {
  assert.deepEqual(expressionAtTurn(turns), { id: 'g1', expression: 'shy' });
  assert.deepEqual(expressionAtTurn(turns, 'turn-not-exist'), { id: 'g1', expression: 'shy' });
});

test('v190 没有台词的轮次跳过，空段落返回 null', () => {
  assert.equal(expressionAtTurn([turn('n1', 'narrator')]), null);
  assert.equal(expressionAtTurn([]), null);
  assert.deepEqual(expressionAtTurn([turn('n1', 'narrator'), turn('n2', 'narrator', [{ speakerId: 'g1', speakerName: '雾眠', expression: 'sad', text: '…' }])], 'n2'), { id: 'g1', expression: 'sad' });
});
