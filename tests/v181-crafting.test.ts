import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { act } from '../src/game.ts';
import { craftOdds, craftGoldCost, executeCraft } from '../src/crafting.ts';
import { findMaterial } from '../src/content/materials.ts';
import { findEquipmentSet } from '../src/content/sets.ts';

test('v181 炼制概率：材料投入量决定阶级概率，少料低阶，多料高阶', () => {
  // 投入 2 份材料：低阶主导，不出 T3/T4/T5
  const lowOdds = craftOdds({ 'mat-stardust': 2 });
  assert.equal(lowOdds.ok, true);
  if (!lowOdds.ok) return;
  assert.ok(lowOdds.tierOdds[1] >= 0.7);
  assert.ok(lowOdds.tierOdds[2] > 0);
  assert.equal(lowOdds.tierOdds[3], 0);
  assert.equal(lowOdds.tierOdds[4], 0);
  assert.equal(lowOdds.tierOdds[5], 0);

  // 投入 20 份材料：高阶保底，高概率 T4/T5
  const highOdds = craftOdds({ 'mat-stardust': 10, 'mat-cinder': 10 });
  assert.equal(highOdds.ok, true);
  if (!highOdds.ok) return;
  assert.equal(highOdds.tierOdds[1], 0);
  assert.equal(highOdds.tierOdds[2], 0);
  assert.ok(highOdds.tierOdds[3] > 0);
  assert.ok(highOdds.tierOdds[4] >= 0.5);
  assert.ok(highOdds.tierOdds[5] >= 0.2);
});

test('v181 混合材料比例：套装概率完全由投入材料的相对比例决定', () => {
  // 6 份星屑 + 4 份余火种 = 60% 星辉套装 + 40% 焚烬套装
  const odds = craftOdds({ 'mat-stardust': 6, 'mat-cinder': 4 });
  assert.equal(odds.ok, true);
  if (!odds.ok) return;
  assert.equal(odds.setOdds['set-starlight'], 0.6);
  assert.equal(odds.setOdds['set-cinder'], 0.4);
  assert.equal(odds.setOdds['set-frosting'], 0);
  assert.equal(odds.setOdds['set-moonlight'], 0);
  assert.equal(odds.setOdds['set-dream'], 0);
  assert.equal(odds.setOdds['set-nature'], 0);
});

test('v181 投料范围约束：少于 2 份或大于 20 份时拦截', () => {
  assert.equal(craftOdds({ 'mat-stardust': 1 }).ok, false);
  assert.equal(craftOdds({ 'mat-stardust': 21 }).ok, false);
  assert.equal(craftOdds({}).ok, false);
});

test('v181 executeCraft 核心算法：扣除材料与星砂，产出对应套装装备', () => {
  const state = createInitialState();
  state.gold = 5000;
  state.inventory['mat-stardust'] = 5;
  state.inventory['mat-cinder'] = 5;

  const cost = craftGoldCost(10);
  assert.equal(cost, 10 * 120);

  const result = executeCraft(state, { 'mat-stardust': 5, 'mat-cinder': 5 }, 'test-craft-seed-1');
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.ok(['set-starlight', 'set-cinder'].includes(result.item.setId!));
  assert.ok(result.item.tier && result.item.tier >= 2);
  assert.equal(state.gold, 5000 - cost);
  assert.equal(state.inventory['mat-stardust'], 0);
  assert.equal(state.inventory['mat-cinder'], 0);
  assert.ok((state.inventory[result.item.id] ?? 0) >= 1);
});

test('v181 act craftEquipment：材料不足或星砂不足时拒绝并给明确文案', () => {
  const state = createInitialState();
  state.gold = 100;
  state.inventory['mat-stardust'] = 1;

  const failMat = act(state, { type: 'craftEquipment', materials: { 'mat-stardust': 2 } });
  assert.equal(failMat.ok, false);
  assert.match(failMat.message, /材料不足/);

  state.inventory['mat-stardust'] = 10;
  const failGold = act(state, { type: 'craftEquipment', materials: { 'mat-stardust': 10 } });
  assert.equal(failGold.ok, false);
  assert.match(failGold.message, /星砂不足/);

  state.gold = 10000;
  const success = act(state, { type: 'craftEquipment', materials: { 'mat-stardust': 10 } });
  assert.equal(success.ok, true);
  assert.match(success.message, /炼制/);
});
