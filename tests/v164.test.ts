import test from 'node:test';
import assert from 'node:assert/strict';
import { findSkill, getSkill, skills } from '../src/content/skills.ts';
import { girlSkillPool, isPassiveSkill, pickCandidateSkills } from '../src/skills.ts';
import { passiveText } from '../src/passives.ts';
import { emptyBoss, sanitizeItem, sanitizeLibrary } from '../src/content/library.ts';
import { buildGirlCard, parseGirlCard } from '../src/cards.ts';
import { sanitizeCustomGirl, sanitizeCustomLeader } from '../src/rules/candidate.ts';
import { simulateBattle } from '../src/combat.ts';
import { createInitialState } from '../src/game.ts';
import { getMonster } from '../src/content/monsters.ts';
import { effectiveMaxHp, effectiveMaxSpirit } from '../src/economy.ts';
import type { Girl, Mission, MonsterTemplate } from '../src/types.ts';

const ELEMENTS = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系'];

test('v164 被动数据：六流派各 2、魔物 2、通用 4，共 18 条', () => {
  const passives = skills.filter(skill => skill.tier === 'passive');
  assert.equal(passives.length, 18);
  for (const school of ELEMENTS) {
    assert.equal(passives.filter(skill => skill.school === school).length, 2, school);
  }
  assert.equal(passives.filter(skill => skill.school === '魔物').length, 2);
  assert.equal(passives.filter(skill => skill.school === '通用').length, 4);
  assert.equal(new Set(passives.map(skill => skill.id)).size, 18);
  assert.equal(new Set(skills.map(skill => skill.id)).size, skills.length, 'id 不能和主动技能撞');
  for (const skill of passives) {
    assert.ok(skill.passive, `${skill.id} 缺被动行为`);
    assert.equal(skill.power, 0);
    assert.equal(skill.targets, 0);
  }
});

test('v164 候选：三条不重复，最多一条被动，带与不带都出现', () => {
  let withPassive = 0;
  for (let seed = 1; seed <= 400; seed += 1) {
    const ids = pickCandidateSkills(seed, '月影系');
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    const passives = ids.filter(isPassiveSkill).length;
    assert.ok(passives <= 1, `seed ${seed} 带了 ${passives} 条被动`);
    if (passives) withPassive += 1;
    assert.ok(ids.filter(id => findSkill(id)?.tier === 'ultimate').length <= 2, '不能三条全是奥义');
  }
  assert.ok(withPassive > 40, '应该有相当数量带被动');
  assert.ok(withPassive < 360, '也不能人人都带被动');
  assert.deepEqual(pickCandidateSkills(77, '自然系'), pickCandidateSkills(77, '自然系'));
});

test('v164 清洗：魔物与名册最多一条被动，装备与 Boss 阶段不收被动', () => {
  const library = sanitizeLibrary({
    monsters: [{ id: 'custom-monster-pass01', name: '测试魔物', maxHp: 200, skillIds: ['passive-ember', 'passive-plain-steady', 'monster-claw'] }],
  });
  const monster = library.monsters[0]!;
  assert.equal(monster.skillIds.filter(isPassiveSkill).length, 1);
  assert.ok(monster.skillIds.includes('monster-claw'));

  const passiveOnly = sanitizeLibrary({ monsters: [{ id: 'custom-monster-pass02', name: '只会被动的魔物', maxHp: 200, skillIds: ['passive-ember'] }] }).monsters[0]!;
  assert.ok(passiveOnly.skillIds.includes('monster-claw'), '只剩被动时要补一条主动');

  assert.equal(sanitizeItem({ id: 'custom-item-pass01', name: '测试护符', skillId: 'passive-ember' })?.skillId, undefined);
  assert.equal(sanitizeItem({ id: 'custom-item-pass02', name: '测试护符', skillId: 'glimmer-spear' })?.skillId, 'glimmer-spear');

  const leader = sanitizeCustomLeader({ name: '测试首领', skillIds: ['passive-ember', 'passive-plain-steady', 'glimmer-spear'] }, 'association', 'custom-leader-pass');
  assert.ok(leader);
  assert.equal(leader.skillIds.filter(isPassiveSkill).length, 1);
  assert.ok(leader.skillIds.includes('glimmer-spear'));

  const girl = sanitizeCustomGirl({ name: '测试随从', skills: ['passive-ember', 'passive-plain-steady'] }, 'association', 'custom-girl-pass');
  assert.ok(girl);
  assert.equal(girl.skills.filter(isPassiveSkill).length, 1);
});

