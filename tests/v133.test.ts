import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { generateStoryEnding } from '../src/llm.ts';
import { contractPrompts } from '../src/promptContracts.ts';
import { arcEndingContract } from '../src/promptSections.ts';
import type { CharacterEvent, GameState } from '../src/types.ts';

function sessionEvent(state: GameState): CharacterEvent {
  return {
    id: 'ev-end', girlId: state.girls[0]!.id, title: '雨夜的便利店', hook: '她在门口等你',
    scenes: [], stage: 0, status: 'active', day: 14, source: 'template', badge: true,
    mode: 'session', opening: '雨下得很大。', cast: [state.girls[0]!.id],
    turns: [{ id: 'turn-n-1', role: 'narrator', text: '她把伞收起来。', lines: [], options: ['你递给她一杯热的'] },
      { id: 'turn-p-1', role: 'player', text: '我把伞递给她。', lines: [], at: Date.now() }],
  } as CharacterEvent;
}

function stateWith(event: CharacterEvent): GameState {
  return { ...createInitialState(), events: [event] };
}

test('v133 结束事件会把叙事者写的结局接在最后，而不是直接消失', () => {
  const event = sessionEvent(createInitialState());
  const state = stateWith(event);
  const result = act(state, {
    type: 'finishStorySession',
    eventId: event.id,
    ending: { narration: '雨停之前谁都没再说话。她把伞留在了柜台上，转身走进夜色。', lines: [{ speakerId: 'player', speakerName: '所长', expression: 'calm', text: '路上小心。' }] },
  });
  assert.equal(result.ok, true, result.message);
  const done = result.state.events[0]!;
  const turns = done.turns ?? [];
  assert.equal(turns.length, 3, '开局两轮 + 结局一轮');
  const last = turns.at(-1)!;
  assert.equal(last.role, 'narrator');
  assert.match(last.text, /雨停之前/);
  assert.deepEqual(last.options, [], '结局不给下一轮选项');
  assert.equal(done.sessionDone, true);
  assert.equal(done.status, 'done');
});

test('v133 没写结局时保持老行为（直接收尾）', () => {
  const event = sessionEvent(createInitialState());
  const result = act(stateWith(event), { type: 'finishStorySession', eventId: event.id });
  assert.equal(result.ok, true);
  assert.equal(result.state.events[0]!.turns?.length, 2);
});

test('v133 收尾契约作为预设词条暴露，且明确要求不给选项', () => {
  const entry = contractPrompts().find(item => item.id === 'arc:ending');
  assert.ok(entry, '预设里要有「剧情收尾 · 结构契约」');
  assert.equal(entry!.content, arcEndingContract());
  assert.ok(entry!.content.includes('不要写 options'));
  assert.ok(entry!.content.includes('400–900 字'));
});

test('v133 收尾请求发的是收尾契约，而且不带 options 字段', async () => {
  const original = globalThis.fetch;
  let system = '';
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    system = String(init?.body ?? '');
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ narration: '灯光在雨里散成一团。'.repeat(20), lines: [] }) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const state = createInitialState();
    const result = await generateStoryEnding(
      { endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock', provider: 'vertex' } as never,
      state, sessionEvent(state),
    );
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (result.ok) assert.ok(result.turn.narration.length > 40);
  } finally {
    globalThis.fetch = original;
  }
  assert.ok(system.includes('【JSON 形状】'), '请求里要带契约');
  assert.ok(system.includes('收尾'), '要说明这一轮是收尾');
  assert.ok(system.includes('所长的决定'), '还要带上「玩家把这一段停在这里」');
});
