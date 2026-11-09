import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';

/**
 * v201：重塑补齐疤痕剥离（v203 已把记忆清除并入重塑）。
 *
 * 重塑 4,000：等级、属性、疤痕全部回到起点，已完成/已收束的回忆一并抹掉，人格保留。
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
