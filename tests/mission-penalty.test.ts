import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BALANCE } from '../src/balance.ts';
import { createInitialState } from '../src/game.ts';
import type { FactionRoster, GameState, Mission } from '../src/types.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { failurePenaltyFor, failurePenaltyOf, failurePenaltyText } from '../src/missionPenalty.ts';

const rules = DEFAULT_BALANCE;

const leader = customLeaderOf('witch', subjectOfCustom({
  id: 'L1', name: '青灯', factionTag: 'witch', level: 10, color: '#8a7bd6',
  portrait: '', stats: { magic: 70, insight: 62, agility: 55, empathy: 66 }, skillIds: [],
  title: '蚀月祭司', quote: '这一夜归我管。',
}));
const mate = customGirlOf('witch', subjectOfCustom({
  id: 'M1', name: '纸鸢', factionTag: 'witch', level: 8, color: '#8a7bd6',
  portrait: '', stats: { magic: 55, insight: 60, agility: 58, empathy: 62 }, skillIds: [],
  title: '提灯人', quote: '灯我来提。', codename: '纸鸢',
}));

function roster(): FactionRoster {
  return { leaderId: '', memberIds: [] };
}

function stateWith(): GameState {
  const base = createInitialState();
  return {
    ...base,
    customFactionLeaders: [leader],
    customFactionGirls: [mate],
    factionRoster: { association: roster(), government: roster(), witch: { leaderId: leader.id, memberIds: [mate.id] } },
  };
}

const mission = (over: Partial<Mission> = {}): Mission => ({
  id: 'm1', title: '旧仓库的哭声', category: '调查', description: '', x: 0, y: 0,
  difficulty: '★★', duration: 60, reward: 1000, requirement: 'insight', target: 40, color: '#fff',
  status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 3,
  ...over,
});

test('v167 违约金：按报酬百分比，压下限，再按手头星砂封顶', () => {
  assert.equal(failurePenaltyOf(mission({ reward: 1000 }), 5000, rules).gold, 200);
  assert.equal(failurePenaltyOf(mission({ reward: 1000 }), 5000, rules).due, 200);
  assert.equal(failurePenaltyOf(mission({ reward: 100 }), 5000, rules).gold, rules.missionFailurePenaltyMin, '低于下限按下限');
});

test('v167 违约金：手头不够就扣到 0，绝不为负', () => {
  const poor = failurePenaltyOf(mission({ reward: 1000 }), 30, rules);
  assert.equal(poor.gold, 30);
  assert.equal(poor.due, 200, 'due 保留规则值，日志才解释得清');
  assert.equal(failurePenaltyOf(mission({ reward: 1000 }), 0, rules).gold, 0);
});

test('v167 势力代表委托失败：赔钱之外还要多掉一档好感', () => {
  const state = { ...stateWith(), gold: 1000 };
  const penalty = failurePenaltyFor(state, mission({ reward: 1000, envoyKind: 'coop', envoyFaction: 'witch' }), rules);
  assert.equal(penalty.gold, 200);
  assert.deepEqual(penalty.standing, [{ faction: 'witch', amount: rules.envoyFailureExtraStandingLoss }]);
  const plain = failurePenaltyFor(state, mission({ reward: 1000 }), rules);
  assert.deepEqual(plain.standing, [], '普通委托不额外扣好感');
});

test('v167 代价文案：预览与日志用同一套措辞', () => {
  const rich = failurePenaltyText(failurePenaltyFor({ ...stateWith(), gold: 5000 }, mission({ reward: 1000, envoyKind: 'coop', envoyFaction: 'witch' }), rules));
  assert.ok(rich.includes('违约金 200 星砂'), rich);
  assert.ok(rich.includes('好感 −2'), rich);
  assert.ok(rich.includes('安定度 −3'), rich);
  const broke = failurePenaltyText(failurePenaltyFor({ ...stateWith(), gold: 0 }, mission({ reward: 1000 }), rules));
  assert.ok(broke.includes('扣到 0'), broke);
});
