import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_SCHEMA, exportPresetJson, importPresetObject, presetPrompts, type ChatPreset } from '../src/presets.ts';
import { newsContract } from '../src/promptSections.ts';

function basePreset(prompts: ChatPreset['prompts']): ChatPreset {
  return {
    id: 'preset-test', name: '测试预设', description: '',
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    schema: PRESET_SCHEMA,
    settings: { temp_openai: 0.7 },
    prompts,
    promptOrder: prompts.map(entry => ({ identifier: entry.id, enabled: entry.enabled })),
  } as ChatPreset;
}

const staleContract = '【JSON 形状】只输出一个 JSON 对象…（老版本，没有 lines）';

test('v178 契约跟着版本走：没动过的老文本换成当前出厂文本', () => {
  const preset = basePreset([
    { id: 'news:contract', name: '城市新闻 · 结构契约', content: staleContract, defaultContent: staleContract, role: 'system', enabled: true, scope: 'news', contract: true },
  ]);
  const entry = presetPrompts(preset).find(item => item.id === 'news:contract')!;
  assert.equal(entry.content, newsContract());
  assert.equal(entry.defaultContent, newsContract());
  assert.match(entry.content, /"lines"/);
});

test('v178 契约跟着版本走：玩家改过的原样留着，但出厂基准会更新', () => {
  const edited = `${staleContract}\n我自己加的一条：主持人先报天气。`;
  const preset = basePreset([
    { id: 'news:contract', name: '城市新闻 · 结构契约', content: edited, defaultContent: staleContract, role: 'system', enabled: true, scope: 'news', contract: true },
  ]);
  const entry = presetPrompts(preset).find(item => item.id === 'news:contract')!;
  assert.equal(entry.content, edited);
  assert.equal(entry.defaultContent, newsContract());
});

test('v178 导出与导入一致：条数、文本、启停、顺序都不丢', () => {
  const preset = basePreset([
    { id: 'world', name: '世界观', content: '樱雾市。', role: 'system', enabled: true, scope: 'shared' },
    { id: 'nw-brief', name: '新闻·今晚的城市', content: '【写法】访谈。', role: 'system', enabled: true, scope: 'news' },
    { id: 'vn-arc', name: '舞台', content: '多写对白。', role: 'system', enabled: false, scope: 'arc' },
  ]);
  const json = JSON.parse(exportPresetJson(preset));
  assert.equal(json.schema, PRESET_SCHEMA);
  assert.equal(json.prompts.length, presetPrompts(preset).length);
  assert.equal(json.prompt_order[0].order.length, presetPrompts(preset).length, '顺序表要列全，否则导入后等于停用');

  const back = importPresetObject(json).preset!;
  assert.equal(back.schema, PRESET_SCHEMA);
  const before = presetPrompts(preset).map(entry => [entry.id, entry.content, entry.enabled]);
  const after = presetPrompts(back).map(entry => [entry.id, entry.content, entry.enabled]);
  assert.deepEqual(after, before);
});

test('v178 导出带上自动补的契约：界面上看得见的，导出里也得有', () => {
  const preset = basePreset([
    { id: 'world', name: '世界观', content: '樱雾市。', role: 'system', enabled: true, scope: 'shared' },
  ]);
  const json = JSON.parse(exportPresetJson(preset));
  const ids = json.prompts.map((entry: { identifier: string }) => entry.identifier);
  assert.ok(ids.includes('news:contract'), '虚拟补出来的契约也要写进文件');
  const contractOrder = json.prompt_order[0].order.map((item: { identifier: string }) => item.identifier);
  assert.ok(contractOrder.includes('news:contract'));
});

test('v178 导入认自己的 schema，不会把新预设降级成旧版', () => {
  const json = JSON.parse(exportPresetJson(basePreset([])));
  const back = importPresetObject({ ...json, schema: PRESET_SCHEMA }).preset!;
  assert.equal(back.schema, PRESET_SCHEMA);
});
