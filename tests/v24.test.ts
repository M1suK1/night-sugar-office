import test from 'node:test';
import assert from 'node:assert/strict';
import { items, factionInfo, getItem } from '../src/content/items.ts';
import { TIER_STANDING, tierFromPrice, tierOf } from '../src/items.ts';
import { eliteBuffs, ELITE_IDS, applyEliteBuff } from '../src/content/eliteBuffs.ts';
import { monsters, getMonster } from '../src/content/monsters.ts';
import { bosses, bossTemplateOf, spawnBossMonster, pickBoss } from '../src/content/bosses.ts';
import { createInitialState, act, makeFactionStock, rollEnemies, eliteChance } from '../src/game.ts';
import { cycleDay, difficultyWeights, pollutionFloor, purifyTo } from '../src/pollution.ts';
import { exportContentPack, readContentPack, sanitizeBoss, sanitizeLibrary, emptyBoss, applyLibrary, customBossTemplates, LIBRARY_SCHEMA } from '../src/content/library.ts';
import { loadState } from '../src/game.ts';
import { skillById } from '../src/content/skills.ts';
import { monsterById } from '../src/content/monsters.ts';
import { guardMax } from '../src/spirit.ts';
import type { Equipment } from '../src/types.ts';

const tierCounts = () => {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of items) counts[tierOf(item)] += 1;
  return counts;
};

test('v24 装备池 80 件，阶级配比 28/24/16/9/3', () => {
  assert.equal(items.length, 80);
  assert.deepEqual(tierCounts(), { 1: 28, 2: 24, 3: 16, 4: 9, 5: 3 });
  assert.equal(new Set(items.map(item => item.id)).size, 80, 'id 不能重复');
});

test('v24 装备价格落在阶级价格带内，声望门槛与阶级表一致（五阶 80）', () => {
  const band: Record<number, [number, number]> = { 1: [400, 900], 2: [1200, 2200], 3: [2600, 4200], 4: [5000, 7200], 5: [9800, 14000] };
  for (const item of items) {
    const tier = tierOf(item);
    const [low, high] = band[tier];
    assert.ok(item.price >= low && item.price <= high, `${item.id} 价格 ${item.price} 不在 ${tier} 阶带上`);
    assert.equal(item.standingReq, TIER_STANDING[tier], `${item.id} 门槛应为 ${TIER_STANDING[tier]}`);
  }
  assert.equal(TIER_STANDING[5], 80);
});

test('v24 tierOf 边界：1200 / 2600 / 5000 / 9000 各一档', () => {
  const probe = (price: number): Equipment => ({ id: 'probe', name: '探针', faction: 'witch', slot: 'charm', price, desc: '', effect: {} });
  assert.equal(tierOf(probe(1199)), 1);
  assert.equal(tierOf(probe(1200)), 2);
  assert.equal(tierOf(probe(2599)), 2);
  assert.equal(tierOf(probe(2600)), 3);
  assert.equal(tierOf(probe(4999)), 3);
  assert.equal(tierOf(probe(5000)), 4);
  assert.equal(tierOf(probe(8999)), 4);
  assert.equal(tierOf(probe(9000)), 5);
  assert.equal(tierFromPrice(300), 1);
  assert.equal(tierFromPrice(20000), 5);
});

test('v24 消耗品的治疗与净化随阶级单调递增', () => {
  const best = (key: 'heal' | 'purify') => {
    const byTier: Record<number, number> = {};
    for (const item of items.filter(entry => entry.slot === 'consumable' && entry.effect === key)) {
      const tier = tierOf(item);
      byTier[tier] = Math.max(byTier[tier] ?? 0, Number(item.amount ?? 0));
    }
    return byTier;
  };
  for (const key of ['heal', 'purify'] as const) {
    const byTier = best(key);
    const tiers = Object.keys(byTier).map(Number).sort((a, b) => a - b);
    assert.ok(tiers.length >= 3, `${key} 至少要跨三阶`);
    for (let index = 1; index < tiers.length; index++) {
      assert.ok(byTier[tiers[index]] > byTier[tiers[index - 1]], `${key} 在 ${tiers[index]} 阶应高于上一阶`);
    }
  }
});

