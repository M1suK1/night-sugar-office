import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { generateStoryEnding } from '../src/llm.ts';
import { arcEndingContract } from '../src/promptSections.ts';
import { nextChoiceAfterEvent } from '../src/rules/storyChoice.ts';
import type { CharacterEvent, GameState, Storyline } from '../src/types.ts';

/**
 * v205：收尾时由叙事者代玩家选定蓝图分支。
 * 只决定走哪条边；效果仍由本地按 option.effect 结算。
 * 失败 / 无模型时回退档案页手选。
 */

const CHOICE = {
  storylineId: 's1', nodeId: 'c1', title: '门口',
  options: [{ id: 'a', label: '留下' }, { id: 'b', label: '离开' }],
};

function graphStory(nodes: unknown[], edges: unknown[], entry = 'ev'): Storyline {
  return {
    id: 's1', girlId: 'g1', status: 'active', title: '', premise: '', beats: [],
    graph: { version: 1, entry, nodes, edges },
    run: { cursor: entry, visited: [], steps: 0 },
  } as unknown as Storyline;
}

const eventNode = (id: string) => ({ id, kind: 'event', x: 0, y: 0, title: id, data: { kind: 'event', title: id, hook: '' } });
const choiceNode = (id: string) => ({ id, kind: 'choice', x: 0, y: 0, title: '门口', data: { kind: 'choice', options: CHOICE.options } });
const rewardNode = (id: string) => ({ id, kind: 'reward', x: 0, y: 0, title: id, data: { kind: 'reward', effect: { bond: 1 } } });
const waitNode = (id: string, minutes: number) => ({ id, kind: 'wait', x: 0, y: 0, title: id, data: { kind: 'wait', minutes } });
const endNode = (id: string) => ({ id, kind: 'end', x: 0, y: 0, title: id, data: { kind: 'end', summary: '', ending: '完' } });
const edge = (from: string, to: string, fromPort = 'out') => ({ id: from + '-' + to + '-' + fromPort, from, fromPort, to });
const eventOf = () => ({ storyNodeId: 'ev' } as CharacterEvent);

test('v205 预读：event 后的 choice 能拿到选项；被另一个 event 挡住则返回空', () => {
  const direct = graphStory([eventNode('ev'), choiceNode('c1')], [edge('ev', 'c1')]);
  assert.deepEqual(nextChoiceAfterEvent(direct, eventOf())?.options.map(option => option.id), ['a', 'b']);

  const blocked = graphStory([eventNode('ev'), eventNode('ev2'), choiceNode('c1')], [edge('ev', 'ev2'), edge('ev2', 'c1')]);
  assert.equal(nextChoiceAfterEvent(blocked, eventOf()), undefined);
});

test('v205 预读：可以穿过 reward 与 0 时长 wait，遇到 wait>0 就停下', () => {
  const throughReward = graphStory([eventNode('ev'), rewardNode('r1'), choiceNode('c1')], [edge('ev', 'r1'), edge('r1', 'c1')]);
  assert.equal(nextChoiceAfterEvent(throughReward, eventOf())?.nodeId, 'c1');

  const throughWait = graphStory([eventNode('ev'), waitNode('w0', 0), choiceNode('c1')], [edge('ev', 'w0'), edge('w0', 'c1')]);
  assert.equal(nextChoiceAfterEvent(throughWait, eventOf())?.nodeId, 'c1');

  const blocked = graphStory([eventNode('ev'), waitNode('w1', 60), choiceNode('c1')], [edge('ev', 'w1'), edge('w1', 'c1')]);
  assert.equal(nextChoiceAfterEvent(blocked, eventOf()), undefined);
});

test('v205 收尾契约：有分支才出现 choice 字段与允许的 id', () => {
  const withChoice = arcEndingContract(CHOICE.options);
  assert.ok(withChoice.includes('"choice"'));
  assert.ok(withChoice.includes('只能取：a、b'), '把允许的 id 列给模型');
  assert.ok(withChoice.includes('留下'), '选项文案也要进契约');

  const base = arcEndingContract();
  assert.ok(!base.includes('"choice"'), '没有分支时保持旧契约');
});

