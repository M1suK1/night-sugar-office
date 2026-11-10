import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { addCorruption, drugTick, syncWitchState } from '../src/rules/conditions.ts';
import { witchOutfitFor } from '../src/rules/outfits.ts';
import { witchConfrontationContract } from '../src/promptSections.ts';
import { presetPrompts, shippedPresets } from '../src/presets.ts';

/** v245：侵蚀到阈值就自动魔女化；立绘锁死，只能抑制剂压回；70 起不可逆。 */

const girlOf = () => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  return { state, girl: state.girls[0]! };
};

test('v245 侵蚀到阈值自动魔女化，并挂上 10 天药效', () => {
  const { state, girl } = girlOf();
  girl.corruption = 39;
  addCorruption(state, girl, 1);
  assert.equal(girl.corruption, 40);
  assert.equal(girl.witch, true);
  assert.equal(girl.drugUntilDay, state.day + 10);
  assert.equal(girl.withdrawalDays, 0);
  assert.ok(state.events.some(event => event.witch && event.girlId === girl.id), '排一段魔女化对峙');
});

test('v245 魔女化后普通服装锁定，抑制剂压回才能换装', () => {
  const { state, girl } = girlOf();
  girl.corruption = 45;
  addCorruption(state, girl, 1);
  assert.equal(girl.witch, true);
  const locked = act(state, { type: 'changeOutfit', girlId: girl.id, outfitId: girl.wardrobe[0]!.id });
  assert.equal(locked.ok, false);
  assert.match(locked.message, /锁定|魔女化/);

  state.inventory['moon-drug'] = 1;
  const freed = act(state, { type: 'suppressWitch', girlId: girl.id });
  assert.equal(freed.ok, true, freed.message);
  assert.equal(freed.state.girls[0]!.witch, false);
  const changed = act(freed.state, { type: 'changeOutfit', girlId: girl.id, outfitId: girl.wardrobe[0]!.id });
  assert.equal(changed.ok, true, changed.message);
});

test('v245 70 起不可逆：抑制剂压不回去', () => {
  const { state, girl } = girlOf();
  girl.corruption = 69;
  addCorruption(state, girl, 2);
  assert.equal(girl.witch, true);
  state.inventory['moon-drug'] = 1;
  const result = act(state, { type: 'suppressWitch', girlId: girl.id });
  assert.equal(result.ok, false);
  assert.match(result.message, /越过那条线|记忆重塑/);
});

test('v245 手动切到魔女化也走同一套药效', () => {
  const { state, girl } = girlOf();
  girl.corruption = 45;
  const result = act(state, { type: 'setWitchForm', girlId: girl.id, outfit: witchOutfitFor(girl), personality: '' });
  assert.equal(result.ok, true, result.message);
  const next = result.state.girls[0]!;
  assert.equal(next.witch, true);
  assert.equal(next.drugUntilDay, result.state.day + 10);
  assert.equal(next.withdrawalDays, 0);
});

test('v245 抑制剂压回去后，药效期内不会又被自动变成魔女', () => {
  const { state, girl } = girlOf();
  girl.corruption = 45;
  addCorruption(state, girl, 1);
  state.inventory['moon-drug'] = 1;
  const freed = act(state, { type: 'suppressWitch', girlId: girl.id });
  assert.equal(freed.ok, true, freed.message);
  const next = freed.state;
  const target = next.girls[0]!;
  drugTick(next, target);
  assert.equal(target.witch, false, '日结不该把压制中的她变回去');
  addCorruption(next, target, 5);
  assert.equal(target.witch, false, '药效期内涨侵蚀也不变回去');
  next.day = (target.drugUntilDay ?? 0) + 1;
  assert.equal(syncWitchState(next, target), true, '药效过期、侵蚀仍在阈值上时才重新变身');
});

test('v245 魔女化开场白放宽到 1500 字，不再被 600 字截断', () => {
  const { state, girl } = girlOf();
  girl.corruption = 45;
  addCorruption(state, girl, 1);
  const event = state.events.find(entry => entry.witch)!;
  const long = '她'.repeat(1200);
  const result = act(state, { type: 'startStorySession', eventId: event.id, cast: [girl.id], opening: long, lines: [], options: [], seed: '' });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.events.find(entry => entry.id === event.id)!.opening?.length, 1200);
  assert.match(witchConfrontationContract(), /800–1500 字/);
});

test('v245 出厂预设里的魔女化契约跟代码默认一致', () => {
  const contract = witchConfrontationContract().trim();
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'arc:witch');
    assert.ok(entry, `${preset.id} 缺少 arc:witch`);
    assert.equal(entry!.content.trim(), contract, `${preset.id} 的魔女化契约没同步`);
  }
});

test('v245 旧档补触发：侵蚀到线但还是普通人时，日结状态会被补成魔女', () => {
  const { state, girl } = girlOf();
  girl.corruption = 80;
  girl.witch = false;
  assert.equal(syncWitchState(state, girl), true);
  assert.equal(girl.witch, true);
  assert.equal(state.events.some(event => event.witch), false, '补状态不弹对峙');
});
