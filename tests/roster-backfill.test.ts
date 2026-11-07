import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { rosterDescriptionsMissing } from '../src/rosterBackfill.ts';

test('v179 名册缺描述时才会回填：有卡号但没性格/外形的人被点名', () => {
  const base = createInitialState();
  const bare = { id: 'g_card_a', name: '珐露珊', codename: '星矩', title: '古星轨解构导师', cardId: 'aaa', quote: '称我前辈。', note: '' };
  const full = { ...bare, id: 'g_card_b', cardId: 'bbb', personality: '考据学者做派。', appearance: '水蓝色双马尾。' };
  const state = { ...base, customFactionGirls: [bare, full] as never };
  const missing = rosterDescriptionsMissing(state as never);
  assert.deepEqual(missing, ['aaa'], '只补缺的那位，已经写着的不动');
});

test('v179 名册没有卡号的人不参与回填', () => {
  const base = createInitialState();
  const noCard = { id: 'g_manual', name: '手写的人', title: '随从', note: '' };
  const state = { ...base, customFactionGirls: [noCard] as never };
  assert.deepEqual(rosterDescriptionsMissing(state as never), []);
});
