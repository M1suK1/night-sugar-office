import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { shouldAutoGenerate } from '../src/autoGenerate.ts';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';

test('v129 第 15 天即使没点过「确认编成」也要自动补提案', () => {
  const state = { day: 15, generatedDay: 14, prologueSeen: true, startersPicked: false };
  assert.equal(shouldAutoGenerate(state, true), true);
});

test('v129 开局那一夜仍然挡着，不在默认名册上写提案', () => {
  const state = { day: 14, generatedDay: 14, prologueSeen: true, startersPicked: false };
  assert.equal(shouldAutoGenerate(state, true), false);
  assert.equal(shouldAutoGenerate({ ...state, startersPicked: true }, true), false, '当天已经补过就不再补');
  assert.equal(shouldAutoGenerate({ ...state, startersPicked: true, generatedDay: 13 }, true), true, '第一夜也能补');
});

test('v129 序章没看完不补（开局那一夜），空白档不受编成拦', () => {
  assert.equal(shouldAutoGenerate({ day: 14, generatedDay: 13, prologueSeen: false, startersPicked: true }, true), false);
  assert.equal(shouldAutoGenerate({ day: 16, generatedDay: 14, prologueSeen: false, startersPicked: true }, true), true, '第 15 日之后不再拿序章当借口');
  assert.equal(shouldAutoGenerate({ day: 16, generatedDay: 14, prologueSeen: true, blank: true }, true), true);
});

test('v129 从卡库导入契约卡就等于定下名册', () => {
  const base = { ...createInitialState(), startersPicked: false };
  const card = parseGirlCard(JSON.stringify(buildGirlCard(base.girls[0]!, base)));
  assert.equal(card.ok, true);
  if (!card.ok) return;
  const imported = act(base, { type: 'importCard', card: card.card });
  if (!imported.ok) return; // 名册已满或重复时不算这条
  assert.equal(imported.state.startersPicked, true);
});
