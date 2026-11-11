import test from 'node:test';
import assert from 'node:assert/strict';
import { presetRuntime, type ChatPreset } from '../src/presets.ts';
import { THINKING_TOKEN_RESERVE, vertexChat } from '../src/vertex.ts';
import { requestParams } from '../src/llm.ts';
import type { LlmConfig } from '../src/llm.ts';

/** v250：思维链改成每个预设自己的开关，缺省为开。 */

const presetOf = (settings: Record<string, unknown>): ChatPreset => ({
  id: 'p-test', name: '测试预设', description: '', settings, prompts: [],
  createdAt: '2026-01-01', updatedAt: '2026-01-01',
} as ChatPreset);

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function payloadOf(thinking?: boolean): Promise<any> {
  const original = globalThis.fetch;
  let body: any = null;
  globalThis.fetch = (async (_url: unknown, init: any) => {
    body = JSON.parse(String(init?.body ?? '{}'));
    return jsonResponse({ candidates: [{ content: { parts: [{ text: '正文' }] }, finishReason: 'STOP' }] });
  }) as typeof fetch;
  try {
    const result = await vertexChat(
      { model: 'gemini-2.5-pro', secret: 'express-key', timeoutMs: 5000 },
      [{ role: 'user', content: '你好' }],
      { maxTokens: 4000, thinking },
    );
    assert.equal(result.ok, true, result.ok ? '' : result.message);
  } finally {
    globalThis.fetch = original;
  }
  return body;
}

test('v250 预设缺省返回思维链，明确关掉才关', () => {
  assert.equal(presetRuntime(presetOf({})).thinking, true);
  assert.equal(presetRuntime(presetOf({ thinking: false })).thinking, false);
  assert.equal(presetRuntime(presetOf({ thinking: true })).thinking, true);
});

test('v250 关掉思维链时请求体里没有 thinkingConfig，额度也不额外预留', async () => {
  const body = await payloadOf(false);
  assert.equal(body.generationConfig.thinkingConfig, undefined);
  assert.equal(body.generationConfig.maxOutputTokens, 4000);
});

test('v250 开着思维链时正文额度之外再加预留', async () => {
  const body = await payloadOf(true);
  assert.deepEqual(body.generationConfig.thinkingConfig, { includeThoughts: true });
  assert.equal(body.generationConfig.maxOutputTokens, 4000 + THINKING_TOKEN_RESERVE);
});

test('v250 日志参数只对 Vertex 记 thinking', () => {
  const vertex: LlmConfig = { endpoint: 'https://example.com', apiKey: 'k', model: 'gemini-2.5-pro', provider: 'vertex' };
  const openai: LlmConfig = { endpoint: 'https://example.com/v1', apiKey: 'k', model: 'deepseek-chat' };
  assert.equal(requestParams(vertex, { thinking: false }).thinking, false);
  assert.equal('thinking' in requestParams(openai, { thinking: true }), false);
});
