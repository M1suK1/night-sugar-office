import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { advanceStoryGraph } from '../src/rules/storyRun.ts';
import { newlyFinishedStories, storylineStatuses } from '../src/storylineEnding.ts';
import type { Storyline } from '../src/types.ts';

const storyWithEnding = (summary?: string): Storyline => {
  const state = createInitialState();
  return {
    id: 'story-v232', girlId: state.girls[0]!.id, title: '雨里的访客',
    premise: '她在门口停了很久。', tone: '安静', beats: [], stage: 0,
    status: 'active', createdAt: '', day: 3, source: 'manual',
    graph: {
      version: 1, entry: 'start',
      nodes: [
        { id: 'start', kind: 'start', x: 0, y: 0, title: '开始', data: { kind: 'start' } },
        { id: 'end', kind: 'end', x: 0, y: 120, title: '留下的结局', data: { kind: 'end', ending: '留下', summary } },
      ],
      edges: [{ id: 'edge-1', from: 'start', fromPort: 'out', to: 'end' }],
    },
    run: { cursor: 'start', visited: [], steps: 0 },
  } as Storyline;
};

test('v232 走到结束节点时记下结语', () => {
  const state = createInitialState();
  const story = storyWithEnding('她把伞挂在门边，说明天还会来。');
  advanceStoryGraph(state, story);
  assert.equal(story.status, 'done');
  assert.equal(story.ending, '留下');
  assert.equal(story.endingSummary, '她把伞挂在门边，说明天还会来。');
});

test('v232 结局弹窗的通知带上结束节点结语', () => {
  const state = createInitialState();
  const story = storyWithEnding('雨停了，桌上的茶还是温的。');
  const before = storylineStatuses([{ ...story }]);
  advanceStoryGraph(state, story);
  const notices = newlyFinishedStories(before, [story]);
  assert.equal(notices.length, 1);
  assert.equal(notices[0]!.ending, '留下');
  assert.equal(notices[0]!.summary, '雨停了，桌上的茶还是温的。');
});

test('v232 结束节点没写结语时通知留空，不硬编一段', () => {
  const state = createInitialState();
  const story = storyWithEnding(undefined);
  const before = storylineStatuses([{ ...story }]);
  advanceStoryGraph(state, story);
  assert.equal(story.endingSummary, undefined);
  assert.equal(newlyFinishedStories(before, [story])[0]!.summary, undefined);
});
