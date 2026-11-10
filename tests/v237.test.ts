import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { MAX_DUEL_SIDE, duelOpponents, interceptionSquadSize, squadLimitFor } from '../src/rules/duel.ts';
import { squadLimit } from '../src/rules/roster.ts';
import { envoyRaidSquadIds } from '../src/rules/envoy.ts';
import { makeGirl, makeLeader, withFactionRoster } from './fixtureRoster.ts';
import type { GameState, Mission } from '../src/types.ts';

/** v237：魔法少女对战（拦截战 / 破坏行动）的编队最多与对面人数相等。 */

const mission = (patch: Partial<Mission> = {}): Mission => ({
  id: 'm1', title: '测试委托', category: '测试', description: '', x: 10, y: 10, difficulty: '中危',
  duration: 60, reward: 1000, requirement: 'magic', target: 70, color: '#fff', status: 'open', squad: [],
  work: 'combat', enemyIds: ['a'], rounds: 4, attempts: 0, recommendedLevel: 2, district: 'candy',
  ...patch,
} as Mission);

function hostile(members = 1, withGovernment = false): GameState {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  const roster: Record<string, { leader: unknown; members: unknown[] }> = {
    association: {
      leader: makeLeader('association', '协会临时主事'),
      members: Array.from({ length: members }, (_, index) => makeGirl('association', `协会临时随从${index + 1}`)),
    },
  };
  if (withGovernment) {
    roster.government = {
      leader: makeLeader('government', '市役所临时主事'),
      members: [makeGirl('government', '市役所临时随从1'), makeGirl('government', '市役所临时随从2')],
    };
  }
  const seeded = withFactionRoster(state, roster as never);
  seeded.territories.candy = 'association';
  seeded.factions.association.standing = 20;
  return seeded;
}

test('v237 拦截战对面人数：推荐等级每 4 级多一人，夹在 1–3', () => {
  assert.equal(interceptionSquadSize(mission({ recommendedLevel: 1 })), 1);
  assert.equal(interceptionSquadSize(mission({ recommendedLevel: 3 })), 1);
  assert.equal(interceptionSquadSize(mission({ recommendedLevel: 4 })), 2);
  assert.equal(interceptionSquadSize(mission({ recommendedLevel: 7 })), 2);
  assert.equal(interceptionSquadSize(mission({ recommendedLevel: 8 })), 3);
  assert.equal(interceptionSquadSize(mission({ recommendedLevel: 20 })), MAX_DUEL_SIDE, '再高也封顶 3');
});

test('v237 会被拦截的委托：编队上限等于对面人数', () => {
  const state = hostile(3);
  assert.equal(duelOpponents(state, mission({ recommendedLevel: 2 })), 1);
  assert.equal(squadLimitFor(state, mission({ recommendedLevel: 2 })), 1, '1v1');
  assert.equal(squadLimitFor(state, mission({ recommendedLevel: 5 })), 2, '2v2');
  assert.equal(squadLimitFor(state, mission({ recommendedLevel: 9 })), 3, '3v3');
});

test('v237 名册不足时按实际人数算，不会给出对面凑不齐的上限', () => {
  const state = hostile(1);
  assert.equal(duelOpponents(state, mission({ recommendedLevel: 9 })), 1);
  assert.equal(squadLimitFor(state, mission({ recommendedLevel: 9 })), 1);
});

test('v237 不戒备就不拦截：魔物委托仍按原规则最多 3 人', () => {
  const state = hostile(3);
  state.factions.association.standing = 60;
  assert.equal(duelOpponents(state, mission({ recommendedLevel: 9 })), undefined);
  const target = mission({ recommendedLevel: 9, enemyIds: ['a'] });
  assert.equal(squadLimitFor(state, target), squadLimit(target));
  assert.equal(squadLimitFor(state, target), 3);
});

test('v237 调查委托被拦截时，上限同样按对面人数收窄', () => {
  const state = hostile(3);
  const investigate = mission({ work: 'investigation', enemyIds: undefined, recommendedLevel: 5 });
  assert.equal(squadLimit(investigate), 2, '原来的调查上限是 2');
  assert.equal(squadLimitFor(state, investigate), 2, '对面 2 人时正好 2v2');
  const lone = mission({ work: 'investigation', enemyIds: undefined, recommendedLevel: 2 });
  assert.equal(squadLimitFor(state, lone), 1, '对面只出 1 人时只能派 1 人');
});

test('v237 破坏行动按建单时写入的对面阵容算', () => {
  const state = hostile(1, true);
  const raid = mission({ envoy: true, envoyKind: 'raid', envoyTarget: 'government', enemyIds: [], interception: { faction: 'government', girlIds: ['g1', 'g2'] } });
  assert.equal(duelOpponents(state, raid), 2);
  assert.equal(squadLimitFor(state, raid), 2);
});

test('v237 旧档破坏行动没有 interception：用与结算同源的名单重算', () => {
  const state = hostile(1, true);
  const raid = mission({ envoy: true, envoyKind: 'raid', envoyTarget: 'government', enemyIds: [] });
  const expected = Math.min(MAX_DUEL_SIDE, envoyRaidSquadIds(state, 'government', state.day).length);
  assert.equal(duelOpponents(state, raid), expected);
  assert.equal(squadLimitFor(state, raid), expected);
});

test('v237 派遣时超过对面人数会被拒绝，同人数放行', () => {
  const state = hostile(1);
  state.missions = [mission({ recommendedLevel: 2 })];
  state.girls.forEach(girl => { girl.status = 'idle'; girl.hp = Math.max(girl.hp, 60); girl.fatigue = 0; });
  const ids = state.girls.slice(0, 2).map(girl => girl.id);

  const tooMany = act(state, { type: 'dispatch', missionId: 'm1', girlIds: ids });
  assert.equal(tooMany.ok, false);
  assert.match(tooMany.message, /对面|最多/);

  const one = act(state, { type: 'dispatch', missionId: 'm1', girlIds: [ids[0]!] });
  assert.equal(one.ok, true, one.message);
});
