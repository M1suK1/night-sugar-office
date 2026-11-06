import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { expNeeded, grantExp, missionExp } from '../src/progression.ts';
import type { Mission } from '../src/types.ts';

function freshGirl(level: number) {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.level = level;
  girl.exp = 0;
  return girl;
}

function mission(patch: Partial<Mission>): Mission {
  return {
    ...createInitialState().missions[0]!,
    id: 'v61-fixture', title: '经验测试', work: 'combat', difficulty: '中危',
    duration: 60, enemyIds: ['mirror-nun'], ...patch,
  };
}

test('v61 单次委托最多升 1 级：高难经验只发到下一级所需', () => {
  const girl = freshGirl(5);
  const need = expNeeded(5);
  const hard = mission({ difficulty: '绝望', duration: 100, enemyIds: Array(6).fill('mirror-nun') });
  const amount = missionExp(girl, hard);
  assert.equal(amount, need, '溢出经验不跨级保留');
  assert.equal(grantExp(girl, amount).leveled, true);
  assert.equal(girl.level, 6);
  assert.equal(girl.exp, 0);
});

test('v61 战斗经验随阶级、数量与时长增长', () => {
  const girl = freshGirl(3);
  const easy = missionExp(girl, mission({ duration: 40, enemyIds: ['sugar-moth'] }));
  const hard = missionExp(girl, mission({ duration: 80, enemyIds: ['mirror-nun', 'mirror-nun', 'mirror-nun'] }));
  assert.ok(hard > easy, `简单 ${easy} / 困难 ${hard}`);
  const short = missionExp(girl, mission({ duration: 40, enemyIds: ['mirror-nun'] }));
  const long = missionExp(girl, mission({ duration: 90, enemyIds: ['mirror-nun'] }));
  assert.ok(long > short, `短 ${short} / 长 ${long}`);
});

test('v61 调查经验按难度与时长，约为同档战斗的一半', () => {
  const girl = freshGirl(3);
  const inv = missionExp(girl, mission({ work: 'investigation', difficulty: '高危', duration: 85, enemyIds: [] }));
  const combat = missionExp(girl, mission({ work: 'combat', difficulty: '高危', duration: 85, enemyIds: ['mirror-nun'] }));
  assert.ok(inv > 0 && inv < combat, `调查 ${inv} / 战斗 ${combat}`);
});

test('v61 满级不给经验', () => {
  const girl = freshGirl(10);
  assert.equal(missionExp(girl, mission({})), 0);
});
