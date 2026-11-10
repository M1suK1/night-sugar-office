import test from 'node:test';
import assert from 'node:assert/strict';
import { arcTurnContract } from '../src/promptSections.ts';
import { STORY_TURN_SUMMARY_LIMIT, storyRecapHistory, storyTurnSummary } from '../src/llm.ts';
import { shippedPresets, presetPrompts } from '../src/presets.ts';
import type { CharacterEvent, StoryTurn } from '../src/types.ts';

test('v215 续写契约要求写不超过 300 字的总结', () => {
  const text = arcTurnContract();
  assert.ok(text.includes('"bond":0,"summary":""'), text);
  assert.ok(text.includes('summary 必填'), text);
});

test('v215 总结落库最多 400 字', () => {
  assert.equal(storyTurnSummary('短'.repeat(380)), '短'.repeat(380));
  assert.equal(storyTurnSummary('长'.repeat(450)).length, STORY_TURN_SUMMARY_LIMIT);
  assert.equal(storyTurnSummary(undefined), '');
});

test('v215 更早的轮次只引用总结，上一轮回放原文', () => {
  const event = { opening: '开'.repeat(1000) } as CharacterEvent;
  const earlier = '旧'.repeat(2000);
  const latest = '新'.repeat(2000);
  const turns = [
    { id: 't1', role: 'narrator', text: event.opening },
    { id: 'p1', role: 'player', text: '玩家原话'.repeat(50) },
    { id: 't2', role: 'narrator', text: earlier, summary: '第二轮总结：他把伞递过去。' },
    { id: 't3', role: 'narrator', text: latest },
  ] as StoryTurn[];
  const history = storyRecapHistory(event, turns);
  assert.ok(history.includes('第二轮总结：他把伞递过去。'));
  assert.ok(!history.includes('玩家原话'), '玩家原话不再进历史');
  assert.ok(!history.includes('旧'.repeat(500)), '更早的轮次只留总结，不回放旁白');
  assert.ok(history.includes(latest), '紧挨着的那一轮保留原文');
  const lines = history.split('\n');
  assert.ok(lines[0]!.startsWith('开场：'));
  assert.ok(lines[0]!.length <= 3 + STORY_TURN_SUMMARY_LIMIT, '开场截到 400 字');
  assert.ok(lines[1]!.length <= 2 + STORY_TURN_SUMMARY_LIMIT);
});

test('v215 没有开场时第一轮旁白作为上一轮原文', () => {
  const event = {} as CharacterEvent;
  const turns = [{ id: 't1', role: 'narrator', text: '第一轮的旁白'.repeat(100) }] as StoryTurn[];
  const history = storyRecapHistory(event, turns);
  assert.ok(history.startsWith('上一轮原文：'));
  assert.ok(history.includes('第一轮的旁白'.repeat(100)));
});

test('v215 出厂预设的续写契约也带总结要求', () => {
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'arc:turn');
    assert.ok(entry, `${preset.id} 缺少 arc:turn`);
    assert.ok(entry!.content.includes('"bond":0,"summary":""'), `${preset.id} 的形状缺少 summary`);
    assert.ok(entry!.content.includes('summary 必填'), `${preset.id} 缺少总结要求`);
    assert.ok(entry!.content.includes('60 字'), `${preset.id} 的选项字数被顺手改掉了`);
  }
});
