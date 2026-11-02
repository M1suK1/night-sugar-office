import test from 'node:test';
import assert from 'node:assert/strict';
import { __resetKvForTests, kvGet, kvSet } from '../src/store.ts';
import {
  CARD_BOX_INDEX_KEY, CARD_BOX_KEY, CARD_RAW_PREFIX,
  cardboxAdd, cardboxCards, loadCardBox, readCardRaw,
} from '../src/cardbox.ts';

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
