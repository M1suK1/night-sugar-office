import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { hitChanceOf, initiativeOf, speedOf } from '../src/combat.ts';
import { HP_PER_LEVEL, POINTS_PER_LEVEL, allocatePoint, expNeeded, grantExp } from '../src/progression.ts';
import type { BattleUnit, Skill } from '../src/types.ts';

const unit = (side: 'ally' | 'enemy', stats: Record<'magic' | 'insight' | 'agility' | 'empathy', number>): BattleUnit => ({
  uid: `u-${side}`, side, name: side, portrait: '', color: '#fff',
  hp: 100, maxHp: 100, spirit: 0, maxSpirit: 0, stats,
  skills: [], cooldown: {}, effects: [], down: false, insightRoll: 0, scarHit: 0,
  dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
});
const single = { id: 's1', name: '测试', targets: 1, side: 'enemy' } as unknown as Skill;
const stats = (magic: number, insight: number, agility: number, empathy = 40) => ({ magic, insight, agility, empathy });

test('v33 命中由洞察对敏捷计算，不加基础补偿', () => {
  const even = hitChanceOf(unit('ally', stats(50, 50, 50)), unit('enemy', stats(50, 50, 50)), single);
  assert.equal(even.chance, 50, '同属性对拼就是技能基础命中');
  const sharp = hitChanceOf(unit('ally', stats(50, 90, 50)), unit('enemy', stats(50, 50, 50)), single);
  assert.equal(sharp.chance, 70);
  const blind = hitChanceOf(unit('ally', stats(50, 10, 50)), unit('enemy', stats(50, 90, 90)), single);
  assert.equal(blind.chance, 15, '低洞察对高敏捷触底 15%');
  assert.equal(sharp.insight, 90);
  assert.equal(sharp.targetAgility, 50);
});

test('v33 先手只看敏捷，洞察不再影响排序', () => {
  const fast = unit('ally', stats(50, 10, 70));
  const clever = unit('enemy', stats(50, 90, 40));
  assert.equal(speedOf(fast), 70);
  assert.equal(speedOf(clever), 40);
  assert.ok(initiativeOf(fast, 0) > initiativeOf(clever, 20));
  fast.effects = [{ kind: 'buff', stat: 'initiative', amount: 5, duration: 1, source: '测试', remaining: 1 }];
  assert.equal(speedOf(fast), 75);
});

test('v33 手动升级发 10 点、血量 +10，自动模式主 6 副 4', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  const magic = girl.stats.magic;
  const hp = girl.maxHp;
  girl.exp = expNeeded(girl.level) - 1;
  const up = grantExp(girl, 2, 'manual');
  assert.equal(up.leveled, true);
  assert.equal(girl.unspentPoints, POINTS_PER_LEVEL);
  assert.equal(girl.maxHp, hp + HP_PER_LEVEL);
  assert.equal(girl.stats.magic, magic, '手动模式不自动加属性');

  const auto = { ...girl, unspentPoints: 0, stats: { ...girl.stats } };
  auto.exp = expNeeded(auto.level) - 1;
  const before = auto.stats.magic;
  grantExp(auto, 2, 'auto');
  assert.equal(auto.unspentPoints, 0);
  assert.ok(auto.stats.magic > before, '自动模式仍会加主属性');
});

test('v33 加点扣点、封顶 120，并重算心防', () => {
  const state = createInitialState();
  const girl = state.girls[0]!;
  girl.unspentPoints = 3;
  const empathyBefore = girl.stats.empathy;
  const applied = act(state, { type: 'allocateStat', girlId: girl.id, stat: 'empathy' });
  assert.equal(applied.ok, true, applied.message);
  const after = applied.state.girls[0]!;
  assert.equal(after.stats.empathy, empathyBefore + 1);
  assert.equal(after.unspentPoints, 2);
  assert.ok(after.maxSpirit >= girl.maxSpirit, '共情提高后心防跟着重算');

  const none = act({ ...applied.state, girls: applied.state.girls.map(g => g.id === girl.id ? { ...g, unspentPoints: 0 } : g) }, { type: 'allocateStat', girlId: girl.id, stat: 'magic' });
  assert.equal(none.ok, false);

  const capped = allocatePoint({ ...girl, unspentPoints: 5, stats: { ...girl.stats, magic: 120 } }, 'magic');
  assert.equal(capped.ok, false, '四维上限 120');
});

test('v33 新档默认手动加点，旧档迁移为自动', () => {
  const state = createInitialState();
  assert.equal(state.levelUpMode, 'manual');
  assert.equal(state.notices?.length, 0);
  const switched = act(state, { type: 'setLevelUpMode', mode: 'auto' });
  assert.equal(switched.ok, true);
  assert.equal(switched.state.levelUpMode, 'auto');
});

test('v33 完成委托会留下提示，并被通知中心读到', () => {
  const state = createInitialState();
  for (const girl of state.girls) { girl.maxHp = 9999; girl.hp = 9999; girl.stats.magic = 400; }
  const target = state.missions.find(m => m.id === 'station')!;
  target.rounds = 3;
  const dispatched = act(state, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'station' });
  assert.equal(dispatched.ok, true, dispatched.message);
  const settled = act(dispatched.state, { type: 'advance', minutes: 60 }).state;
  const notices = settled.notices ?? [];
  assert.ok(notices.some(notice => notice.kind === 'mission' && notice.title.includes('委托完成')), '胜利要写一条委托完成提示');
});