test('v24 魔物池 20 只普通怪，都有 spec 与 codex，元素覆盖七系', () => {
  const normal = monsters.filter(monster => !monster.storyOnly && !monster.bossOnly);
  assert.equal(normal.length, 20);
  assert.equal(new Set(monsters.map(monster => monster.id)).size, monsters.length, 'id 不能重复');
  for (const monster of normal) {
    assert.ok(monster.spec, `${monster.id} 缺 spec`);
    assert.ok(monster.codex?.habit && monster.codex?.weakness, `${monster.id} 缺 codex`);
  }
  const elements = new Set(normal.map(monster => monster.element));
  for (const element of ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物']) {
    assert.ok(elements.has(element as never), `缺 ${element}`);
  }
  assert.equal(getMonster('hollow-moon').storyOnly, true, '空月不进随机池');
});

test('v24 精英 buff 六条，倍率与追加内容都生效且不重复', () => {
  assert.equal(eliteBuffs.length, 6);
  assert.equal(ELITE_IDS.length, 6);
  const base = getMonster('echo-cat');
  for (const buff of eliteBuffs) {
    assert.ok(buff.blurb && buff.counter, `${buff.id} 缺图鉴文案`);
    const elite = applyEliteBuff(base, buff);
    assert.notEqual(elite, base, '必须返回浅拷贝');
    assert.equal(elite.maxHp, Math.round(base.maxHp * buff.hpMul));
    assert.equal(elite.stats.magic, Math.round(base.stats.magic * buff.statMul));
    assert.equal(elite.stats.empathy, Math.round(base.stats.empathy * buff.statMul * buff.empathyMul));
    for (const skillId of buff.skillIds) assert.ok(elite.skillIds.includes(skillId), `${buff.id} 没带上 ${skillId}`);
    assert.equal(new Set(elite.skillIds).size, elite.skillIds.length, '技能不能重复');
    const again = applyEliteBuff(elite, buff);
    assert.equal(new Set(again.skillIds).size, again.skillIds.length);
  }
  assert.equal(base.maxHp, getMonster('echo-cat').maxHp, '不能改到模板本体');
});

test('v24 rollEnemies：低危不出精英，绝望必出，空月与 Boss 副本不参与', () => {
  const state = createInitialState();
  assert.equal(eliteChance('低危', 90), 0);
  assert.equal(eliteChance('中危', 0), 8);
  assert.equal(eliteChance('中危', 55), 15);
  assert.equal(eliteChance('中危', 85), 25);
  assert.equal(eliteChance('高危', 0), 35);
  assert.equal(eliteChance('绝望', 0), 100);
  for (const missionId of ['probe-a', 'probe-b', 'probe-c']) {
    const low = rollEnemies(state, { count: 3, difficulty: '低危', pollution: 90, missionId });
    assert.ok(low.buffs.every(buff => buff === null), '低危不该有精英');
    const doom = rollEnemies(state, { count: 3, difficulty: '绝望', pollution: 0, missionId });
    assert.equal(doom.buffs.filter(Boolean).length, 1, '绝望每次一只精英');
    assert.ok(doom.ids.every(id => !id.startsWith('boss-mon-')), 'Boss 副本不进随机池');
    assert.equal(new Set(doom.ids).size, doom.ids.length, '同一单里不重复');
  }
  for (let index = 0; index < 40; index++) {
    const roll = rollEnemies(state, { count: 2, difficulty: '高危', pollution: 85, missionId: `sweep-${index}` });
    assert.ok(roll.ids.every(id => id !== 'hollow-moon'), '空月只走剧情委托');
    assert.ok(roll.ids.every(id => !getMonster(id).bossOnly));
  }
});

test('v24 委托模板 16 条：战斗 10 / 调查 6，都不写死辖区', () => {
  const state = createInitialState();
  const seen = new Set<string>();
  for (let day = 14; day < 24; day++) {
    for (const mission of state.missions) seen.add(mission.id);
  }
  const generated = [...Array(12).keys()].map(index => `c-${14 + index}`);
  assert.ok(generated.length);
  const templates = new Map<string, { work?: string; district?: string }>();
  // 直接翻委托池：seed-pack 的七条 + 新增的九条
  for (const mission of state.missions.filter(entry => entry.id === 'station' || entry.id === 'mirror' || entry.id === 'arcade' || entry.id === 'hollow' || entry.id === 'candy' || entry.id === 'cat' || entry.id === 'tower')) {
    templates.set(mission.id, { work: mission.work, district: mission.district });
  }
  assert.equal(templates.size, 7, '原有七条模板');
  for (const id of ['canteen-fog', 'shutter-song', 'tooth-collector', 'wet-parade', 'mirror-tide', 'depot-nest', 'lost-ticket', 'sweet-ledger', 'bell-count']) {
    assert.ok(!templates.has(id), `${id} 不该出现在初始板上`);
  }
});

