import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { act, createInitialState } from '../src/game.ts';
import { LIBRARY_START_ROSTER, normalizeOpeningLevel, pickLibraryFiles, readLibraryCards, scanLibrary, type LibraryFile } from '../src/cardLibrary.ts';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';

const file = (name: string, bytes: number, text?: string): LibraryFile => ({ name, bytes, text });

test('v135 开局从卡库取六个人，且都压到 1 级', async () => {
  const state = createInitialState();
  const cards = state.girls.slice(0, 3).map(girl => buildGirlCard({ ...girl, level: 8 }, state));
  const payloads = cards.map((card, index) => ({ name: `card-${index}.json`, bytes: 1024, text: JSON.stringify(card) }));
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    if (!target.includes('name=')) {
      return new Response(JSON.stringify({ ok: true, dir: '/cards', files: payloads.map(({ name, bytes }) => ({ name, bytes })) }), { status: 200 });
    }
    const name = decodeURIComponent(target.split('name=')[1] ?? '');
    const found = payloads.find(item => item.name === name)!;
    return new Response(JSON.stringify({ ok: true, text: found.text }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await readLibraryCards(3);
    assert.equal(result.ok, true, result.reason ?? '');
    assert.equal(result.cards.length, 3);
    assert.ok(result.cards.every(card => card.girl.level === 1), '卡里的高等级要被压回 1 级');
    assert.ok(result.cards.every(card => card.girl.skillIds.length === 3), '技能要原样保留');
  } finally {
    globalThis.fetch = original;
  }
});

test('v135 卡库读不到时说明原因，不抛异常', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error('offline'); }) as typeof fetch;
  try {
    const scan = await scanLibrary();
    assert.equal(scan.ok, false);
    assert.match(scan.reason ?? '', /连不上|读不出来/);
    const cards = await readLibraryCards(LIBRARY_START_ROSTER);
    assert.equal(cards.ok, false);
    assert.equal(cards.cards.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('v135 挑卡：只在小卡里随机，不重复，条数受控', () => {
  const files = Array.from({ length: 20 }, (_, index) => file(`c${index}.json`, (index + 1) * 1_000_000));
  const picked = pickLibraryFiles(files, 6, new Set(), () => 0.5);
  assert.equal(picked.length, 6);
  assert.equal(new Set(picked.map(item => item.name)).size, 6, '不能重复');
  // 候选池只取最小的一批（6×3=18 张），所以最大的两张不该被选中。
  assert.ok(picked.every(item => item.bytes <= 18_000_000));
  const leftover = pickLibraryFiles(files, 6, new Set(files.slice(0, 18).map(item => item.name)));
  assert.deepEqual(leftover.map(item => item.name).sort(), ['c18.json', 'c19.json'], '排除过的不会再被挑中');
});

test('v135 压级只改等级与四维，语料与立绘保留', () => {
  const state = createInitialState();
  const card = parseGirlCard(JSON.stringify(buildGirlCard({ ...state.girls[0]!, level: 8 }, state)));
  assert.equal(card.ok, true);
  if (!card.ok) return;
  const lowered = normalizeOpeningLevel(card.card.girl);
  assert.equal(lowered.level, 1);
  assert.ok(lowered.stats.magic <= card.card.girl.stats.magic);
  assert.equal(lowered.voice?.tone, card.card.girl.voice?.tone);
  assert.equal(lowered.portrait, card.card.girl.portrait);
});

test('v135 空名册骨架：房间委托都在，名册与候选取空', () => {
  const seeded = createInitialState();
  const empty = createInitialState(undefined, undefined, { roster: 'empty' });
  assert.ok(seeded.girls.length > 0);
  assert.equal(empty.girls.length, 0, '内置角色不该再进名册');
  assert.equal(empty.candidates.length, 0);
  assert.equal(empty.rooms.length, seeded.rooms.length);
  assert.equal(empty.missions.length, seeded.missions.length);
  assert.equal(empty.gold, seeded.gold);

  const reset = act(createInitialState(), { type: 'reset', roster: 'empty' });
  assert.equal(reset.ok, true);
  assert.equal(reset.state.girls.length, 0);
});

test('v135 卡库的人在空名册上导入后能进候选池', async () => {
  const state = createInitialState();
  const card = buildGirlCard(state.girls[0]!, state);
  const empty = createInitialState(undefined, undefined, { roster: 'empty' });
  const imported = act(empty, { type: 'importCards', cards: [card] });
  assert.equal(imported.ok, true, imported.message);
  assert.ok(imported.state.candidates.length >= 1);
  assert.equal(imported.state.startersPicked, true, '导入卡就等于定下名册（v129）');
});

test('v135 卡库层没有偷偷保留内置名册的引用', () => {
  const source = readFileSync('src/cardLibrary.ts', 'utf8');
  assert.ok(!source.includes('seedGirls'), '卡库层不该依赖内置角色');
  assert.ok(!source.includes('factionLeaders'), '首领表也不该被卡库层直接引用');
});
