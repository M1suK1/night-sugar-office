import test from 'node:test';
import assert from 'node:assert/strict';
import { reasoningEcho } from '../src/reasoningEcho.ts';

/** v256：思维链只是在打同一份草稿时，不再当成「额外的思考」展示。 */

const json = (narration: string, lines: string[]) => JSON.stringify({ narration, lines, options: ['a', 'b', 'c'], bond: 1 });

test('v256 完全相同算重复', () => {
  assert.equal(reasoningEcho('她把外套挂在门后，又把灯调暗了一点。', '她把外套挂在门后，又把灯调暗了一点。'), true);
});

test('v256 只是排版不同、内容互相包含也算重复', () => {
  const text = '【旁白】'.repeat(2) + '她在门口站了很久，久到走廊尽头的声控灯又灭了一次。';
  const reasoning = text.replace(/【旁白】/g, '【旁白】\n');
  assert.equal(reasoningEcho(reasoning, text), true);
});

test('v256 JSON 任务里 narration 一样就算重复（真实日志的情况）', () => {
  const narration = '星见川西北岸的水汽顺着河堤漫上来，将整座糖果公园笼罩在浮动的薄雾里。';
  const reasoning = JSON.stringify({ narration, lines: [{ text: '草稿一' }], options: ['a'], bond: 1, summary: '草稿摘要' });
  const response = JSON.stringify({ narration, lines: [{ text: '定稿一' }], options: ['a'], bond: 1, summary: '定稿摘要' });
  assert.equal(reasoningEcho(reasoning, response), true);
});

test('v256 真正的思考不会被误判', () => {
  const reasoning = 'Thinking Process:\n\n1. 先确认时间与地点，避免和上一轮冲突。\n2. 她的疲劳很高，语气应该更短。';
  const response = JSON.stringify({ narration: '她把外套挂在门后，没有回头。', lines: [], options: [], bond: 0 });
  assert.equal(reasoningEcho(reasoning, response), false);
});

test('v256 JSON 里 narration 不同就不算重复', () => {
  assert.equal(
    reasoningEcho(json('她站在门口，什么也没说。', []), json('她坐在窗边，把外套叠好。', [])),
    false,
  );
});

test('v256 缺一边时直接放过', () => {
  assert.equal(reasoningEcho('', '正文'), false);
  assert.equal(reasoningEcho('思考', ''), false);
});
