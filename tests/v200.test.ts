import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { WITCH_STAGE_AT, corruptionEmpathyPenalty, corruptionStage } from '../src/economy.ts';
import { applyWitchSquadRelation } from '../src/rules/witchSquad.ts';
import type { Girl } from '../src/types.ts';

/**
 * v200：侵蚀显示口径、魔女出勤的关系代价、以及「70 起不可逆 + 记忆清除是唯一出口」。
 */

test('v200 阈值：40 是魔女化礼装线，70 才是不可逆的魔女阶段', () => {
  assert.equal(WITCH_STAGE_AT, 70);
  assert.equal(corruptionStage(0), 0);
  assert.equal(corruptionStage(1), 1);
  assert.equal(corruptionStage(39), 1);
  assert.equal(corruptionStage(40), 2);
  assert.equal(corruptionStage(69), 2);
  assert.equal(corruptionStage(70), 3);
  assert.equal(corruptionStage(100), 3);
});

test('v200 共情修正按真实倍率显示，不再错位一档', () => {
  assert.equal(corruptionEmpathyPenalty(0), 0);
  assert.equal(corruptionEmpathyPenalty(20), 5);
  assert.equal(corruptionEmpathyPenalty(45), 12);
  assert.equal(corruptionEmpathyPenalty(80), 25);
});

const squad = (): { state: ReturnType<typeof createInitialState>; witch: Girl; a: Girl; b: Girl } => {
  const state = createInitialState();
  const [witch, a, b] = state.girls;
  witch!.witch = true;
  witch!.corruption = 75;
  a!.relationships[witch!.id] = 50;
  b!.relationships[witch!.id] = 50;
  a!.relationships[b!.id] = 50;
  return { state, witch: witch!, a: a!, b: b! };
};

test('v200 魔女出勤：队友对她的同伴关系下降', () => {
  const { state, witch, a, b } = squad();
  applyWitchSquadRelation(state, [witch, a, b]);
  assert.equal(a.relationships[witch.id], 46);
  assert.equal(b.relationships[witch.id], 46);
  assert.equal(a.relationships[b.id], 50, '队友之间不受影响');
  assert.ok(state.logs.some(log => log.text.includes('关系')));
});

test('v200 没有魔女时关系不动', () => {
  const { state, witch, a, b } = squad();
  witch.witch = false;
  applyWitchSquadRelation(state, [witch, a, b]);
  assert.equal(a.relationships[witch.id], 50);
});

test('v200 多个魔女叠加，且关系不低于 0', () => {
  const { state, witch, a, b } = squad();
  b.witch = true;
  b.corruption = 72;
  a.relationships[witch.id] = 3;
  a.relationships[b.id] = 3;
  applyWitchSquadRelation(state, [witch, a, b]);
  assert.equal(a.relationships[witch.id], 0);
  assert.equal(a.relationships[b.id], 0);
});

test('v200 七十以上：抑制剂只能续命，压不回去', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.corruption = 75;
  state.inventory['moon-drug'] = 3;
  const blocked = act(state, { type: 'suppressWitch', girlId: girl.id });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message ?? '', /续命|记忆清除|越线|压不回去/);
  assert.equal(blocked.state.inventory['moon-drug'], 3, '被拒绝时不消耗抑制剂');
});

test('v200 四十到六十九：抑制剂仍然能压回普通形态', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.corruption = 55;
  state.inventory['moon-drug'] = 3;
  const result = act(state, { type: 'suppressWitch', girlId: girl.id });
  assert.equal(result.ok, true);
  assert.equal(result.state.girls.find(g => g.id === girl.id)?.witch, false);
  assert.equal(result.state.inventory['moon-drug'], 2);
});

test('v200 记忆清除解除魔女化：归零、等级回 1、成长与条件清空', () => {
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
  girl.scars = [];
  girl.conditions = [{ id: 'c1', name: '夜惊', kind: 'debuff', source: 'test', description: '', remaining: 3, removable: true, stat: 'insight', amount: -3 }] as never;
  const before = state.gold;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'clear' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.equal(after.witch, false);
  assert.equal(after.corruption, 0);
  assert.equal(after.level, 1);
  assert.equal(after.exp, 0);
  assert.deepEqual(after.stats, after.baseStats);
  assert.equal(after.baseMaxHp, 84);
  assert.equal(after.hp, after.maxHp);
  assert.deepEqual(after.conditions, []);
  assert.equal(after.drugUntilDay, undefined);
  assert.equal(after.withdrawalDays, 0);
  assert.ok(result.state.gold < before, '照常收费');
});

test('v200 记忆清除会删掉她的「回忆」，进行中的会面与其他人的不动', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.corruption = 80;
  state.events = [
    { id: 'e1', girlId: girl.id, status: 'done', title: '旧梦', day: 1, rounds: 3 },
    { id: 'e2', girlId: girl.id, status: 'active', title: '进行中', day: 2, rounds: 1 },
    { id: 'e3', girlId: 'other', status: 'done', title: '别人的', day: 1, rounds: 2 },
  ] as never;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'clear' });
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(result.state.events.map(event => event.id), ['e2', 'e3']);
});

test('v200 普通契约者的记忆清除不变：只清疤痕、不动等级', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.level = 4;
  girl.scars = [{ id: 'scar-b', name: '走神', condition: '听到钟声会愣住', effect: { kind: 'stat', stat: 'insight', amount: -1 }, maxHpLoss: 0, gainedAt: '第 2 日', kind: 'mental' }] as never;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'clear', clearScarId: 'scar-b' });
  assert.equal(result.ok, true);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.equal(after.level, 4);
  assert.deepEqual(after.scars, []);
});

test('v200 既不是魔女又没有精神疤痕时，记忆清除仍然被拒绝', () => {
  const state = createInitialState();
  state.girls[0]!.scars = [];
  const result = act(state, { type: 'clinic', girlId: state.girls[0]!.id, mode: 'clear' });
  assert.equal(result.ok, false);
});
