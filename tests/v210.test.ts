import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { storylineHistoryText } from '../src/girlDossier.ts';
import { generateStoryOpening, generateStoryTurn } from '../src/llm.ts';
import type { CharacterEvent, Storyline } from '../src/types.ts';

/**
 * v210：完整故事线前提 + 更长的行动选项。
 */

const LONG_OPTION = '把伞递给她，然后陪她在门口站一会儿，等雨小一点再一起回屋';

function story(slot: number, premise: string, beatTitle: string, currentTitle: string): Storyline {
  return {
    id: 's' + slot, girlId: 'g1', title: '第 ' + slot + ' 段', premise, tone: '', beats: [],
    stage: 0, status: slot === 2 ? 'active' : 'done', createdAt: '', day: slot, source: 'manual', slot,
    ending: slot === 1 ? '留下' : undefined,
    graph: undefined,
    run: undefined,
  } as unknown as Storyline;
}

test('v210 两段长 premise 都原样保留，不再截到 60 字', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const one = '第一段前提：她在旧城区的雨里走了很久，最后在一张长椅上坐下来，决定先把今晚过完，再想明天要去哪里。';
  const two = '第二段前提：她从长椅上醒来，发现市役所的追索函已经压在门缝里，而码头那边的灯还亮着，像是在等她过去。';
  state.storylines = [story(1, one, '旧防线摸哨', '长椅清梦'), story(2, two, '瓦上的水汽', '追索函')].map(item => ({ ...item, girlId: girl.id }));
  const text = storylineHistoryText(state, girl, 3);
  assert.ok(text.includes(one), '第一段完整前提应保留');
  assert.ok(text.includes(two), '第二段完整前提应保留');
});

test('v210 三段超预算时丢最旧一段，并写明省略', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  // v233：结局描述不再被截断，预算放大到每段 900 tokens，这里要真撑爆它才测得到省略。
  const premise = '这是一段很长的前提，用来把故事线历史撑到预算上限之外，确保第三段还能保留，而最旧的一段被整段省略。'.repeat(60);
  state.storylines = [story(1, premise, '第一幕', '第二幕'), story(2, premise, '第三幕', '第四幕'), story(3, premise, '第五幕', '第六幕')].map(item => ({ ...item, girlId: girl.id }));
  const text = storylineHistoryText(state, girl, 3);
  // 预算放大后（v233：结局描述不许截断），一次可能丢掉不止一段——只要写明丢了几段、最新的那段还在。
  assert.match(text, /（还有 [1-9]\d* 段更早的故事线未列出）/);
  assert.ok(text.includes('第 3 段'));
  assert.equal(text.includes('第 1 段'), false, '最旧的一段应被整段省略');
});

function sessionEvent(state: ReturnType<typeof createInitialState>): CharacterEvent {
  const girl = state.girls[0]!;
  return {
    id: 'ev-opt', girlId: girl.id, title: '雨夜', hook: '她在门口等你',
    scenes: [], stage: 0, status: 'active', day: 1, source: 'template', badge: false,
    mode: 'session', opening: '雨下得很大。', cast: [girl.id], turns: [],
  } as CharacterEvent;
}

function mockOptions() {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      narration: '雨声压低了呼吸，谁都没有先退。'.repeat(10), lines: [], options: [LONG_OPTION, '先关上门', '站在原地'], bond: 0,
    }) }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

const config = { endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock', provider: 'vertex' } as never;

test('v210 开场选项保留 40 字，不再截到 24', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => mockOptions()) as typeof fetch;
  try {
    const state = createInitialState();
    const result = await generateStoryOpening(config, state, sessionEvent(state));
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (result.ok) assert.equal(result.options[0], LONG_OPTION);
  } finally {
    globalThis.fetch = original;
  }
});

test('v210 续写选项保留 40 字，不再截到 24', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => mockOptions()) as typeof fetch;
  try {
    const state = createInitialState();
    const result = await generateStoryTurn(config, state, sessionEvent(state), '我把伞递给她。');
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (result.ok) assert.equal(result.turn.options[0], LONG_OPTION);
  } finally {
    globalThis.fetch = original;
  }
});
