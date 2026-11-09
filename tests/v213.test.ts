import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventContract, incidentBatchContract, newsContract, outfitContract, profileSchemaContract, singleIncidentContract, SECTION_PROMPTS } from '../src/promptSections.ts';
import { shippedPresets, presetPrompts } from '../src/presets.ts';

test('v213 服装词条上限对齐衣柜容量', () => {
  const text = outfitContract();
  assert.ok(text.includes('4–14 个汉字'), text);
  assert.ok(text.includes('description 60–120 字'), text);
});

test('v213 突发事件上限抬高', () => {
  const batch = incidentBatchContract();
  assert.ok(batch.includes('scene 写一段 80–160 字'), batch);
  assert.ok(batch.includes('body 40–160 字'), batch);
  assert.ok(singleIncidentContract().includes('body 60–160 字'));
});

test('v213 私人事件写明旁白与单句上限', () => {
  const text = eventContract();
  assert.ok(text.includes('每场 80–220 字旁白'), text);
  assert.ok(text.includes('每句不超过 120 字'), text);
});

test('v213 角色起草特性解释放宽到 60 字', () => {
  assert.ok(profileSchemaContract().includes('一句 20–60 字的行为解释'));
});

test('v213 蓝图开场与新闻上限抬高', () => {
  const nodes = SECTION_PROMPTS.find(entry => entry.id === 'sl-nodes')?.content ?? '';
  assert.ok(nodes.includes('300–500 字开场白'), nodes);
  assert.ok(newsContract().includes('不超过 28 字'));
  const brief = SECTION_PROMPTS.find(entry => entry.id === 'nw-brief')?.content ?? '';
  assert.ok(brief.includes('每句不超过 80 字'), brief);
});

test('v213 私人事件旁白的代码截断跟契约一致', () => {
  const source = readFileSync('src/llm.ts', 'utf8');
  assert.ok(source.includes('scene.narration.trim().slice(0, 220)'), '代码仍在 120 字处截断');
});

test('v213 出厂预设里的相关上限没有停在旧快照', () => {
  for (const preset of shippedPresets()) {
    const entries = presetPrompts(preset);
    assert.equal(entries.find(entry => entry.id === 'incident:contract')?.content.trim(), incidentBatchContract().trim(), `${preset.id} 突发事件契约是旧快照`);
    assert.equal(entries.find(entry => entry.id === 'news:contract')?.content.trim(), newsContract().trim(), `${preset.id} 新闻契约是旧快照`);
    const nodes = entries.find(entry => entry.id === 'sl-nodes')?.content ?? '';
    assert.ok(nodes.includes('300–500 字开场白'), `${preset.id} 蓝图开场还是旧上限`);
  }
});
