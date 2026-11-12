import test from 'node:test';
import assert from 'node:assert/strict';
import { THINKING_TOKEN_RESERVE, vertexChat } from '../src/vertex.ts';
import { postLlmLog } from '../src/llmLog.ts';

/** v249：Vertex 返回思维链——不占正文额度、不截断、写进日志。 */

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** 临时替换 fetch，收集每一次请求体。 */
async function withFetch<T>(handler: (body: any, call: number) => Response, run: (bodies: any[]) => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: unknown, init: any) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    bodies.push(body);
    return handler(body, bodies.length);
  }) as typeof fetch;
  try {
    return await run(bodies);
  } finally {
    globalThis.fetch = original;
  }
}

test('v249 Vertex 请求开启思维链，并给正文单独留出额度', async () => {
  const result = await withFetch(
    () => jsonResponse({ candidates: [{ content: { parts: [{ text: '先把时间对上。', thought: true }, { text: '正文' }] }, finishReason: 'STOP' }] }),
    async bodies => {
      const call = await vertexChat({ model: 'gemini-2.5-pro', secret: 'express-key', timeoutMs: 5000 }, [{ role: 'user', content: '你好' }], { maxTokens: 6000 });
      assert.equal(call.ok, true, call.ok ? '' : call.message);
      return { call, body: bodies[0] };
    },
  );
  assert.equal(result.body.generationConfig.thinkingConfig.includeThoughts, true);
  assert.equal(result.body.generationConfig.thinkingConfig.thinkingBudget, undefined, '不设预算，避免思维链被截断');
  assert.equal(result.body.generationConfig.maxOutputTokens, 6000 + THINKING_TOKEN_RESERVE, '正文额度不被思考吃掉');
  assert.equal(result.call.ok && result.call.text, '正文');
  assert.equal(result.call.ok && result.call.reasoning, '先把时间对上。');
  assert.equal(result.call.ok && result.call.thinkingDropped, false, '正常请求不该标成降级');
});

test('v249 老模型不认思维链时去掉它重试一次，正文照常', async () => {
  const result = await withFetch(
    (_body, call) => call === 1
      ? jsonResponse({ error: { message: 'Thinking config is not supported for this model.' } }, 400)
      : jsonResponse({ candidates: [{ content: { parts: [{ text: '正文' }] }, finishReason: 'STOP' }] }),
    async bodies => {
      const call = await vertexChat({ model: 'gemini-1.5-pro', secret: 'express-key', timeoutMs: 5000 }, [{ role: 'user', content: '你好' }], { maxTokens: 6000 });
      return { call, bodies };
    },
  );
  assert.equal(result.call.ok, true, result.call.ok ? '' : result.call.message);
  assert.equal(result.call.ok && result.call.thinkingDropped, true, '要标出「思维链被悄悄去掉了」');
  assert.equal(result.bodies.length, 2);
  assert.equal(result.bodies[1]!.generationConfig.thinkingConfig, undefined);
  assert.equal(result.bodies[1]!.generationConfig.maxOutputTokens, 6000, '退回原来的正文额度');
});

test('v249 思维链整段写进日志，不截断', async () => {
  const reasoning = '想'.repeat(20_000);
  const bodies = await withFetch(
    () => jsonResponse({ ok: true }),
    async collected => {
      postLlmLog({ scope: '测试', labels: ['测试'], ok: true, messages: [], response: '正文', reasoning });
      return collected;
    },
  );
  const record = JSON.parse(bodies[0].text);
  assert.equal(record.reasoning.length, 20_000, '整段思维链都在 jsonl 里');
  assert.equal(record.response, '正文');
});
