import test from 'node:test';
import assert from 'node:assert/strict';
import { act, createInitialState } from '../src/game.ts';
import { DEFAULT_BALANCE } from '../src/balance.ts';
import { advancedCost, marketUpgradeCost } from '../src/economy.ts';
import { clinicQuote } from '../src/rules/roster.ts';
import { defaultOpinionOptions } from '../src/opinions.ts';
import { normalizeToLevel } from '../src/cardLibrary.ts';
import { envoyOfferOf } from '../src/rules/envoy.ts';
import { customGirlOf, factionGirlsOf, factionRepresentativeOf, subjectOfCustom, witchAwarePortrait } from '../src/factions.ts';
import { sanitizeCustomGirl } from '../src/rules/candidate.ts';
import type { GirlCard } from '../src/types.ts';

test('v145 借星砂：1 点安定换 300 星砂、每天最多 10 点、好感 −2', () => {
  const s = createInitialState();
  s.factions.witch.standing = 50;
  const before = { gold: s.gold, rep: s.reputation, standing: s.factions.witch.standing };
  const once = act(s, { type: 'borrowStability', faction: 'witch', points: 4 });
  assert.equal(once.ok, true, once.message);
  assert.equal(once.state.gold, before.gold + 4 * DEFAULT_BALANCE.factionLoanPerPoint);
  assert.equal(once.state.reputation, before.rep - 4);
  assert.equal(once.state.factions.witch.standing, before.standing - DEFAULT_BALANCE.factionLoanStandingCost);
  // 同一个势力当天不能再借
  assert.equal(act(once.state, { type: 'borrowStability', faction: 'witch', points: 1 }).ok, false);
  // 但别的势力可以，且合计不超过每日上限
  const other = act(once.state, { type: 'borrowStability', faction: 'government', points: 6 });
  assert.equal(other.ok, true, other.message);
  assert.equal(act(other.state, { type: 'borrowStability', faction: 'association', points: 1 }).ok, false, '超过每日 10 点');
});

test('v145 借星砂要好感 ≥ 30', () => {
  const s = createInitialState();
  s.factions.witch.standing = 10;
  assert.equal(act(s, { type: 'borrowStability', faction: 'witch', points: 2 }).ok, false);
});

test('v145 索款：给钱换好感，每 200 换 1 点', () => {
  const base = createInitialState();
  base.gold = 5000;
  let day = base.day;
  for (let probe = base.day; probe < base.day + 40; probe += 1) {
    if (envoyOfferOf({ ...base, day: probe }, 'association').kind === 'tribute') { day = probe; break; }
  }
  const s = { ...base, day };
  const offer = envoyOfferOf(s, 'association');
  assert.equal(offer.kind, 'tribute', '需要先找到一份索款');
  const amount = offer.amount!;
  const standing = s.factions.association.standing;
  const paid = act(s, { type: 'acceptFactionTask', faction: 'association', amount });
  assert.equal(paid.ok, true, paid.message);
  assert.equal(paid.state.gold, s.gold - amount);
  assert.equal(paid.state.factions.association.standing, Math.min(100, standing + Math.floor(amount / 200)));
});

test('v145 高级招聘可以从卡库提人，等级归一到指定档', () => {
  const s = createInitialState();
  s.gold = 20000; s.reputation = 30;
  const card: GirlCard = {
    girl: {
      name: '图书馆的夜灯', codename: 'lamp', title: '不睡的人', element: '', color: '#8a7fb8',
      archetype: '输出', level: 9, stats: { magic: 60, insight: 40, agility: 40, empathy: 40 },
      skillIds: ['moon-slash', 'moon-guard', 'moon-ult'], traitIds: [], appearance: '', personality: '', voice: {},
      quote: '', goal: '', factionTag: 'witch',
    },
  } as unknown as GirlCard;
  const normalized = normalizeToLevel(card.girl, 3);
  assert.equal(normalized.level, 3);
  assert.ok(normalized.stats.magic < card.girl.stats.magic, '等级降下来属性也跟着降');

  const before = s.candidates.length;
  const result = act(s, { type: 'advancedRecruit', level: 3, cards: [{ ...card, girl: normalized }] });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.state.candidates.length, before + 1);
  assert.equal(result.state.candidates[0].name, '图书馆的夜灯');
  assert.equal(result.state.candidates[0].level, 3);
  assert.equal(result.state.gold, s.gold - advancedCost(3).gold);
});

