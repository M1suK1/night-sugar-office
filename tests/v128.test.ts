import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { renewalCost, pensionArrears } from '../src/contracts.ts';
import { contractPriceFor, contractCost } from '../src/rules/roster.ts';

test('v128 续约价是契约总价的一半', () => {
  const state = createInitialState();
  for (const girl of state.girls) {
    assert.equal(renewalCost(girl), Math.max(150, Math.round(contractPriceFor(girl) / 2)), `${girl.name} 的续约价`);
    assert.ok(renewalCost(girl) < contractPriceFor(girl), '续约一定比重新签便宜');
  }
});

test('v128 契约价上下限跟着缩到一半', () => {
  assert.equal(contractCost(1, 0), 725);
  const state = createInitialState();
  const weak = { ...state.girls[0]!, level: 1, skills: [], stats: { magic: 0, insight: 0, agility: 0, empathy: 0 }, equipment: {} } as never;
  assert.equal(renewalCost(weak), Math.round(contractPriceFor(weak) / 2), '最便宜那一档也只有契约价的一半，不再是 800 起步');
  assert.ok(renewalCost(weak) >= 150);
});

test('v128 续约会真的按「一半 + 欠缴」扣钱', () => {
  const state = createInitialState();
  state.gold = 20000;
  const girl = state.girls[0]!;
  girl.contractEndDay = state.day;
  girl.pensionMissed = 1;
  const expected = renewalCost(girl) + pensionArrears(girl);
  const result = act(state, { type: 'renewContract', girlId: girl.id });
  assert.equal(result.ok, true, result.message);
  assert.equal(state.gold - result.state.gold, expected);
  assert.equal(result.state.girls[0]!.pensionMissed, 0);
});
