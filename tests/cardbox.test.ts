import test from 'node:test';
import assert from 'node:assert/strict';
import { __resetKvForTests, kvGet, kvSet } from '../src/store.ts';
import {
  CARD_BOX_INDEX_KEY, CARD_BOX_KEY, CARD_RAW_PREFIX,
  cardboxAdd, cardboxCards, loadCardBox, readCardRaw, type CardBoxEntry,
} from '../src/cardbox.ts';
import { pickWithinBytes } from '../src/cardMarket.ts';
import { planCardBatches } from '../src/cardImport.ts';
import { act, createInitialState } from '../src/game.ts';
import { parseGirlCard } from '../src/cards.ts';

function sampleCard(name: string): string {
  return JSON.stringify({
    format: 'night-sugar/girl-card', version: 1, exportedAt: '2026-01-01T00:00:00.000Z', sourceDay: 1,
    girl: {
      name, codename: 'K-1', title: '被收进文件柜的人', element: '星光系', color: '#8fd3c7',
      goal: '等到被翻开。', appearance: '发梢有折痕。', personality: '安静。', outfitDescription: '干净的值夜制服。',
      level: 4, stats: { magic: 66, insight: 62, agility: 60, empathy: 72 },
      skillIds: ['glimmer-spear', 'night-prayer', 'moon-phase'], traitIds: [], factionTag: 'witch',
    },
  });
}

test('cardbox：索引只存元数据，原文按 hash 单独存', async () => {
  __resetKvForTests();
  const text = sampleCard('索引测试');
  const added = await cardboxAdd([{ name: 'a.json', text }], []);
  assert.equal(added.added.length, 1);

  const entries = await loadCardBox();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.name, '索引测试');
  assert.equal(entries[0]!.stats.magic, 66);
  assert.deepEqual(entries[0]!.skillIds, ['glimmer-spear', 'night-prayer', 'moon-phase']);
  assert.equal('raw' in entries[0]!, false, 'loadCardBox 不再把全文带回来');
  assert.ok(entries[0]!.bytes >= text.length);

  assert.equal(await readCardRaw(entries[0]!.hash), text, '原文仍在独立键里');
  const cards = await cardboxCards([entries[0]!.hash]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.girl.name, '索引测试');
  assert.equal((await cardboxCards(['不存在的 hash'])).length, 0);
});

test('cardbox：旧的整包卡库会拆开并删掉旧键', async () => {
  __resetKvForTests();
  const first = sampleCard('旧档甲');
  const second = sampleCard('旧档乙');
  await kvSet(CARD_BOX_KEY, [
    { hash: 'legacy-1', name: '旧档甲', level: 4, element: '星光系', factionTag: 'witch', fileName: '甲.json', addedAt: 100, raw: first },
    { hash: 'legacy-2', name: '旧档乙', level: 4, element: '星光系', factionTag: 'witch', fileName: '乙.json', addedAt: 200, raw: second },
    { hash: 'broken', name: '坏卡', level: 1, element: '星光系', factionTag: 'none', fileName: 'x.json', addedAt: 300, raw: '{"format":"night-sugar/girl-card"}' },
  ]);

  const entries = await loadCardBox();
  assert.equal(entries.length, 2, '坏卡在迁移时被丢掉');
  assert.equal(await kvGet(CARD_BOX_KEY), undefined, '旧键迁移后删掉');
  assert.ok(Array.isArray(await kvGet(CARD_BOX_INDEX_KEY)));

  const names = entries.map(entry => entry.name).sort();
  assert.deepEqual(names, ['旧档乙', '旧档甲']);
  for (const entry of entries) {
    assert.equal('raw' in entry, false);
    const raw = await readCardRaw(entry.hash);
    assert.ok(raw && raw.length > 100, '原文按新结构存好了');
    assert.ok((await kvGet<string>(CARD_RAW_PREFIX + entry.hash))!.startsWith('{'));
  }
});

test('cardbox：重刷卡库不会把旧结构与新结构混在一起', async () => {
  __resetKvForTests();
  await kvSet(CARD_BOX_KEY, '不是数组');
  const entries = await loadCardBox();
  assert.deepEqual(entries, []);
  assert.equal(await kvGet(CARD_BOX_KEY), undefined, '读不动的旧值也要清掉，别一直占着');
});

test('cardbox：一张 2MB 的卡不会把索引撑大', async () => {
  __resetKvForTests();
  const heavy = JSON.stringify({ ...JSON.parse(sampleCard('大卡')) });
  const withPortrait = heavy.replace('"element":"星光系"', `"element":"星光系","portrait":"data:image/png;base64,${'A'.repeat(2_000_000)}"`);
  const added = await cardboxAdd([{ name: 'big.json', text: withPortrait }], []);
  assert.equal(added.failed.length, 0, added.failed[0]?.message);

  const index = await kvGet<unknown[]>(CARD_BOX_INDEX_KEY);
  assert.ok(index && index.length === 1);
  const indexBytes = JSON.stringify(index).length;
  assert.ok(indexBytes < 2_000, `索引应该只有几百字节，实际 ${indexBytes}`);
  assert.ok((await readCardRaw(added.added[0]!.hash))!.length > 2_000_000);
});

