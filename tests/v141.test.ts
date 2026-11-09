import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { buildCost, clinicQuote } from '../src/rules/roster.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';

/** 把某个房间改到指定等级。 */
function withRoomLevel(state: ReturnType<typeof createInitialState>, type: 'dorm' | 'clinic' | 'observatory', level: number) {
  return { ...state, rooms: state.rooms.map(room => room.type === type ? { ...room, level } : room) };
}

test('v141 宿舍扩建价按折扣走（默认半价），其它设施不变', () => {
  const dorm2 = buildCost({ level: 2, type: 'dorm' });
  const clinic2 = buildCost({ level: 2, type: 'clinic' });
  assert.equal(clinic2, 2400 * 2, '其它设施还是原价');
  assert.equal(dorm2, Math.round(2400 * 2 * (1 - DEFAULT_BALANCE.dormBuildDiscountPct / 100)));
  assert.equal(dorm2, clinic2 / 2, '默认正好半价');

  const state = withRoomLevel(createInitialState(), 'dorm', 2);
  state.gold = 20000;
  const built = act(state, { type: 'build', roomId: state.rooms.find(room => room.type === 'dorm')!.id });
  assert.equal(built.ok, true, built.message);
  assert.equal(state.gold - built.state.gold, dorm2, '实际扣款和报价一致');
});

test('v141 星象台每升一级，远行队伍人数上限 +1', () => {
  const base = createInitialState();
  const girls = base.girls.filter(girl => !girl.retired && girl.status === 'idle').slice(0, 3).map(girl => girl.id);
  assert.equal(girls.length, 3);

  const low = withRoomLevel(base, 'observatory', 1);
  const rejected = act(low, { type: 'startExpedition', memberIds: girls });
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /1–2 人/);

  const high = withRoomLevel(base, 'observatory', 2);
  const accepted = act(high, { type: 'startExpedition', memberIds: girls });
  assert.equal(accepted.ok, true, accepted.message);
  assert.equal(accepted.state.expeditions[0]!.memberIds.length, 3);
});

test('v141 星象台每升一级，每人每小时收益 +50 星砂', () => {
  const run = (level: number) => {
    const base = withRoomLevel(createInitialState(), 'observatory', level);
    const girl = base.girls.find(item => !item.retired && item.status === 'idle')!;
    const started = act(base, { type: 'startExpedition', memberIds: [girl.id] });
    assert.equal(started.ok, true, started.message);
    const before = started.state.gold;
    const moved = act(started.state, { type: 'advance', minutes: 60 });
    return moved.state.gold - before;
  };
  const lv1 = run(1);
  const lv2 = run(2);
  assert.equal(lv1, 300, '1 级每人每小时 300');
  assert.equal(lv2, 300 + DEFAULT_BALANCE.expeditionGoldPerLevel, '2 级多 50');
});

test('v141 诊所每升一级：治疗速度 +10 血/小时、费用 −5%', () => {
  const state = createInitialState();
  const girl = { ...state.girls[0]!, hp: 40, maxHp: 100, baseMaxHp: 100, scars: [], conditions: [] } as typeof state.girls[number];
  const lv1 = clinicQuote(girl, false, 1);
  const lv4 = clinicQuote(girl, false, 4);
  assert.equal(lv1.perHour, DEFAULT_BALANCE.clinicHpPerHour);
  assert.equal(lv4.perHour, DEFAULT_BALANCE.clinicHpPerHour + 3 * DEFAULT_BALANCE.clinicHpPerHourPerLevel);
  assert.ok(lv4.minutes < lv1.minutes, '治得更快，占用时间更短');
  assert.ok(lv4.cost < lv1.cost, '同样的伤更便宜');
  assert.equal(lv4.cost, Math.round(lv1.cost * (1 - 3 * DEFAULT_BALANCE.clinicCostDiscountPerLevel / 100)));
});

test('v141 诊所等级也会让记忆重塑与复制契约变便宜', () => {
  const base = createInitialState();
  const girl = base.girls[0]!;
  girl.scars = [{ id: 'scar-1', name: '耳鸣', kind: 'mental', effect: { kind: 'hit', amount: 4 }, day: 14 }] as typeof girl.scars;

  const cheap = withRoomLevel({ ...base, gold: 30000 }, 'clinic', 4);
  const before = cheap.gold;
  const wiped = act(cheap, { type: 'clinic', girlId: girl.id, mode: 'wipe' });
  assert.equal(wiped.ok, true, wiped.message);
  const paid = before - wiped.state.gold;
  assert.ok(paid < 4000, `记忆重塑应打折，实际扣 ${paid}`);
  assert.equal(paid, Math.round(4000 * (1 - 3 * DEFAULT_BALANCE.clinicCostDiscountPerLevel / 100)));
});
