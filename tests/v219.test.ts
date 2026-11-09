import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateBattle } from '../src/combat.ts';
import { createInitialState } from '../src/game.ts';
import { getMonster } from '../src/content/monsters.ts';

const setup = (buffs?: (string | null)[], rules: { trigger: 'always'; effect: 'buff'; stat: 'agility'; amount: number }[] = []) => {
  const initial = createInitialState();
  const girl = initial.girls.find(entry => !entry.retired) ?? initial.girls[0]!;
  const base = getMonster('mirror-nun');
  const mission = { ...initial.missions[0]!, id: 'rule-buff', title: '特性测试', enemyIds: ['custom-monster-rule01'], enemyBuffs: buffs, rounds: 4, duration: 120, work: 'combat' as const };
  return simulateBattle({
    mission,
    girls: [girl],
    day: 1,
    minutes: 1200,
    monsters: [{ ...base, id: 'custom-monster-rule01', name: '测试靶', maxHp: 800, stats: { magic: 8, insight: 8, agility: 8, empathy: 8 }, rules }],
  });
};

test('v219 常驻 buff 在战斗单位建立时生效', () => {
  const battle = setup(undefined, [{ trigger: 'always', effect: 'buff', stat: 'agility', amount: 6 }]);
  const enemy = battle.units.find(unit => unit.monster?.id === 'custom-monster-rule01');
  assert.ok(enemy);
  assert.equal(enemy!.stats.agility, 14, '8 + 6');
});

test('v219 夜行的常驻敏捷真的加在精英身上', () => {
  const battle = setup(['elite-night']);
  const enemy = battle.units.find(unit => unit.monster?.id === 'custom-monster-rule01');
  assert.ok(enemy);
  assert.equal(enemy!.stats.agility, 16, '8 × 1.3 → 10，再 +6');
});
