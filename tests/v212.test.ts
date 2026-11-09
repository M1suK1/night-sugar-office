import test from 'node:test';
import assert from 'node:assert/strict';
import { witchFormContract } from '../src/promptSections.ts';
import { shippedPresets, presetRuntime, composeTaskSystem } from '../src/presets.ts';

test('v212 魔女化形态描述上限放到 100 字', () => {
  const text = witchFormContract();
  assert.ok(text.includes('description 40–100 字'), text);
  assert.ok(!text.includes('40–90 字'), '旧的 90 字上限还留着');
});

test('v212 出厂预设不会用旧快照盖掉新的上限', () => {
  for (const preset of shippedPresets()) {
    const out = composeTaskSystem(witchFormContract(), presetRuntime(preset), 'profile', {}, {}, 'profile:witch');
    assert.ok(out.system.includes('40–100 字'), `${preset.id} 仍在用旧的形态描述上限`);
  }
});
