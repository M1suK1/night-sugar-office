import test from 'node:test';
import assert from 'node:assert/strict';
import { __resetKvForTests, __resetServerKvForTests, kvGet, kvKeys, kvSet } from '../src/store.ts';

test('v118 本地文件缺 key 时回浏览器兜一次，并补写回文件', async () => {
  const globals = globalThis as { window?: unknown; location?: unknown; fetch?: unknown };
  const previous = { window: globals.window, location: globals.location, fetch: globals.fetch };
  try {
    // ① 没有本地服务时写入（等价于玩家之前留在浏览器里的存档）
    __resetKvForTests();
    await kvSet('save:current', { hello: 'browser' });

    // ② 本地文件通道打开，但文件是空的
    const rows: Record<string, unknown> = {};
    globals.window = {};
    globals.location = { protocol: 'http:' };
    globals.fetch = async (url: string, init?: { method?: string; body?: string }) => {
      if (!init || init.method !== 'POST') {
        return { ok: true, json: async () => ({ ok: true, data: { ...rows } }) } as unknown as Response;
      }
      const body = JSON.parse(String(init.body)) as { key: string; value?: unknown; remove?: boolean };
      if (body.remove) delete rows[body.key];
      else rows[body.key] = body.value;
      return { ok: true, json: async () => ({ ok: true }) } as unknown as Response;
    };
    __resetServerKvForTests();

    // ③ 读：文件里没有 → 从浏览器兜底，并顺手补写回文件
    const got = await kvGet<{ hello: string }>('save:current');
    assert.deepEqual(got, { hello: 'browser' });
    assert.deepEqual(rows['save:current'], { hello: 'browser' }, '读到的旧档会补写进本地文件');

    // ④ 写入后文件里有，浏览器也有镜像
    await kvSet('save:current', { hello: 'file' });
    assert.deepEqual(rows['save:current'], { hello: 'file' });
    assert.deepEqual(await kvGet('save:current'), { hello: 'file' });
    assert.ok((await kvKeys('save:')).includes('save:current'));
  } finally {
    globals.window = previous.window;
    globals.location = previous.location;
    globals.fetch = previous.fetch;
    __resetServerKvForTests();
    __resetKvForTests();
  }
});
