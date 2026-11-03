import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStoryLinesForTest } from '../src/llm.ts';
import { arcTurnContract } from '../src/promptSections.ts';

const cast = [{ id: 'g1', name: '琉音' }, { id: 'g2', name: '洛茜' }];

test('v74 模型写的所长台词被丢掉，不会和行动气泡重复', () => {
  const parsed = parseStoryLinesForTest([
    { speakerId: 'player', text: '咱们才刚开业，能赚一点是一点。', expression: 'calm' },
    { speakerId: 'g1', text: '哎呀，所长大人教训得是！', expression: 'smile' },
  ], cast, 8);
  assert.equal(parsed.length, 1, '只留少女那句');
  assert.equal(parsed[0]!.speakerId, 'g1');
});

test('v74 少女的台词与表情仍然照常解析', () => {
  const parsed = parseStoryLinesForTest([
    { speakerId: 'g2', text: '喂，你们两个家伙……', expression: 'angry', mode: 'thought', after: 1 },
  ], cast, 8);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.expression, 'angry');
  assert.equal(parsed[0]!.mode, 'thought');
  assert.equal(parsed[0]!.after, 1);
});

test('v74 契约里写清了不要写 player', () => {
  const contract = arcTurnContract();
  assert.match(contract, /不要写 player/);
  assert.doesNotMatch(contract, /speakerId 只能取在场的人或 player/);
});
