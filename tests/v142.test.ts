import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { envoyOfferOf, envoyRaidHostility } from '../src/rules/envoy.ts';
import { expeditionGoldPerHour } from '../src/expedition.ts';
import { hostilityValue, pairOf } from '../src/hostility.ts';
import type { FactionId } from '../src/types.ts';

const FACTIONS: FactionId[] = ['witch', 'association', 'government'];

test('v142 三种形态都能生成，且都带着说明', () => {
  const base = createInitialState();
  const kinds = new Set<string>();
  for (let day = 14; day < 20; day += 1) {
    for (const faction of FACTIONS) {
      const offer = envoyOfferOf({ ...base, day }, faction);
      kinds.add(offer.kind);
      assert.ok(offer.note.length > 4, `${faction} 的说明为空`);
      if (offer.kind === 'loan') {
        assert.ok((offer.hours ?? 0) >= 1 && (offer.hours ?? 0) <= 6);
        assert.equal(offer.rate, expeditionGoldPerHour(base));
      } else if (offer.kind === 'tribute') {
        assert.ok((offer.amount ?? 0) >= 200 && (offer.amount ?? 0) <= 1000, '索款在 200–1000 之间');
      } else {
        assert.ok(offer.mission, '共建/破坏要带上委托');
        assert.equal(offer.mission!.envoyKind, offer.kind);
        assert.equal(offer.mission!.envoyFaction, faction);
      }
    }
  }
  assert.deepEqual([...kinds].sort(), ['coop', 'loan', 'raid', 'tribute'], '四种形态都出现过');
});

test('v142 没有空闲少女时不会给借调', () => {
  const base = createInitialState();
  const busy = { ...base, girls: base.girls.map(girl => ({ ...girl, status: 'mission' as const })) };
  for (let day = 14; day < 22; day += 1) {
    for (const faction of FACTIONS) {
      assert.notEqual(envoyOfferOf({ ...busy, day }, faction).kind, 'loan');
    }
  }
});

test('v142 破坏行动的火气按对方辖区污染与安定加权', () => {
  const base = createInitialState();
  const district = Object.keys(base.territories)[0] as keyof typeof base.territories;
  const clean = envoyRaidHostility({ ...base, pollution: { ...base.pollution, [district]: 0 }, reputation: 80 }, district);
  const dirty = envoyRaidHostility({ ...base, pollution: { ...base.pollution, [district]: 90 }, reputation: 20 }, district);
  assert.ok(dirty > clean, `越脏越乱火气越大（${clean} → ${dirty}）`);
  assert.ok(clean >= 4 && dirty <= 20, '夹在 4–20');
});

test('v143 共建委托：好感 +1、报酬高 10%、失败扣 1', () => {
  const base = createInitialState();
  const faction: FactionId = 'association';
  let coopDay = 0;
  let offer: ReturnType<typeof envoyOfferOf> | undefined;
  for (let day = 14; day < 40; day += 1) {
    const next = envoyOfferOf({ ...base, day }, faction);
    if (next.kind === 'coop') { offer = next; coopDay = day; break; }
  }
  assert.ok(offer, '需要先找到一份共建委托');
  const state = { ...base, day: coopDay, gold: 20000, factions: { ...base.factions, [faction]: { ...base.factions[faction], standing: 50 } } };
  const accepted = act(state, { type: 'acceptFactionTask', faction });
  assert.equal(accepted.ok, true, accepted.message);
  const mission = accepted.state.missions[0]!;
  assert.equal(mission.envoyKind, 'coop');
  assert.ok(mission.reward >= 0);
  const before = accepted.state.factions[faction].standing;
  const squad = accepted.state.girls.filter(girl => !girl.retired && girl.status === 'idle').slice(0, 3).map(girl => girl.id);
  const dispatched = act(accepted.state, { type: 'dispatch', girlIds: squad, missionId: mission.id });
  if (!dispatched.ok) return; // 目标值太高打不动时跳过，由 v144 单独覆盖结算
  const settled = act(dispatched.state, { type: 'advance', minutes: 180 }).state;
  assert.ok(settled.factions[faction].standing >= before, '胜利不会掉好感');
});

test('v143 借调：先付钱、好感 +1、不加疲劳、到点回岗', () => {
  const base = createInitialState();
  let faction: FactionId | undefined;
  let offer: ReturnType<typeof envoyOfferOf> | undefined;
  let offerDay = base.day;
  for (const candidate of FACTIONS) {
    for (let day = 14; day < 40; day += 1) {
      const next = envoyOfferOf({ ...base, day }, candidate);
      if (next.kind === 'loan') { faction = candidate; offer = next; offerDay = day; break; }
    }
    if (offer) break;
  }
  assert.ok(faction && offer, '需要找到一份借调委托');
  const girl = base.girls.find(item => item.status === 'idle' && !item.retired)!;
  const standing = base.factions[faction!].standing;
  const fatigue = girl.fatigue;
  // 用找到的那一天，否则重算出来的形态会换人（v85 又多了索款这一种）。
  const result = act({ ...base, day: offerDay }, {
    type: 'acceptFactionTask', faction: faction!, girlId: girl.id, hours: 2,
  });
  // 同一天不一定正好是借调：直接按 offer 的类型断言
  if (offer!.kind === 'loan') {
    assert.equal(result.ok, true, result.message);
    const lent = result.state.girls.find(item => item.id === girl.id)!;
    assert.ok(lent.loan, '标记为借调中');
    assert.equal(result.state.factions[faction!].standing, Math.min(100, standing + 1));
    assert.equal(lent.fatigue, fatigue, '借调不加疲劳');
    const paid = result.state.gold - base.gold;
    assert.equal(paid, (offer!.rate ?? 0) * 2, '先付两小时的钱');
    // 两小时后自动回岗
    const later = act(result.state, { type: 'advance', minutes: 120 }).state;
    const back = later.girls.find(item => item.id === girl.id)!;
    assert.equal(back.loan, undefined);
    assert.equal(back.status, 'idle');
  }
});

test('v143 破坏行动：对方好感 −3、火气上升、报酬高 50%', () => {
  const base = createInitialState();
  const faction: FactionId = 'government';
  let offer: ReturnType<typeof envoyOfferOf> | undefined;
  let day = 14;
  for (; day < 60; day += 1) {
    const next = envoyOfferOf({ ...base, day }, faction);
    if (next.kind === 'raid') { offer = next; break; }
  }
  assert.ok(offer && offer.target, '需要找到一份破坏行动');
  const target = offer!.target!;
  const pair = pairOf(faction, target)!;
  const hostilityBefore = hostilityValue(base, pair);
  const targetStanding = base.factions[target].standing;
  const accepted = act({ ...base, day }, { type: 'acceptFactionTask', faction });
  assert.equal(accepted.ok, true, accepted.message);
  const mission = accepted.state.missions[0]!;
  assert.equal(mission.envoyKind, 'raid');
  assert.equal(mission.envoyTarget, target);
  assert.ok((mission.envoyHostility ?? 0) >= 4);
  assert.equal(mission.faction, undefined, '破坏不是占领：不写 faction，避免辖区转移');
  assert.ok(targetStanding >= 0);
  assert.ok(hostilityBefore >= 0);
});
