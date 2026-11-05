import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { __resetKvForTests, kvGet } from '../src/store.ts';
import { readSlot, slotKey, writeSlot } from '../src/saves.ts';
import type { PortraitStore } from '../src/portraitAssets.ts';

/** 内存版资产库：put 返回稳定 id，url 能取回同一张图。 */
function memoryStore(): PortraitStore & { saved: Map<string, string> } {
  const saved = new Map<string, string>();
  return {
    saved,
    available: () => true,
    async put() {
      const id = `asset-${saved.size + 1}`;
      saved.set(id, 'data:image/png;base64,AAAA');
      return id;
    },
    async url(id) {
      return saved.get(id);
    },
  };
}

test('v120 存档位落盘前把立绘换成资产引用，体积大幅变小且读得回来', async () => {
  __resetKvForTests();
  const state = createInitialState();
  const big = `data:image/png;base64,${'A'.repeat(400_000)}`;
  state.girls = state.girls.map((girl, index) => (index === 0 ? { ...girl, portrait: big } : girl));

  const store = memoryStore();
  const written = await writeSlot(1, state, store);
  assert.equal(written.ok, true);
  assert.deepEqual([...store.saved.keys()].length, 1, '立绘被搬进了资产库');

  const payload = await kvGet<{ state: { girls: { portrait: string; portraitAsset?: string }[] } }>(slotKey(1));
  assert.ok(payload, '槽位应该写进去了');
  const savedGirl = payload!.state.girls[0]!;
  assert.equal(savedGirl.portrait, '', '槽位里不再内联 data URL');
  assert.equal(savedGirl.portraitAsset, 'asset-1');
  const bytes = JSON.stringify(payload).length;
  assert.ok(bytes < 40_000, `槽位应该只有几十 KB，实际 ${bytes} 字节`);

  const loaded = await readSlot(1, store);
  assert.ok(loaded, '读档要成功');
  assert.equal(loaded!.girls[0]!.portrait, 'data:image/png;base64,AAAA', '立绘按引用取回来了');
  assert.equal(loaded!.day, state.day, '进度不受影响');
});

test('v120 资产库不可用时槽位照旧可存可读（只是不省空间）', async () => {
  __resetKvForTests();
  const state = createInitialState();
  const missing: PortraitStore = { available: () => false, put: async () => 'x', url: async () => undefined };
  const written = await writeSlot(2, state, missing);
  assert.equal(written.ok, true);
  const loaded = await readSlot(2, missing);
  assert.ok(loaded, '没有资产库也要能读回来');
  assert.equal(loaded!.day, state.day);
});