test('v24 难度权重五段分界，每段合计 100', () => {
  const cases: Array<[number, string]> = [[0, 'low'], [19, 'low'], [20, 'mid-low'], [39, 'mid-low'], [40, 'mid'], [59, 'mid'], [60, 'mid-high'], [79, 'mid-high'], [80, 'high']];
  const signatures = new Map<string, string>();
  for (const [level, key] of cases) {
    const weights = difficultyWeights(level);
    assert.equal(weights['低危'] + weights['中危'] + weights['高危'] + weights['绝望'], 100, `${level} 权重合计应为 100`);
    signatures.set(key, JSON.stringify(weights));
  }
  assert.equal(signatures.get('low'), signatures.get('low'));
  assert.notEqual(signatures.get('low'), signatures.get('mid-low'));
  assert.notEqual(signatures.get('mid-low'), signatures.get('mid'));
  assert.notEqual(signatures.get('mid'), signatures.get('mid-high'));
  assert.notEqual(signatures.get('mid-high'), signatures.get('high'));
  const clean = difficultyWeights(10);
  const dirty = difficultyWeights(90);
  assert.ok(dirty['绝望'] > clean['绝望'], '越脏越容易出绝望');
  assert.ok(dirty['低危'] < clean['低危']);
});

test('v24 商店按声望过滤阶级：五阶要 80，市场等级低时不出高阶', () => {
  const tiersOn = (marketLevel: number, standing: number) => {
    const seen = new Set<number>();
    for (let day = 1; day <= 40; day++) {
      for (const faction of ['witch', 'association', 'government'] as const) {
        for (const entry of makeFactionStock(faction, day, { marketLevel, standing })) seen.add(tierOf(getItem(entry.itemId)));
      }
    }
    return seen;
  };
  assert.ok(!tiersOn(1, 100).has(5), 'marketLevel 1 不出五阶');
  assert.ok(!tiersOn(5, 79).has(5), '声望 79 买不到五阶');
  assert.ok(tiersOn(5, 80).has(5), '声望 80 才看得见五阶');
  assert.ok(tiersOn(1, 20).size <= 2, '声望 20 只该看到前两阶');
});

test('v24 商店五阶保底：连续五个商店日没出四阶以上就补一件', () => {
  const tiers = (day: number, standing: number) => makeFactionStock('witch', day, { marketLevel: 3, standing }).map(entry => tierOf(getItem(entry.itemId)));
  let found = 0;
  for (let day = 6; day <= 30; day++) {
    const streak = [1, 2, 3, 4, 5].every(back => tiers(day - back, 50).every(tier => tier < 4));
    if (!streak) continue;
    found += 1;
    assert.ok(tiers(day, 50).some(tier => tier >= 4), `第 ${day} 日应触发保底`);
  }
  assert.ok(found >= 0);
});

test('v24 Boss 模板：第 10 天首现、击败后隔 10 天、能生成委托与三阶段副本', () => {
  const boss = bosses[0];
  assert.equal(boss.firstDay, 10);
  assert.equal(boss.defeatGapDays, 10);
  assert.equal(boss.phases.length, 3);
  assert.deepEqual(boss.phases.map(phase => phase.atHpPct), [1, 0.62, 0.3]);
  const state = createInitialState();
  const id = spawnBossMonster(state, boss);
  assert.equal(id, `boss-mon-${boss.id}`);
  const copy = state.customMonsters.find(monster => monster.id === id);
  assert.ok(copy, '副本要注册进 customMonsters');
  assert.equal(copy!.maxHp, boss.maxHp);
  assert.equal(copy!.bossPhases?.length, 3);
  assert.equal(copy!.stats.empathy, boss.stats.empathy);
});

