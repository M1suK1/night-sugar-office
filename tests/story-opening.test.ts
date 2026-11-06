import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
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
  appearance: '银发扎成低马尾，袖口沾着灯油。', personality: '说话很轻，从不抢话。',
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
  assert.ok(context.includes('由所长先说'), '要写明这一段是所长先开口');
});

test('v169 首领约谈：写死的引子不进提示词，开场由玩家先开口', () => {
  const state = stateWithRoster();
  const event = sessionEvent(state);
  assert.equal(event.hookInPrompt, false, '约谈事件的引子只给界面看');
  const context = storyOpeningContextForTest(state, event, '我把帖子放在门缝里。');
  assert.ok(!context.includes(event.hook), '那句「你让人递了帖子…」不该进提示词');
  assert.ok(!context.includes('引子：'), context);
  assert.ok(context.includes('我把帖子放在门缝里。'), '玩家的开场要进去');
  // v169：在场的人（尤其是名册里的随从）要带上外貌与性情，不能只有一句点头衔。
  assert.ok(context.includes('银发扎成低马尾'), '随从的外貌要进提示词');
  assert.ok(context.includes('说话很轻'), '随从的性情要进提示词');
});

test('v169 开场：玩家那段成为对白的第一轮，叙事者的开场白接在后面', () => {
  const state = stateWithRoster();
  const event = sessionEvent(state);
  const started: GameState = { ...state, events: [event] };
  const result = act(started, {
    type: 'startStorySession', eventId: event.id, cast: [leader.id], opening: '她把门推开一条缝。', lines: [], options: [], seed: '我把帖子放在门缝里。',
  });
  assert.equal(result.ok, true, result.message);
  const turns = result.state.events.find(item => item.id === event.id)!.turns!;
  assert.equal(turns.length, 2);
  assert.equal(turns[0]!.role, 'player', '第一轮必须是玩家先说的');
  assert.equal(turns[0]!.text, '我把帖子放在门缝里。');
  assert.equal(turns[1]!.role, 'narrator');
});

test('v123 没写开场时提示词不出现空的开场块', () => {
  const state = stateWithRoster();
  const event = sessionEvent(state);
  const context = storyOpeningContextForTest(state, event, '');
  assert.ok(!context.includes('【所长的开场】'), context);
});
