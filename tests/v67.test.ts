import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { sanitizeGraph, makeNode } from '../src/storygraph.ts';
import { blockingIncidents } from '../src/incidents.ts';
import type { Incident, StoryGraph } from '../src/types.ts';

function graphWithIncident(spec: Record<string, unknown>): StoryGraph {
  const graph = sanitizeGraph({
    id: 'g1', title: '测试蓝图', premise: '前提', tone: '克制',
    nodes: [
      { id: 'n1', kind: 'start', x: 0, y: 0, title: '开场', data: { kind: 'start', cast: [] } },
      { id: 'n2', kind: 'incident', x: 200, y: 0, title: '强制弹窗', data: { kind: 'incident', spec: { kind: 'faction', title: '桥头封锁线', body: '市役所把桥头封了半条，检疫官挨个查契约书。', options: [], ...spec } } },
      { id: 'n3', kind: 'end', x: 400, y: 0, title: '收束', data: { kind: 'end', summary: '结束', ending: '收束' } },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', fromPort: 'out' },
      { id: 'e2', from: 'n2', to: 'n3', fromPort: 'out' },
    ],
  });
  assert.ok(graph, '这张图应当能洗干净');
  return graph!;
}

test('v67 蓝图弹窗的三个字段：默认 immediate / 240 / 拦时间', () => {
  const graph = graphWithIncident({});
  const node = graph.nodes.find(entry => entry.id === 'n2')!;
  const spec = node.data.kind === 'incident' ? node.data.spec : undefined;
  assert.equal(spec?.trigger, 'immediate');
  assert.equal(spec?.ttlMinutes, 240);
  assert.equal(spec?.blocking, true);
});

test('v67 手写值会被收下并夹住范围', () => {
  const graph = graphWithIncident({ trigger: 'dayStart', ttlMinutes: 9999, blocking: false });
  const node = graph.nodes.find(entry => entry.id === 'n2')!;
  const spec = node.data.kind === 'incident' ? node.data.spec : undefined;
  assert.equal(spec?.trigger, 'dayStart');
  assert.equal(spec?.ttlMinutes, 480, '超时上限 480');
  assert.equal(spec?.blocking, false);
  const tuned = graphWithIncident({ ttlMinutes: 5 });
  const tunedSpec = (tuned.nodes.find(entry => entry.id === 'n2')!.data as { spec: { ttlMinutes: number } }).spec;
  assert.equal(tunedSpec.ttlMinutes, 30, '下限 30');
});

test('v67 blocking=false 的弹窗不再拦时间', () => {
  const state = createInitialState();
  const base: Incident = {
    id: 'inc-x', day: state.day, kind: 'faction', source: 'rule', title: '通报', body: '正文',
    options: [], status: 'pending', category: 'decision',
  };
  state.incidents = [base];
  assert.equal(blockingIncidents(state).length, 1, '默认要拦');
  state.incidents = [{ ...base, id: 'inc-y', blocking: false }];
  assert.equal(blockingIncidents(state).length, 0, '标了 false 就不拦');
  state.incidents = [{ ...base, id: 'inc-z', category: 'report' }];
  assert.equal(blockingIncidents(state).length, 0, '纯通报本来就不拦');
});

test('v67 新节点默认值也带上三个字段（工坊新建时就看得见）', () => {
  const node = makeNode('incident', 0, 0, 'n9');
  assert.equal(node.kind, 'incident');
  if (node.data.kind !== 'incident') return;
  assert.equal(node.data.spec.trigger, 'immediate');
  assert.equal(node.data.spec.ttlMinutes, 240);
  assert.equal(node.data.spec.blocking, true);
});
