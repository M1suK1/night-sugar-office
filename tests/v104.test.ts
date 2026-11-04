import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillPortraits, portraitsMissing } from '../src/portraitBackfill.ts';
import type { Girl } from '../src/types.ts';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const girl = (id: string, patch: Partial<Girl> = {}): Girl => ({ id, name: id, portrait: '', ...patch } as unknown as Girl);

test('v104 卡里有图、名册里是剪影的，按 cardId 补回立绘', async () => {
  const list = [girl('a', { cardId: 'hash-a' }), girl('b', { cardId: 'hash-b' }), girl('c'), girl('d', { cardId: 'hash-d', portrait: png })];
  assert.deepEqual(portraitsMissing(list).map(item => item.id), ['a', 'b'], '只有「有 cardId 且没图」的要补');

  const readCard = async (hash: string) => hash === 'hash-a'
    ? JSON.stringify({ girl: { portrait: png } })
    : hash === 'hash-b' ? JSON.stringify({ girl: {} }) : undefined;
  const result = await backfillPortraits(list, readCard);
  assert.equal(result.filled, 1);
  assert.equal(result.portraits.get('a'), png);
  assert.equal(result.portraits.has('b'), false, '卡里也没图就跳过');
});

test('v104 卡 JSON 坏了不影响其他人', async () => {
  const list = [girl('bad', { cardId: 'broken' }), girl('good', { cardId: 'ok' })];
  const result = await backfillPortraits(list, async hash => (hash === 'broken' ? '{not json' : JSON.stringify({ girl: { portrait: png } })));
  assert.equal(result.filled, 1);
  assert.equal(result.portraits.get('good'), png);
});
