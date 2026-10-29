import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, act, loadState, importState, capacity, chance, squadChance, squadLimit, inWithdrawal, makeFactionStock, WARDROBE_LIMIT, annotateMission, buildTemplateArc, clinicQuote, completeStoryMission, customOutfitFor, dateLabel, deployIncidentCard, deployMissionTemplate, missionTemplates, pickPoolIncidentCard, resolveStoryWait, spawnStoryBeat, treatmentFor } from '../src/game.ts';
import { districtAt, districtOrder, districts, effectLines } from '../src/districts.ts';
import { LONG_MAX_DAYS, LONG_MIN_DAYS, SHIFT_END, SHIFT_START, WAVE_AT, clockLabel, deadlineFor, shiftPhase, shiftCloseAt } from '../src/shift.ts';
import { FACTION_ORDER, TERRITORY_LIMIT, assignTerritories, canClaim, effectiveDistrictEffect, factionEffect, ownedDistricts, repairTerritories, territoryCounts } from '../src/territories.ts';
import { DEFAULT_PRESET_BINDING, DEFAULT_PROMPTS, PROMPT_TASK_SCOPES, activePrompts, applyFormat, applyRegexScripts, builtinPresets, composeTaskSystem, ensureTaskPresets, expandPresetMacros, pickRegexScripts, promptHasMechanicBan, promptScopeLabel, stripMechanicBan, resolvePresetConfig, exportPresetJson, importPresetJson, importPresetObject, loadPresets, normalizeBinding, presetPrompts, presetRuntime, promptScope, promptTokens, renderPresetSystem, withPresetPrompts, type ChatPreset } from '../src/presets.ts';
import { playerSummary } from '../src/player.ts';
import { effectiveStats } from '../src/economy.ts';
import { statsForArchetype } from '../src/content/archetypes.ts';
import { battleExp, expNeeded, grantExp } from '../src/progression.ts';
import { REMOTE_CALL_COST, pensionFor } from '../src/contracts.ts';
import { generateBattleNote, generateDaily, generateDialogue, generateGirlProfile, generateOutfitDescription, generateStoryArc, generateStoryBlueprint, requestSnapshot } from '../src/llm.ts';
import { materializeNightProposal, validateNightProposal, type NightProposalV2 } from '../src/llm-night.ts';
import { buildGirlCard, girlCardHash, parseGirlCard } from '../src/cards.ts';
import { EXPRESSIONS, expressionVariantKey } from '../src/expressions.ts';
import { readWardrobePackage } from '../src/wardrobeImport.ts';
import { fallbackStoryPlan, playableStoryPlan, sanitizeStoryPlan, storyPlanTemplate } from '../src/storyplan.ts';
import { effectText, skills, getSkill, findSkill } from '../src/content/skills.ts';
import { EFFECT_CATEGORIES, skillEffectPresets } from '../src/content/effectPresets.ts';
import { getItem, findItem } from '../src/content/items.ts';
import { getMonster, findMonster } from '../src/content/monsters.ts';
import { initiativeOf, simulateBattle } from '../src/combat.ts';
import { battleActors, battleCast, battleDigest, battleNoteChars, buildBattleBrief, totalBattleRounds, validateBattleNoteDraft } from '../src/battleNote.ts';
import { applyLibrary, contentUsage, customMissionTemplates, emptyCombatMission, emptyInvestigationMission, emptyLibrary, emptyMission, exportContentPack, mergeContentPack, readContentPack, ruleText, sanitizeIncidentCard, sanitizeItem, sanitizeLibrary, sanitizeMission, sanitizeMonster, sanitizeSkill, withCustomStock, CONTENT_PACK_FORMAT } from '../src/content/library.ts';
import { defaultOpinionDialogue, defaultOpinionOptions, previewOpinionOption, resolveOpinionDialogue } from '../src/opinions.ts';
import { blueprintIssues, buildGraphFromDraft, compileBeatsToGraph, layoutStoryGraph, makeNode, validateGraph, type StoryGraphDraft } from '../src/storygraph.ts';
import { WORLDBOOK_KEY, builtinWorldbook, defaultWorldbook, exportWorldbookJson, importWorldbookJson, loadWorldbook, officeWorldbookEntry, sanitizeWorldbookEntry, saveWorldbook, syncOfficeWorldbook, worldbookContext } from '../src/worldbook.ts';
import { BALANCE_FIELDS, DEFAULT_BALANCE, clearBalanceCache, sanitizeBalance } from '../src/balance.ts';
import { POLLUTION_MAX, POLLUTION_MIN, clampPollution, cityAveragePollution, dirtiestDistrict, initialPollution, mergeDistrictEffects, pollutionDailyRise, pollutionEffect, pollutionForecast, pollutionIsEstimated, pollutionPenalty, pollutionRelief, pollutionSnapshotOf, pollutionTier, pollutionTierLabel, repairPollution } from '../src/pollution.ts';
import { EMPLOYER_LABEL, FACTION_PURIFICATION, canIntercept, factionBrief, factionDossiers, factionGirlsOf, factionLeader, factionPurification, factionRelationLine, factionTagColor, factionTagFor, factionTagLabel, girlFactionLabels, isGirlFaction, sanitizeGirlFaction } from '../src/factions.ts';
import { DEFAULT_OFFICE_PROFILE, OFFICE_LIMITS, OFFICE_WORLDBOOK_ID, officeWorldbookContent, representativeOf, sanitizeOfficeProfile } from '../src/office.ts';
import type { DistrictId } from '../src/districts.ts';
import type { FactionId, GameState, GirlFaction, Incident, Mission, OfficeProfile, Opinion, Outfit, Scar, StoryGraph, Storyline } from '../src/types.ts';

const blueprintDraft = (): StoryGraphDraft => ({
  nodes: [
    { id: 'n1', kind: 'start', title: '开始', data: { kind: 'start' } },
    { id: 'n2', kind: 'scene', title: '夜班门口', data: { kind: 'scene', narration: '门铃响了两下，她站在雨里，没有先开口。' } },
    {
      id: 'n3', kind: 'choice', title: '她停在门口', data: {
        kind: 'choice', prompt: '让她进来，还是先把门关上？',
        options: [
          { id: 'a', label: '让她进来', intent: '先接住她', effect: { bond: 2 } },
          { id: 'b', label: '先关门', intent: '把话留到明天', effect: { corruption: 1 } },
        ],
      },
    },
    { id: 'n4', kind: 'scene', title: '热水', data: { kind: 'scene', narration: '热水冒着白气，她把杯子握得很紧。' } },
    {
      id: 'n5', kind: 'mission', title: '旧城区', data: {
        kind: 'mission', spec: { title: '送信', goal: '陪她把信送到旧城区。', category: '故事委托', difficulty: '常规', duration: 90, requirement: 'empathy' },
      },
    },
    { id: 'n6', kind: 'reward', title: '信的回声', data: { kind: 'reward', effect: { bond: 3 } } },
    { id: 'n7', kind: 'end', title: '门开着', data: { kind: 'end', summary: '她留下了。' } },
    { id: 'n8', kind: 'end', title: '门关着', data: { kind: 'end', summary: '雨声替她回答。' } },
  ],
  edges: [
    { from: 'n1', to: 'n2' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', fromPort: 'a', to: 'n4' },
    { from: 'n3', fromPort: 'b', to: 'n5' },
    { from: 'n4', to: 'n6' },
    { from: 'n5', fromPort: 'success', to: 'n6' },
    { from: 'n5', fromPort: 'failure', to: 'n7' },
    { from: 'n6', to: 'n8' },
  ],
});

const nightProposal = (): NightProposalV2 => ({
  version: 2,
  monster: {
    name: '纸月', epithet: '被折起来的月亮', rank: '游荡', element: '月影系',
    trait: '害怕被展开', description: '一张悬在空中的纸月亮。', habit: '深夜贴着窗户移动。', weakness: '遇水变软。',
    maxHp: 132, maxSpirit: 84,
    stats: { magic: 71, insight: 49, agility: 66, empathy: 35 },
    skillIds: ['monster-claw'], rules: [{ trigger: 'roundStart', effect: 'heal', amount: 3 }],
  },
  candidate: {
    name: '纸灯', codename: '折光', title: '把夜色折成小船的人', element: '星光系', archetype: '治愈',
    level: 3, cost: 620,
    stats: { magic: 64, insight: 58, agility: 52, empathy: 72 }, skillIds: ['glimmer-spear'],
    traits: [{ name: '夜读', description: '熄灯后才开始写字。', polarity: '正面' }],
    quote: '我会把灯留给你。', goal: '找到愿意收留纸船的人。', goalKind: '生活',
    appearance: '短发，发梢有折痕。', personality: '安静，喜欢折纸。', outfit: '宽大的值夜制服。',
  },
  mission: {
    title: '窗上的纸月亮', category: '异象调查', description: '一扇窗里同时出现了两个月亮。',
    work: 'investigation', difficulty: '中危', district: 'oldtown', window: 'urgent',
    duration: 75, reward: 1200, requirement: 'insight', target: 62, rounds: 5,
    recommendedLevel: 3, enemyRefs: ['generated'], rewardItemRef: 'loot-1', rewardGirlLevel: 0,
  },
  opinion: {
    authorId: 'yue', topic: '经费', faction: 'witch', title: '窗边的空位',
    text: '有人希望把靠窗的位置留给新来的孩子。', request: '把窗边的位置留给纸灯。',
    dialogue: [
      { speakerId: 'yue', speaker: '月见桃', text: '窗边那个位置，今晚开始空出来了。', expression: 'calm' },
      { speakerId: 'yue', speaker: '月见桃', text: '我想把它留给纸灯。她需要一个能看见月亮的地方。', expression: 'sad' },
      { speakerId: 'yue', speaker: '月见桃', text: '经费从我的那份里扣，可以吗？', expression: 'shy' },
    ],
    options: [
      { id: 'accept', label: '批准', effect: '从本月经费中拨出一笔钱，把窗边重新布置。', changes: [{ kind: 'gold', amount: -600 }, { kind: 'girl', girlId: 'yue', field: 'bond', amount: 3 }], outcomes: [] },
      { id: 'defer', label: '暂缓', effect: '今晚先不动窗边，等下次例会再说。', changes: [{ kind: 'girl', girlId: 'yue', field: 'bond', amount: -1 }, { kind: 'faction', faction: 'witch', amount: -2 }], outcomes: [] },
      { id: 'reject', label: '驳回', effect: '窗边保持原样，经费也不能动。', changes: [{ kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 }, { kind: 'faction', faction: 'witch', amount: -4 }, { kind: 'gold', amount: -300 }], outcomes: [] },
    ],
  },
  envoy: {
    faction: 'association', title: '替协会送一盏灯', description: '把灯送到旧车站。', work: 'investigation', difficulty: '中危',
    district: 'station', window: 'urgent', duration: 45, reward: 720, requirement: 'empathy', target: 52, rounds: 3,
    recommendedLevel: 2, enemyRefs: ['generated'], rewardGirlLevel: 0,
  },
  loot: [{ ref: 'loot-1', name: '折月灯罩', faction: 'witch', slot: 'charm', description: '纸折的灯罩，能把月光收得很小。', stats: { insight: 4 }, passive: '' }],
});

const oldScar = (id: string): Scar => ({
  id: `scar-${id}-old`, name: '陈旧伤', kind: 'physical', condition: '旧伤在阴雨天发作',
  description: '她不太提起这件事。', effect: { kind: 'stat', stat: 'agility', amount: -1 },
  maxHpLoss: 8, gainedAt: '第 13 日 · 02:10', missionId: 'mirror',
});

test('初始数据包含六位契约者（含退役）、战斗与调查委托、基地容量', () => {
  const s = createInitialState();
  assert.equal(s.version, 12);
  assert.equal(s.girls.length, 5);
  assert.equal(s.girls.filter(g => g.retired).length, 1);
  assert.equal(s.candidates.length, 1);
  assert.equal(s.missions.length, 10);
  assert.equal(s.minutes, 20 * 60);
  assert.ok(s.missions.slice(0, 3).every(m => m.id.startsWith('c-14-0-') && m.deadlineAt !== undefined && m.district));
  assert.ok(s.missions.every(m => m.district && m.window && m.deadlineAt !== undefined));
  assert.equal(capacity(s), 6);
  assert.ok(s.missions.some(m => m.work === 'combat') && s.missions.some(m => m.work === 'investigation'));
  assert.ok(s.girls.every(g => g.name && g.skill && g.portrait && g.skills.length === 3));
  assert.deepEqual(s.battles, []);
  assert.ok(s.packHash);
});
test('派遣不修改原状态；多人和单人编队均受上限约束', () => {
  const s = createInitialState();
  const r = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'mirror' });
  assert.equal(r.ok, true);
  assert.equal(s.girls[0].status, 'idle');
  assert.equal(r.state.girls[0].status, 'mission');
  assert.deepEqual(r.state.missions.find(m => m.id === 'mirror')?.squad, ['yue', 'tang', 'ling']);
  assert.equal(r.state.missions.find(m => m.id === 'mirror')?.status, 'active');
  assert.equal(squadLimit(r.state.missions.find(m => m.id === 'mirror')!), 3);
  assert.equal(squadLimit(s.missions.find(m => m.id === 'candy')!), 2);
  assert.equal(act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling', 'wu'], missionId: 'mirror' }).ok, false);
  assert.equal(act(r.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
});
test('重复派遣、低血量与过劳被阻止', () => {
  const s = createInitialState(); s.girls[0].fatigue = 85;
  assert.equal(act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
  s.girls[0].fatigue = 10; s.girls[0].hp = 10;
  assert.equal(act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
  s.girls[0].hp = 100; const r = act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
  assert.equal(act(r.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'station' }).ok, false);
});
test('调查委托推进完成后只结算一次收入与日志', () => {
  const s = createInitialState();
  const r = act(s, { type: 'dispatch', girlIds: ['yue', 'tang'], missionId: 'candy' });
  const done = act(r.state, { type: 'advance', minutes: 120 });
  assert.equal(done.ok, true);
  assert.equal(done.state.girls.find(g => g.id === 'yue')!.status, 'idle');
  assert.equal(done.state.gold, s.gold + 734);
  assert.ok(done.state.completed.includes('candy'));
  assert.equal(done.state.missions.find(m => m.id === 'candy')!.status, 'done');
  const gold = done.state.gold;
  assert.equal(act(done.state, { type: 'advance', minutes: 15 }).state.gold, gold);
});
test('午夜前推进在打烊那一刻停下，跨日交给打烊交接', () => {
  const initial = createInitialState(); initial.minutes = 25 * 60 + 10;
  const dispatched = act(initial, { type: 'dispatch', girlIds: ['yue', 'tang'], missionId: 'candy' }).state;
  const closed = act(dispatched, { type: 'advance', minutes: 60 }).state;
  assert.equal(closed.day, 14); assert.equal(closed.minutes, 26 * 60);
  assert.equal(closed.samples.find(x => x.day === 14)!.income, initial.samples.at(-1)!.income + 734);
  assert.equal(closed.logs.find(l => l.delta === 734)!.time, '第 14 日 · 01:55');
  assert.equal(act(closed, { type: 'advance', minutes: 5 }).ok, false);
  const next = act(closed, { type: 'endNight' });
  assert.equal(next.ok, true);
  assert.equal(next.state.day, 15); assert.equal(next.state.minutes, 20 * 60);
  assert.ok(next.state.missions.some(m => m.id.startsWith('c-15-0-')));
  assert.ok(next.state.girls.filter(g => !g.retired && g.status === 'idle').every(g => g.fatigue >= 0));
});
test('战斗胜利移除事件、发放全额收益并提升关系与经验', () => {
  const s = createInitialState();
  const before = s.girls.find(g => g.id === 'yue')!;
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'mirror' }).state;
  const goldBefore = dispatched.gold;
  const result = act(dispatched, { type: 'advance', minutes: 180 }).state;
  const battle = result.battles[0];
  assert.equal(battle.outcome, 'victory');
  assert.ok(battle.events.length > 0);
  assert.ok((battle.frames?.length ?? 0) >= battle.round);
  assert.equal(battle.startedAt.day, 14);
  assert.equal(result.gold, goldBefore + 1240);
  assert.equal(result.missions.find(m => m.id === 'mirror')!.status, 'done');
  assert.ok(result.completed.includes('mirror'));
  const yue = result.girls.find(g => g.id === 'yue')!;
  assert.equal(yue.bond, Math.min(100, before.bond + 3));
  assert.equal(yue.relationships.tang, (before.relationships.tang ?? 40) + 2);
  assert.equal(yue.exp, battleExp(result.missions.find(m => m.id === 'mirror')!.recommendedLevel));
  assert.equal(yue.scars.length, 0);
  assert.equal(result.logs.find(l => l.kind === 'battle')?.delta, 1240);
});
test('战斗击退只发放八成收益，魔物带伤回到事件池', () => {
  const s = createInitialState();
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'station' }).state;
  const goldBefore = dispatched.gold;
  const result = act(dispatched, { type: 'advance', minutes: 60 }).state;
  const battle = result.battles[0];
  const mission = result.missions.find(m => m.id === 'station')!;
  assert.equal(battle.outcome, 'repelled');
  assert.equal(result.gold, goldBefore + 736);
  assert.equal(mission.status, 'open');
  assert.equal(mission.worsened, true);
  assert.equal(mission.attempts, 1);
  assert.deepEqual(mission.squad, []);
  assert.ok(battle.rewards && battle.rewards.gold === 736);
});
test('战斗失败保留事件、施加疤痕并降低血量上限', () => {
  const s = createInitialState();
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'arcade' }).state;
  const goldBefore = dispatched.gold;
  const result = act(dispatched, { type: 'advance', minutes: 90 }).state;
  const battle = result.battles[0];
  assert.equal(battle.outcome, 'defeat');
  assert.equal(result.gold, goldBefore);
  assert.equal(result.missions.find(m => m.id === 'arcade')!.status, 'open');
  const girl = result.girls.find(g => g.id === 'yue')!;
  assert.equal(girl.scars.length, 1);
  assert.ok(girl.maxHp < girl.baseMaxHp);
  assert.ok(girl.hp >= 0);
  assert.equal(result.memorial.length, 0);
  assert.equal(battle.scars?.length, 1);
  assert.ok(result.logs.some(l => l.kind === 'memorial' && l.text.includes('疤痕')));
});
test('第五道疤痕导致死亡，释放席位并进入纪念墙', () => {
  const s = createInitialState();
  for (const id of ['yue', 'tang', 'ling']) {
    const girl = s.girls.find(g => g.id === id)!;
    girl.scars = [oldScar(id), oldScar(id), oldScar(id), oldScar(id)];
    girl.baseMaxHp = girl.maxHp = 50;
    girl.scars = girl.scars.map((scar, index) => ({ ...scar, id: `scar-${id}-${index}` }));
  }
  const dispatched = act(s, { type: 'dispatch', girlIds: ['yue', 'tang', 'ling'], missionId: 'station' }).state;
  const result = act(dispatched, { type: 'advance', minutes: 180 }).state;
  assert.equal(result.battles[0].outcome, 'defeat');
  assert.equal(result.memorial.length, 3);
  assert.deepEqual(result.girls.map(g => g.id), ['wu', 'zhi']);
  assert.equal(result.reputation, 58);
  assert.deepEqual(result.missions.find(m => m.id === 'station')!.squad, []);
  assert.ok(result.memorial.every(m => m.girl.dead && m.girl.scars.length === 5 && m.lastBattleId === result.battles[0].id));
});
test('满四道疤痕可以退役，退役后无法再派遣', () => {
  const s = createInitialState();
  const yue = s.girls.find(g => g.id === 'yue')!;
  yue.scars = [oldScar('yue'), oldScar('yue'), oldScar('yue'), oldScar('yue')];
  yue.scars = yue.scars.map((scar, index) => ({ ...scar, id: `scar-yue-${index}` }));
  const retired = act(s, { type: 'retire', girlId: 'yue' });
  assert.equal(retired.ok, true);
  assert.equal(retired.state.girls.find(g => g.id === 'yue')!.retired, true);
  assert.equal(act(retired.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
  assert.equal(act(createInitialState(), { type: 'retire', girlId: 'yue' }).ok, false);
});
test('诊所按缺失血量收费并按时长回血，治疗中拒绝出勤', () => {
  const s = createInitialState(); const girl = s.girls[0];
  girl.hp = 30; girl.fatigue = 40;
  const quote = clinicQuote(girl);
  assert.equal(quote.missing, 90);
  assert.equal(quote.cost, 930);
  assert.equal(quote.minutes, 300);
  const h = act(s, { type: 'clinic', girlId: 'yue', mode: 'treat' });
  assert.equal(h.ok, true);
  assert.equal(h.state.gold, s.gold - 930);
  const treating = h.state.girls[0];
  assert.equal(treating.status, 'healing');
  assert.equal(treating.remaining, 300);
  assert.equal(treatmentFor(h.state, 'yue')?.paid, 930);
  assert.equal(act(h.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).ok, false);
  const later = act(h.state, { type: 'advance', minutes: 60 }).state.girls[0];
  assert.ok(later.hp > 30 && later.hp < 100, `一小时应只回一部分，实际 ${later.hp}`);
  assert.ok(later.fatigue >= 40, '治疗不回疲劳');
  const done = act(act(h.state, { type: 'advance', minutes: 180 }).state, { type: 'advance', minutes: 120 }).state;
  assert.equal(done.girls[0].status, 'idle');
  assert.equal(done.girls[0].hp, done.girls[0].maxHp);
  assert.equal(treatmentFor(done, 'yue'), undefined);
  const poor = { ...s, gold: 0 };
  assert.equal(act(poor, { type: 'clinic', girlId: 'yue', mode: 'treat' }).ok, false);
  assert.equal(act(s, { type: 'clinic', girlId: 'yue', mode: 'treat', kink: true }).state.treatments[0].kink, true);
});
test('癖好护理两小时后结束：不回血、不留特性、只涨羁绊', () => {
  const s = createInitialState(); s.girls[0].hp = 40;
  const bondBefore = s.girls[0].bond;
  const started = act(s, { type: 'clinic', girlId: 'yue', mode: 'treat', kink: true });
  assert.equal(started.ok, true);
  const done = act(started.state, { type: 'advance', minutes: 120 }).state;
  assert.equal(done.girls[0].status, 'idle', '2 小时后结束');
  assert.equal(done.girls[0].hp, 40, '癖好护理不回血');
  assert.ok(!done.girls[0].traits.some(trait => trait.id === 'clinic-kink'), '不应留下永久特性');
  assert.equal(done.girls[0].bond, Math.min(100, bondBefore + 4));
});
test('休息只恢复疲劳并降低侵蚀', () => {
  const s = createInitialState(); s.girls[0].fatigue = 75; s.girls[0].corruption = 20; s.girls[0].hp = 50;
  const rest = act(s, { type: 'care', girlId: 'yue', mode: 'resting' });
  assert.equal(rest.ok, true);
  const rested = act(rest.state, { type: 'advance', minutes: 90 }).state.girls[0];
  assert.equal(rested.fatigue, 63);
  assert.equal(rested.corruption, 15);
  assert.equal(rested.hp, 50);
});
test('雇佣扣款、去重并遵守基地容量', () => {
  const s = createInitialState(); s.gold = 20000;
  const candidate = s.candidates[0];
  const r = act(s, { type: 'hire', girlId: candidate.id }); assert.equal(r.ok, true); assert.equal(r.state.girls.length, 6);
  assert.equal(act(r.state, { type: 'hire', girlId: candidate.id }).ok, false);
  r.state.rooms.find(room => room.type === 'dorm')!.capacity = 5;
  assert.equal(act(r.state, { type: 'hire', girlId: 'lu' }).ok, false);
});
test('资金不足不建造，成功扩建后容量增加', () => {
  const s = createInitialState(); const n = capacity(s); s.gold = 0;
  assert.equal(act(s, { type: 'build' }).ok, false); s.gold = 10000;
  const r = act(s, { type: 'build' }); assert.equal(r.ok, true); assert.equal(capacity(r.state), n + 2);
  assert.equal(act(s, { type: 'build', roomId: 'lounge' }).ok, true);
});
test('本地剧情拒绝空输入，保存玩家与角色消息并限制长度', () => {
  const s = createInitialState(); assert.equal(act(s, { type: 'talk', girlId: 'yue', text: '  ' }).ok, false);
  const r = act(s, { type: 'talk', girlId: 'yue', text: '你今天还好吗？' });
  assert.equal(r.ok, true); assert.equal(r.state.messages.yue.at(-2)?.role, 'player');
  assert.equal(r.state.messages.yue.at(-1)?.role, 'girl'); assert.ok(r.state.girls[0].bond > s.girls[0].bond);
  assert.equal(act(s, { type: 'talk', girlId: 'yue', text: '字'.repeat(201) }).ok, false);
});
test('推进在打烊时停下，午夜之后仍算同一夜', () => {
  const late = createInitialState(); late.minutes = 23 * 60 + 45;
  const crossed = act(late, { type: 'advance', minutes: 30 }).state;
  assert.equal(crossed.day, 14); assert.equal(crossed.minutes, 24 * 60 + 15);
  const s = createInitialState(); s.minutes = 25 * 60 + 45;
  const r = act(s, { type: 'advance', minutes: 30 }); assert.equal(r.state.day, 14); assert.equal(r.state.minutes, 26 * 60);
  assert.equal(act(s, { type: 'advance', minutes: -5 }).ok, false);
  assert.equal(act(s, { type: 'advance', minutes: NaN }).ok, false);
  assert.equal(act(s, { type: 'advance', minutes: 0.5 }).ok, false);
  assert.equal(act(s, { type: 'advance', minutes: 181 }).ok, false);
});
test('坏存档安全回退，v1 存档迁移，合法 v6 存档恢复', () => {
  assert.equal(loadState('not json').girls.length, 5);
  const migrated = loadState('{"version":1,"gold":777,"girls":[]}');
  assert.equal(migrated.girls.length, 5);
  assert.equal(migrated.gold, 777);
  const s = createInitialState(); s.gold = 999;
  assert.equal(loadState(JSON.stringify(s)).gold, 999);
  const malformed = structuredClone(s); malformed.girls[0].stats = null as never;
  assert.equal(loadState(JSON.stringify(malformed)).gold, 12840);
});
test('存档拒绝孤立委托、错配编队与危险角色标识', () => {
  const orphan = createInitialState(); orphan.gold = 456; orphan.missions[0].status = 'active';
  assert.equal(loadState(JSON.stringify(orphan)).gold, 12840);
  const mismatched = createInitialState(); mismatched.gold = 456; mismatched.missions[0].status = 'active'; mismatched.missions[0].squad = ['yue'];
  assert.equal(loadState(JSON.stringify(mismatched)).gold, 12840);
  const dangerous = createInitialState(); dangerous.gold = 456; dangerous.girls[0].id = 'constructor';
  assert.equal(loadState(JSON.stringify(dangerous)).gold, 12840);
  const active = act(createInitialState(), { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' }).state; active.gold = 456;
  assert.equal(loadState(JSON.stringify(active)).gold, 456);
});
test('雾眠保留专属猫咪对白，日羁绊增长有上限', () => {
  let s = createInitialState(); const initial = s.girls.find(g => g.id === 'wu')!.bond;
  for (let i = 0; i < 6; i++) s = act(s, { type: 'talk', girlId: 'wu', text: '帽子里的猫还好吗？' }).state;
  assert.match(s.messages.wu.at(-1)!.text, /帽子里的猫/);
  assert.equal(s.girls.find(g => g.id === 'wu')!.bond, initial + 6);
  assert.equal(s.messages.wu.length, 12);
});
test('单人匹配率与小队契合度保持在合理区间', () => {
  const s = createInitialState(); const g = s.girls[0], m = s.missions.find(x => x.id === 'candy')!;
  const low = chance(g, m); g.stats[m.requirement] = 100;
  assert.ok(chance(g, m) >= low); assert.ok(chance(g, m) <= 99); assert.ok(low >= 35);
  const squad = s.girls.slice(0, 2);
  assert.ok(squadChance(squad, m) >= 20 && squadChance(squad, m) <= 99);
});
test('经验达到阈值后升级并提升主副属性', () => {
  const s = createInitialState(); const g = s.girls[0]; const level = g.level;
  g.exp = 0; g.retired = false;
  const need = expNeeded(level);
  assert.equal(grantExp(g, need - 1), false);
  assert.equal(g.exp, need - 1);
  assert.equal(grantExp(g, 2), true);
  assert.equal(g.level, level + 1);
  assert.equal(g.exp, 1);
  assert.ok(g.maxHp > s.girls[1].baseMaxHp || g.maxHp >= 120);
});
test('退休金按日划拨，欠约累积到契约状态', () => {
  const s = createInitialState(); const yue = s.girls.find(g => g.id === 'yue')!;
  yue.scars = [oldScar('1'), oldScar('2'), oldScar('3'), oldScar('4')];
  const retired = act(s, { type: 'retire', girlId: 'yue' });
  assert.equal(retired.ok, true);
  assert.equal(retired.state.girls.find(g => g.id === 'yue')!.retired, true);
  const before = retired.state.gold; let current = retired.state;
  for (let i = 0; i < 100; i++) {
    const pending = current.incidents.find(item => item.status === 'pending');
    if (pending) current = act(current, { type: 'resolveIncident', incidentId: pending.id, optionId: pending.options[0].id }).state;
    current = act(current, { type: 'endNight' }).state;
  }
  assert.ok(current.gold < before, '退役金应该造成持续支出');
  assert.ok(current.logs.some(log => log.text.includes('退休金')));
  assert.ok(current.gold < before - Math.round(pensionFor(yue) / 10) * 8);
});
test('远程联络只对退役成员开放，按次计费且每日首次提升羁绊', () => {
  const s = createInitialState(); const yue = s.girls.find(g => g.id === 'yue')!;
  yue.retired = true; yue.retiredReason = 'contract'; yue.status = 'retired'; s.gold = 1000;
  const first = act(s, { type: 'talk', girlId: 'yue', text: '最近睡得好吗？', remote: true });
  assert.equal(first.ok, true);
  assert.equal(first.state.gold, 1000 - REMOTE_CALL_COST);
  assert.equal(first.state.girls.find(g => g.id === 'yue')!.bond, yue.bond + 1);
  const second = act(first.state, { type: 'talk', girlId: 'yue', text: '明天再聊。', remote: true });
  assert.equal(second.state.gold, 1000 - REMOTE_CALL_COST * 2);
  assert.equal(second.state.girls.find(g => g.id === 'yue')!.bond, yue.bond + 1);
  assert.equal(act(s, { type: 'talk', girlId: 'tang', text: '在吗', remote: true }).ok, false);
});
test('续签与复制契约会消耗星砂并写入新契约', () => {
  const s = createInitialState(); s.gold = 30000; s.girls[0].contractEndDay = 12; s.girls[0].pensionMissed = 2;
  const renewed = act(s, { type: 'renewContract', girlId: 'yue' });
  assert.equal(renewed.ok, true);
  assert.equal(renewed.state.girls[0].pensionMissed, 0);
  assert.ok(renewed.state.girls[0].contractEndDay >= renewed.state.day + 10);
  const cloned = act(renewed.state, { type: 'clinic', girlId: 'yue', mode: 'clone' });
  assert.equal(cloned.ok, true);
  assert.equal(cloned.state.girls.length, s.girls.length + 1);
  const copy = cloned.state.girls.at(-1)!;
  assert.equal(copy.cloneOf, 'yue');
  assert.equal(copy.level, 1);
  assert.match(copy.id, /^g_/);
  assert.equal(act(cloned.state, { type: 'clinic', girlId: 'yue', mode: 'clone' }).ok, false);
});
test('星象台远行按小时结算并可以召回', () => {
  const s = createInitialState();
  const started = act(s, { type: 'startExpedition', memberIds: ['yue', 'tang'] });
  assert.equal(started.ok, true);
  const expedition = started.state.expeditions[0];
  assert.deepEqual(expedition.memberIds, ['yue', 'tang']);
  assert.equal(started.state.girls.find(g => g.id === 'yue')!.status, 'expedition');
  const advanced = act(started.state, { type: 'advance', minutes: 60 });
  assert.equal(advanced.state.expeditions[0].cyclesDone, 1);
  assert.ok(advanced.state.gold > started.state.gold);
  const recalled = act(advanced.state, { type: 'recallExpedition', expeditionId: expedition.id });
  assert.equal(recalled.state.expeditions.length, 0);
  assert.equal(recalled.state.girls.find(g => g.id === 'yue')!.status, 'idle');
});
test('会客厅议题可以批准、驳回或暂缓', () => {
  const s = createInitialState(); const opinion: Opinion = { id: 'op-test', day: 14, authorId: 'yue', topic: '经费', title: '换一盏暖灯', text: '白光太像诊所。', request: '申请 600 星砂。', status: 'pending', options: [] };
  s.opinions = [opinion];
  const accepted = act(s, { type: 'decideOpinion', opinionId: 'op-test', decision: 'accept' });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.gold, s.gold - 600);
  assert.equal(accepted.state.opinions[0].status, 'accepted');
  assert.equal(act(accepted.state, { type: 'decideOpinion', opinionId: 'op-test', decision: 'reject' }).ok, false);
  const rejected = act(s, { type: 'decideOpinion', opinionId: 'op-test', decision: 'reject' });
  assert.equal(rejected.state.opinions[0].status, 'rejected');
  assert.equal(rejected.state.girls.find(g => g.id === 'yue')!.bond, s.girls.find(g => g.id === 'yue')!.bond - 2);
});
test('驳回会同时扣掉星砂、降低羁绊与所属势力态度', () => {
  const s = createInitialState(); s.factions.witch.standing = 50;
  const options = defaultOpinionOptions('经费', { authorId: 'yue', authorName: '月', faction: 'witch' });
  s.opinions = [{ id: 'op-reject', day: s.day, authorId: 'yue', topic: '经费', title: '换一盏暖灯', text: '', request: '', status: 'pending', faction: 'witch', options }];
  const before = { gold: s.gold, bond: s.girls.find(g => g.id === 'yue')!.bond, standing: s.factions.witch.standing };
  const rejected = act(s, { type: 'decideOpinion', opinionId: 'op-reject', decision: 'reject' });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.state.gold, before.gold - 300);
  assert.equal(rejected.state.girls.find(g => g.id === 'yue')!.bond, before.bond - 2);
  assert.equal(rejected.state.factions.witch.standing, before.standing - 4);
  assert.match(rejected.state.logs[0].text, /星砂/);
});
test('资源不足时批准与驳回锁定，暂缓保底并在下个议事日回归', () => {
  const s = createInitialState(); s.gold = 0; s.factions.witch.standing = 0;
  const options = defaultOpinionOptions('经费', { authorId: 'yue', authorName: '月', faction: 'witch' });
  const opinion: Opinion = { id: 'op-poor', day: s.day, authorId: 'yue', topic: '经费', title: '换一盏暖灯', text: '', request: '', status: 'pending', faction: 'witch', options };
  s.opinions = [opinion];
  assert.equal(previewOpinionOption(s, opinion, options[0]).ok, false);
  assert.equal(previewOpinionOption(s, opinion, options[2]).ok, false);
  assert.equal(previewOpinionOption(s, opinion, options[1]).ok, true);
  const rejected = act(s, { type: 'decideOpinion', opinionId: 'op-poor', decision: 'reject' });
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /资源不足/);
  const deferred = act(s, { type: 'decideOpinion', opinionId: 'op-poor', decision: 'defer' });
  assert.equal(deferred.ok, true);
  assert.equal(deferred.state.opinions[0].status, 'deferred');
  assert.equal(deferred.state.opinions[0].revisitDay, s.day + 1);
  const nextDay = act(deferred.state, { type: 'endNight' }).state;
  assert.equal(nextDay.opinions.find(item => item.id === 'op-poor')!.status, 'pending');
});
test('议会选项可以扣装备与推进时间，时间不足时整条锁定', () => {
  const s = createInitialState(); s.inventory['moon-weapon'] = 1; s.minutes = SHIFT_END - 20;
  const option = { id: 'reject' as const, label: '驳回', effect: '赔偿', changes: [{ kind: 'item' as const, itemId: 'moon-weapon', amount: -1 }, { kind: 'minutes' as const, amount: 30 }] };
  const opinion: Opinion = { id: 'op-gear', day: s.day, authorId: 'yue', topic: '同伴', title: '赔一件护符', text: '', request: '', status: 'pending', options: [option] };
  s.opinions = [opinion];
  assert.equal(previewOpinionOption(s, opinion, option).ok, false);
  assert.equal(act(s, { type: 'decideOpinion', opinionId: 'op-gear', decision: 'reject' }).ok, false);
  s.minutes = SHIFT_START;
  const rejected = act(s, { type: 'decideOpinion', opinionId: 'op-gear', decision: 'reject' });
  assert.equal(rejected.ok, true);
  assert.equal(rejected.state.inventory['moon-weapon'], 0);
  assert.equal(rejected.state.minutes, SHIFT_START + 30);
});
test('议会开场对白按议题生成，旧议题与空对白会回退默认演出', () => {
  const lines = defaultOpinionDialogue('设施', { authorId: 'yue', authorName: '月', faction: 'witch', request: '申请 900 星砂维修星象台。' });
  assert.ok(lines.length >= 4);
  assert.equal(lines[0].speaker, '月');
  assert.equal(lines[0].expression, 'sad');
  assert.ok(lines.some(line => line.text.includes('月蚀庭')));
  assert.equal(lines.at(-1)?.text, '申请 900 星砂维修星象台。');

  const s = createInitialState();
  const old: Opinion = { id: 'op-old', day: s.day, authorId: 'yue', topic: '经费', title: '换暖灯', text: '', request: '申请 600 星砂。', status: 'pending', options: [] };
  const fallback = resolveOpinionDialogue(s, old);
  assert.ok(fallback.length >= 3);
  assert.equal(fallback[0].speaker, s.girls.find(girl => girl.id === 'yue')!.name);
  assert.equal(fallback.at(-1)?.text, '申请 600 星砂。');

  const custom = resolveOpinionDialogue(s, { ...old, dialogue: [{ speaker: '旁白', text: '她把议题推到桌子中央。', expression: 'calm' }] });
  assert.equal(custom.length, 1);
  assert.equal(custom[0].speaker, '旁白');
  assert.equal(custom[0].text, '她把议题推到桌子中央。');

  const blank = resolveOpinionDialogue(s, { ...old, dialogue: [{ speaker: '旁白', text: '   ' }] });
  assert.ok(blank.length >= 3);
});


test('市场升级与高级招募消耗资金和安定度，并扩充候选', () => {
  const s = createInitialState(); s.gold = 50000;
  const up = act(s, { type: 'upgradeMarket' });
  assert.equal(up.ok, true);
  assert.equal(up.state.marketLevel, 2);
  assert.equal(up.state.gold, 44000);
  const before = up.state.candidates.length;
  const adv = act(up.state, { type: 'advancedRecruit', level: 3 });
  assert.equal(adv.ok, true);
  assert.equal(adv.state.candidates.length, before + 1);
  assert.ok(adv.state.gold < up.state.gold);
  assert.ok(adv.state.reputation < up.state.reputation);
  assert.equal(act(adv.state, { type: 'advancedRecruit', level: 3 }).ok, false);
});
test('势力装备可从仓库穿戴，并计入有效属性', () => {
  const s = createInitialState(); s.gold = 10000; s.factions.witch.standing = 60;
  const bought = act(s, { type: 'buyItem', itemId: 'moon-weapon' });
  assert.equal(bought.ok, true);
  assert.equal(bought.state.inventory['moon-weapon'], 1);
  const before = effectiveStats(bought.state.girls.find(g => g.id === 'yue')!, bought.state);
  const equipped = act(bought.state, { type: 'equipItem', girlId: 'yue', itemId: 'moon-weapon', slot: 'weapon' });
  assert.equal(equipped.ok, true);
  const after = effectiveStats(equipped.state.girls.find(g => g.id === 'yue')!, equipped.state);
  assert.ok(after.magic > before.magic);
  assert.equal(equipped.state.inventory['moon-weapon'], 0);
});
test('势力货架每日三个货位、每格限购一次并跨日刷新', () => {
  const s = createInitialState();
  s.gold = 50000; s.factions.witch.standing = 80;
  const witch = s.marketStock.filter(entry => entry.faction === 'witch');
  assert.equal(witch.length, 3);
  const first = witch[0];
  const bought = act(s, { type: 'buyItem', stockId: first.id });
  assert.equal(bought.ok, true);
  assert.equal(bought.state.marketStock.find(entry => entry.id === first.id)!.sold, true);
  const again = act(bought.state, { type: 'buyItem', stockId: first.id });
  assert.equal(again.ok, false);
  assert.match(again.message, /售出|售罄/);
  const duplicated = Array.from({ length: 120 }, (_, index) => makeFactionStock('witch', 14 + index)).find(list => new Set(list.map(entry => entry.itemId)).size < 3);
  assert.ok(duplicated, '货架应允许同一天出现重复物品');
  const refreshed = act(bought.state, { type: 'endNight' }).state;
  assert.equal(refreshed.day, 15);
  const nextWitch = refreshed.marketStock.filter(entry => entry.faction === 'witch');
  assert.equal(nextWitch.length, 3);
  assert.ok(nextWitch.every(entry => entry.id.includes('-15-') && !entry.sold));
});
test('断药期禁止派遣，抑制剂立即解除', () => {
  const s = createInitialState();
  const yue = s.girls.find(g => g.id === 'yue')!;
  yue.corruption = 75; yue.witch = true; yue.withdrawalDays = 2; yue.drugUntilDay = 0;
  assert.equal(inWithdrawal(yue), true);
  const blocked = act(s, { type: 'dispatch', girlIds: ['yue'], missionId: 'cat' });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /断药/);
  const blockedTrip = act(s, { type: 'startExpedition', memberIds: ['yue'] });
  assert.equal(blockedTrip.ok, false);
  assert.match(blockedTrip.message, /断药/);
  s.inventory['moon-drug'] = 1;
  const cured = act(s, { type: 'useItem', girlId: 'yue', itemId: 'moon-drug' });
  assert.equal(cured.ok, true);
  const curedYue = cured.state.girls.find(g => g.id === 'yue')!;
  assert.equal(curedYue.withdrawalDays, 0);
  assert.ok((curedYue.drugUntilDay ?? 0) > cured.state.day);
  assert.equal(act(cured.state, { type: 'dispatch', girlIds: ['yue'], missionId: 'cat' }).ok, true);
});
test('自定义契约者登记为一级并进入候选名册', () => {
  const s = createInitialState();
  const before = s.candidates.length;
  const draft = { name: '夜见灯', codename: '宵灯', title: '新登记契约者', element: '星光系' as const, archetype: '输出' as const, color: '#f49abd', quote: '请多指教。', goal: '完成第一次委托', appearance: '短发', personality: '认真', outfitDescription: '夜色制服', stats: { magic: 75, insight: 65, agility: 60, empathy: 60 }, skillIds: ['glimmer-spear', 'peach-ward', 'starlight-fall'], traits: [{ name: '猫一样的直觉', description: '先于别人察觉不对劲。', polarity: 'good' as const }, { name: '护短', description: '同伴受威胁时会失去分寸。', polarity: 'neutral' as const }, { name: '寡言', description: '很少解释自己的判断。', polarity: 'bad' as const }], portrait: '' };
  const r = act(s, { type: 'createGirl', draft });
  assert.equal(r.ok, true);
  assert.equal(r.state.candidates.length, before + 1);
  assert.equal(r.state.candidates.at(-1)?.level, 1);
  assert.equal(s.candidates.length, before);
});

