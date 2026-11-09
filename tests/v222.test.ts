import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { capacity } from '../src/rules/roster.ts';

test('v222 宿舍可升到 6 级，最多容纳 12 人', () => {
  const state = createInitialState();
  const dormId = state.rooms.find(room => room.type === 'dorm')!.id;
  state.gold = 999999;
  let current = state;
  const before = capacity(current);
  assert.equal(before, 6, '默认宿舍 6 个床位');
  for (let step = 0; step < 3; step += 1) {
    const built = act(current, { type: 'build', roomId: dormId });
    assert.equal(built.ok, true, built.message);
    current = built.state;
  }
  const dorm = current.rooms.find(room => room.id === dormId)!;
  assert.equal(dorm.level, 6);
  assert.equal(dorm.capacity, 12);
  assert.equal(capacity(current), 12);
  const overflow = act(current, { type: 'build', roomId: dormId });
  assert.equal(overflow.ok, false);
  assert.match(overflow.message, /最高等级/);
});
