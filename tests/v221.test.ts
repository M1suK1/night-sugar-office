import test from 'node:test';
import assert from 'node:assert/strict';
import { effectValueText, materialEntries } from '../src/battleReportFacts.ts';

test('v221 战斗记录把 buff/debuff 的数值写出来', () => {
  assert.equal(effectValueText({ kind: 'buff', stat: 'agility', amount: 6 }), '敏捷 +6');
  assert.equal(effectValueText({ kind: 'debuff', stat: 'hit', amount: 4 }), '命中 −4');
  assert.equal(effectValueText({ kind: 'dot', amount: 3 }), '3');
  assert.equal(effectValueText({ kind: 'shield', amount: 12 }), '12');
  assert.equal(effectValueText({ kind: 'stun', amount: 1 }), '');
});

test('v221 战报材料奖励能换成名字与颜色', () => {
  const list = materialEntries({ 'mat-stardust': 3, 'mat-cinder': 1 });
  assert.deepEqual(list.map(item => [item.id, item.name, item.count]), [
    ['mat-stardust', '星屑', 3],
    ['mat-cinder', '余火种', 1],
  ]);
  const missing = materialEntries({ 'mat-unknown': 2 })[0]!;
  assert.equal(missing.name, 'mat-unknown', '查不到时退回 id');
  assert.ok(missing.color, '至少给一个颜色，别让徽章透明');
});