test('内容池上限可调整，事件、候选与魔物可手动移除', () => {
  const base = createInitialState();
  const limited = act(base, { type: 'setPoolLimit', pool: 'monsters', value: 3 });
  assert.equal(limited.ok, true);
  assert.equal(limited.state.poolLimits.monsters, 3);

  const mission = base.missions.find(m => m.status === 'open')!;
  const removed = act(base, { type: 'deleteMission', missionId: mission.id });
  assert.equal(removed.ok, true);
  assert.equal(removed.state.missions.some(m => m.id === mission.id), false);

  const candidate = base.candidates[0];
  const dismissed = act(base, { type: 'deleteCandidate', girlId: candidate.id });
  assert.equal(dismissed.ok, true);
  assert.equal(dismissed.state.candidates.length, base.candidates.length - 1);

  const monster = 'night-tram';
  const purified = act(base, { type: 'deleteMonster', monsterId: monster });
  assert.equal(purified.ok, true);
  assert.equal(purified.state.removedMonsters.includes(monster), true);
  assert.equal(purified.state.missions.some(m => m.enemyIds?.includes(monster)), false);
  assert.equal(act(purified.state, { type: 'deleteMonster', monsterId: monster }).ok, false);
});

test('生成提案会写入事件、候选、魔物、装备池，池满时拒绝', () => {
  const base = createInitialState();
  const checked = validateNightProposal(nightProposal(), base);
  assert.equal(checked.ok, true, checked.errors.join('；'));
  const content = materializeNightProposal(checked.proposal!, base);
  assert.equal(content.monster.maxHp, 132);
  assert.deepEqual(content.monster.stats, { magic: 71, insight: 49, agility: 66, empathy: 35 });
  assert.equal(content.girl.level, 3);
  assert.deepEqual(content.girl.stats, { magic: 64, insight: 58, agility: 52, empathy: 72 });
  assert.equal(content.mission.duration, 75);
  assert.equal(content.mission.reward, 1200);
  assert.equal(content.mission.rounds, 5);
  assert.equal(content.opinion.options.length, 3);
  assert.equal(content.opinion.dialogue?.length, 3);
  assert.equal(content.items.length, 1);
  assert.equal(content.mission.rewardEquipmentId, content.items[0].id);
  const result = act(base, { type: 'addGeneratedContent', ...content });
  assert.equal(result.ok, true);
  assert.equal(result.state.candidates.length, base.candidates.length + 1);
  assert.equal(result.state.customMonsters.length, 1);
  assert.equal(result.state.missions.length, base.missions.length + 2);
  assert.equal(result.state.opinions.length, base.opinions.length + 1);
  assert.equal(result.state.generatedItems.length, 1);
  assert.equal(result.state.missions.at(-1)?.enemyIds?.[0], content.monster.id);

  const capped = { ...base, poolLimits: { ...base.poolLimits, candidates: 1 } };
  assert.equal(act(capped, { type: 'addGeneratedContent', ...content }).ok, false);
});

test('生成装备随存档往返并重新登记到物品表', () => {
  const base = createInitialState();
  const content = materializeNightProposal(validateNightProposal(nightProposal(), base).proposal!, base);
  const item = { ...content.items[0], id: 'lm_item_roundtrip_1', name: '存档灯罩' };
  assert.equal(findItem(item.id), undefined);
  const loaded = loadState(JSON.stringify({ ...base, version: 11, generatedItems: [item] }));
  assert.equal(loaded.generatedItems.length, 1);
  assert.equal(loaded.generatedItems[0].id, item.id);
  assert.equal(findItem(item.id)?.name, '存档灯罩');
});

test('生成议题使用模型对白与选项，代表委托带势力标记', () => {
  const base = createInitialState();
  const checked = validateNightProposal(nightProposal(), base);
  const content = materializeNightProposal(checked.proposal!, base);
  const result = act(base, { type: 'addGeneratedContent', ...content });
  assert.equal(result.state.opinions[0].id, content.opinion.id);
  assert.equal(result.state.opinions[0].status, 'pending');
  assert.equal(result.state.opinions[0].dialogue?.[1].text.includes('纸灯'), true);
  assert.deepEqual(result.state.opinions[0].options.map(option => option.id), ['accept', 'defer', 'reject']);
  const envoy = result.state.missions.find(m => m.envoy);
  assert.equal(envoy?.faction, 'association');
  assert.equal(envoy?.duration, 45);
  assert.ok(envoy && envoy.x !== content.mission.x);
});

test('生成的代表委托会被会客厅代表登记为今日任务', () => {
  const base = createInitialState();
  const content = materializeNightProposal(validateNightProposal(nightProposal(), base).proposal!, base);
  const result = act(base, { type: 'addGeneratedContent', ...content });
  assert.equal(result.state.factions.association.envoyTaskId, content.envoyMission.id);
});

test('自定义登记自动填表会校验叙事者输出并补齐技能与特性', async () => {
  const original = globalThis.fetch;
  const profile = {
    name: '纸灯', codename: '折光', title: '把夜色折成小船的人', element: '星光系', archetype: '治愈',
    quote: '我会把灯留给你。', goal: '找到愿意收留纸船的人。', appearance: '短发，发梢有折痕。',
    personality: '安静，喜欢折纸。', outfitDescription: '宽大的值夜制服。', focus: 'empathy',
    skillIds: ['glimmer-spear', 'glimmer-spear', 'not-a-skill'],
  };
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: [{ type: 'text', text: JSON.stringify(profile) }] } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await generateGirlProfile({ endpoint: 'https://mock.local/v1', apiKey: 'x', model: 'mock' });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.name, '纸灯');
      assert.equal(result.data.element, '星光系');
      assert.equal(result.data.archetype, '治愈');
      assert.equal(result.data.focus, 'empathy');
      assert.equal(new Set(result.data.skillIds).size, 3);
      assert.equal(result.data.traits.length, 3);
      assert.ok(result.data.traits.every(trait => trait.name && trait.description));
    }
  } finally { globalThis.fetch = original; }
});

