import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { girlsMissingPortrait, portraitMissing } from '../src/portraitReload.ts';

const png = 'data:image/png;base64,iVBORw0KGgo=';

test('v78 立绘缺失：空串与外链都算缺，data URL 才算有', () => {
  assert.equal(portraitMissing({ portrait: '' }), true);
  assert.equal(portraitMissing({ portrait: 'https://example.com/a.png' }), true);
  assert.equal(portraitMissing({ portrait: png }), false);
  const state = createInitialState();
  const living = state.girls.filter(girl => !girl.dead && !girl.retired).length;
  const stripped = { ...state, girls: state.girls.map(girl => ({ ...girl, portrait: '' })) };
  assert.equal(girlsMissingPortrait(stripped).length, living, '全员都缺');
  const filled = {
    ...state,
    girls: state.girls.map(girl => (girl.dead || girl.retired ? girl : { ...girl, portrait: png })),
  };
  assert.equal(girlsMissingPortrait(filled).length, 0, '都补上了就不缺');
});

test('v78 重新载入立绘：合法的能存，垃圾被拒，空串是清空', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const stripped = { ...state, girls: state.girls.map(entry => (entry.id === girl.id ? { ...entry, portrait: '' } : entry)) };

  const restored = act(stripped, { type: 'setPortrait', girlId: girl.id, portrait: png });
  assert.equal(restored.ok, true, restored.message);
  assert.equal(restored.state.girls.find(entry => entry.id === girl.id)!.portrait, png);
  assert.ok(restored.state.logs[0]!.text.includes('立绘重新载入'));

  const broken = act(stripped, { type: 'setPortrait', girlId: girl.id, portrait: 'javascript:alert(1)' });
  assert.equal(broken.ok, false);
  assert.equal(broken.state.girls.find(entry => entry.id === girl.id)!.portrait, '');

  const cleared = act(restored.state, { type: 'setPortrait', girlId: girl.id, portrait: '' });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.state.girls.find(entry => entry.id === girl.id)!.portrait, '');

  assert.equal(act(stripped, { type: 'setPortrait', girlId: 'nobody', portrait: png }).ok, false);
});
