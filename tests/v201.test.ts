import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';

/**
 * v201：记忆重塑与记忆清除的分工。
 *
 * 重塑 4,000：等级、属性、疤痕全部回到起点，回忆与人格保留。
 * 清除 1,200：清一条精神疤痕；魔女态则解除魔女化、侵蚀归零、等级归 1、回忆清空，但疤痕留着。
 */

const SCARS = [
  { id: 'scar-a', name: '旧伤', condition: '下雨天会疼', effect: { kind: 'stat', stat: 'agility', amount: -1 }, maxHpLoss: 0, gainedAt: '第 1 日', kind: 'body' },
  { id: 'scar-b', name: '走神', condition: '听到钟声会愣住', effect: { kind: 'stat', stat: 'insight', amount: -1 }, maxHpLoss: 0, gainedAt: '第 2 日', kind: 'mental' },
] as never;

test('v201 记忆重塑：等级回 1、属性回基础、疤痕全部剥离、血上限按无疤重算', () => {
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
  assert.equal(after.level, 1);
  assert.equal(after.exp, 0);
  assert.deepEqual(after.stats, after.baseStats);
  assert.deepEqual(after.scars, []);
  assert.equal(after.baseMaxHp, 88);
  assert.equal(after.maxHp, 88);
  assert.equal(after.hp, after.maxHp);
  assert.ok(result.state.gold < before);
});

test('v201 记忆重塑保留回忆与人格', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.personality = '怕生，但对甜点没有抵抗力。';
  state.events = [
    { id: 'e1', girlId: girl.id, status: 'done', title: '旧梦', day: 1, rounds: 3 },
  ] as never;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.deepEqual(result.state.events.map(event => event.id), ['e1']);
  assert.equal(after.personality, '怕生，但对甜点没有抵抗力。');
});

test('v201 记忆重塑不解除魔女化：形态与侵蚀都不动', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.corruption = 82;
  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.equal(after.witch, true);
  assert.equal(after.corruption, 82);
});

test('v201 魔女态记忆清除不清疤痕：疤痕留给重塑去剥', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.corruption = 80;
  girl.scars = SCARS;

  const result = act(state, { type: 'clinic', girlId: girl.id, mode: 'clear' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(g => g.id === girl.id)!;
  assert.equal(after.witch, false);
  assert.equal(after.corruption, 0);
  assert.deepEqual(after.scars.map(scar => scar.id).sort(), ['scar-a', 'scar-b']);
});
