import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { executeRefine } from '../src/refine.ts';
import { executeCraft } from '../src/crafting.ts';
import { GENERATED_ITEM_LIMIT, items } from '../src/content/items.ts';
import { loadState } from '../src/rules/persistence.ts';
import { validGeneratedItem, validStoredItem } from '../src/rules/validate.ts';

const baseWeapon = () => items.find(i => i.tier === 1 && i.setId === 'set-starlight' && i.slot === 'weapon')!;

test('v260 读档放行本地装备实例，LLM 生成物仍走原校验', () => {
  const shape = { name: '测试件', description: '描述', slot: 'weapon' as const, faction: 'witch' as const, stats: { magic: 10 } };
  for (const id of ['lm_item_abc123', 'refine-set-starlight-abc123', 'craft-set-starlight-t3-99d9f3', 'relic-1a2b3c4d']) {
    assert.equal(validStoredItem({ ...shape, id }), true, id);
  }
  assert.equal(validStoredItem({ ...shape, id: '随便什么' }), false);
  assert.equal(validStoredItem({ ...shape, id: 'lm_item_x', stats: {} }), false, '空数值的 LLM 装备仍应被拒');
  assert.equal(validGeneratedItem({ ...shape, id: 'refine-set-starlight-abc123' }), false, '原 LLM 校验不放宽');
});

test('v260 精炼仓库装备：读档后实例、词条与仓库计数都还在', () => {
  const state = createInitialState();
  state.gold = 9000;
  const base = baseWeapon();
  state.inventory[base.id] = 1;
  state.inventory['mat-stardust'] = 20;

  const result = executeRefine(state, { kind: 'inventory', itemId: base.id }, 'v260-refine-inv');
  assert.ok(result.ok, result.ok ? '' : result.message);
  const refined = result.item;
  assert.ok(refined.id.startsWith('refine-'), '精炼应生成独立实例');

  const loaded = loadState(JSON.stringify(state));
  assert.equal(loaded.inventory[refined.id], 1, '仓库里的精炼件不能消失');
  assert.equal(loaded.inventory[base.id], undefined, '原装备已被消耗');
  const stored = loaded.generatedItems.find(item => item.id === refined.id);
  assert.ok(stored, '读档后精炼实例必须仍在 generatedItems');
  assert.equal(stored!.affixes?.length, 1);
  assert.equal(loaded.generatedItems[0]!.id, refined.id);
});

test('v260 精炼身上的装备：读档后槽位引用仍能解析到实例', () => {
  const state = createInitialState();
  state.gold = 9000;
  state.inventory['mat-stardust'] = 20;
  const girl = state.girls[0]!;
  const base = baseWeapon();
  girl.equipment.weapon = base.id;

  const result = executeRefine(state, { kind: 'girl', girlId: girl.id, slot: 'weapon' }, 'v260-refine-girl');
  assert.ok(result.ok, result.ok ? '' : result.message);
  const equippedId = result.item.id;
  // 同一件连精两次：实例 id 不变，词条累加，读档后两条都要在。
  const second = executeRefine(state, { kind: 'girl', girlId: girl.id, slot: 'weapon' }, 'v260-refine-girl-2');
  assert.ok(second.ok, second.ok ? '' : second.message);
  assert.equal(second.item.id, equippedId);

  const loaded = loadState(JSON.stringify(state));
  const loadedGirl = loaded.girls.find(item => item.id === girl.id)!;
  assert.equal(loadedGirl.equipment.weapon, equippedId);
  const stored = loaded.generatedItems.find(item => item.id === equippedId);
  assert.ok(stored, '穿在身上的精炼件必须留在存档里');
  assert.equal(stored!.affixes?.length, 2, '两次精炼的词条都要留下');
});

test('v260 炼制产出：读档后 craft 实例仍在', () => {
  const state = createInitialState();
  state.gold = 9000;
  state.inventory['mat-stardust'] = 40;

  const result = executeCraft(state, { 'mat-stardust': 9 }, 'v260-craft-1');
  assert.ok(result.ok, result.ok ? '' : result.message);
  assert.ok(result.item.id.startsWith('craft-'), '该种子应走兜底炼制实例');

  const loaded = loadState(JSON.stringify(state));
  assert.equal(loaded.inventory[result.item.id], 1);
  assert.ok(loaded.generatedItems.some(item => item.id === result.item.id), '炼制件必须随存档保留');
});

test('v260 读档裁剪：超上限时先丢没人用的，被穿着的实例必须留下', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const worn = {
    id: 'refine-set-starlight-worn01',
    name: '旧精炼件',
    description: '一直穿在身上',
    slot: 'weapon' as const,
    faction: 'witch' as const,
    stats: { magic: 5 },
    tier: 1,
    price: 500,
  };
  girl.equipment.weapon = worn.id;
  const filler = Array.from({ length: GENERATED_ITEM_LIMIT + 20 }, (_, index) => ({
    id: `craft-filler-${index}`,
    name: '填充件',
    description: '没人用',
    slot: 'charm' as const,
    faction: 'witch' as const,
    stats: { magic: 1 },
    tier: 1,
    price: 500,
  }));
  state.generatedItems = [...filler, worn];

  const loaded = loadState(JSON.stringify(state));
  assert.equal(loaded.generatedItems.length, GENERATED_ITEM_LIMIT);
  assert.ok(loaded.generatedItems.some(item => item.id === worn.id), '被装备引用的实例不能被裁掉');
  assert.equal(loaded.girls.find(item => item.id === girl.id)!.equipment.weapon, worn.id);
  assert.ok(loaded.generatedItems.some(item => item.id === 'craft-filler-0'), '新条目优先级更高');
});