test('LLM 400 会暴露服务端错误并在 temperature 被拒时自动重试', async () => {
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    if (calls.length === 1) return new Response(JSON.stringify({ error: { message: 'Unsupported parameter: temperature' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(nightProposal()) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateDaily({ endpoint: 'https://mock.test/v1/chat/completions', apiKey: 'k', model: 'custom-model' }, createInitialState());
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.data.candidate.name, '纸灯');
    assert.equal(calls.length, 2);
    assert.equal('temperature' in calls[1], false);
    assert.ok(Number(calls[1].max_tokens) >= 2600);
  } finally {
    globalThis.fetch = original;
  }
});

test('提案硬错误会带原始 JSON 修复一次，修好后采纳', async () => {
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  const base = createInitialState();
  const broken = nightProposal();
  broken.opinion.options[2].changes = [
    { kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 },
    { kind: 'faction', faction: 'witch', amount: -4 },
  ];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    const content = calls.length === 1 ? broken : nightProposal();
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateDaily({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'mock' }, base);
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    const repairPrompt = calls[1].messages.map((message: { content: string }) => message.content).join('\n');
    assert.ok(repairPrompt.includes('必须修正的问题'));
    assert.ok(repairPrompt.includes('reject'));
  } finally {
    globalThis.fetch = original;
  }
});

test('提案校验会拒绝缺少实际惩罚的驳回与越界数值裁剪', () => {
  const base = createInitialState();
  const broken = nightProposal();
  broken.opinion.options[2].changes = [
    { kind: 'girl', girlId: 'yue', field: 'bond', amount: -2 },
    { kind: 'faction', faction: 'witch', amount: -4 },
  ];
  const rejected = validateNightProposal(broken, base);
  assert.equal(rejected.ok, false);
  assert.ok(rejected.errors.some(error => error.includes('驳回')));

  const soft = nightProposal();
  soft.mission.duration = 9999;
  soft.mission.reward = 99999;
  const clamped = validateNightProposal(soft, base);
  assert.equal(clamped.ok, true, clamped.errors.join('；'));
  assert.equal(clamped.proposal?.mission.duration, 180);
  assert.equal(clamped.proposal?.mission.reward, 1800);
  assert.ok(clamped.warnings.some(warning => warning.includes('duration')));
});

test('叙事输出被 length 截断时会放大 token 额度重试一次', async () => {
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  const profile = {
    name: '纸灯', codename: '折光', title: '把夜色折成小船的人', element: '星光系', archetype: '治愈',
    quote: '我会把灯留给你。', goal: '找到愿意收留纸船的人。', appearance: '短发，发梢有折痕。',
    personality: '安静，喜欢折纸。', outfitDescription: '宽大的值夜制服。', focus: 'empathy', skillIds: ['glimmer-spear'],
    traits: [{ name: '夜读', description: '熄灯后才开始写字。', polarity: 'neutral' }],
  };
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    if (calls.length === 1) {
      return new Response(JSON.stringify({
        choices: [{ message: { content: '先观察立绘：银白发……{"name":"纸灯","appearance":"短发' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 900, completion_tokens: 400 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(profile) }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateGirlProfile({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'mock' }, undefined, undefined, { id: 'truncate-test', name: '截断测试', maxTokens: 400, maxContext: 4000 });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].max_tokens, 400);
    assert.equal(calls[1].max_tokens, 8000);
    assert.equal(calls[1].messages.at(-1).role, 'user');
  } finally {
    globalThis.fetch = original;
  }
});

test('职阶自动分配 260 点且各项在创建范围内', () => {
  for (const archetype of ['输出', '守护', '治愈', '控制', '侦查'] as const) {
    const stats = statsForArchetype(archetype);
    assert.equal(Object.values(stats).reduce((sum, value) => sum + value, 0), 260);
    for (const value of Object.values(stats)) assert.ok(value >= 40 && value <= 96);
  }
});

test('角色起草会把立绘作为图像内容发送给视觉模型', async () => {
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ name: '纸灯', codename: '折光', title: '折夜的人', element: '星光系', archetype: '治愈', quote: '灯会亮。', goal: '找到归处。', appearance: '粉色短发，猫耳，黑粉制服。', personality: '安静。', outfitDescription: '黑粉配色的夜间制服。', focus: 'empathy', skillIds: [], traitIds: [] }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const portrait = 'data:image/webp;base64,AAAA';
    const result = await generateGirlProfile({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'vision-model' }, portrait);
    assert.equal(result.ok, true);
    const content = calls[0].messages[1].content;
    assert.equal(Array.isArray(content), true);
    assert.equal(content[1].type, 'image_url');
    assert.equal(content[1].image_url.url, portrait);
  } finally {
    globalThis.fetch = original;
  }
});

test('服装词条：把立绘作为图像内容发送，读回名称与描述', async () => {
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ name: '莓色夜巡', description: '樱色的短披肩，边缘缝着细小的糖晶，走起路来像把夜色晃出一层甜味。' }) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const portrait = 'data:image/webp;base64,AAAA';
    const result = await generateOutfitDescription({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'vision-model' }, portrait);
    assert.equal(result.ok, true);
    if (result.ok) { assert.equal(result.data.name, '莓色夜巡'); assert.ok(result.data.description.includes('糖晶')); }
    const content = calls[0].messages[1].content;
    assert.equal(Array.isArray(content), true);
    assert.equal(content[1].type, 'image_url');
    assert.equal(content[1].image_url.url, portrait);
  } finally {
    globalThis.fetch = original;
  }
});
test('编年史缓存生成内容并在存档中保留', () => {
  const base = createInitialState();
  const content = materializeNightProposal(validateNightProposal(nightProposal(), base).proposal!, base);
  const result = act(base, { type: 'addGeneratedContent', ...content });
  assert.equal(result.ok, true);
  const kinds = new Set(result.state.chronicle.map(entry => entry.kind));
  for (const kind of ['魔物', '少女', '事件', '议程', '代表', '登记'] as const) assert.ok(kinds.has(kind), `缺少 ${kind} 条目`);
  const loaded = loadState(JSON.stringify(result.state));
  assert.equal(loaded.chronicle.length, result.state.chronicle.length);
  assert.ok(loaded.chronicle.every(entry => entry.title && entry.summary));

  const spoken = act(result.state, { type: 'talk', girlId: 'yue', text: '今晚还顺利吗？', reply: '模型写下的回答。' });
  assert.equal(spoken.ok, true);
  assert.equal(spoken.state.messages.yue.at(-1)?.text, '模型写下的回答。');
});

test('契约卡可导出、校验并重新导入候选名册', () => {
  const base = createInitialState();
  const yue = base.girls.find(girl => girl.id === 'yue')!;
  const card = buildGirlCard(yue, base);
  const parsed = parseGirlCard(JSON.stringify(card));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.card.girl.skillIds.length, 3);
  const imported = act(base, { type: 'importCard', card: parsed.card });
  assert.equal(imported.ok, true);
  assert.equal(imported.state.candidates.length, base.candidates.length + 1);
  assert.equal(imported.state.candidates.at(-1)?.level, yue.level);
  assert.equal(act(imported.state, { type: 'importCard', card: parsed.card }).ok, false);
  const broken = parseGirlCard(JSON.stringify({ ...card, girl: { ...card.girl, skillIds: ['nope', 'nope2', 'nope3'] } }));
  assert.equal(broken.ok, false);
  assert.equal(act({ ...base, poolLimits: { ...base.poolLimits, candidates: 1 } }, { type: 'importCard', card: parsed.card }).ok, false);
});

test('表情差分按服装保存，支持批量、删除、候补与契约卡往返', () => {
  const base = createInitialState();
  const yue = base.girls.find(girl => girl.id === 'yue')!;
  const outfitId = yue.outfitId!;
  const calmKey = expressionVariantKey(outfitId, 'calm');
  const smileKey = expressionVariantKey(outfitId, 'smile');
  const calm = 'data:image/webp;base64,AAAA';
  const smile = 'data:image/webp;base64,BBBB';
  const saved = act(base, { type: 'setVariants', girlId: 'yue', variants: { [calmKey]: calm, [smileKey]: smile } });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.state.girls.find(girl => girl.id === 'yue')!.importedVariants, { [calmKey]: calm, [smileKey]: smile });
  assert.match(saved.message, /2 张/);

  const replaced = act(saved.state, { type: 'setVariant', girlId: 'yue', key: calmKey, dataUrl: 'data:image/png;base64,CCCC' });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.state.girls.find(girl => girl.id === 'yue')!.importedVariants![calmKey], 'data:image/png;base64,CCCC');

  const candidate = base.candidates[0];
  const candidateSaved = act(replaced.state, { type: 'setVariant', girlId: candidate.id, key: expressionVariantKey('uniform', 'shy'), dataUrl: smile });
  assert.equal(candidateSaved.ok, true);
  assert.ok(candidateSaved.state.candidates.find(girl => girl.id === candidate.id)!.importedVariants);
  const candidateDeleted = act(candidateSaved.state, { type: 'deleteVariant', girlId: candidate.id, key: expressionVariantKey('uniform', 'shy') });
  assert.equal(candidateDeleted.ok, true);
  assert.equal(candidateDeleted.state.candidates.find(girl => girl.id === candidate.id)!.importedVariants![expressionVariantKey('uniform', 'shy')], undefined);

  assert.equal(act(saved.state, { type: 'setVariant', girlId: 'yue', key: 'bad-key', dataUrl: calm }).ok, false);
  assert.equal(act(saved.state, { type: 'setVariant', girlId: 'yue', key: calmKey, dataUrl: 'https://example.com/a.png' }).ok, false);

  const fullOutfit = Object.fromEntries(EXPRESSIONS.map(expression => [expressionVariantKey(outfitId, expression), calm]));
  const fullSaved = act(saved.state, { type: 'setVariants', girlId: 'yue', variants: fullOutfit });
  assert.equal(fullSaved.ok, true);
  const otherOutfit = yue.wardrobe?.find(outfit => outfit.id !== outfitId);
  assert.ok(otherOutfit);
  const otherKey = expressionVariantKey(otherOutfit!.id, 'calm');
  const crossOutfit = act(fullSaved.state, { type: 'setVariants', girlId: 'yue', variants: { [otherKey]: smile } });
  assert.equal(crossOutfit.ok, true);
  assert.equal(Object.keys(crossOutfit.state.girls.find(girl => girl.id === 'yue')!.importedVariants!).length, EXPRESSIONS.length + 1);

  assert.equal(act(saved.state, { type: 'deleteVariant', girlId: 'yue', key: smileKey }).state.girls.find(girl => girl.id === 'yue')!.importedVariants![smileKey], undefined);

  const imported = act(saved.state, { type: 'importWardrobe', girlId: 'yue', outfits: [{ id: 'temp', name: '雨衣', description: '测试', palette: ['#333'], layerKey: 'casual' }] });
  const withTemp = act(imported.state, { type: 'setVariant', girlId: 'yue', key: expressionVariantKey('temp', 'calm'), dataUrl: calm });
  assert.equal(withTemp.ok, true);
  const removed = act(withTemp.state, { type: 'removeOutfit', girlId: 'yue', outfitId: 'temp' });
  assert.equal(removed.ok, true);
  assert.equal(removed.state.girls.find(girl => girl.id === 'yue')!.importedVariants![expressionVariantKey('temp', 'calm')], undefined);

  const girl = saved.state.girls.find(girl => girl.id === 'yue')!;
  const card = buildGirlCard(girl, saved.state);
  const parsed = parseGirlCard(JSON.stringify(card));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.card.girl.importedVariants, girl.importedVariants);
  assert.notEqual(girlCardHash(buildGirlCard({ ...girl, importedVariants: { [calmKey]: 'data:image/webp;base64,DDDD' } }, saved.state)), girlCardHash(card));
});

test('自定义登记可携带多套衣柜、表情差分与魔女化立绘', () => {
  const s = act(createInitialState(), { type: 'reset', mode: 'blank' }).state;
  const calm = 'data:image/webp;base64,AAAA';
  const smile = 'data:image/webp;base64,BBBB';
  const angry = 'data:image/webp;base64,CCCC';
  const draft = {
    name: '灰灯', codename: '夜班', title: '带着整柜衣服登记的人', element: '月影系' as const, archetype: '输出' as const,
    color: '#d98aa8', quote: '衣服也是契约的一部分。', goal: '把每一套衣服都穿去值夜', appearance: '短发', personality: '认真', outfitDescription: '自己缝的制服',
    stats: { magic: 65, insight: 65, agility: 65, empathy: 65 },
    skillIds: ['glimmer-spear', 'peach-ward', 'starlight-fall'],
    traits: [{ name: '整装待发', description: '出门前会检查三遍。', polarity: 'neutral' as const }],
    portrait: calm,
    wardrobe: [
      { id: 'uniform', name: '值夜制服', description: '制服。', palette: ['#d98aa8'], layerKey: 'uniform', portrait: calm },
      { id: 'casual', name: '休闲装', description: '便服。', palette: ['#8fb8c9'], layerKey: 'casual', portrait: smile },
    ],
    outfitId: 'casual',
    importedVariants: {
      'uniform:calm': calm,
      'casual:smile': smile,
      'witchform:angry': angry,
      'gone:shy': smile,
    },
    witchForm: { id: 'witchform', name: '魔女化 · 夜之形', description: '另一种轮廓。', palette: ['#2a1524', '#c478b8'], layerKey: 'formal', form: 'witch' as const, portrait: angry },
  };
  const created = act(s, { type: 'createGirl', draft });
  assert.equal(created.ok, true);
  const girl = created.state.candidates[0];
  assert.equal(girl.wardrobe.length, 2);
  assert.equal(girl.outfitId, 'casual');
  assert.equal(girl.wardrobe[1].name, '休闲装');
  assert.equal(girl.importedVariants?.['uniform:calm'], calm);
  assert.equal(girl.importedVariants?.['casual:smile'], smile);
  assert.equal(girl.importedVariants?.['witchform:angry'], angry);
  assert.equal(girl.importedVariants?.['gone:shy'], undefined);
  assert.equal(girl.witchForm?.id, 'witchform');
  assert.ok(girl.witchForm?.portrait);

  const card = buildGirlCard(girl, created.state);
  assert.equal(card.girl.witchForm?.id, 'witchform');
  assert.equal(card.girl.wardrobe?.length, 2);
  assert.equal(card.girl.importedVariants?.['witchform:angry'], angry);
  assert.equal(card.girl.importedVariants?.['gone:shy'], undefined);

  const base = createInitialState();
  const yue = base.girls.find(item => item.id === 'yue')!;
  yue.witchForm = { id: 'witchform', name: '魔女化 · 夜之形', description: '另一种轮廓。', palette: ['#2a1524', '#c478b8'], layerKey: 'formal', form: 'witch', portrait: angry };
  yue.importedVariants = { 'witchform:angry': angry };
  const roundTrip = parseGirlCard(JSON.stringify(buildGirlCard(yue, base)));
  assert.equal(roundTrip.ok, true);
  if (!roundTrip.ok) return;
  assert.equal(roundTrip.card.girl.witchForm?.id, 'witchform');
  assert.equal(roundTrip.card.girl.witchForm?.portrait, angry);
  assert.equal(roundTrip.card.girl.importedVariants?.['witchform:angry'], angry);
  assert.notEqual(girlCardHash(buildGirlCard(yue, base)), girlCardHash(buildGirlCard({ ...yue, witchForm: undefined }, base)));
});

