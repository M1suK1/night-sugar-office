import test from 'node:test';
import assert from 'node:assert/strict';
import { battleScore, compareMissionsByTier, gradeOfEnemies, missionLevelFor, tierForScore } from '../src/missionTier.ts';
import { annotateMission } from '../src/rules/missions.ts';
import { createInitialState } from '../src/game.ts';
import { combatMissionsLow } from '../src/content/missions-combat-low.ts';
import { combatMissionsHigh } from '../src/content/missions-combat-high.ts';
import { extraMissions } from '../src/content/missions-extra.ts';

test('v161 评级：按魔物阶级累加，四档按分数切开', () => {
  assert.equal(battleScore(['sugar-moth']), 1);
  assert.equal(battleScore(['echo-cat']), 2);
  assert.equal(battleScore(['silent-nurse']), 4);
  assert.equal(battleScore(['echo-cat', 'silent-nurse']), 6);
  assert.equal(battleScore(['candy-king']), 7);
  assert.equal(tierForScore(2), '低危');
  assert.equal(tierForScore(3), '中危');
  assert.equal(tierForScore(5), '中危');
  assert.equal(tierForScore(6), '高危');
  assert.equal(tierForScore(9), '高危');
  assert.equal(tierForScore(10), '绝望');
});

test('v161 推荐等级：档位起底，按只数加档', () => {
  assert.equal(missionLevelFor('低危', 1), 2);
  assert.equal(missionLevelFor('中危', 2), 3);
  assert.equal(missionLevelFor('高危', 3), 6);
  assert.equal(missionLevelFor('绝望', 6), 9);
});

test('v161 同编成不会再跨档：单只游荡统一为低危', () => {
  assert.equal(gradeOfEnemies(['mist-siren']).tier, '低危');
  assert.equal(gradeOfEnemies(['mist-siren']).tier, gradeOfEnemies(['echo-cat']).tier);
});

test('v161 运行时委托按实际编成重算档位与推荐等级', () => {
  const state = createInitialState();
  const base = state.missions.find(mission => mission.work === 'combat' && (mission.enemyIds ?? []).length)!;
  const graded = annotateMission(state, { ...base, id: 'test-regrade', difficulty: '绝望', recommendedLevel: 9, enemyIds: ['mist-siren'], scaledFrom: undefined });
  assert.equal(graded.difficulty, '低危');
  assert.equal(graded.recommendedLevel, 2);
});

test('v161 静态模板已经按编成重排：同类编成档位一致', () => {
  const all = [...combatMissionsLow, ...combatMissionsHigh, ...extraMissions];
  const find = id => all.find(mission => mission.id === id);
  assert.equal(find('c-single-siren')?.difficulty, '低危');
  assert.equal(find('c-single-nurse')?.difficulty, '中危');
  assert.equal(find('c-single-herald')?.difficulty, '中危');
  assert.equal(find('c-trio-church-rite')?.difficulty, '绝望');
  assert.equal(find('c-sext-abyss-legion')?.difficulty, '绝望');
});

test('v161 老模板补上了 enemyIds', () => {
  const ids = ['canteen-fog', 'shutter-song', 'tooth-collector'];
  for (const id of ids) {
    const mission = extraMissions.find(item => item.id === id);
    assert.ok(mission, id);
    assert.ok((mission!.enemyIds ?? []).length > 0, id + ' 需要 enemyIds');
  }
});

test('v161 排序：低危在前，同档内编成更重的在前', () => {
  const list = [
    { id: 'a', difficulty: '绝望', enemyIds: ['candy-king', 'candy-king'] },
    { id: 'b', difficulty: '低危', enemyIds: ['sugar-moth'] },
    { id: 'c', difficulty: '低危', enemyIds: ['echo-cat'] },
  ].sort(compareMissionsByTier);
  assert.deepEqual(list.map(item => item.id), ['c', 'b', 'a']);
});
