import test from 'node:test';
import assert from 'node:assert/strict';
import { THINKING_TOKEN_RESERVE, clearThinkingVariantCache, thinkingConfigOf, thinkingLadder, vertexChat } from '../src/vertex.ts';

/**
 * v251：思维链请求体的写法要跟模型代际对上。
 *
 * 症状：gemini-4-argon 这类新模型正文正常，思维链一直是空的；同一条接口在 SillyTavern
 * 里却有思维链。原因是新版模型认 `thinkingConfig.thinkingLevel`，只发 includeThoughts
 * 时有的端点当成「不思考」，于是 thought 分段压根不会出现。
 */

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const withThought = (thought: string, text = '正文') => jsonResponse({
  candidates: [{ content: { parts: [{ text: thought, thought: true }, { text }] }, finishReason: 'STOP' }],
});
const plainText = (text = '正文') => jsonResponse({ candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] });

async function run(
  handler: (body: any, call: number) => Response,
  opts: { model: string; thinking?: boolean; maxTokens?: number } = { model: 'gemini-4-argon' },
): Promise<{ call: Awaited<ReturnType<typeof vertexChat>>; bodies: any[] }> {
  const original = globalThis.fetch;
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: unknown, init: any) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')));
    return handler(bodies[bodies.length - 1], bodies.length);
  }) as typeof fetch;
  try {
    clearThinkingVariantCache();
    const call = await vertexChat(
      { model: opts.model, secret: 'express-key', timeoutMs: 5000 },
      [{ role: 'user', content: '你好' }],
      { maxTokens: opts.maxTokens ?? 4000, thinking: opts.thinking },
    );
    return { call, bodies };
  } finally {
    globalThis.fetch = original;
  }
}

test('v251 新模型先按 thinkingLevel 发，思维链能拿回来', async () => {
  const { call, bodies } = await run(() => withThought('先看看她今晚有没有撒谎。'));
  assert.equal(call.ok, true, call.ok ? '' : call.message);
  assert.deepEqual(bodies[0]!.generationConfig.thinkingConfig, { includeThoughts: true, thinkingLevel: 'high' });
  assert.equal(call.ok && call.reasoning, '先看看她今晚有没有撒谎。');
  assert.equal(call.ok && call.thinkingDropped, false);
  assert.equal(call.ok && call.text, '正文');
});

test('v251 老模型仍按裸 includeThoughts 发，不多带字段', async () => {
  const { bodies } = await run(() => withThought('想一下'), { model: 'gemini-2.5-pro' });
  assert.deepEqual(bodies[0]!.generationConfig.thinkingConfig, { includeThoughts: true });
});

test('v251 thinkingLevel 被拒时退回裸 includeThoughts，思维链照常', async () => {
  const { call, bodies } = await run(body => {
    if (body.generationConfig.thinkingConfig?.thinkingLevel) {
      return jsonResponse({ error: { message: 'Invalid JSON payload: Unknown name "thinkingLevel".' } }, 400);
    }
    return withThought('换个写法就想通了。');
  });
  assert.equal(call.ok, true, call.ok ? '' : call.message);
  assert.equal(call.ok && call.reasoning, '换个写法就想通了。');
  assert.equal(call.ok && call.thinkingDropped, false);
  assert.equal(bodies.length, 2, '只该多试一次');
  assert.deepEqual(bodies[1]!.generationConfig.thinkingConfig, { includeThoughts: true });
});

test('v251 thinkingLevel 被接受却没有思维链时，换一种写法再试', async () => {
  const { call, bodies } = await run(body => body.generationConfig.thinkingConfig?.thinkingLevel ? plainText() : withThought('这一版才给思维链。'));
  assert.equal(call.ok && call.reasoning, '这一版才给思维链。');
  assert.equal(bodies.length, 2);
});