test('衣柜包读取活动服装立绘、过滤孤立差分并保留魔女化', () => {
  const uniform = 'data:image/png;base64,AAAA';
  const casual = 'data:image/png;base64,BBBB';
  const witch = 'data:image/png;base64,CCCC';
  const parsed = readWardrobePackage({
    girl: {
      outfits: [
        { id: 'uniform', name: '值夜制服', palette: ['#d98aa8'], layerKey: 'uniform', portrait: uniform },
        { id: 'casual', name: '休闲装', palette: ['#8fb8c9'], layerKey: 'casual', portrait: casual },
      ],
      outfitId: 'casual',
      importedVariants: {
        'uniform:calm': uniform,
        'casual:smile': casual,
        'witchform:angry': witch,
        'gone:shy': casual,
      },
      witchForm: { id: 'wrong', name: '魔女化', palette: ['#2a1524'], layerKey: 'formal', form: 'witch', portrait: witch },
    },
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.outfits.length, 2);
  assert.equal(parsed.outfitId, 'casual');
  assert.equal(parsed.portrait, casual);
  assert.deepEqual(Object.keys(parsed.importedVariants).sort(), ['casual:smile', 'uniform:calm', 'witchform:angry']);
  assert.equal(parsed.witchForm?.id, 'witchform');
  assert.equal(parsed.witchForm?.portrait, witch);
  assert.equal(readWardrobePackage({ outfits: [] }).ok, false);
});

test('对话上下文包含角色特性、同伴关系、完整历史与战斗记录', async () => {
  const base = createInitialState();
  const yue = base.girls.find(girl => girl.id === 'yue')!;
  const withHistory = {
    ...base,
    messages: { ...base.messages, yue: Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'girl' as const : 'player' as const, text: `第${index + 1}句对话` })) },
    battles: [{
      id: 'b-test', missionId: 'm', missionTitle: '镜中的另一轮月亮', seed: 1, startedAt: { day: 14, minutes: 1300 }, round: 6, rounds: 6,
      units: [{ uid: 'ally-yue', side: 'ally', name: '月见桃', portrait: '', color: '#f3aec9', hp: 100, maxHp: 120, spirit: 80, maxSpirit: 100, stats: yue.stats, skills: [], cooldown: {}, effects: [], down: false, insightRoll: 10, scarHit: 0, dealt: 240, taken: 80, healed: 20, controlled: 0, kills: 1 }],
      initiative: [], events: [], outcome: 'victory' as const, createdAt: '',
    }],
  };
  const original = globalThis.fetch;
  let payload = '';
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    payload = String(init?.body ?? '');
    return new Response(JSON.stringify({ choices: [{ message: { content: '她轻轻点头。' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateDialogue({ endpoint: 'https://mock.local/v1', apiKey: 'k', model: 'mock' }, { girl: yue, state: withHistory, text: '今晚怎么样？' });
    assert.equal(result.ok, true);
    const body = JSON.parse(payload) as { messages: { role: string; content: string }[] };
    const system = body.messages[0].content;
    assert.ok(system.includes(yue.traits[0].name));
    assert.ok(system.includes('与同伴的关系'));
    assert.ok(system.includes('镜中的另一轮月亮'));
    assert.ok(system.includes('第12句对话') === false);
    assert.equal(body.messages.filter(message => message.role === 'assistant' || message.role === 'user').length, 13);
    assert.ok(body.messages.some(message => message.content === '第12句对话'));
  } finally { globalThis.fetch = original; }
});

test('严格存档导入接受 v6，拒绝损坏与截断文件', () => {
  const state = createInitialState();
  assert.equal(importState(JSON.stringify(state))?.day, state.day);
  assert.equal(importState('{"version":6,"girls":[]}'), null);
  assert.equal(importState('not json'), null);
  assert.equal(importState(JSON.stringify({ ...state, version: 2 })), null);
});

test('九个辖区按 city.svg 地形覆盖全城，坐标归入正确辖区', () => {
  assert.equal(districtOrder.length, 9);
  assert.equal(new Set(districtOrder).size, 9);
  assert.equal(districtAt(24, 27), 'candy');
  assert.equal(districtAt(66, 25), 'station');
  assert.equal(districtAt(42, 51), 'clocktower');
  assert.equal(districtAt(12, 52), 'oldtown');
  assert.equal(districtAt(76, 62), 'cathedral');
  assert.equal(districtAt(58, 72), 'docks');
  assert.equal(districtAt(88, 22), 'plaza');
  const names = districtOrder.map(id => districts[id].name);
  assert.equal(new Set(names).size, 9);
  assert.ok(districtOrder.every(id => districts[id].description.length >= 30));
  assert.ok(effectLines(districts.docks.effect).some(line => line.label.includes('伤害')));
  assert.ok(districts.oldtown.points.length >= 6 && districts.oldtown.name.includes('旧城'));
});

test('辖区环境影响委托目标、报酬与截止时间', () => {
  const state = createInitialState();
  const base: Mission = {
    id: 'probe', title: '测试信号', category: '调查', description: '', x: 76, y: 62,
    difficulty: '★★', duration: 30, reward: 1000, requirement: 'insight', target: 100,
    color: '#fff', status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 3,
  };
  // v19 起快照把辖区地形、当主势力与辖区污染三份效果叠在一起算，
  // 所以这里的期望值同时锁定「地形 ±%」与「污染折算 %」两层。
  const short = annotateMission(state, base);
  assert.equal(short.district, 'cathedral');
  assert.equal(short.window, 'urgent');
  assert.equal(short.environment?.targetPct, 16);
  assert.equal(short.target, 116);
  assert.equal(short.reward, 1180);
  assert.equal(short.pollutionAtSpawn, 38);
  assert.equal(short.deadlineAt, state.day * 1440 + state.minutes + 120);
  const long = annotateMission(state, { ...base, duration: 120, x: 24, y: 27 });
  assert.equal(long.district, 'candy');
  assert.equal(long.window, 'long');
  assert.equal(long.target, 101);
  assert.equal(long.reward, 1210);
  assert.equal(long.deadlineAt, deadlineFor('long', state.day, state.minutes));
});

test('委托按三个时段放号，紧急委托到点失效且不能派遣', () => {
  let s = createInitialState();
  assert.equal(WAVE_AT.length, 3);
  assert.equal(s.missions.filter(m => m.id.startsWith('c-14-0-')).length, 3);
  assert.equal(s.missions.filter(m => m.status === 'expired').length, 0);
  s = act(s, { type: 'advance', minutes: 120 }).state;
  assert.equal(s.minutes, 22 * 60);
  assert.equal(s.missions.filter(m => m.id.startsWith('c-14-1-')).length, 2);
  assert.ok(s.missions.some(m => m.status === 'expired'));
  s = act(s, { type: 'advance', minutes: 120 }).state;
  assert.equal(s.minutes, 24 * 60);
  assert.equal(s.missions.filter(m => m.id.startsWith('c-14-2-')).length, 2);
  const expired = s.missions.filter(m => m.status === 'expired');
  assert.ok(expired.length >= 2);
  const denied = act(s, { type: 'dispatch', missionId: expired[0].id, squad: ['yue'] });
  assert.equal(denied.ok, false);
});

test('自定义契约礼装占衣柜一格，衣柜上限四格', () => {
  assert.equal(WARDROBE_LIMIT, 4);
  const outfit = customOutfitFor({
    color: '#f3aec9', outfitDescription: '黑缎长裙与银色月纹披肩',
    portrait: 'data:image/webp;base64,AAAA',
  });
  assert.equal(outfit.id, 'custom');
  assert.equal(outfit.custom, true);
  assert.equal(outfit.description, '黑缎长裙与银色月纹披肩');
  assert.ok(outfit.portrait?.startsWith('data:image/'));
  assert.equal(outfit.palette[0], '#f3aec9');
  const state = createInitialState();
  const yue = state.girls.find(g => g.id === 'yue');
  assert.ok(yue);
  assert.equal(yue.wardrobe.length, 3);
  assert.equal(yue.wardrobe.filter(item => item.id === 'custom').length, 0);
  const named = customOutfitFor({ color: '#ffffff', outfitDescription: '白' });
  assert.equal(named.portrait, undefined);
});

test('衣柜导入支持合并、替换与满额截断，并至少保留一格', () => {
  const state = createInitialState();
  const extra: Outfit[] = [
    { id: 'w1', name: '晚礼服', description: '测试', palette: ['#111'], layerKey: 'formal' },
    { id: 'w2', name: '雨衣', description: '测试', palette: ['#222'], layerKey: 'casual' },
    { id: 'w3', name: '旧制服', description: '测试', palette: ['#333'], layerKey: 'uniform' },
  ];
  const merged = act(state, { type: 'importWardrobe', girlId: 'yue', outfits: extra });
  assert.equal(merged.ok, true);
  assert.equal(merged.state.girls.find(g => g.id === 'yue')!.wardrobe.length, 4);
  assert.ok(merged.message.includes('2 套'));
  const replaced = act(merged.state, { type: 'importWardrobe', girlId: 'yue', mode: 'replace', outfits: extra.slice(0, 2) });
  assert.equal(replaced.ok, true);
  const replacedGirl = replaced.state.girls.find(g => g.id === 'yue')!;
  assert.equal(replacedGirl.wardrobe.length, 2);
  assert.equal(replacedGirl.outfitId, 'w1');
  let cur = replaced.state;
  while (cur.girls.find(g => g.id === 'yue')!.wardrobe.length > 1) {
    const left = cur.girls.find(g => g.id === 'yue')!.wardrobe;
    const strip = act(cur, { type: 'removeOutfit', girlId: 'yue', outfitId: left[0].id });
    assert.equal(strip.ok, true);
    cur = strip.state;
  }
  const last = cur.girls.find(g => g.id === 'yue')!.wardrobe[0];
  const refused = act(cur, { type: 'removeOutfit', girlId: 'yue', outfitId: last.id });
  assert.equal(refused.ok, false);
});

test('SillyTavern 预设导入采样参数、主提示与忽略清单', () => {
  const st = JSON.stringify({
    name: '月见台预设', temp_openai: 0.45, top_p_openai: 0.8, openai_max_tokens: 320,
    openai_max_context: 6000, pres_pen_openai: 0.4, main: '主提示文本', jailbreak: '约束文本',
    wi_format: '[WI]', top_k_openai: 40,
  });
  const parsed = importPresetJson(st);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.preset?.name, '月见台预设');
  assert.ok(parsed.ignored.includes('wi_format'));
  const runtime = presetRuntime(parsed.preset);
  assert.equal(runtime.temperature, 0.45);
  assert.equal(runtime.topP, 0.8);
  assert.equal(runtime.maxTokens, 320);
  assert.equal(runtime.maxContext, 6000);
  assert.equal(runtime.presencePenalty, 0.4);
  assert.equal(runtime.main, '主提示文本');
  const wrapped = withPresetPrompts('原始系统提示', runtime);
  assert.ok(wrapped.system.includes('原始系统提示'));
  assert.ok(wrapped.system.includes('主提示文本'));
  assert.ok(wrapped.system.includes('约束文本'));
  assert.equal(builtinPresets().length, 3);
  const nested = importPresetObject({ name: 'ST 导出', settings: { temp_openai: 1.1, prompts: [{ identifier: 'main', content: '嵌套主提示' }] } });
  assert.equal(nested.preset?.prompts?.[0]?.content, '嵌套主提示');
  const clamped = presetRuntime({ ...parsed.preset!, settings: { ...parsed.preset!.settings, temp_openai: 9, openai_max_tokens: 1 } });
  assert.equal(clamped.temperature, 2);
  assert.equal(clamped.maxTokens, 64);
});

test('内置预设的最大输出统一抬到 6000–10000', () => {
  const builtins = builtinPresets();
  assert.equal(builtins.length, 3);
  for (const preset of builtins) {
    const runtime = presetRuntime(preset);
    assert.ok((runtime.maxTokens ?? 0) >= 6000, `${preset.name} 最大输出 ${runtime.maxTokens} 低于 6000`);
    assert.ok((runtime.maxTokens ?? 0) <= 10000, `${preset.name} 最大输出 ${runtime.maxTokens} 高于 1 万`);
  }
});

test('存量预设的最大输出会被一次性抬到 8000', () => {
  withMemoryStorage(() => {
    const store = globalThis as unknown as { localStorage: { setItem: (key: string, value: string) => void } };
    const stamp = '2025-01-01T00:00:00.000Z';
    store.localStorage.setItem('night-sugar:presets', JSON.stringify([
      { id: 'legacy-small', name: '旧的小预设', createdAt: stamp, updatedAt: stamp, settings: { temp_openai: 0.8, openai_max_tokens: 640 } },
      { id: 'legacy-flat', name: '平铺键名预设', createdAt: stamp, updatedAt: stamp, settings: { temperature: 0.7, max_tokens: 320 } },
      { id: 'legacy-high', name: '本来就够大', createdAt: stamp, updatedAt: stamp, settings: { openai_max_tokens: 16000 } },
    ]));
    const loaded = loadPresets();
    assert.equal(loaded.find(preset => preset.id === 'legacy-small')?.settings.openai_max_tokens, 8000, '偏小的额度抬到 8000');
    assert.equal(loaded.find(preset => preset.id === 'legacy-flat')?.settings.openai_max_tokens, 8000, '平铺键名也会被接管');
    assert.equal(loaded.find(preset => preset.id === 'legacy-high')?.settings.openai_max_tokens, 16000, '已经更高的预设不动');
    assert.equal(loadPresets().find(preset => preset.id === 'legacy-small')?.settings.openai_max_tokens, 8000, '第二次加载保持稳定');
  });
});

test('平铺采样键名、prompt_order 与宏展开按 ST 语义处理', () => {
  const flat = importPresetJson(JSON.stringify({
    name: 'Reborn 风格', temperature: 1.08, top_p: 0.98, openai_max_tokens: 65535, openai_max_context: 2000000,
    prompts: [
      { identifier: 'main', name: '主提示', content: '你是 {{char}} 的叙事者。{{// 注释\n跨行 }}', role: 'system' },
      { identifier: 'userpersona', name: '用户', content: '{{user}} 是所长。', role: 'system' },
      { identifier: 'unused', name: '未在顺序里', content: '不该出现。', role: 'system' },
      { identifier: 'vars', name: '变量', content: '{{setvar::x::1}}设定块', role: 'system' },
    ],
    prompt_order: [{ character_id: 100000, order: [{ identifier: 'unused', enabled: true }] }, { character_id: 100001, order: [{ identifier: 'main', enabled: true }, { identifier: 'userpersona', enabled: true }, { identifier: 'vars', enabled: true }, { identifier: 'unused', enabled: false }] }],
  }));
  assert.equal(flat.ok, true);
  const runtime = presetRuntime(flat.preset);
  assert.equal(runtime.temperature, 1.08);
  assert.equal(runtime.topP, 0.98);
  assert.equal(runtime.maxTokens, 32768);
  assert.equal(runtime.maxContext, 400000);
  assert.equal(activePrompts(flat.preset).length, 17);
  const wrapped = withPresetPrompts('基础。', runtime, { user: '白鸟', charName: '月见桃' });
  assert.ok(wrapped.system.includes('月见桃 的叙事者'));
  assert.ok(!wrapped.system.includes('注释'));
  assert.ok(wrapped.system.includes('白鸟 是所长'));
  assert.ok(!wrapped.system.includes('不该出现'));
  assert.ok(!wrapped.system.includes('setvar'));
  const macro = expandPresetMacros('{{char}} / {{user}} / {{getvar::x}}', { user: '所长', char: '月见桃，绯色回响。' });
  assert.equal(macro.text, '月见桃 / 所长 / ');
  const warned = importPresetObject({ name: '工具预设', extensions: { SPreset: {} }, prompts: [{ identifier: 'tool', content: '调用 game_content 输出。' }] });
  assert.ok(warned.warnings.some(text => text.includes('SPreset')));
  assert.equal(warned.unsupported.length, 1);
  const again = importPresetJson(exportPresetJson({ ...flat.preset!, settings: flat.preset!.settings }));
  assert.equal(again.preset?.promptOrder?.length, 17);
  assert.equal(again.preset?.promptOrder?.[0].identifier, 'main');
});

test('LLM 请求快照按标签记录实际读取的内容', () => {
  const snapshot = requestSnapshot(
    [{ role: 'system', content: '系统提示' }, { role: 'user', content: '今晚怎么样？' }],
    { model: 'mock', temperature: 0.7 },
    ['世界观与角色卡', '玩家这句话'],
  );
  assert.equal(snapshot.messageCount, 2);
  assert.deepEqual(snapshot.sections.map(section => section.label), ['世界观与角色卡', '玩家这句话']);
  assert.equal(snapshot.sections[0].text, '系统提示');
  assert.equal(snapshot.params.temperature, 0.7);
});

test('营业时间跨午夜：20:00 开门，次日 02:00 打烊', () => {
  assert.equal(SHIFT_START, 20 * 60);
  assert.equal(SHIFT_END, 26 * 60);
  assert.equal(clockLabel(1500), '01:00');
  assert.equal(shiftPhase(1200), 'open');
  assert.equal(shiftPhase(1320), 'deep');
  assert.equal(shiftPhase(1440), 'midnight');
  assert.equal(shiftPhase(1500), 'closing');
  assert.equal(shiftPhase(1560), 'closed');
  assert.equal(dateLabel(14, 1500), '第 14 日 · 01:00');
  const s = createInitialState(); s.minutes = SHIFT_END - 30;
  const r = act(s, { type: 'advance', minutes: 180 });
  assert.equal(r.state.day, 14); assert.equal(r.state.minutes, SHIFT_END);
  const next = act(r.state, { type: 'endNight' });
  assert.equal(next.state.day, 15); assert.equal(next.state.minutes, SHIFT_START);
});

test('旧存档迁移：白天时段的 v7 存档回到当晚 20:00', () => {
  const s = createInitialState(); s.version = 7; s.minutes = 8 * 60;
  const loaded = loadState(JSON.stringify(s));
  assert.equal(loaded.version, 12);
  assert.equal(loaded.minutes, SHIFT_START);
  const midnight = createInitialState(); midnight.minutes = 1500;
  assert.equal(loadState(JSON.stringify(midnight)).minutes, 1500);
  assert.equal(importState(JSON.stringify({ ...createInitialState(), version: 13 })), null);
});

// ── v6：势力辖区 ────────────────────────────────────────────────
test('势力辖区每局随机、三方各三片，且有占领上限', () => {
  const map = assignTerritories('territory-seed');
  const counts = territoryCounts(map);
  assert.equal(Object.keys(map).length, 9);
  assert.deepEqual([...FACTION_ORDER].map(id => counts[id]).sort(), [3, 3, 3]);
  const drafted = { ...map };
  for (const id of Object.keys(drafted) as (keyof typeof drafted)[]) drafted[id] = 'witch';
  assert.equal(canClaim(drafted, 'witch'), false);
  const repaired = repairTerritories(drafted, 'territory-seed');
  assert.ok(Object.values(repaired).every(value => FACTION_ORDER.includes(value)));
  assert.equal(effectiveDistrictEffect(map, 'candy').rewardPct, (districts.candy.effect.rewardPct ?? 0) + (factionEffect[map.candy].rewardPct ?? 0));
  assert.equal(ownedDistricts(map, map.candy).includes('candy'), true);
});

test('接受议会决议可以改变辖区归属并记入台账', () => {
  const s = createInitialState();
  const opinion = s.opinions.find(item => item.status === 'pending');
  assert.ok(opinion);
  const owner = Object.entries(s.territories).find(([, faction]) => faction !== 'witch')![0] as keyof typeof s.territories;
  opinion!.options = opinion!.options.map(option => option.id === 'accept' ? { ...option, shift: { district: owner, faction: 'witch' } } : option);
  const r = act(s, { type: 'decideOpinion', opinionId: opinion!.id, decision: 'accept' });
  assert.equal(r.ok, true);
  assert.equal(r.state.territories[owner], 'witch');
  assert.ok(r.state.territoryLog.some(entry => entry.district === owner && entry.to === 'witch'));
});

// ── v6：长期委托与打烊保留 ──────────────────────────────────────
test('长期委托按天计算截止时间并可跨夜保留', () => {
  const s = createInitialState();
  const long = s.missions.find(mission => mission.window === 'long' && (mission.longDays ?? 0) >= 2);
  assert.ok(long, '开局应有一条 2–7 天的长期委托');
  assert.equal(long!.deadlineAt, shiftCloseAt(s.day + (long!.longDays ?? LONG_MIN_DAYS) - 1));
  assert.ok((long!.longDays ?? 0) >= LONG_MIN_DAYS && (long!.longDays ?? 0) <= LONG_MAX_DAYS);
  const next = act(s, { type: 'endNight' }).state;
  const kept = next.missions.find(mission => mission.id === long!.id);
  assert.ok(kept, '未过期的长期委托应保留到下一夜');
  assert.equal(kept!.status, 'open');
  assert.ok(kept!.deadlineAt! > next.day * 1440 + SHIFT_START);
});

// ── v6：空白档案 ────────────────────────────────────────────────
test('空白档案只有会客厅与启动资金，并放行首次登记', () => {
  const s = act(createInitialState(), { type: 'reset', mode: 'blank' }).state;
  assert.equal(s.blank, true);
  assert.equal(s.girls.length, 0);
  assert.equal(s.candidates.length, 0);
  assert.equal(s.gold, 6000);
  assert.equal(s.reputation, 0);
  assert.equal(s.rooms.length, 1);
  assert.equal(s.rooms[0].type, 'lounge');
  const draft = { name: '初灯', codename: '首夜', title: '刚签下名字的人', element: '星光系' as const, archetype: '输出' as const, color: '#f49abd', quote: '请多指教。', goal: '活过第一晚', appearance: '短发', personality: '紧张', outfitDescription: '借来的制服', stats: { magic: 65, insight: 65, agility: 65, empathy: 65 }, skillIds: ['glimmer-spear', 'peach-ward', 'starlight-fall'], traits: [{ name: '手心出汗', description: '第一次出任务。', polarity: 'neutral' as const }], portrait: '' };
  const created = act(s, { type: 'createGirl', draft });
  assert.equal(created.ok, true);
  assert.equal(created.state.candidates.length, 1);
});

// ── v6：魔女化立绘 ──────────────────────────────────────────────
test('魔女化立绘在侵蚀 40 后解锁，可切换与还原', () => {
  const s = createInitialState();
  const yue = s.girls.find(girl => girl.id === 'yue')!;
  yue.corruption = 20;
  const forbidden = act(s, { type: 'setWitchForm', girlId: 'yue', outfit: { id: 'witchform', name: '魔女化 · 夜之形', description: '另一种轮廓。', palette: ['#2a1524', '#c478b8', '#f3aec9'], layerKey: 'formal', form: 'witch' } });
  assert.equal(forbidden.ok, false);
  const unlocked = structuredClone(s);
  unlocked.girls.find(girl => girl.id === 'yue')!.corruption = 45;
  const on = act(unlocked, { type: 'setWitchForm', girlId: 'yue', outfit: { id: 'witchform', name: '魔女化 · 夜之形', description: '另一种轮廓。', palette: ['#2a1524', '#c478b8', '#f3aec9'], layerKey: 'formal', form: 'witch' } });
  assert.equal(on.ok, true);
  const witch = on.state.girls.find(girl => girl.id === 'yue')!;
  assert.equal(witch.witch, true);
  assert.equal(witch.witchForm?.form, 'witch');
  assert.equal(act(on.state, { type: 'setWitchForm', girlId: 'yue', outfit: null }).state.girls.find(girl => girl.id === 'yue')!.witch, false);
});

test('魔女化立绘可提前预留，切换后锁定服装并改写可编辑的负面性格', () => {
  const base = createInitialState();
  const yue = base.girls.find(girl => girl.id === 'yue')!;
  yue.corruption = 20;
  const outfit = { id: 'witchform', name: '魔女化 · 夜之形', description: '被执念拖长影子。', palette: ['#2a1524', '#c478b8', '#f3aec9'], layerKey: 'witch', form: 'witch' as const, portrait: 'data:image/svg+xml;base64,PHN2Zy8+' };
  const reserved = act(base, { type: 'setWitchForm', girlId: 'yue', outfit, activate: false });
  assert.equal(reserved.ok, true);
  const reservedGirl = reserved.state.girls.find(girl => girl.id === 'yue')!;
  assert.equal(Boolean(reservedGirl.witch), false);
  assert.equal(reservedGirl.witchForm?.portrait, outfit.portrait);
  assert.equal(reservedGirl.witchPersonality, undefined);

  const stillLocked = act(reserved.state, { type: 'changeOutfit', girlId: 'yue', outfitId: 'casual' });
  assert.equal(stillLocked.ok, true);

  const ready = structuredClone(reserved.state);
  ready.girls.find(girl => girl.id === 'yue')!.corruption = 45;
  const activated = act(ready, { type: 'setWitchForm', girlId: 'yue', outfit });
  assert.equal(activated.ok, true);
  const witch = activated.state.girls.find(girl => girl.id === 'yue')!;
  assert.equal(witch.witch, true);
  assert.match(witch.witchPersonality ?? '', /偏执/);
  assert.match(witch.witchPersonality ?? '', new RegExp(witch.personality.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const locked = act(activated.state, { type: 'changeOutfit', girlId: 'yue', outfitId: 'casual' });
  assert.equal(locked.ok, false);
  assert.equal(locked.state.girls.find(girl => girl.id === 'yue')!.witch, true);
  assert.equal(locked.state.girls.find(girl => girl.id === 'yue')!.outfitId, witch.outfitId);

  const edited = act(activated.state, { type: 'setPersonality', girlId: 'yue', text: '只想把所长留在身边，其他声音都该消失。' });
  const editedWitch = edited.state.girls.find(girl => girl.id === 'yue')!;
  assert.equal(editedWitch.witchPersonality, '只想把所长留在身边，其他声音都该消失。');
  assert.equal(editedWitch.personality, witch.personality);

  const restored = act(edited.state, { type: 'setWitchForm', girlId: 'yue', outfit: null });
  const normal = restored.state.girls.find(girl => girl.id === 'yue')!;
  assert.equal(normal.witch, false);
  assert.equal(normal.witchForm?.id, 'witchform');
  assert.equal(normal.witchPersonality, '只想把所长留在身边，其他声音都该消失。');
  const normalEdit = act(restored.state, { type: 'setPersonality', girlId: 'yue', text: '还是会先把茶泡好。' });
  assert.equal(normalEdit.state.girls.find(girl => girl.id === 'yue')!.personality, '还是会先把茶泡好。');
  assert.equal(normalEdit.state.girls.find(girl => girl.id === 'yue')!.witchPersonality, '只想把所长留在身边，其他声音都该消失。');

  const card = buildGirlCard(normal, { day: 1 });
  assert.equal(card.girl.witchPersonality, '只想把所长留在身边，其他声音都该消失。');
  const parsed = parseGirlCard(JSON.stringify(card));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.card.girl.witchPersonality, '只想把所长留在身边，其他声音都该消失。');
  assert.notEqual(girlCardHash(card), girlCardHash({ ...card, girl: { ...card.girl, witchPersonality: '另一种魔女化记录。' } }));

  const cleared = act(restored.state, { type: 'clearWitchForm', girlId: 'yue' });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.state.girls.find(girl => girl.id === 'yue')!.witchForm, undefined);
  assert.equal(Boolean(cleared.state.girls.find(girl => girl.id === 'yue')!.witch), false);
});

// ── v6：角色故事线 ──────────────────────────────────────────────
test('故事线需要羁绊，逐幕选择会推进并在落幕时归档', () => {
  const s = createInitialState();
  s.girls.find(girl => girl.id === 'yue')!.bond = 8;
  assert.equal(act(s, { type: 'startStoryline', girlId: 'yue' }).ok, false);
  const ready = structuredClone(s);
  ready.girls.find(girl => girl.id === 'yue')!.bond = 50;
  const started = act(ready, { type: 'startStoryline', girlId: 'yue' });
  assert.equal(started.ok, true);
  let current = started.state;
  const storyline = current.storylines.find(item => item.girlId === 'yue')!;
  assert.equal(storyline.beats.length, 4);
  assert.equal(storyline.source, 'template');
  assert.ok(storyline.beats.every(beat => beat.mission?.goal), '模板故事线也要给出明确目标');
  // v7：带委托的幕不再直接给选项，这里移除 mission 以覆盖旧的纯选项路径。
  const legacy = structuredClone(current);
  const legacyStory = legacy.storylines.find(item => item.id === storyline.id)!;
  legacyStory.beats.forEach(beat => { beat.mission = undefined; });
  current = legacy;
  for (const beat of legacyStory.beats) {
    const choice = beat.choices[0];
    current = act(current, { type: 'decideStoryChoice', storylineId: legacyStory.id, beatId: beat.id, choiceId: choice.id }).state;
  }
  const done = current.storylines.find(item => item.id === storyline.id)!;
  assert.equal(done.status, 'done');
  assert.ok(current.chronicle.some(entry => entry.title.includes(storyline.title)));
});

// ── v6：强制事件弹窗 ────────────────────────────────────────────
test('强制事件会阻塞推进，处理后才可继续并可结算效果', () => {
  const s = createInitialState();
  s.gold = 5000;
  const incident: Incident = {
    id: 'inc-test-1', day: s.day, kind: 'faction', source: 'rule', title: '代行者的账单', body: '市役所希望你先垫付一笔修缮费。', faction: 'government',
    options: [{ id: 'o1', label: '先垫付', hint: '−800 星砂，安定度 +6', effect: { gold: -800, reputation: 6 } }], status: 'pending',
  };
  const added = act(s, { type: 'addIncident', incident });
  assert.equal(added.ok, true);
  const blocked = act(added.state, { type: 'advance', minutes: 30 });
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /必须立刻决定/);
  const resolved = act(added.state, { type: 'resolveIncident', incidentId: 'inc-test-1', optionId: 'o1' });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.state.gold, 4200);
  assert.equal(resolved.state.reputation, s.reputation + 6);
  assert.equal(act(resolved.state, { type: 'advance', minutes: 30 }).ok, true);
});

test('打烊时会把手上的异常摆上桌面', () => {
  const s = createInitialState();
  s.girls.find(girl => girl.id === 'yue')!.fatigue = 96;
  const next = act(s, { type: 'endNight' }).state;
  assert.ok(next.incidents.some(item => item.status === 'pending' && item.source === 'rule'));
});

// ── v6：角色事件 ────────────────────────────────────────────────
test('角色事件带角标、逐场推进并可做出选择', () => {
  const s = createInitialState();
  const event = {
    id: 'ev-test', girlId: 'yue', title: '灯下的第二杯茶', hook: '她把杯子推过来。', day: s.day, source: 'template' as const, badge: true, stage: 0, status: 'active' as const,
    scenes: [
      { id: 's1', title: '第一场', narration: '茶杯还热着。', lines: [{ speaker: '月见桃', tone: 'soft', text: '「坐吧。」' }], choices: [{ id: 'c1', label: '坐下', intent: '温柔', effect: { bond: 4 } }, { id: 'c2', label: '站着', intent: '克制', effect: { corruption: 1 } }] },
      { id: 's2', title: '第二场', narration: '灯芯爆了一下。', lines: [{ speaker: '月见桃', text: '「明天也来吗？」' }], choices: [{ id: 'c3', label: '会来', intent: '承诺', effect: { bond: 6 } }] },
    ],
  };
  const added = act(s, { type: 'addCharacterEvent', event });
  assert.equal(added.ok, true);
  assert.equal(added.state.girls.find(girl => girl.id === 'yue')!.eventBadge, '新');
  const moved = act(added.state, { type: 'advanceEvent', eventId: 'ev-test' });
  assert.equal(moved.state.events[0].stage, 1);
  const chosen = act(moved.state, { type: 'resolveEvent', eventId: 'ev-test', choiceId: 'c3' });
  assert.equal(chosen.ok, true);
  assert.equal(chosen.state.events[0].status, 'done');
  assert.equal(chosen.state.girls.find(girl => girl.id === 'yue')!.eventBadge, undefined);
});

test('势力辖区可以按回合修复，缺片时用种子补齐', () => {
  const map = assignTerritories('repair-seed');
  const partial = { candy: map.candy } as Record<string, 'witch' | 'association' | 'government'>;
  const repaired = repairTerritories(partial as never, 'repair-seed');
  assert.equal(Object.keys(repaired).length, 9);
  assert.equal(repaired.candy, map.candy);
});
test('预设词条：导出再导入保持顺序、角色、禁用与分隔标记', () => {
  const preset: ChatPreset = {
    id: 'p1', name: '词条往返', settings: { temp_openai: 0.5 }, createdAt: 'a', updatedAt: 'b',
    prompts: [
      { id: 'a', name: '甲', content: '第一段', role: 'system', enabled: true },
      { id: 'm', name: '分隔', content: '', role: 'system', enabled: true, marker: true },
      { id: 'b', name: '乙', content: '第二段', role: 'user', enabled: false },
    ],
  };
  const round = importPresetJson(exportPresetJson(preset));
  assert.equal(round.ok, true);
  const entries = presetPrompts(round.preset);
  assert.deepEqual(entries.map(entry => entry.id), ['a', 'm', 'b']);
  assert.equal(entries[1].marker, true);
  assert.equal(entries[2].enabled, false);
  assert.equal(entries[2].role, 'user');
});

test('预设词条替换变量，缺失变量与分隔标记不进入系统提示', () => {
  const entries = [
    { id: 'a', name: '档案', content: '委托人：{{player}}', role: 'system' as const, enabled: true },
    { id: 'm', name: '分隔', content: '', role: 'system' as const, enabled: true, marker: true },
    { id: 'b', name: '缺省', content: '辖区：{{district}}', role: 'system' as const, enabled: true },
    { id: 'c', name: '停用', content: '不该出现', role: 'system' as const, enabled: false },
  ];
  const rendered = renderPresetSystem(entries, { player: '白鸟' });
  assert.ok(rendered.system.includes('委托人：白鸟'));
  assert.ok(!rendered.system.includes('{{district}}'));
  assert.ok(!rendered.system.includes('不该出现'));
  assert.deepEqual(rendered.used.sort(), ['district', 'player']);
  assert.deepEqual(rendered.missing, ['district']);
  assert.ok(promptTokens('今夜有雨') >= 4);
});

test('旧预设把 main / jailbreak 迁成词条，玩家档案拼成可注入文本', () => {
  const legacy = importPresetObject({ name: '旧预设', settings: { main: '旧主提示', jailbreak: '旧约束' } });
  const entries = presetPrompts(legacy.preset);
  assert.equal(entries.length, 15);
  assert.ok(entries[0].content.includes('旧主提示'));
  assert.ok(entries[1].content.includes('旧约束'));
  const wrapped = withPresetPrompts('系统底稿', { ...presetRuntime(legacy.preset), entries });
  assert.ok(wrapped.system.includes('系统底稿'));
  assert.ok(wrapped.system.includes('旧主提示'));
  assert.equal(DEFAULT_PROMPTS.length, 13);
  assert.deepEqual(DEFAULT_PROMPTS.filter(entry => entry.scope === 'shared').map(entry => entry.id), ['world', 'player', 'tone', 'task']);
  assert.equal(DEFAULT_PROMPTS.filter(entry => entry.scope === 'chat').length, 1);
  assert.equal(DEFAULT_PROMPTS.filter(entry => entry.scope === 'daily').length, 1);
  assert.equal(DEFAULT_PROMPTS.filter(entry => entry.scope === 'battle').length, 1);
  const summary = playerSummary({ name: '白鸟', alias: '所长', pronoun: '他', appearance: '旧风衣', personality: '寡言', background: '接手事务所', relation: '同事' });
  assert.ok(summary.includes('白鸟（所长）'));
  assert.ok(summary.includes('旧风衣'));
  assert.equal(playerSummary({ name: '', alias: '', pronoun: '', appearance: '', personality: '', background: '', relation: '' }), '');
});
test('每个生成任务独立绑定预设，旧三档绑定会迁移', () => {
  assert.equal(PROMPT_TASK_SCOPES.length, 9);
  assert.ok(!PROMPT_TASK_SCOPES.map(String).includes('shared'));
  assert.deepEqual(Object.keys(DEFAULT_PRESET_BINDING), PROMPT_TASK_SCOPES);
  const legacy = normalizeBinding({ chat: 'preset-a', generate: 'preset-b', story: 'preset-c' });
  assert.equal(legacy.chat, 'preset-a');
  assert.equal(legacy.daily, 'preset-b');
  assert.equal(legacy.profile, 'preset-b');
  assert.equal(legacy.outfit, 'preset-b');
  assert.equal(legacy.storyline, 'preset-c');
  assert.equal(legacy.event, 'preset-c');
  assert.equal(legacy.battle, DEFAULT_PRESET_BINDING.battle);
  assert.equal(legacy.arc, 'preset-c');
  assert.equal(legacy.incident, 'preset-c');
  const partial = normalizeBinding({ chat: 'preset-d', daily: 'preset-e' });
  assert.equal(partial.chat, 'preset-d');
  assert.equal(partial.daily, 'preset-e');
  assert.equal(partial.profile, DEFAULT_PRESET_BINDING.profile);
});
test('默认预设按任务拆开并改名为对应任务', () => {
  const builtins = builtinPresets();
  const workspace = ensureTaskPresets(builtins, { ...DEFAULT_PRESET_BINDING });
  assert.equal(workspace.created, PROMPT_TASK_SCOPES.length);
  assert.equal(Object.values(workspace.binding).length, PROMPT_TASK_SCOPES.length);
  assert.equal(new Set(Object.values(workspace.binding)).size, PROMPT_TASK_SCOPES.length);
  for (const task of PROMPT_TASK_SCOPES) {
    const preset = workspace.presets.find(item => item.id === workspace.binding[task]);
    assert.ok(preset);
    assert.equal(preset.name, promptScopeLabel(task));
    assert.equal(preset.builtin, false);
    assert.ok(presetPrompts(preset).length >= DEFAULT_PROMPTS.length);
  }
  assert.equal(builtins.length, 3, '不应修改内置预设');
  const again = ensureTaskPresets(workspace.presets, workspace.binding);
  assert.equal(again.created, 0);
  assert.equal(again.presets.length, workspace.presets.length);
  assert.deepEqual(again.binding, workspace.binding);
});

