import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { OPENING_CARDS } from '../src/opening.ts';

test('v98 候选池上限与开局选人池同宽：30 位都摆得下', () => {
  const state = createInitialState();
  assert.equal(state.poolLimits.candidates, 30, '候选池上限要能装住整个选人池');
  assert.ok(state.poolLimits.candidates >= OPENING_CARDS, '候选池不该比选人池窄，否则界面永远少几位');
});
