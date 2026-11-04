import test from 'node:test';
import assert from 'node:assert/strict';
import { advancedCost, marketUpgradeCost } from '../src/economy.ts';
import { pollutionEffect } from '../src/pollution.ts';
import { squadLimit } from '../src/rules/roster.ts';
import { monsterRewardMultiplier } from '../src/combat.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';
import type { Mission } from '../src/types.ts';

const mission = (patch: Partial<Mission>): Mission => ({
  id: 'm1', title: '测试', category: '测试', description: '', x: 10, y: 10, difficulty: '中危', duration: 60,
  reward: 1000, requirement: 'magic', target: 70, color: '#fff', status: 'open', squad: [], work: 'combat',
  rounds: 3, attempts: 0, recommendedLevel: 3, ...patch,
} as Mission);

test('v144 市场扩建价减半', () => {
  assert.equal(marketUpgradeCost(0), 0);
  assert.equal(marketUpgradeCost(1), 3000);
  assert.equal(marketUpgradeCost(2), 6000);
  assert.equal(marketUpgradeCost(3), 12000);
});

test('v144 高级招聘星砂减半、安定度不变', () => {
  assert.equal(advancedCost(3).gold, 1800, '原来 3600');
  assert.equal(advancedCost(3).stability, 4, '安定度阶梯不动');
});

test('v144 污染对魔物的增幅按新系数走', () => {
  const full = pollutionEffect(100);
  assert.equal(full.enemyHpPct, DEFAULT_BALANCE.pollutionHpPct);
  assert.equal(full.enemyPowerPct, DEFAULT_BALANCE.pollutionPowerPct);
  assert.equal(full.targetPct, DEFAULT_BALANCE.pollutionTargetPct);
  assert.equal(full.rewardPct, DEFAULT_BALANCE.pollutionRewardPct);
  const half = pollutionEffect(50);
  assert.equal(half.enemyHpPct, Math.round(DEFAULT_BALANCE.pollutionHpPct / 2));
});

test('v144 战斗小队上限 = max(3, 魔物数量)，调查仍 ≤2', () => {
  assert.equal(squadLimit(mission({ enemyIds: ['a'] })), 3);
  assert.equal(squadLimit(mission({ enemyIds: ['a', 'b', 'c'] })), 3);
  assert.equal(squadLimit(mission({ enemyIds: ['a', 'b', 'c', 'd'] })), 4);
  assert.equal(squadLimit(mission({ enemyIds: ['a', 'b', 'c', 'd', 'e'] })), 5);
  assert.equal(squadLimit(mission({ work: 'investigation', enemyIds: ['a', 'b', 'c', 'd'] })), 2);
});

test('v144 多怪奖励倍率：每多一只 +15%', () => {
  assert.equal(monsterRewardMultiplier(1), 1);
  assert.equal(monsterRewardMultiplier(3), 1 + 2 * DEFAULT_BALANCE.rewardPerExtraMonster / 100);
  assert.equal(monsterRewardMultiplier(0), 1, '没有魔物也不倒扣');
});
