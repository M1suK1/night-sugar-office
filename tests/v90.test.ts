import test from 'node:test';
import assert from 'node:assert/strict';
import { grantExp, expNeeded, recomputeMaxHp } from '../src/progression.ts';
import { createInitialState } from '../src/game.ts';

test('v90 每次升级最大生命 +10，并且写进 baseMaxHp（不会被战后重算抹掉）', () => {
  const girl = createInitialState().girls[0]!;
  girl.scars = [];
  const base = girl.baseMaxHp;
  const before = girl.level;
  grantExp(girl, expNeeded(girl.level), 'auto');
  assert.equal(girl.level, before + 1);
  assert.equal(girl.baseMaxHp, base + 10, '基础上限跟着涨');
  assert.equal(girl.maxHp, base + 10, '当前上限同步（无疤痕）');
  assert.equal(girl.hp, Math.min(girl.maxHp, girl.hp), '血量不会超过上限');
});

test('v90 一次连升两级就 +20；疤痕按比例削上限但不动基础上限', () => {
  const girl = createInitialState().girls[0]!;
  girl.scars = [];
  const base = girl.baseMaxHp;
  grantExp(girl, expNeeded(girl.level) + expNeeded(girl.level + 1), 'auto');
  assert.equal(girl.baseMaxHp, base + 20);

  girl.baseMaxHp = 100;
  girl.scars = [{ id: 's1', name: '旧伤', kind: 'body' } as never];
  recomputeMaxHp(girl);
  assert.equal(girl.maxHp, 92, '一道疤削 8%');
  assert.equal(girl.baseMaxHp, 100, '基础上限不受疤痕影响');
});
