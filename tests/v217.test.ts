import test from 'node:test';
import assert from 'node:assert/strict';
import { repairRejectOptions } from '../src/proposalCheck.ts';
import { SECTION_PROMPTS } from '../src/promptSections.ts';
import { shippedPresets, presetPrompts } from '../src/presets.ts';

test('v217 首领提案的驳回不再补少女羁绊', () => {
  const raw = {
    opinions: [{
      authorId: 'clara',
      authorKind: 'leader',
      options: [
        { id: 'accept', changes: [{ kind: 'gold', amount: 300 }], outcomes: [] },
        { id: 'reject', changes: [{ kind: 'girl', girlId: 'clara', field: 'bond', amount: -2 }], outcomes: [] },
      ],
    }],
  };
  const repaired = repairRejectOptions(raw) as { opinions: { options: { id: string; changes: unknown[] }[] }[] };
  assert.deepEqual(repaired.opinions[0]!.options[1]!.changes, [], '首领没有少女羁绊，驳回留空');
  assert.equal(repaired.opinions[0]!.options[0]!.changes.length, 1, 'accept 原样保留');
});

test('v217 少女提案的驳回仍然只留提出者羁绊', () => {
  const raw = {
    opinions: [{
      authorId: 'yue',
      authorKind: 'girl',
      options: [{ id: 'reject', changes: [
        { kind: 'faction', faction: 'witch', amount: -4 },
        { kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 },
      ], outcomes: [] }],
    }],
  };
  const repaired = repairRejectOptions(raw) as { opinions: { options: { changes: unknown[] }[] }[] };
  assert.deepEqual(repaired.opinions[0]!.options[0]!.changes, [{ kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 }]);
});

test('v217 驳回提示词与本地校验口径一致', () => {
  const rules = SECTION_PROMPTS.find(entry => entry.id === 'dy-rules')?.content ?? '';
  assert.ok(rules.includes('reject 只写提出者的羁绊下降'), rules);
  assert.ok(rules.includes('提出者是三方首领时不写羁绊'), rules);
  for (const preset of shippedPresets()) {
    const entry = presetPrompts(preset).find(item => item.id === 'dy-rules');
    if (!entry?.content.includes('reject')) continue;
    assert.ok(entry.content.includes('reject 只写提出者的羁绊下降'), `${preset.id} 的驳回规则还是旧文案`);
  }
});
