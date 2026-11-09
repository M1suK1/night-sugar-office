import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { WITCH_STAGE_AT, corruptionEmpathyPenalty, corruptionStage } from '../src/economy.ts';
import { applyWitchSquadRelation } from '../src/rules/witchSquad.ts';
import type { Girl } from '../src/types.ts';

/**
 * v200：侵蚀显示口径、魔女出勤的关系代价、以及「70 起不可逆 + 记忆重塑是唯一出口」。
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
  assert.match(blocked.message ?? '', /续命|记忆重塑|越线|压不回去/);
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
