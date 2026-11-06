import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import type { CharacterEvent, FactionPair, GameState } from '../src/types.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { buildMeetEvent, buildSummonEvent, factionSceneCast } from '../src/rules/summon.ts';
import { applySeedStorySession } from '../src/rules/storyOps.ts';
import { storyOpeningContextForTest } from '../src/llm.ts';

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
const rival = customLeaderOf('association', subjectOfCustom({
  id: 'R1', name: '白露', factionTag: 'association', level: 10, color: '#c9b46a',
  portrait: '', stats: { magic: 60, insight: 60, agility: 60, empathy: 60 }, skillIds: [],
  title: '巡查使', quote: '把灯交出来。',
}));

function stateWithRoster(): GameState {
  const base = createInitialState();
  return {
    ...base,
    customFactionLeaders: [leader, rival],
    customFactionGirls: [mate],
    factionRoster: {
      association: { leaderId: rival.id, memberIds: [] },
      government: { leaderId: '', memberIds: [] },
      witch: { leaderId: leader.id, memberIds: [mate.id] },
    },
  };
}

function withHostility(state: GameState, pair: FactionPair, value: number): GameState {
  const track = state.hostility[pair];
  return { ...state, hostility: { ...state.hostility, [pair]: { ...track, value } } };
}

function sessionEvent(state: GameState): CharacterEvent {
  const event = buildMeetEvent(state, 'witch', leader.name, leader.id);
  return { ...event, id: 'meet-test' };
}

test('v123 出场阵容：首领 + 1 位随从；火气不到 50 不拉对立势力', () => {
  const cold = withHostility(stateWithRoster(), 'association-witch', 49);
  assert.deepEqual(factionSceneCast(cold, 'witch'), [leader.id, mate.id]);
});

test('v123 出场阵容：火气 ≥ 50 才把对立势力的代表也叫来', () => {
  const hot = withHostility(stateWithRoster(), 'association-witch', 50);
  const cast = factionSceneCast(hot, 'witch');
  assert.equal(cast.length, 3, cast.join(','));
  assert.equal(cast[0], leader.id);
  assert.equal(cast[1], mate.id);
  assert.equal(cast[2], rival.id, '火气最高的那一方的领袖到场');
});

test('v123 召见与登门拜访都用这套阵容', () => {
  const hot = withHostility(stateWithRoster(), 'association-witch', 60);
  const summon = buildSummonEvent(hot, 'witch');
  assert.ok(summon);
  assert.deepEqual(summon!.cast, factionSceneCast(hot, 'witch'));
  const meet = buildMeetEvent(hot, 'witch', leader.name, leader.id);
  assert.deepEqual(meet.cast, factionSceneCast(hot, 'witch'));
});

test('v123 空席不硬凑：没有随从就只带首领', () => {
  const bare: GameState = {
    ...stateWithRoster(),
    factionRoster: {
      association: { leaderId: rival.id, memberIds: [] },
      government: { leaderId: '', memberIds: [] },
      witch: { leaderId: leader.id, memberIds: [] },
    },
  };
  assert.deepEqual(factionSceneCast(bare, 'witch'), [leader.id]);
});

test('v123 玩家先写开场：seed 落进事件，并把旧开场清空（= 重写）', () => {
  const state = stateWithRoster();
  const event = sessionEvent(state);
  const played: CharacterEvent = {
    ...event,
    opening: '旧的定死开场。',
    turns: [{ id: 't1', role: 'narrator', text: '旧的定死开场。', lines: [], at: 1 }],
  };
  const started: GameState = { ...state, events: [played] };
  const result = applySeedStorySession(started, { type: 'seedStorySession', eventId: played.id, seed: '我推门进去，外头在下雨。' });
  assert.equal(result.ok, true, result.message);
  const next = result.state.events.find(item => item.id === played.id)!;
  assert.equal(next.playerSeed, '我推门进去，外头在下雨。');
  assert.equal(next.opening, undefined, '重写开场要把旧开场清掉');
  assert.equal(next.turns, undefined, '旧的对白也一起清掉');
});

test('v123 已经结束的事件不接受新开场', () => {
  const state = stateWithRoster();
  const done: CharacterEvent = { ...sessionEvent(state), status: 'done' };
  const started: GameState = { ...state, events: [done] };
  const result = applySeedStorySession(started, { type: 'seedStorySession', eventId: done.id, seed: '再来一次。' });
  assert.equal(result.ok, false);
});

test('v123 开场提示词：所长写的那段要原样进去，并且不再让模型另起炉灶', () => {
  const state = stateWithRoster();
  const event = sessionEvent(state);
  const context = storyOpeningContextForTest(state, event, '我推门进去，外头在下雨。');
  assert.ok(context.includes('我推门进去，外头在下雨。'), context);
  assert.ok(context.includes('【所长的开场】'), context);
  assert.ok(context.includes('引子'), '引子仍然要在，给模型兜底');
});

test('v123 没写开场时提示词不出现空的开场块', () => {
  const state = stateWithRoster();
  const event = sessionEvent(state);
  const context = storyOpeningContextForTest(state, event, '');
  assert.ok(!context.includes('【所长的开场】'), context);
});
