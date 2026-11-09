import test from 'node:test';
import assert from 'node:assert/strict';
import { NODE_LABELS, buildGraphFromDraft, sanitizeGraph } from '../src/storygraph.ts';

/**
 * v208：蓝图节点标题回退。
 * 空 title 不能留白：结束节点用 data.ending，其次用种类名。
 */

test('v208 生成蓝图：结束节点没有 title 也没有 ending 时回退到「结束」', () => {
  const graph = buildGraphFromDraft({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      { id: 'n2', kind: 'end', data: { kind: 'end' } },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
  });
  assert.equal(graph.nodes.find(node => node.id === 'n2')?.title, NODE_LABELS.end);
});

test('v208 生成蓝图：结束节点空 title 时优先用 data.ending', () => {
  const graph = buildGraphFromDraft({
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      { id: 'n2', kind: 'end', title: '   ', data: { kind: 'end', ending: '留下的夜' } },
    ],
    edges: [{ from: 'n1', to: 'n2' }],
  });
  assert.equal(graph.nodes.find(node => node.id === 'n2')?.title, '留下的夜');
});

test('v208 清洗：空标题的普通节点回退到种类名', () => {
  const graph = sanitizeGraph({
    version: 1, entry: 'n1',
    nodes: [
      { id: 'n1', kind: 'start', title: '', data: { kind: 'start' } },
      { id: 'n2', kind: 'event', title: '  ', data: { kind: 'event', title: '', hook: '' } },
      { id: 'n3', kind: 'end', title: '', data: { kind: 'end' } },
    ],
    edges: [{ id: 'e1', from: 'n1', fromPort: 'out', to: 'n2' }, { id: 'e2', from: 'n2', fromPort: 'out', to: 'n3' }],
  });
  assert.ok(graph);
  assert.equal(graph!.nodes.find(node => node.id === 'n1')?.title, NODE_LABELS.start);
  assert.equal(graph!.nodes.find(node => node.id === 'n2')?.title, NODE_LABELS.event);
  assert.equal(graph!.nodes.find(node => node.id === 'n3')?.title, NODE_LABELS.end);
});

test('v208 存读一轮：已经空掉的标题会被补回', () => {
  const first = sanitizeGraph({
    version: 1, entry: 'n1',
    nodes: [
      { id: 'n1', kind: 'start', title: '开始', data: { kind: 'start' } },
      { id: 'n2', kind: 'end', title: '', data: { kind: 'end', ending: '留下' } },
    ],
    edges: [{ id: 'e1', from: 'n1', fromPort: 'out', to: 'n2' }],
  });
  assert.equal(first?.nodes.find(node => node.id === 'n2')?.title, '留下');
  const second = sanitizeGraph(JSON.parse(JSON.stringify(first)));
  assert.equal(second?.nodes.find(node => node.id === 'n2')?.title, '留下');
});