test('旧共用副本按任务拆开时保留配置并去掉旧名字', () => {
  const builtins = builtinPresets();
  const source = builtins[0];
  const oldCopy: ChatPreset = {
    ...source, id: 'copy-old', name: `${source.name} 副本`, builtin: false,
    api: { model: 'legacy-model' }, prompts: presetPrompts(source).map(entry => ({ ...entry, builtin: false })),
  };
  const binding = { ...DEFAULT_PRESET_BINDING, storyline: oldCopy.id, event: oldCopy.id };
  const workspace = ensureTaskPresets([...builtins, oldCopy], binding);
  const story = workspace.presets.find(item => item.id === workspace.binding.storyline);
  const event = workspace.presets.find(item => item.id === workspace.binding.event);
  assert.ok(story && event);
  assert.equal(story.id, oldCopy.id);
  assert.equal(story.name, '故事线');
  assert.equal(story.api?.model, 'legacy-model');
  assert.equal(event.name, '私人事件');
  assert.notEqual(event.id, story.id);
  assert.equal(workspace.presets.filter(item => item.name.endsWith('副本')).length, 0);
});
test('自定义的「… 副本」不会被任务默认预设改名', () => {
  const builtins = builtinPresets();
  const source = builtins[0];
  const custom: ChatPreset = { ...source, id: 'copy-mine', name: '我的 副本', builtin: false };
  const binding = { ...DEFAULT_PRESET_BINDING, storyline: custom.id, event: custom.id };
  const workspace = ensureTaskPresets([...builtins, custom], binding);
  const story = workspace.presets.find(item => item.id === workspace.binding.storyline);
  const event = workspace.presets.find(item => item.id === workspace.binding.event);
  assert.ok(story && event);
  assert.equal(workspace.presets.find(item => item.id === custom.id)?.name, '我的 副本');
  assert.equal(story.name, '故事线');
  assert.equal(event.name, '私人事件');
  assert.notEqual(story.id, event.id);
});
test('世界书内置 15 条，默认只启用 7 条常驻词条', () => {
  assert.equal(builtinWorldbook().length, 15);
  const defaults = defaultWorldbook();
  assert.equal(defaults.filter(entry => entry.enabled).length, 7);
  assert.ok(defaults.filter(entry => entry.enabled).every(entry => entry.constant));
  assert.ok(defaults.some(entry => entry.id === 'clinic'));
  assert.ok(defaults.some(entry => entry.id === 'office-profile'));
});

test('世界书按关键词命中，常驻优先进入且超预算会跳过', () => {
  const entries = [
    { id: 'clinic', name: '诊所', keys: ['治疗'], content: '治疗按小时恢复。', enabled: true, constant: false, priority: 3, order: 0 },
    { id: 'night', name: '夜班', keys: ['午夜'], content: '夜班六小时。', enabled: true, constant: true, priority: 9, order: 0 },
    { id: 'off', name: '停用', keys: ['治疗'], content: '不该出现。', enabled: false, constant: false, priority: 1, order: 0 },
  ];
  const hit = worldbookContext('她需要治疗', entries);
  assert.deepEqual(hit.hits.map(entry => entry.id), ['night', 'clinic']);
  assert.equal(hit.hits[0].reason, 'constant');
  assert.ok(hit.text.includes('### 诊所'));
  const tight = worldbookContext('她需要治疗', entries, 8);
  assert.equal(tight.hits.length, 0);
  assert.equal(tight.dropped, 2);
});

test('世界书与 SillyTavern 导出格式往返，并夹取非法字段', () => {
  const source = { entries: { 0: { uid: 0, key: ['夜班', '值班'], comment: '夜班规则', content: '六小时。', constant: true, disable: false, order: 3, priority: 7 } } };
  const imported = importWorldbookJson(JSON.stringify(source));
  assert.equal(imported.ok, true);
  const entry = imported.entries![0];
  assert.deepEqual(entry.keys, ['夜班', '值班']);
  assert.equal(entry.name, '夜班规则');
  assert.equal(entry.constant, true);
  assert.equal(entry.order, 3);
  const back = JSON.parse(exportWorldbookJson(imported.entries!));
  assert.deepEqual(back.entries['0'].key, ['夜班', '值班']);
  assert.equal(back.entries['0'].disable, false);
  const bad = sanitizeWorldbookEntry({ content: 'x', priority: 'oops', order: 9999 }, 0);
  assert.equal(bad!.enabled, true);
  assert.equal(bad!.priority, 50);
  assert.ok(bad!.order <= 999);
});

test('数值规则夹取越界值，并修正长期委托上下限', () => {
  const rules = sanitizeBalance({ clinicBase: -50, clinicPerHp: 999, squadLimit: 9, corruptionThreshold: 0, longMinDays: 9, longMaxDays: 1 });
  assert.equal(rules.clinicBase, 0);
  assert.equal(rules.clinicPerHp, 60);
  assert.equal(rules.squadLimit, 5);
  assert.equal(rules.corruptionThreshold, 10);
  assert.equal(rules.longMaxDays, rules.longMinDays);
  assert.equal(sanitizeBalance({}).clinicBase, DEFAULT_BALANCE.clinicBase);
  assert.equal(BALANCE_FIELDS.length, 10);
  clearBalanceCache();
});

test('故事线每一幕发布带明确目标的特殊委托', () => {
  const s = createInitialState();
  const yue = s.girls.find(girl => girl.id === 'yue')!;
  yue.bond = 60;
  const started = act(s, { type: 'startStoryline', girlId: 'yue' });
  assert.equal(started.ok, true);
  const story = started.state.storylines[0];
  assert.ok(story.beats.every(beat => beat.mission?.title && beat.mission.goal), '每一幕都要有明确目标');
  const mission = started.state.missions.find(item => item.storylineId === story.id);
  assert.ok(mission, '第一幕应立刻发出委托');
  assert.equal(mission.storyBeatId, 'beat-1');
  assert.equal(mission.window, 'long');
  assert.equal(mission.work, 'investigation');
  assert.ok((mission.storyGoal ?? '').length > 0);
  assert.ok(mission.reward > 0 && mission.duration >= 60);
  assert.equal(act(started.state, { type: 'deleteMission', missionId: mission.id }).ok, false, '故事委托不能删除');
  const night = act(started.state, { type: 'endNight' }).state;
  assert.ok(night.missions.some(item => item.id === mission.id), '故事委托跨夜保留');
  assert.equal(night.storylines[0].status, 'active');
});

test('故事委托完成后生成剧情事件，事件结束才推进下一幕', () => {
  const s = createInitialState();
  const yue = s.girls.find(girl => girl.id === 'yue')!;
  yue.bond = 60;
  const started = act(s, { type: 'startStoryline', girlId: 'yue' }).state;
  const story = started.storylines[0];
  const mission = started.missions.find(item => item.storylineId === story.id)!;
  const copy = JSON.parse(JSON.stringify(started)) as typeof started;
  const target = copy.missions.find(item => item.id === mission.id)!;
  const event = completeStoryMission(copy, target)!;
  assert.ok(event, '完成委托应生成事件');
  const beat = copy.storylines[0].beats[0];
  assert.equal(beat.status, 'done');
  assert.equal(beat.eventId, event.id);
  assert.equal(copy.storylines[0].stage, 0, '事件没结束前不推进');
  assert.equal(copy.girls.find(girl => girl.id === 'yue')!.eventBadge, '新');
  let after = act(copy, { type: 'advanceEvent', eventId: event.id }).state;
  after = act(after, { type: 'advanceEvent', eventId: event.id }).state;
  assert.equal(after.storylines[0].stage, 1, '事件结束后进入第二幕');
  assert.ok(after.missions.some(item => item.storyBeatId === 'beat-2'), '第二幕的委托应发出');
});


test('故事委托可以指定同行者、专属魔物与专属装备', () => {
  const s = createInitialState();
  const yue = s.girls.find(girl => girl.id === 'yue')!;
  yue.bond = 60;
  s.gold = 99999;
  const started = act(s, { type: 'startStoryline', girlId: 'yue' }).state;
  const story = started.storylines[0];
  const beat = story.beats[0];
  const monster = {
    id: 'story-mon-test', name: '纸蛾', epithet: '没寄出的信', rank: '游荡' as const, element: '梦境系' as const,
    color: '#c9a2d8', maxHp: 260, maxSpirit: 60,
    stats: { magic: 90, insight: 80, agility: 88, empathy: 70 },
    skillIds: ['paper-cut', 'static-veil'], trait: '只在她回头时出现。', description: '从信封里飞出来的东西。',
    spec: { bodyPlan: 'moth' as const, scale: 1, appendages: 6, core: '糖' as const, palette: { body: '#3a2638', shade: '#241726', rim: '#f3aec9' }, aura: '花瓣' as const, motif: '糖' as const },
    codex: { habit: '沿着旧路来回飞。', weakness: '被叫出名字就会散。' },
  };
  beat.mission = {
    ...beat.mission!,
    companion: { name: '纸鸢', codename: '信使', element: '梦境系', appearance: '总抱着一叠旧信。', personality: '说话很轻。', outfitDescription: '洗旧的邮差外套。' },
    monsters: [monster],
    rewardEquipment: { id: 'relic-test', name: '她的旧发卡', faction: 'witch', slot: 'charm', price: 0, standingReq: 0, description: '从信里掉出来的。', maxHpBonus: 5 },
    followUpEvent: { title: '信的另一面', hook: '她把信翻过来，背面还有一行字。' },
    followUpIncident: {
      id: 'inc-test', day: 14, kind: 'girl', source: 'rule', title: '她想去寄这封信', body: '她站在门口，等你点头。',
      options: [
        { id: 'o1', label: '陪她去', hint: '花掉一点星砂', effect: { gold: -300, bond: 3 } },
        { id: 'o2', label: '让她自己去', hint: '她需要独处', effect: { corruption: 2 } },
      ],
      status: 'pending',
    },
  };
  beat.missionId = undefined;
  const state = structuredClone(started);
  const mission = spawnStoryBeat(state, state.storylines[0])!;
  assert.ok(mission, '应发出带注入物的故事委托');
  assert.equal(mission.work, 'combat');
  assert.ok(mission.enemyIds?.includes('story-mon-test'));
  assert.ok(state.customMonsters?.some(item => item.id === 'story-mon-test'));
  assert.ok(mission.rewardEquipmentId);
  const candidate = state.candidates.find(girl => girl.id === mission.requiredGirlId);
  assert.ok(candidate, '应落一位新候选者');
  assert.equal(candidate.name, '纸鸢');
  assert.equal(act(state, { type: 'dispatch', missionId: mission.id, girlIds: ['yue'] }).ok, false, '缺少指定同行者时应拒绝');
  const hired = act(state, { type: 'hire', girlId: candidate.id });
  assert.equal(hired.ok, true);
  const dispatched = act(hired.state, { type: 'dispatch', missionId: mission.id, girlIds: ['yue', candidate.id] });
  assert.equal(dispatched.ok, true);
  const copy = structuredClone(dispatched.state);
  const target = copy.missions.find(item => item.id === mission.id)!;
  target.status = 'done';
  const event = completeStoryMission(copy, target)!;
  assert.ok(copy.inventory[mission.rewardEquipmentId!] >= 1, '专属装备应进背包');
  assert.ok(copy.incidents.some(item => item.status === 'pending' && item.id.startsWith('inc-story-')), '应摆出后续强制事件');
  assert.ok(event.scenes.length >= 3, '额外事件应追加到事件场次里');
});

test('手写剧本随契约卡导出导入，并可直接按手稿开场', () => {
  const s = createInitialState();
  const yue = s.girls[0];
  const plan = storyPlanTemplate('未寄出的信', '她有一封没寄出的信。');
  plan.tone = '克制的温柔';
  plan.beats = plan.beats.map((beat, index) => ({
    ...beat,
    title: ['等到灯灭', '那件旧事', '没说出口的', '天亮之前'][index],
    summary: '她把话留在桌上。',
    scene: '夜班的钟走到一半，她出现在门口。',
    hook: '信纸边缘有一道被反复折过的痕。',
    choices: [
      { id: 'c1', label: '把椅子往她那边挪一点', intent: '先接住她', effect: { bond: 3 } },
      { id: 'c2', label: '先不催她，去倒一杯热水', intent: '给她时间', effect: { bond: 1, corruption: 1 } },
    ],
    mission: index === 0 ? { title: '未寄出的信', goal: '陪她把信送到旧城区。', category: '故事委托', difficulty: '常规', duration: 90 } : undefined,
  }));

  const saved = act(s, { type: 'setStoryPlan', girlId: yue.id, plan });
  assert.equal(saved.ok, true);
  assert.equal(saved.state.girls[0].storyPlan?.title, '未寄出的信');

  const card = parseGirlCard(JSON.stringify(buildGirlCard(saved.state.girls[0], { day: saved.state.day, packHash: saved.state.packHash })));
  assert.equal(card.ok, true);
  if (card.ok) {
    assert.equal(card.card.girl.storyPlan?.title, '未寄出的信');
    assert.equal(card.card.girl.storyPlan?.beats.length, 4);
    assert.equal(card.card.girl.storyPlan?.beats[0].hook, '信纸边缘有一道被反复折过的痕。');
  }

  const ready = structuredClone(saved.state);
  ready.girls[0].bond = 60;
  const started = act(ready, { type: 'startStoryline', girlId: yue.id });
  assert.equal(started.ok, true);
  const story = started.state.storylines[0];
  assert.equal(story.source, 'manual');
  assert.ok(story.graph && story.run);
  assert.ok(story.beats.length >= 4);
  const missionBeat = story.beats.find(beat => beat.missionId);
  assert.ok(missionBeat);
  assert.equal(started.state.missions.some(mission => mission.storyBeatId === missionBeat?.id), true);

  const cleared = act(started.state, { type: 'setStoryPlan', girlId: yue.id, plan: null });
  assert.equal(cleared.state.girls[0].storyPlan, undefined);
});

test('LLM 蓝图草稿会补齐 id、连线与布局，且严格校验只放行完整分支', () => {
  const graph = buildGraphFromDraft(blueprintDraft());
  assert.equal(graph.entry, 'n1');
  assert.equal(graph.nodes.length, 8);
  assert.equal(graph.edges.length, 8);
  assert.equal(new Set(graph.nodes.map(node => node.id)).size, 8);
  assert.equal(new Set(graph.edges.map(edge => edge.id)).size, 8);
  assert.ok(graph.edges.every(edge => edge.id && edge.from && edge.to));
  assert.ok(graph.nodes.every(node => node.x >= 0 && node.y >= 0));
  const xOf = (id: string) => graph.nodes.find(node => node.id === id)?.x ?? 0;
  assert.ok(xOf('n1') < xOf('n2') && xOf('n2') < xOf('n3'), '默认布局应沿入口向右展开');
  assert.deepEqual(blueprintIssues(graph).filter(issue => issue.level === 'error'), []);

  const messy = buildGraphFromDraft({
    nodes: [
      { id: 'start 1', kind: 'start', data: { kind: 'start' } },
      { id: 'scene 1', kind: 'scene', data: { kind: 'scene' } },
      { id: 'end 1', kind: 'end', data: { kind: 'end' } },
    ],
    edges: [
      { from: 'start 1', to: 'scene 1' },
      { from: 'scene 1', to: 'end 1' },
      { from: 'start 1', to: 'scene 1' },
    ],
  });
  assert.equal(messy.nodes[0].id, 'start1');
  assert.equal(messy.edges.length, 2, '同一条连线只应保留一次');

  const brokenDraft = blueprintDraft();
  brokenDraft.edges = brokenDraft.edges.filter(edge => !(edge.from === 'n5' && edge.fromPort === 'failure'));
  const broken = buildGraphFromDraft(brokenDraft);
  const brokenErrors = blueprintIssues(broken).filter(issue => issue.level === 'error').map(issue => issue.message);
  assert.ok(brokenErrors.some(message => message.includes('失败')), '阶段委托缺少失败出口必须报错');
  assert.ok(brokenErrors.some(message => message.includes('结束')), '没有路径到结束必须报错');

  const loopDraft = blueprintDraft();
  loopDraft.edges = [...(loopDraft.edges ?? []), { from: 'n6', to: 'n3' }];
  assert.ok(blueprintIssues(buildGraphFromDraft(loopDraft)).some(issue => issue.message.includes('环')));
});

test('无密钥的本地四幕模板可以直接兜底成一张可玩蓝图', () => {
  const girl = createInitialState().girls[0];
  const plan = fallbackStoryPlan(girl);
  assert.equal(plan.title, `${girl.name}的故事`);
  assert.equal(plan.beats.length, 4);
  assert.ok(plan.graph && plan.graph.nodes.length >= 8);
  assert.equal(playableStoryPlan(plan), true);
  assert.deepEqual(validateGraph(plan.graph!).filter(issue => issue.level === 'error'), []);
});

test('只有图的蓝图可以保存、随卡导出并直接开场推进', () => {
  const s = createInitialState();
  const girl = s.girls[0];
  girl.bond = 60;
  const graph = buildGraphFromDraft(blueprintDraft());
  const plan = { title: '雨里的蓝图', premise: '她带着一封没有地址的信。', tone: '克制', beats: [], graph };
  const saved = act(s, { type: 'setStoryPlan', girlId: girl.id, plan });
  assert.equal(saved.ok, true);
  assert.equal(saved.state.girls[0].storyPlan?.beats.length, 0);
  assert.equal(saved.state.girls[0].storyPlan?.graph?.nodes.length, 8);

  const card = parseGirlCard(JSON.stringify(buildGirlCard(saved.state.girls[0], { day: saved.state.day, packHash: saved.state.packHash })));
  assert.equal(card.ok, true);
  if (card.ok) {
    assert.equal(card.card.girl.storyPlan?.beats.length, 0);
    assert.equal(card.card.girl.storyPlan?.graph?.nodes.length, 8);
  }

  const ready = structuredClone(saved.state);
  ready.girls[0].bond = 60;
  const started = act(ready, { type: 'startStoryline', girlId: girl.id });
  assert.equal(started.ok, true);
  const story = started.state.storylines[0];
  assert.ok(story.graph);
  assert.ok(story.beats.length > 0, '图里的场景应补成 UI 可读的幕');
  assert.equal(story.run?.waiting?.kind, 'choice');
  const moved = act(started.state, { type: 'chooseStoryPort', storylineId: story.id, port: 'a' });
  assert.equal(moved.ok, true);
  assert.equal(moved.state.storylines[0].status, 'done');
  assert.ok(moved.state.girls[0].bond > ready.girls[0].bond);
});

test('有结构错误的蓝图可以存成草稿，但不能开场', () => {
  const s = createInitialState();
  const girl = s.girls[0];
  const draft = blueprintDraft();
  draft.edges = draft.edges?.filter(edge => !(edge.from === 'n3' && edge.fromPort === 'a'));
  const graph = buildGraphFromDraft(draft);
  const plan = { title: '还差一条线', premise: '', tone: '', beats: [], graph };
  const saved = act(s, { type: 'setStoryPlan', girlId: girl.id, plan });
  assert.equal(saved.ok, true, '未完成的蓝图允许保存成草稿');
  const ready = structuredClone(saved.state);
  ready.girls[0].bond = 60;
  const started = act(ready, { type: 'startStoryline', girlId: girl.id });
  assert.equal(started.ok, false);
  assert.ok(!started.ok && started.message.includes('蓝图还有'));
  assert.equal(sanitizeStoryPlan({ ...plan, beats: [] })?.graph?.nodes.length, 8);
});

test('LLM 直接生成完整蓝图，结构不合格时只修复一次', async () => {
  const girl = createInitialState().girls[0];
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  const okRaw = { title: '雨里的蓝图', premise: '她带着一封没有地址的信。', tone: '克制', ...blueprintDraft() };
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body ?? '{}')));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(okRaw) }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateStoryBlueprint({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'mock' }, girl);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.title, '雨里的蓝图');
      assert.equal(result.data.graph.nodes.length, 8);
      assert.equal(result.data.graph.edges.length, 8);
    }
    assert.equal(calls.length, 1);
    assert.ok(Number(calls[0].max_tokens) >= 5200);
    assert.ok(JSON.stringify(calls[0].messages).includes('故事蓝图'));
    assert.ok(JSON.stringify(calls[0].messages).includes('nodes'));
  } finally { globalThis.fetch = original; }

  const repairCalls: Record<string, any>[] = [];
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    repairCalls.push(JSON.parse(String(init?.body ?? '{}')));
    const content = repairCalls.length === 1
      ? JSON.stringify({ nodes: [{ id: 'n1', kind: 'start', data: { kind: 'start' } }], edges: [] })
      : JSON.stringify(okRaw);
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const repaired = await generateStoryBlueprint({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'mock' }, girl);
    assert.equal(repaired.ok, true);
    assert.equal(repairCalls.length, 2);
    assert.ok(JSON.stringify(repairCalls[1].messages).includes('必须修正的问题'));
    if (repaired.ok) assert.equal(repaired.data.graph.nodes.length, 8);
  } finally { globalThis.fetch = original; }
});

test('无 Key 的模板剧情有四段上千字，逐段选择后收束并推进故事线', () => {
  const s = createInitialState();
  const yue = s.girls.find(girl => girl.id === 'yue')!;
  yue.bond = 60;
  const started = act(s, { type: 'startStoryline', girlId: 'yue' }).state;
  const state = structuredClone(started);
  const story = state.storylines[0];
  const mission = spawnStoryBeat(state, story)!;
  const event = completeStoryMission(state, mission)!;
  assert.equal(event.mode, 'story');
  assert.equal(event.passages?.length, 0);
  const arc = buildTemplateArc(state.girls.find(girl => girl.id === 'yue')!, story.premise, event.hook);
  assert.equal(arc.length, 4);
  const total = arc.reduce((sum, passage) => sum + passage.narration.length, 0);
  assert.ok(total >= 1000, `模板剧情应上千字，实际 ${total}`);
  const begun = act(state, { type: 'beginStoryEvent', eventId: event.id, passages: arc, summary: '这一晚收束。' });
  assert.ok(begun.ok);
  let cur = begun.state;
  for (let index = 0; index < arc.length; index += 1) {
    const current = cur.events.find(item => item.id === event.id)!;
    const passage = current.passages![current.passageIndex ?? 0];
    const chosen = act(cur, { type: 'chooseStoryPassage', eventId: event.id, choiceId: passage.choices[0].id });
    assert.ok(chosen.ok, chosen.ok ? '' : chosen.message);
    cur = chosen.state;
  }
  const finished = cur.events.find(item => item.id === event.id)!;
  assert.equal(finished.status, 'done');
  assert.ok((cur.storylines[0].stage ?? 0) >= 1, '剧情收束后应推进故事线');
});
test('prompt_order 决定注入顺序与启停，ST 宏会被展开', () => {
  const imported = importPresetObject({
    prompt_order: [{ character_id: 100001, order: [
      { identifier: 'third', enabled: true },
      { identifier: 'first', enabled: true },
      { identifier: 'second', enabled: false },
    ] }],
    prompts: [
      { identifier: 'first', name: '一', content: '{{user}} 与 {{char}}', role: 'system', enabled: true },
      { identifier: 'second', name: '二', content: '停用', role: 'system', enabled: true },
      { identifier: 'third', name: '三', content: '{{setvar::x::}}{{comment}}', role: 'system', enabled: true },
    ],
  });
  assert.equal(imported.ok, true);
  if (!imported.ok || !imported.preset) return;
  const ordered = activePrompts(imported.preset!);
  assert.deepEqual(ordered.slice(0, 3).map(entry => entry.id), ['third', 'first', 'second']);
  assert.equal(renderPresetSystem(ordered, {}).system.includes('停用'), false);
  const built = withPresetPrompts('基础', presetRuntime(imported.preset!), { user: '白鸟', char: '月见桃，绯色回响。' });
  assert.match(built.system, /白鸟 与 月见桃/);
  assert.equal(built.system.includes('{{setvar'), false);
});

test('applyFormat 单占位原样放入，{0} 才包装', () => {
  assert.equal(applyFormat('{{scenario}}', '场景内容'), '场景内容');
  assert.equal(applyFormat('【场景】\n{0}', '场景内容'), '【场景】\n场景内容');
  assert.equal(applyFormat('', '内容'), '内容');
});

