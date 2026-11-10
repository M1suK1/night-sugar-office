import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { restPlanOf } from '../src/rules/dailyOps.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';

test('v227 疲劳正好 20 时可以再休息到 0', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.fatigue = 20;
  girl.corruption = 0;
  const plan = restPlanOf(girl);
  assert.equal(plan.fatigueTo, 0, '低于阈值时目标改为 0');
  assert.equal(plan.minutes, Math.ceil(20 / DEFAULT_BALANCE.dormFatiguePerHour * 60));
  const rest = act(state, { type: 'care', girlId: girl.id, mode: 'resting' });
  assert.equal(rest.ok, true, rest.message);
  const done = act(rest.state, { type: 'advance', minutes: plan.minutes }).state.girls.find(item => item.id === girl.id)!;
  assert.equal(done.fatigue, 0);
  assert.equal(done.status, 'idle');
});

test('v227 高于阈值的一轮休息仍然先停在阈值', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.fatigue = 50;
  const plan = restPlanOf(girl);
  assert.equal(plan.fatigueTo, DEFAULT_BALANCE.dormRestExitFatigue);
  assert.ok(plan.fatigueTo > 0);
});

test('v227 阈值以下任意疲劳都能补休到 0', () => {
  for (const fatigue of [1, 7, 19]) {
    const state = createInitialState();
    const girl = state.girls[0]!;
    girl.fatigue = fatigue;
    assert.equal(restPlanOf(girl).fatigueTo, 0);
    assert.equal(act(state, { type: 'care', girlId: girl.id, mode: 'resting' }).ok, true);
  }
});
