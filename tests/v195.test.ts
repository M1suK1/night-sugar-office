import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { extractStatePortraits, hydrateStatePortraits, type PortraitStore } from '../src/portraitAssets.ts';
import type { BattleState, GameState } from '../src/types.ts';

const IMAGE = 'data:image/png;base64,' + 'A'.repeat(4000);

function memoryStore(): PortraitStore & { puts: string[] } {
  const puts: string[] = [];
  const ids = new Map<string, string>();
  return {
    puts,
    available: () => true,
    put: async blob => {
      const key = 'len:' + blob.size;
      puts.push(key);
      if (!ids.has(key)) ids.set(key, 'asset-' + ids.size);
      return ids.get(key)!;
    },
    url: async id => 'blob:' + id,
    dataUrl: async id => 'data:image/webp;base64,' + id,
  };
}

function fatState(): GameState {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.wardrobe = [{ id: 'o1', name: '夜行', description: '', palette: [], layerKey: 'x', portrait: IMAGE }];
  girl.witchForm = { id: 'witchform', name: '魔女', description: '', palette: [], layerKey: 'x', portrait: IMAGE };
  state.customFactionLeaders = [{ ...(state.customFactionLeaders?.[0] ?? {}), id: 'l1', faction: 'witch', name: '首领', title: '', portrait: IMAGE, color: '#fff', quote: '', note: '', level: 1, stats: { magic: 1, insight: 1, agility: 1, empathy: 1 }, skillIds: [], archetype: '输出', origin: 'witch', titles: { witch: '', association: '', government: '' } } as never];
  const units = girl.wardrobe.map((_, index) => ({
    uid: 'ally-' + index, side: 'ally' as const, name: girl.name, portrait: IMAGE, color: '#fff',
    hp: 10, maxHp: 10, spirit: 10, maxSpirit: 10, stats: { magic: 1, insight: 1, agility: 1, empathy: 1 }, skills: [], cooldown: {}, effects: [], down: false, insightRoll: 0, scarHit: 0, dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
  }));
  state.battles = [{
    id: 'b1', missionId: 'm1', missionTitle: 'x', seed: 1, startedAt: { day: 1, minutes: 1200 }, round: 3, rounds: 3,
    units, initiative: [], events: [], createdAt: '', outcome: 'victory',
    frames: [0, 1, 2, 3].map(round => ({ round, units: units.map(unit => ({ ...unit })), initiative: [] })),
  } as BattleState];
  return state;
}

test('v195 衣柜、魔女化、势力人物与战报里的 data URL 全部搬进资产', async () => {
  const state = fatState();
  const before = JSON.stringify(state).length;
  const store = memoryStore();
  const result = await extractStatePortraits(state, store);
  const after = JSON.stringify(result.state).length;
  assert.ok(before > 40_000, String(before));
  assert.ok(after < before * 0.6, `应当明显缩小：${before} → ${after}`);
  assert.equal(JSON.stringify(result.state).includes('data:image'), false, '存档里不该再有内联图');
  assert.equal(result.state.girls[0]!.wardrobe![0]!.portraitAsset !== undefined, true);
  assert.equal(result.state.girls[0]!.witchForm!.portraitAsset !== undefined, true);
  assert.equal(result.state.customFactionLeaders![0]!.portraitAsset !== undefined, true);
  assert.equal(result.state.battles[0]!.units[0]!.portrait, '');
  assert.equal(result.state.battles[0]!.frames![0]!.units[0]!.portraitAsset !== undefined, true);
});

test('v195 同一张图只写一次资产库', async () => {
  const store = memoryStore();
  await extractStatePortraits(fatState(), store);
  assert.equal(store.puts.length, 1, '四帧同图不该写四遍');
});

test('v195 读档把资产引用还原成界面能用的立绘', async () => {
  const store = memoryStore();
  const saved = (await extractStatePortraits(fatState(), store)).state;
  const loaded = await hydrateStatePortraits(saved, store);
  assert.ok(loaded.girls[0]!.wardrobe![0]!.portrait.startsWith('data:image/webp'));
  assert.ok(loaded.girls[0]!.witchForm!.portrait.startsWith('data:image/webp'));
  assert.ok(loaded.customFactionLeaders![0]!.portrait.startsWith('data:image/webp'));
});

test('v195 没有内联图时原样返回，不做无谓的写库', async () => {
  const state = createInitialState();
  const store = memoryStore();
  const result = await extractStatePortraits(state, store);
  assert.equal(result.state, state);
  assert.equal(result.extracted, 0);
  assert.equal(store.puts.length, 0);
});
