import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateBattle } from '../src/combat.ts';
import { createInitialState } from '../src/game.ts';
import { getMonster } from '../src/content/monsters.ts';

const setup = (buffs?: (string | null)[], rules: { trigger: 'roundStart'; effect: 'dot'; amount: number; duration: number }[] = []) => {
  const initial = createInitialState();
  const girl = initial.girls.find(entry => !entry.retired) ?? initial.girls[0]!;
  const base = getMonster('mirror-nun');
  const mission = { ...initial.missions[0]!, id: 'rule-dot', title: '特性测试', enemyIds: ['custom-monster-rule01'], enemyBuffs: buffs, rounds: 4, duration: 120, work: 'combat' as const };
  return simulateBattle({
    mission,
    girls: [girl],
    day: 1,
    minutes: 1200,
    monsters: [{ ...base, id: 'custom-monster-rule01', name: '测试靶', maxHp: 800, stats: { magic: 8, insight: 8, agility: 8, empathy: 8 }, rules }],
  });
};

test('v220 每轮开始的持续伤害会落到对侧队伍', () => {
  const battle = setup(undefined, [{ trigger: 'roundStart', effect: 'dot', amount: 3, duration: 2 }]);
  const dots = battle.events.filter(event => event.skillId === 'dot' && event.actor === '测试靶');
  assert.ok(dots.length > 0, '应该打出持续伤害');
  assert.ok(dots.every(event => event.targets.every(target => target !== '测试靶')), '不烧自己');
});

test('v220 结症的每轮持续伤害真的生效', () => {
  const battle = setup(['elite-plague']);
  const dots = battle.events.filter(event => event.skillId === 'dot' && event.actor.includes('结症'));
  assert.ok(dots.length > 0, '结症应该施加持续伤害');
});
