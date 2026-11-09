import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { squadLimit } from '../src/rules/roster.ts';
import { storyMissionForBeat } from '../src/rules/storyRun.ts';
import type { StoryBeat, Storyline } from '../src/types.ts';

/**
 * v209：阶段委托后面接角色剧情时，任务必须带上该剧情的 cast。
 */

const missionSpec = (work: 'combat' | 'investigation' = 'investigation') => ({
  title: '护送', goal: '把她送到旧城区。', category: '故事委托', difficulty: '常规', work, duration: 90,
});

function storyWith(cast: string[], viaReward = false): { story: Storyline; beat: StoryBeat; missionNode: string } {
  const missionNode = 'm1';
  const nodes: unknown[] = [
    { id: missionNode, kind: 'mission', x: 0, y: 0, title: '护送', data: { kind: 'mission', spec: missionSpec() } },
  ];
  const edges: unknown[] = [];
  let cursor = missionNode;
  if (viaReward) {
    nodes.push({ id: 'r1', kind: 'reward', x: 0, y: 0, title: '继续', data: { kind: 'reward', effect: {} } });
    edges.push({ id: 'e1', from: missionNode, fromPort: 'success', to: 'r1' });
    cursor = 'r1';
  }
  nodes.push({ id: 'ev1', kind: 'event', x: 0, y: 0, title: '她的夜', data: { kind: 'event', title: '她的夜', hook: '', cast, opening: '' } });
  edges.push({ id: 'e2', from: cursor, fromPort: 'out', to: 'ev1' });
  const story = {
    id: 's1', girlId: 'g1', title: '测试故事', premise: '', tone: '', beats: [], stage: 0,
    status: 'active', createdAt: '', day: 1, source: 'manual',
    graph: { version: 1, entry: missionNode, nodes, edges },
    run: { cursor: missionNode, visited: [], steps: 0 },
  } as unknown as Storyline;
  const beat = { id: missionNode, index: 0, title: '护送', summary: '', scene: '', hook: '', choices: [], mission: missionSpec() } as StoryBeat;
  return { story, beat, missionNode };
}

test('v209 任务后直接接剧情：storyCastIds 取事件 cast', () => {
  const state = createInitialState();
  const ids = state.girls.slice(0, 2).map(girl => girl.id);
  const { story, beat } = storyWith(ids);
  const mission = storyMissionForBeat(state, story, beat);
  assert.deepEqual(mission.storyCastIds, ids);
});

test('v209 任务后隔一个 reward：仍能取到剧情 cast', () => {
  const state = createInitialState();
  const ids = state.girls.slice(0, 2).map(girl => girl.id);
  const { story, beat } = storyWith(ids, true);
  const mission = storyMissionForBeat(state, story, beat);
  assert.deepEqual(mission.storyCastIds, ids);
});

test('v209 事件 cast 为空：回退故事主角', () => {
  const state = createInitialState();
  const { story, beat } = storyWith([]);
  story.girlId = state.girls[0]!.id;
  const mission = storyMissionForBeat(state, story, beat);
  assert.deepEqual(mission.storyCastIds, [state.girls[0]!.id]);
});

test('v209 派遣缺剧情角色会被拒绝，全员到齐才通过', () => {
  const state = createInitialState();
  const ids = state.girls.slice(0, 2).map(girl => girl.id);
  const { story, beat } = storyWith(ids);
  const mission = storyMissionForBeat(state, story, beat);
  state.missions = [mission];
  state.girls.forEach(girl => { girl.status = 'idle'; girl.hp = Math.max(girl.hp, 50); girl.fatigue = 0; });

  const missing = act(state, { type: 'dispatch', missionId: mission.id, girlIds: [ids[0]!] });
  assert.equal(missing.ok, false);
  assert.match(missing.message, /同行|编进小队/);

  const full = act(state, { type: 'dispatch', missionId: mission.id, girlIds: ids });
  assert.equal(full.ok, true, full.message);
});

test('v209 调查任务的剧情要 3 人时，编队上限放宽到 3', () => {
  const state = createInitialState();
  const ids = state.girls.slice(0, 3).map(girl => girl.id);
  const { story, beat } = storyWith(ids);
  const mission = storyMissionForBeat(state, story, beat);
  assert.equal(squadLimit(mission), 3);
});
