import test from 'node:test';
import assert from 'node:assert/strict';
import { rotateSide } from '../src/storySlots.ts';
import { stageRows, swapSpeaker } from '../src/vn/stage.ts';

test('v152 原文轮转：悬停后排时 A→C、B→A、C→B', () => {
  const order = ['a', 'b', 'c'];
  assert.deepEqual(rotateSide(order, 'c'), ['b', 'c', 'a'], 'c 到前排右，b 到前排左，a 退到后排');
});

test('v152 原文轮转：悬停前排的人不动', () => {
  const order = ['a', 'b', 'c'];
  assert.equal(rotateSide(order, 'a'), order);
  assert.equal(rotateSide(order, 'b'), order);
});

test('v152 原文轮转：人数不足三人、或 id 不在本侧时原样返回', () => {
  assert.deepEqual(rotateSide(['a', 'b'], 'b'), ['a', 'b']);
  assert.deepEqual(rotateSide(['a'], 'a'), ['a']);
  const order = ['a', 'b', 'c'];
  assert.equal(rotateSide(order, 'zzz'), order);
  assert.equal(rotateSide(order, ''), order);
});

test('v152 舞台两排：三人及以下全在前排，六人前三后三', () => {
  assert.deepEqual(stageRows(['a', 'b', 'c']), { front: ['a', 'b', 'c'], back: [] });
  assert.deepEqual(stageRows(['a', 'b', 'c', 'd']), { front: ['a', 'b', 'c'], back: ['d'] });
  assert.deepEqual(stageRows(['a', 'b', 'c', 'd', 'e', 'f']), {
    front: ['a', 'b', 'c'],
    back: ['d', 'e', 'f'],
  });
});

test('v152 舞台换位：后排说话时与同列前排互换', () => {
  const rows = { front: ['a', 'b', 'c'], back: ['d', 'e', 'f'] };
  assert.deepEqual(swapSpeaker(rows, 'e'), {
    front: ['a', 'e', 'c'],
    back: ['d', 'b', 'f'],
  }, 'e 站到前排第二格，b 退到后排第二格');
});

test('v152 舞台换位：前排说话、或说话人不在台上时不动', () => {
  const rows = { front: ['a', 'b', 'c'], back: ['d', 'e', 'f'] };
  assert.equal(swapSpeaker(rows, 'a'), rows);
  assert.equal(swapSpeaker(rows, 'zzz'), rows);
  const solo = { front: ['a'], back: [] };
  assert.equal(swapSpeaker(solo, 'a'), solo, '只有前排一人时不动');
});

test('v152 舞台换位：连续换位保持稳定，不会把同一人换回去', () => {
  const first = swapSpeaker({ front: ['a', 'b', 'c'], back: ['d', 'e', 'f'] }, 'd');
  assert.deepEqual(first, { front: ['d', 'b', 'c'], back: ['a', 'e', 'f'] });
  assert.equal(swapSpeaker(first, 'd'), first, 'd 已经在前排，再说话不该动');
  const second = swapSpeaker(first, 'f');
  assert.deepEqual(second, { front: ['d', 'b', 'f'], back: ['a', 'e', 'c'] });
});
