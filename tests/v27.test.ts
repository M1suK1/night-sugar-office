import test from 'node:test';
import assert from 'node:assert/strict';
import { act, canAcceptGeneratedContent, createBlankState, createInitialState, loadState } from '../src/game.ts';
import { buildGirlCard, girlCardHash } from '../src/cards.ts';
import { cardBoxExhausted, marketCardGap, marketNeedsCards, unusedCards, usedCardIds } from '../src/cardMarket.ts';
import { rosterPool, starterPicks } from '../src/roster.ts';
import type { CardBoxEntry } from '../src/cardbox.ts';
import type { GameState, GirlCard } from '../src/types.ts';

const base = () => createInitialState();

/** 用原生少女造一张只改名字的卡，保证姓氏够用又不撞 hash。 */
function makeCard(name: string): GirlCard {
  const state = base();
  return buildGirlCard({ ...state.girls[0]!, id: `g_${name}`, name }, state);
}

function entryOf(card: GirlCard, addedAt: number): CardBoxEntry {
  const name = card.girl.name;
  return {
    hash: girlCardHash(card), name, level: card.girl.level, element: card.girl.element,
    factionTag: card.girl.factionTag ?? 'none', fileName: `${name}.json`, addedAt,
    color: card.girl.color, title: card.girl.title, codename: card.girl.codename, quote: card.girl.quote,
    stats: { ...card.girl.stats }, skillIds: [...card.girl.skillIds], portraitSpec: card.girl.portraitSpec,
    bytes: JSON.stringify(card).length,
  };
}

function importedCards(count: number): { state: GameState; cards: GirlCard[]; box: CardBoxEntry[] } {
  const cards = Array.from({ length: count }, (_, index) => makeCard(`测试${index}`));
  const state = { ...base(), candidates: [] as GameState['candidates'] };
  const result = act(state, { type: 'importCards', cards });
  assert.equal(result.ok, true, result.message);
  return { state: result.state, cards, box: cards.map((card, index) => entryOf(card, 1000 + index)) };
}

test('v27 新档 version 20，市场池容量 20', () => {
  const state = base();
  assert.equal(state.version, 20);
  assert.equal(state.poolLimits.candidates, 20);
  assert.equal(createBlankState().poolLimits.candidates, 20);
});

test('v27 老档迁移：低于 20 的市场池抬到 20，已经更大的不动', () => {
  const legacy = base();
  legacy.version = 19;
  legacy.poolLimits = { ...legacy.poolLimits, candidates: 6 };
  assert.equal(loadState(JSON.stringify(legacy)).poolLimits.candidates, 20);

  const roomy = base();
  roomy.version = 19;
  roomy.poolLimits = { ...roomy.poolLimits, candidates: 32 };
  assert.equal(loadState(JSON.stringify(roomy)).poolLimits.candidates, 32);
});

test('v27 unusedCards：按最近导入优先，跳过名册/候选/三方里已用过的卡', () => {
  const { state, box } = importedCards(3);
  const used = usedCardIds(state);
  assert.equal(used.size, 3);
  const picked = unusedCards([...box, entryOf(makeCard('新的'), 5000)], state, 20);
  assert.deepEqual(picked.map(entry => entry.name), ['新的']);
  assert.equal(cardBoxExhausted(picked, state), false);
  assert.equal(cardBoxExhausted([], state), true);
});

test('v27 refillMarket 从卡库补到上限，补进来的是带 cardId 的自定义候选', () => {
  const cards = Array.from({ length: 4 }, (_, index) => makeCard(`补货${index}`));
  const empty = { ...base(), candidates: [] as GameState['candidates'], poolLimits: { ...base().poolLimits, candidates: 3 } };
  const result = act(empty, { type: 'refillMarket', cards });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.candidates.length, 3, '补满到上限就停');
  for (const girl of result.state.candidates) {
    assert.equal(girl.custom, true);
    assert.ok(girl.cardId, '补进来的候选要带卡编号');
  }
  assert.ok(result.state.logs.some(log => log.text.includes('市场补进了')));
});

test('v27 refillMarket 卡库空了就返回失败，不动状态', () => {
  const state = base();
  const result = act(state, { type: 'refillMarket', cards: [] });
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
});

test('v27 跨日不再生成原生候选', () => {
  const state = { ...base(), candidates: [] as GameState['candidates'] };
  const next = act(state, { type: 'endNight' });
  assert.equal(next.ok, true, next.message);
  assert.equal(next.state.day, state.day + 1);
  assert.equal(next.state.candidates.length, 0, '没有卡库补货，市场就该空着');
});

test('v27 市场池满了也不挡叙事者：候选者已经不由它产出', () => {
  const state = base();
  const full = { ...state, candidates: state.candidates, poolLimits: { ...state.poolLimits, candidates: 1 } };
  assert.equal(canAcceptGeneratedContent(full).ok, true);
});

test('v27 编成池：卡够 20 就只给卡，不够才用内置角色补到 20', () => {
  const { state } = importedCards(20);
  const cardsOnly = rosterPool(state, [], { cardsOnly: true, limit: 20 });
  assert.equal(cardsOnly.length, 20);
  assert.equal(cardsOnly.some(subject => subject.id.startsWith('leader-')), false, '内置首领不该出现');
  assert.equal(cardsOnly.some(subject => subject.id.startsWith('fg-')), false, '内置随从不该出现');

  const few = importedCards(3).state;
  const mixed = rosterPool(few, [], { cardsOnly: false, limit: 20 });
  assert.equal(mixed.length, 15, '3 张卡 + 3 位首领 + 9 位随从');
  assert.equal(mixed.some(subject => subject.id === 'leader-association'), true, '卡不够时内置首领补位');
  assert.equal(mixed.slice(0, 3).every(subject => subject.origin === 'custom'), true, '卡排在内置前面');
});

test('v27 同一张卡不会在编成池里出现两次', () => {
  const { state, box } = importedCards(2);
  const pool = rosterPool(state, box, { cardsOnly: true, limit: 20 });
  const hashes = new Set(state.candidates.map(girl => girl.cardId));
  assert.equal(pool.some(subject => subject.id.startsWith('card-') && hashes.has(subject.id.slice(5))), false);
  assert.equal(pool.length, 2);
});

test('v27 开局勾选与加卡提醒的阈值', () => {
  const rich = importedCards(20).state;
  assert.equal(starterPicks(rich, true).length, 2);
  assert.equal(starterPicks(rich, true).every(id => rich.candidates.some(girl => girl.id === id)), true);

  const one = importedCards(1).state;
  const picks = starterPicks(one, false);
  assert.equal(picks.length, 2, '1 张卡 + 默认角色补到 2 位');
  assert.ok(picks.includes('yue'));
  assert.equal(starterPicks(one, true).length, 1, 'cardsOnly 时只取卡');

  const market = { ...rich, candidates: rich.candidates.slice(0, 2) };
  assert.equal(marketNeedsCards(market, []), true, '候选只剩两位且卡库空 → 提醒');
  const roomy = { ...rich, candidates: rich.candidates.slice(0, 3) };
  assert.equal(marketNeedsCards(roomy, []), false, '还有三位候选就先别催');
  const stock = importedCards(3);
  const usedBox = stock.box;
  const fresh = entryOf(makeCard('备用'), 9000);
  const roomy2 = { ...stock.state, candidates: stock.state.candidates.slice(0, 1) };
  assert.equal(marketNeedsCards(roomy2, [...usedBox, fresh]), false, '卡库还有没用的卡 → 不需要提醒');
});
