import test from 'node:test';
import assert from 'node:assert/strict';
import { orderStorylinesBySlot } from '../src/storyplan.ts';

test('v214 已结束的故事线按段号排，不按数组顺序', () => {
  const list = [
    { id: 'second', slot: 2, day: 5, title: '第二段' },
    { id: 'first', slot: 1, day: 1, title: '第一段' },
  ];
  assert.deepEqual(orderStorylinesBySlot(list).map(item => item.title), ['第一段', '第二段']);
  assert.deepEqual(list.map(item => item.title), ['第二段', '第一段'], '不要改原数组');
});

test('v214 老数据没有段号时按第 1 段算', () => {
  const list = [
    { id: 'second', slot: 2, day: 5 },
    { id: 'legacy', day: 2 },
    { id: 'third', slot: 3, day: 9 },
  ];
  assert.deepEqual(orderStorylinesBySlot(list).map(item => item.id), ['legacy', 'second', 'third']);
});