test('预设接口选择：本地免密钥，远程缺密钥回退全局', () => {
  const local = resolvePresetConfig({ api: { endpoint: 'http://127.0.0.1:11434/v1', model: 'local' } }, { endpoint: 'https://global', apiKey: 'g', model: 'g' });
  assert.equal(local.endpoint, 'http://127.0.0.1:11434/v1');
  assert.equal(local.model, 'local');
  const remote = resolvePresetConfig({ api: { endpoint: 'https://preset', model: 'p' } }, { endpoint: 'https://global', apiKey: 'g', model: 'g' });
  assert.equal(remote.endpoint, 'https://global');
  assert.equal(remote.model, 'g');
});test('导入会统计坏正则，并对工具调用词条给出警告', () => {
  const result = importPresetObject({
    name: '兼容检查',
    extensions: { regex_scripts: [
      { scriptName: '好的', findRegex: '/（[^）]*）/g', replaceString: '', placement: [2] },
      { scriptName: '坏的', findRegex: '/（[^）/g', replaceString: '', placement: [1] },
    ] },
    prompts: [{ identifier: 'tool', name: '工具', content: '请调用 game_content 返回 JSON', role: 'system', enabled: true }],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.preset?.regex?.length, 1);
  assert.match(result.warnings.join('\n'), /1 条正则无法解析/);
  assert.match(result.warnings.join('\n'), /工具调用/);
});

test('预设导出带 schema 4 与用途，且剥离密钥', () => {
  const preset = importPresetObject({
    name: '导出测试',
    temperature: 0.7,
    api: { endpoint: 'https://example.invalid/v1', apiKey: 'sk-secret-value', model: 'm1' },
    extensions: { regex_scripts: [{ scriptName: '去括号', findRegex: '/（[^）]*）/g', replaceString: '', placement: [1, 2] }] },
  });
  assert.equal(preset.ok, true);
  if (!preset.ok || !preset.preset) return;
  const exported = JSON.parse(exportPresetJson(preset.preset));
  assert.equal(exported.schema, 4);
  assert.equal('apiKey' in (exported.api ?? {}), false);
  assert.equal(exported.api?.model, 'm1');
  assert.equal(exported.extensions.regex_scripts[0].findRegex, '/（[^）]*）/g');
  assert.ok(exported.prompts.some((entry: { scope?: string }) => entry.scope === 'daily'));
  assert.ok(exported.prompts.some((entry: { scope?: string }) => entry.scope === 'chat'));
  assert.ok(exported.prompts.some((entry: { scope?: string }) => entry.scope === 'battle'));
  const round = importPresetObject(exported);
  assert.equal(round.ok, true);
  if (!round.ok || !round.preset) return;
  assert.equal(round.preset.regex?.[0]?.targets.join(','), 'input,output');
});

test('任务词条按用途注入，代码契约始终放在最后', () => {
  const runtime = presetRuntime(builtinPresets()[0]);
  const daily = composeTaskSystem('CONTRACT-JSON', runtime, 'daily', { player: '白鸟', context: '今晚的提案' });
  assert.ok(daily.system.includes('为今晚的夜班提案'));
  assert.ok(daily.system.includes('CONTRACT-JSON'));
  assert.ok(daily.system.trim().endsWith('CONTRACT-JSON'));
  assert.equal(daily.system.includes('你现在只扮演对方'), false);
  const chat = composeTaskSystem('CONTRACT-CHAT', runtime, 'chat', { player: '白鸟', context: '会客厅' });
  assert.ok(chat.system.includes('你现在只扮演对方'));
  assert.ok(chat.system.includes('CONTRACT-CHAT'));
  assert.ok(chat.system.trim().endsWith('CONTRACT-CHAT'));
  assert.equal(chat.system.includes('为今晚的夜班提案'), false);
  const chatEntries = activePrompts(builtinPresets()[0], 'chat');
  assert.ok(chatEntries.every(entry => promptScope(entry) === 'shared' || promptScope(entry) === 'chat'));
  assert.equal(chatEntries.some(entry => promptScope(entry) === 'daily'), false);
  const battle = composeTaskSystem('CONTRACT-BATTLE', runtime, 'battle', { player: '白鸟', context: '一场雨夜战斗' });
  assert.ok(battle.system.includes('为一场已经打完的战斗写札记'));
  assert.ok(battle.system.includes('CONTRACT-BATTLE'));
  assert.ok(battle.system.trim().endsWith('CONTRACT-BATTLE'));
  assert.equal(battle.system.includes('为今晚的夜班提案'), false);
});

test('旧每日提案的“不要数值”要求会被标记并可移除', () => {
  const legacy = '为今晚提交一份提案。只描述名字、气质、愿望与外观，不要给任何数值、奖励或规则。';
  assert.equal(promptHasMechanicBan(legacy), true);
  const cleaned = stripMechanicBan(legacy);
  assert.equal(promptHasMechanicBan(cleaned), false);
  assert.ok(cleaned.includes('为今晚提交一份提案'));
  assert.ok(!cleaned.includes('任何数值'));
  assert.equal(promptHasMechanicBan('把机制数值写清楚，奖励与规则必须具体。'), false);
});

test('导入缺少任务词条的预设会补齐默认词条并标记', () => {
  const imported = importPresetObject({ name: '只有主提示', settings: { temp_openai: 0.6, prompts: [{ identifier: 'main', content: '只写夜晚。' }] } });
  assert.equal(imported.ok, true);
  if (!imported.ok || !imported.preset) return;
  assert.equal(imported.preset.schema, 4);
  assert.ok(imported.warnings.some(text => text.includes('默认词条')));
  const entries = presetPrompts(imported.preset);
  assert.equal(entries.length, 14);
  assert.equal(entries.filter(entry => entry.scope === 'daily').length, 1);
  assert.ok(entries.find(entry => entry.scope === 'daily')?.builtin);
  assert.equal(entries.filter(entry => entry.scope === 'battle').length, 1);
  const runtime = presetRuntime(imported.preset);
  assert.equal(runtime.entries.length, 14);
  assert.equal(runtime.entries.some(entry => entry.scope === 'chat'), true);
});

test('ST 正则按 placement 与 destination 生效，预设可带独立接口', () => {
  const parsed = importPresetObject({
    name: '正则预设',
    prompts: [{ identifier: 'main', content: '主提示' }],
    extensions: {
      regex_scripts: [
        { id: 'r1', scriptName: '去掉思维链标签', findRegex: '/<think_[^>]*>[\\s\\S]*?<\\/think_[^>]*>/g', replaceString: '', placement: [2], disabled: false },
        { id: 'r2', scriptName: '玩家口癖', findRegex: '/我/g', replaceString: '咱', placement: [1], disabled: false },
        { id: 'r3', scriptName: '仅显示的样式', findRegex: '/夜糖/g', replaceString: '夜糖事务所', placement: [2], markdownOnly: true },
        { id: 'bad', scriptName: '坏正则', findRegex: '/(/g', replaceString: '', placement: [2] },
      ],
    },
  });
  assert.equal(parsed.ok, true);
  const scripts = pickRegexScripts(parsed.preset!.settings);
  assert.equal(scripts.length, 3);
  assert.ok(parsed.warnings.some(text => text.includes('无法解析')));
  assert.equal(applyRegexScripts('我说夜糖', scripts, 'input', 'prompt'), '咱说夜糖');
  const output = '<think_nya>想</think_nya>夜糖';
  assert.equal(applyRegexScripts(output, scripts, 'output', 'prompt'), '夜糖');
  assert.equal(applyRegexScripts('夜糖', scripts, 'output', 'display'), '夜糖事务所');
  const local = resolvePresetConfig({ api: { endpoint: 'http://127.0.0.1:8000/v1', model: 'local-model' } }, { endpoint: 'https://api.example.com', apiKey: 'global', model: 'global-model' });
  assert.equal(local.model, 'local-model');
  const remote = resolvePresetConfig({ api: { endpoint: 'https://api.example.com', model: 'm' } }, { endpoint: 'https://fallback', apiKey: 'k', model: 'f' });
  assert.equal(remote.model, 'f');
  const withKey = resolvePresetConfig({ api: { endpoint: 'https://api.example.com', apiKey: 'sk-x', model: 'm' } }, { endpoint: 'https://fallback', apiKey: 'k', model: 'f' });
  assert.equal(withKey.model, 'm');
  assert.equal(withKey.apiKey, 'sk-x');
  const exported = exportPresetJson({ ...parsed.preset!, api: { endpoint: 'https://api.example.com', apiKey: 'sk-secret', model: 'm' } });
  assert.ok(!exported.includes('sk-secret'));
  assert.ok(exported.includes('"endpoint"'));
});
test('剧情请求按预设的 scenario/personality 格式串拼装，并使用预设接口与正则', async () => {
  const original = globalThis.fetch;
  let seenBody: { model?: string; temperature?: number; messages?: { role: string; content: string }[] } | null = null;
  const narration = '她把伞收起来，水滴在门槛上碎成一排细小的声音，像有人在很远的地方数着拍子。'.repeat(10);
  const arc = {
    title: '雨停之前', hook: '她站在门口', summary: '一段收束',
    passages: [0, 1, 2, 3].map(index => ({
      title: `第 ${index + 1} 段`, narration,
      lines: [{ speaker: '月见桃', tone: '轻声', text: '你还在。' }],
      choices: [{ label: '让她进来', intent: '靠近', effect: { bond: 2 } }, { label: '先不说话', intent: '退开', effect: { corruption: 1 } }],
    })),
  };
  globalThis.fetch = async (_url, init) => {
    seenBody = JSON.parse(String(init?.body ?? '{}'));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(arc) }, finish_reason: 'stop' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const preset = {
    id: 'preset-story', name: '剧情预设', description: '', createdAt: '', updatedAt: '',
    settings: { temperature: 0.77, openai_max_tokens: 2048, scenario_format: '【场景】\n{0}', personality_format: '【性格】{0}' },
    prompts: [{ id: 'p1', name: '结构', content: '{{personality}}\n---\n{{scenario}}', role: 'system', enabled: true }],
    api: { endpoint: 'https://story.local/v1', apiKey: 'sk-story', model: 'story-model' },
    regex: [{ id: 'r1', name: '口癖', find: '/剧情/g', replace: '故事', targets: ['input'], enabled: true }],
  } as ChatPreset;
  const girl = createInitialState().girls[0];
  try {
    const result = await generateStoryArc(
      { endpoint: 'https://global.local/v1', apiKey: 'g', model: 'global' },
      girl,
      { premise: '雨夜', beatTitle: '第一幕', beatHook: '她站在门口' },
      presetRuntime(preset),
    );
    assert.equal(result.ok, true);
    assert.equal(seenBody?.model, 'story-model');
    assert.equal(seenBody?.temperature, 0.77);
    const system = String(seenBody?.messages?.[0]?.content ?? '');
    assert.ok(system.includes('【性格】'));
    assert.ok(system.includes('【场景】'));
    assert.ok(!system.includes('{{personality}}'));
    const user = String(seenBody?.messages?.at(-1)?.content ?? '');
    assert.ok(user.includes('故事'));
  } finally {
    globalThis.fetch = original;
  }
});

test('蓝图故事线按图推进：逐幕分岔、奖励结算后收束', () => {
  const s = createInitialState();
  const girl = s.girls[0];
  const plan = storyPlanTemplate('分岔的夜', '她在两个门口之间停下。');
  plan.beats = plan.beats.map(beat => ({ ...beat, mission: undefined }));
  const saved = act(s, { type: 'setStoryPlan', girlId: girl.id, plan });
  assert.equal(saved.ok, true);
  const ready = structuredClone(saved.state);
  ready.girls[0].bond = 60;
  const started = act(ready, { type: 'startStoryline', girlId: girl.id });
  assert.equal(started.ok, true);
  let state = started.state;
  const storyId = state.storylines[0].id;
  const bondBefore = state.girls[0].bond;
  for (let step = 0; step < 4; step += 1) {
    const story = state.storylines.find(item => item.id === storyId);
    assert.equal(story?.run?.waiting?.kind, 'choice');
    const node = story?.graph?.nodes.find(item => item.id === story.run?.waiting?.ref);
    assert.ok(node && node.data.kind === 'choice');
    if (!node || node.data.kind !== 'choice') return;
    const option = node.data.options[0];
    assert.ok(option);
    const moved = act(state, { type: 'chooseStoryPort', storylineId: storyId, port: option.id });
    assert.equal(moved.ok, true);
    state = moved.state;
  }
  const finished = state.storylines.find(item => item.id === storyId);
  assert.equal(finished?.status, 'done');
  assert.ok(state.girls[0].bond > bondBefore);
});

test('阶段委托节点要求成功 / 失败出口，并可套用现有委托模板', () => {
  const plan = storyPlanTemplate('校验故事', '只做结构校验。');
  const graph = compileBeatsToGraph({ ...plan, beats: plan.beats.slice(0, 1) });
  const start = graph.nodes.find(node => node.kind === 'start')!;
  graph.nodes.push(makeNode('mission', 900, 320, 'm-check'));
  const missionNode = graph.nodes.find(node => node.id === 'm-check')!;
  if (missionNode.data.kind === 'mission') missionNode.data.spec = { ...missionNode.data.spec, title: '夜巡', goal: '完成夜巡。' };
  graph.edges.push({ id: 'edge-check', from: start.id, fromPort: 'out', to: 'm-check' });
  const issues = validateGraph(graph);
  assert.ok(issues.some(issue => issue.level === 'error' && issue.nodeId === 'm-check' && issue.message.includes('成功')));
  assert.ok(issues.some(issue => issue.level === 'warning' && issue.nodeId === 'm-check' && issue.message.includes('失败')));
  const end = graph.nodes.find(node => node.kind === 'end')!;
  graph.edges.push({ id: 'edge-check-ok', from: 'm-check', fromPort: 'success', to: end.id });
  const fixed = validateGraph(graph);
  assert.ok(!fixed.some(issue => issue.level === 'error' && issue.nodeId === 'm-check'));
  const templates = missionTemplates();
  assert.ok(templates.length > 0);
  assert.ok(templates.every(template => template.title && template.requirement && Array.isArray(template.monsters)));
});

test('阶段委托失败会走失败出口，并继续结算后续节点', () => {
  const state = createInitialState();
  const start = makeNode('start', 0, 0, 's-fail');
  const mission = makeNode('mission', 240, 0, 'm-fail');
  const reward = makeNode('reward', 520, 0, 'r-fail');
  if (reward.data.kind === 'reward') reward.data.effect = { gold: 500 };
  const end = makeNode('end', 800, 0, 'e-fail');
  const graph: StoryGraph = {
    version: 1,
    entry: 's-fail',
    nodes: [start, mission, reward, end],
    edges: [
      { id: 'e1', from: 's-fail', fromPort: 'out', to: 'm-fail' },
      { id: 'e2', from: 'm-fail', fromPort: 'failure', to: 'r-fail' },
      { id: 'e3', from: 'r-fail', fromPort: 'out', to: 'e-fail' },
    ],
  };
  const story: Storyline = {
    id: 'story-fail-test', girlId: 'yue', title: '失败分支', premise: '', tone: '',
    beats: [{ id: 'm-fail', index: 0, title: '委托', summary: '', scene: '', hook: '', choices: [], status: 'open', missionId: 'mission-fail' }],
    stage: 0, status: 'active', createdAt: '', day: 1, source: 'manual', graph,
    run: { cursor: 'm-fail', waiting: { kind: 'mission', ref: 'mission-fail' }, visited: ['m-fail'], steps: 1 },
  };
  state.storylines = [story];
  const before = state.gold;
  resolveStoryWait(state, story.id, 'mission', 'mission-fail', 'failure');
  assert.equal(state.gold, before + 500);
  assert.equal(story.status, 'done');
});

test('奖励节点的技能、数值增长与临时增益会结算到角色身上', () => {
  const state = createInitialState();
  const girl = state.girls[0];
  girl.bond = 60;
  const start = makeNode('start', 0, 0, 's-reward');
  const reward = makeNode('reward', 240, 0, 'r-reward');
  if (reward.data.kind === 'reward') {
    reward.data.effect = {
      gold: 120,
      skill: { id: skills[1].id, name: skills[1].name },
      growth: { magic: 2 },
      buff: { name: '夜色回响', stat: 'magic', amount: 3, days: 2 },
    };
  }
  const end = makeNode('end', 520, 0, 'e-reward');
  const graph: StoryGraph = {
    version: 1,
    entry: 's-reward',
    nodes: [start, reward, end],
    edges: [
      { id: 'r1', from: 's-reward', fromPort: 'out', to: 'r-reward' },
      { id: 'r2', from: 'r-reward', fromPort: 'out', to: 'e-reward' },
    ],
  };
  const plan = { ...storyPlanTemplate('奖励测试', '奖励要真的落到身上。'), graph };
  const saved = act(state, { type: 'setStoryPlan', girlId: girl.id, plan });
  assert.equal(saved.ok, true);
  const ready = structuredClone(saved.state);
  ready.girls[0].bond = 60;
  const magicBefore = ready.girls[0].stats.magic;
  const goldBefore = ready.gold;
  const started = act(ready, { type: 'startStoryline', girlId: girl.id });
  assert.equal(started.ok, true);
  const after = started.state.girls[0];
  assert.equal(started.state.gold, goldBefore + 120);
  assert.ok(after.skills.includes(skills[1].id));
  assert.equal(after.stats.magic, magicBefore + 2);
  const buff = after.conditions.find(condition => condition.name === '夜色回响');
  assert.ok(buff);
  assert.equal(buff?.kind, 'buff');
  assert.equal(buff?.remaining, 2);
});

test('内容库只收自制条目，并能注入注册表与商店货架', () => {
  const customSkill = sanitizeSkill({
    id: 'custom-skill-test01', name: '测试星屑', school: '自制', resource: 'hp', power: 1.4,
    targets: 1, side: 'enemy', cooldown: 1, tier: 'signature',
    effects: [{ kind: 'buff', stat: 'magic', amount: 3, duration: 2, chance: 0.5 }], description: '测试用。',
  });
  const customItem = sanitizeItem({
    id: 'custom-item-test01', name: '测试护符', faction: 'witch', slot: 'charm', price: 640,
    standingReq: 2, description: '测试用。', passive: '夜班时魔力 +2', stats: { magic: 2 }, maxHpBonus: 12,
  });
  const customMonster = sanitizeMonster({ id: 'custom-monster-test01', name: '测试夜斑蝶', maxHp: 240, rules: [{ trigger: 'always', effect: 'damageReduce', amount: 20 }] });
  assert.ok(customSkill && customItem && customMonster);
  assert.equal(sanitizeSkill({ ...skills[0], id: skills[0].id }), undefined);
  const library = sanitizeLibrary({ skills: [customSkill], items: [{ ...customItem, skillId: 'custom-skill-test01' }], monsters: [{ ...customMonster, skillIds: ['custom-skill-test01'] }] });
  assert.equal(library.skills.length, 1);
  assert.equal(library.monsters[0].rules?.[0].amount, 20);
  assert.ok(library.monsters[0].skillIds.includes('custom-skill-test01'));
  assert.equal(library.items[0].skillId, 'custom-skill-test01');
  applyLibrary(library);
  assert.equal(getSkill('custom-skill-test01').name, '测试星屑');
  assert.equal(getItem('custom-item-test01').name, '测试护符');
  assert.equal(getMonster('custom-monster-test01').name, '测试夜斑蝶');
  assert.match(ruleText({ trigger: 'always', effect: 'damageReduce', amount: 20 }), /减免 20%/);
  const sold = withCustomStock([{ id: 'stock-custom-custom-item-test01', itemId: 'custom-item-test01', faction: 'witch', sold: true }]);
  assert.equal(sold.find(entry => entry.itemId === 'custom-item-test01')?.sold, true);
  const state = createInitialState();
  state.girls[0].skills.push('custom-skill-test01');
  assert.ok(contentUsage(state, 'skill', 'custom-skill-test01').includes('契约者技能栏'));
  applyLibrary(emptyLibrary());
  assert.equal(getSkill('custom-skill-test01').name, skills[0].name);
});

test('委托模板只收自制条目，能进入轮转池并投放成夜间委托', () => {
  assert.equal(sanitizeMission({ ...emptyMission(), id: 'c-base' }), undefined);
  const raw = {
    id: 'custom-mission-test01', title: '测试委托·夜航', category: '测试', description: '测试用委托。',
    difficulty: '高危', duration: 70, requirement: 'empathy', target: 80, work: 'combat',
    enemyIds: ['night-tram'], rounds: 5, recommendedLevel: 4, district: 'candy', window: 'long',
    reward: 900, color: '#123456',
  };
  const mission = sanitizeMission(raw);
  assert.ok(mission);
  assert.equal(mission.duration, 75);
  assert.equal(mission.district, 'candy');
  const library = sanitizeLibrary({ ...emptyLibrary(), missions: [raw] });
  assert.equal(library.missions.length, 1);
  applyLibrary(library);
  assert.equal(customMissionTemplates().length, 1);
  assert.ok(missionTemplates().some(option => option.id.includes('custom-mission-test01')));
  const state = createInitialState();
  const deployed = deployMissionTemplate(state, mission);
  assert.equal(deployed.templateId, 'custom-mission-test01');
  assert.equal(deployed.status, 'open');
  assert.equal(deployed.district, 'candy');
  assert.equal(deployed.window, 'long');
  assert.deepEqual(deployed.enemyIds, ['night-tram']);
  assert.ok((deployed.deadlineAt ?? 0) > (deployed.spawnedAt ?? 0));
  assert.deepEqual(contentUsage({ ...state, missions: [deployed] }, 'mission', 'custom-mission-test01'), ['当前夜晚的委托']);
  applyLibrary(emptyLibrary());
  assert.equal(customMissionTemplates().length, 0);
  assert.ok(!missionTemplates().some(option => option.id.includes('custom-mission-test01')));
});

test('弹窗卡片只收自制条目，投放时把辖区天数换算成 untilDay', () => {
  const raw = {
    id: 'custom-incident-test01', title: '雨夜的请求', body: '有人敲响了事务所的门。', kind: 'faction' as const,
    faction: 'witch' as const, district: 'candy' as const,
    options: [
      { label: '答应她', hint: '也许能换来情报。', effect: { gold: -100, reputation: 1, faction: { id: 'witch' as const, standing: 2 }, girl: { fatigue: -5, bond: 2 }, district: { id: 'candy' as const, targetPct: 10, rewardPct: 5, days: 3 } } },
      { label: '拒绝', hint: '', effect: { reputation: -1 } },
    ],
    trigger: 'manual' as const, weight: 5, oncePerDay: true, source: 'custom' as const,
  };
  const card = sanitizeIncidentCard(raw);
  assert.ok(card);
  assert.equal(card.options.length, 2);
  assert.deepEqual(card.options.map(option => option.id), ['opt-1', 'opt-2']);
  assert.equal(sanitizeIncidentCard({ ...raw, id: 'incident-builtin' }), undefined);
  assert.equal(sanitizeLibrary({ incidents: [{ ...raw, id: 'incident-builtin' }] }).incidents.length, 0);
  const library = sanitizeLibrary({ incidents: [{ ...raw, id: 'custom-incident-test01' }] });
  assert.equal(library.incidents.length, 1);
  applyLibrary(library);
  const state = createInitialState();
  const incident = deployIncidentCard(state, library.incidents[0]);
  assert.equal(incident.source, 'custom');
  assert.equal(incident.cardId, 'custom-incident-test01');
  assert.equal(incident.status, 'pending');
  assert.equal(incident.options.length, 2);
  assert.equal(incident.options[0].effect.gold, -100);
  assert.equal(incident.options[0].effect.district?.untilDay, state.day + 3);
  assert.deepEqual(contentUsage({ ...state, incidents: [incident] }, 'incident', 'custom-incident-test01'), ['当前弹窗记录']);
  applyLibrary(emptyLibrary());
});

test('MonsterRule 的伤害减免会真的作用在战斗结算里', () => {
  const initial = createInitialState();
  const girl = initial.girls.find(entry => !entry.retired) ?? initial.girls[0];
  const base = getMonster('mirror-nun');
  const mission: Mission = { ...initial.missions[0], id: 'rule-mission', title: '特性测试', enemyIds: ['custom-monster-rule01'], rounds: 4, duration: 120, work: 'combat' };
  const plain = simulateBattle({ mission, girls: [girl], day: 1, minutes: 1200, monsters: [{ ...base, id: 'custom-monster-rule01', name: '测试靶', maxHp: 800, stats: { magic: 8, insight: 8, agility: 8, empathy: 8 }, rules: [] }] });
  const tanky = simulateBattle({ mission, girls: [girl], day: 1, minutes: 1200, monsters: [{ ...base, id: 'custom-monster-rule01', name: '测试靶', maxHp: 800, stats: { magic: 8, insight: 8, agility: 8, empathy: 8 }, rules: [{ trigger: 'always', effect: 'damageReduce', amount: 90 }] }] });
  const hurt = plain.units.find(unit => unit.monster?.id === 'custom-monster-rule01');
  const guarded = tanky.units.find(unit => unit.monster?.id === 'custom-monster-rule01');
  assert.ok(hurt && guarded);
  assert.ok(hurt.taken > 0);
  assert.ok(guarded.taken < hurt.taken);
});

test('战斗札记：按回合覆盖、说话阵营与倒下校验，简报可保存替换', () => {
  const initial = createInitialState();
  const girl = initial.girls.find(entry => !entry.retired) ?? initial.girls[0];
  const base = getMonster('mirror-nun');
  const mission: Mission = { ...initial.missions[0], id: 'note-mission', title: '雨夜札记', enemyIds: ['mirror-nun'], rounds: 4, duration: 120, work: 'combat' };
  const battle = simulateBattle({ mission, girls: [girl], day: 1, minutes: 1200, monsters: [base], seed: 9 });
  const ally = battleActors(battle).find(actor => actor.side === 'ally' && actor.girlId);
  assert.ok(ally, '测试战斗应有可说话的我方角色');
  const enemyGirl = { ...battle.units.find(unit => unit.side === 'ally')!, uid: 'enemy-girl-1', side: 'enemy' as const, girlId: 'enemy-girl-1', name: '逆光少女', codename: '逆光', portrait: 'data:image/png;base64,AA==', color: '#c478b8', down: false, monster: undefined, expression: 'angry' as const };
  battle.units = [...battle.units, enemyGirl];
  const total = totalBattleRounds(battle);
  assert.ok(total >= 3);
  const prose = '雨声压低了呼吸，谁都没有先退，只有鞋底在水里挪动。'.repeat(18);
  const scene = (roundFrom: number, roundTo: number, lines: Array<Record<string, unknown>> = []) => ({ roundFrom, roundTo, title: `第 ${roundFrom} 幕`, narration: prose, lines });
  const raw = {
    title: '雨没有停',
    hook: '这一战从积水里开始。',
    summary: '最后留下的是磨损的鞋跟与一句没说完的话。',
    scenes: [
      scene(1, 1, [{ round: 1, speakerSide: 'ally', speakerId: ally!.girlId, expression: 'calm', text: '别让她靠近货架。' }]),
      scene(2, 2, [{ round: 2, speakerSide: 'enemy', speakerId: 'enemy-girl-1', expression: 'angry', text: '你们根本不知道那里面是什么。' }]),
      scene(3, total, [{ round: 3, speakerSide: 'ally', speakerId: ally!.girlId, expression: 'sad', text: '……结束了。' }]),
    ],
  };
  const checked = validateBattleNoteDraft(raw, battle, { createdAt: '2026-10-28T00:00:00.000Z' });
  assert.equal(checked.ok, true, checked.errors.join('\n'));
  assert.ok(checked.note);
  assert.equal(checked.note!.scenes.length, 3);
  assert.equal(checked.note!.charCount, battleNoteChars(checked.note!));
  assert.ok(checked.note!.charCount >= 900);
  assert.ok(battleDigest(battle).includes('逆光少女'));

  const wrongSide = structuredClone(raw);
  wrongSide.scenes[0].lines[0].speakerSide = 'enemy';
  assert.equal(validateBattleNoteDraft(wrongSide, battle, { createdAt: 'x' }).ok, false);
  const badFace = structuredClone(raw);
  badFace.scenes[0].lines[0].expression = 'blank';
  assert.equal(validateBattleNoteDraft(badFace, battle, { createdAt: 'x' }).ok, false);
  const gap = structuredClone(raw);
  gap.scenes[1].roundFrom = 3;
  assert.equal(validateBattleNoteDraft(gap, battle, { createdAt: 'x' }).ok, false);

  const brief = buildBattleBrief(battle, '2026-10-28T00:00:00.000Z');
  assert.equal(brief.source, 'template');
  assert.equal(brief.scenes.length, 3);
  assert.ok(brief.scenes.every(item => item.lines.length === 0));
  assert.deepEqual(brief.scenes.map(item => [item.roundFrom, item.roundTo]), [[1, 1], [2, 2], [3, total]]);

  const state = { ...createInitialState(), battles: [battle] };
  const saved = act(state, { type: 'saveBattleNote', note: brief });
  assert.equal(saved.ok, true);
  assert.equal(saved.state.battleNotes?.length, 1);
  const replaced = act(saved.state, { type: 'saveBattleNote', note: { ...brief, title: '第二版简报' } });
  assert.equal(replaced.state.battleNotes?.length, 1);
  assert.equal(replaced.state.battleNotes?.[0].title, '第二版简报');
  const removed = act(replaced.state, { type: 'deleteBattleNote', battleId: battle.id });
  assert.equal(removed.ok, true);
  assert.equal(removed.state.battleNotes?.length, 0);
});

test('战斗札记生成请求使用 battle 用途并采纳合法 JSON', async () => {
  const initial = createInitialState();
  const girl = initial.girls.find(entry => !entry.retired) ?? initial.girls[0];
  const mission: Mission = { ...initial.missions[0], id: 'note-llm', title: '雨夜札记', enemyIds: ['mirror-nun'], rounds: 4, duration: 120, work: 'combat' };
  const battle = simulateBattle({ mission, girls: [girl], day: 1, minutes: 1200, monsters: [getMonster('mirror-nun')], seed: 9 });
  const ally = battleActors(battle).find(actor => actor.side === 'ally' && actor.girlId);
  assert.ok(ally);
  const enemy = { ...battle.units.find(unit => unit.side === 'ally')!, uid: 'enemy-llm', side: 'enemy' as const, girlId: 'enemy-llm', name: '逆光少女', codename: '逆光', portrait: 'data:image/png;base64,AA==', color: '#c478b8', down: false, monster: undefined, expression: 'angry' as const };
  battle.units = [...battle.units, enemy];
  const total = totalBattleRounds(battle);
  const prose = '雨声压低了呼吸，谁都没有先退，只有鞋底在水里挪动。'.repeat(18);
  const raw = {
    title: '雨没有停', hook: '这一战从积水里开始。', summary: '最后留下的是磨损的鞋跟与一句没说完的话。',
    scenes: [
      { roundFrom: 1, roundTo: 1, title: '接敌', narration: prose, lines: [{ round: 1, speakerSide: 'ally', speakerId: ally!.girlId, expression: 'calm', text: '别让她靠近货架。' }] },
      { roundFrom: 2, roundTo: 2, title: '换位', narration: prose, lines: [{ round: 2, speakerSide: 'enemy', speakerId: 'enemy-llm', expression: 'angry', text: '你们根本不知道那里面是什么。' }] },
      { roundFrom: 3, roundTo: total, title: '收束', narration: prose, lines: [] },
    ],
  };
  const calls: Record<string, any>[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(raw) } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await generateBattleNote({ endpoint: 'https://mock.test/v1', apiKey: 'k', model: 'mock' }, battle);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.title, '雨没有停');
      assert.equal(result.data.source, 'llm');
      assert.ok(result.data.charCount >= 900);
    }
    assert.equal(calls.length, 1);
    assert.ok(Number(calls[0].max_tokens) >= 3600);
    assert.ok(JSON.stringify(calls[0].messages).includes('战斗札记'));
    assert.ok(JSON.stringify(calls[0].messages).includes('speakerSide'));
  } finally {
    globalThis.fetch = original;
  }
});

