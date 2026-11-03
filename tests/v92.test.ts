import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { extractStatePortraits, hydrateStatePortraits, type PortraitStore } from '../src/portraitAssets.ts';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function memoryStore(): PortraitStore {
  const rows = new Map<string, string>();
  let seq = 0;
  return {
    available: () => true,
    put: async blob => {
      const id = `asset-${(seq += 1)}`;
      rows.set(id, `stored:${blob.size}`);
      return id;
    },
    url: async id => (rows.has(id) ? png : undefined),
  };
}

test('v92 落盘前把内联立绘换成资产引用，读档后能原样取回', async () => {
  const store = memoryStore();
  const state = createInitialState();
  const girl = state.girls[0]!;
  const withPortrait = { ...state, girls: state.girls.map(item => (item.id === girl.id ? { ...item, portrait: png, portraitAsset: undefined } : item)) };

  const flat = await extractStatePortraits(withPortrait, store);
  assert.equal(flat.extracted, 1);
  const stripped = flat.state.girls.find(item => item.id === girl.id)!;
  assert.equal(stripped.portrait, '', '存档里不再存图');
  assert.ok(stripped.portraitAsset, '换成资产 id');
  assert.ok(JSON.stringify(flat.state).length < JSON.stringify(withPortrait).length, '存档体积确实变小');

  const hydrated = await hydrateStatePortraits(flat.state, store);
  assert.equal(hydrated.girls.find(item => item.id === girl.id)!.portrait, png, '读档后取回原图');
});

test('v92 没有图的角色原样返回，资产库不可用时也不动状态', async () => {
  const state = createInitialState();
  const memory = memoryStore();
  const untouched = await extractStatePortraits(state, memory);
  assert.equal(untouched.extracted, 0);
  assert.equal(untouched.state, state, '没东西可抽就返回同一个引用');

  const withPortrait = { ...state, girls: state.girls.map(item => ({ ...item, portrait: png })) };
  const offline: PortraitStore = { available: () => false, put: async () => 'x', url: async () => png };
  const skipped = await extractStatePortraits(withPortrait, offline);
  assert.equal(skipped.extracted, 0, '资产库不可用时保持内联，功能不退化');
  assert.equal(skipped.state, withPortrait);
});
