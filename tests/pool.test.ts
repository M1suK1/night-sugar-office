import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState, loadState } from '../src/game.ts';
import { MISSION_POOL_SIZE, ensureMissionPools, trimMissionPools } from '../src/rules/pools.ts';
import { districtPin } from '../src/rules/missions.ts';
import { districtAt } from '../src/districts.ts';
import type { GameState } from '../src/types.ts';

const live = (state: GameState) => state.missions.filter(mission => mission.status === 'open' || mission.status === 'active');

test('v38 新档板上固定 12 条，全部来自真实模板', () => {
  const state = createInitialState();
  assert.equal(MISSION_POOL_SIZE, 12);
  assert.equal(live(state).length, 12);
  const titles = live(state).map(mission => mission.title);
  assert.equal(titles.every(title => !/记录\d{3}$/.test(title)), true, '不再拼「辖区记录015」这种编号副本');
  assert.equal(new Set(titles).size, titles.length, '标题互不重复');
  const templates = live(state).map(mission => mission.templateId ?? mission.id);
  assert.equal(new Set(templates).size, templates.length, '同一时间同一个模板只出现一次');
});

test('v38 委托完成或过期后，位子立刻从模板补回', () => {
  const base = createInitialState();
  const target = live(base).find(mission => mission.work === 'combat' && mission.status === 'open')!;
  assert.ok(target, '开局应该有一条可接的战斗委托');
  const dispatched = act(base, { type: 'dispatch', girlIds: ['yue'], missionId: target.id });
  assert.equal(dispatched.ok, true, dispatched.message);

  const done = act(dispatched.state, { type: 'advance', minutes: 180 }).state;
  const settled = done.missions.find(mission => mission.id === target.id);
  assert.ok(settled, '结算记录还在');
  assert.notEqual(settled!.status, 'active', '这条委托已经结束');
  assert.equal(live(done).length, 12, '结束的位子要补回，总数仍是 12');
});

test('v38 换日刷新：板上始终 12 条，不会越滚越多', () => {
  let state = createInitialState();
  state.minutes = 23 * 60 + 30;
  state = act(state, { type: 'advance', minutes: 30 }).state;
  state = act(state, { type: 'endNight' }).state;
  assert.equal(state.day, 15);
  assert.equal(live(state).length, 12);
  assert.ok(state.missions.some(mission => mission.id.startsWith('c-15-0-')), '新一天仍按第一时段放号');
});

test('v38 老档里的编号副本与魔物克隆在读取时清掉', () => {
  const state = createInitialState();
  const sample = live(state)[0]!;
  const padded: GameState = {
    ...state,
    poolLimits: { ...state.poolLimits, missions: 140, combatMissions: 120, investigationMissions: 20, monsters: 50 },
    missions: [
      ...state.missions,
      { ...sample, id: 'old-copy-1', title: `${sample.title} · 糖果公园记录015`, description: '旧副本（糖果公园的第 15 次现场记录。）' },
    ],
    customMonsters: [
      { id: 'pool-mon-14-0', name: '镜修女·0', epithet: '镜修女（档案第 0 号）', description: '复制出来的', element: '月影系', rank: '普通', maxHp: 40, stats: { magic: 40, insight: 40, agility: 40, empathy: 40 } as never, skillIds: [], rules: [], portrait: '', color: '#fff' } as never,
    ],
  };

  const loaded = loadState(JSON.stringify(padded));
  assert.equal(loaded.poolLimits.missions, 12, '上限压回 12');
  assert.equal(loaded.missions.some(mission => /记录\d{3}$/.test(mission.title)), false, '编号副本被清掉');
  assert.equal(loaded.customMonsters.filter(monster => monster.id.startsWith('pool-mon-')).length, 0, '魔物克隆被清掉');
});

test('v38 超过 12 条时先淘汰最旧的自动委托，使者与故事委托留下', () => {
  const state = createInitialState();
  const sample = live(state)[0]!;
  const envoy = { ...sample, id: 'envoy-1', generated: true, sourcePack: 'llm' as const, envoy: true };
  state.missions = [...state.missions, envoy];
  const before = live(state).length;
  assert.ok(before > 12);
  trimMissionPools(state);
  assert.equal(live(state).length, 12);
  assert.ok(state.missions.some(mission => mission.id === 'envoy-1'), '刚加进来的使者委托不能被自己挤掉');
});

test('v38 ensureMissionPools 幂等：已经 12 条时不再补', () => {
  const state = createInitialState();
  const before = state.missions.length;
  assert.equal(ensureMissionPools(state), 0);
  assert.equal(state.missions.length, before);
});

test('v38 委托坐标落在自己的辖区多边形里，不再全挤在标签点', () => {
  const state = createInitialState();
  const live = state.missions.filter(mission => mission.status === 'open' || mission.status === 'active');
  for (const mission of live) {
    assert.equal(districtAt(mission.x, mission.y), mission.district, `${mission.title} 的坐标应该落在 ${mission.district} 里`);
  }
  const districtsUsed = new Set(live.map(mission => mission.district));
  assert.ok(districtsUsed.size >= 6, `12 条委托应该铺到至少 6 个辖区，实际 ${districtsUsed.size}`);
});

test('v38 districtPin 在同一辖区内也散得开', () => {
  const points = Array.from({ length: 8 }, (_, index) => districtPin('oldtown', `salt-${index}`));
  for (const point of points) assert.equal(districtAt(point.x, point.y), 'oldtown');
  const unique = new Set(points.map(point => `${point.x},${point.y}`));
  assert.equal(unique.size, points.length, '同一辖区里的坐标不能重复');
  const spread = Math.max(...points.map(a => Math.min(...points.filter(b => b !== a).map(b => Math.hypot(a.x - b.x, a.y - b.y)))));
  assert.ok(spread > 8, `同一辖区内的点应该铺开，实际最大最近距离 ${spread.toFixed(1)}%`);
});
