import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeVoice } from '../src/voice.ts';

test('v113 语料被写成一整段带引号的字符串时，按句拆开而不是变成一条长条目', () => {
  const voice = sanitizeVoice({
    tone: '贵族学园出身的优雅咬字，音调清脆且偏高，语调中带着不容置疑的',
    habits: '自称「我」或「泰姆菲尔德的后人」，绝不使用街头俚语。","在指出他人疏漏前会先轻巧地叹气，语气虽挑剔却保持着克制的教养。',
    samples: '那时双眼睁开了一下，看见具叫个人。","事务所的杂物摆放得太失礼节了，在核对委托清单前，请容我先把桌上的烛台摆正。"',
  })!;
  assert.equal(voice.tone, '贵族学园出身的优雅咬字，音调清脆且偏高，语调中带着不容置疑的', 'tone 完整保留，不再被 40 字砍断');
  assert.equal(voice.habits.length, 2, '两条习惯各成一条');
  assert.ok(voice.habits[0]!.startsWith('自称「我」'));
  assert.ok(!voice.habits[1]!.includes('","'), '不再带 JSON 分隔符');
  assert.equal(voice.samples.length, 2);
  assert.ok(voice.samples[1]!.includes('烛台'));
  assert.ok(voice.samples.every(sample => !sample.startsWith('"')), '首尾引号被去掉');
});
