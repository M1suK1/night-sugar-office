import test from 'node:test';
import assert from 'node:assert/strict';
import { __resetKvForTests, __resetServerKvForTests, kvGet, kvKeys, kvSet } from '../src/store.ts';

test('v119 分片协议：只取需要的 key，旧档只在浏览器里时能读回来并回填', async () => {
  const globals = globalThis as { window?: unknown; location?: unknown; fetch?: unknown };
  const previous = { window: globals.window, location: globals.location, fetch: globals.fetch };
  try {
    // ① 没有本地服务时写入（等价于玩家之前留在浏览器里的存档）
    __resetKvForTests();
    await kvSet('save:current', { hello: 'browser' });

    // ② 本地文件通道打开，但文件是空的（分片索引里没有这个 key）
    const rows = new Map<string, unknown>();
    const requests: string[] = [];
    globals.window = {};
    globals.location = { protocol: 'http:' };
    globals.fetch = async (url: string, init?: { method?: string; body?: string }) => {
      requests.push(String(url));
      const parsed = new URL(String(url), 'http://127.0.0.1');
      if (!init || init.method !== 'POST') {
        if (parsed.searchParams.get('keys')) {
          return { ok: true, json: async () => ({ ok: true, keys: [...rows.keys()] }) } as unknown as Response;
        }
        const key = parsed.searchParams.get('key') ?? '';
        return {
          ok: true,
          json: async () => (rows.has(key) ? { ok: true, found: true, value: rows.get(key) } : { ok: true, found: false }),
        } as unknown as Response;
      }
      const body = JSON.parse(String(init.body)) as { key: string; value?: unknown; remove?: boolean };
      if (body.remove) rows.delete(body.key);
      else rows.set(body.key, body.value);
      return { ok: true, json: async () => ({ ok: true }) } as unknown as Response;
    };
    __resetServerKvForTests();

    // ③ 读：文件里没有 → 从浏览器兜底，并顺手补写回文件
    const got = await kvGet<{ hello: string }>('save:current');
    assert.deepEqual(got, { hello: 'browser' });
    assert.deepEqual(rows.get('save:current'), { hello: 'browser' }, '读到的旧档会补写进本地文件');

    // ④ 写入后文件里有，浏览器也有镜像；keys 是两边并集
    await kvSet('save:current', { hello: 'file' });
    assert.deepEqual(rows.get('save:current'), { hello: 'file' });
    assert.deepEqual(await kvGet('save:current'), { hello: 'file' });
    assert.ok((await kvKeys('save:')).includes('save:current'));

    // ⑤ 第二次读走缓存，不再重复请求同一个 key
    const before = requests.filter(url => url.includes('save%3Acurrent')).length;
    await kvGet('save:current');
    const after = requests.filter(url => url.includes('save%3Acurrent')).length;
    assert.equal(after, before, '命中缓存后不再打网络');
  } finally {
    globals.window = previous.window;
    globals.location = previous.location;
    globals.fetch = previous.fetch;
    __resetServerKvForTests();
    __resetKvForTests();
  }
});
