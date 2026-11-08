import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { extractStatePortraits, hydrateStatePortraits, type PortraitStore } from '../src/portraitAssets.ts';
import type { GameState } from '../src/types.ts';

/**
 * v199：读档还原出来的图只活在当前页面会话（blob:），
 * 不能让它被下一次自动存档写回档里——否则再启动就是破图。
 */
const IMAGE = 'data:image/png;base64,' + 'A'.repeat(2000);
const OTHER = 'data:image/png;base64,' + 'B'.repeat(2000);

function memoryStore(): PortraitStore {
  const ids = new Map<string, string>();
  return {
    available: () => true,
    put: async blob => {
      const key = 'len:' + blob.size;
      if (!ids.has(key)) ids.set(key, 'asset-' + ids.size);
      return ids.get(key)!;
    },
    url: async id => 'blob:' + id,
    dataUrl: async id => 'data:image/webp;base64,' + id,
  };
}

function withGirls(build: (state: GameState) => void): GameState {
  const state = createInitialState();
  build(state);
  return state;
}

test('v199 读档还原后再次落盘：不能再把 blob 链接写进存档', async () => {
  const store = memoryStore();
  const state = withGirls(next => { next.girls[0]!.portrait = IMAGE; });
  const flat = (await extractStatePortraits(state, store)).state;
  assert.equal(flat.girls[0]!.portrait, '');
  assert.ok(flat.girls[0]!.portraitAsset);

  const hydrated = await hydrateStatePortraits(flat, store);
  assert.ok(hydrated.girls[0]!.portrait.startsWith('blob:'), '还原出来的应当是可用地址');

  const resaved = (await extractStatePortraits(hydrated, store)).state;
  assert.equal(resaved.girls[0]!.portrait, '', '第二次落盘必须只留 asset 引用');
  assert.equal(resaved.girls[0]!.portraitAsset, flat.girls[0]!.portraitAsset);

  const again = await hydrateStatePortraits(resaved, store);
  assert.equal(again.girls[0]!.portrait, 'blob:' + flat.girls[0]!.portraitAsset, '再启动仍能取回图');
});

test('v199 已经被写坏的老档：读档时重新取回，不保留死链接', async () => {
  const store = memoryStore();
  const state = withGirls(next => {
    next.girls[0]!.portrait = 'blob:http://127.0.0.1:5173/dead-session';
    next.girls[0]!.portraitAsset = 'asset-old';
  });
  const hydrated = await hydrateStatePortraits(state, store);
  assert.equal(hydrated.girls[0]!.portrait, 'blob:asset-old');
});

test('v199 衣柜与魔女化立绘同样只留 asset 引用', async () => {
  const store = memoryStore();
  const state = withGirls(next => {
    next.girls[0]!.wardrobe = [{ id: 'o1', name: '夜行', description: '', palette: [], layerKey: 'x', portrait: IMAGE }];
    next.girls[0]!.witchForm = { id: 'witchform', name: '魔女', description: '', palette: [], layerKey: 'x', portrait: IMAGE };
  });
  const flat = (await extractStatePortraits(state, store)).state;
  assert.equal(flat.girls[0]!.wardrobe?.[0]?.portrait, '');
  assert.ok(flat.girls[0]!.wardrobe?.[0]?.portraitAsset);
  assert.equal(flat.girls[0]!.witchForm?.portrait, '');

  const hydrated = await hydrateStatePortraits(flat, store);
  // 衣柜走 dataUrl 回填（导出要用内联图），首领走 url；只要「能拿到图」即可。
  assert.ok(hydrated.girls[0]!.wardrobe?.[0]?.portrait);

  const resaved = (await extractStatePortraits(hydrated, store)).state;
  assert.equal(resaved.girls[0]!.wardrobe?.[0]?.portrait, '');
  assert.equal(resaved.girls[0]!.witchForm?.portrait, '');

  const again = await hydrateStatePortraits(resaved, store);
  assert.ok(again.girls[0]!.wardrobe?.[0]?.portrait);
});

test('v199 三方首领与随从：blob 链接同样不进存档', async () => {
  const store = memoryStore();
  const base = createInitialState();
  const leader = base.customFactionLeaders?.[0] ?? ({ id: 'l1', faction: 'witch', name: '首领', title: '', color: '#fff', quote: '', note: '', level: 1, stats: { magic: 1, insight: 1, agility: 1, empathy: 1 }, skillIds: [], archetype: '输出', origin: 'witch', titles: { witch: '', association: '', government: '' } } as never);
  const state = { ...base, customFactionLeaders: [{ ...leader, portrait: IMAGE }] } as GameState;
  const flat = (await extractStatePortraits(state, store)).state;
  assert.equal(flat.customFactionLeaders?.[0]?.portrait, '');
  const hydrated = await hydrateStatePortraits(flat, store);
  assert.ok(hydrated.customFactionLeaders?.[0]?.portrait);
  const resaved = (await extractStatePortraits(hydrated, store)).state;
  assert.equal(resaved.customFactionLeaders?.[0]?.portrait, '');
});

test('v199 没有 asset 的 blob 链接：清掉，别让界面去加载一个死地址', async () => {
  const store = memoryStore();
  const state = withGirls(next => { next.girls[0]!.portrait = 'blob:http://127.0.0.1:5173/orphan'; });
  const flat = (await extractStatePortraits(state, store)).state;
  assert.equal(flat.girls[0]!.portrait, '');
});

test('v199 内联新图优先：有旧 asset 时也要换成新图，而不是清空留着旧图', async () => {
  const store = memoryStore();
  const state = withGirls(next => {
    next.girls[0]!.portraitAsset = 'asset-old';
    next.girls[0]!.portrait = OTHER;
  });
  const flat = (await extractStatePortraits(state, store)).state;
  assert.equal(flat.girls[0]!.portrait, '');
  assert.notEqual(flat.girls[0]!.portraitAsset, 'asset-old');
  assert.equal((await hydrateStatePortraits(flat, store)).girls[0]!.portrait, 'blob:' + flat.girls[0]!.portraitAsset);
});
