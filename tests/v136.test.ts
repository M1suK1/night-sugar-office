import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { buildGirlCard } from '../src/cards.ts';
import { readLibraryCards, scanLibrary } from '../src/cardLibrary.ts';
import { emitStaticCards } from '../scripts/static-cards.mjs';
import { mkdtempSync, mkdirSync, writeFileSync as writeTmp, readFileSync as readTmp, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** 只实现静态卡库：/api/cards 一律 404，/cards/* 正常。天真的 CF Pages 就是这个样子。 */
function staticOnly(cards: { name: string; text: string }[], seen: string[] = []) {
  return (async (url: string | URL | Request) => {
    const target = String(url);
    seen.push(target);
    if (target.startsWith('/api/cards')) return new Response('Not Found', { status: 404 });
    if (target === '/cards/index.json') {
      return new Response(JSON.stringify({
        ok: true,
        kind: 'static',
        dir: '/cards',
        note: '静态卡库：只收了 ≤3.5MB 的卡。',
        files: cards.map(card => ({ name: card.name, bytes: card.text.length })),
      }), { status: 200 });
    }
    const name = decodeURIComponent(target.replace('/cards/', ''));
    const found = cards.find(card => card.name === name);
    return found ? new Response(found.text, { status: 200 }) : new Response('nope', { status: 404 });
  }) as typeof fetch;
}

test('v136 没有本地接口时退回静态卡库，照样能开局', async () => {
  const state = createInitialState();
  const payloads = state.girls.slice(0, 3).map((girl, index) => ({
    name: `夜糖事务所-契约卡-${index}.json`,
    text: JSON.stringify(buildGirlCard({ ...girl, level: 6 }, state)),
  }));
  const original = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = staticOnly(payloads, seen);
  try {
    const scan = await scanLibrary();
    assert.equal(scan.ok, true, scan.reason ?? '');
    assert.equal(scan.kind, 'static', '来源要标成静态卡库');
    assert.equal(scan.files.length, 3);
    assert.match(scan.note ?? '', /3\.5MB/);

    const result = await readLibraryCards(3);
    assert.equal(result.ok, true, result.reason ?? '');
    assert.equal(result.cards.length, 3);
    assert.ok(result.cards.every(card => card.girl.level === 1), '静态卡库的卡同样压到 1 级');
    assert.ok(seen.some(url => url.startsWith('/api/cards')), '要先试本地接口');
    assert.ok(seen.some(url => url.includes('/cards/') && url.includes('name=') === false), '再按静态路径取卡');
  } finally {
    globalThis.fetch = original;
  }
});

test('v136 两条通道都没有时，原因要说明白', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    if (target.startsWith('/api/cards')) return new Response('Not Found', { status: 404 });
    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;
  try {
    const scan = await scanLibrary();
    assert.equal(scan.ok, false);
    assert.match(scan.reason ?? '', /静态卡库|卡库/);
    const result = await readLibraryCards(6);
    assert.equal(result.ok, false);
    assert.equal(result.cards.length, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test('v136 本地接口能用就不去碰静态清单', async () => {
  const state = createInitialState();
  const card = buildGirlCard(state.girls[0]!, state);
  const original = globalThis.fetch;
  const seen: string[] = [];
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = String(url);
    seen.push(target);
    if (target.startsWith('/api/cards') && !target.includes('name=')) {
      return new Response(JSON.stringify({ ok: true, dir: '/cards', files: [{ name: 'a.json', bytes: 1024 }] }), { status: 200 });
    }
    if (target.startsWith('/api/cards') && target.includes('name=')) {
      return new Response(JSON.stringify({ ok: true, text: JSON.stringify(card) }), { status: 200 });
    }
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
  try {
    const result = await readLibraryCards(1);
    assert.equal(result.ok, true, result.reason ?? '');
    assert.ok(!seen.includes('/cards/index.json'), '本地接口活着就不该回退');
  } finally {
    globalThis.fetch = original;
  }
});


test('v136 构建只把 ≤3.5MB 的小卡复制进产物，并写清单', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ns-cards-'));
  mkdirSync(join(root, 'data', 'cards'), { recursive: true });
  const small = JSON.stringify({ hello: 'world' });
  writeTmp(join(root, 'data', 'cards', '小卡.json'), small, 'utf8');
  // 一个假的 5MB 大卡：只写个空洞大小的文件内容，用来验证被跳过。
  writeTmp(join(root, 'data', 'cards', '大卡.json'), 'x'.repeat(5 * 1024 * 1024), 'utf8');
  const out = join(root, 'dist');
  const count = await emitStaticCards(root, out);
  assert.equal(count, 1, '只有小卡会被复制');
  assert.equal(existsSync(join(out, 'cards', '小卡.json')), true);
  assert.equal(existsSync(join(out, 'cards', '大卡.json')), false);
  const index = JSON.parse(readTmp(join(out, 'cards', 'index.json'), 'utf8')) as { ok: boolean; kind: string; files: { name: string }[]; note: string };
  assert.equal(index.ok, true);
  assert.equal(index.kind, 'static');
  assert.deepEqual(index.files.map(item => item.name), ['小卡.json']);
  assert.match(index.note, /3\.5MB|静态卡库/);
});