test('内容包能完整导出读回，非法 JSON 与版本会被拒绝', () => {
  const library = sanitizeLibrary({
    skills: [{ id: 'custom-skill-pack01', name: '打包星屑', power: 9 }],
    items: [{ id: 'custom-item-pack01', name: '打包护符', faction: 'witch', slot: 'charm', price: 300, skillId: 'custom-skill-pack01' }],
    monsters: [{ id: 'custom-monster-pack01', name: '打包夜斑蝶', maxHp: 210, skillIds: ['custom-skill-pack01'] }],
    missions: [{ id: 'custom-mission-pack01', title: '打包委托', enemyIds: ['custom-monster-pack01'] }],
    incidents: [{ id: 'custom-incident-pack01', title: '打包弹窗', body: '一条完整的正文。', options: [{ label: '好的', hint: '', effect: { gold: 50 } }, { label: '算了', hint: '', effect: {} }] }],
  });
  assert.equal(library.skills.length, 1);
  assert.equal(library.items[0].skillId, 'custom-skill-pack01');
  assert.equal(library.monsters[0].skillIds[0], 'custom-skill-pack01');
  assert.equal(library.missions[0].enemyIds[0], 'custom-monster-pack01');
  const pack = exportContentPack(library);
  assert.equal(pack.format, CONTENT_PACK_FORMAT);
  assert.equal(pack.version, 1);
  assert.equal(pack.skills.length + pack.items.length + pack.monsters.length + pack.missions.length + pack.incidents.length, 5);
  const read = readContentPack(JSON.stringify(pack));
  assert.equal(read.ok, true);
  assert.equal(read.invalid, 0);
  assert.equal(read.pack?.skills[0].name, '打包星屑');
  assert.equal(read.pack?.monsters[0].skillIds[0], 'custom-skill-pack01');
  assert.equal(read.pack?.missions[0].enemyIds[0], 'custom-monster-pack01');
  assert.equal(read.pack?.incidents[0].options.length, 2);
  const broken = readContentPack('{oops');
  assert.equal(broken.ok, false);
  assert.match(broken.errors[0], /JSON/);
  const wrongFormat = readContentPack(JSON.stringify({ format: 'other', version: 1 }));
  assert.equal(wrongFormat.ok, false);
  assert.match(wrongFormat.errors[0], /format/);
  const future = readContentPack(JSON.stringify({ ...pack, version: 99 }));
  assert.equal(future.ok, false);
  assert.match(future.errors[0], /版本 99/);
});

test('导入冲突支持跳过、覆盖与另存新 id，并重映射技能引用', () => {
  const current = sanitizeLibrary({
    skills: [sanitizeSkill({ id: 'custom-skill-conf01', name: '旧星屑' })],
    items: [{ id: 'custom-item-conf01', name: '旧护符', faction: 'witch', slot: 'charm', price: 180 }],
  });
  const incoming = sanitizeLibrary({
    skills: [{ id: 'custom-skill-conf01', name: '新星屑' }],
    items: [{ id: 'custom-item-conf01', name: '冲突护符', faction: 'witch', slot: 'charm', price: 200, skillId: 'custom-skill-conf01' }],
    missions: [{ id: 'custom-mission-conf01', title: '冲突委托', category: '试作', work: 'investigation', rewardEquipmentId: 'custom-item-conf01' }],
  });
  assert.equal(incoming.items[0].skillId, 'custom-skill-conf01');
  assert.equal(incoming.missions[0].rewardEquipmentId, 'custom-item-conf01');
  const skip = mergeContentPack(current, incoming, 'skip');
  assert.equal(skip.conflicts, 2);
  assert.equal(skip.skipped, 2);
  assert.equal(skip.added, 1);
  assert.equal(skip.library.skills[0].name, '旧星屑');
  const overwrite = mergeContentPack(current, incoming, 'overwrite');
  assert.equal(overwrite.replaced, 2);
  assert.equal(overwrite.library.skills[0].name, '新星屑');
  const rename = mergeContentPack(current, incoming, 'rename');
  assert.equal(rename.renamed, 2);
  assert.equal(rename.added, 3);
  assert.equal(rename.library.skills.length, 2);
  const renamedSkill = rename.library.skills.find(entry => entry.name === '新星屑');
  assert.ok(renamedSkill);
  assert.notEqual(renamedSkill.id, 'custom-skill-conf01');
  const renamedItem = rename.library.items.find(entry => entry.name === '冲突护符');
  assert.ok(renamedItem);
  assert.notEqual(renamedItem.id, 'custom-item-conf01');
  assert.equal(renamedItem.skillId, renamedSkill.id);
  assert.equal(rename.library.missions[0].rewardEquipmentId, renamedItem.id, '委托奖励装备应跟随冲突改名');
});

test('缺失内容返回 undefined，旧读取函数只作为兜底', () => {
  assert.equal(findSkill('missing-skill'), undefined);
  assert.equal(findMonster('missing-monster'), undefined);
  assert.equal(findItem('missing-item'), undefined);
  assert.equal(getSkill('missing-skill').id, skills[0].id);
  assert.equal(findSkill(skills[0].id)?.name, skills[0].name);
});

test('装备的伤害与先手加成会进入战斗单位并提高输出', () => {
  const item = sanitizeItem({
    id: 'custom-item-gear01', name: '测试齿轮', faction: 'witch', slot: 'weapon', price: 500,
    damageBonus: 50, initiativeBonus: 10, description: '工坊打样。',
  });
  assert.ok(item);
  applyLibrary(sanitizeLibrary({ items: [item] }));
  assert.equal(findItem(item.id)?.damageBonus, 50);

  const state = createInitialState();
  const girl = state.girls.find(entry => !entry.retired)!;
  const mission: Mission = { ...state.missions[0], id: 'gear-bonus-mission', title: '加成测试', enemyIds: ['custom-monster-gear01'], rounds: 2, duration: 120, work: 'combat' } as Mission;
  const base = getMonster('mirror-nun');
  const monsters = [{ ...base, id: 'custom-monster-gear01', name: '测试木桩', maxHp: 5000, stats: { magic: 8, insight: 8, agility: 8, empathy: 8 }, rules: [] }];
  const plain = simulateBattle({ mission, girls: [girl], day: 1, minutes: 1200, monsters, seed: 7 });
  girl.equipment.weapon = item.id;
  const geared = simulateBattle({ mission, girls: [girl], day: 1, minutes: 1200, monsters, seed: 7 });
  const plainUnit = plain.units.find(unit => unit.uid === `ally-${girl.id}`);
  const gearedUnit = geared.units.find(unit => unit.uid === `ally-${girl.id}`);
  assert.ok(plainUnit && gearedUnit);
  assert.equal(plainUnit.damageBonus ?? 0, 0);
  assert.equal(gearedUnit.damageBonus, 50);
  assert.equal(gearedUnit.initiativeBonus, 10);
  assert.ok(gearedUnit.dealt > plainUnit.dealt, '50% 伤害加成应体现在总输出上');
});

test('随机池只抽 pool 卡，尊重权重并跳过当天已出现的 oncePerDay', () => {
  const library = sanitizeLibrary({
    incidents: [
      { id: 'custom-incident-pool01', title: '权重一', body: '池卡一。', trigger: 'pool', weight: 1, options: [{ label: 'A', effect: {} }, { label: 'B', effect: {} }] },
      { id: 'custom-incident-pool02', title: '权重九', body: '池卡二。', trigger: 'pool', weight: 9, oncePerDay: true, options: [{ label: 'A', effect: {} }, { label: 'B', effect: {} }] },
      { id: 'custom-incident-manual01', title: '手动卡', body: '不该被抽到。', trigger: 'manual', weight: 20, options: [{ label: 'A', effect: {} }, { label: 'B', effect: {} }] },
    ],
  });
  const [light, heavy, manual] = library.incidents;
  assert.equal(pickPoolIncidentCard(library.incidents, [], 3, 0)?.id, light.id);
  assert.equal(pickPoolIncidentCard(library.incidents, [], 3, 0.99)?.id, heavy.id);
  assert.equal(pickPoolIncidentCard([manual], [], 3, 0.5), undefined);
  const seen = [{ id: 'inc-1', cardId: heavy.id, day: 3 } as Incident];
  assert.equal(pickPoolIncidentCard(library.incidents, seen, 3, 0.99)?.id, light.id);
  assert.equal(pickPoolIncidentCard(library.incidents, seen, 4, 0.99)?.id, heavy.id, '换一天可以再次出现');
});

test('蓝图事件节点能从内容工坊弹窗卡导入并按卡结算', () => {
  const card = sanitizeIncidentCard({
    id: 'custom-incident-blueprint01', title: '工坊来的雨', body: '雨从工坊的窗缝里灌进来。',
    kind: 'environment', trigger: 'manual',
    options: [
      { label: '关窗', hint: '假装没看见', effect: { reputation: 1 } },
      { label: '开门', hint: '让雨进来', effect: { reputation: -1 } },
    ],
  });
  assert.ok(card);
  applyLibrary(sanitizeLibrary({ incidents: [card] }));

  const state = createInitialState();
  const girl = state.girls.find(entry => !entry.retired)!;
  girl.bond = 60;
  const start = makeNode('start', 0, 0, 's-card');
  const incidentNode = makeNode('incident', 260, 0, 'i-card');
  assert.equal(incidentNode.data.kind, 'incident');
  if (incidentNode.data.kind === 'incident') {
    incidentNode.data.spec.cardId = card.id;
    incidentNode.data.spec.title = '手填旧标题';
    incidentNode.data.spec.body = '手填旧正文。';
  }
  const end = makeNode('end', 520, 0, 'e-card');
  const graph: StoryGraph = {
    version: 1, entry: 's-card', nodes: [start, incidentNode, end],
    edges: [
      { id: 'c1', from: 's-card', fromPort: 'out', to: 'i-card' },
      { id: 'c2', from: 'i-card', fromPort: 'out', to: 'e-card' },
    ],
  };
  const saved = act(state, { type: 'setStoryPlan', girlId: girl.id, plan: { ...storyPlanTemplate('雨中工坊', '雨一直下。'), graph } });
  assert.equal(saved.ok, true);
  const started = act(saved.state, { type: 'startStoryline', girlId: girl.id });
  assert.equal(started.ok, true);
  const incident = started.state.incidents.find(entry => entry.storylineId);
  assert.ok(incident, '蓝图应弹出事件');
  assert.equal(incident.cardId, card.id);
  assert.equal(incident.title, card.title);
  assert.equal(incident.body, card.body);
  assert.deepEqual(incident.options.map(option => option.label), card.options.map(option => option.label));
  assert.ok(contentUsage(started.state, 'incident', card.id).includes('契约者故事蓝图'));
});

test('调查与战斗拆成独立模板，额外装备与免费契约者会随完成发放', () => {
  assert.equal(emptyInvestigationMission().work, 'investigation');
  assert.equal(emptyCombatMission().work, 'combat');
  assert.equal(emptyCombatMission().title, '未命名战斗委托');

  const item = sanitizeItem({
    id: 'custom-item-reward01', name: '夜巡奖励护符', faction: 'witch', slot: 'charm', price: 400,
    description: '完成委托后附赠。',
  });
  assert.ok(item);
  const rawInvestigation = {
    id: 'custom-mission-inv01', title: '测试·夜巡调查', category: '试作', work: 'investigation',
    requirement: 'insight', target: 30, duration: 15, reward: 700, recommendedLevel: 2,
    rewardEquipmentId: item.id, rewardGirlLevel: 3,
  };
  const rawCombat = {
    id: 'custom-mission-com01', title: '测试·夜航战斗', category: '试作', work: 'combat',
    enemyIds: ['night-tram'], rounds: 4, duration: 60, reward: 900,
    rewardEquipmentId: 'missing-item', rewardGirlLevel: 99,
  };
  const library = sanitizeLibrary({ items: [item], missions: [rawInvestigation, rawCombat] });
  assert.equal(library.missions.length, 2);
  const investigation = library.missions.find(entry => entry.work === 'investigation');
  const combat = library.missions.find(entry => entry.work === 'combat');
  assert.ok(investigation && combat);
  assert.equal(investigation.rewardEquipmentId, item.id);
  assert.equal(investigation.rewardGirlLevel, 3);
  assert.equal(combat.rewardEquipmentId, undefined, '未知装备奖励应被丢弃');
  assert.equal(combat.rewardGirlLevel, 12, '奖励等级应夹在 1–12');

  applyLibrary(library);
  const state = createInitialState();
  const deployed = deployMissionTemplate(state, investigation);
  state.missions.push(deployed);
  assert.ok(contentUsage(state, 'item', item.id).includes('当前委托的报酬'));
  const girl = state.girls.find(entry => entry.id === 'yue')!;
  girl.fatigue = 0; girl.hp = 100; girl.stats.insight = 120;
  const beforeCount = state.girls.length;
  const dispatched = act(state, { type: 'dispatch', girlIds: [girl.id], missionId: deployed.id });
  assert.equal(dispatched.ok, true);
  const done = act(dispatched.state, { type: 'advance', minutes: 30 });
  assert.equal(done.ok, true);
  assert.equal(done.state.missions.find(entry => entry.id === deployed.id)?.status, 'done');
  assert.equal(done.state.inventory[item.id], 1, '奖励装备应进入背包');
  assert.equal(done.state.girls.length, beforeCount + 1, '免费契约者应直接入职');
  const recruit = done.state.girls.find(entry => !state.girls.some(before => before.id === entry.id));
  assert.ok(recruit, '应能找到新加入的契约者');
  assert.equal(recruit.cost, 0);
  assert.equal(recruit.level, 3);
  applyLibrary(emptyLibrary());
});

test('状态模板按种类分组、能读写进技能，并正确计算先手增减', () => {
  assert.ok(skillEffectPresets.length >= 12);
  assert.equal(new Set(skillEffectPresets.map(preset => preset.id)).size, skillEffectPresets.length, '模板 id 不应重复');
  assert.deepEqual(
    [...new Set(skillEffectPresets.map(preset => preset.category))].sort(),
    [...EFFECT_CATEGORIES].sort(),
    '每个效果种类都应有可选模板',
  );

  const skill = sanitizeSkill({
    id: 'custom-skill-buff01', name: '测试·先读', resource: 'spirit', side: 'enemy',
    effects: [{ preset: 'power-surge', kind: 'debuff', amount: 3, duration: 1 }],
  });
  assert.ok(skill);
  const effect = skill.effects[0];
  assert.equal(effect.preset, 'power-surge');
  assert.equal(effect.label, '锋芒增幅');
  assert.equal(effect.category, 'offense');
  assert.equal(effect.kind, 'buff', '模板应覆盖手写的 kind');
  assert.equal(effect.stat, 'magic', '模板应带上固定属性');
  assert.equal(effect.amount, 3, '手调数值应保留');
  assert.equal(effectText(effect), '锋芒增幅 魔力 3 · 1 轮');

  const initiative = {
    stats: { magic: 0, insight: 50, agility: 0, empathy: 0 },
    effects: [
      { kind: 'buff', stat: 'initiative', amount: 10, duration: 2, source: '先读', remaining: 2 },
      { kind: 'debuff', stat: 'initiative', amount: 4, duration: 2, source: '乱拍', remaining: 2 },
    ],
    initiativeBonus: 5,
  } as unknown as Parameters<typeof initiativeOf>[0];
  assert.equal(initiativeOf(initiative, 3), 64, '50 洞察 + 3 随机 + 10 增益 − 4 减益 + 5 装备');
});

// ── v19：辖区污染、三方档案、出身标签、拦截战与事务所档案 ───────────────────

/** 清掉开局就有的意见与事件，避免 `advance` 被「待决事项」挡住。 */
const v19State = (): GameState => {
  const state = createInitialState();
  state.opinions = [];
  state.incidents = [];
  return state;
};

/** 打烊跨日：`processDay` 只在日界运行，污染日增与市场刷新都靠它。 */
const endNightOnce = (state: GameState): GameState => {
  const result = act(state, { type: 'endNight' });
  assert.equal(result.ok, true, result.message);
  return result.state;
};

/** 给委托重新打一次快照，避免测试依赖种子数据里有没有快照。 */
const withSnapshot = (state: GameState, id: string, patch: Partial<Mission> = {}): GameState => {
  state.missions = state.missions.map(mission => mission.id === id ? { ...annotateMission(state, mission), ...patch } : mission);
  return state;
};

/** 世界书读写依赖 localStorage；node 里装一个内存替身，跑完还原。 */
function withMemoryStorage<T>(run: () => T): T {
  const store = new Map<string, string>();
  const globals = globalThis as { localStorage?: unknown };
  const previous = globals.localStorage;
  globals.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() { return store.size; },
  };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globals.localStorage;
    else globals.localStorage = previous;
  }
}

/** 把一名少女堆到能稳赢拦截战的强度。 */
function buffGirl(state: GameState, id: string): void {
  const girl = state.girls.find(item => item.id === id);
  assert.ok(girl, `找不到少女 ${id}`);
  for (const key of Object.keys(girl.stats) as Array<keyof typeof girl.stats>) {
    girl.stats[key] = Math.round(girl.stats[key] * 12);
    girl.baseStats[key] = Math.round(girl.baseStats[key] * 12);
  }
  girl.level = 40;
  girl.maxHp = 4000;
  girl.hp = 4000;
  girl.maxSpirit = 2000;
  girl.spirit = 2000;
}

/** 造一个「糖果街归协会、协会在戒备」的场面。 */
function hostileCandy(): GameState {
  const state = v19State();
  state.territories.candy = 'association';
  state.factions.association.standing = 20;
  return state;
}

test('v19 污染初始值九区齐全，repairPollution 补缺、截断并修 NaN', () => {
  const init = initialPollution();
  assert.deepEqual(Object.keys(init).sort(), [...districtOrder].sort(), '九个辖区一个都不能少');
  assert.equal(init.candy, 6);
  assert.equal(init.oldtown, 46, '旧城区是开局最脏的辖区');
  for (const level of Object.values(init)) {
    assert.ok(level >= POLLUTION_MIN && level <= POLLUTION_MAX, `${level} 超出取值范围`);
  }

  assert.deepEqual(repairPollution(undefined), init, '整份缺失时回落到初始值');
  assert.deepEqual(repairPollution({}), init);
  const repaired = repairPollution({ candy: -20, station: 999, plaza: Number.NaN, oldtown: 12 });
  assert.equal(repaired.candy, POLLUTION_MIN, '越界收敛到下限');
  assert.equal(repaired.station, POLLUTION_MAX, '越界收敛到上限');
  assert.equal(repaired.plaza, POLLUTION_MIN, 'NaN 收敛到下限');
  assert.equal(repaired.oldtown, 12, '合法值原样保留');
  assert.equal(repaired.docks, init.docks, '没提到的辖区补初始值');
});

test('v19 污染分五档，边界值落在 20/40/60/80', () => {
  assert.equal(pollutionTier(0), 'clean');
  assert.equal(pollutionTier(19), 'clean');
  assert.equal(pollutionTier(20), 'hazy');
  assert.equal(pollutionTier(39), 'hazy');
  assert.equal(pollutionTier(40), 'murky');
  assert.equal(pollutionTier(59), 'murky');
  assert.equal(pollutionTier(60), 'deep');
  assert.equal(pollutionTier(79), 'deep');
  assert.equal(pollutionTier(80), 'calamity');
  assert.equal(pollutionTier(100), 'calamity');
  assert.equal(pollutionTier(-5), 'clean', '负数先被夹到 0');
  assert.equal(pollutionTier(999), 'calamity');

  assert.equal(pollutionTierLabel(0), '清洁');
  assert.equal(pollutionTierLabel(30), '微浊');
  assert.equal(pollutionTierLabel(50), '浑浊');
  assert.equal(pollutionTierLabel(70), '深染');
  assert.equal(pollutionTierLabel(90), '灾厄');
});

test('v19 污染数值后果按四舍五入给出，面板与结算不会分叉', () => {
  assert.deepEqual(pollutionEffect(0), { enemyHpPct: 0, enemyPowerPct: 0, targetPct: 0, rewardPct: 0, fatigueFlat: 0, corruptionFlat: 0 });
  assert.deepEqual(pollutionEffect(50), { enemyHpPct: 16, enemyPowerPct: 9, targetPct: 5, rewardPct: 8, fatigueFlat: 2, corruptionFlat: 1 });
  assert.deepEqual(pollutionEffect(90), { enemyHpPct: 29, enemyPowerPct: 16, targetPct: 9, rewardPct: 14, fatigueFlat: 4, corruptionFlat: 2 });
  assert.deepEqual(pollutionEffect(100), { enemyHpPct: 32, enemyPowerPct: 18, targetPct: 10, rewardPct: 16, fatigueFlat: 5, corruptionFlat: 2 });
  assert.equal(pollutionEffect(150).enemyHpPct, 32, '先夹到 100 再算');
});

test('v19 污染每天只按等级自然上升，三方当主涨幅相同，跨档才写日志', () => {
  assert.equal(pollutionDailyRise(0), 1);
  assert.equal(pollutionDailyRise(29), 1);
  assert.equal(pollutionDailyRise(30), 2);
  assert.equal(pollutionDailyRise(59), 2);
  assert.equal(pollutionDailyRise(60), 3);
  assert.equal(pollutionDailyRise(90), 4);
  assert.equal(pollutionDailyRise(100), 4);

  const rises = FACTION_ORDER.map((faction: FactionId) => {
    const state = v19State();
    state.pollution.plaza = 19;
    state.territories.plaza = faction;
    return endNightOnce(state).pollution.plaza;
  });
  assert.deepEqual(rises, [20, 20, 20], '谁当主都不影响自然涨幅');

  const crossed = v19State();
  crossed.pollution.plaza = 19;
  const crossedDay = endNightOnce(crossed);
  assert.ok(crossedDay.logs.some(log => log.id.startsWith('log-pollution-plaza')), '跨档要留一条日志');

  const quiet = v19State();
  quiet.pollution.candy = 6;
  const quietDay = endNightOnce(quiet);
  assert.ok(!quietDay.logs.some(log => log.id.startsWith('log-pollution-candy')), '同档内不写日志');
});

