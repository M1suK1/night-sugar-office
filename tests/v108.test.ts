import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillPortraits } from '../src/portraitBackfill.ts';
import type { Girl } from '../src/types.ts';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const girl = (id: string, name: string, patch: Partial<Girl> = {}) => ({ id, name, portrait: '', ...patch } as unknown as Girl);

test('v108 没有 cardId 的人按同名卡补图（现场登记 / 旧版本导入的那批）', async () => {
  const box = [{ hash: 'h1', name: '洛可可' }];
  const readCard = async (hash: string) => (hash === 'h1' ? JSON.stringify({ girl: { portrait: png } }) : undefined);
  const result = await backfillPortraits([girl('a', '洛可可'), girl('b', '没有这张卡')], readCard, box);
  assert.equal(result.filled, 1);
  assert.equal(result.portraits.get('a'), png);
  assert.equal(result.portraits.has('b'), false, '卡库里没有同名卡就跳过');
});

test('v108 cardId 优先于同名匹配，已经有人像的不动', async () => {
  const box = [{ hash: 'byName', name: '花火' }];
  const readCard = async (hash: string) => JSON.stringify({ girl: { portrait: hash === 'byId' ? `${png}#id` : png } });
  const result = await backfillPortraits([
    girl('a', '花火', { cardId: 'byId' }),
    girl('b', '花火', { portrait: png }),
  ], readCard, box);
  assert.equal(result.filled, 1, '已经有图的不补');
  assert.equal(result.portraits.get('a'), `${png}#id`);
});
