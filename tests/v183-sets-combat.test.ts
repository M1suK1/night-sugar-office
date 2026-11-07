import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import { activeSetOf } from '../src/economy.ts';
import { items, findItem } from '../src/content/items.ts';
import { simulateBattle, pickSkill } from '../src/combat.ts';
import type { Girl, Mission, Monster } from '../src/types.ts';

test('v183 activeSetOf：穿戴同套装法器与护符时激活套装，不同套装时不激活', () => {
  const girl = { ...createInitialState().girls[0]! };
  const starlightWeapon = items.find(i => i.slot === 'weapon' && i.setId === 'set-starlight')!;
  const starlightCharm = items.find(i => i.slot === 'charm' && i.setId === 'set-starlight')!;
  const cinderCharm = items.find(i => i.slot === 'charm' && i.setId === 'set-cinder')!;

  girl.equipment = { weapon: starlightWeapon.id, charm: starlightCharm.id };
  assert.equal(activeSetOf(girl), 'set-starlight');

  girl.equipment = { weapon: starlightWeapon.id, charm: cinderCharm.id };
  assert.equal(activeSetOf(girl), undefined, '散件不激活套装');

  girl.equipment = { weapon: starlightWeapon.id };
  assert.equal(activeSetOf(girl), undefined, '仅穿一件不激活套装');
});

test('v183 星辉套装【极光序曲】：解除第 2 轮限制，开场第 1 轮即可施放奥义', () => {
  const girl = { ...createInitialState().girls[0]! };
  const starlightWeapon = items.find(i => i.slot === 'weapon' && i.setId === 'set-starlight')!;
  const starlightCharm = items.find(i => i.slot === 'charm' && i.setId === 'set-starlight')!;
  girl.equipment = { weapon: starlightWeapon.id, charm: starlightCharm.id };

  const ultimateSkill = 'starlight-fall';
  girl.skills = ['plain-strike', ultimateSkill];

  const dummyUnit = {
    uid: 'ally-g1', side: 'ally' as const, name: girl.name, color: girl.color,
    hp: 100, maxHp: 100, spirit: 50, maxSpirit: 50,
    stats: { magic: 50, insight: 50, agility: 50, empathy: 50 },
    skills: ['plain-strike', ultimateSkill], cooldown: {}, effects: [], down: false,
    insightRoll: 0, scarHit: 0, dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
    activeSet: 'set-starlight' as const,
  };

  // 第 1 轮时，普通角色选不出奥义，星辉套装可直接选出奥义
  const pickedWithSet = pickSkill(dummyUnit, 1, 0.99);
  assert.equal(pickedWithSet?.id, ultimateSkill);

  const plainUnit = { ...dummyUnit, activeSet: undefined };
  const pickedWithoutSet = pickSkill(plainUnit, 1, 0.99);
  assert.notEqual(pickedWithoutSet?.id, ultimateSkill, '普通角色第 1 轮不许出奥义');
});

test('v183 甜晶套装【甘饴庇护】：开场自动赋予 20% 生命护盾', () => {
  const state = createInitialState();
  const girl = { ...state.girls[0]! };
  const frostingWeapon = items.find(i => i.slot === 'weapon' && i.setId === 'set-frosting')!;
  const frostingCharm = items.find(i => i.slot === 'charm' && i.setId === 'set-frosting')!;
  girl.equipment = { weapon: frostingWeapon.id, charm: frostingCharm.id };

  const mission: Mission = {
    id: 'm-frost-test', title: '甜晶测试', category: 'combat', work: 'combat',
    difficulty: '低危', duration: 30, reward: 500, deadline: 300,
    status: 'active', squad: [girl.id], district: 'candy', enemyIds: ['mon-test'],
  };

  const battle = simulateBattle({
    mission, girls: [girl], day: 1, minutes: 1200,
  });

  // 在战斗事件中查找甘饴护盾
  const shieldEvent = battle.events.find(
    e => e.skillName === '甘饴庇护' || e.note?.includes('甘饴护盾'),
  );
  assert.ok(shieldEvent, '甜晶套装开局应当激活护盾');
});

test('v183 常磐套装【常磐护卫】：每场战斗替友方承受一次直接伤害', () => {
  const state = createInitialState();
  const tank = { ...state.girls[0]!, id: 'g-tank', hp: 200, maxHp: 200 };
  const squishy = { ...state.girls[1]!, id: 'g-squishy', hp: 80, maxHp: 80 };

  const natureWeapon = items.find(i => i.slot === 'weapon' && i.setId === 'set-nature')!;
  const natureCharm = items.find(i => i.slot === 'charm' && i.setId === 'set-nature')!;
  tank.equipment = { weapon: natureWeapon.id, charm: natureCharm.id };

  const mission: Mission = {
    id: 'm-nature-test', title: '常磐护卫测试', category: 'combat', work: 'combat',
    difficulty: '中危', duration: 40, reward: 600, deadline: 300,
    status: 'active', squad: [tank.id, squishy.id], district: 'greenhouse', enemyIds: ['mon-test-1', 'mon-test-2'],
  };

  const battle = simulateBattle({
    mission, girls: [tank, squishy], day: 1, minutes: 1200,
  });

  const coverEvent = battle.events.find(
    e => e.skillName === '常磐护卫' || e.note?.includes('常磐护卫'),
  );
  assert.ok(coverEvent, '应当触发常磐护卫替队友承受伤害事件');
});
