import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from '../src/rules/act.ts';
import { createInitialState } from '../src/game.ts';
import { drugTick, reconcileWitch, shouldBeWitch, suppressWitchWithDrug } from '../src/rules/conditions.ts';
import { loadState } from '../src/rules/persistence.ts';

/**
 * v252：抑制剂要真的把人从魔女化里放出来。
 *
 * 规则：侵蚀不超过 70 时用抑制剂 → 立刻退出魔女化、换回普通立绘；
 * 药效过期后侵蚀仍在魔女化阈值（默认 40）以上 → 重新锁成魔女化。
 * 70 以上是不可逆阶段，药只能续命。
 */

function setup(options: { corruption: number; witch?: boolean; drugUntilDay?: number; stock?: number }) {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = options.witch ?? true;
  girl.corruption = options.corruption;
  girl.drugUntilDay = options.drugUntilDay;
  girl.withdrawalDays = 0;
  girl.hp = Math.max(1, Math.round(girl.maxHp / 2));
  state.inventory['moon-drug'] = options.stock ?? 3;
  return { state, girl };
}

test('v252 诊所注射：侵蚀 55 的魔女立刻退出魔女化，立绘回普通形态', () => {
  const { state, girl } = setup({ corruption: 55 });
  const result = act(state, { type: 'useItem', girlId: girl.id, itemId: 'moon-drug' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(entry => entry.id === girl.id)!;
  assert.equal(after.witch, false, '注射之后不该继续锁在魔女化形态');
  assert.equal(result.state.inventory['moon-drug'], 2, '要消耗一支');
  assert.ok((after.drugUntilDay ?? 0) > result.state.day, '压制期要往后推');
  assert.match(result.message ?? '', /普通形态|退出/);
});

test('v252 诊所注射：越过 70 只能续命，形态仍然是魔女', () => {
  const { state, girl } = setup({ corruption: 78 });
  const result = act(state, { type: 'useItem', girlId: girl.id, itemId: 'moon-drug' });
  assert.equal(result.ok, true, '越过 70 仍然要能用药续命');
  const after = result.state.girls.find(entry => entry.id === girl.id)!;
  assert.equal(after.witch, true, '不可逆阶段压不回去');
  assert.equal(result.state.inventory['moon-drug'], 2);
  assert.ok((after.drugUntilDay ?? 0) > result.state.day);
});

test('v252 弹窗里「压回形态」在越过 70 时直接拒绝，不白扣一支', () => {
  const { state, girl } = setup({ corruption: 78 });
  const result = act(state, { type: 'suppressWitch', girlId: girl.id });
  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /续命|记忆重塑/);
  assert.equal(result.state.inventory['moon-drug'], 3);
  assert.equal(result.state.girls.find(entry => entry.id === girl.id)?.witch, true);
});

test('v252 压制期内再注射只延长压制期，形态不动', () => {
  const { state, girl } = setup({ corruption: 50, witch: false, drugUntilDay: 12, stock: 2 });
  // 假设今天是第 5 日：剩 7 日
  const shifted = { ...state, day: 5 };
  const target = shifted.girls.find(entry => entry.id === girl.id)!;
  target.drugUntilDay = 12;
  const result = act(shifted, { type: 'useItem', girlId: girl.id, itemId: 'moon-drug' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(entry => entry.id === girl.id)!;
  assert.equal(after.witch, false);
  assert.equal(after.drugUntilDay, 15, '压制期应延长到 5 + 10');
  assert.equal(result.state.inventory['moon-drug'], 1);
});

test('v252 药效过期、侵蚀仍在阈值以上 → 重新锁成魔女化', () => {
  const { state, girl } = setup({ corruption: 45, witch: false, drugUntilDay: 10, stock: 0 });
  const shifted = { ...state, day: 10 };
  const target = shifted.girls.find(entry => entry.id === girl.id)!;
  drugTick(shifted, target);
  assert.equal(target.witch, true, '药效过期后侵蚀还过线，要重新锁定');
});

test('v252 药效过期但侵蚀已降到阈值以下 → 不会重新锁定', () => {
  const { state, girl } = setup({ corruption: 30, witch: false, drugUntilDay: 10, stock: 0 });
  const shifted = { ...state, day: 10 };
  const target = shifted.girls.find(entry => entry.id === girl.id)!;
  drugTick(shifted, target);
  assert.equal(target.witch, false, '侵蚀已经安全，不该再锁');
});

test('v252 药效过期当天仓库有药：自动灌一支，并保持普通形态', () => {
  const { state, girl } = setup({ corruption: 52, witch: true, drugUntilDay: 10, stock: 1 });
  const shifted = { ...state, day: 10 };
  const target = shifted.girls.find(entry => entry.id === girl.id)!;
  drugTick(shifted, target);
  assert.equal(shifted.inventory['moon-drug'], 0);
  assert.equal(target.witch, false, '自动续药同样是压制，应当回到普通形态');
  assert.equal(target.drugUntilDay, 20);
});

test('v252 压制中不会因为日结被重新锁上（药效还没过期）', () => {
  const { state, girl } = setup({ corruption: 60, witch: false, drugUntilDay: 20, stock: 0 });
  const shifted = { ...state, day: 15 };
  const target = shifted.girls.find(entry => entry.id === girl.id)!;
  drugTick(shifted, target);
  assert.equal(target.witch, false);
  assert.equal(target.withdrawalDays, 0);
});

test('v252 共享压制函数：仓库没药时直接拒绝，形态不变', () => {
  const { state, girl } = setup({ corruption: 44, stock: 0 });
  const result = suppressWitchWithDrug(state, girl);
  assert.equal(result.ok, false);
  assert.equal(girl.witch, true);
});

test('v252 净化把侵蚀压回线下：立绘立刻恢复普通形态', () => {
  const { state, girl } = setup({ corruption: 45, witch: true, stock: 0 });
  state.inventory['purify-course'] = 3;
  const result = act(state, { type: 'useItem', girlId: girl.id, itemId: 'purify-course' });
  assert.equal(result.ok, true, result.message);
  const after = result.state.girls.find(entry => entry.id === girl.id)!;
  assert.equal(after.corruption, 37);
  assert.equal(after.witch, false, '侵蚀掉到线下就该退出魔女化');
});

test('v252 越过 70 就是不可逆：有药压着也仍然是魔女形态', () => {
  const { state, girl } = setup({ corruption: 80, witch: false, stock: 3 });
  girl.drugUntilDay = state.day + 10;
  assert.equal(shouldBeWitch(state, girl), true);
  assert.equal(reconcileWitch(state, girl), true);
  assert.equal(girl.witch, true);
});

test('v252 形态由侵蚀与药效共同决定：对齐函数覆盖四种组合', () => {
  const { state, girl } = setup({ corruption: 45, witch: false, stock: 0 });
  assert.equal(shouldBeWitch(state, girl), true, '过线又没药 → 该锁');
  girl.drugUntilDay = state.day + 5;
  assert.equal(shouldBeWitch(state, girl), false, '过线但有药 → 不锁');
  girl.corruption = 30;
  assert.equal(shouldBeWitch(state, girl), false, '线下 → 不锁');
  girl.corruption = 70;
  assert.equal(shouldBeWitch(state, girl), true, '不可逆 → 锁');
});

test('v252 读档时把「侵蚀已降下来却还锁着」的旧档修回普通形态', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.witch = true;
  girl.corruption = 28;
  girl.drugUntilDay = state.day + 4;
  const loaded = loadState(JSON.stringify(state));
  const after = loaded.girls.find(entry => entry.id === girl.id)!;
  assert.equal(after.witch, false);
});
