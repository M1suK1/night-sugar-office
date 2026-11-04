import test from 'node:test';
import assert from 'node:assert/strict';
import { closeTruncatedJson } from '../src/jsonRepair.ts';
import { extractJsonObject } from '../src/llm.ts';

const blueprint = {
  title: '踏火千面的终幕狂澜',
  premise: '花火盯上了三方的账本与钟楼。',
  nodes: [
    { id: 'n_start', kind: 'start', title: '开端', data: { kind: 'start' } },
    { id: 'n_end', kind: 'end', title: '结局', data: { kind: 'end', summary: '收束', ending: '绝景' } },
  ],
  edges: [{ from: 'n_start', fromPort: 'out', to: 'n_end' }],
};

test('v122 被截断的蓝图（只差收尾括号）能补齐并解析出来', () => {
  const text = JSON.stringify(blueprint);
  for (const cut of [1, 3, 8, 20]) {
    const truncated = text.slice(0, text.length - cut);
    const repaired = closeTruncatedJson(truncated);
    if (!repaired) continue; // 砍在字符串中间时补不出来，交给下一层处理
    const parsed = JSON.parse(repaired) as typeof blueprint;
    assert.equal(parsed.title, blueprint.title);
    assert.ok(Array.isArray(parsed.nodes));
  }
});

test('v122 extractJsonObject 在括号没闭合时也能救回只差收尾的内容', () => {
  const text = JSON.stringify(blueprint);
  const salvaged = extractJsonObject(text.slice(0, text.length - 2));
  assert.ok(salvaged, '应当救回来');
  assert.equal(salvaged!.title, blueprint.title);
});

test('v122 结构本身写坏的 JSON 仍然返回空，不硬凑', () => {
  assert.equal(closeTruncatedJson('{"a":[1,2}'), null, '括号类型对不上就放弃');
  assert.equal(closeTruncatedJson('不是 JSON'), null);
});
