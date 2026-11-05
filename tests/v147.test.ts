import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import {
  defaultFactionRoster, factionBrief, factionGirlsOf, factionRepresentativeOf,
  factionSeatsMissing, factionSeatEmpty, rosterLeader, rosterMembers,
} from '../src/factions.ts';
import { FACTION_ORDER } from '../src/territories.ts';
import { factionSnapshotFromCards } from '../src/roster.ts';
import type { GirlCard } from '../src/types.ts';
import { makeLeader, makeGirl, seedRoster, withFactionRoster } from './fixtureRoster.ts';

test('v147 静态三方名册已经废除：没有随从、首领是空缺占位', () => {
  const state = createInitialState();
  for (const faction of FACTION_ORDER) {
    assert.deepEqual(factionGirlsOf(faction), [], `${faction} 不该再有内置随从`);
    const roster = state.factionRoster[faction];
    assert.equal(roster.leaderId, '', '开局三方全空席');
    assert.deepEqual(roster.memberIds, []);
    assert.equal(factionSeatEmpty(state, faction), true);
    const leader = rosterLeader(state, faction);
    assert.equal(leader.vacant, true);
    assert.equal(leader.name, '席位空缺');
    assert.deepEqual(rosterMembers(state, faction), []);
  }
  assert.equal(factionSeatsMissing(state), 3);
});

test('v147 代表是空缺时带上 vacant 标记，界面据此提示导卡', () => {
  const state = createInitialState();
  for (const faction of FACTION_ORDER) {
    const rep = factionRepresentativeOf(state, faction);
    assert.equal(rep.vacant, true);
    assert.equal(rep.name, '席位空缺');
    assert.match(factionBrief(faction, 50), /席位空缺/);
  }
});

test('v147 defaultFactionRoster 全是空席，不会再塞回内置 id', () => {
  const roster = defaultFactionRoster();
  for (const faction of FACTION_ORDER) {
    assert.equal(roster[faction].leaderId, '');
    assert.deepEqual(roster[faction].memberIds, []);
  }
});

test('v147 空席首领不能被雇佣', () => {
  const state = createInitialState();
  state.gold = 99999;
  for (const faction of FACTION_ORDER) {
    const leader = rosterLeader(state, faction);
    const result = act(state, { type: 'hireLeader', leaderId: leader.id });
    assert.equal(result.ok, false, `${faction} 的空席不该能雇`);
    assert.match(result.message, /空着|没有这位首领/);
  }
});

test('v147 合约卡不够时，三方名册排不出来（snapshot 返回 null）', async () => {
  const { factionSnapshotFromCards } = await import('../src/roster.ts');
  assert.equal(factionSnapshotFromCards([]), null);
});

test('v147 势力覆灭后可以雇佣卡面首领（静态名册没了也要能雇）', () => {
  let state = createInitialState();
  state = withFactionRoster(state, {
    association: { leader: makeLeader('association', '借来的会长'), members: [makeGirl('association', '随从甲')] },
  });
  state.gold = 50000;
  // 让协会彻底没有辖区：势力覆灭。
  for (const key of Object.keys(state.territories)) {
    if (state.territories[key as keyof typeof state.territories] === 'association') {
      state.territories[key as keyof typeof state.territories] = 'government';
    }
  }
  const leaderId = state.customFactionLeaders.find(leader => leader.faction === 'association')!.id;
  const hired = act(state, { type: 'hireLeader', leaderId });
  assert.equal(hired.ok, true, hired.message);
  assert.ok(hired.state.girls.some(girl => girl.id === leaderId), '首领进了事务所名册');
  assert.ok(hired.state.gold < state.gold, '扣了雇佣费');
});

test('v147 编成确认会把「已编成的卡面人」原样交回去（否则规则层报三方阵容不合法）', () => {
  const cards = [1, 2, 3, 4, 5, 6].map(index => ({
    girl: {
      name: '卡' + index, codename: 'k' + index, title: '', element: '', color: '#b98ad9', archetype: '输出',
      level: 1, stats: { magic: 40, insight: 40, agility: 40, empathy: 40 },
      skillIds: ['moon-slash', 'moon-guard', 'moon-ult'], traitIds: [], appearance: '', personality: '',
      voice: {}, quote: '', goal: '', factionTag: index % 3 === 0 ? 'witch' : index % 3 === 1 ? 'association' : 'government',
    },
  })) as unknown as GirlCard[];
  let state = createInitialState();
  const snapshot = factionSnapshotFromCards(cards)!;
  state = act(state, { type: 'assignFactionRoster', ...snapshot }).state;
  const imported = act(state, { type: 'importCards', cards: cards.slice(0, 2) });
  assert.equal(imported.ok, true, imported.message);
  const picked = imported.state.candidates.slice(0, 2).map(girl => girl.id);
  // 界面上原样把「已编成的人」交回去：就是 customFactionLeaders/Girls 里那些对象。
  const leaders = imported.state.customFactionLeaders;
  const girls = imported.state.customFactionGirls;
  const result = act(imported.state, { type: 'setStarters', girlIds: picked, roster: imported.state.factionRoster, customLeaders: leaders, customGirls: girls });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.customFactionLeaders.length, 3);
});
