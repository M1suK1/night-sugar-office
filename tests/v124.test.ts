import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE_TOKEN_FLOOR, tokenFloorFor } from '../src/llm.ts';

test('v124 每种生成都有最低输出预算，写长文的给得最多', () => {
  assert.equal(tokenFloorFor('storyline'), 32000);
  assert.equal(tokenFloorFor('arc'), 24000);
  assert.ok(tokenFloorFor('event') >= 16000);
  assert.ok(tokenFloorFor('daily') >= 12000);
  assert.ok(tokenFloorFor('incident') >= 12000);
  assert.equal(tokenFloorFor('不存在的用途'), 0, '没写过的用途不设下限');
});

test('v124 下限随用途递增：蓝图 ≥ 剧情 ≥ 短结构', () => {
  const blueprint = tokenFloorFor('storyline');
  const arc = tokenFloorFor('arc');
  const short = tokenFloorFor('news');
  assert.ok(blueprint >= arc && arc >= short);
  assert.equal(SCOPE_TOKEN_FLOOR.storyline, 32000);
});