test('v164 契约卡与 Boss 阶段也卡死被动上限', () => {
  const state = createInitialState();
  const girl: Girl = { ...state.girls[0], skills: ['passive-ember', 'passive-plain-steady', 'glimmer-spear'] };
  const parsed = parseGirlCard(JSON.stringify(buildGirlCard(girl, { day: 1 })));
  assert.equal(parsed.ok, false);
  assert.match(parsed.ok ? '' : parsed.message, /被动/);

  const boss = { ...emptyBoss(), id: 'custom-boss-pass01', name: '测试王座', phases: [{ atHpPct: 1, skillIds: ['passive-ember'], line: '' }] };
  assert.equal(sanitizeLibrary({ bosses: [boss] }).bosses.length, 0, 'Boss 阶段不能只带被动');
});

test('v164 常驻修正：生命上限与心防上限真的加到战斗单位上', () => {
  const state = createInitialState();
  const base = state.girls[0];
  const maxHpGirl: Girl = { ...base, id: `${base.id}-passive-hp`, skills: ['passive-night-shift-kid', 'glimmer-spear', 'plain-strike'] };
  const maxHp = effectiveMaxHp(maxHpGirl);
  const guardGirl: Girl = { ...base, id: `${base.id}-passive-guard`, skills: ['passive-sugar-shell', 'glimmer-spear', 'plain-strike'] };
  const guard = effectiveMaxSpirit(guardGirl);
  const empathyGirl: Girl = { ...base, id: `${base.id}-passive-empathy`, skills: ['passive-empathic-circuit', 'glimmer-spear', 'plain-strike'] };
  const empathyGuard = effectiveMaxSpirit(empathyGirl);
  const target = dummy();

  const hpBattle = simulateBattle({ mission: missionFor(state, target), girls: [maxHpGirl], day: 1, minutes: 1200, monsters: [target], seed: 3 });
  const hpAlly = hpBattle.units.find(unit => unit.side === 'ally')!;
  assert.equal(hpAlly.passive?.id, 'passive-night-shift-kid');
  assert.equal(hpAlly.maxHp, Math.round(maxHp * 1.1));

  const guardBattle = simulateBattle({ mission: missionFor(state, target), girls: [guardGirl], day: 1, minutes: 1200, monsters: [target], seed: 3 });
  const guardAlly = guardBattle.units.find(unit => unit.side === 'ally')!;
  assert.equal(guardAlly.passive?.id, 'passive-sugar-shell');
  assert.equal(guardAlly.maxSpirit, Math.round(guard * 1.12));

  const empathyBattle = simulateBattle({ mission: missionFor(state, target), girls: [empathyGirl], day: 1, minutes: 1200, monsters: [target], seed: 3 });
  const empathyAlly = empathyBattle.units.find(unit => unit.side === 'ally')!;
  assert.equal(empathyAlly.passive?.id, 'passive-empathic-circuit');
  assert.equal(empathyAlly.maxSpirit, empathyGuard + 12, '共情 +6 应该同步 +12 心防');
});

