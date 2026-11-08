import test from 'node:test';
import assert from 'node:assert/strict';
import { endingLeadBlock } from '../src/promptSections.ts';

test('v188 输入框里没有字：收尾不带引子，也不替所长编一句', () => {
  for (const empty of [undefined, '', '   ', '\n\t ']) {
    const block = endingLeadBlock(empty);
    assert.ok(block.startsWith('【所长的决定】'));
    assert.ok(block.includes('没有多写一句'));
    assert.ok(!block.includes('「'), '空输入不该出现引号里的假台词');
    assert.ok(block.includes('不要留待续的钩子'));
  }
});

test('v188 输入框里的那句原样进提示词，作为收尾的引子', () => {
  const block = endingLeadBlock('我把伞留在门口，先不走。');
  assert.ok(block.includes('「我把伞留在门口，先不走。」'));
  assert.ok(block.includes('引子'));
  assert.ok(block.includes('不要复述'));
  assert.ok(block.includes('不要替所长补话'));
  assert.ok(block.includes('不要新选项'));
});

test('v188 换行与多余空白压成一行，不破坏段落结构', () => {
  const block = endingLeadBlock('我推门进去，\n\n  看见她坐在窗边，\t没有开灯。');
  assert.ok(block.includes('「我推门进去， 看见她坐在窗边， 没有开灯。」'));
  // 引子那段只能占一行：块里除标签外不应出现多余空行。
  const leadLine = block.split('\n').find(line => line.startsWith('所长把这段剧情停在这里。他最后写的是'));
  assert.ok(leadLine, '引子应当单独成行');
  assert.equal(leadLine.split('「').length, 2);
});

test('v188 超长输入截到 300 字，和输入框上限一致', () => {
  const long = '字'.repeat(420);
  const block = endingLeadBlock(long);
  const quoted = block.slice(block.indexOf('「') + 1, block.indexOf('」'));
  assert.equal(quoted.length, 300);
});