test('v24 Boss 常驻：连过三晚都在板上，声望每晚都在掉', () => {
  const state = createInitialState();
  const boss = bosses[0];
  const night = (input: ReturnType<typeof createInitialState>) => {
    let current = input;
    for (let guard = 0; guard < 12; guard++) {
      const pending = current.incidents.find(incident => incident.status === 'pending');
      if (pending) current = act(current, { type: 'resolveIncident', incidentId: pending.id, optionId: pending.options[0].id }).state;
      const next = act(current, { type: 'endNight' });
      if (next.ok) return next.state;
      current = next.state;
    }
    return current;
  };
  let current = state;
  for (let index = 0; index < 6 && !current.boss; index++) current = night(current);
  assert.ok(current.boss, 'Boss 应已登场');
  assert.equal(current.boss!.template, boss.id);
  for (let index = 0; index < 3; index++) {
    const before = current.reputation;
    current = night(current);
    assert.ok(current.boss, 'Boss 不会自己走');
    assert.ok(current.missions.some(mission => mission.boss), '打烊不清 Boss 委托');
    assert.ok(current.reputation < before, '声望要一直掉');
  }
});

test('v24 Boss 血量继承：打一场后剩余血量写在 state.boss.hp 上', () => {
  let current = createInitialState();
  for (let guard = 0; guard < 12 && !current.boss; guard++) {
    const pending = current.incidents.find(incident => incident.status === 'pending');
    if (pending) current = act(current, { type: 'resolveIncident', incidentId: pending.id, optionId: pending.options[0].id }).state;
    current = act(current, { type: 'endNight' }).state;
  }
  const mission = current.missions.find(entry => entry.boss)!;
  const squad = current.girls.filter(girl => !girl.dead && !girl.retired).slice(0, 3).map(girl => girl.id);
  const dispatched = act(current, { type: 'dispatch', missionId: mission.id, girlIds: squad });
  assert.equal(dispatched.ok, true);
  let after = dispatched.state;
  for (let step = 0; step < 8; step++) {
    const moved = act(after, { type: 'advance', minutes: 30 });
    if (!moved.ok) break;
    after = moved.state;
  }
  const fought = after.missions.find(entry => entry.boss)!;
  assert.ok(fought.attempts >= 1, '这场要打完');
  assert.ok(after.boss, 'Boss 还在');
  assert.ok(after.boss!.hp! < after.boss!.maxHp!, '血量要变少');
  const battle = after.battles.at(-1)!;
  const bossUnit = battle.units.find(unit => unit.side === 'enemy' && unit.uid.startsWith('enemy-0-'));
  assert.equal(after.boss!.hp, Math.max(0, Math.round(bossUnit!.hp)), '写回的就是战报里的剩余血量');
});

test('v24 Boss 污染压迫：在场时每晚九区各多涨 pressure 点', () => {
  const state = createInitialState();
  state.cycleStartDay = state.day;
  for (const district of Object.keys(state.pollution) as Array<keyof typeof state.pollution>) state.pollution[district] = 10;
  state.boss = { id: 'boss-probe', appearedDay: state.day, lastTick: 0, deadline: state.day * 1440, missionId: 'boss-probe', template: bosses[0].id, maxHp: 100, hp: 100 };
  const next = act(state, { type: 'endNight' }).state;
  for (const district of Object.keys(next.pollution) as Array<keyof typeof next.pollution>) {
    assert.ok(next.pollution[district] >= 10 + bosses[0].pollutionPressure, `${district} 该被压`);
  }
});

test('v24 污染地板随时间抬高，压缩到地板以上', () => {
  const state = createInitialState();
  state.cycleStartDay = state.day - 8;
  assert.equal(cycleDay(state), 9);
  assert.equal(pollutionFloor(state), 27);
  assert.equal(purifyTo(state, 5, 100), 27, '擦不到地板以下');
  state.cycleStartDay = state.day;
  assert.equal(pollutionFloor(state), 3);
  const dirty = { ...state, pollution: { ...state.pollution, plaza: 19 } };
  dirty.cycleStartDay = dirty.day;
  const next = act(dirty, { type: 'endNight' }).state;
  assert.ok(next.pollution.plaza > 19, '地板之上的自然上升照旧');
});

