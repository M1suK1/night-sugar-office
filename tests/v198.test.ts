import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESET_SCHEMA, composeTaskSystem, ensurePromptScopes, presetPrompts, presetRuntime, type ChatPreset } from '../src/presets.ts';
import { contractPrompts } from '../src/promptContracts.ts';
import { dailyContract, eventContract, profileSchemaContract, singleIncidentContract, witchFormContract } from '../src/promptSections.ts';

/**
 * v198：最后 6 处提示词搬进预设。
 *
 * 这几段以前直接写在生成器的 body 里，界面上看不到、也改不了；
 * 搬过来以后它们是 `contract: true` 的词条，能在「设置 → 预设」里逐条审核。
 */

const stamp = '2026-01-01T00:00:00.000Z';

test('v198 四个新契约 + daily 都在 promptSections 里，且带解析器要的形状', () => {
  const single = singleIncidentContract();
  assert.match(single, /【JSON 形状】/);
  assert.match(single, /"options"/);
  assert.match(single, /恰好 3 个选项/);

  const event = eventContract();
  assert.match(event, /【JSON 形状】/);
  assert.match(event, /"scenes"/);
  assert.match(event, /恰好 2 场/);

  const witch = witchFormContract();
  assert.match(witch, /【JSON 形状】/);
  assert.match(witch, /"personality"/);
  assert.match(witch, /魔女化 · /);

  const schema = profileSchemaContract();
  assert.match(schema, /"skillIds"/);
  // 可选技能是动态的：契约里只指路，名单由正文注入，玩家改契约改不掉它。
  assert.match(schema, /【可用主动技能】/);
  assert.match(schema, /voice/);

  assert.match(dailyContract(), /【JSON 形状】/);
});

test('v198 四条新契约都进 contractPrompts，默认文本非空且标了 contract', () => {
  const entries = contractPrompts();
  const ids = ['incident:single', 'event:contract', 'profile:witch', 'daily:contract'];
  for (const id of ids) {
    const entry = entries.find(item => item.id === id);
    assert.ok(entry, `缺少契约词条 ${id}`);
    assert.equal(entry?.contract, true);
    assert.ok((entry?.content ?? '').trim().length > 40, `${id} 的默认文本太短`);
    assert.equal(entry?.defaultContent, entry?.content);
  }
  // 角色起草沿用老 id：字段清单现在就在这条可编辑契约里，覆盖它才真的生效。
  const profile = entries.find(item => item.id === 'profile:contract');
  assert.match(profile?.content ?? '', /"skillIds"/);
  assert.match(profile?.content ?? '', /voice/);
});

test('v198 schema 升到 9：老预设补上新契约，且不动玩家改过的同 id 内容', () => {
  assert.equal(PRESET_SCHEMA, 9);
  const preset: ChatPreset = {
    id: 'old', name: '老预设', createdAt: stamp, updatedAt: stamp, schema: 7,
    settings: {},
    prompts: [{ id: 'incident:single', name: '我自己写的单条契约', content: '只输出 title 与 body。', defaultContent: 'x', role: 'system', enabled: true, scope: 'incident', contract: true }],
  };
  const migrated = ensurePromptScopes(preset);
  assert.equal(migrated.schema, PRESET_SCHEMA);
  const ids = presetPrompts(migrated).map(entry => entry.id);
  for (const id of ['incident:single', 'event:contract', 'profile:witch', 'daily:contract']) assert.ok(ids.includes(id), `没补上 ${id}`);
  assert.equal(presetPrompts(migrated).find(entry => entry.id === 'incident:single')?.content, '只输出 title 与 body。');
  const again = ensurePromptScopes(migrated);
  assert.equal(presetPrompts(again).length, presetPrompts(migrated).length, '第二次迁移不该重复添加');
});

test('v198 单条突发事件用自己的契约 id，不再串到批量形状', () => {
  const contract = singleIncidentContract();
  const plain = composeTaskSystem(contract, presetRuntime(undefined), 'incident', {}, {}, 'incident:single', '第 3 日，名册：阿岚');
  assert.ok(plain.system.includes('恰好 3 个选项'), '默认应使用单条契约');
  assert.ok(!plain.system.includes('"entries"'), '单条请求里不该出现批量形状');
  assert.ok(plain.system.includes('第 3 日，名册：阿岚'), '动态局势必须留在正文里');
});

test('v198 预设覆盖了新契约：只换契约，动态局势与词条仍在', () => {
  const preset: ChatPreset = {
    id: 'mine', name: '我的预设', createdAt: stamp, updatedAt: stamp, schema: PRESET_SCHEMA,
    settings: {},
    prompts: [{ id: 'incident:single', name: '单条契约', content: 'OVERRIDE-单条契约正文', defaultContent: '出厂文本', role: 'system', enabled: true, scope: 'incident', contract: true }],
  };
  const composed = composeTaskSystem(singleIncidentContract(), presetRuntime(preset), 'incident', {}, {}, 'incident:single', '第 9 日，星砂 120');
  assert.ok(composed.system.includes('OVERRIDE-单条契约正文'));
  assert.ok(!composed.system.includes('恰好 3 个选项'), '覆盖后不该再追加出厂文本');
  assert.ok(composed.system.includes('第 9 日，星砂 120'), '覆盖契约不能吃掉这一场的动态正文');
});

test('v198 私人事件与单条突发事件不再互相串味', () => {
  const event = eventContract();
  const single = singleIncidentContract();
  assert.ok(!event.includes('"entries"'));
  assert.ok(!single.includes('"scenes"'));
  assert.ok(event.includes('"hook"'));
});
