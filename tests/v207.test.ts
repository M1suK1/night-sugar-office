import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';
import { createInitialState } from '../src/game.ts';

/**
 * v207：契约卡坏立绘容错。
 * 主立绘不可持久化时丢图并回退到差分，不整卡失败；导出时也不写 blob:。
 */

const VARIANT = 'data:image/webp;base64,' + 'A'.repeat(120);

function card(extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    format: 'night-sugar/girl-card', version: 1, exportedAt: '2026-01-01T00:00:00.000Z', sourceDay: 1,
    girl: {
      name: '容错卡', codename: 'T-1', title: '测试卡', element: '星光系', color: '#8fd3c7', level: 3,
      stats: { magic: 60, insight: 60, agility: 60, empathy: 80 },
      skillIds: ['glimmer-spear', 'night-prayer', 'moon-phase'], traitIds: [], factionTag: 'none',
      ...extra,
    },
  });
}

test('v207 主立绘是 blob 时导入不失败，回退到 calm 差分', () => {
  const parsed = parseGirlCard(card({
    portrait: 'blob:http://127.0.0.1:5173/deadbeef',
    portraitSpec: { zoom: 1, x: 0.5, y: 0.5 },
    importedVariants: { 'custom:calm': VARIANT, 'custom:smile': VARIANT },
  }));
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
  if (!parsed.ok) return;
  assert.equal(parsed.card.girl.portrait, VARIANT);
  assert.equal(parsed.card.girl.portraitSpec, undefined, '回退图不能沿用原图取景');
  assert.deepEqual(Object.keys(parsed.card.girl.importedVariants ?? {}), ['custom:smile'], '回退用的 calm 差分不再重复存一份');
});

test('v207 主图与 calm 差分相同时只留主图', () => {
  const parsed = parseGirlCard(card({
    portrait: VARIANT,
    importedVariants: { 'custom:calm': VARIANT, 'custom:smile': VARIANT },
  }));
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
  if (!parsed.ok) return;
  assert.equal(parsed.card.girl.portrait, VARIANT);
  assert.deepEqual(Object.keys(parsed.card.girl.importedVariants ?? {}), ['custom:smile']);
});

test('v207 没有可用主图和差分时，卡片仍可导入，立绘留空', () => {
  const parsed = parseGirlCard(card({
    portrait: 'http://example.com/dead.png',
    importedVariants: { 'custom:calm': 'blob:http://127.0.0.1:5173/nope' },
  }));
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
  if (!parsed.ok) return;
  assert.equal(parsed.card.girl.portrait, undefined);
  assert.deepEqual(parsed.card.girl.importedVariants, {});
});

test('v207 衣柜与魔女化的坏立绘只丢图，不拖累整卡', () => {
  const parsed = parseGirlCard(card({
    portrait: VARIANT,
    wardrobe: [{ id: 'uniform', name: '值夜制服', portrait: 'blob:http://127.0.0.1:5173/outfit' }],
    witchForm: { name: '夜之形', portrait: 'blob:http://127.0.0.1:5173/witch' },
  }));
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
  if (!parsed.ok) return;
  assert.equal(parsed.card.girl.portrait, VARIANT);
  assert.equal(parsed.card.girl.wardrobe?.[0]?.portrait, undefined);
  assert.equal(parsed.card.girl.witchForm?.portrait, undefined);
  assert.equal(parsed.card.girl.witchForm?.name, '夜之形');
});

test('v207 导出时剥掉 blob，并在主图失效时用差分补位', () => {
  const state = createInitialState();
  const girl = {
    ...state.girls[0]!,
    portrait: 'blob:http://127.0.0.1:5173/export',
    importedVariants: { 'custom:calm': VARIANT },
    wardrobe: [{ id: 'uniform', name: '值夜制服', portrait: 'blob:http://127.0.0.1:5173/wardrobe' }],
    witchForm: { id: 'witchform', form: 'witch', name: '夜之形', description: '', palette: [], layerKey: 'witch', portrait: 'blob:http://127.0.0.1:5173/witch' },
  };
  const exported = buildGirlCard(girl as typeof state.girls[number], { day: 1 });
  assert.equal(exported.girl.portrait, VARIANT);
  assert.equal(exported.girl.wardrobe?.[0]?.portrait, undefined);
  assert.equal(exported.girl.witchForm?.portrait, undefined);
  assert.equal(exported.girl.importedVariants, undefined, '主图已经用了这张图，calm 差分不再重复写进卡里');
});
