import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDialogueReply } from '../src/llm.ts';

test('v127 模型把枚举抄成 calm|smile|… 时取第一个合法表情', () => {
  const lines = parseDialogueReply(JSON.stringify({
    lines: [{ text: '第一句', expression: 'calm|smile|surprise|sad|angry|shy' }],
  }));
  assert.equal(lines.length, 1);
  assert.equal(lines[0]!.expression, 'calm', '第一个合法值就是 calm');
});

test('v127 竖线列表里第一个不合法时继续往后找', () => {
  const lines = parseDialogueReply(JSON.stringify({
    lines: [{ text: '第二句', expression: '微笑 / shy' }],
  }));
  assert.equal(lines[0]!.expression, 'smile', '中文与英文混写也能认出来');
});

test('v127 认不出的表情仍然退回平静', () => {
  const lines = parseDialogueReply(JSON.stringify({ lines: [{ text: '第三句', expression: '??? ' }] }));
  assert.equal(lines[0]!.expression, 'calm');
});
