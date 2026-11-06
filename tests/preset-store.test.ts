import test from 'node:test';
import assert from 'node:assert/strict';
import { __resetKvForTests } from '../src/store.ts';
import {
  PRESET_BINDING_STORE_KEY, PRESET_STORE_KEY, createPreset, loadPresetBindingFromStore, loadPresetsFromStore,
  savePresetBindingToStore, savePresetsToStore, type ChatPreset,
} from '../src/presets.ts';

const custom = (name: string): ChatPreset => ({ ...createPreset(name), id: `p-${name}` });

test('v170 预设：写进本地存档后能原样读回，内置预设不进存档', async () => {
  __resetKvForTests();
  const mine = custom('我改过的预设');
  const target = mine.prompts[0]!.id;
  mine.prompts = mine.prompts.map(entry => entry.id === target ? { ...entry, content: '这是玩家自己写的主提示词。' } : entry);
  assert.equal(await savePresetsToStore([mine, { ...custom('内置的'), id: 'b1', builtin: true }]), true);

  const loaded = await loadPresetsFromStore();
  assert.ok(loaded, '存档里应该有预设');
  assert.equal(loaded!.length, 1, '内置预设不写存档，换环境时按代码重建');
  assert.equal(loaded![0]!.id, mine.id);
  assert.ok(loaded![0]!.prompts.some(entry => entry.content.includes('这是玩家自己写的')), '玩家改过的词条要留着');
  assert.equal(PRESET_STORE_KEY, 'presets/custom');
});

test('v170 预设绑定：哪个任务用哪套预设也一起存下来', async () => {
  __resetKvForTests();
  const bound = { daily: 'p-我改过的预设', chat: 'p-我改过的预设' } as never;
  assert.equal(await savePresetBindingToStore(bound), true);
  const loaded = await loadPresetBindingFromStore();
  assert.ok(loaded);
  assert.equal(loaded!.daily, 'p-我改过的预设');
  assert.equal(PRESET_BINDING_STORE_KEY, 'presets/binding');
});

test('v170 预设：没保存过时读存档返回 undefined，界面继续用浏览器里那份', async () => {
  __resetKvForTests();
  assert.equal(await loadPresetsFromStore(), undefined);
  assert.equal(await loadPresetBindingFromStore(), undefined);
});