test('v251 所有写法都没思维链时如实标记降级，正文仍然可用', async () => {
  const { call, bodies } = await run(() => plainText('没有思维链的正文'));
  assert.equal(call.ok, true, call.ok ? '' : call.message);
  assert.equal(call.ok && call.text, '没有思维链的正文');
  assert.equal(call.ok && call.thinkingDropped, true, '要让界面知道这次没有思维链');
  assert.ok(bodies.length >= 2, '至少试过一种以上的写法');
});

test('v251 模型明说不支持思维链时，直接走无思维链那档', async () => {
  const { call, bodies } = await run(body => body.generationConfig.thinkingConfig
    ? jsonResponse({ error: { message: 'Thinking config is not supported for this model.' } }, 400)
    : plainText('没有思维链的正文'));
  assert.equal(call.ok, true, call.ok ? '' : call.message);
  assert.equal(call.ok && call.thinkingDropped, true);
  const last = bodies[bodies.length - 1]!;
  assert.equal(last.generationConfig.thinkingConfig, undefined);
  assert.equal(last.generationConfig.maxOutputTokens, 4000);
});

test('v251 额度超过上限时压回配置值重试，但思维链不丢', async () => {
  const { call, bodies } = await run(body => {
    if (body.generationConfig.maxOutputTokens > 20_000) {
      return jsonResponse({ error: { message: 'maxOutputTokens is too large for this model.' } }, 400);
    }
    return withThought('额度压下来也能想。');
  });
  assert.equal(call.ok, true, call.ok ? '' : call.message);
  assert.equal(call.ok && call.reasoning, '额度压下来也能想。', '额度问题不该顺手把思维链扔掉');
  const retried = bodies[bodies.length - 1]!;
  assert.ok(retried.generationConfig.thinkingConfig, '重试时仍要请求思维链');
});

test('v251 试成功的写法会被记住，下一次直接用', async () => {
  const original = globalThis.fetch;
  const bodies: any[] = [];
  globalThis.fetch = (async (_url: unknown, init: any) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    bodies.push(body);
    return body.generationConfig.thinkingConfig?.thinkingBudget ? withThought('记住了。') : plainText();
  }) as typeof fetch;
  try {
    clearThinkingVariantCache();
    const params = { maxTokens: 4000 };
    await vertexChat({ model: 'gemini-4-argon', secret: 'express-key', timeoutMs: 5000 }, [{ role: 'user', content: '一' }], params);
    const firstCount = bodies.length;
    await vertexChat({ model: 'gemini-4-argon', secret: 'express-key', timeoutMs: 5000 }, [{ role: 'user', content: '二' }], params);
    assert.equal(bodies[firstCount]!.generationConfig.thinkingConfig.thinkingBudget, -1, '第二次应直接从「能用」的写法开始');
  } finally {
    globalThis.fetch = original;
    clearThinkingVariantCache();
  }
});

test('v251 关掉思维链时只发一次、不带 thinkingConfig、也不预留额度', async () => {
  const { bodies } = await run(() => plainText(), { model: 'gemini-4-argon', thinking: false });
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0]!.generationConfig.thinkingConfig, undefined);
  assert.equal(bodies[0]!.generationConfig.maxOutputTokens, 4000);
});

test('v251 写法阶梯与字段形状', () => {
  assert.deepEqual(thinkingLadder('gemini-4-argon'), ['level', 'plain', 'budget', 'off']);
  assert.deepEqual(thinkingLadder('gemini-3-pro-preview'), ['level', 'plain', 'budget', 'off']);
  assert.deepEqual(thinkingLadder('gemini-2.5-pro'), ['plain', 'budget', 'off']);
  assert.deepEqual(thinkingLadder('gemini-4-argon', false), ['off']);
  assert.deepEqual(thinkingConfigOf('plain'), { includeThoughts: true });
  assert.deepEqual(thinkingConfigOf('level'), { includeThoughts: true, thinkingLevel: 'high' });
  assert.deepEqual(thinkingConfigOf('budget'), { includeThoughts: true, thinkingBudget: -1 });
  assert.equal(thinkingConfigOf('off'), undefined);
  assert.equal(THINKING_TOKEN_RESERVE, 32_768);
});