test('cardbox：开局按卡面总量截断，超大卡不会把 20 个位置全塞满', () => {
  const entry = (index: number, bytes: number): CardBoxEntry => ({
    hash: `h${index}`, name: `卡${index}`, level: 1, element: '星光系', factionTag: 'none',
    color: '#fff', title: '外来者', quote: '', stats: { magic: 50, insight: 50, agility: 50, empathy: 50 },
    skillIds: [], fileName: `${index}.json`, addedAt: index, bytes,
  });
  const MB = 1024 * 1024;
  const picked = pickWithinBytes([entry(1, 3 * MB), entry(2, 3 * MB), entry(3, 3 * MB), entry(4, 3 * MB), entry(5, 3 * MB)], 20, 10 * MB);
  assert.equal(picked.length, 3, '10MB 预算只装得下 3 张 3MB 的卡');
  assert.deepEqual(picked.map(item => item.hash), ['h1', 'h2', 'h3']);

  const tiny = Array.from({ length: 30 }, (_, index) => entry(index, 200 * 1024));
  assert.equal(pickWithinBytes(tiny, 20, 10 * MB).length, 20, '小卡仍然按张数上限走');

  const huge = pickWithinBytes([entry(1, 30 * MB), entry(2, 30 * MB)], 20, 10 * MB);
  assert.equal(huge.length, 1, '第一张就算超预算也要收，否则开局没人可选');
});

test('cardbox：导入 20 张卡只做常数次深拷贝（去嵌套 clone）', () => {
  const ready = Array.from({ length: 20 }, (_, index) => parseGirlCard(sampleCard(`批量${index}`)))
    .flatMap(item => (item.ok ? [item.card] : []));
  assert.equal(ready.length, 20);

  const base = createInitialState();
  const original = JSON.parse;
  let parses = 0;
  (JSON as unknown as { parse: typeof JSON.parse }).parse = (text: string, reviver?: Parameters<typeof JSON.parse>[1]) => {
    parses += 1;
    return original(text, reviver);
  };
  let imported = 0;
  try {
    const result = act(base, { type: 'importCards', cards: ready });
    assert.equal(result.ok, true, result.message);
    imported = result.state.candidates.length;
  } finally {
    (JSON as unknown as { parse: typeof JSON.parse }).parse = original;
  }
  assert.ok(imported >= 10, `大部分卡应该真的进了候选名册，实际 ${imported}`);
  assert.ok(parses <= 4, `整批导入只该有常数次深拷贝，实际 JSON.parse ${parses} 次`);
});

test('v43 防 OOM：带数 MB 立绘的契约卡重复导入仍能瞬间判重，不把全文塞进签名', () => {
  const bigPortrait = `data:image/webp;base64,${'A'.repeat(2_500_000)}`;
  const text = JSON.stringify({
    ...JSON.parse(sampleCard('大图判重')),
    girl: { ...JSON.parse(sampleCard('大图判重')).girl, portrait: bigPortrait },
  });
  const parsed = parseGirlCard(text);
  assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.message);
  const card = (parsed as { card: unknown }).card as Parameters<typeof act>[1] extends { card: infer C } ? C : never;

  const once = act(createInitialState(), { type: 'importCard', card });
  assert.equal(once.ok, true, once.message);
  const twice = act(once.state, { type: 'importCard', card });
  assert.equal(twice.ok, false, '同一张卡重复导入必须被拦下');
  assert.match(twice.message, /已经导入过|重复/);

  const revision = once.state.candidates.find(girl => girl.name === '大图判重')?.cardRevision;
  assert.ok(revision, '卡片改版指纹应当写入');
  assert.ok((revision as string).length < 4000, `指纹不能把整张 2.5MB 立绘抄进去，实际 ${(revision as string).length} 字符`);
});

test('cardImport：按张数与字节切批', () => {
  const entry = (index: number, bytes: number) => ({ hash: `h${index}`, bytes }) as unknown as CardBoxEntry;
  const MB = 1024 * 1024;

  const big = planCardBatches(Array.from({ length: 10 }, (_, index) => entry(index, 2.3 * MB)));
  assert.ok(big.every(batch => batch.length <= 2), '4MB 预算下 2.3MB 的卡一批最多两张');
  assert.equal(big.flat().length, 10, '不丢卡');

  const small = planCardBatches(Array.from({ length: 30 }, (_, index) => entry(index, 100 * 1024)));
  assert.ok(small.every(batch => batch.length <= 6), '小卡按张数上限 6 张一批');
  assert.equal(small.flat().length, 30);

  assert.equal(planCardBatches([entry(1, 30 * MB)]).length, 1, '单张超大卡也要单独成批，不能死循环');
  assert.deepEqual(planCardBatches([]), []);
});
