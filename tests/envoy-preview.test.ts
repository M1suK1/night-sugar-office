import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/game.ts';
import type { FactionRoster, GameState } from '../src/types.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { envoyPreviewOf } from '../src/rules/envoyPreview.ts';
import { envoyOfferOf } from '../src/rules/envoy.ts';
import { failurePenaltyFor } from '../src/missionPenalty.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';

const leader = customLeaderOf('witch', subjectOfCustom({
  id: 'L1', name: '青灯', factionTag: 'witch', level: 10, color: '#8a7bd6',
  portrait: '', stats: { magic: 70, insight: 62, agility: 55, empathy: 66 }, skillIds: [],
  title: '蚀月祭司', quote: '这一夜归我管。',
}));
const mate = customGirlOf('witch', subjectOfCustom({
  id: 'M1', name: '纸鸢', factionTag: 'witch', level: 8, color: '#8a7bd6',
  portrait: '', stats: { magic: 55, insight: 60, agility: 58, empathy: 62 }, skillIds: [],
  title: '提灯人', quote: '灯我来提。', codename: '纸鸢',
}));

const empty = (): FactionRoster => ({ leaderId: '', memberIds: [] });

function stateWith(): GameState {
  const base = createInitialState();
  return {
    ...base,
    customFactionLeaders: [leader],
    customFactionGirls: [mate],
    factionRoster: { association: empty(), government: empty(), witch: { leaderId: leader.id, memberIds: [mate.id] } },
  };
}

test('v167 委托预览：委托书、现场、收益、代价四段都算得出来', () => {
  const state = { ...stateWith(), gold: 5000 };
  const preview = envoyPreviewOf(state, 'witch');
  assert.equal(preview.faction, 'witch');
  assert.equal(preview.representative.name, '青灯');
  assert.ok(preview.kind, '要给出这一单是哪种形态');

  assert.ok(preview.field, '现场这一段必须有');
  assert.equal(typeof preview.field.pollution, 'number');
  assert.ok(preview.field.pollutionLabel.length > 0);
  assert.ok(preview.field.attitudeLabel.length > 0);

  assert.ok(preview.cost.length > 0, '代价不能空着');
  assert.ok(preview.gains.length > 0, '收益不能空着');
  if (preview.mission) assert.ok(preview.cost.includes('违约金'), preview.cost);

  if (preview.mission) {
    // 预览里的数字必须和真正的结算同源。
    const offer = envoyOfferOf(state, 'witch');
    assert.ok(offer.mission);
    const penalty = failurePenaltyFor(state, offer.mission!, DEFAULT_BALANCE);
    assert.ok(preview.cost.includes(String(penalty.gold)) || penalty.gold === 0, preview.cost);
    assert.equal(preview.mission.reward, offer.mission!.reward);
    assert.equal(preview.mission.recommendedLevel, offer.mission!.recommendedLevel);
  }
});

test('v167 委托预览：借调列出可以借的人，协调费给出金额与好感', () => {
  const state = { ...stateWith(), gold: 5000 };
  const preview = envoyPreviewOf(state, 'witch');
  if (preview.loan) {
    assert.ok(preview.loan.candidates.length > 0, '借调要能看到人选');
    assert.equal(preview.loan.pay, preview.loan.rate * preview.loan.hours);
  }
  if (preview.tribute) {
    assert.ok(preview.tribute.amount >= 0);
    assert.ok(preview.tribute.standing >= 0);
  }
  assert.ok(preview.loan || preview.tribute || preview.mission, '至少要给出一种可接的形式');
});

test('v167 委托预览：席位空缺时说清楚，不伪造委托', () => {
  const base = createInitialState();
  const preview = envoyPreviewOf({ ...base, customFactionLeaders: [], customFactionGirls: [] }, 'association');
  assert.equal(preview.vacant, true);
  assert.equal(preview.mission, undefined);
  assert.ok(preview.vacantNote.length > 0);
});
