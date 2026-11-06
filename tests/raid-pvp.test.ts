import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import type { GameState, Mission } from '../src/types.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { envoyOfferOf, envoyRaidSquadIds } from '../src/rules/envoy.ts';

function person(id: string, name: string, factionTag: 'association' | 'government' | 'witch', level: number) {
  return subjectOfCustom({
    id, name, factionTag, level, color: '#8a7bd6', portrait: '',
    stats: { magic: 60, insight: 60, agility: 60, empathy: 60 }, skillIds: [],
    title: '测试', codename: name, quote: '站住。',
  });
}

const FACTIONS = ['association', 'government', 'witch'] as const;

function stateWithRoster(day = 18): GameState {
  const base = createInitialState();
  const leaders = FACTIONS.map(faction => customLeaderOf(faction, person(`L-${faction}`, `首领${faction}`, faction, 10)));
  const members = FACTIONS.map(faction => customGirlOf(faction, person(`M-${faction}`, `随从${faction}`, faction, 8)));
  const roster = Object.fromEntries(FACTIONS.map(faction => [faction, { leaderId: `L-${faction}`, memberIds: [`M-${faction}`] }]));
  return {
    ...base, day,
    customFactionLeaders: leaders,
    customFactionGirls: members,
    factionRoster: roster as GameState['factionRoster'],
  };
}

/** 找一份今天的破坏行动（拿不到就把日期往后挪，规则是纯函数，同一天结果固定）。 */
function raidOffer(state: GameState): { state: GameState; faction: (typeof FACTIONS)[number]; offer: ReturnType<typeof envoyOfferOf> } {
  for (let day = state.day; day < state.day + 20; day += 1) {
    const probe = { ...state, day };
    for (const faction of FACTIONS) {
      const offer = envoyOfferOf(probe, faction);
      if (offer.kind === 'raid' && offer.mission) return { state: probe, faction, offer };
    }
  }
  throw new Error('没有生成出破坏行动，检查 envoyRaidSquad 的前置条件');
}

test('v168 破坏行动：委托里不再挂魔物，对面是那一方的魔法少女', () => {
  const { state, offer } = raidOffer(stateWithRoster());
  const mission = offer.mission!;
  assert.equal(mission.work, 'combat');
  assert.equal(mission.envoyKind, 'raid');
  assert.deepEqual(mission.enemyIds, [], '破坏行动不该再带魔物名单');
  assert.ok(mission.interception, '要记下对面是谁出来迎战');
  assert.equal(mission.interception!.faction, mission.envoyTarget);
  assert.ok(mission.interception!.girlIds.length > 0);
  assert.deepEqual(mission.interception!.girlIds, envoyRaidSquadIds(state, mission.envoyTarget!, state.day));
});

test('v168 破坏行动：打起来的时候敌人是魔法少女，不是魔物', () => {
  const { state, faction, offer } = raidOffer(stateWithRoster());
  let next = act(state, { type: 'acceptFactionTask', faction }).state;
  const mission = next.missions.find(item => item.id === offer.mission!.id)!;
  const girl = next.girls.find(item => item.status === 'idle')!;
  const dispatched = act(next, { type: 'dispatch', girlIds: [girl.id], missionId: mission.id });
  assert.equal(dispatched.ok, true, dispatched.message);
  next = dispatched.state;
  for (let step = 0; step < 20 && !next.battles.length; step += 1) {
    next = act(next, { type: 'advance', minutes: 30 }).state;
  }
  const battle = next.battles[0];
  assert.ok(battle, '这一战要真的打起来');
  const enemies = battle.units.filter(unit => unit.side === 'enemy');
  assert.ok(enemies.length > 0, '对面得有人');
  const squad = mission.interception!.girlIds;
  for (const unit of enemies) {
    assert.ok(squad.some(id => unit.uid.includes(id)), `${unit.name} 不在对面名册里（uid=${unit.uid}）`);
    assert.equal(unit.monster, undefined, '敌人不该是魔物');
  }
});

test('v168 旧档里漏写阵容的破坏委托：结算时按对方名册补齐，不会退回打魔物', () => {
  const { state, faction, offer } = raidOffer(stateWithRoster());
  let next = act(state, { type: 'acceptFactionTask', faction }).state;
  const legacyId = offer.mission!.id;
  // 模拟旧存档：破坏委托只有模板留下的魔物名单，没有 interception。
  next = {
    ...next,
    missions: next.missions.map((item: Mission) => item.id === legacyId
      ? { ...item, interception: undefined, enemyIds: ['silent-nurse'] }
      : item),
  };
  const girl = next.girls.find(item => item.status === 'idle')!;
  const dispatched = act(next, { type: 'dispatch', girlIds: [girl.id], missionId: legacyId });
  assert.equal(dispatched.ok, true, dispatched.message);
  next = dispatched.state;
  for (let step = 0; step < 20 && !next.battles.length; step += 1) {
    next = act(next, { type: 'advance', minutes: 30 }).state;
  }
  const enemies = next.battles[0]?.units.filter(unit => unit.side === 'enemy') ?? [];
  assert.ok(enemies.length > 0, '补齐之后对面仍然有人');
  for (const unit of enemies) {
    assert.equal(unit.monster, undefined, `${unit.name} 被打成了魔物`);
    assert.ok(/^enemy-0-/.test(unit.uid) && unit.uid.length > 'enemy-0-'.length, `敌人 uid 应是名册里的人：${unit.uid}`);
  }
});
