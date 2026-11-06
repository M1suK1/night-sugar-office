import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { annotateMission, deployMissionTemplate } from '../src/rules/missions.ts';
import { emptyCombatMission } from '../src/content/library.ts';
import { MISSION_REWARD_VERSION, MIN_REWARD, missionBaseExp, missionRewardFor, rebaseOpenMissionRewards } from '../src/missionReward.ts';
import { expNeeded, grantExp, missionExp } from '../src/progression.ts';
import type { Mission } from '../src/types.ts';

function mission(patch: Partial<Mission> = {}): Mission {
  const base = createInitialState().missions[0]!;
  const { environment: _environment, ...rest } = base;
  return { ...rest, id: 'v165-fixture', title: '测试委托', work: 'combat', difficulty: '中危', duration: 60, enemyIds: ['mirror-nun'], ...patch };
}

test('v165 中危 60 分 2 人的急件报酬是 1323', () => {
    assert.equal(missionRewardFor({ work: 'combat', difficulty: '中危', duration: 60, enemyCount: 2, window: 'urgent' }), 1323);
  });

test('v165 等级经验曲线是二次的，1→10 共 1800', () => {
  const curve = [60, 81, 108, 141, 180, 225, 276, 333, 396];
  assert.deepEqual(curve.map((_, index) => expNeeded(index + 1)), curve);
  assert.equal(curve.reduce((sum, value) => sum + value, 0), 1800);
});

test('v165 报酬随难度、时长、人数单调增长', () => {
  const at = (difficulty: string) => missionRewardFor({ work: 'combat', difficulty, duration: 60, enemyCount: 2 });
  assert.ok(at('低危') < at('中危') && at('中危') < at('高危') && at('高危') < at('绝望'));
  const short = missionRewardFor({ work: 'combat', difficulty: '中危', duration: 60, enemyCount: 2 });
  const long = missionRewardFor({ work: 'combat', difficulty: '中危', duration: 90, enemyCount: 2 });
  assert.ok(long > short);
  const one = missionRewardFor({ work: 'combat', difficulty: '绝望', duration: 100, enemyCount: 1 });
  const six = missionRewardFor({ work: 'combat', difficulty: '绝望', duration: 100, enemyCount: 6 });
  assert.ok(six > one, '多怪要补人数与风险');
  assert.ok(missionRewardFor({ work: 'investigation', difficulty: '低危', duration: 10, enemyCount: 0 }) >= MIN_REWARD);
});

test('v165 急件与长期修正仍然生效，且调查不受敌人数量影响', () => {
  const base = { work: 'combat' as const, difficulty: '中危', duration: 60, enemyCount: 2 };
  const plain = missionRewardFor(base);
  const urgent = missionRewardFor({ ...base, window: 'urgent' });
  const long = missionRewardFor({ ...base, window: 'long', longDays: 2 });
  assert.ok(urgent > plain);
  assert.ok(long > plain);
  const invA = missionRewardFor({ work: 'investigation', difficulty: '中危', duration: 60, enemyCount: 0 });
  const invB = missionRewardFor({ work: 'investigation', difficulty: '中危', duration: 60, enemyCount: 6 });
  assert.equal(invA, invB);
});

test('v165 标准委托生成时会重算并写版本；Boss 保持作者值', () => {
  const state = createInitialState();
  const standard = annotateMission(state, mission({ id: 'v165-standard', reward: 1 }));
  assert.equal(standard.rewardVersion, MISSION_REWARD_VERSION);
  assert.ok(standard.reward >= MIN_REWARD);
  const boss = annotateMission(state, mission({ id: 'v165-boss', reward: 9999, boss: true, environment: state.missions[0]!.environment }));
  assert.equal(boss.reward, 9999, '已有快照的 Boss 不重算');
  const deployed = deployMissionTemplate(state, { ...emptyCombatMission(), difficulty: '中危', duration: 60, enemyIds: ['mirror-nun'] });
  assert.equal(deployed.rewardVersion, MISSION_REWARD_VERSION);
  assert.ok(deployed.reward >= MIN_REWARD);
});

test('v165 旧档只重算 open 标准委托，active 与特殊委托不动', () => {
  const state = createInitialState();
  const open = state.missions.find(item => item.status === 'open' && !item.boss && !item.enemyIds?.length)!;
  open.reward = 1;
  delete open.rewardVersion;
  const active = { ...mission({ id: 'v165-active', reward: 777 }), status: 'active' as const, squad: [state.girls[0]!.id] };
  const special = { ...mission({ id: 'v165-special', reward: 888 }), status: 'open' as const, boss: true };
  state.missions.push(active, special);
  rebaseOpenMissionRewards(state);
  assert.ok(open.reward >= MIN_REWARD);
  assert.equal(open.rewardVersion, MISSION_REWARD_VERSION);
  assert.equal(active.reward, 777, '已接取不改价');
  assert.equal(special.reward, 888, 'Boss 不改价');
  assert.equal(rebaseOpenMissionRewards(state), 0, '重复读档幂等');
});

test('v165 战斗经验按阶级、数量与时长计算', () => {
  const low = missionBaseExp(mission({ duration: 40, enemyIds: ['sugar-moth'] }));
  const mid = missionBaseExp(mission({ duration: 60, enemyIds: ['echo-cat', 'echo-cat'] }));
  const high = missionBaseExp(mission({ duration: 80, enemyIds: ['mirror-nun', 'mirror-nun', 'mirror-nun'] }));
  const despair = missionBaseExp(mission({ duration: 100, enemyIds: Array(6).fill('mirror-nun') }));
  assert.equal(low, 23);
  assert.equal(mid, 52);
  assert.equal(high, 133);
  assert.equal(despair, 287);
  assert.ok(missionBaseExp(mission({ duration: 90, enemyIds: ['mirror-nun'] })) > missionBaseExp(mission({ duration: 40, enemyIds: ['mirror-nun'] })));
});

test('v165 调查经验按难度与时长，低于同档战斗', () => {
  const inv = missionBaseExp(mission({ work: 'investigation', difficulty: '高危', duration: 85, enemyIds: [] }));
  const combat = missionBaseExp(mission({ work: 'combat', difficulty: '高危', duration: 85, enemyIds: ['mirror-nun', 'mirror-nun', 'mirror-nun'] }));
  assert.equal(inv, 50);
  assert.ok(inv < combat);
});

test('v165 单次委托最多升 1 级，溢出丢弃', () => {
  const high = mission({ difficulty: '绝望', duration: 100, enemyIds: Array(6).fill('mirror-nun') });
  const girl = createInitialState().girls[0]!;
  girl.level = 5; girl.exp = 0;
  const need = expNeeded(5);
  assert.equal(need, 180);
  assert.equal(missionExp(girl, high), need);
  const result = grantExp(girl, missionExp(girl, high));
  assert.equal(result.leveled, true);
  assert.equal(girl.level, 6);
  assert.equal(girl.exp, 0);

  girl.exp = 100;
  const remaining = missionExp(girl, high);
  assert.equal(remaining, expNeeded(6) - 100);
});
