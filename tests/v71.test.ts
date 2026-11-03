import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { describeStateSize, measureState } from '../src/saveSize.ts';
import { slimStateForSave, shouldSlimVariant, VARIANT_SLIM_THRESHOLD } from '../src/saveSlim.ts';
import { SLOT_BYTES_LIMIT } from '../src/saves.ts';
import { SAVE_FILE_BYTES_MAX } from '../src/fileLimits.ts';

test('v71 存档体检：表情差分排在最前面', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.importedVariants = {
    'uniform:calm': `data:image/webp;base64,${'A'.repeat(400_000)}`,
    'uniform:smile': `data:image/webp;base64,${'B'.repeat(400_000)}`,
  };
  state.logs = [{ id: 'log-1', time: '第 1 日', kind: 'base', text: '短日志' }] as never;
  const parts = measureState(state);
  assert.match(parts[0]!.label, /表情差分/, `第一名是 ${parts[0]!.label}`);
  assert.ok(parts[0]!.bytes > 700_000);
  assert.match(describeStateSize(state), /表情差分/);
});

test('v71 瘦身只挑明显偏大的内联差分，资产键与小图不动', () => {
  assert.equal(shouldSlimVariant(`data:image/webp;base64,${'A'.repeat(VARIANT_SLIM_THRESHOLD + 1)}`), true);
  assert.equal(shouldSlimVariant(`data:image/webp;base64,${'A'.repeat(1000)}`), false);
  assert.equal(shouldSlimVariant('asset:abc123'), false);
  assert.equal(shouldSlimVariant(undefined), false);
});

test('v71 没有 canvas 时瘦身是空操作，绝不因为瘦身失败挡住存档', async () => {
  const state = createInitialState();
  const big = `data:image/webp;base64,${'A'.repeat(200_000)}`;
  state.girls[0]!.importedVariants = { 'uniform:calm': big };
  const result = await slimStateForSave(state);
  assert.equal(result.saved, 0);
  assert.equal(result.state.girls[0]!.importedVariants!['uniform:calm'], big);
});

test('v71 两个上限一致，且都放宽到 96MB', () => {
  assert.equal(SLOT_BYTES_LIMIT, SAVE_FILE_BYTES_MAX);
  assert.equal(SLOT_BYTES_LIMIT, 96_000_000);
});
