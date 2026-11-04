import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';
import { createInitialState } from '../src/game.ts';

test('v111 语料跟着契约卡走：导出再导入还是同一段说话方式', () => {
  const girl = createInitialState().girls[0]!;
  girl.voice = { tone: '短句，先反问再回答', habits: ['自称「我」，从不用敬语'], samples: ['别问了。'] };

  const card = buildGirlCard(girl, { day: 14 });
  assert.deepEqual(card.girl.voice, girl.voice, '卡里带上语料');

  const parsed = parseGirlCard(JSON.stringify(card));
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.message);
  const round = parsed.card!.girl.voice;
  assert.equal(round?.tone, '短句，先反问再回答');
  assert.deepEqual(round?.habits, ['自称「我」，从不用敬语']);
});

test('v111 没有语料的卡读出来还是空的，不会凭空造一段', () => {
  const girl = createInitialState().girls[0]!;
  delete girl.voice;
  const card = buildGirlCard(girl, { day: 14 });
  assert.equal(card.girl.voice, undefined);
  const parsed = parseGirlCard(JSON.stringify(card));
  assert.ok(parsed.ok);
  assert.equal(parsed.card!.girl.voice, undefined);
});
