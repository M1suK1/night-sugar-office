import test from 'node:test';
import assert from 'node:assert/strict';
import { girlSkillPool, isPoolSkill, pickCandidateSkills } from '../src/skills.ts';
import { findSkill } from '../src/content/skills.ts';
import { makeCandidate } from '../src/rules/candidate.ts';
import { createInitialState } from '../src/game.ts';

test('v162 程序生成的少女：一基础 / 一本职 / 一奥义，且不重复', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const ids = pickCandidateSkills(seed, '星光系');
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    for (const id of ids) assert.ok(isPoolSkill(id), id);
    const tiers = ids.map(id => findSkill(id)?.tier).sort();
    assert.deepEqual(tiers, ['basic', 'signature', 'ultimate']);
  }
});

test('v162 同一 seed 结果固定，不同 seed 会换组合', () => {
  assert.deepEqual(pickCandidateSkills(42, '月影系'), pickCandidateSkills(42, '月影系'));
  const sets = new Set(Array.from({ length: 20 }, (_, index) => pickCandidateSkills(index + 1, '星光系').join(',')));
  assert.ok(sets.size >= 8, '20 个种子应该产生多种组合，实际 ' + sets.size);
});

test('v162 通用与魔物技能也在可抽取范围内', () => {
  const schools = new Set();
  for (let seed = 1; seed <= 400; seed += 1) {
    for (const id of pickCandidateSkills(seed, '糖霜系')) schools.add(findSkill(id)?.school);
  }
  assert.ok(schools.has('通用'), '应该能抽到通用技能');
  assert.ok(schools.has('魔物'), '应该能抽到魔物技能');
  assert.ok(schools.has('糖霜系'), '元素流派仍然优先出现');
});

test('v162 魔物 / 通用技能在自定义登记里也合法', () => {
  assert.ok(girlSkillPool().some(skill => skill.school === '魔物'));
  assert.ok(girlSkillPool().some(skill => skill.school === '通用'));
  assert.equal(isPoolSkill('monster-claw'), true);
  assert.equal(isPoolSkill('plain-strike'), true);
});

test('v162 makeCandidate 不再按职阶发同一套技能', () => {
  const state = createInitialState();
  const combos = new Set(Array.from({ length: 8 }, (_, index) => makeCandidate(state, 3, index * 17).skills.join(',')));
  assert.ok(combos.size >= 4, '8 个候选应该有多套技能，实际 ' + combos.size);
  for (const combo of combos) {
    const ids = combo.split(',');
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    for (const id of ids) assert.ok(isPoolSkill(id), id);
  }
  assert.ok(!combos.has('glimmer-spear,peach-ward,starlight-fall') || combos.size > 1);
});
