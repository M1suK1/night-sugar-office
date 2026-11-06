import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { diagnoseVariants, recoverVariants } from '../src/variantRecovery.ts';
import type { GameState, Girl } from '../src/types.ts';

const PNG = 'data:image/png;base64,AAAA';

function girlWith(over: Partial<Girl>): GameState {
  const state = createInitialState();
  const base = state.girls[0]!;
  return { ...state, girls: [{ ...base, ...over }, ...state.girls.slice(1)] };
}

const deps = (over: Partial<{ assets: Record<string, string>; cards: Record<string, string> }> = {}) => ({
  dataUrl: async (id: string) => over.assets?.[id],
  readCard: async (hash: string) => over.cards?.[hash],
});

test('v175 差分体检：报出内联、资产、可读与卡号', async () => {
  const state = girlWith({
    id: 'g1', name: '月见桃', cardId: 'card-abc',
    importedVariants: { 'uniform:smile': PNG },
    variantAssets: { 'uniform:sad': 'asset-1' },
  });
  const [report] = await diagnoseVariants(state, deps({ assets: { 'asset-1': PNG } }));
  assert.equal(report!.inline, 1);
  assert.equal(report!.assets, 1);
  assert.equal(report!.resolvable, 1);
  assert.equal(report!.cardId, 'card-abc');
});

test('v175 差分补回：资产库能读就用资产库', async () => {
  const state = girlWith({ id: 'g1', name: '月见桃', importedVariants: undefined, variantAssets: { 'uniform:sad': 'asset-1' } });
  const result = await recoverVariants(state, deps({ assets: { 'asset-1': PNG } }));
  const girl = result.state.girls[0]!;
  assert.deepEqual(girl.importedVariants, { 'uniform:sad': PNG });
  assert.equal(result.reports[0]!.resolvable, 1);
  assert.equal(result.reports[0]!.total, 1);
});

test('v175 差分补回：资产读不回时，从契约卡原文里找回来', async () => {
  const card = JSON.stringify({ format: 'night-sugar/girl-card', version: 1, girl: { importedVariants: { 'uniform:smile': PNG, 'uniform:sad': PNG } } });
  const state = girlWith({ id: 'g1', name: '月见桃', cardId: 'hash-1', importedVariants: undefined, variantAssets: { 'uniform:sad': 'gone' } });
  const result = await recoverVariants(state, deps({ cards: { 'hash-1': card } }));
  const girl = result.state.girls[0]!;
  assert.equal(Object.keys(girl.importedVariants ?? {}).length, 2, '卡面里的两条都要补回来');
  assert.equal(result.reports[0]!.fromCard, 2);
});

test('v175 差分补回：两条路都走不通时什么都不改，也别报错', async () => {
  const state = girlWith({ id: 'g1', name: '月见桃', importedVariants: undefined, variantAssets: { 'uniform:sad': 'gone' }, cardId: undefined });
  const result = await recoverVariants(state, deps());
  const girl = result.state.girls[0]!;
  assert.equal(girl.importedVariants, undefined);
  assert.equal(result.reports[0]!.total, 0);
});
