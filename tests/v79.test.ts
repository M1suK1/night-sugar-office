import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { SUMMON_FACTIONS, SUMMON_TEMPLATE, buildSummonEvent, summonFactionToday, summonRollsToday } from '../src/rules/summon.ts';

test('v79 召见按日号离散滚动：概率为 0 不触发，冷却期内不重复', () => {
  const state = createInitialState();
  assert.equal(summonRollsToday(state, 0, 3), false, '概率 0 就是关掉');
  assert.equal(summonRollsToday(state, 100, 0), true, '概率拉满且无冷却就必来');
  const cooling = { ...state, incidentCooldowns: { [SUMMON_TEMPLATE]: state.day } };
  assert.equal(summonRollsToday(cooling, 100, 3), false, '当天刚召见过');
  const old = { ...state, incidentCooldowns: { [SUMMON_TEMPLATE]: state.day - 3 } };
  assert.equal(summonRollsToday(old, 100, 3), true, '超过冷却就解禁');
});

test('v79 三方首领轮流来，事件里只有首领出场', () => {
  const state = createInitialState();
  const seen = new Set(SUMMON_FACTIONS.map((_, index) => summonFactionToday(state.day + index)));
  assert.equal(seen.size, SUMMON_FACTIONS.length, '轮转覆盖三方');
  const faction = summonFactionToday(state.day);
  // v160：静态表只剩空席占位，编成里没人的一方不再收到召见。
  assert.equal(buildSummonEvent(state, faction), undefined, '席位空缺时不制造召见');
});