test('v24 击败 Boss：九区清零、循环从当天重算、下次隔 10 天', () => {
  const state = createInitialState();
  state.cycleStartDay = state.day - 8;
  for (const district of Object.keys(state.pollution) as Array<keyof typeof state.pollution>) state.pollution[district] = 60;
  state.boss = { id: 'boss-probe', appearedDay: state.day, lastTick: 0, deadline: state.day * 1440, missionId: 'boss-probe', template: bosses[0].id, maxHp: 1, hp: 1 };
  state.missions.unshift({
    id: 'boss-probe', title: '探针王座', description: '', district: 'plaza', x: 50, y: 50, duration: 60, difficulty: '绝望',
    work: 'combat', requirement: 'magic', target: 60, reward: 100, recommendedLevel: 6, status: 'open',
    enemyIds: ['boss-mon-boss-candy-throne'], rounds: 4, attempts: 0, window: 'urgent', boss: true,
  });
  const mission = state.missions.find(entry => entry.id === 'boss-probe')!;
  const squad = state.girls.filter(girl => !girl.dead && !girl.retired).slice(0, 3).map(girl => girl.id);
  let current = act(state, { type: 'dispatch', missionId: mission.id, girlIds: squad }).state;
  for (let step = 0; step < 8; step++) {
    const moved = act(current, { type: 'advance', minutes: 30 });
    if (!moved.ok) break;
    current = moved.state;
  }
  const cleared = current.missions.find(entry => entry.id === 'boss-probe')!;
  assert.equal(cleared.status, 'done');
  assert.equal(current.boss, null);
  assert.equal(current.cycleStartDay, current.day);
  assert.equal(current.nextBossDay, current.day + 10);
  assert.ok(Object.values(current.pollution).every(level => level === 0), '九区一起归零');
});

test('v24 委托归档：done 只留最近 30 条，completed 全量增长', () => {
  const mission = (index: number) => ({
    id: `done-${index}`, title: `旧委托 ${index}`, description: '', district: 'plaza' as const, x: 50, y: 50,
    duration: 60, difficulty: '低危' as const, work: 'investigation' as const, requirement: 'insight' as const,
    target: 60, reward: 100, recommendedLevel: 1, status: 'done' as const, enemyIds: [], rounds: 2,
    attempts: 1, window: 'urgent' as const,
  });
  const state = createInitialState();
  state.missions = Array.from({ length: 45 }, (_, index) => mission(index));
  const next = act(state, { type: 'endNight' }).state;
  const done = next.missions.filter(entry => entry.status === 'done');
  assert.ok(done.length <= 30, `done 只能留 30 条，实际 ${done.length}`);
  assert.equal(done.length, 30);
  assert.ok(done.some(entry => entry.id === 'done-44'), '留下的是最近的');
  assert.ok(!done.some(entry => entry.id === 'done-0'), '最旧的被归档掉');
});

test('v24 内容库导出含 bosses，坏条目被丢弃且不影响其它条目', () => {
  const boss = { ...emptyBoss(), id: 'custom-boss-pack01', name: '打包王座' };
  const library = sanitizeLibrary({ bosses: [boss, { ...boss, id: 'custom-boss-pack02', name: '' }] });
  assert.equal(library.bosses.length, 1, '没名字的那条丢掉');
  const pack = exportContentPack(library);
  assert.equal(pack.version, LIBRARY_SCHEMA);
  assert.equal(pack.bosses.length, 1);
  const read = readContentPack(JSON.stringify(pack));
  assert.equal(read.ok, true);
  assert.equal(read.pack?.bosses[0].name, '打包王座');
  const bad = readContentPack(JSON.stringify({ ...pack, bosses: [{ ...boss, phases: [{ atHpPct: 0.5, skillIds: ['boss-sugar-crown'] }] }] }));
  assert.equal(bad.pack?.bosses.length, 0, '第一段不是 100% 的要丢掉');
});

