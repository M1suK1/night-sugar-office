import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';

test('v125 星象台每个整点结算一次', () => {
  const state = createInitialState();
  // 把观测台加进房间并派 1 人远行
  const room = state.rooms.find(item => item.type === 'observatory');
  assert.ok(room, '房间里要有星象台');
  const members = state.girls.filter(girl => !girl.dead && girl.retired !== true && girl.status === 'idle').slice(0, 1).map(girl => girl.id);
  assert.ok(members.length, '要有一个待命的人');
  const started = act(state, { type: 'startExpedition', memberIds: members });
  assert.equal(started.ok, true, started.message);

  const goldBefore = started.state.gold;
  const cyclesBefore = started.state.expeditions[0]!.cyclesDone;

  // 连推三次 20 分钟：跨过 60 分钟时应该结算
  let current = started.state;
  for (let i = 0; i < 3; i += 1) {
    const moved = act(current, { type: 'advance', minutes: 20 });
    if (!moved.ok) break;
    current = moved.state;
  }
  const expedition = current.expeditions[0];
  assert.ok(expedition, '远行还在');
  assert.ok(expedition!.cyclesDone > cyclesBefore, `一小时应结算一次，实际 ${expedition!.cyclesDone}`);
  assert.ok(current.gold > goldBefore, '结算要进账星砂');
});

test('v125 一次推进 180 分钟会结算三次', () => {
  const state = createInitialState();
  const members = state.girls.filter(girl => !girl.dead && girl.retired !== true && girl.status === 'idle').slice(0, 1).map(girl => girl.id);
  const started = act(state, { type: 'startExpedition', memberIds: members });
  assert.equal(started.ok, true, started.message);
  const before = started.state.expeditions[0]!.cyclesDone;
  const moved = act(started.state, { type: 'advance', minutes: 180 });
  assert.equal(moved.ok, true, moved.message);
  const cycles = moved.state.expeditions[0]!.cyclesDone - before;
  assert.ok(cycles >= 3, `180 分钟应该结算 3 次，实际 ${cycles}`);
});
