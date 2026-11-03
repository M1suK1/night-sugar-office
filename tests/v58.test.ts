import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { makeCommission, missionBaselineNote, pickDifficulty, commissionPool } from '../src/rules/missions.ts';
import type { DifficultyTier } from '../src/rules/missions.ts';

const order = ['低危', '中危', '高危', '绝望'] as const;
const rank = (tier: string) => order.indexOf(tier as typeof order[number]);

function withPollution(level: number) {
  const state = createInitialState();
  for (const id of Object.keys(state.pollution ?? {})) state.pollution[id] = level;
  return state;
}

test('v58 高危模板不会被抽成低危：辖区污染只在模板档位上下浮动一档', () => {
  for (const level of [0, 10, 25, 45, 65, 85, 100]) {
    const state = withPollution(level);
    for (let index = 0; index < 120; index += 1) {
      const tier = pickDifficulty(state, 'oldtown', `c-test-${index}`, '高危');
      assert.ok(Math.abs(rank(tier) - rank('高危')) <= 1, `污染 ${level} 时抽到 ${tier}`);
      assert.notEqual(tier, '低危', '高危模板不该掉到低危');
    }
  }
});

test('v58 两端的模板同样只在邻档浮动', () => {
  const dirty = withPollution(100);
  for (let index = 0; index < 60; index += 1) {
    assert.notEqual(pickDifficulty(dirty, 'oldtown', `low-${index}`, '低危'), '绝望');
  }
  for (let index = 0; index < 60; index += 1) {
    assert.notEqual(pickDifficulty(dirty, 'oldtown', `apex-${index}`, '绝望'), '低危');
    assert.notEqual(pickDifficulty(dirty, 'oldtown', `apex-${index}`, '绝望'), '中危');
  }
});

test('v58 不带锚点时保持旧行为：干净辖区还是可能抽到低危', () => {
  const clean = withPollution(5);
  const tiers = new Set(Array.from({ length: 80 }, (_, index) => pickDifficulty(clean, 'oldtown', `legacy-${index}`)));
  assert.ok(tiers.has('低危'), '旧调用方（无锚点）行为不变');
});

test('v58 夜间委托的实际危险度与模板基线最多差一档', () => {
  const state = createInitialState();
  const pool = commissionPool();
  for (let day = 1; day <= 20; day += 1) {
    for (let wave = 0; wave < 3; wave += 1) {
      for (let slot = 0; slot < 3; slot += 1) {
        const probe = { ...state, day };
        const mission = makeCommission(probe, wave, slot);
        assert.ok(pool.length > 0);
        if (!mission.scaledFrom) continue;
        const diff = Math.abs(rank(mission.difficulty) - rank(mission.scaledFrom));
        assert.ok(diff <= 1, `第 ${day} 日第 ${wave} 波第 ${slot} 格：模板 ${mission.scaledFrom} → 实际 ${mission.difficulty}`);
      }
    }
  }
});

test('v58 危险度与基线不同时给一句说明，相同时不啰嗦', () => {
  assert.equal(missionBaselineNote({ difficulty: '中危', scaledFrom: '高危' }), '模板基线 高危');
  assert.equal(missionBaselineNote({ difficulty: '高危', scaledFrom: '高危' }), undefined);
  assert.equal(missionBaselineNote({ difficulty: '高危' }), undefined);
});

// 类型护栏：这里的档位必须就是任务用的那套字面量。
const _tierCheck: DifficultyTier = '高危';
void _tierCheck;
