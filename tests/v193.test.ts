import test from 'node:test';
import assert from 'node:assert/strict';
import { newlyFinishedStories, storylineStatuses } from '../src/storylineEnding.ts';
import type { Storyline } from '../src/types.ts';

const story = (patch: Partial<Storyline>): Storyline => ({
  id: 's1', girlId: 'yue', title: '窗边的位置', premise: '她想把窗边留给新来的人。', tone: '克制',
  beats: [], stage: 1, status: 'active', createdAt: '', day: 14, source: 'template',
  ...patch,
});

test('v193 从进行中走到结局时产生一条通知', () => {
  const before = storylineStatuses([story({ status: 'active' })]);
  const fresh = newlyFinishedStories(before, [story({ status: 'done', ending: '窗边的灯' })]);
  assert.equal(fresh.length, 1);
  assert.deepEqual(fresh[0], { id: 's1', title: '窗边的位置', ending: '窗边的灯', girlId: 'yue', premise: '她想把窗边留给新来的人。', day: 14 });
});

test('v193 已经结束的故事、读档时本来结束的故事都不补弹', () => {
  const done = story({ status: 'done', ending: '窗边的灯' });
  assert.equal(newlyFinishedStories(storylineStatuses([done]), [done]).length, 0, 'done → done 不该弹');
  assert.equal(newlyFinishedStories(new Map(), [done]).length, 0, '一进来就是 done 的旧故事不该弹');
});

test('v193 没有结局标签的收束（死路）不弹', () => {
  const before = storylineStatuses([story({ status: 'active' })]);
  assert.equal(newlyFinishedStories(before, [story({ status: 'done' })]).length, 0);
  assert.equal(newlyFinishedStories(before, [story({ status: 'done', ending: '   ' })]).length, 0);
});

test('v193 多条同时结束按故事线顺序排队', () => {
  const before = storylineStatuses([story({ id: 'a' }), story({ id: 'b' })]);
  const fresh = newlyFinishedStories(before, [
    story({ id: 'a', status: 'done', ending: '甲' }),
    story({ id: 'b', status: 'done', ending: '乙' }),
  ]);
  assert.deepEqual(fresh.map(item => item.ending), ['甲', '乙']);
});
