import test from 'node:test';
import assert from 'node:assert/strict';
import { composeTaskSystem, presetRuntime, type ChatPreset } from '../src/presets.ts';
import { contractPrompts } from '../src/promptContracts.ts';
import { arcOpeningContract, arcTurnContract, storylineStartContract } from '../src/promptSections.ts';

/** 契约词条就住在预设的 prompts 里（带 contract: true），这里按同一形状造一个。 */
const preset = (contracts: { id: string; content: string; defaultContent?: string }[]): ChatPreset => ({
  id: 'p1', name: '测试', builtin: false, settings: {}, regex: [],
  prompts: contracts.map(entry => ({
    id: entry.id,
    name: entry.id,
    content: entry.content,
    defaultContent: entry.defaultContent ?? entry.content,
    role: 'system' as const,
    enabled: true,
    contract: true,
    scope: contractPrompts().find(item => item.id === entry.id)?.scope ?? 'shared',
  })),
}) as unknown as ChatPreset;

test('v131 剧情续写与开场的契约都作为词条暴露出来', () => {
  const ids = contractPrompts().map(entry => entry.id);
  assert.ok(ids.includes('arc:turn'), '剧情续写要在预设里能改');
  assert.ok(ids.includes('arc:opening'), '剧情开场要在预设里能改');
  assert.ok(ids.includes('storyline:start'), '故事线起点的 4 幕契约不能再写死在代码里');
  assert.ok(ids.includes('storyline:contract'), '蓝图契约保留');
  const turn = contractPrompts().find(entry => entry.id === 'arc:turn')!;
  assert.equal(turn.content, arcTurnContract());
  assert.equal(turn.scope, 'arc');
});

test('v131 改了剧情续写契约就会盖住代码默认值，没改就用默认', () => {
  const edited = '【我的写法】只输出 JSON，narration 至少 800 字。';
  const runtime = presetRuntime(preset([{ id: 'arc:turn', content: edited, defaultContent: arcTurnContract() }]));
  const custom = composeTaskSystem(arcTurnContract(), runtime, 'arc', {}, {}, 'arc:turn');
  assert.ok(custom.system.includes('【我的写法】'), '玩家的版本要生效');
  assert.ok(!custom.system.includes('before 必填'), '默认契约要被替换掉');

  const untouched = presetRuntime(preset([{ id: 'arc:turn', content: arcTurnContract(), defaultContent: arcTurnContract() }]));
  const fallback = composeTaskSystem(arcTurnContract(), untouched, 'arc', {}, {}, 'arc:turn');
  assert.ok(fallback.system.includes('【JSON 形状】'), '没改过就按代码默认值走');
});

test('v131 三个剧情契约互不串味', () => {
  const runtime = presetRuntime(preset([
    { id: 'arc:opening', content: '【开场特别版】', defaultContent: arcOpeningContract() },
    { id: 'arc:turn', content: '【续写特别版】', defaultContent: arcTurnContract() },
    { id: 'storyline:start', content: '【起点特别版】', defaultContent: storylineStartContract() },
  ]));
  assert.ok(composeTaskSystem(arcOpeningContract(), runtime, 'arc', {}, {}, 'arc:opening').system.includes('【开场特别版】'));
  assert.ok(composeTaskSystem(arcTurnContract(), runtime, 'arc', {}, {}, 'arc:turn').system.includes('【续写特别版】'));
  assert.ok(composeTaskSystem(storylineStartContract(), runtime, 'storyline', {}, {}, 'storyline:start').system.includes('【起点特别版】'));
  const blueprint = composeTaskSystem('【蓝图默认】', runtime, 'storyline', {}, {}, 'storyline:contract');
  assert.ok(blueprint.system.includes('【蓝图默认】'), '蓝图契约没被改过就该用代码默认值');
});
