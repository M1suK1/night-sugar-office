import test from 'node:test';
import assert from 'node:assert/strict';
import { interleaveTurn, spreadAfter } from '../src/storyLines.ts';
import { parseStoryLinesForTest } from '../src/llm.ts';

const line = (text: string, after?: number) => ({ speakerId: 'g1', speakerName: 'Es', expression: 'calm' as const, text, after });

test('v72 带 after 的台词插进对应段落之间', () => {
  const paragraphs = ['第一段旁白。', '第二段旁白。', '第三段旁白。'];
  const segments = interleaveTurn(paragraphs, [line('开头就插话', 0), line('第二段之后', 2)]);
  assert.deepEqual(segments.map(segment => `${segment.kind}${segment.index}`), [
    'line0', 'narration0', 'narration1', 'line1', 'narration2',
  ]);
});

test('v72 没写 after 时均匀铺开，不再全堆在结尾', () => {
  const paragraphs = ['一', '二', '三', '四'];
  const positions = spreadAfter(3, 4);
  assert.equal(positions.length, 3);
  assert.ok(positions.every((value, index) => index === 0 || value >= positions[index - 1]!), '位置单调不减');
  const segments = interleaveTurn(paragraphs, [line('甲'), line('乙'), line('丙')]);
  const kinds = segments.map(segment => segment.kind);
  const firstLine = kinds.indexOf('line');
  const lastNarration = kinds.lastIndexOf('narration');
  assert.ok(firstLine >= 0 && firstLine < lastNarration, '台词穿插在旁白之间，而不是全部堆在结尾');
});

test('v72 越界的 after 夹到两端', () => {
  const segments = interleaveTurn(['一', '二'], [line('越界', 99), line('负数', -5)]);
  assert.equal(segments[0]!.kind, 'line', '负数当最前面');
  assert.equal(segments[segments.length - 1]!.kind, 'line', '越界放到最后');
});

test('v72 模型写进 JSON 的 after 会被解析保留', () => {
  const cast = [{ id: 'g1', name: 'Es' }];
  const parsed = parseStoryLinesForTest([
    { speakerId: 'g1', text: '第一句', expression: 'calm', after: 2 },
    { speakerId: 'g1', text: '没写位置', expression: 'smile' },
    { speakerId: 'nobody', text: '不在场的人', expression: 'calm', after: 1 },
  ], cast, 5);
  assert.equal(parsed.length, 2, '不在 cast 里的说话人仍然被丢掉');
  assert.equal(parsed[0]!.after, 2);
  assert.equal(parsed[1]!.after, undefined);
});
