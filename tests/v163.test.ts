import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_PACK_FORMAT, LIBRARY_SCHEMA, emptyBoss, readContentPack, sanitizeLibrary } from '../src/content/library.ts';
import { sanitizeCustomGirl, sanitizeCustomLeader } from '../src/rules/candidate.ts';

const bossSkill = 'boss-sugar-crown';

test('v163 普通魔物带 Boss 技能：导入时丢掉，公共技能保留', () => {
  const library = sanitizeLibrary({
    monsters: [{ id: 'custom-monster-boss01', name: '偷冠者', maxHp: 200, skillIds: ['monster-claw', bossSkill] }],
  });
  assert.equal(library.monsters.length, 1);
  assert.deepEqual(library.monsters[0].skillIds, ['monster-claw']);
});

test('v163 普通魔物的技能全不合法时回落 monster-claw', () => {
  const library = sanitizeLibrary({
    monsters: [{ id: 'custom-monster-boss02', name: '空冠者', maxHp: 200, skillIds: [bossSkill] }],
  });
  assert.deepEqual(library.monsters[0].skillIds, ['monster-claw']);
});

test('v163 装备不能附带 Boss 技能，公共技能不受影响', () => {
  const library = sanitizeLibrary({
    items: [
      { id: 'custom-item-boss01', name: '冠屑护符', skillId: bossSkill },
      { id: 'custom-item-boss02', name: '星屑护符', skillId: 'glimmer-spear' },
    ],
  });
  assert.equal(library.items[0].skillId, undefined);
  assert.equal(library.items[1].skillId, 'glimmer-spear');
});

test('v163 Boss 模板仍能引用 Boss 技能', () => {
  const boss = { ...emptyBoss(), id: 'custom-boss-boss01', name: '冠之座' };
  const library = sanitizeLibrary({ bosses: [boss] });
  assert.equal(library.bosses.length, 1);
  assert.deepEqual(library.bosses[0].phases[0].skillIds, [bossSkill]);
});

test('v163 包内自定义技能仍可挂到魔物与装备上', () => {
  const library = sanitizeLibrary({
    skills: [{ id: 'custom-skill-own01', name: '自制星屑' }],
    items: [{ id: 'custom-item-own01', name: '自制护符', skillId: 'custom-skill-own01' }],
    monsters: [{ id: 'custom-monster-own01', name: '自制魔物', maxHp: 180, skillIds: ['custom-skill-own01'] }],
  });
  assert.equal(library.items[0].skillId, 'custom-skill-own01');
  assert.deepEqual(library.monsters[0].skillIds, ['custom-skill-own01']);
});

test('v163 内容包导入路径也丢掉 Boss 技能', () => {
  const raw = {
    format: CONTENT_PACK_FORMAT,
    version: LIBRARY_SCHEMA,
    monsters: [{ id: 'custom-monster-boss03', name: '包里的偷冠者', maxHp: 210, skillIds: [bossSkill, 'monster-claw'] }],
  };
  const read = readContentPack(JSON.stringify(raw));
  assert.equal(read.ok, true);
  assert.deepEqual(read.pack?.monsters[0].skillIds, ['monster-claw']);
});

test('v163 名册里的首领与随从也清掉 Boss 技能', () => {
  const leader = sanitizeCustomLeader(
    { name: '测试首领', skillIds: ['glimmer-spear', bossSkill] },
    'association',
    'custom-leader-v163',
  );
  assert.ok(leader);
  assert.deepEqual(leader.skillIds, ['glimmer-spear']);

  const girl = sanitizeCustomGirl(
    { name: '测试随从', skills: ['monster-claw', bossSkill] },
    'association',
    'custom-girl-v163',
  );
  assert.ok(girl);
  assert.deepEqual(girl.skills, ['monster-claw']);
});
