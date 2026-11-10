import test from 'node:test';
import assert from 'node:assert/strict';
import { items } from '../src/content/items.ts';
import { getItem } from '../src/content/items.ts';
import type { Equipment } from '../src/types.ts';

/** v241：老版本装备按阶级上修——旧资产不能比低一阶的成品还差。 */

const score = (item: Equipment) => {
  const stats = Object.values(item.stats ?? {}).reduce((sum, value) => sum + value, 0);
  return stats
    + (item.damageBonus ?? 0) * 0.5
    + (item.initiativeBonus ?? 0) * 1.5
    + (item.maxHpBonus ?? 0) * 0.25
    + (item.spiritBonusPct ?? 0) * 0.4;
};

const FLOOR: Record<number, number> = { 1: 4, 2: 8, 3: 14, 4: 19, 5: 34 };

test('v241 老版本装备都达到本阶的下限', () => {
  const legacy = items.filter(item => (item.slot === 'weapon' || item.slot === 'charm') && !/^t[1-5]-/.test(item.id));
  assert.ok(legacy.length >= 7, '至少要覆盖那几条旧资产');
  for (const item of legacy) {
    const tier = item.tier ?? 1;
    const floor = FLOOR[tier] ?? 0;
    assert.ok(score(item) >= floor, `${item.name}（${item.id}，T${tier}）只有 ${score(item)}，低于 T${tier} 的下限 ${floor}`);
  }
});

test('v241 四阶旧法器不再低于三阶同套装武器', () => {
  const legacy = getItem('moon-weapon')!;
  const current = getItem('t3-witch-eclipse-staff')!;
  assert.equal(legacy.tier, 4);
  assert.ok(score(legacy) > score(current), `${score(legacy)} 应高于 ${score(current)}`);
  assert.ok((legacy.damageBonus ?? 0) >= (current.damageBonus ?? 0), '伤害加成也不能更低');
});

test('v241 夜祷指环保留第四技能，同时补上基础属性', () => {
  const ring = getItem('night-ring')!;
  assert.equal(ring.skillId, 'night-prayer');
  assert.ok(score(ring) >= FLOOR[4]!, '不能只靠技能撑门面');
});
