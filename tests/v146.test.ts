import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { factionSnapshotFromCards, subjectFromCard } from '../src/roster.ts';
import { witchAwarePortrait } from '../src/factions.ts';
import { FACTION_ORDER } from '../src/territories.ts';
import type { GirlCard } from '../src/types.ts';

const card = (name: string, factionTag: 'witch' | 'association' | 'government', witch = true): GirlCard => ({
  girl: {
    name, codename: name, title: '测试', element: '', color: '#b98ad9', archetype: '输出', level: 5,
    stats: { magic: 40, insight: 40, agility: 40, empathy: 40 },
    skillIds: ['moon-slash', 'moon-guard', 'moon-ult'], traitIds: [],
    appearance: '', personality: '', voice: {}, quote: '', goal: '', factionTag,
    portrait: `data:image/png;base64,${name}`,
    ...(witch ? { witchForm: { id: 'witchform', form: 'witch', name: '夜之形', description: '', palette: ['#2a1524'], layerKey: 'witch', portrait: `data:image/png;base64,witch-${name}` } } : {}),
  },
} as unknown as GirlCard);

test('v146 三方名册整份从卡库随机排：每方一位首领一位随从', () => {
  const cards = [
    card('甲', 'witch', true), card('乙', 'association'), card('丙', 'government'),
    card('丁', 'witch'), card('戊', 'association'), card('己', 'government'),
  ];
  const snapshot = factionSnapshotFromCards(cards);
  assert.ok(snapshot, '六张卡就该排得出来');
  assert.equal(snapshot!.leaders.length, 3);
  assert.equal(snapshot!.girls.length, 3);
  for (const faction of FACTION_ORDER) {
    const leader = snapshot!.leaders.find(item => item.faction === faction);
    assert.ok(leader, `${faction} 要有一位首领`);
    const member = snapshot!.girls.find(item => item.faction === faction);
    assert.ok(member, `${faction} 要有一位随从`);
    assert.equal(snapshot!.roster[faction].leaderId, leader!.id);
    assert.deepEqual(snapshot!.roster[faction].memberIds, [member!.id]);
  }
  // 月蚀庭的人默认魔女形态；别的势力不沾
  const witchLeader = snapshot!.leaders.find(item => item.faction === 'witch')!;
  assert.equal(witchLeader.witch, true);
  assert.equal(snapshot!.leaders.find(item => item.faction === 'association')!.witch, undefined);
});

test('v146 卡不够六张时不让排，调用方退回内置名册', () => {
  const cards = [card('甲', 'witch'), card('乙', 'association')];
  assert.equal(factionSnapshotFromCards(cards), null);
});

test('v146 卡上的立绘与魔女化立绘都跟着进名册', () => {
  const subject = subjectFromCard(card('夜莺', 'witch', true), 'card-night');
  assert.equal(subject.portrait.startsWith('data:image/png'), true);
  assert.ok(subject.witchForm?.portrait, '魔女化立绘要带上');
  assert.equal(subject.witchForm!.id, 'witchform');
});

test('v146 assignFactionRoster 把这份名册写进存档，并在战斗立绘里优先用魔女形态', () => {
  const s = createInitialState();
  const cards = [
    card('甲', 'witch', true), card('乙', 'association'), card('丙', 'government'),
    card('丁', 'witch'), card('戊', 'association'), card('己', 'government'),
  ];
  const snapshot = factionSnapshotFromCards(cards)!;
  const result = act(s, { type: 'assignFactionRoster', ...snapshot });
  assert.equal(result.ok, true, result.message);
  const witchLeader = result.state.customFactionLeaders!.find(leader => leader.faction === 'witch')!;
  assert.equal(witchLeader.witch, true);
  assert.equal(witchAwarePortrait(witchLeader), witchLeader.witchForm!.portrait);
  // 名单里的名字来自卡库，不再是内置那三位
  assert.equal(result.state.customFactionLeaders!.length, 3);
  assert.ok(result.state.logs[0].text.includes('三方名册从契约卡库重新排定'));
});

test('v146 事务所名册里的人不能被排进势力位', () => {
  const s = createInitialState();
  const cards = [
    card('甲', 'witch', true), card('乙', 'association'), card('丙', 'government'),
    card('丁', 'witch'), card('戊', 'association'), card('己', 'government'),
  ];
  const snapshot = factionSnapshotFromCards(cards)!;
  const own = s.girls[0]!;
  snapshot.leaders[0] = { ...snapshot.leaders[0]!, id: own.id, name: own.name };
  snapshot.roster[snapshot.leaders[0]!.faction] = { ...snapshot.roster[snapshot.leaders[0]!.faction], leaderId: own.id };
  const result = act(s, { type: 'assignFactionRoster', ...snapshot });
  assert.equal(result.ok, false);
});
