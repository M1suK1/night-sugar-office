import test from 'node:test';
import assert from 'node:assert/strict';
import { affixFact, equipmentFacts, equipmentSetOf, equipmentTierLabel } from '../src/equipmentFacts.ts';
import type { Equipment } from '../src/types.ts';

const gear = (patch: Partial<Equipment> = {}): Equipment => ({
  id: 'g1', name: '折月灯罩', faction: 'witch', slot: 'charm', price: 900, standingReq: 0, description: '',
  stats: { insight: 4, magic: 2 }, ...patch,
});

test('v196 基础加成按属性名与正号列出', () => {
  const facts = equipmentFacts(gear({ maxHpBonus: 12, spiritBonusPct: 8, damageBonus: 5, initiativeBonus: 3 }));
  assert.deepEqual(facts.map(fact => fact.label), ['洞察', '魔力', '生命', '心防', '增伤', '先手']);
  assert.deepEqual(facts.map(fact => fact.value), ['+4', '+2', '+12', '+8%', '+5%', '+3']);
  assert.deepEqual(equipmentFacts(gear({ stats: undefined })), []);
});

test('v196 词条：数值型写 +n，百分比型写 +n%', () => {
  assert.deepEqual(
    affixFact({ id: 'a1', name: '锋锐 II', kind: 'magic', tier: 2, amount: 4, description: '' }),
    { name: '锋锐 II', detail: '魔力 +4' },
  );
  assert.deepEqual(
    affixFact({ id: 'a2', name: '坚毅 III', kind: 'damageReduce', tier: 3, amount: 7, description: '' }),
    { name: '坚毅 III', detail: '减伤 +7%' },
  );
});

test('v196 槽位与阶级写成中文', () => {
  assert.equal(equipmentTierLabel(gear({ slot: 'weapon', tier: 3 })), '法器 · 三阶');
  assert.equal(equipmentTierLabel(gear({ slot: 'charm', tier: 1 })), '护符 · 一阶');
  assert.equal(equipmentTierLabel(gear({ slot: 'consumable', tier: 5 })), '物资 · 五阶');
});

test('v196 认得出的套装返回套装信息，认不出的返回 undefined', () => {
  assert.equal(equipmentSetOf(gear({ setId: 'set-starlight' as never }))?.name, '星辉套装');
  assert.equal(equipmentSetOf(gear({ setId: 'set-unknown' as never })), undefined);
  assert.equal(equipmentSetOf(gear()), undefined);
});
