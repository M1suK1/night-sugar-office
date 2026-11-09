import test from 'node:test';
import assert from 'node:assert/strict';
import { act, clinicCost, createInitialState } from '../src/game.ts';

/**
 * v204：诊所按钮显示的价必须就是实际扣款。
 * 显示、禁用门槛与结算共用 clinicCost(state, base)。
 */

function withRoomLevel(state: ReturnType<typeof createInitialState>, type: 'dorm' | 'clinic' | 'observatory', level: number) {
  return { ...state, rooms: state.rooms.map(room => room.type === type ? { ...room, level } : room) };
}

test('v204 一级诊所：重塑与复制的显示价就是原价', () => {
  const state = createInitialState();
  assert.equal(clinicCost(state, 4000), 4000);
  assert.equal(clinicCost(state, 18000), 18000);
});

test('v204 没有诊所时按一级诊所报价', () => {
  const state = { ...createInitialState(), rooms: [] };
  assert.equal(clinicCost(state, 4000), 4000);
  assert.equal(clinicCost(state, 18000), 18000);
});

test('v204 四级诊所：按钮显示的价与实际扣款一致', () => {
  const base = withRoomLevel({ ...createInitialState(), gold: 30000 }, 'clinic', 4);
  const wipePrice = clinicCost(base, 4000);
  assert.equal(wipePrice, 3400);
  const wiped = act(base, { type: 'clinic', girlId: base.girls[0]!.id, mode: 'wipe' });
  assert.equal(wiped.ok, true, wiped.message);
  assert.equal(base.gold - wiped.state.gold, wipePrice);

  const cloneBase = withRoomLevel({ ...createInitialState(), gold: 30000 }, 'clinic', 4);
  cloneBase.girls[0]!.level = 3;
  const clonePrice = clinicCost(cloneBase, 18000);
  assert.equal(clonePrice, 15300);
  const cloned = act(cloneBase, { type: 'clinic', girlId: cloneBase.girls[0]!.id, mode: 'clone' });
  assert.equal(cloned.ok, true, cloned.message);
  assert.equal(cloneBase.gold - cloned.state.gold, clonePrice);
});

test('v204 余额刚好等于折后价可以重塑，少一星砂就拒绝', () => {
  const state = withRoomLevel({ ...createInitialState(), gold: 3400 }, 'clinic', 4);
  const price = clinicCost(state, 4000);
  assert.equal(price, 3400);
  const ok = act(state, { type: 'clinic', girlId: state.girls[0]!.id, mode: 'wipe' });
  assert.equal(ok.ok, true, ok.message);

  const poor = withRoomLevel({ ...createInitialState(), gold: 3399 }, 'clinic', 4);
  const blocked = act(poor, { type: 'clinic', girlId: poor.girls[0]!.id, mode: 'wipe' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.state.gold, 3399);
});
