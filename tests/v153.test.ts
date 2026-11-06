import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { extractStatePortraits, hydrateStatePortraits, type PortraitStore } from '../src/portraitAssets.ts';

const d1 = 'data:image/png;base64,variant-one';
const d2 = 'data:image/webp;base64,variant-two';

function memoryStore(options: { failPut?: boolean } = {}): PortraitStore & { puts: () => number } {
  const rows = new Map<string, string>();
  let seq = 0;
  let puts = 0;
  return {
    available: () => true,
    put: async blob => {
      if (options.failPut) throw new Error('asset put failed');
      puts += 1;
      const id = 'asset-' + (seq += 1);
      rows.set(id, String(blob.size));
      return id;
    },
    url: async id => (rows.has(id) ? 'blob:restored-' + id : undefined),
    dataUrl: async id => (rows.has(id) ? 'data:image/png;base64,restored-' + id : undefined),
    puts: () => puts,
  };
}

function withVariants(variants: Record<string, string>) {
  const state = createInitialState();
  const girl = state.girls[0]!;
  return {
    state: { ...state, girls: state.girls.map(item => (item.id === girl.id ? { ...item, importedVariants: variants } : item)) },
    girlId: girl.id,
  };
}

test('v153 落盘把差分换成资产 id，存档里不再有 data URL，读档后原样取回', async () => {
  const store = memoryStore();
  const { state, girlId } = withVariants({ 'outfit:calm': d1, 'outfit:smile': d2 });

  const flat = await extractStatePortraits(state, store);
  const saved = flat.state.girls.find(item => item.id === girlId)!;
  assert.deepEqual(Object.keys(saved.variantAssets ?? {}).sort(), ['outfit:calm', 'outfit:smile']);
  assert.equal(saved.importedVariants, undefined, '存档里不再背内联差分');
  assert.ok(JSON.stringify(flat.state).length < JSON.stringify(state).length, '存档体积确实变小');

  const hydrated = await hydrateStatePortraits(flat.state, store);
  const back = hydrated.girls.find(item => item.id === girlId)!;
  assert.ok(back.importedVariants?.['outfit:calm']?.startsWith('data:image/'), '读档后取回差分');
  assert.ok(back.importedVariants?.['outfit:smile']?.startsWith('data:image/'));
  assert.notEqual(back.importedVariants?.['outfit:calm'], back.importedVariants?.['outfit:smile'], '两张图各自取回');
});

test('v153 非 data URL 的差分原样留在存档里', async () => {
  const store = memoryStore();
  const { state, girlId } = withVariants({ 'outfit:calm': 'https://example.test/a.png' });
  const flat = await extractStatePortraits(state, store);
  const saved = flat.state.girls.find(item => item.id === girlId)!;
  assert.equal(saved.importedVariants?.['outfit:calm'], 'https://example.test/a.png');
  assert.equal(saved.variantAssets, undefined);
});

test('v153 资产库写失败时保留内联差分，不阻断保存', async () => {
  const store = memoryStore({ failPut: true });
  const { state, girlId } = withVariants({ 'outfit:calm': d1 });
  const flat = await extractStatePortraits(state, store);
  const saved = flat.state.girls.find(item => item.id === girlId)!;
  assert.equal(saved.importedVariants?.['outfit:calm'], d1, '写不进去就留着，不能让整次存档失败');
  assert.equal(saved.variantAssets, undefined);
});

test('v153 同一张差分第二次落盘不再重复写入资产库', async () => {
  const store = memoryStore();
  const { state } = withVariants({ 'outfit:calm': d1 });
  await extractStatePortraits(state, store);
  const first = store.puts();
  await extractStatePortraits(state, store);
  assert.equal(store.puts(), first, '第二次命中内容指纹，不再 put');
});

test('v153 没有差分的角色返回同一个引用，不额外克隆', async () => {
  const store = memoryStore();
  const state = createInitialState();
  const flat = await extractStatePortraits(state, store);
  assert.equal(flat.state, state);
  assert.equal(flat.extracted, 0);
});