function startedGraph() {
  const base = createInitialState();
  const girl = base.girls[0]!;
  girl.bond = 60;
  const graph = {
    version: 1, entry: 'n1',
    nodes: [
      { id: 'n1', kind: 'start', x: 0, y: 0, title: '开始', data: { kind: 'start' } },
      { id: 'n2', kind: 'event', x: 0, y: 0, title: '她的夜', data: { kind: 'event', title: '她的夜', hook: '一句', cast: [girl.id], opening: '开场' } },
      { id: 'n3', kind: 'choice', x: 0, y: 0, title: '门口', data: { kind: 'choice', options: [{ id: 'a', label: '留下', effect: { bond: 8 } }, { id: 'b', label: '离开', effect: { bond: 2 } }] } },
      { id: 'n4', kind: 'end', x: 0, y: 0, title: '结束', data: { kind: 'end', summary: '完', ending: '完' } },
    ],
    edges: [edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n4', 'a'), edge('n3', 'n4', 'b')],
  };
  const saved = act(base, { type: 'setStoryPlan', girlId: girl.id, plan: { title: '探针', premise: '', tone: '', beats: [], graph } });
  assert.equal(saved.ok, true, saved.message);
  saved.state.girls[0]!.bond = 60;
  const opened = act(saved.state, { type: 'startStoryline', girlId: girl.id });
  assert.equal(opened.ok, true, opened.message);
  const story = opened.state.storylines[0]!;
  const eventId = story.run?.waiting?.ref as string;
  assert.equal(story.run?.waiting?.kind, 'event');
  return { state: opened.state, eventId, storylineId: story.id, girlId: girl.id };
}

test('v205 带 port 收尾：直接走分支，效果只结算一次', () => {
  const { state, eventId, storylineId } = startedGraph();
  const result = act(state, {
    type: 'finishStorySession', eventId, port: 'a',
    ending: { narration: '她留了下来。', lines: [] }, summary: '她留了下来。',
  });
  assert.equal(result.ok, true, result.message);
  const story = result.state.storylines.find(item => item.id === storylineId)!;
  const event = result.state.events.find(item => item.id === eventId)!;
  assert.equal(event.status, 'done');
  assert.equal(event.pendingChoice, undefined);
  assert.equal(story.status, 'done');
  assert.equal(story.run, undefined);
  assert.equal(story.ending, '完');
  assert.equal(result.state.girls[0]!.bond, 68, '60 + 分支 8，事件本身没有玩家轮次');
});

test('v205 不带 port 是手选兜底；非法 port 不动状态', () => {
  const fallback = startedGraph();
  const closed = act(fallback.state, {
    type: 'finishStorySession', eventId: fallback.eventId,
    ending: { narration: '她停在门口。', lines: [] }, summary: '她停在门口。',
  });
  assert.equal(closed.ok, true, closed.message);
  const waiting = closed.state.storylines.find(item => item.id === fallback.storylineId)!;
  assert.equal(waiting.status, 'active');
  assert.equal(waiting.run?.waiting?.kind, 'choice');
  assert.equal(waiting.run?.waiting?.ref, 'n3');

  const rejected = startedGraph();
  const before = rejected.state.girls[0]!.bond;
  const bad = act(rejected.state, {
    type: 'finishStorySession', eventId: rejected.eventId, port: 'z',
    ending: { narration: '她停在门口。', lines: [] }, summary: '她停在门口。',
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.state.events.find(item => item.id === rejected.eventId)!.status, 'active');
  assert.equal(bad.state.girls[0]!.bond, before);
});

function sessionEvent(state: GameState): CharacterEvent {
  return {
    id: 'ev-end', girlId: state.girls[0]!.id, title: '雨夜', hook: '她在门口等你',
    scenes: [], stage: 0, status: 'active', day: 14, source: 'template', badge: true,
    mode: 'session', opening: '雨下得很大。', cast: [state.girls[0]!.id], turns: [],
  } as CharacterEvent;
}

function mockResponse(body: unknown) {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(body) }] } }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10, totalTokenCount: 20 },
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}

test('v205 收尾生成：合法 choice 原样带出，请求里带分支', async () => {
  const original = globalThis.fetch;
  let body = '';
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    body = String(init?.body ?? '');
    return mockResponse({ narration: '灯光在雨里散成一团。'.repeat(20), lines: [], summary: '她留下了。', choice: 'a' });
  }) as typeof fetch;
  try {
    const state = createInitialState();
    const result = await generateStoryEnding(
      { endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock', provider: 'vertex' } as never,
      state, sessionEvent(state), undefined, undefined, CHOICE,
    );
    assert.equal(result.ok, true, result.ok ? '' : result.message);
    if (result.ok) assert.equal(result.choice, 'a');
  } finally {
    globalThis.fetch = original;
  }
  assert.ok(body.includes('留下'));
  assert.ok(body.includes('只能取：a、b'));
  assert.ok(body.includes('choice'));
});

test('v205 收尾生成：非法 choice 返修一次，仍非法就留空（手选兜底）', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return mockResponse({
      narration: '灯光在雨里散成一团。'.repeat(20), lines: [], summary: '她留下了。',
      choice: calls === 1 ? 'z' : 'a',
    });
  }) as typeof fetch;
  try {
    const state = createInitialState();
    const fixed = await generateStoryEnding(
      { endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock', provider: 'vertex' } as never,
      state, sessionEvent(state), undefined, undefined, CHOICE,
    );
    assert.equal(fixed.ok, true, fixed.ok ? '' : fixed.message);
    if (fixed.ok) assert.equal(fixed.choice, 'a');
    assert.equal(calls, 2, '非法一次后要返修');

    calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return mockResponse({ narration: '灯光在雨里散成一团。'.repeat(20), lines: [], summary: '她留下了。', choice: 'z' });
    }) as typeof fetch;
    const failed = await generateStoryEnding(
      { endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock', provider: 'vertex' } as never,
      state, sessionEvent(state), undefined, undefined, CHOICE,
    );
    assert.equal(failed.ok, true, failed.ok ? '' : failed.message);
    if (failed.ok) assert.equal(failed.choice, undefined, '分支留空，交给档案页手选');
    assert.equal(calls, 2, '返修一次后不再重试');
  } finally {
    globalThis.fetch = original;
  }
});
