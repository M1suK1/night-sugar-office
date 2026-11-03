import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_PLAYER, directorLabel, directorPortraitOf, playerPortraitMissing } from '../src/player.ts';

const calm = 'data:image/png;base64,AAAA';
const smile = 'data:image/png;base64,BBBB';
const bare = { ...EMPTY_PLAYER, expressions: {} };

test('v80 所长立绘：按表情取图，缺这张就回落主立绘', () => {
  const profile = { ...EMPTY_PLAYER, portrait: calm, expressions: { smile } };
  assert.equal(directorPortraitOf(profile, 'smile'), smile);
  assert.equal(directorPortraitOf(profile, 'sad'), calm, '没有这张差分就用主立绘');
  assert.equal(directorPortraitOf(profile), calm);
  const onlyCalm = { ...EMPTY_PLAYER, expressions: { calm } };
  assert.equal(directorPortraitOf(onlyCalm, 'angry'), calm, '主立绘空但平静那张在，就顶上来');
  assert.equal(directorPortraitOf(bare, 'smile'), '', '一张都没有就是空串，界面画剪影');
});

test('v80 所长缺图判定与称呼', () => {
  assert.equal(playerPortraitMissing(bare), true);
  assert.equal(playerPortraitMissing({ ...EMPTY_PLAYER, portrait: calm }), false);
  assert.equal(playerPortraitMissing({ ...EMPTY_PLAYER, expressions: { sad: calm } }), false, '有任意一张差分就不算缺');
  assert.equal(directorLabel({ ...EMPTY_PLAYER, alias: '夜班负责人' }), '夜班负责人');
  assert.equal(directorLabel({ ...EMPTY_PLAYER, name: '白鸟' }), '白鸟');
  assert.equal(directorLabel(bare), '所长');
});
