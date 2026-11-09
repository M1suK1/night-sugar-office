import test from 'node:test';
import assert from 'node:assert/strict';
import { arcEndingContract, arcTurnContract } from '../src/promptSections.ts';
import { shippedPresets, presetPrompts } from '../src/presets.ts';

test('v211 收尾契约带上 after 落点', () => {
  for (const choice of [undefined, [{ id: 'a', label: '走' }]]) {
    const text = arcEndingContract(choice);
    assert.ok(text.includes('"after":0'), 'JSON 形状里要有 after');
    assert.ok(text.includes('after 必填'), '正文里要说明 after 怎么数');
  }
});

test('v211 收尾契约的 JSON 形状把 after 写在每句台词里', () => {
  const shape = arcEndingContract().split('\n')[1] ?? '';
  assert.ok(shape.includes('"text":"","after":0,"mode"'), shape);
});

test('v211 出厂预设里的收尾契约跟代码默认一致', () => {
  const expected = arcEndingContract().trim();
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'arc:ending');
    assert.ok(entry, `${preset.id} 缺少 arc:ending`);
    assert.equal(entry!.content.trim(), expected, `${preset.id} 的收尾契约还是旧快照`);
  }
});

test('v211 续写契约的形状也带 after', () => {
  const text = arcTurnContract();
  const shape = text.split('\n')[1] ?? '';
  assert.ok(shape.includes('"text":"","after":0,"mode"'), shape);
  assert.ok(text.includes('after 必填'), '续写契约要保留 after 的用法说明');
});

test('v211 出厂预设里的续写契约也带 after', () => {
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'arc:turn');
    assert.ok(entry, `${preset.id} 缺少 arc:turn`);
    assert.ok(entry!.content.includes('"after":0'), `${preset.id} 的续写契约缺少 after`);
  }
});