test('v19 完成委托的净化量由时长、战斗与当主势力决定', () => {
  const base = { duration: 60, work: 'investigation' as const };
  assert.equal(pollutionRelief({ ...base, owner: 'witch' }), 7, '月蚀庭不提供净化加成');
  assert.equal(pollutionRelief({ ...base, owner: 'association' }), 9);
  assert.equal(pollutionRelief({ ...base, owner: 'government' }), 10, '市役所净化最有效率');
  assert.equal(pollutionRelief({ duration: 0, work: 'investigation', owner: 'witch' }), 5);
  assert.equal(pollutionRelief({ duration: 29, work: 'investigation', owner: 'witch' }), 5);
  assert.equal(pollutionRelief({ duration: 30, work: 'investigation', owner: 'witch' }), 6);
  assert.equal(pollutionRelief({ duration: 0, work: 'combat', owner: 'witch' }), 6, '战斗委托多净化一点');
  assert.equal(pollutionRelief({ duration: 0, work: 'combat', owner: 'government' }), 9);
  assert.equal(FACTION_PURIFICATION.witch.relief, 0);
  assert.equal(factionPurification('association').relief, 2);

  // 没办成的代价比净化小得多
  assert.equal(pollutionPenalty({ duration: 60, work: 'combat', owner: 'witch' }), 2);
  assert.equal(pollutionPenalty({ duration: 60, work: 'investigation', owner: 'witch' }), 1);
  assert.equal(pollutionPenalty({ duration: 60, work: 'social', owner: 'government' }), 1);
});

test('v19 委托生成时冻结污染与当主，旧委托靠当前辖区估算', () => {
  const state = v19State();
  state.pollution.candy = 30;
  state.territories.candy = 'association';
  const mission = annotateMission(state, state.missions.find(item => item.id === 'candy')!);
  assert.equal(mission.pollutionAtSpawn, 30);
  assert.equal(mission.ownerAtSpawn, 'association');
  assert.equal(pollutionIsEstimated(mission), false);

  const legacy = { ...mission, pollutionAtSpawn: undefined, ownerAtSpawn: undefined };
  assert.equal(pollutionIsEstimated(legacy), true);

  const snapshot = pollutionSnapshotOf(state, legacy);
  assert.equal(snapshot.owner, 'association', '没有快照时回落到当前当主');
  assert.equal(snapshot.duration, legacy.duration);
  assert.equal(snapshot.work, legacy.work);

  const forecast = pollutionForecast(state, 'candy', mission);
  assert.equal(forecast.level, 30);
  assert.equal(forecast.tier, 'hazy');
  assert.equal(forecast.dailyRise, 2);
  assert.equal(forecast.estimatedRelief, pollutionRelief(snapshot), '带委托时给出预计净化');
  assert.equal(pollutionForecast(state, 'candy').estimatedRelief, undefined, '不带委托时不算净化');
});

test('v19 快照不做事后追溯：辖区易主与污染上升都不改已派出的委托', () => {
  const state = v19State();
  state.pollution.candy = 20;
  state.territories.candy = 'government';
  const mission = annotateMission(state, state.missions.find(item => item.id === 'candy')!);
  const before = pollutionRelief(pollutionSnapshotOf(state, mission));
  assert.equal(before, 9, '糖果街 45 分钟调查 + 市役所 3 点 = 5 + 1 + 3');

  state.territories.candy = 'witch';
  state.pollution.candy = 95;
  assert.equal(pollutionSnapshotOf(state, mission).owner, 'government', '当主仍是派出时那个');
  assert.equal(pollutionRelief(pollutionSnapshotOf(state, mission)), before, '净化量不会因为换主而变');
  assert.equal(pollutionIsEstimated(mission), false);
});

test('v19 打快照会把污染并进辖区效果，且只并一次', () => {
  const low = v19State();
  low.pollution.docks = 0;
  const lowMission = annotateMission(low, low.missions.find(item => item.id === 'arcade')!);

  const high = v19State();
  high.pollution.docks = 90;
  const highMission = annotateMission(high, high.missions.find(item => item.id === 'arcade')!);

  const effect = pollutionEffect(90);
  assert.ok(lowMission.environment && highMission.environment);
  assert.equal(highMission.environment.targetPct, (lowMission.environment.targetPct ?? 0) + effect.targetPct);
  assert.equal(highMission.environment.rewardPct, (lowMission.environment.rewardPct ?? 0) + effect.rewardPct);
  assert.equal(highMission.environment.fatigueFlat, (lowMission.environment.fatigueFlat ?? 0) + effect.fatigueFlat);
  assert.ok((highMission.reward ?? 0) > (lowMission.reward ?? 0), '脏辖区的委托给得更多');
  assert.ok((highMission.target ?? 0) > (lowMission.target ?? 0), '脏辖区的门槛也更高');

  const merged = mergeDistrictEffects({ targetPct: 5, fatigueFlat: 1 }, { targetPct: 3, rewardPct: 2 });
  assert.equal(merged.targetPct, 8);
  assert.equal(merged.rewardPct, 2);
  assert.equal(merged.fatigueFlat, 1);
});

test('v19 旧档 v11 迁到 12：污染补齐、档案默认、出身按 id 重算', () => {
  const state = createInitialState();
  const legacy = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  legacy.version = 11;
  delete legacy.pollution;
  delete legacy.office;
  for (const girl of legacy.girls as Array<Record<string, unknown>>) delete girl.factionTag;
  for (const candidate of legacy.candidates as Array<Record<string, unknown>>) delete candidate.factionTag;

  const loaded = loadState(JSON.stringify(legacy));
  assert.equal(loaded.version, 12);
  assert.deepEqual(loaded.pollution, initialPollution(), '缺污染时整套补上初始值');
  assert.deepEqual(loaded.office, sanitizeOfficeProfile(DEFAULT_OFFICE_PROFILE));
  for (const girl of loaded.girls) {
    assert.equal(girl.factionTag, factionTagFor(girl.id), '没有出身的少女按 id 确定性重算');
  }
  assert.ok(importState(JSON.stringify(legacy)), '导入入口同样接受 v11');
});

test('v19 读档保留委托快照，并把非法污染/档案修回合法值', () => {
  const state = v19State();
  state.pollution.docks = 40;
  withSnapshot(state, 'arcade');
  const mission = state.missions.find(item => item.id === 'arcade')!;
  assert.ok(mission.environment);

  const loaded = loadState(JSON.stringify(state));
  const reloaded = loaded.missions.find(item => item.id === 'arcade')!;
  assert.deepEqual(reloaded.environment, mission.environment);
  assert.equal(reloaded.pollutionAtSpawn, mission.pollutionAtSpawn);
  assert.equal(reloaded.ownerAtSpawn, mission.ownerAtSpawn);

  const broken = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  (broken.pollution as Record<string, unknown>).candy = '很多';
  (broken.pollution as Record<string, unknown>).station = -5;
  (broken.pollution as Record<string, unknown>).plaza = 999;
  broken.office = { background: 123, philosophy: '', goal: '只有目标' };
  const fixed = loadState(JSON.stringify(broken));
  assert.equal(fixed.pollution.candy, initialPollution().candy, '非法污染回落到初始值');
  assert.equal(fixed.pollution.station, POLLUTION_MIN);
  assert.equal(fixed.pollution.plaza, POLLUTION_MAX);
  assert.equal(fixed.office.background, DEFAULT_OFFICE_PROFILE.background);
  assert.equal(fixed.office.philosophy, DEFAULT_OFFICE_PROFILE.philosophy, '空串也回退默认值');
  assert.equal(fixed.office.goal, '只有目标', '合法字段原样保留');
});

test('v19 三方档案自洽：领袖、附属少女、关系与净化加成都不缺', () => {
  const factions: FactionId[] = ['association', 'government', 'witch'];
  for (const faction of factions) {
    const dossier = factionDossiers[faction];
    assert.ok(dossier, `${faction} 缺档案`);
    assert.ok(dossier.origin.length > 10 && dossier.doctrine.length > 5, `${faction} 档案太薄`);
    assert.ok(dossier.technologyStance.length > 5, `${faction} 没写对技术的态度`);
    assert.ok(dossier.witchStance.length > 5 && dossier.girlStance.length > 5);

    const leader = factionLeader(faction);
    assert.equal(leader.faction, faction);
    assert.equal(dossier.leaderId, leader.id, '档案指向的领袖必须就是查出来的那个');
    assert.ok(leader.name.length > 0 && leader.title.length > 0 && leader.quote.length > 0);
    assert.equal(leader.portrait, '', '领袖走程序化立绘，不依赖图片资源');

    const girls = factionGirlsOf(faction);
    assert.ok(girls.length >= 3, `${faction} 的附属少女太少`);
    assert.deepEqual(dossier.girlIds, girls.map(girl => girl.id), '档案成员顺序与成员表一致');
    for (const girl of girls) {
      assert.equal(girl.faction, faction);
      assert.equal(girl.tag, faction, '附属少女的出身标签必须等于所属势力');
      assert.ok(girl.name.length > 0 && girl.quote.length > 0);
      assert.equal(girl.portrait, '');
    }
    assert.ok(factionPurification(faction).relief >= 0);
    assert.ok(factionRelationLine(faction, faction).length > 0, `${faction} 没写对自己的看法`);
  }
  for (const faction of factions) {
    for (const other of factions) {
      assert.ok(factionRelationLine(faction, other).length > 0, `${faction} → ${other} 缺关系描述`);
    }
  }
  assert.ok(factionDossiers.witch.coup, '月蚀庭要有内部政变线');
  assert.ok(factionBrief('association', 20).includes('戒备'));
  assert.ok(factionBrief('association', 50).includes('中立'));
  assert.equal(EMPLOYER_LABEL, '夜糖事务所', '雇主是固定文案，不随出身变');
});

test('v19 出身标签生成确定，四档都能出', () => {
  assert.equal(factionTagFor('yue'), factionTagFor('yue'), '同一个 seed 永远同一出身');
  const seen = new Set<GirlFaction>();
  for (let index = 0; index < 600; index++) seen.add(factionTagFor(`seed-${index}`));
  assert.deepEqual([...seen].sort(), ['association', 'government', 'none', 'witch']);
  for (const tag of seen) {
    assert.ok(factionTagLabel(tag).length > 0);
    assert.match(factionTagColor(tag), /^#[0-9a-f]{6}$/i);
  }
  assert.equal(factionTagLabel(undefined), '无所属');
  assert.equal(isGirlFaction('office'), false, '事务所是雇主，不是出身');
  assert.equal(isGirlFaction('witch'), true);
  assert.deepEqual(Object.keys(girlFactionLabels).sort(), ['association', 'government', 'none', 'witch']);
});

test('v19 读档/导卡的出身清洗：合法值保留，非法值（含历史 office）重算', () => {
  assert.equal(sanitizeGirlFaction('witch', 'yue'), 'witch');
  assert.equal(sanitizeGirlFaction('none', 'yue'), 'none');
  assert.equal(sanitizeGirlFaction('office', 'yue'), factionTagFor('yue'), '历史 office 不是出身');
  assert.equal(sanitizeGirlFaction(undefined, 'yue'), factionTagFor('yue'));
  assert.equal(sanitizeGirlFaction(42, 'yue'), factionTagFor('yue'));
  assert.equal(sanitizeGirlFaction('', 'yue'), factionTagFor('yue'));
});

test('v19 世界书自动生成事务所条目，且标成只读', () => {
  const entry = officeWorldbookEntry(DEFAULT_OFFICE_PROFILE);
  assert.equal(entry.id, OFFICE_WORLDBOOK_ID);
  assert.equal(entry.name, '夜糖事务所');
  assert.equal(entry.constant, true);
  assert.equal(entry.priority, 92);
  assert.equal(entry.order, 4);
  assert.equal(entry.generated, true, '生成条目必须能被 UI 认出来');
  assert.ok(entry.keys.includes('夜糖事务所') && entry.keys.includes('对外代表'));
  assert.ok(entry.content.includes('背景：') && entry.content.includes('理念：') && entry.content.includes('目标：'));
  assert.ok(entry.content.includes('尚未任命对外代表。'));

  const builtin = builtinWorldbook();
  assert.equal(builtin[0].id, OFFICE_WORLDBOOK_ID, '生成条目排在最前');
  assert.equal(builtin.filter(item => item.id === OFFICE_WORLDBOOK_ID).length, 1);
});

test('v19 世界书同步把「月蚀教团」的旧称迁到「月蚀庭」', () => {
  withMemoryStorage(() => {
    const legacy = {
      id: 'legacy-witch', name: '旧势力', keys: ['月蚀教团'], content: '月蚀教团仍在暗巷卖药，月蚀教团不接受登记。',
      constant: false, priority: 50, order: 9, enabled: true,
    };
    assert.equal(saveWorldbook([legacy]), true);
    assert.equal(loadWorldbook().some(item => item.id === OFFICE_WORLDBOOK_ID), false, '起手只有玩家自己的条目');

    assert.equal(syncOfficeWorldbook(DEFAULT_OFFICE_PROFILE), true);
    const entries = loadWorldbook();
    assert.equal(entries[0].id, OFFICE_WORLDBOOK_ID, '缺条目时补在最前');
    const migrated = entries.find(item => item.id === 'legacy-witch')!;
    assert.equal(migrated.content.includes('月蚀教团'), false, '旧称要全部替换');
    assert.ok(migrated.content.includes('月蚀庭'));
    assert.equal(syncOfficeWorldbook(DEFAULT_OFFICE_PROFILE), true, '再同步一次也不报错');
    assert.equal(loadWorldbook().filter(item => item.id === OFFICE_WORLDBOOK_ID).length, 1, '不会重复插入');
  });
});

test('v19 onlyIfMissing 不覆盖玩家手改，全量同步才重写', () => {
  withMemoryStorage(() => {
    saveWorldbook([officeWorldbookEntry(DEFAULT_OFFICE_PROFILE)]);
    const edited = loadWorldbook().map(item => item.id === OFFICE_WORLDBOOK_ID ? { ...item, content: '玩家自己写的事务所介绍' } : item);
    saveWorldbook(edited);

    syncOfficeWorldbook({ background: '新背景', philosophy: '新理念', goal: '新目标' }, undefined, { onlyIfMissing: true });
    assert.equal(loadWorldbook().find(item => item.id === OFFICE_WORLDBOOK_ID)!.content, '玩家自己写的事务所介绍', '首次挂载不推翻手改');

    syncOfficeWorldbook({ background: '新背景', philosophy: '新理念', goal: '新目标' }, undefined);
    const rewritten = loadWorldbook().find(item => item.id === OFFICE_WORLDBOOK_ID)!;
    assert.ok(rewritten.content.includes('新背景') && rewritten.content.includes('新目标'), '玩家点保存才重写');
    assert.equal(rewritten.generated, true);
  });
});

test('v19 事务所条目里的对外代表随助理变化，卸任后回到未任命', () => {
  withMemoryStorage(() => {
    const state = v19State();
    state.assistantId = 'yue';
    const representative = representativeOf(state);
    assert.ok(representative);
    syncOfficeWorldbook(DEFAULT_OFFICE_PROFILE, representative);
    const withRep = loadWorldbook().find(item => item.id === OFFICE_WORLDBOOK_ID)!.content;
    assert.ok(withRep.includes('对外代表'));
    assert.ok(withRep.includes(representative.name));
    assert.ok(withRep.includes(factionTagLabel(representative.factionTag)), '代表行要写出身');

    syncOfficeWorldbook(DEFAULT_OFFICE_PROFILE, undefined);
    assert.ok(loadWorldbook().find(item => item.id === OFFICE_WORLDBOOK_ID)!.content.includes('尚未任命对外代表。'));
    assert.ok(officeWorldbookContent(DEFAULT_OFFICE_PROFILE, representative).includes('出身'));
    assert.ok(WORLDBOOK_KEY.length > 0);
  });
});

test('v19 对外代表只认在职且活着的助理，卸任不会顺手清掉 assistantId', () => {
  const state = v19State();
  state.assistantId = 'yue';
  assert.equal(representativeOf(state)?.id, 'yue');

  const dead = v19State();
  dead.assistantId = 'yue';
  dead.girls = dead.girls.map(girl => girl.id === 'yue' ? { ...girl, dead: true } : girl);
  assert.equal(representativeOf(dead), undefined, '死掉的人不能当代表');
  assert.equal(dead.assistantId, 'yue', '身份本身保留，由玩家决定换谁');

  const retired = v19State();
  retired.assistantId = 'yue';
  retired.girls = retired.girls.map(girl => girl.id === 'yue' ? { ...girl, retired: true } : girl);
  assert.equal(representativeOf(retired), undefined, '离职的人也不能当代表');

  const missing = v19State();
  missing.assistantId = 'nobody';
  assert.equal(representativeOf(missing), undefined);

  const none = v19State();
  none.assistantId = undefined;
  assert.equal(representativeOf(none), undefined);
});

test('v19 事务所档案逐字段 trim、限长，非法或空值只影响自己那一栏', () => {
  const long = 'x'.repeat(OFFICE_LIMITS.background + 40);
  const profile = sanitizeOfficeProfile({ background: `  ${long}  `, philosophy: '', goal: '值夜' });
  assert.equal(profile.background.length, OFFICE_LIMITS.background, '背景按上限截断');
  assert.equal(profile.background.trim(), profile.background, '首尾空白应被去掉');
  assert.equal(profile.philosophy, DEFAULT_OFFICE_PROFILE.philosophy, '空串回退默认值');
  assert.equal(profile.goal, '值夜');

  assert.deepEqual(sanitizeOfficeProfile(), DEFAULT_OFFICE_PROFILE);
  assert.deepEqual(sanitizeOfficeProfile(null), DEFAULT_OFFICE_PROFILE);
  const capped = sanitizeOfficeProfile({
    background: 'b', philosophy: 'y'.repeat(OFFICE_LIMITS.philosophy + 10), goal: 'g'.repeat(OFFICE_LIMITS.goal + 10),
  });
  assert.equal(capped.philosophy.length, OFFICE_LIMITS.philosophy);
  assert.equal(capped.goal.length, OFFICE_LIMITS.goal);
});

test('v19 新档是 version 12，带默认档案，三方态度统一 50', () => {
  const state = createInitialState();
  assert.equal(state.version, 12);
  assert.deepEqual(state.pollution, initialPollution());
  assert.deepEqual(state.office, sanitizeOfficeProfile(DEFAULT_OFFICE_PROFILE));
  for (const faction of FACTION_ORDER) {
    assert.equal(state.factions[faction].standing, 50, `${faction} 应从 50 起步，不该有历史偏见`);
  }
  assert.ok(cityAveragePollution(state) > 0);
  const dirtiest = dirtiestDistrict(state);
  assert.equal(dirtiest.id, 'oldtown');
  assert.equal(dirtiest.level, initialPollution().oldtown);
});

test('v19 保存事务所档案会写进档并留下日志', () => {
  const state = v19State();
  const profile: OfficeProfile = { background: '重开的第二天', philosophy: '先问她叫什么', goal: '让三方坐到同一张桌子' };
  const result = act(state, { type: 'setOfficeProfile', profile });
  assert.equal(result.ok, true, result.message);
  assert.deepEqual(result.state.office, profile);
  assert.ok(result.state.logs.some(log => log.text.includes('事务所档案已更新')), '要留下变更记录');

  const trimmed = act(v19State(), { type: 'setOfficeProfile', profile: { background: '  ', philosophy: '理念', goal: '目标' } });
  assert.equal(trimmed.state.office.background, DEFAULT_OFFICE_PROFILE.background, '写入前也会被清洗');
});

test('v19 拦截判定：只有被当主戒备的普通辖区委托才会被拦', () => {
  const hostile = hostileCandy();
  const candy = hostile.missions.find(item => item.id === 'candy')!;
  assert.equal(canIntercept(hostile, candy), true);

  const calm = hostileCandy();
  calm.factions.association.standing = 50;
  assert.equal(canIntercept(calm, calm.missions.find(item => item.id === 'candy')!), false, '中立不拦');

  const boss = hostile.missions.find(item => item.boss);
  if (boss) assert.equal(canIntercept(hostile, boss), false, 'BOSS 委托不拦');

  const envoy = hostile.missions.find(item => item.envoy);
  if (envoy) assert.equal(canIntercept(hostile, envoy), false, '来使委托不拦');

  assert.equal(canIntercept(hostile, { ...candy, storylineId: 'arc-1' }), false, '剧情委托不拦');
  assert.equal(canIntercept(hostile, { ...candy, interception: { faction: 'association', girlIds: ['fg-association-rin'] } }), false, '已经拦过的不再拦');
  assert.equal(canIntercept(hostile, { ...candy, district: undefined }), false, '没有辖区的委托不拦');
  assert.equal(canIntercept(hostile, { ...candy, district: 'nowhere' }), false, '没有当主的辖区不拦');
});

test('v19 拦截战胜利：声望 −4，原委托作废且不算完成', () => {
  const state = hostileCandy();
  buffGirl(state, 'yue');
  const before = state.factions.association.standing;
  const pollution = state.pollution.candy;

  const deployed = act(state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
  assert.equal(deployed.ok, true, deployed.message);
  const settled = act(deployed.state, { type: 'advance', minutes: 180 });
  assert.equal(settled.ok, true, settled.message);
  assert.equal(settled.battle?.outcome, 'victory');

  const mission = settled.state.missions.find(item => item.id === 'candy')!;
  assert.equal(mission.interception?.faction, 'association');
  assert.equal(mission.interception?.outcome, 'win');
  assert.equal(mission.status, 'expired', '拦截战覆盖了原委托，不会完成');
  assert.equal((mission.squad ?? []).length, 0, '作废的委托不能留着队伍');
  assert.equal(mission.girlId, undefined);
  assert.equal(settled.state.completed.includes('candy'), false);
  assert.equal(settled.state.factions.association.standing, before - 4, '打退协会的人要付声望代价');
  assert.equal(settled.state.pollution.candy, pollution, '拦截战不净化辖区');
});

test('v19 拦截战失利：声望 −2，原委托同样作废', () => {
  const state = hostileCandy();
  const before = state.factions.association.standing;
  const deployed = act(state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
  assert.equal(deployed.ok, true, deployed.message);
  const settled = act(deployed.state, { type: 'advance', minutes: 180 });
  assert.equal(settled.ok, true, settled.message);
  assert.notEqual(settled.battle?.outcome, 'victory', '没堆强度的单人要输');

  const mission = settled.state.missions.find(item => item.id === 'candy')!;
  assert.equal(mission.interception?.outcome, 'loss');
  assert.equal(mission.status, 'expired');
  assert.equal((mission.squad ?? []).length, 0);
  assert.equal(settled.state.factions.association.standing, before - 2);
});

test('v19 拦截战只换敌人：辖区归属与污染都不动，人也会放回来', () => {
  const state = hostileCandy();
  buffGirl(state, 'yue');
  const pollution = state.pollution.candy;
  const deployed = act(state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
  const settled = act(deployed.state, { type: 'advance', minutes: 180 });
  assert.equal(settled.state.territories.candy, 'association', '拦下来也不改归属');
  assert.equal(settled.state.pollution.candy, pollution, '污染原样不动');
  const yue = settled.state.girls.find(girl => girl.id === 'yue')!;
  assert.notEqual(yue.status, 'mission', '人必须放回来');
  assert.ok(settled.state.logs.some(log => log.text.includes('拦截')), '要在日志里说明被拦了');
});

test('v19 拦截战换上的敌人是当主附属少女，不是原委托的魔物', () => {
  const state = hostileCandy();
  buffGirl(state, 'yue');
  const deployed = act(state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
  const settled = act(deployed.state, { type: 'advance', minutes: 180 });
  const battle = settled.battle;
  assert.ok(battle);

  const enemies = battle.units.filter(unit => unit.side === 'enemy');
  assert.ok(enemies.length > 0);
  const girls = factionGirlsOf('association');
  const girlNames = new Set(girls.map(girl => girl.name));
  for (const enemy of enemies) {
    assert.ok(girlNames.has(enemy.name), `${enemy.name} 不是星灯协会的附属少女`);
    assert.equal(enemy.monster, undefined, '附属少女不该带魔物模板');
  }
  const first = girls.find(girl => girl.name === enemies[0].name);
  assert.ok(first);
  assert.deepEqual(enemies[0].stats, first.stats, '附属少女的数值不按等级差缩放');
});

test('v19 战斗会记住辖区污染，战报摘要里也有一行', () => {
  const state = v19State();
  state.pollution.docks = 90;
  withSnapshot(state, 'arcade');
  const deployed = act(state, { type: 'dispatch', girlIds: ['yue'], missionId: 'arcade' });
  assert.equal(deployed.ok, true, deployed.message);
  const settled = act(deployed.state, { type: 'advance', minutes: 180 });
  const battle = settled.battle;
  assert.ok(battle);
  assert.equal(battle.pollution, 90);
  const digest = battleDigest(battle);
  assert.ok(digest.includes('辖区污染 90'), digest);
  assert.ok(digest.includes(pollutionTierLabel(90)), digest);
});

test('v19 净化的疲劳只算一次：有快照就不再叠加地形那份', () => {
  const fatigueDelta = (extra: number): number => {
    const state = v19State();
    withSnapshot(state, 'candy');
    state.missions = state.missions.map(mission => mission.id === 'candy'
      ? { ...mission, environment: { ...mission.environment!, fatigueFlat: extra } }
      : mission);
    const before = state.girls.find(girl => girl.id === 'yue')!.fatigue;
    const deployed = act(state, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
    assert.equal(deployed.ok, true, deployed.message);
    const settled = act(deployed.state, { type: 'advance', minutes: 45 });
    assert.equal(settled.ok, true, settled.message);
    return settled.state.girls.find(girl => girl.id === 'yue')!.fatigue - before;
  };

  const plain = fatigueDelta(0);
  const heavier = fatigueDelta(3);
  assert.equal(heavier - plain, 3, '快照里的 fatigueFlat 只出现一次');
  assert.ok(plain >= 0);

  const legacy = v19State();
  legacy.missions = legacy.missions.map(mission => mission.id === 'candy' ? { ...mission, environment: undefined } : mission);
  const before = legacy.girls.find(girl => girl.id === 'yue')!.fatigue;
  const deployed = act(legacy, { type: 'dispatch', girlIds: ['yue'], missionId: 'candy' });
  const settled = act(deployed.state, { type: 'advance', minutes: 45 });
  const legacyDelta = settled.state.girls.find(girl => girl.id === 'yue')!.fatigue - before;
  assert.notEqual(legacyDelta, plain, '没有快照的旧委托走回退路径，两次地形效果会叠加');
  assert.equal(clampPollution(0), POLLUTION_MIN);
});
