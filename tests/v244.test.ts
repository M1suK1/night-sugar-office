import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { DRUG_STABILITY_COST, DRUG_STOCK_MAX } from '../src/rules/itemOps.ts';

/** v244：城市安定度可以直接换月蚀抑制剂。 */

test('v244 10 点安定度换 1 支抑制剂，不动星砂', () => {
  const state = createInitialState();
  state.reputation = 40;
  state.gold = 1000;
  state.inventory['moon-drug'] = 0;
  const result = act(state, { type: 'tradeStabilityDrug' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.reputation, 40 - DRUG_STABILITY_COST);
  assert.equal(result.state.inventory['moon-drug'], 1);
  assert.equal(result.state.gold, 1000, '只扣安定度');
});

test('v244 安定度不足时不换，也不动库存', () => {
  const state = createInitialState();
  state.reputation = DRUG_STABILITY_COST - 1;
  state.inventory['moon-drug'] = 0;
  const result = act(state, { type: 'tradeStabilityDrug' });
  assert.equal(result.ok, false);
  assert.match(result.message, /安定度/);
  assert.equal(result.state.inventory['moon-drug'], 0);
});

test('v244 仓库满 5 支后不再换', () => {
  const state = createInitialState();
  state.reputation = 90;
  state.inventory['moon-drug'] = DRUG_STOCK_MAX;
  const result = act(state, { type: 'tradeStabilityDrug' });
  assert.equal(result.ok, false);
  assert.match(result.message, /最多/);
  assert.equal(result.state.reputation, 90);
});
