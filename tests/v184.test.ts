import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { items, findItem } from '../src/content/items.ts';
import { tierOf } from '../src/items.ts';
import type { Equipment, EquipmentSetId, EquipmentTier, GameState } from '../src/types.ts';

/** 内置池里符合槽位 / 阶级 / 套装的条目：测试只认内容里的真货。 */
function poolOf(slot: Equipment['slot'], tier: EquipmentTier, setId?: EquipmentSetId): Equipment[] {
  return items.filter(item => item.slot === slot && tierOf(item) === tier && (!setId || item.setId === setId));
}

function grant(state: GameState, slot: Equipment['slot'], tier: EquipmentTier, setId?: EquipmentSetId) {
  return act(state, { type: 'debugGrantEquipment', slot, tier, setId });
}

function onlyNewItem(before: GameState, after: GameState): Equipment {
  const ids = Object.keys(after.inventory).filter(id => !(id in before.inventory));
  assert.equal(ids.length, 1, `应该只新增一件装备，实际 ${ids.length}`);
  const item = findItem(ids[0]);
  assert.ok(item, `新入库的 ${ids[0]} 必须能在内容里查到`);
  return item;
}

test('v184 控制台：按槽位与阶级立刻入库一件装备，并写调试日志', () => {
  const state = createInitialState();
  const result = grant(state, 'weapon', 2);
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.inventory[onlyNewItem(state, result.state).id], 1);
  const item = onlyNewItem(state, result.state);
  assert.equal(item.slot, 'weapon');
  assert.equal(tierOf(item), 2);
  assert.match(result.state.logs[0]!.text, /调试/);
  assert.ok(result.message.includes(item.name), '回执里要报出拿到了什么');
});

test('v184 控制台：套装参数会收窄候选', () => {
  const state = createInitialState();
  const result = grant(state, 'charm', 1, 'set-dream');
  assert.equal(result.ok, true, result.message);
  const item = onlyNewItem(state, result.state);
  assert.equal(item.slot, 'charm');
  assert.equal(item.setId, 'set-dream');
  assert.equal(tierOf(item), 1);
});

test('v184 控制台：重复执行在候选里轮换，不会永远同一件', () => {
  const pool = poolOf('weapon', 3);
  assert.ok(pool.length >= 3, '三阶法器至少要有三件候选才谈得上轮换');
  let state = createInitialState();
  const got: string[] = [];
  for (let i = 0; i < pool.length; i += 1) {
    const before = { ...state.inventory };
    const result = grant(state, 'weapon', 3);
    assert.equal(result.ok, true, result.message);
    state = result.state;
    const added = Object.keys(state.inventory).filter(id => (state.inventory[id] ?? 0) > (before[id] ?? 0));
    assert.equal(added.length, 1, '每次只入库一件');
    got.push(added[0]!);
  }
  assert.equal(new Set(got).size, pool.length, '连续发放应把候选走完一轮');
});

test('v184 控制台：内置池没有这个组合时不改状态', () => {
  const state = createInitialState();
  const empty = poolOf('weapon', 5, 'set-frosting');
  assert.equal(empty.length, 0, '前提：五阶法器里没有甜晶套装');
  const result = grant(state, 'weapon', 5, 'set-frosting');
  assert.equal(result.ok, false);
  assert.equal(result.state, state, '失败时状态引用不变');
  assert.match(result.message, /甜晶/);
});

test('v184 控制台：消耗品没有套装归属，带上套装参数要拒绝', () => {
  const state = createInitialState();
  const result = grant(state, 'consumable', 1, 'set-starlight');
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.match(result.message, /消耗品/);
});

test('v184 控制台：越界阶级不改状态', () => {
  const state = createInitialState();
  const result = grant(state, 'weapon', 9 as EquipmentTier);
  assert.equal(result.ok, false);
  assert.equal(result.state, state);
  assert.match(result.message, /阶级/);
});
