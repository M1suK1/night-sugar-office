import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { expNeeded, grantExp, missionExp, MISSION_EXP_SHARE } from '../src/progression.ts';

function freshGirl(level: number) {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.level = level;
  girl.exp = 0;
  return girl;
}

test('v61 1 级少女打一单高难战斗不会直接升级：经验按她自己的等级需求封顶', () => {
  const girl = freshGirl(1);
  const amount = missionExp(girl, 4, 'battle');
  assert.equal(amount, Math.floor(expNeeded(1) * MISSION_EXP_SHARE.battle), '推荐等级 4 的旧值是 60，正好等于 1 级需求');
  assert.equal(grantExp(girl, amount).leveled, false, '一单不该升级');
  assert.equal(grantExp(girl, amount).leveled, true, '第二单才升级');
  assert.equal(girl.level, 2);
});

test('v61 调查要四次才升一级', () => {
  const girl = freshGirl(1);
  const amount = missionExp(girl, 8, 'investigation');
  assert.equal(amount, Math.floor(expNeeded(1) * MISSION_EXP_SHARE.investigation));
  for (let index = 0; index < 3; index += 1) assert.equal(grantExp(girl, amount).leveled, false, `第 ${index + 1} 次不该升级`);
  assert.equal(grantExp(girl, amount).leveled, true, '第 4 次升级');
  assert.equal(girl.level, 2);
});

test('v61 高等级也一样：一单最多半级', () => {
  const girl = freshGirl(5);
  const need = expNeeded(5);
  const amount = missionExp(girl, 8, 'battle');
  assert.ok(amount <= Math.floor(need * 0.5));
  assert.equal(grantExp(girl, amount).leveled, false);
  assert.equal(grantExp(girl, amount).leveled, true);
});

test('v61 封顶之内仍然按难度给：低难委托给得少，高难给得多', () => {
  const girl = freshGirl(3);
  const easy = missionExp(girl, 1, 'battle');
  const hard = missionExp(girl, 6, 'battle');
  assert.ok(hard > easy, `简单 ${easy} / 困难 ${hard}`);
  assert.equal(easy, 30, '推荐等级 1 的基础值不变');
});

test('v61 满级不给经验', () => {
  const girl = freshGirl(10);
  assert.equal(missionExp(girl, 5, 'battle'), 0);
});
