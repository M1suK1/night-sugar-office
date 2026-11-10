import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { newsFocus } from '../src/cityNews.ts';
import { SECTION_PROMPTS, newsContract } from '../src/promptSections.ts';
import { presetPrompts, shippedPresets } from '../src/presets.ts';

/** v243：城市新闻只围绕一件事，台上的人不再各说各的。 */

test('v243 每晚只挑一件最值得谈的事', () => {
  const state = createInitialState();
  const faction = newsFocus(state, 0);
  assert.equal(faction.tone, 'faction');
  assert.match(faction.title, /火气/);
  const street = newsFocus(state, 1);
  assert.equal(street.tone, 'street');
  assert.match(street.title, /派遣栏/);
  const stability = newsFocus(state, 2);
  assert.equal(stability.tone, 'stability');
});

test('v243 污染压过街头时改谈那一片辖区', () => {
  const state = createInitialState();
  for (const entry of Object.values(state.hostility)) entry.value = 10;
  for (const id of Object.keys(state.pollution)) state.pollution[id as keyof typeof state.pollution] = 80;
  const focus = newsFocus(state, 0);
  assert.equal(focus.tone, 'pollution');
  assert.match(focus.title, /污染/);
});

test('v243 契约与分区都要求只谈这一件', () => {
  const contract = newsContract();
  assert.match(contract, /items 只给 1 条/);
  assert.match(contract, /同一件事/);
  assert.match(contract, /【今晚只谈这一件】/);
  assert.match(SECTION_PROMPTS.find(entry => entry.id === 'nw-brief')!.content, /只谈【今晚只谈这一件】/);
});

test('v243 出厂预设与代码默认同步', () => {
  const brief = SECTION_PROMPTS.find(entry => entry.id === 'nw-brief')!.content.trim();
  const contract = newsContract().trim();
  for (const preset of shippedPresets()) {
    const entries = presetPrompts(preset);
    assert.equal(entries.find(entry => entry.id === 'nw-brief')?.content.trim(), brief, `${preset.id} 的新闻分区没同步`);
    assert.equal(entries.find(entry => entry.id === 'news:contract')?.content.trim(), contract, `${preset.id} 的新闻契约没同步`);
  }
});
