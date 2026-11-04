import test from 'node:test';
import assert from 'node:assert/strict';
import { persistLlmLog, postLlmLog, setLlmLogSink } from '../src/llmLog.ts';

const entry = {
  scope: '每日提案', labels: ['每日提案'], model: 'm', ok: true, finish: 'stop',
  messages: [{ role: 'system', content: '系统' }, { role: 'user', content: '请求' }],
  response: '{"ok":true}',
};

test('v112 只有挂了落盘槽才会记录：测试与静态部署不受影响', () => {
  const seen: unknown[] = [];
  setLlmLogSink(item => seen.push(item));
  persistLlmLog(entry);
  setLlmLogSink(null);
  persistLlmLog(entry);
  assert.equal(seen.length, 1, '摘掉槽之后不再记录');
});

test('v112 真正的写盘实现会 POST 到本地接口，带当天日期与整行 JSON', async () => {
  const calls: { url: string; body: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { body?: string }) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') });
    return { ok: true } as unknown as Response;
  }) as unknown as typeof fetch;
  try {
    postLlmLog(entry);
    await Promise.resolve();
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, '/api/logs');
  const body = JSON.parse(calls[0]!.body) as { day: string; text: string };
  assert.match(body.day, /^\d{4}-\d{2}-\d{2}$/);
  const record = JSON.parse(body.text) as { scope: string; messages: { role: string }[]; response: string };
  assert.equal(record.scope, '每日提案');
  assert.equal(record.messages.length, 2);
  assert.equal(record.response, '{"ok":true}');
});

test('v112 接口失败时不抛错', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  try {
    assert.doesNotThrow(() => postLlmLog(entry));
    await Promise.resolve();
  } finally {
    globalThis.fetch = original;
  }
});
