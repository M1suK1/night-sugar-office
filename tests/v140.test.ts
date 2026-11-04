import test from 'node:test';
import assert from 'node:assert/strict';
import { portraitSourceOf } from '../src/battleNote.ts';

test('v140 旧战报快照没记资产 id 时，回查当前存档那位少女', () => {
  const unit = { portrait: '', girlId: 'g1' };
  const girl = { portrait: '', portraitAsset: 'p-g1' };
  assert.deepEqual(portraitSourceOf(unit, girl), { portrait: '', portraitAsset: 'p-g1' });
});

test('v140 单位快照自己有图就用它，不被存档覆盖', () => {
  const unit = { portrait: 'data:image/webp;base64,AA', girlId: 'g1' };
  const girl = { portrait: 'data:image/webp;base64,BB', portraitAsset: 'p-g1' };
  assert.equal(portraitSourceOf(unit, girl).portrait, 'data:image/webp;base64,AA');
});

test('v140 快照有资产 id 但存档更新了资产 id，以快照为准（那是当时的她）', () => {
  const unit = { portrait: '', portraitAsset: 'p-old', girlId: 'g1' };
  const girl = { portrait: '', portraitAsset: 'p-new' };
  assert.equal(portraitSourceOf(unit, girl).portraitAsset, 'p-old');
});

test('v140 什么都没记就老老实实返回空，界面显示名字首字', () => {
  assert.deepEqual(portraitSourceOf({ portrait: '', girlId: 'g1' }, undefined), { portrait: '' });
  assert.deepEqual(portraitSourceOf({ portrait: '', girlId: 'g1' }, { portrait: '' }), { portrait: '' });
});

test('v140 敌方单位没有 girlId，也不会去查存档', () => {
  assert.deepEqual(portraitSourceOf({ portrait: '' }, undefined), { portrait: '' });
});
