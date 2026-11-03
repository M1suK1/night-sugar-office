import test from 'node:test';
import assert from 'node:assert/strict';
import { itemEffectSummary, itemStatLines } from '../src/itemStats.ts';
import { validGeneratedItem } from '../src/rules/validate.ts';
import type { Equipment } from '../src/types.ts';

const wand: Equipment = {
  id: 'lm_item_test', name: '夜行法器', faction: 'association', slot: 'weapon',
  price: 900, standingReq: 10, description: '刻着旧协会的纹章。',
  stats: { magic: 6, insight: 0, agility: -2, empathy: 2 },
  maxHpBonus: 12, spiritBonusPct: 8, damageBonus: 10, initiativeBonus: 2,
  passive: '夜里第一击更稳。', skillId: 'glimmer-spear', corruptionPerBattle: 1,
};

test('v80 装备数值：先数字后被动，零值不显示', () => {
  const lines = itemStatLines(wand);
  assert.deepEqual(lines.map(line => line.label), ['魔力', '敏捷', '共情', '生命上限', '心防上限', '伤害', '先手', '每战侵蚀', '附带技能']);
  assert.equal(lines[0]!.value, '+6');
  assert.equal(lines[1]!.value, '-2');
  assert.equal(lines[1]!.tone, 'bad');
  assert.equal(lines[4]!.value, '+8%');
  assert.equal(lines[7]!.tone, 'bad', '每战侵蚀是代价，标红');
  assert.equal(lines[8]!.value, '星屑穿刺');
});

test('v80 装备摘要：最多三行，没数值就是空串', () => {
  const summary = itemEffectSummary(wand);
  assert.ok(summary.startsWith('魔力 +6 · 敏捷 -2 · 共情 +2'), summary);
  assert.ok(summary.endsWith('…'), '超出三行要省略');
  const plain: Equipment = { id: 'lm_item_x', name: '旧护符', faction: 'witch', slot: 'charm', price: 10, standingReq: 0, description: '没有数值。', passive: '据说能带来好运。' };
  assert.equal(itemEffectSummary(plain), '');
});

test('v80 生成装备必须至少带一项数值或效果', () => {
  assert.equal(validGeneratedItem(wand), true);
  const empty = { id: 'lm_item_empty', name: '空壳', faction: 'government', slot: 'charm', price: 100, standingReq: 0, description: '只是好看。' };
  assert.equal(validGeneratedItem(empty), false, '没有数值也没有被动/效果的装备卖不出去');
  assert.equal(validGeneratedItem({ ...empty, passive: '夜里会微微发亮。' }), true);
  assert.equal(validGeneratedItem({ ...empty, stats: { magic: 3 } }), true);
});
