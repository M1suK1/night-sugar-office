import assert from 'node:assert/strict';
import test from 'node:test';
import {
  __resetKvForTests, __setKvWriteFaultForTests, ASSET_GRACE_MS, assetBytes, assetDelete, assetGet, assetKeys,
  assetPut, assetSweep, blobToDataUrl, dataUrlToBlob, kvDelete, kvGet, kvKeys, kvSet, storeAvailable,
} from '../src/store.ts';
import { SAVE_CURRENT_KEY, extractPortraits, migrateLegacyStorage } from '../src/migrate.ts';
import { createInitialState } from '../src/game.ts';

/** 每个用例都从空库开始：内存后端在进程内是共享的。 */
function fresh(): void {
  __resetKvForTests();
}

function withLegacySave(value: string | null): void {
  const globals = globalThis as { localStorage?: Storage };
  const store = new Map<string, string>();
  if (value !== null) store.set('night-sugar-office:v1', value);
  globals.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, next: string) => { store.set(key, String(next)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

const PNG_BYTES = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

test('store：kv 写入、读取、删除与前缀列举', async () => {
  fresh();
  await kvSet('save/current', { day: 3 });
  await kvSet('save/slot/1', { day: 4 });
  await kvSet('meta/migrated', 2);
  assert.deepEqual(await kvGet('save/current'), { day: 3 });
  assert.deepEqual((await kvKeys('save/')).sort(), ['save/current', 'save/slot/1']);
  assert.equal((await kvKeys()).length, 3);
  assert.equal(await kvDelete('save/current'), true);
  assert.equal(await kvDelete('save/current'), false);
  assert.equal(await kvGet('save/current'), undefined);
});

test('store：写不进去时抛错，不会留下半条记录', async () => {
  fresh();
  __setKvWriteFaultForTests(true);
  await assert.rejects(() => kvSet('save/current', { day: 9 }));
  __setKvWriteFaultForTests(false);
  assert.equal(await kvGet('save/current'), undefined);
});

test('store：内存后端可用，所以 node 里不需要假 IndexedDB', () => {
  assert.equal(storeAvailable(), false, 'node 环境没有 indexedDB，走内存后端');
});

test('store：asset 按内容哈希去重，能读回原始字节与 dataURL', async () => {
  fresh();
  const blob = new Blob([PNG_BYTES], { type: 'image/png' });
  const first = await assetPut(blob, { source: 'upload' });
  const second = await assetPut(blob, { source: 'upload' });
  assert.equal(first, second, '同一份字节只存一条');
  assert.deepEqual(await assetKeys(), [first]);
  const stored = await assetGet(first);
  assert.ok(stored);
  assert.equal(stored.meta.bytes, PNG_BYTES.byteLength);
  assert.equal(stored.meta.mime, 'image/png');
  assert.ok(await assetBytes() >= PNG_BYTES.byteLength);
  const dataUrl = await blobToDataUrl(stored.blob);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
  assert.equal(dataUrlToBlob(dataUrl)?.size, PNG_BYTES.byteLength);
  assert.equal(await assetDelete(first), true);
  assert.equal(await assetGet(first), undefined);
});

test('store：assetSweep 只在无人引用且过了宽限期时回收', async () => {
  fresh();
  const keep = await assetPut(new Blob([Buffer.from('keep')], { type: 'image/png' }));
  const recent = await assetPut(new Blob([Buffer.from('recent')], { type: 'image/png' }));
  const old = await assetPut(new Blob([Buffer.from('old')], { type: 'image/png' }));
  // 把 old 的 addedAt 推到宽限期之外。
  const stored = await assetGet(old);
  assert.ok(stored);
  await assetPut(new Blob([Buffer.from('old')], { type: 'image/png' }), { addedAt: Date.now() - ASSET_GRACE_MS - 1000 });
  assert.equal(await assetSweep(new Set([keep])), 1, '只回收那一张过期孤儿');
  assert.deepEqual((await assetKeys()).sort(), [keep, recent].sort());
});

test('store：迁移把旧档搬进 IDB，重复启动不再重搬', async () => {
  fresh();
  const state = createInitialState();
  state.day = 21;
  withLegacySave(JSON.stringify(state));
  const first = await migrateLegacyStorage();
  assert.equal(first.migrated, true);
  const stored = await kvGet<{ day: number }>(SAVE_CURRENT_KEY);
  assert.equal(stored?.day, 21);
  const again = await migrateLegacyStorage();
  assert.equal(again.migrated, false, '打过标记就不再搬');
  assert.equal((await kvKeys('meta/')).length, 1);
});

test('store：没有旧档也会打标记，免得每次启动重扫', async () => {
  fresh();
  withLegacySave(null);
  assert.equal((await migrateLegacyStorage()).migrated, false);
  assert.equal((await kvKeys('meta/')).length, 1);
});

test('store：内联模式不再往 assets 写副本，立绘字节只存一份', async () => {
  fresh();
  const state = createInitialState();
  state.girls[0].portrait = 'data:image/png;base64,iVBORw0KGgo=';
  const result = await extractPortraits(state, { keepInline: true });
  assert.equal(result.assets.length, 0);
  assert.equal(await assetKeys().then(keys => keys.length), 0);
  assert.equal(result.state.girls[0].portrait, state.girls[0].portrait);
});

test('store：切到引用模式时才会抽出 asset 并清掉内联 dataURL', async () => {
  fresh();
  const state = createInitialState();
  const dataUrl = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;
  state.girls[0].portrait = dataUrl;
  const result = await extractPortraits(state, { keepInline: false });
  assert.equal(result.assets.length, 1);
  assert.equal(result.state.girls[0].portrait, '');
  assert.equal(result.state.girls[0].portraitAsset, result.assets[0]);
  assert.ok(await assetGet(result.assets[0]));
});
