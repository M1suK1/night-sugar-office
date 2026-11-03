import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingChoiceIn } from '../src/rules/storyChoice.ts';
import type { Storyline } from '../src/types.ts';

function storyline(patch: Record<string, unknown>): Storyline {
  return {
    id: 'st-1', girlId: 'g1', status: 'active', title: '旧楼', premise: '', beats: [],
    graph: {
      nodes: [
        { id: 'c1', kind: 'choice', title: '雨停之前', x: 0, y: 0, data: { kind: 'choice', prompt: '', options: [{ id: 'stay', label: '让她留下' }, { id: 'go', label: '放她走' }] } },
        { id: 's1', kind: 'scene', title: '开场', x: 0, y: 0, data: { kind: 'scene', prompt: '' } },
      ],
      edges: [],
    },
    run: { nodeId: 'c1', waiting: { kind: 'choice', ref: 'c1' } },
    ...patch,
  } as unknown as Storyline;
}

test('v82 认出卡在选项上的蓝图：只认 choice 且选项非空', () => {
  const ready = pendingChoiceIn(storyline({}));
  assert.equal(ready?.nodeId, 'c1');
  assert.deepEqual(ready?.options.map(option => option.id), ['stay', 'go']);
  assert.equal(pendingChoiceIn(storyline({ run: { nodeId: 's1', waiting: { kind: 'event', ref: 's1' } } })), undefined, '等事件不算等选项');
  assert.equal(pendingChoiceIn(undefined), undefined);
  const empty = storyline({});
  (empty.graph!.nodes[0] as unknown as { data: { options: unknown[] } }).data.options = [];
  assert.equal(pendingChoiceIn(empty), undefined, '没有选项就不该卡住');
});

test('v82 蓝图分支的文案只来自节点，不给模型自行发挥的空间', () => {
  const ready = pendingChoiceIn(storyline({}))!;
  assert.deepEqual(ready.options, [{ id: 'stay', label: '让她留下' }, { id: 'go', label: '放她走' }]);
  assert.equal(ready.title, '雨停之前');
});
