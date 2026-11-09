import test from 'node:test';
import assert from 'node:assert/strict';
import { baseItems, findItem } from '../src/content/items.ts';
import { equipmentFacts } from '../src/equipmentFacts.ts';

test('v226 基础装备的增伤按百分点存放', () => {
  const geared = baseItems.filter(item => typeof item.damageBonus === 'number' && item.damageBonus > 0);
  assert.ok(geared.length >= 9, '内置带增伤的装备应有 9 件');
  for (const item of geared) {
    assert.ok(Number.isInteger(item.damageBonus), `${item.name} 的增伤是小数：${item.damageBonus}`);
    assert.ok(item.damageBonus! >= 1, `${item.name} 的增伤小于 1：${item.damageBonus}`);
  }
});

test('v226 裁决器械显示 +6%，不是 +0.06%', () => {
  const item = findItem('t4-gov-verdict');
  assert.ok(item);
  assert.equal(item!.damageBonus, 6);
  const bonus = equipmentFacts(item!).find(fact => fact.label === '增伤');
  assert.equal(bonus?.value, '+6%');
});