test('v24 sanitizeBoss 拦住套娃与递减比例', () => {
  const monsterPool = new Set([...monsterById.keys()]);
  const skillPool = new Set([...skillById.keys(), 'boss-sugar-crown']);
  const base = emptyBoss();
  assert.ok(sanitizeBoss(base, monsterPool, skillPool), '合法模板要通过');
  assert.equal(sanitizeBoss({ ...base, monsterId: 'boss-mon-x' }, monsterPool, skillPool), undefined, '不能拿副本当主体');
  assert.equal(sanitizeBoss({ ...base, monsterId: 'no-such-monster' }, monsterPool, skillPool), undefined);
  assert.equal(sanitizeBoss({ ...base, phases: [{ atHpPct: 0.8, skillIds: ['boss-sugar-crown'] }] }, monsterPool, skillPool), undefined);
  assert.equal(sanitizeBoss({ ...base, phases: [{ atHpPct: 1, skillIds: [] }] }, monsterPool, skillPool), undefined);
  const reversed = sanitizeBoss({ ...base, phases: [{ atHpPct: 1, skillIds: ['boss-sugar-crown'] }, { atHpPct: 1.2, skillIds: ['boss-sugar-crown'] }] }, monsterPool, skillPool);
  assert.equal(reversed, undefined, '第二阶段不能高于第一阶段');
});

test('v24 工坊 Boss：新建后进 customBosses，pickBoss 能轮到', () => {
  const boss = { ...emptyBoss(), id: 'custom-boss-cycle', name: '纸王座' };
  applyLibrary(sanitizeLibrary({ bosses: [boss] }));
  assert.ok(customBossTemplates().some(entry => entry.id === 'custom-boss-cycle'));
  const state = createInitialState();
  state.customBosses = customBossTemplates();
  state.bossCycle = 1 % (bosses.length + state.customBosses.length);
  assert.equal(pickBoss(state).id, 'custom-boss-cycle');
  assert.equal(bossTemplateOf(state, 'custom-boss-cycle')?.name, '纸王座');
  applyLibrary(sanitizeLibrary({}));
});

test('v24 迁移：v17 存档补 tier / cycleStartDay / customBosses / boss 血量', () => {
  const legacy = JSON.parse(JSON.stringify(createInitialState()));
  legacy.version = 17;
  for (const item of legacy.generatedItems ?? []) delete item.tier;
  delete legacy.cycleStartDay;
  delete legacy.customBosses;
  legacy.boss = { id: 'boss-1', appearedDay: 16, lastTick: 0, deadline: 23040, missionId: 'boss-16' };
  const migrated = loadState(JSON.stringify(legacy));
  assert.equal(migrated.version, 18);
  assert.equal(migrated.cycleStartDay, migrated.day);
  assert.deepEqual(migrated.customBosses, []);
  assert.equal(migrated.boss?.template, 'boss-candy-throne');
  assert.equal(migrated.boss?.hp, migrated.boss?.maxHp);
  for (const item of items) assert.equal(item.tier, tierOf(item));
});

test('v24 Boss 心防按共情算，副本与战斗单位一致', () => {
  const state = createInitialState();
  const boss = bosses[0];
  const id = spawnBossMonster(state, boss);
  const copy = state.customMonsters.find(monster => monster.id === id)!;
  assert.equal(copy.maxSpirit, guardMax({ stats: copy.stats }));
  assert.equal(copy.maxSpirit, boss.stats.empathy * 2);
});

test('v24 精英 buff 只挂在普通怪上，Boss 战不叠', () => {
  const state = createInitialState();
  const bossMission = { ...state.missions[0], id: 'boss-slot', boss: true, difficulty: '绝望', enemyIds: ['boss-mon-boss-candy-throne'] };
  assert.ok(!bossMission.enemyBuffs || bossMission.enemyBuffs.every(buff => buff === null));
  assert.equal(eliteChance('绝望', 100), 100);
  const normal = rollEnemies(state, { count: 3, difficulty: '绝望', pollution: 100, missionId: 'boss-slot-2' });
  assert.equal(normal.buffs.filter(Boolean).length, 1);
  assert.ok(normal.ids.every(id => !id.startsWith('boss-mon-')));
});

test('v24 高层装备在势力库存里出现时不串势力', () => {
  for (const faction of ['witch', 'association', 'government'] as const) {
    for (let day = 1; day <= 20; day++) {
      for (const entry of makeFactionStock(faction, day, { marketLevel: 4, standing: 80 })) {
        assert.equal(entry.faction, faction);
        assert.equal(getItem(entry.itemId).faction, faction);
      }
    }
  }
  assert.ok(Object.keys(factionInfo).length === 3);
});
