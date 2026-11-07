import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { loadState, loadStateStrict } from '../src/rules/persistence.ts';

test('v197 严格读档：好档原样返回，坏档返回 null 而不是新开局', () => {
  const state = createInitialState();
  state.day = 42;
  state.startersPicked = true;
  const good = loadStateStrict(JSON.stringify(state));
  assert.equal(good?.day, 42);
  assert.equal(good?.startersPicked, true);

  const broken = loadStateStrict(JSON.stringify({ ...state, logs: 'not-an-array' }));
  assert.equal(broken, null);
  assert.equal(loadStateStrict(JSON.stringify({ ...state, version: 99 })), null);
  assert.equal(loadStateStrict('不是什么 JSON'), null);
  assert.equal(loadStateStrict(null), null);
});

test('v197 宽松读档仍保留旧行为：读不出来就给新开局', () => {
  const state = createInitialState();
  state.day = 42;
  const back = loadState(JSON.stringify({ ...state, logs: 'not-an-array' }));
  assert.equal(back.day, 14);
  assert.equal(back.startersPicked, false);
});
