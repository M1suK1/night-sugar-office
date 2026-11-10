import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { restPlanOf } from '../src/rules/dailyOps.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';

test('v150 休息是每小时 20 点，睡到疲劳 ≤ 20 才结束', () => {
  const s = createInitialState();
  const girl = s.girls[0]!;
  girl.fatigue = 75;
  girl.corruption = 20;
  const plan = restPlanOf(girl);
  assert.equal(plan.perHour, DEFAULT_BALANCE.dormFatiguePerHour);
  assert.equal(plan.threshold, DEFAULT_BALANCE.dormRestExitFatigue);
  assert.equal(plan.minutes, Math.ceil(55 / DEFAULT_BALANCE.dormFatiguePerHour * 60));
  assert.equal(plan.fatigueTo, DEFAULT_BALANCE.dormRestExitFatigue);

  const rest = act(s, { type: 'care', girlId: girl.id, mode: 'resting' });
  assert.equal(rest.ok, true, rest.message);
  const hour = act(rest.state, { type: 'advance', minutes: 60 }).state.girls.find(item => item.id === girl.id)!;
  assert.equal(hour.fatigue, 75 - DEFAULT_BALANCE.dormFatiguePerHour, '一小时正好回 20 点');
  assert.equal(hour.status, 'resting', '没到阈值不许停');

  const done = act(rest.state, { type: 'advance', minutes: plan.minutes }).state.girls.find(item => item.id === girl.id)!;
  assert.equal(done.fatigue, DEFAULT_BALANCE.dormRestExitFatigue);
  assert.equal(done.status, 'idle');
  assert.equal(done.corruption, 20 - DEFAULT_BALANCE.dormRestCorruption);
});

test('v150 疲劳低于阈值时可以补休到 0', () => {
  const s = createInitialState();
  s.girls[0]!.fatigue = 15;
  const plan = restPlanOf(s.girls[0]!);
  assert.equal(plan.threshold, DEFAULT_BALANCE.dormRestExitFatigue);
  assert.equal(plan.fatigueTo, 0, '低于阈值时目标改为 0，不再卡在阈值');
  assert.equal(plan.minutes, Math.ceil(15 / DEFAULT_BALANCE.dormFatiguePerHour * 60));
  const rest = act(s, { type: 'care', girlId: s.girls[0]!.id, mode: 'resting' });
  assert.equal(rest.ok, true, rest.message);
  const done = act(rest.state, { type: 'advance', minutes: plan.minutes }).state.girls.find(item => item.id === s.girls[0]!.id)!;
  assert.equal(done.fatigue, 0);
  assert.equal(done.status, 'idle');
});

test('v150 疲劳清零后才不再安排休息', () => {
  const s = createInitialState();
  s.girls[0]!.fatigue = 0;
  s.girls[0]!.corruption = 0;
  assert.equal(act(s, { type: 'care', girlId: s.girls[0]!.id, mode: 'resting' }).ok, false);
});

test('v150 休息跨过打烊也会收尾，不会卡在「剩余 0 分钟」', () => {
  const s = createInitialState();
  const girl = s.girls[0]!;
  girl.fatigue = 95;
  // 把时间推到深夜，剩下的营业时间不够睡完
  s.minutes = 22 * 60;
  const rest = act(s, { type: 'care', girlId: girl.id, mode: 'resting' });
  assert.equal(rest.ok, true, rest.message);
  const night = act(rest.state, { type: 'endNight' });
  assert.equal(night.ok, true, night.message);
  const next = night.state.girls.find(item => item.id === girl.id)!;
  assert.equal(next.status, 'idle', '打烊之后不该还挂着休息');
  assert.ok(next.fatigue <= DEFAULT_BALANCE.dormRestExitFatigue, `醒来时疲劳应该到阈值以下，实际 ${next.fatigue}`);
});
