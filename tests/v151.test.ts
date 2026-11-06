import test from 'node:test';
import assert from 'node:assert/strict';
import { castBucket, stageAfter } from '../src/vn/stage.ts';
import { splitBattleCast } from '../src/battleNote.ts';
import type { BattleActor } from '../src/battleNote.ts';

function actor(uid: string, side: 'ally' | 'enemy' = 'ally'): BattleActor {
  return {
    uid, side, girlId: uid, name: uid, portrait: '', color: '#f3aec9',
    expression: 'calm', down: false, downRound: null, speakable: true,
  };
}

test('v151 舞台档位：1–6 各自成档，7 人以上归到 many', () => {
  assert.equal(castBucket(0), 1, '空 cast 也按单人格子排，不能塌');
  assert.equal(castBucket(1), 1);
  assert.equal(castBucket(2), 2);
  assert.equal(castBucket(3), 3);
  assert.equal(castBucket(5), 5);
  assert.equal(castBucket(6), 6, '六人必须有自己的档，不能再被截到 5');
  assert.equal(castBucket(7), 'many');
  assert.equal(castBucket(12), 'many');
});

test('v151 原文分栏：六位我方按队序前 3 左、后 3 右', () => {
  const cast = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => actor(id));
  const { left, right } = splitBattleCast(cast);
  assert.deepEqual(left.map(item => item.uid), ['a', 'b', 'c']);
  assert.deepEqual(right.map(item => item.uid), ['d', 'e', 'f']);
});

test('v151 原文分栏：3v3 左我方、右敌方，各三人', () => {
  const allies = ['a1', 'a2', 'a3'].map(id => actor(id, 'ally'));
  const enemies = ['e1', 'e2', 'e3'].map(id => actor(id, 'enemy'));
  const { left, right } = splitBattleCast([...allies, ...enemies]);
  assert.deepEqual(left.map(item => item.uid), ['a1', 'a2', 'a3']);
  assert.deepEqual(right.map(item => item.uid), ['e1', 'e2', 'e3']);
});

test('v151 原文分栏：1–5 人保持现有比例，单人只占左栏', () => {
  const counts = [1, 2, 3, 4, 5];
  for (const count of counts) {
    const cast = Array.from({ length: count }, (_, index) => actor('g' + index));
    const { left, right } = splitBattleCast(cast);
    assert.equal(left.length + right.length, count);
    assert.equal(left.length, Math.ceil(count / 2), count + ' 人时左边应是 ceil 一半');
    assert.equal(right.length, Math.floor(count / 2));
    assert.deepEqual(left.map(item => item.uid), cast.slice(0, left.length).map(item => item.uid));
  }
});

test('v151 舞台换人：从 3 人扩到 6 人，老人保序、新人按开口顺序追加', () => {
  const next = stageAfter(['a', 'b', 'c'], ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.ok(next);
  assert.deepEqual(next!.ids, ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(next!.entering, ['d', 'e', 'f']);
  assert.deepEqual(next!.leaving, []);
});

test('v151 舞台换人：六人里只剩两人时，其余四人退场', () => {
  const next = stageAfter(['a', 'b', 'c', 'd', 'e', 'f'], ['b', 'e']);
  assert.ok(next);
  assert.deepEqual(next!.ids, ['b', 'e']);
  assert.deepEqual(next!.entering, []);
  assert.deepEqual(next!.leaving, ['a', 'c', 'd', 'f']);
});

test('v151 舞台换人：同一批六人不重排', () => {
  const same = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(stageAfter(same, [...same]), null);
});
