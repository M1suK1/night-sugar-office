import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';

/**
 * v203：记忆重塑与记忆清除合并成一个动作。
 *
 * 重塑 4,000：等级、经验、属性、血上限、全部疤痕归零；
 * 魔女态同时解除魔女化（侵蚀归零、断药计时清零、条件清空）；
 * 她已完成/已收束的回忆一并删掉，进行中的与别人的不动；
 * storyArchive（本地已保存的回忆）不归这个动作管。
 */

const SCARS = [
  { id: 'scar-a', name: '旧伤', condition: '下雨天会疼', effect: { kind: 'stat', stat: 'agility', amount: -1 }, maxHpLoss: 0, gainedAt: '第 1 日', kind: 'body' },
  { id: 'scar-b', name: '走神', condition: '听到钟声会愣住', effect: { kind: 'stat', stat: 'insight', amount: -1 }, maxHpLoss: 0, gainedAt: '第 2 日', kind: 'mental' },
] as never;

function withRoomLevel(state: ReturnType<typeof createInitialState>, type: 'dorm' | 'clinic' | 'observatory', level: number) {
  return { ...state, rooms: state.rooms.map(room => room.type === type ? { ...room, level } : room) };
}

test('v203 重塑是唯一动作：4,000 一次重置等级、属性、血上限与全部疤痕', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.level = 4;
  girl.exp = 90;
  girl.stats = { magic: 25, insight: 25, agility: 25, empathy: 25 };
  girl.baseMaxHp = 100;
  girl.scars = SCARS;
  const before = state.gold;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.equal(before - result.state.gold, 4000, '一级诊所按原价扣 4,000');
  assert.equal(after.level, 1);
  assert.equal(after.exp, 0);
  assert.deepEqual(after.stats, after.baseStats);
  assert.deepEqual(after.scars, []);
  assert.equal(after.baseMaxHp, 88);
  assert.equal(after.maxHp, 88);
  assert.equal(after.hp, after.maxHp);
});

test('v203 重塑删掉她已完成与已收束的回忆，进行中的、别人的不动，人格保留', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.personality = '怕生，但对甜点没有抵抗力。';
  state.events = [
    { id: 'e-done', girlId: girl.id, status: 'done' },
    { id: 'e-session', girlId: girl.id, status: 'active', sessionDone: true },
    { id: 'e-active', girlId: girl.id, status: 'active' },
    { id: 'e-other', girlId: 'other', status: 'done' },
    { id: 'e-cast', girlId: 'other', status: 'done', cast: [girl.id] },
  ] as never;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(result.state.events.map(event => event.id), ['e-active', 'e-other']);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.equal(after.personality, '怕生，但对甜点没有抵抗力。');
});

test('v203 魔女态重塑：解除魔女化、侵蚀归零、断药计时清零、条件清空', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.corruption = 88;
  girl.drugUntilDay = state.day + 4;
  girl.withdrawalDays = 3;
  girl.level = 5;
  girl.exp = 120;
  girl.stats = { magic: 30, insight: 30, agility: 30, empathy: 30 };
  girl.baseMaxHp = 100;
  girl.scars = SCARS;
  girl.conditions = [{ id: 'c1', name: '夜惊', kind: 'debuff', source: 'test', description: '', remaining: 3, removable: true, stat: 'insight', amount: -3 }] as never;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.equal(after.witch, false);
  assert.equal(after.corruption, 0);
  assert.equal(after.drugUntilDay, undefined);
  assert.equal(after.withdrawalDays, 0);
  assert.deepEqual(after.conditions, []);
  assert.equal(after.level, 1);
  assert.deepEqual(after.scars, []);
  assert.equal(after.baseMaxHp, 84);
  assert.equal(after.hp, after.maxHp);
});

test('v203 普通态没有疤痕也能重塑；出勤中的会被拒绝', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  assert.deepEqual(girl.scars, []);

  const ok = act(state, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(ok.ok, true, ok.message);

  const busy = createInitialState();
  const onMission = busy.girls[0]!;
  onMission.status = 'mission';
  const before = busy.gold;
  const rejected = act(busy, { type: 'clinic', girlId: onMission.id, mode: 'wipe' });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.state.gold, before);
});

test('v203 诊所等级让重塑变便宜', () => {
  const base = createInitialState();
  const girl = base.girls[0]!;
  const cheap = withRoomLevel(base, 'clinic', 4);
  const before = cheap.gold;

  const result = act(cheap, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(result.ok, true, result.message);
  const paid = before - result.state.gold;
  assert.equal(paid, Math.round(4000 * (1 - 3 * DEFAULT_BALANCE.clinicCostDiscountPerLevel / 100)));
});
