import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { customGirlOf, customLeaderOf, subjectOfGirl, subjectOfLeader } from '../src/factions.ts';
import { factionSnapshotFromCards } from '../src/roster.ts';
import { sanitizeFactionRoster } from '../src/rules/candidate.ts';
import { FACTION_ORDER } from '../src/territories.ts';
import type { FactionGirl, FactionId, FactionLeader } from '../src/types.ts';
import type { GirlCard } from '../src/types.ts';

const card = (name: string, factionTag: FactionId): GirlCard => ({
  girl: {
    name, codename: name, title: '', element: '', color: '#b98ad9', archetype: '输出', level: 1,
    stats: { magic: 40, insight: 40, agility: 40, empathy: 40 },
    skillIds: ['moon-slash', 'moon-guard', 'moon-ult'], traitIds: [], appearance: '', personality: '',
    voice: {}, quote: '', goal: '', factionTag,
  },
} as unknown as GirlCard);

test('v148 位子挪过之后（随从升首领）界面仍能交出合法名单', () => {
  const cards = [card('甲', 'witch'), card('乙', 'association'), card('丙', 'government'), card('丁', 'witch'), card('戊', 'association'), card('己', 'government')];
  const snapshot = factionSnapshotFromCards(cards)!;
  let state = act(createInitialState(), { type: 'assignFactionRoster', ...snapshot }).state;

  const witchLeader = state.customFactionLeaders.find(leader => leader.faction === 'witch')!;
  const witchMember = state.customFactionGirls.find(girl => girl.faction === 'witch')!;
  const roster = { ...state.factionRoster, witch: { leaderId: witchMember.id, memberIds: [witchLeader.id] } };

  // 界面 confirm 的交人逻辑（已存首领 → 已存随从 → 池子条目）
  const leaders: FactionLeader[] = [];
  const girls: FactionGirl[] = [];
  for (const faction of FACTION_ORDER) {
    const leaderId = roster[faction].leaderId;
    const savedLeader = state.customFactionLeaders.find(leader => leader.id === leaderId);
    if (savedLeader) leaders.push({ ...savedLeader, faction });
    else {
      const savedGirl = state.customFactionGirls.find(girl => girl.id === leaderId);
      if (savedGirl) leaders.push(customLeaderOf(faction, subjectOfGirl(savedGirl)));
    }
    for (const id of roster[faction].memberIds) {
      const savedGirl = state.customFactionGirls.find(girl => girl.id === id);
      if (savedGirl) { girls.push({ ...savedGirl, faction, tag: faction }); continue; }
      const savedLeader = state.customFactionLeaders.find(leader => leader.id === id);
      if (savedLeader) girls.push(customGirlOf(faction, subjectOfLeader(savedLeader)));
    }
  }

  const valid = sanitizeFactionRoster(roster, leaders, girls);
  assert.ok(valid, '挪过位子的名单也应该合法');
  const imported = act(state, { type: 'importCards', cards: cards.slice(0, 2) });
  assert.equal(imported.ok, true, imported.message);
  const picked = imported.state.candidates.slice(0, 2).map(girl => girl.id);
  const result = act(imported.state, { type: 'setStarters', girlIds: picked, roster, customLeaders: leaders, customGirls: girls });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.factionRoster.witch.leaderId, witchMember.id);
});
