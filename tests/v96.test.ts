import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { FIRST_BOSS_DAY } from '../src/opening.ts';
import { bosses } from '../src/content/bosses.ts';

test('v96 首次空月不再第 16 夜堵门：至少留到第 24 夜', () => {
  const state = createInitialState();
  assert.ok(FIRST_BOSS_DAY >= 24, '常量写成第 24 夜（开局 14 夜 + 10 夜发育）');
  assert.equal(state.nextBossDay, Math.max(bosses[0]!.firstDay, FIRST_BOSS_DAY));
  assert.ok(state.nextBossDay - state.day >= 10, `发育期至少十夜，实际 ${state.nextBossDay - state.day} 夜`);
});
