import test from 'node:test';
import assert from 'node:assert/strict';
import { contractCost } from '../src/rules/roster.ts';
import { EQUIPMENT_PRICE_SCALE, factionPrice } from '../src/economy.ts';
import { EXPEDITION_EXP_PER_HOUR, EXPEDITION_GOLD_PER_HOUR } from '../src/rules/time.ts';
import type { Equipment } from '../src/types.ts';

test('v91 缔约价格落在 1000 上下，等级与四维越高越贵', () => {
  const typical = contractCost(5, 260);
  assert.ok(typical >= 900 && typical <= 1100, `五级、四维 260 应该是千元左右，实际 ${typical}`);
  assert.ok(contractCost(6, 300) > typical);
  assert.ok(contractCost(3, 240) < typical);
  assert.ok(contractCost(1, 0) >= 300, '最低也有兜底价');
  assert.ok(contractCost(10, 480) <= 2000, '上限封顶');
});

test('v91 装备整体打七五折', () => {
  const item = { id: 'x', name: 'x', faction: 'association', slot: 'weapon', price: 1000, standingReq: 0, description: '' } as Equipment;
  assert.equal(EQUIPMENT_PRICE_SCALE, 0.75);
  assert.equal(factionPrice(item, 50), 750, '中立声望按标价 75%');
  assert.equal(factionPrice(item, 90), 675, '盟约再 −10%');
  assert.equal(factionPrice(item, 10), 825, '戒备 +10%');
});

test('v91 星象台每人每小时 300 星砂、10 点经验', () => {
  assert.equal(EXPEDITION_GOLD_PER_HOUR, 300);
  assert.equal(EXPEDITION_EXP_PER_HOUR, 10);
});
