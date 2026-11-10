import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTION_PROMPTS, storylineContract } from '../src/promptSections.ts';
import { presetPrompts, shippedPresets } from '../src/presets.ts';
import { buildGraphFromDraft, validateGraph, type StoryGraphDraft } from '../src/storygraph.ts';

/** v238：选择节点的各条出口汇到同一个分支，只在提示词里做软限制，不加硬校验。 */

const sectionOf = (id: string) => SECTION_PROMPTS.find(entry => entry.id === id)!;

test('v238 连线总则：每个选项的出边要落到不同的后续节点', () => {
  const ports = sectionOf('sl-ports').content;
  assert.match(ports, /每个选项的出边要落到不同的后续节点/);
  assert.match(ports, /不能是同一个节点 id/);
  assert.match(ports, /wait 节点合并/, '要说明怎么合法汇合');
});

test('v238 提交前自检也带上这一条', () => {
  assert.match(sectionOf('sl-guard').content, /各条出边不能指向同一个节点/);
});

test('v238 出厂预设与代码默认同步', () => {
  for (const preset of shippedPresets()) {
    const entries = presetPrompts(preset);
    const ports = entries.find(entry => entry.id === 'sl-ports');
    const guard = entries.find(entry => entry.id === 'sl-guard');
    assert.ok(ports, `${preset.id} 缺少 sl-ports`);
    assert.ok(guard, `${preset.id} 缺少 sl-guard`);
    assert.ok(ports!.content.includes('每个选项的出边要落到不同的后续节点'), `${preset.id} 的连线总则没同步`);
    assert.ok(guard!.content.includes('各条出边不能指向同一个节点'), `${preset.id} 的自检没同步`);
  }
});

test('v238 蓝图契约也带上这条软限制，出厂预设与默认一致', () => {
  const contract = storylineContract();
  assert.match(contract, /不同选项的边不要直接指向同一个节点/);
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'storyline:contract');
    assert.ok(entry, `${preset.id} 缺少 storyline:contract`);
    assert.equal(entry!.content.trim(), contract.trim(), `${preset.id} 的蓝图契约还是旧快照`);
  }
});

test('v238 软限制不是硬校验：两个选项汇到同一节点仍然通过结构校验', () => {
  const draft: StoryGraphDraft = {
    nodes: [
      { id: 'n1', kind: 'start', data: { kind: 'start' } },
      {
        id: 'n2', kind: 'choice', title: '门口',
        data: {
          kind: 'choice', prompt: '让她进来？',
          options: [
            { id: 'a', label: '让她进来', intent: '', effect: { bond: 2 } },
            { id: 'b', label: '先关门', intent: '', effect: { bond: -1 } },
          ],
        },
      },
      { id: 'n3', kind: 'end', data: { kind: 'end', summary: '到这里收束。', ending: '留下' } },
    ],
    edges: [
      { from: 'n1', to: 'n2' },
      { from: 'n2', fromPort: 'a', to: 'n3' },
      { from: 'n2', fromPort: 'b', to: 'n3' },
    ],
  };
  const issues = validateGraph(buildGraphFromDraft(draft));
  assert.deepEqual(issues.filter(issue => issue.level === 'error'), []);
  assert.equal(issues.some(issue => /同一个|汇合|分支/.test(issue.message)), false, '不该为此报任何结构问题');
});
