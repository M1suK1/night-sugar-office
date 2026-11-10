import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { dossierOf, oathStatusText } from '../src/girlDossier.ts';
import { resolveMacros } from '../src/promptMacros.ts';

const sworn = (wedding = true) => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.oath = { day: 5, at: '第 5 日 · 21:00' };
  if (wedding) girl.wedding = { day: 6, at: '第 6 日 · 20:30', eventId: 'meeting-1', placeName: '会客厅' };
  return { state, girl };
};

test('v233 誓约与婚礼写进「她是谁」档案', () => {
  const { state, girl } = sworn();
  const text = dossierOf(girl, state);
  assert.ok(text.includes('已与所长缔结誓约（第 5 日）'), text);
  assert.ok(text.includes('并在第 6 日于会客厅举行婚礼'), text);
});

test('v233 尚未办婚礼时写明还没有婚礼', () => {
  const { state, girl } = sworn(false);
  const text = dossierOf(girl, state);
  assert.ok(text.includes('尚未举行婚礼'), text);
  assert.equal(oathStatusText(girl), '已与所长缔结誓约（第 5 日），尚未举行婚礼');
});

test('v233 名册宏带上已誓约 / 已完婚状态', () => {
  const { state, girl } = sworn();
  const text = resolveMacros('{{girls}}', { state, focus: girl }).text;
  assert.ok(text.includes('已与所长完婚'), text);
});

test('v233 没誓约的人不会被写成已婚', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  assert.equal(oathStatusText(girl), '');
  assert.ok(!dossierOf(girl, state).includes('缔结誓约'));
});
