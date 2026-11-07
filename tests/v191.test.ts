import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { storyBackdropOf, backdropChoicesText, isBackdropId, BACKDROP_IDS } from '../src/vn/backdrops.ts';
import { buildGraphFromDraft } from '../src/storygraph.ts';
import { archiveStoryRecord, replayEventOf } from '../src/storyArchive.ts';
import { arcOpeningContract, SECTION_PROMPTS, storylineContract } from '../src/promptSections.ts';
import type { CharacterEvent, GameState } from '../src/types.ts';

const sessionEvent = (state: GameState): CharacterEvent => ({
  id: 'ev-bd', girlId: state.girls[0]!.id, title: '雨夜的便利店', hook: '她在门口等你',
  scenes: [], stage: 0, status: 'active', day: 14, source: 'template', badge: true,
  mode: 'session', opening: '', cast: [state.girls[0]!.id], turns: [],
} as CharacterEvent);

test('v191 背景清单：九块辖区 + 四个房间，只认这些 id', () => {
  assert.equal(BACKDROP_IDS.length, 13);
  assert.equal(isBackdropId('docks'), true);
  assert.equal(isBackdropId('room:lounge'), true);
  assert.equal(isBackdropId('beach'), false);
  assert.equal(isBackdropId(undefined), false);
  const text = backdropChoicesText();
  for (const id of BACKDROP_IDS) assert.ok(text.includes(id), id);
  assert.ok(text.includes('糖果公园'));
  assert.ok(text.includes('会客厅'));
});

test('v191 剧情背景优先用叙事者选的那张，认不出来才退回旧规则', () => {
  assert.equal(storyBackdropOf({ id: 'e1', backdrop: 'docks' }).id, 'docks');
  assert.equal(storyBackdropOf({ id: 'e1', backdrop: 'room:clinic' }).id, 'room:clinic');
  const fallback = storyBackdropOf({ id: 'e1' }).id;
  assert.equal(storyBackdropOf({ id: 'e1', backdrop: 'beach' }).id, fallback, '非法 id 当作没写');
  assert.notEqual(fallback, '' as unknown as string);
});

test('v191 蓝图草稿里的 backdrop 会保留，非法值被丢掉', () => {
  const graph = buildGraphFromDraft({
    title: '测试', nodes: [
      { id: 'n1', kind: 'start', title: '开始', data: { kind: 'start' } },
      { id: 'n2', kind: 'event', title: '事件', data: { kind: 'event', title: '夜里', hook: '', cast: [], opening: '', backdrop: 'greenhouse' } },
      { id: 'n3', kind: 'event', title: '事件', data: { kind: 'event', title: '夜里', hook: '', cast: [], opening: '', backdrop: 'beach' } },
    ],
    edges: [{ from: 'n1', to: 'n2', fromPort: 'out' }, { from: 'n2', to: 'n3', fromPort: 'out' }],
  } as never);
  const events = graph.nodes.filter(node => node.kind === 'event');
  assert.equal(events[0]?.data.kind === 'event' ? events[0].data.backdrop : 'x', 'greenhouse');
  assert.equal(events[1]?.data.kind === 'event' ? events[1].data.backdrop : 'x', undefined);
});

test('v191 开场白写进事件时把背景一起落下', () => {
  const state = createInitialState();
  const event = sessionEvent(state);
  const ok = act({ ...state, events: [event] } as GameState, {
    type: 'startStorySession', eventId: event.id, cast: event.cast, opening: '她站在码头。', backdrop: 'docks',
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.state.events[0]!.backdrop, 'docks');

  const bad = act({ ...state, events: [event] } as GameState, {
    type: 'startStorySession', eventId: event.id, cast: event.cast, opening: '她站在码头。', backdrop: 'beach',
  });
  assert.equal(bad.ok, true);
  assert.equal(bad.state.events[0]!.backdrop, undefined);
});

test('v191 存进记忆的副本也记得背景，回看时不再随机换地方', () => {
  const event = { ...sessionEvent(createInitialState()), backdrop: 'cathedral', turns: [
    { id: 'n1', role: 'narrator' as const, text: '烛火亮着。', lines: [] },
  ] };
  const story = archiveStoryRecord(event as CharacterEvent);
  assert.equal(story.backdrop, 'cathedral');
  assert.equal(replayEventOf(story).backdrop, 'cathedral');
});

test('v191 提示词里给了背景清单，并要求和地点一致', () => {
  const opening = arcOpeningContract();
  assert.ok(opening.includes('"backdrop"'));
  assert.ok(opening.includes('{{backdrops}}'), '契约用宏引用清单，背景增减不用改契约');
  const nodes = SECTION_PROMPTS.find(entry => entry.id === 'sl-nodes');
  assert.ok(nodes?.content.includes('backdrop'));
  assert.ok(nodes?.content.includes('{{backdrops}}'));
  const blueprint = storylineContract();
  assert.ok(blueprint.includes('backdrop'), '蓝图契约也要写，老预设没改过契约时会跟着更新');
  assert.ok(blueprint.includes('{{backdrops}}'));
});
