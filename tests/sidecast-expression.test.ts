import test from 'node:test';
import assert from 'node:assert/strict';
import { castExpressionOf, type SideCastActor } from '../src/castExpression.ts';

const actor = (over: Partial<SideCastActor> = {}): SideCastActor => ({
  uid: 'g1', side: 'ally', girlId: 'g1', name: '月见桃', portrait: '', color: '#f3aec9', expression: 'calm',
  ...over,
});

test('v173 立绘表情：说话的人换成那句的情绪，其他人保持自己的', () => {
  const speaker = castExpressionOf(actor(), { speakerId: 'g1', speakerSide: 'ally', expression: 'smile' });
  assert.equal(speaker.speaking, true);
  assert.equal(speaker.expression, 'smile');

  const other = castExpressionOf(actor({ uid: 'g2', girlId: 'g2' }), { speakerId: 'g1', speakerSide: 'ally', expression: 'smile' });
  assert.equal(other.speaking, false);
  assert.equal(other.expression, 'calm', '没说话的人不该跟着换表情');
});

test('v173 立绘表情：没有台词可跟时保持自己的表情（不会整片变成平静）', () => {
  const idle = castExpressionOf(actor({ expression: 'sad' }), null);
  assert.equal(idle.speaking, false);
  assert.equal(idle.expression, 'sad');
});

test('v173 立绘表情：只有 uid 的敌方单位也能被认出来说话', () => {
  const enemy = castExpressionOf(actor({ uid: 'enemy-1', side: 'enemy', girlId: undefined }), { speakerId: 'enemy-1', speakerSide: 'enemy', expression: 'angry' });
  assert.equal(enemy.speaking, true);
  assert.equal(enemy.expression, 'angry');
});
