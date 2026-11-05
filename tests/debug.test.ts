import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';

test('v94 终端：witch 让指定少女立刻魔女化（补侵蚀、补立绘、写日志）', () => {
  const s = createInitialState();
  const girl = s.girls[0]!;
  girl.corruption = 0;
  const result = act(s, { type: 'debugGirl', girlId: girl.id, mode: 'witch' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(item => item.id === girl.id)!;
  assert.equal(after.witch, true);
  assert.ok((after.corruption ?? 0) >= DEFAULT_BALANCE.corruptionThreshold, '侵蚀至少抬到阈值');
  assert.ok(after.witchForm, '没有立绘时自动补一个程序化魔女形态');
  assert.ok(after.witchPersonality?.trim(), '负面人格也一并写上');
  assert.match(result.state.logs[0]!.text, /调试/);
});

test('v94 终端：reset 把少女送回初始状态', () => {
  const s = createInitialState();
  const girl = s.girls[0]!;
  girl.level = 6;
  girl.exp = 999;
  girl.fatigue = 80;
  girl.corruption = 45;
  girl.witch = true;
  girl.scars = [{ id: 'scar-1', name: '旧疤', kind: 'wound', condition: '体力恢复变慢', gainedAt: '第 3 日', effect: { kind: 'fatigueRecovery', amount: -4 } } as never];
  girl.equipment = { weapon: 'moon-weapon' } as never;
  girl.status = 'resting';
  girl.remaining = 40;

  const result = act(s, { type: 'debugGirl', girlId: girl.id, mode: 'reset' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(item => item.id === girl.id)!;
  assert.equal(after.level, 1);
  assert.equal(after.exp, 0);
  assert.equal(after.fatigue, 0);
  assert.equal(after.corruption, 0);
  assert.equal(after.witch, false);
  assert.deepEqual(after.scars, []);
  assert.deepEqual(after.equipment, {});
  assert.equal(after.status, 'idle');
  assert.equal(after.remaining, 0);
  assert.equal(after.hp, after.maxHp);
  assert.equal(after.maxHp, after.baseMaxHp);
  assert.deepEqual(after.stats, after.baseStats);
});

test('v94 终端：找不到人时不改状态', () => {
  const s = createInitialState();
  const result = act(s, { type: 'debugGirl', girlId: 'nobody', mode: 'witch' });
  assert.equal(result.ok, false);
  assert.equal(result.state, s);
});
