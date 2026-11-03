import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';

test('v75 外貌与服装描述可以手改，换行被抹平、超长被截断', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const long = '她'.repeat(300);
  const changed = act(state, { type: 'setProfileText', girlId: girl.id, field: 'appearance', text: `  留着黑白分明的长发\n笑意狡黠  ` });
  assert.equal(changed.ok, true);
  const appearance = changed.state.girls.find(entry => entry.id === girl.id)!.appearance;
  assert.equal(appearance, '留着黑白分明的长发 笑意狡黠');
  assert.ok(changed.state.logs[0]!.text.includes('外貌被改写'));

  const trimmed = act(state, { type: 'setProfileText', girlId: girl.id, field: 'outfitDescription', text: long });
  assert.equal(trimmed.state.girls.find(entry => entry.id === girl.id)!.outfitDescription.length, 240);
});

test('v75 清空与找不到人：一个允许，一个报错', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const cleared = act(state, { type: 'setProfileText', girlId: girl.id, field: 'appearance', text: '   ' });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.state.girls.find(entry => entry.id === girl.id)!.appearance, '');
  const missing = act(state, { type: 'setProfileText', girlId: 'nobody', field: 'appearance', text: 'x' });
  assert.equal(missing.ok, false);
});
