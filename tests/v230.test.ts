import test from 'node:test';
import assert from 'node:assert/strict';
import { composeTaskSystem, presetRuntime, shippedPresets } from '../src/presets.ts';
import { arcTurnContract, SECTION_PROMPTS } from '../src/promptSections.ts';

const arcRuntime = () => presetRuntime(shippedPresets().find(preset => preset.id === 'shipped-arc'));

test('v230 默认预设不会再追加一份代码分区', () => {
  const out = composeTaskSystem(arcTurnContract(), arcRuntime(), 'arc', {}, {}, 'arc:turn', '【测试上下文】');
  for (const marker of ['【这一幕的写法】', '【她是谁】', '## 角色在新场景出场时', '# 行文风格']) {
    assert.equal(out.system.split(marker).length - 1, 1, `${marker} 只应出现一次`);
  }
});

test('v230 预设临时缺分区时仍会补代码默认分区', () => {
  const runtime = arcRuntime();
  const empty = { ...runtime, entries: [] };
  const out = composeTaskSystem(arcTurnContract(), empty, 'arc', {}, {}, 'arc:turn', '【测试上下文】');
  const expected = SECTION_PROMPTS.find(entry => entry.id === 'arc-brief')?.content ?? '';
  assert.ok(expected);
  assert.equal(out.system.split('【这一幕的写法】').length - 1, 1);
  assert.ok(out.system.includes('剧情·这一幕的写法') || out.system.includes('【这一幕的写法】'));
});
