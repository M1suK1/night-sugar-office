import test from 'node:test';
import assert from 'node:assert/strict';
import { randomStarterAssignment, shuffleWith } from '../src/roster.ts';
import type { RosterSubject } from '../src/factions.ts';
import { FACTION_ORDER } from '../src/territories.ts';

const subject = (id: string, faction: RosterSubject['faction'] = 'none'): RosterSubject => ({
  id, name: id, faction, title: '外来者', level: 3, color: '#fff', portrait: '', quote: '……', origin: 'custom',
});

/** 可复现的伪随机：同样的种子给同样的序列。 */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

test('v37 随机编成：名册 2 位，三方各一位首领与随从，互不重复', () => {
  const pool = Array.from({ length: 12 }, (_, index) => subject(`g${index}`));
  const assignment = randomStarterAssignment(pool, { count: 2, random: lcg(42) });
  assert.ok(assignment);
  const { picked, roster } = assignment!;
  assert.equal(picked.length, 2);

  const seated: string[] = [];
  for (const faction of FACTION_ORDER) {
    assert.ok(picked.length === 2);
    assert.ok(roster[faction].leaderId, `${faction} 应该有首领`);
    assert.equal(roster[faction].memberIds.length, 1, `${faction} 应该有一位随从`);
    seated.push(roster[faction].leaderId, ...roster[faction].memberIds);
  }
  const all = [...picked, ...seated];
  assert.equal(new Set(all).size, all.length, '同一个人不能坐两个位置');
  assert.ok(all.every(id => pool.some(person => person.id === id)), '分配结果必须来自池子');
});

test('v37 随机编成：同一种子得到同一组分配', () => {
  const pool = Array.from({ length: 10 }, (_, index) => subject(`g${index}`));
  const first = randomStarterAssignment(pool, { count: 2, random: lcg(2026) });
  const second = randomStarterAssignment(pool, { count: 2, random: lcg(2026) });
  assert.deepEqual(first, second);

  const other = randomStarterAssignment(pool, { count: 2, random: lcg(7) });
  assert.notDeepEqual(first, other, '换一组种子应该换一组人');
});

test('v37 随机编成：池子不够 6 人时交回默认分配', () => {
  const pool = Array.from({ length: 5 }, (_, index) => subject(`g${index}`));
  assert.equal(randomStarterAssignment(pool, { random: lcg(1) }), null);
});

test('v37 随机编成：三个首领优先取同势力的人', () => {
  const pool = [
    subject('w1', 'witch'), subject('w2', 'witch'), subject('w3', 'witch'),
    subject('a1', 'association'), subject('a2', 'association'),
    subject('g1', 'government'), subject('g2', 'government'),
    subject('n1', 'none'), subject('n2', 'none'), subject('n3', 'none'),
  ];
  const assignment = randomStarterAssignment(pool, { count: 2, random: lcg(11) });
  assert.ok(assignment);
  const byId = new Map(pool.map(person => [person.id, person]));
  for (const faction of FACTION_ORDER) {
    const leader = byId.get(assignment!.roster[faction].leaderId)!;
    assert.equal(leader.faction, faction, `${faction} 的首领应该是自己人`);
  }
});

test('v37 洗牌只换顺序，不丢不重', () => {
  const list = Array.from({ length: 9 }, (_, index) => index);
  const shuffled = shuffleWith(list, lcg(5));
  assert.equal(shuffled.length, list.length);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), list);
});
