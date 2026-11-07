import test from 'node:test';
import assert from 'node:assert/strict';
import { materials, materialById, findMaterial } from '../src/content/materials.ts';
import { equipmentSets, equipmentSetById, findEquipmentSet } from '../src/content/sets.ts';
import { items, findItem } from '../src/content/items.ts';
import { calculateBattleDrops, grantBattleDrops } from '../src/materials.ts';
import { createInitialState } from '../src/game.ts';
import type { Girl, Monster, Mission } from '../src/types.ts';

test('v180 材料表：恰好 6 种材料，一一对应 6 个元素与 6 大套装', () => {
  assert.equal(materials.length, 6);
  const elements = new Set(materials.map(m => m.element));
  assert.equal(elements.size, 6);
  assert.ok(elements.has('星光系'));
  assert.ok(elements.has('糖霜系'));
  assert.ok(elements.has('月影系'));
  assert.ok(elements.has('梦境系'));
  assert.ok(elements.has('自然系'));
  assert.ok(elements.has('赤焰系'));

  const setIds = new Set(materials.map(m => m.setId));
  assert.equal(setIds.size, 6);

  for (const m of materials) {
    assert.ok(m.id.startsWith('mat-'));
    assert.equal(findMaterial(m.id)?.name, m.name);
    assert.equal(materialById.get(m.id)?.element, m.element);
  }
});

test('v180 套装表：恰好 6 大套装，均具备专属被动机制与对应材料', () => {
  assert.equal(equipmentSets.length, 6);
  for (const set of equipmentSets) {
    assert.ok(set.id.startsWith('set-'));
    assert.ok(set.name.includes('套装'));
    assert.ok(set.skillName);
    assert.ok(set.skillDescription);
    assert.ok(findMaterial(set.materialId));
    assert.equal(findEquipmentSet(set.id)?.name, set.name);
    assert.equal(equipmentSetById.get(set.id)?.materialId, set.materialId);
  }
});

test('v180 装备套装归属：所有法器与护符均标明所属套装，覆盖 6 大套装', () => {
  const equipable = items.filter(item => item.slot === 'weapon' || item.slot === 'charm');
  assert.ok(equipable.length >= 60);
  for (const item of equipable) {
    assert.ok(item.setId, `装备 ${item.id} 缺少 setId`);
    assert.ok(findEquipmentSet(item.setId), `装备 ${item.id} 的 setId ${item.setId} 未知`);
  }
  const coveredSets = new Set(equipable.map(i => i.setId));
  assert.equal(coveredSets.size, 6, '法器与护符应覆盖全部 6 大套装');
});

test('v180 战斗掉落：失败与击退不掉落材料，同参数确定性相同', () => {
  const dummyMonster: Monster = {
    id: 'mon-test-1', name: '荧惑残渣', element: '星光系', rank: '游荡',
    hp: 100, maxHp: 100, stats: { magic: 30, insight: 20, agility: 25, empathy: 20 },
    skills: [], rules: [], exp: 20,
  };
  const dummySquad: Girl[] = [
    { ...createInitialState().girls[0]!, element: '赤焰系' },
  ];

  const defeatDrops = calculateBattleDrops([dummyMonster], dummySquad, 'defeat', 'seed-1');
  assert.deepEqual(defeatDrops, {});

  const repelledDrops = calculateBattleDrops([dummyMonster], dummySquad, 'repelled', 'seed-1');
  assert.deepEqual(repelledDrops, {});

  const victoryA = calculateBattleDrops([dummyMonster], dummySquad, 'victory', 'seed-fixed-1');
  const victoryB = calculateBattleDrops([dummyMonster], dummySquad, 'victory', 'seed-fixed-1');
  assert.deepEqual(victoryA, victoryB, '相同种子两次计算掉落必须严格一致');
  assert.ok(Object.keys(victoryA).length > 0, '胜利应掉落材料');
});

test('v180 掉落人数加成与队员系别共鸣：满编 4 人队收获显著多于 1 人队', () => {
  const dummyMonsters: Monster[] = [
    {
      id: 'mon-test-2', name: '月影蚀兽', element: '月影系', rank: '灾厄',
      hp: 300, maxHp: 300, stats: { magic: 50, insight: 40, agility: 35, empathy: 40 },
      skills: [], rules: [], exp: 60,
    },
  ];
  const girlA: Girl = { ...createInitialState().girls[0]!, id: 'g1', element: '赤焰系' };
  const girlB: Girl = { ...createInitialState().girls[1]!, id: 'g2', element: '星光系' };
  const girlC: Girl = { ...createInitialState().girls[2]!, id: 'g3', element: '自然系' };
  const girlD: Girl = { ...createInitialState().girls[0]!, id: 'g4', element: '糖霜系' };

  const soloDrops = calculateBattleDrops(dummyMonsters, [girlA], 'victory', 'seed-compare');
  const squadDrops = calculateBattleDrops(dummyMonsters, [girlA, girlB, girlC, girlD], 'victory', 'seed-compare');

  const totalSolo = Object.values(soloDrops).reduce((a, b) => a + b, 0);
  const totalSquad = Object.values(squadDrops).reduce((a, b) => a + b, 0);
  assert.ok(totalSquad > totalSolo, `4人小队掉落总量(${totalSquad})应大于单人小队(${totalSolo})`);
});

test('v180 grantBattleDrops：材料计入 state.inventory 并留下详细日志', () => {
  const state = createInitialState();
  const dummyMission: Mission = {
    id: 'm-battle-1', title: '星见川扫荡', category: 'combat', work: 'combat',
    difficulty: '中危', duration: 45, reward: 800, deadline: 300,
    status: 'active', squad: [state.girls[0]!.id], district: 'docks',
    enemyIds: ['mon-test-1'],
  };
  const dummyMonsters: Monster[] = [
    {
      id: 'mon-test-1', name: '水下梦魇', element: '梦境系', rank: '游荡',
      hp: 120, maxHp: 120, stats: { magic: 30, insight: 30, agility: 30, empathy: 30 },
      skills: [], rules: [], exp: 25,
    },
  ];

  const beforeInv = { ...state.inventory };
  const drops = grantBattleDrops(state, dummyMission, dummyMonsters, [state.girls[0]!], 'victory');
  assert.ok(Object.keys(drops).length > 0);

  for (const [matId, count] of Object.entries(drops)) {
    const prev = beforeInv[matId] ?? 0;
    assert.equal(state.inventory[matId], prev + count);
  }
  const lastLog = state.logs[0];
  assert.ok(lastLog && lastLog.text.includes('材料'));
});
