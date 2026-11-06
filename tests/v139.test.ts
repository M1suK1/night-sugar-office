import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PRESET_BINDING, builtinPresets, shippedPresets, presetPrompts } from '../src/presets.ts';
import { SHIPPED_PRESETS } from '../src/content/presets/shipped/index.ts';

test('v139 八份出厂预设都进到内置列表里', () => {
  const shipped = shippedPresets();
  assert.equal(shipped.length, 11, `应有 11 份出厂预设，实际 ${shipped.length}`);
  const ids = builtinPresets().map(preset => preset.id);
  for (const item of SHIPPED_PRESETS) {
    assert.ok(ids.includes(item.id), `内置预设里缺少 ${item.id}`);
  }
  assert.ok(shipped.every(preset => preset.builtin), '出厂预设是只读的');
});

test('v139 出厂预设带着词条，契约词条重新打回 contract 标记', () => {
  for (const preset of shippedPresets()) {
    const entries = presetPrompts(preset);
    assert.ok(entries.length > 5, `${preset.id} 的词条太少（${entries.length}）`);
    const contracts = entries.filter(entry => entry.contract);
    assert.ok(contracts.length >= 1, `${preset.id} 没有识别出契约词条`);
    assert.ok(contracts.every(entry => entry.content.trim().length > 0), `${preset.id} 有空的契约词条`);
  }
});

test('v139 默认绑定指向真实存在的预设', () => {
  const ids = new Set(builtinPresets().map(preset => preset.id));
  for (const [scope, id] of Object.entries(DEFAULT_PRESET_BINDING)) {
    assert.ok(ids.has(id), `用途 ${scope} 绑定的 ${id} 不存在`);
  }
});

test('v139 出厂预设覆盖了八个任务用途', () => {
  const scopes = new Set(SHIPPED_PRESETS.map(item => item.scope));
  for (const scope of ['chat', 'daily', 'storyline', 'arc', 'event', 'battle', 'profile', 'outfit']) {
    assert.ok(scopes.has(scope), `缺少 ${scope} 的出厂预设`);
  }
});
