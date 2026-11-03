import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { commissionPool, makeCommission } from '../src/rules/missions.ts';
import { sanitizeMission } from '../src/content/library.ts';
import { suggestedLevel } from '../src/missionLevel.ts';

test('v62 推荐等级按危险度起底，再按魔物数量加档', () => {
  assert.equal(suggestedLevel('低危'), 2);
  assert.equal(suggestedLevel('中危'), 3);
  assert.equal(suggestedLevel('高危'), 5);
  assert.equal(suggestedLevel('绝望'), 7);
  assert.equal(suggestedLevel('高危', 2), 5, '两只及以内不加档');
  assert.equal(suggestedLevel('高危', 3), 6);
  assert.equal(suggestedLevel('绝望', 6), 9);
  assert.equal(suggestedLevel('中危', 9), 5, '最多加两档');
  assert.equal(suggestedLevel('未知'), 3, '认不出的难度回落到 3');
  assert.equal(suggestedLevel('简单'), 2, '蓝图的四档也认');
  assert.equal(suggestedLevel('危险', 4), 9);
});

test('v62 夜间委托的推荐等级不再统一是 3', () => {
  const state = createInitialState();
  const pool = commissionPool();
  const levels = new Set<number>();
  for (let wave = 0; wave < 3; wave += 1) {
    for (let slot = 0; slot < 3; slot += 1) {
      const mission = makeCommission({ ...state, day: 3 + wave * 3 + slot }, wave, slot);
      levels.add(mission.recommendedLevel);
      const floor = suggestedLevel(mission.difficulty, mission.enemyIds?.length ?? 0);
      assert.ok(mission.recommendedLevel >= floor, `${mission.difficulty} 的推荐等级 ${mission.recommendedLevel} 低于建议值 ${floor}`);
    }
  }
  assert.ok(pool.length > 0);
  assert.ok(levels.size >= 2, `这一批只出现了 ${[...levels].join('/')} 这几档`);
});

test('v62 旧模板「一律 3」的库会被补正，中危保持 3', () => {
  const high = sanitizeMission({ id: 'custom-mission-high', title: '旧的高危模板', difficulty: '高危', recommendedLevel: 3, enemyIds: [] });
  assert.equal(high?.recommendedLevel, 5, '高危模板停在 3 就按难度补正');
  const normal = sanitizeMission({ id: 'custom-mission-normal', title: '中危模板', difficulty: '中危', recommendedLevel: 3, enemyIds: [] });
  assert.equal(normal?.recommendedLevel, 3, '中危本来就是 3，不动它');
  const tuned = sanitizeMission({ id: 'custom-mission-tuned', title: '手调过的', difficulty: '绝望', recommendedLevel: 8, enemyIds: [] });
  assert.equal(tuned?.recommendedLevel, 8, '手写过的值不被覆盖');
  const missing = sanitizeMission({ id: 'custom-mission-low', title: '没写等级的低危', difficulty: '低危', enemyIds: [] });
  assert.equal(missing?.recommendedLevel, 2, '缺省按难度算');
});
