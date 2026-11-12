import test from 'node:test';
import assert from 'node:assert/strict';
import { arcEndingContract, arcTurnContract } from '../src/promptSections.ts';
import { shippedPresets, presetPrompts } from '../src/presets.ts';

test('v258 收尾契约改成把台词写进正文', () => {
  for (const choice of [undefined, [{ id: 'a', label: '走' }]]) {
    const text = arcEndingContract(choice);
    assert.equal(text.includes('"lines"'), false, 'JSON 形状里不再出现 lines');
    assert.ok(text.includes('@'), '正文里要说明台词标记');
    assert.equal(text.includes('after 必填'), false, 'after 交给解析器，不再让模型填');
  }
});

test('v258 收尾契约的 JSON 形状只留空 lines', () => {
  const shape = arcEndingContract().split('\n')[1] ?? '';
  assert.equal(shape.includes('"lines"'), false, shape);
  assert.equal(shape.includes('"after"'), false, shape);
});

test('v211 出厂预设里的收尾契约跟代码默认一致', () => {
  const expected = arcEndingContract().trim();
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'arc:ending');
    assert.ok(entry, `${preset.id} 缺少 arc:ending`);
    assert.equal(entry!.content.trim(), expected, `${preset.id} 的收尾契约还是旧快照`);
  }
});

test('v258 续写契约的形状把 lines 留空，台词写进正文', () => {
  const text = arcTurnContract();
  const shape = text.split('\n')[1] ?? '';
  assert.equal(shape.includes('"lines"'), false, shape);
  assert.ok(text.includes('@'), '要说明台词标记');
  assert.equal(text.includes('after 必填'), false);
});

test('v258 出厂预设里的续写契约也是内联写法', () => {
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'arc:turn');
    assert.ok(entry, `${preset.id} 缺少 arc:turn`);
    assert.equal(entry!.content.includes('"lines"'), false, `${preset.id} 的续写契约还带着 lines`);
    assert.equal(entry!.content.includes('after 必填'), false, `${preset.id} 还在教 after`);
  }
});
