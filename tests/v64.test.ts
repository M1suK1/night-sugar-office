import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_SCHEMA, builtinPresets, composeTaskSystem, ensurePromptScopes, presetRuntime, renderPresetSystem } from '../src/presets.ts';
import { contractPrompts, contractIdFor } from '../src/promptContracts.ts';
import { newsContract } from '../src/promptSections.ts';
import '../src/llm-night.ts';

const newsRuntimeWith = (content?: string) => {
  const preset = builtinPresets()[0]!;
  const prompts = preset.prompts.map(entry => entry.id === 'news:contract' && content !== undefined ? { ...entry, content } : entry);
  return presetRuntime({ ...preset, prompts });
};

test('v64 契约词条：都在，且带 contract 标记与默认文本', () => {
  const entries = contractPrompts();
  const ids = entries.map(entry => entry.id);
  for (const id of ['daily:contract', 'news:contract', 'incident:contract', 'battle:contract', 'storyline:contract', 'arc:contract', 'chat:contract', 'whisper:contract']) {
    assert.ok(ids.includes(id), `缺少 ${id}`);
  }
  for (const entry of entries) {
    assert.equal(entry.contract, true);
    assert.ok(entry.content.trim().length > 20, `${entry.id} 的默认文本是空的`);
  }
  assert.equal(contractIdFor('news'), 'news:contract');
});

test('v64 预设里改了契约就按预设走；没改就用代码默认值', () => {
  const custom = composeTaskSystem(newsContract(), newsRuntimeWith('【自定义契约】只写一句话。'), 'news');
  assert.match(custom.system, /【自定义契约】只写一句话。$/, '契约永远排在最后');
  const fallback = composeTaskSystem(newsContract(), newsRuntimeWith(), 'news');
  assert.match(fallback.system, /headline/, '没改时用代码默认的 JSON 形状');
  assert.doesNotMatch(fallback.system, /【自定义契约】/);
});

test('v64 契约不参与正文分层（不会重复两遍）', () => {
  const runtime = newsRuntimeWith('【自定义契约】只写一句话。');
  const rendered = renderPresetSystem(runtime.entries, { world: '测试世界' });
  assert.doesNotMatch(rendered.system, /【自定义契约】/, '正文里不该出现契约');
  const composed = composeTaskSystem(newsContract(), runtime, 'news');
  assert.equal(composed.system.split('【自定义契约】').length - 1, 1, '整份系统提示里只出现一次');
});

test('v64 内置预设自带契约词条，schema 已是 7', () => {
  assert.equal(PRESET_SCHEMA, 7);
  const preset = builtinPresets()[0]!;
  assert.ok(preset.prompts.some(entry => entry.id === 'news:contract' && entry.contract));
  assert.ok(preset.schema === PRESET_SCHEMA);
});

test('v64 旧预设迁移只补一次，且不覆盖玩家改过的文本', () => {
  const preset = builtinPresets()[0]!;
  const legacy = {
    ...preset,
    schema: 6,
    prompts: preset.prompts
      .filter(entry => !entry.contract)
      .concat([{ id: 'news:contract', name: '城市新闻 · 结构契约', content: '我改过的契约。', role: 'system' as const, enabled: true, scope: 'news' as const, contract: true }]),
    promptOrder: (preset.promptOrder ?? []).filter(item => item.identifier !== 'news:contract').concat([{ identifier: 'news:contract', enabled: true }]),
  };
  const migrated = ensurePromptScopes(legacy);
  assert.equal(migrated.schema, PRESET_SCHEMA);
  const contracts = migrated.prompts.filter(entry => entry.contract);
  assert.equal(new Set(contracts.map(entry => entry.id)).size, contracts.length, '不重复');
  assert.equal(migrated.prompts.find(entry => entry.id === 'news:contract')!.content, '我改过的契约。', '不覆盖玩家文本');
  const again = ensurePromptScopes(migrated);
  assert.equal(again.prompts.length, migrated.prompts.length, '再跑一次不再新增');
});