test('v164 触发：开场护盾、回合回血、命中减益、受击反伤、击杀回血', () => {
  const state = createInitialState();
  const base = state.girls[0];
  const withPassive = (id: string, hpPct = 1): Girl => {
    const girl: Girl = { ...base, id: `${base.id}-${id}`, skills: [id, 'glimmer-spear', 'plain-strike'] };
    const max = effectiveMaxHp(girl);
    return { ...girl, maxHp: max, hp: Math.max(1, Math.round(max * hpPct)) };
  };
  const run = (girl: Girl, target: MonsterTemplate, rounds = 2) =>
    simulateBattle({ mission: missionFor(state, target, rounds), girls: [girl], day: 1, minutes: 1200, monsters: [target], seed: 5 });
  const has = (battle: ReturnType<typeof simulateBattle>, id: string) => battle.events.some(event => event.skillId === id);

  assert.ok(has(run(withPassive('passive-constellation-watch'), dummy()), 'passive-constellation-watch'));
  assert.ok(has(run(withPassive('passive-sweet-aftertaste', 0.5), dummy()), 'passive-sweet-aftertaste'));

  const hitTarget = dummy({ maxHp: 999, stats: { magic: 0, insight: 0, agility: 1, empathy: 1 } });
  assert.ok(has(run(withPassive('passive-silent-coda'), hitTarget), 'passive-silent-coda'));

  const hurtTarget = dummy({ maxHp: 999, stats: { magic: 1, insight: 200, agility: 1, empathy: 1 } });
  assert.ok(has(run(withPassive('passive-thorn-return'), hurtTarget), 'passive-thorn-return'));

  const killTarget = dummy({ maxHp: 1, stats: { magic: 0, insight: 0, agility: 1, empathy: 1 } });
  assert.ok(has(run(withPassive('passive-wildfire', 0.5), killTarget), 'passive-wildfire'));
});

test('v164 出招器不会把被动当主动技能', () => {
  const state = createInitialState();
  const girl: Girl = { ...state.girls[0], id: `${state.girls[0].id}-only-passive`, skills: ['passive-ember'] };
  const target = dummy();
  const battle = simulateBattle({ mission: missionFor(state, target, 2), girls: [girl], day: 1, minutes: 1200, monsters: [target], seed: 7 });
  assert.ok(battle.events.some(event => event.skillId === 'plain-strike'), '没有主动时应该回落素手');
  assert.ok(!battle.events.some(event => event.skillId === 'passive-ember'), '被动不能作为出招');
});

test('v164 被动参与后战斗仍然确定：同种子同结果', () => {
  const state = createInitialState();
  const girl: Girl = { ...state.girls[0], id: `${state.girls[0].id}-det`, skills: ['passive-drift-off', 'glimmer-spear', 'plain-strike'] };
  const target = dummy({ maxHp: 400 });
  const setup = { mission: missionFor(state, target, 3), girls: [girl], day: 1, minutes: 1200, monsters: [target], seed: 11 } as const;
  const first = simulateBattle({ ...setup, girls: [girl], monsters: [target] });
  const second = simulateBattle({ ...setup, girls: [girl], monsters: [target] });
  assert.deepEqual(first.events, second.events);
  assert.equal(first.outcome, second.outcome);
  assert.ok(first.events.filter(event => event.skillId === 'passive-drift-off').length <= 1, '入梦每场最多 1 次');
});

test('v164 被动说明能读：命中、触发与次数都写出来', () => {
  assert.match(passiveText(getSkill('passive-star-calibration')), /命中 \+7/);
  assert.match(passiveText(getSkill('passive-constellation-watch')), /开场/);
  assert.match(passiveText(getSkill('passive-drift-off')), /每场 1 次/);
});

function dummy(overrides: Partial<MonsterTemplate> = {}): MonsterTemplate {
  const base = getMonster('echo-cat');
  return {
    ...base, id: 'custom-monster-passive', name: '被动测试靶', maxHp: 400,
    stats: { magic: 0, insight: 0, agility: 1, empathy: 1 }, skillIds: ['monster-claw'], rules: [],
    ...overrides,
  };
}

function missionFor(state: ReturnType<typeof createInitialState>, target: MonsterTemplate, rounds = 2): Mission {
  return { ...state.missions[0], id: `mission-${target.id}-${rounds}`, title: '被动测试', work: 'combat', enemyIds: [target.id], rounds, duration: rounds * 15, reward: 0 };
}

test('v164 公共池把被动也算进去，但主动基数不变', () => {
  assert.equal(girlSkillPool().filter(skill => skill.tier === 'passive').length, 18);
  assert.equal(girlSkillPool().filter(skill => skill.tier !== 'passive' && skill.tier !== 'boss').length, 52);
});
