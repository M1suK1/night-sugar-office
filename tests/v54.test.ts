import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROMPTS, PRESET_SCHEMA, composeTaskSystem, ensurePromptScopes, presetPrompts, presetRuntime, type ChatPreset } from '../src/presets.ts';
import { SECTION_PROMPTS, arcContract, arcOpeningContract, arcTurnContract } from '../src/promptSections.ts';

function schemaFive(ids: string[]): ChatPreset {
  return {
    id: 'old', name: '老预设', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', schema: 5,
    settings: {},
    prompts: ids.map((id, index) => ({ id, name: id, content: '旧内容', role: 'system' as const, enabled: true, scope: 'battle' as const, builtin: true })),
    promptOrder: ids.map(id => ({ identifier: id, enabled: true })),
  };
}

test('v54 迁移：schema 5 的老预设会补上后来新增的分区，编辑器里才看得到', () => {
  const preset = schemaFive(['battle']);
  const migrated = ensurePromptScopes(preset);
  assert.equal(migrated.schema, PRESET_SCHEMA);
  const ids = presetPrompts(migrated).map(entry => entry.id);
  for (const section of SECTION_PROMPTS) assert.ok(ids.includes(section.id), `没补上 ${section.id}`);
  assert.ok(ids.includes('bt-brief'), '战斗札记的现场分区要补进老预设');
  assert.ok(ids.includes('arc-brief'), '完整剧情的写法分区要补进老预设');
  assert.ok(ids.includes('nw-brief'), '城市新闻的分区也要补上');
  assert.equal(presetPrompts(migrated).find(entry => entry.id === 'battle')?.content, '旧内容', '同 id 的旧词条内容不动');
  assert.ok(migrated.promptOrder?.some(item => item.identifier === 'bt-brief'), '补进来的分区要进 promptOrder，否则不注入');
  const again = ensurePromptScopes(migrated);
  assert.equal(presetPrompts(again).length, presetPrompts(migrated).length, '第二次迁移不该重复添加');
});

test('v54 默认词条里能直接看到这两块分区', () => {
  const battleIds = DEFAULT_PROMPTS.filter(entry => entry.scope === 'battle').map(entry => entry.id);
  const arcIds = DEFAULT_PROMPTS.filter(entry => entry.scope === 'arc').map(entry => entry.id);
  assert.ok(battleIds.includes('bt-brief'));
  assert.ok(arcIds.includes('arc-brief'));
  const arc = DEFAULT_PROMPTS.find(entry => entry.id === 'arc-brief');
  assert.equal(arc?.scope, 'arc');
  for (const rule of ['只写本场主角自己的故事', '最多三段', '不同的结局', '不写数值']) {
    assert.ok(arc?.content.includes(rule), `分区里要写清「${rule}」`);
  }
});

test('v54 完整剧情的三份契约：JSON 骨架与硬性上限留在代码里', () => {
  const arc = arcContract('至少 4 段，每段旁白 260–520 字');
  assert.ok(arc.includes('"passages"') && arc.includes('至少 4 段'));
  assert.ok(arc.includes('60–120 字') && arc.includes('绝对值不超过 6'));
  const opening = arcOpeningContract();
  assert.ok(opening.includes('"narration"') && opening.includes('250–350 字'));
  assert.ok(opening.includes('恰好 3 条'));
  const turn = arcTurnContract();
  assert.ok(turn.includes('1500–3000 字') && turn.includes('−2 到 2'));
  assert.ok(turn.includes('也不要把所长这一轮的动作复述成一句台词'));
});

test('v54 拼装：arc 分区在前、契约在最后，开场与续写的契约不互相污染', () => {
  const runtime = { ...presetRuntime(undefined), entries: DEFAULT_PROMPTS };
  const composed = composeTaskSystem(arcOpeningContract(), runtime, 'arc', { char: '月见桃' }, {});
  assert.ok(composed.system.includes('这一次要写哪一种'), '共用写法分区要注入');
  assert.ok(composed.system.trimEnd().endsWith('不要写数值与技能名。'), '开场契约必须在最后');
  assert.equal(composed.system.includes('900–3000 字'), false, '续写的字数要求不该出现在开场请求里');
});
