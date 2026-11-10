import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { restPlanOf } from '../src/rules/dailyOps.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';

const girlOf = (state: ReturnType<typeof createInitialState>) => state.girls[0]!;

test('v228 同一天第二次休息只回疲劳，不再平复侵蚀', () => {
  const state = createInitialState();
  const girl = girlOf(state);
  girl.fatigue = 60;
  girl.corruption = 20;

  const first = act(state, { type: 'care', girlId: girl.id, mode: 'resting' });
  assert.equal(first.ok, true, first.message);
  const afterFirst = act(first.state, { type: 'advance', minutes: restPlanOf(girl, state.day).minutes }).state;
  const rested = girlOf(afterFirst);
  assert.equal(rested.fatigue, 20);
  assert.equal(rested.corruption, 15, '当天第一次休息平复 5 点');
  assert.equal(rested.restCorruptionDay, state.day);

  const second = act(afterFirst, { type: 'care', girlId: girl.id, mode: 'resting' });
  assert.equal(second.ok, true, second.message);
  const plan = restPlanOf(rested, afterFirst.day);
  assert.equal(plan.corruptionUsed, true);
  assert.equal(plan.corruptionTo, 15);
  const afterSecond = act(second.state, { type: 'advance', minutes: plan.minutes }).state;
  const again = girlOf(afterSecond);
  assert.equal(again.fatigue, 0);
  assert.equal(again.corruption, 15, '同一天第二次休息不再扣侵蚀');
});

test('v228 换一天后可以再平复一次侵蚀', () => {
  const state = createInitialState();
  const girl = girlOf(state);
  girl.fatigue = 0;
  girl.corruption = 15;
  girl.restCorruptionDay = state.day;

  const nextDay = { ...state, day: state.day + 1 };
  const plan = restPlanOf(girlOf(nextDay), nextDay.day);
  assert.equal(plan.corruptionUsed, false);
  assert.equal(plan.corruptionTo, 15 - DEFAULT_BALANCE.dormRestCorruption);
  const rest = act(nextDay, { type: 'care', girlId: girl.id, mode: 'resting' });
  assert.equal(rest.ok, true, rest.message);
  const done = act(rest.state, { type: 'advance', minutes: plan.minutes }).state;
  assert.equal(girlOf(done).corruption, 15 - DEFAULT_BALANCE.dormRestCorruption);
});

test('v228 当天额度用完后，疲劳清零且侵蚀不再下降时拒绝休息', () => {
  const state = createInitialState();
  const girl = girlOf(state);
  girl.fatigue = 0;
  girl.corruption = 15;
  girl.restCorruptionDay = state.day;
  const result = act(state, { type: 'care', girlId: girl.id, mode: 'resting' });
  assert.equal(result.ok, false);
  assert.match(result.message, /平复过侵蚀/);
});

test('v228 旧档没有日期记录时仍按第一次休息处理', () => {
  const state = createInitialState();
  const girl = girlOf(state);
  girl.fatigue = 30;
  girl.corruption = 20;
  girl.restCorruptionDay = undefined;
  const plan = restPlanOf(girl, state.day);
  assert.equal(plan.corruptionUsed, false);
  assert.equal(plan.corruptionTo, 15);
});
