import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState, marketSlots, marketWindow } from '../src/game.ts';
import { buildGirlCard } from '../src/cards.ts';
import { STARTER_COUNT, starterPicks } from '../src/roster.ts';
import { marketSize } from '../src/economy.ts';
import type { GameState } from '../src/types.ts';

/** 造一个「市场池里有 N 张自家卡」的档；卡按导入顺序排，最新的在最前。 */
function cardsState(count: number): GameState {
  const base = createInitialState();
  const state: GameState = { ...base, candidates: [], poolLimits: { ...base.poolLimits, candidates: 20 } };
  const cards = Array.from({ length: count }, (_, index) =>
    buildGirlCard({ ...base.girls[0]!, id: `g_mw_${index}`, name: `窗口${index}` }, base));
  const result = act(state, { type: 'importCards', cards });
  assert.equal(result.ok, true, result.message);
  return result.state;
}

test('开局只勾 2 位契约少女，其余留在市场池', () => {
  const state = cardsState(20);
  assert.equal(STARTER_COUNT, 2);
  assert.equal(starterPicks(state, true).length, 2);
  assert.equal(starterPicks(state, true).every(id => state.candidates.some(girl => girl.id === id)), true);
});

test('市场窗口：1 级只有 2 位，升级依次 3 / 4 / 5 位', () => {
  const state = cardsState(8);
  assert.equal(marketSize(1), 2);
  assert.equal(marketWindow(state).length, 2);
  assert.equal(marketWindow({ ...state, marketLevel: 2, marketWindow: undefined }).length, 3);
  assert.equal(marketWindow({ ...state, marketLevel: 3, marketWindow: undefined }).length, 4);
  assert.equal(marketWindow({ ...state, marketLevel: 4, marketWindow: undefined }).length, 5);
  assert.equal(marketWindow({ ...state, candidates: state.candidates.slice(0, 1) }).length, 1, '池子不够就只摆有的');
});

test('每日轮换：同一天窗口不变，换一天换一批，池子大小不变', () => {
  const state = cardsState(10);
  const first = marketWindow(state).map(girl => girl.id);
  assert.deepEqual(marketWindow(state).map(girl => girl.id), first, '同一天内稳定');

  const next = act(state, { type: 'endNight' }).state;
  assert.equal(next.candidates.length, state.candidates.length, '轮换不消耗池子');
  const second = marketWindow(next).map(girl => girl.id);
  assert.equal(second.length, 2);
  assert.notDeepEqual(second, first, '换日换一批面孔');
});

test('hire 拿走一位，窗口当天不回补，次日才重新开窗', () => {
  const state = { ...cardsState(6), gold: 999999 };
  const first = marketWindow(state)[0]!;
  const hired = act(state, { type: 'hire', girlId: first.id });
  assert.equal(hired.ok, true, hired.message);
  assert.equal(hired.state.candidates.length, state.candidates.length - 1);
  assert.equal(hired.state.candidates.some(girl => girl.id === first.id), false);
  assert.equal(marketWindow(hired.state).length, 1, '当天只剩一位挂牌');
  const tomorrow = act(hired.state, { type: 'endNight' }).state;
  assert.equal(marketWindow(tomorrow).length, 2, '换日重新补满窗口');
});

test('售罄保留空位：买走的人变成 sold 槽位，次日清空重开', () => {
  const state = { ...cardsState(6), gold: 999999 };
  const first = marketWindow(state)[0]!;
  const hired = act(state, { type: 'hire', girlId: first.id });
  assert.equal(hired.ok, true, hired.message);
  const slots = marketSlots(hired.state);
  assert.equal(slots.length, 2, '窗口仍保留两个槽位');
  assert.equal(slots.filter(slot => slot.sold).length, 1, '买走的那位显示售罄');
  assert.equal(slots.find(slot => slot.sold)?.id, first.id);
  assert.equal(marketWindow(hired.state).length, 1, '未售出的候选仍可签约');
  const tomorrow = act(hired.state, { type: 'endNight' }).state;
  assert.equal((tomorrow.marketSold ?? []).length, 0, '换日清空售罄标记');
  assert.equal(marketSlots(tomorrow).length, 2, '换日重新开满窗口');
});

test('市场升级：窗口立刻变宽，但不会换人', () => {
  const state = { ...cardsState(8), gold: 999999 };
  const before = marketWindow(state).map(girl => girl.id);
  const upgraded = act(state, { type: 'upgradeMarket' });
  assert.equal(upgraded.ok, true, upgraded.message);
  assert.equal(upgraded.state.marketLevel, 2);
  assert.equal(marketWindow(upgraded.state).length, 3);
  assert.deepEqual(marketWindow(upgraded.state).slice(0, 2).map(girl => girl.id), before, '当天已经挂牌的人不挪位置');
});

test('新导入的卡与高级招聘当天就挂在窗口最前', () => {
  const state = { ...cardsState(5), gold: 999999, reputation: 99 };
  const base = createInitialState();
  const card = buildGirlCard({ ...base.girls[0]!, id: 'g_mw_new', name: '新来的' }, base);
  const imported = act(state, { type: 'importCard', card });
  assert.equal(imported.ok, true, imported.message);
  assert.equal(marketWindow(imported.state)[0]!.name, '新来的');

  const recruited = act(state, { type: 'advancedRecruit', level: 1 });
  assert.equal(recruited.ok, true, recruited.message);
  assert.equal(marketWindow(recruited.state)[0]!.id, recruited.state.candidates[0]!.id);
});