test('v145 高价招聘与市场升级新价目', () => {
  assert.equal(advancedCost(1).gold, 600);
  assert.equal(advancedCost(6).gold, 3600);
  assert.equal(marketUpgradeCost(3), 12000);
});

test('v145 诊所每点血 5 星砂、每小时回 30 血', () => {
  const s = createInitialState();
  const girl = s.girls[0];
  girl.hp = 30;
  const quote = clinicQuote(girl);
  assert.equal(quote.missing, girl.maxHp - 30);
  assert.equal(quote.cost, DEFAULT_BALANCE.clinicBase + quote.missing * DEFAULT_BALANCE.clinicPerHp);
  assert.equal(quote.minutes, Math.ceil(quote.missing / DEFAULT_BALANCE.clinicHpPerHour) * 60);
});

test('v145 经费议案是给钱的类型，代价压在疲劳与羁绊上', () => {
  const options = defaultOpinionOptions('经费', { authorId: 'yue', authorName: '月', faction: 'witch' });
  const accept = options.find(option => option.id === 'accept')!;
  const gold = accept.changes.filter(change => change.kind === 'gold');
  assert.equal(gold.length, 1);
  assert.ok((gold[0] as { amount: number }).amount > 0, '批准后是收入');
  assert.ok(accept.changes.some(change => change.kind === 'girl' && (change as { field: string }).field === 'fatigue'));
});

test('v145 月蚀庭的首领与随从默认魔女形态，玩家的月蚀庭角色不受影响', () => {
  const s = createInitialState();
  const representative = factionRepresentativeOf(s, 'witch');
  assert.equal(representative.witch, true, '月蚀庭首领默认魔女形态');
  assert.equal(factionRepresentativeOf(s, 'association').witch, undefined);
  for (const girl of factionGirlsOf('witch')) assert.equal(girl.witch, true, girl.name + ' 默认魔女形态');
  for (const girl of factionGirlsOf('association')) assert.notEqual(girl.witch, true);
  // 玩家自己名册里的月蚀庭角色不跟着变
  const own = s.girls.find(girl => girl.factionTag === 'witch');
  if (own) assert.equal(Boolean(own.witch), false);
});

test('v145 编进月蚀庭的人默认魔女形态，卡上的魔女化立绘跟着进名册', () => {
  const portrait = 'data:image/png;base64,AAAA';
  const witchPortrait = 'data:image/png;base64,BBBB';
  const witchForm = { id: 'witchform', form: 'witch' as const, name: '夜之形', description: '', palette: ['#2a1524'], layerKey: 'witch', portrait: witchPortrait };
  const subject = subjectOfCustom({
    id: 'card-demo', name: '夜莺', factionTag: 'witch', level: 4, color: '#b98ad9',
    portrait, stats: { magic: 40, insight: 40, agility: 40, empathy: 40 },
    skillIds: ['moon-slash', 'moon-guard', 'moon-ult'], codename: 'nightingale', witchForm,
  });
  const inWitch = customGirlOf('witch', subject);
  assert.equal(inWitch.witch, true, '月蚀庭的人默认魔女形态');
  assert.equal(witchAwarePortrait(inWitch), witchPortrait, '魔女形态优先用魔女化立绘');
  const inAssociation = customGirlOf('association', subject);
  assert.equal(inAssociation.witch, undefined, '别的势力不沾这条');
  assert.equal(witchAwarePortrait(inAssociation), portrait);

  // 存档往返：witchForm 不能被洗掉
  const kept = sanitizeCustomGirl({ ...inWitch }, 'witch', 'card-demo');
  assert.ok(kept);
  assert.equal(kept!.witchForm?.portrait, witchPortrait);
  assert.equal(kept!.witch, true);
});
