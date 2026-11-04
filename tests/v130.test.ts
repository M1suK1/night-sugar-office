import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';

test('v130 战报算式能自己算回「实际」：命中带 0.5 系数，伤害带护持与破防', () => {
  const state = createInitialState();
  const dispatched = act(state, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'mirror' }).state;
  const battle = act(dispatched, { type: 'advance', minutes: 180 }).state.battles[0]!;

  let checked = 0;
  for (const event of battle.events) {
    const calc = event.calc;
    if (!calc) continue;
    if (calc.hit && calc.hit.insight !== undefined) {
      const h = calc.hit;
      const expected = Math.max(15, Math.min(95, Math.round(h.base + (h.insight - h.targetAgility) * (h.factor ?? 0.5) + h.bonus)));
      assert.equal(Math.round(h.chance), expected, '命中率要能由算式算出');
      checked += 1;
    }
    const d = calc.damage;
    if (d && event.hit) {
      // raw 已经含减伤；实际伤害再乘护持/破防，再减护盾，最后不超过目标剩余血量。
      const scaled = Math.max(1, Math.round(d.raw * (d.guard ?? 1) * (d.broken ?? 1)));
      assert.ok(d.dealt <= scaled, `实际 ${d.dealt} 不应该大于换算值 ${scaled}`);
      assert.ok(d.raw >= 1 && d.dealt >= 0);
      checked += 1;
    }
  }
  assert.ok(checked > 0, '这一场至少要有一条带算式的战报');
});

test('v130 心防未破的血量伤害比满伤低，破防后会更高', () => {
  const state = createInitialState();
  const dispatched = act(state, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'mirror' }).state;
  const battle = act(dispatched, { type: 'advance', minutes: 180 }).state.battles[0]!;
  const guards = battle.events.map(event => event.calc?.damage?.guard).filter((value): value is number => typeof value === 'number');
  const brokens = battle.events.map(event => event.calc?.damage?.broken).filter((value): value is number => typeof value === 'number');
  assert.ok(guards.every(value => value === 0.7 || value === 1), '护持系数只能是 0.7 或 1');
  assert.ok(brokens.every(value => value === 1.4 || value === 1), '破防系数只能是 1.4 或 1');
});
