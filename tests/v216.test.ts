import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';

const lampCard = (appearance = '') => ({
  girl: {
    name: '图书馆的夜灯', codename: 'lamp', title: '不睡的人', element: '', color: '#b98ad9', archetype: '输出',
    level: 4, stats: { magic: 50, insight: 40, agility: 40, empathy: 40 },
    skillIds: ['moon-slash', 'moon-guard', 'moon-ult'], traitIds: [], appearance, personality: '',
    voice: {}, quote: '', goal: '', factionTag: 'witch',
  },
}) as never;

test('v216 控制台直接契约：候选名册里的卡也能契约', () => {
  const card = lampCard();
  const seeded = act(createInitialState(), { type: 'importCard', card });
  assert.equal(seeded.ok, true, seeded.message);
  const before = seeded.state.candidates.length;
  const result = act(seeded.state, { type: 'debugContractCard', card });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.candidates.length, before - 1, '候选移进事务所');
  assert.ok(result.state.girls.some(girl => girl.name === '图书馆的夜灯'));
});

test('v216 控制台直接契约：已经契约过的卡再跑一次不报错', () => {
  const card = lampCard();
  const first = act(createInitialState(), { type: 'debugContractCard', card });
  assert.equal(first.ok, true, first.message);
  const second = act(first.state, { type: 'debugContractCard', card });
  assert.equal(second.ok, true, second.message);
  assert.match(second.message, /已经在事务所名册里/);
  assert.equal(second.state.girls.filter(girl => girl.name === '图书馆的夜灯').length, 1);
});

test('v216 控制台直接契约：卡面更新后仍能把候选移进名册', () => {
  const seeded = act(createInitialState(), { type: 'importCard', card: lampCard() });
  assert.equal(seeded.ok, true, seeded.message);
  const result = act(seeded.state, { type: 'debugContractCard', card: lampCard('换了一身外套。') });
  assert.equal(result.ok, true, result.message);
  const girl = result.state.girls.find(item => item.name === '图书馆的夜灯');
  assert.ok(girl);
  assert.equal(girl!.appearance, '换了一身外套。');
});
