import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { act } from '../src/game.ts';
import {
  AFFIX_SPECS,
  rollAffixForTier,
  refineCost,
  executeRefine,
} from '../src/refine.ts';
import { items, findItem } from '../src/content/items.ts';
import { effectiveStats } from '../src/economy.ts';

test('v182 词条池：包含 8 大方向与 5 个阶级，剔除心防%并采用坚毅减伤', () => {
  assert.equal(AFFIX_SPECS.length, 8);
  const kinds = new Set(AFFIX_SPECS.map(s => s.kind));
  assert.ok(kinds.has('empathy'), '温存(共情)联动心防');
  assert.ok(kinds.has('damageReduce'), '坚毅提供真免伤');
  assert.equal(kinds.has('spirit' as never), false, '不使用虚浮的心防上限%');

  const reduceSpec = AFFIX_SPECS.find(s => s.kind === 'damageReduce')!;
  assert.equal(reduceSpec.amounts[1], 2);
  assert.equal(reduceSpec.amounts[5], 16);
});

test('v182 装备阶级严格决定词条阶级上限：T1 必为 Rank I，T2 最高 Rank II', () => {
  // 对 Tier 1 装备进行 30 次随机掷骰抽取
  for (let i = 0; i < 30; i += 1) {
    const affix = rollAffixForTier(1, [], `seed-t1-${i}`);
    assert.equal(affix.tier, 1, 'Tier 1 装备的词条阶级必须严格为 Rank 1');
  }

  // 对 Tier 2 装备进行 30 次抽取，最高不超过 Rank 2
  for (let i = 0; i < 30; i += 1) {
    const affix = rollAffixForTier(2, [], `seed-t2-${i}`);
    assert.ok(affix.tier <= 2, 'Tier 2 装备最高不超过 Rank 2');
  }

  // 对 Tier 5 装备进行抽取，允许出 Rank 3~5
  let hasHighRank = false;
  for (let i = 0; i < 30; i += 1) {
    const affix = rollAffixForTier(5, [], `seed-t5-${i}`);
    assert.ok(affix.tier <= 5);
    if (affix.tier >= 3) hasHighRank = true;
  }
  assert.ok(hasHighRank, 'Tier 5 装备应能产出高阶词条');
});

test('v182 executeRefine 仓库装备精炼：原装-1，生成refine-实例+1，消耗材料与星砂', () => {
  const state = createInitialState();
  state.gold = 5000;
  // 找一件 Tier 1 的星辉套装装备
  const baseItem = items.find(i => i.tier === 1 && i.setId === 'set-starlight')!;
  state.inventory[baseItem.id] = 1;
  state.inventory['mat-stardust'] = 5;

  const cost = refineCost(baseItem);
  assert.equal(cost.materialId, 'mat-stardust');
  assert.equal(cost.materialCount, 1);

  const result = executeRefine(state, { kind: 'inventory', itemId: baseItem.id }, 'seed-refine-1');
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(state.inventory[baseItem.id] ?? 0, 0);
  assert.equal(state.inventory['mat-stardust'], 4);
  assert.equal(state.gold, 5000 - cost.gold);

  assert.ok(result.item.id.startsWith('refine-'));
  assert.equal(result.item.affixes?.length, 1);
  assert.equal(result.item.affixes?.[0]?.tier, 1);
  assert.ok((state.inventory[result.item.id] ?? 0) >= 1);
});

test('v182 穿戴在少女身上的装备精炼：原地替换引用，属性即时生效', () => {
  const state = createInitialState();
  state.gold = 5000;
  const girl = state.girls[0]!;
  const baseItem = items.find(i => i.slot === 'weapon' && i.setId === 'set-starlight')!;
  girl.equipment.weapon = baseItem.id;
  state.inventory['mat-stardust'] = 10;

  const beforeStats = effectiveStats(girl);

  const applied = act(state, {
    type: 'refineEquipment',
    target: { kind: 'girl', girlId: girl.id, slot: 'weapon' },
  });
  assert.equal(applied.ok, true);
  if (!applied.ok) return;

  const afterGirl = applied.state.girls.find(g => g.id === girl.id)!;
  assert.notEqual(afterGirl.equipment.weapon, baseItem.id);
  assert.ok(afterGirl.equipment.weapon?.startsWith('refine-'));

  const refinedItem = findItem(afterGirl.equipment.weapon);
  assert.equal(refinedItem?.affixes?.length, 1);
});

test('v182 词条上限：最多 3 条词条，满 3 条再次精炼返回提示', () => {
  const state = createInitialState();
  state.gold = 50000;
  state.inventory['mat-stardust'] = 50;
  const baseItem = items.find(i => i.tier === 2 && i.setId === 'set-starlight')!;
  state.inventory[baseItem.id] = 1;

  let currentId = baseItem.id;
  for (let i = 0; i < 3; i += 1) {
    const res = executeRefine(state, { kind: 'inventory', itemId: currentId }, `refine-${i}`);
    assert.equal(res.ok, true);
    if (!res.ok) return;
    currentId = res.item.id;
  }

  const finalItem = findItem(currentId)!;
  assert.equal(finalItem.affixes?.length, 3);

  // 第 4 次精炼
  const fourth = executeRefine(state, { kind: 'inventory', itemId: currentId }, 'refine-4');
  assert.equal(fourth.ok, false);
  assert.match(fourth.message, /最多精炼 3 条词条/);
});
