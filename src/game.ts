export { interceptionFor } from './rules/battle.ts';
export { dateLabel, grantExpWithNotice, pushNotice, shiftTerritory } from './rules/core.ts';
export { deployIncidentCard, eliteChance, rollEnemies } from './rules/encounters.ts';
export { applyIncidentEffect, makeRuleIncident, pickPoolIncidentCard } from './rules/incidentOps.ts';
export { WARDROBE_LIMIT, clock, relationshipStage, stageHints, stageLabels, statLabels, statusLabels, workDescriptions, workLabels } from './rules/labels.ts';
export { factionStanding, itemPrice, makeFactionStock, makeMarketStock, marketPool, marketSlots, marketUpgrade, marketWindow } from './rules/market.ts';
export { annotateMission, deployMissionTemplate, districtPin, missionDeadlineLabel, missionTemplates, previewFactionTask } from './rules/missions.ts';
export { opinionLimit, trimOpinions } from './rules/opinion.ts';
export { customOutfitFor, witchOutfitFor } from './rules/outfits.ts';
export { SAVE_KEY, canAcceptGeneratedContent, importState, loadState, validBattleNote } from './rules/persistence.ts';
export { ensureMissionPools, ensureMonsterPool, missionKey, missionKeyTaken, missionVisibleOnMap, trimMissionPools } from './rules/pools.ts';
export { MEMORY_CLEAR_COST, buildCost, capacity, chance, clinicQuote, drugDaysLeft, inWithdrawal, seatedGirls, seatsTaken, squadChance, squadLimit, treatmentFor } from './rules/roster.ts';
export { createBlankState, createInitialFromPack, createInitialState } from './rules/state.ts';
export { applyStoryEffect, fireStoryTrigger } from './rules/storyCore.ts';
export { STORY_SESSION_TURNS, buildTemplateArc, buildTemplateStoryline, finishStoryEvent } from './rules/storyEvent.ts';
export { advanceStoryGraph, completeStoryMission, planToStoryline, resolveStoryWait, spawnStoryBeat, startStoryGraph, storyMissionForBeat } from './rules/storyRun.ts';
export { syncShift } from './rules/time.ts';
export type { SpawnedEnemies } from './rules/encounters.ts';
export type { MarketSlot, StockOptions } from './rules/market.ts';
export type { MissionTemplateOption } from './rules/missions.ts';
export type { ClinicQuote } from './rules/roster.ts';

﻿import { loadBalance } from './balance.ts';
import { cardboxReport } from './cardbox.ts';
import { girlCardHash } from './cards.ts';
import { factionInfo, getItem, registerItem } from './content/items.ts';
import { monsters } from './content/monsters.ts';
import { getSkill } from './content/skills.ts';
import { traitById } from './content/traits.ts';
import { CONTRACT_DAYS, pensionArrears, renewalCost } from './contracts.ts';
import { districts } from './districts.ts';
import { advancedCost, effectiveGuard, effectiveMaxHp, effectiveMaxSpirit, marketSize, marketUpgradeCost } from './economy.ts';
import { EXPRESSION_VARIANT_LIMIT, expressionLabel, isExpressionVariantData, parseExpressionVariantKey, sanitizeExpressionVariants } from './expressions.ts';
import { factionCollapsed, leaderById, leaderTitle, rosterLeader, sanitizeGirlFaction } from './factions.ts';
import { frontLabel } from './fronts.ts';
import { mergeIncidentPool, topUpFromFallback } from './incidents.ts';
import { DEFAULT_OFFICE_PROFILE, sanitizeOfficeProfile } from './office.ts';
import { OPENING_INCIDENTS } from './opening.ts';
import { previewOpinionOption, resolveOpinionOptions } from './opinions.ts';
import { defaultWitchPersonality } from './personality.ts';
import { allocatePoint, statLabel } from './progression.ts';
import { applyResignationChoice } from './resignations.ts';
import { LEADER_HIRE_COST, hydrate, makeCandidate, sanitizeCustomGirl, sanitizeCustomLeader, sanitizeFactionRoster } from './rules/candidate.ts';
import { archive, book, clone, dateLabel, findGirl, findRosterGirl, hashText } from './rules/core.ts';
import { care, dispatch, normalizeDialogueLines, talk } from './rules/dailyOps.ts';
import { applyIncidentEffect, girlInFront } from './rules/incidentOps.ts';
import { WARDROBE_LIMIT, statusLabels } from './rules/labels.ts';
import { factionStanding, itemPrice, normalizeMarketWindow, unshiftMarketWindow } from './rules/market.ts';
import { annotateMission, factionTask } from './rules/missions.ts';
import { applyOpinionChanges, makeOpinion, trimOpinions } from './rules/opinion.ts';
import { customOutfitFor, pruneOrphanVariants, sanitizeOutfit } from './rules/outfits.ts';
import { canAcceptGeneratedContent, validBattleNote, validGeneratedItem } from './rules/persistence.ts';
import { missionKeyTaken, trimMissionPools } from './rules/pools.ts';
import { MEMORY_CLEAR_COST, buildCost, capacity, clinicQuote, inWithdrawal, seatsTaken, treatmentFor } from './rules/roster.ts';
import { createBlankState, createInitialState } from './rules/state.ts';
import { applyStoryEffect } from './rules/storyCore.ts';
import { STORY_SESSION_TURNS, buildTemplateStoryline, finishStoryEvent } from './rules/storyEvent.ts';
import { advanceStoryGraph, planToStoryline, resolveStoryWait, spawnStoryBeat, startStoryGraph } from './rules/storyRun.ts';
import { advance, endNight } from './rules/time.ts';
import { absoluteMinutes } from './shift.ts';
import { ensureGraph, validateGraph } from './storygraph.ts';
import { STORY_SLOT_MAX, playableStoryPlan, sanitizeStoryPlan } from './storyplan.ts';
import { FACTION_ORDER, factionName } from './territories.ts';
import type { ActionResult, FactionGirl, FactionId, FactionLeader, GameAction, GameState, Girl, Incident, Mission, Outfit, Trait } from './types.ts';


export function act(state: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'reset': {
      const next = action.mode === 'blank' ? createBlankState() : createInitialState();
      return { state: next, ok: true, message: action.mode === 'blank' ? '空白档案已建立：只有会客厅与启动资金。' : '进度已重置。' };
    }
    case 'advance': return advance(state, action.minutes);
    case 'dispatch': return dispatch(state, action.girlIds, action.missionId);
    case 'care': return care(state, action.girlId, action.mode);
    case 'talk': return talk(state, action.girlId, action.text, action.remote, action.reply);
    case 'markWhispersRead': {
      if (!state.whisperUnread?.[action.girlId]) return { state, ok: true, message: '' };
      const next = clone(state);
      if (next.whisperUnread) delete next.whisperUnread[action.girlId];
      return { state: next, ok: true, message: '' };
    }
    case 'addWhisper': {
      const job = state.whisperQueue?.find(entry => entry.id === action.jobId);
      if (!job) return { state, ok: false, message: '这条私语已经处理过了。' };
      const girl = findGirl(state, job.girlId);
      if (!girl) return { state, ok: false, message: '找不到发消息的契约者。' };
      const lines = action.lines?.length
        ? normalizeDialogueLines({ lines: action.lines }, [])
        : normalizeDialogueLines(action.text, []);
      if (!lines.length) return { state, ok: false, message: '模型没有返回可用的私语。' };
      const next = clone(state);
      next.whisperQueue = (next.whisperQueue ?? []).filter(entry => entry.id !== job.id);
      const messages = next.messages[girl.id] ?? [];
      for (const line of lines) messages.push({ role: 'girl', text: line.text, action: line.action, expression: line.expression, whisper: true, at: dateLabel(next.day, next.minutes), burstId: job.id });
      next.messages[girl.id] = messages.slice(-60);
      next.whisperUnread = { ...(next.whisperUnread ?? {}), [girl.id]: (next.whisperUnread?.[girl.id] ?? 0) + 1 };
      next.logs.unshift({ id: `log-whisper-${job.id}`, time: dateLabel(next.day, next.minutes), kind: 'relationship', text: `${girl.name}发来一条灯下私语。` });
      return { state: next, ok: true, message: `${girl.name}给你发了一条消息。` };
    }
    case 'dropWhisper': {
      if (!state.whisperQueue?.some(entry => entry.id === action.jobId)) return { state, ok: true, message: '' };
      const next = clone(state);
      next.whisperQueue = (next.whisperQueue ?? []).filter(entry => entry.id !== action.jobId);
      next.logs.unshift({ id: `log-whisper-drop-${action.jobId}`, time: dateLabel(next.day, next.minutes), kind: 'relationship', text: `一条灯下私语没能写出来：${action.reason ? action.reason.slice(0, 80) : '模型没有返回内容'}。` });
      return { state: next, ok: true, message: '' };
    }
    case 'renewContract': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.retired) return { state, ok: false, message: `${girl.name}已经退役，请使用返聘。` };
      const cost = renewalCost(girl) + pensionArrears(girl);
      if (next.gold < cost) return { state, ok: false, message: `续签需要 ${cost} 星砂（含欠缴退休金 ${pensionArrears(girl)}）。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.contractEndDay = Math.max(next.day, girl.contractEndDay) + girl.contractDays;
      girl.contractRenewals += 1; girl.pensionMissed = 0;
      girl.bond = Math.min(100, girl.bond + 3);
      next.logs.unshift({ id: `log-renew-${girl.id}-${girl.contractRenewals}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${girl.name}续签 ${girl.contractDays} 日契约（第 ${girl.contractRenewals} 次续签），并结清退休金欠款。`, delta: -cost });
      return { state: next, ok: true, message: `${girl.name}的契约延长至第 ${girl.contractEndDay} 日。` };
    }
    case 'rehire': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.retired || girl.retiredReason !== 'contract') return { state, ok: false, message: '只有因欠约退休的契约者可以返聘。' };
      const cost = 600 + girl.level * 120;
      if (next.gold < cost) return { state, ok: false, message: `返聘需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.retired = false; girl.retiredReason = undefined; girl.status = 'idle'; girl.contractEndDay = next.day + CONTRACT_DAYS; girl.pensionMissed = 0;
      girl.bond = Math.max(0, girl.bond - 5);
      next.logs.unshift({ id: `log-rehire-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `${girl.name}接受返聘，重新回到夜班名册。` });
      return { state: next, ok: true, message: `${girl.name}已返聘，契约重新生效。` };
    }
    case 'setAssistant': {
      const next = clone(state);
      if (!action.girlId) { next.assistantId = undefined; return { state: next, ok: true, message: '已取消值班助理。' }; }
      const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.bond < 40) return { state, ok: false, message: `${girl.name}还需要更多信任（羁绊 40）才能担任值班助理。` };
      next.assistantId = action.girlId;
      next.logs.unshift({ id: `log-assistant-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}开始担任值班助理，会替你整理议题与排班。` });
      return { state: next, ok: true, message: `${girl.name}成为值班助理。` };
    }
    case 'seenPrologue': {
      if (state.prologueSeen) return { state, ok: true, message: '' };
      const next = clone(state);
      next.prologueSeen = true;
      return { state: next, ok: true, message: '' };
    }
    case 'openingFill': {
      if (state.openingFilledAt === state.day) return { state, ok: true, message: '今夜已经补过了。' };
      const next = clone(state);
      const addedIncidents = topUpFromFallback(next, { day: next.day, minutes: next.minutes }, OPENING_INCIDENTS).length;
      next.openingFilledAt = next.day;
      trimOpinions(next);
      if (addedIncidents > 0) {
        next.logs.unshift({
          id: `log-opening-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'council',
          text: `今夜补充了 ${addedIncidents} 个待用事件；议题等待叙事者提交。`,
        });
      }
      return { state: next, ok: true, message: addedIncidents ? `补齐了 ${addedIncidents} 个待用事件。` : '今夜该有的都有了。' };
    }
    case 'setStarters': {
      const ids = Array.isArray(action.girlIds) ? [...new Set(action.girlIds)] : [];
      if (ids.length < 2 || ids.length > 6) return { state, ok: false, message: '开局编成至少 2 人、最多 6 人。' };
      const pool = new Set<string>([
        ...state.candidates.map(girl => girl.id),
        ...state.girls.filter(girl => !girl.retired).map(girl => girl.id),
      ]);
      if (ids.some(id => !pool.has(id))) return { state, ok: false, message: '有一位少女不在候选里。' };
      const rawLeaders = Array.isArray(action.customLeaders) ? action.customLeaders : [];
      const rawGirls = Array.isArray(action.customGirls) ? action.customGirls : [];
      const pickFaction = (value: unknown): FactionId | undefined => FACTION_ORDER.find(faction => faction === value);
      const pickId = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, 64) : '');
      const customLeaders = rawLeaders
        .map(raw => {
          const faction = pickFaction((raw as FactionLeader | undefined)?.faction);
          const id = pickId((raw as FactionLeader | undefined)?.id);
          return faction && id ? sanitizeCustomLeader(raw, faction, id) : null;
        })
        .filter((leader): leader is FactionLeader => Boolean(leader));
      const customGirls = rawGirls
        .map(raw => {
          const faction = pickFaction((raw as FactionGirl | undefined)?.faction);
          const id = pickId((raw as FactionGirl | undefined)?.id);
          return faction && id ? sanitizeCustomGirl(raw, faction, id) : null;
        })
        .filter((girl): girl is FactionGirl => Boolean(girl));
      const parsed = sanitizeFactionRoster(action.roster, customLeaders, customGirls);
      if (!parsed) return { state, ok: false, message: '三方阵容不合法：每方 1 位首领、1–4 位随从，同一个人不能占两个位置。' };
      const roster = parsed.roster;
      const drafted = ids.map(id => {
        const existing = [...state.candidates, ...state.girls].find(girl => girl.id === id);
        return existing;
      }).filter((girl): girl is Girl => Boolean(girl));
      if (drafted.length !== ids.length) return { state, ok: false, message: '有一位少女不在候选里。' };
      const rostered = new Set(FACTION_ORDER.flatMap(faction => [roster[faction].leaderId, ...roster[faction].memberIds]));
      if (drafted.some(girl => rostered.has(girl.id))) return { state, ok: false, message: '已经进入名册的少女不能再进事务所名册。' };
      const next = clone(state);
      const starters = drafted.map(girl => hydrate({ ...girl, candidateUntilDay: 0, status: 'idle', remaining: 0, roomId: 'lounge' }));
      const starterIds = new Set(starters.map(girl => girl.id));
      // 没被选中的原班人马直接离开事务所，不回市场；但已经退役或故去的留在档案里，编成不该抹掉她们。
      next.girls = [...starters, ...state.girls.filter(girl => girl.retired || girl.dead)];
      // 编进事务所或势力的人不再挂牌；剩下的人还在市场里等活儿，编成不该清空候选池。
      next.candidates = next.candidates.filter(girl => !starterIds.has(girl.id) && !rostered.has(girl.id));
      normalizeMarketWindow(next, true);
      next.factionRoster = roster;
      next.customFactionLeaders = parsed.leaders;
      next.customFactionGirls = parsed.girls;
      next.startersPicked = true;
      next.logs.unshift({ id: `log-starters-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `开局编成完成：${starters.length} 位契约少女，三方阵容已定。` });
      return { state: next, ok: true, message: '编成已确认。' };
    }
    case 'hireLeader': {
      const leader = leaderById(action.leaderId);
      if (!leader) return { state, ok: false, message: '没有这位首领。' };
      const owner = FACTION_ORDER.find(faction => rosterLeader(state, faction).id === leader.id);
      if (!owner) return { state, ok: false, message: '她现在已经不在任何一方了。' };
      if (!factionCollapsed(state, owner)) return { state, ok: false, message: '她还有辖区要守。' };
      if (state.girls.some(girl => girl.id === leader.id && !girl.retired)) return { state, ok: false, message: '她已经在名册里。' };
      if (state.gold < LEADER_HIRE_COST) return { state, ok: false, message: `星砂不足（需要 ${LEADER_HIRE_COST}）。` };
      const next = clone(state);
      next.gold -= LEADER_HIRE_COST;
      next.factions[owner].standing = 0;
      for (const faction of FACTION_ORDER) if (faction !== owner) next.factions[faction].standing = Math.min(100, next.factions[faction].standing + 3);
      const baseMaxHp = Math.round(96 + leader.stats.empathy * 0.3) + leader.level * 4;
      next.girls.unshift(hydrate({
        id: leader.id, name: leader.name, codename: leaderTitle(leader, owner), title: leaderTitle(leader, owner),
        element: (owner === 'association' ? '星光系' : owner === 'government' ? '糖霜系' : '月影系') as Girl['element'], color: leader.color, portrait: '', portraitSpec: leader.portraitSpec,
        level: leader.level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp,
        spirit: 0, maxSpirit: 0,
        fatigue: 0, bond: 40, exp: 0, stats: { ...leader.stats }, baseStats: { ...leader.stats },
        status: 'idle', roomId: 'lounge', remaining: 0, skill: '', skills: [...leader.skillIds],
        description: leader.note, cost: 0, scars: [], relationships: {}, archetype: leader.archetype,
        quote: leader.quote, goal: '找一个不需要再替谁守门的位置。', goalKind: '成长', traits: [], conditions: [],
        contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: '', personality: '', outfitDescription: '', wardrobe: [], outfitId: 'uniform', expression: 'calm',
        corruption: 0, equipment: {}, factionTag: leader.origin, leader: true, starter: false,
      }));
      next.chronicle.unshift({ id: `chr-hire-${leader.id}-${next.day}`, at: dateLabel(next.day, next.minutes), day: next.day, kind: '登记', title: `${leader.name} 并入事务所`, summary: `${factionInfo[owner].name} 名下已无辖区，${leader.name} 签下了契约。` });
      next.logs.unshift({ id: `log-hire-${leader.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `${leader.name} 成为事务所的契约者（−${LEADER_HIRE_COST} 星砂）。` });
      return { state: next, ok: true, message: `${leader.name} 已加入。` };
    }
    case 'setOfficeProfile': {
      const next = clone(state);
      const profile = sanitizeOfficeProfile(action.profile);
      const before = state.office ?? DEFAULT_OFFICE_PROFILE;
      if (profile.background === before.background && profile.philosophy === before.philosophy && profile.goal === before.goal) {
        return { state, ok: false, message: '事务所档案没有变化。' };
      }
      next.office = profile;
      next.logs.unshift({ id: `log-office-profile-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: '事务所档案已更新：背景、理念与目标写进了世界书。' });
      return { state: next, ok: true, message: '事务所档案已写入世界书。' };
    }
    case 'decideOpinion': {
      const next = clone(state); let opinion = next.opinions.find(o => o.id === action.opinionId);
      if (!opinion || opinion.status !== 'pending') return { state, ok: false, message: '这项议题已经处理过了。' };
      const option = resolveOpinionOptions(next, opinion).find(entry => entry.id === action.decision);
      if (!option) return { state, ok: false, message: '找不到这个选项。' };
      const preview = previewOpinionOption(next, opinion, option);
      if (!preview.ok) return { state, ok: false, message: `资源不足：${preview.missing.join('；')}` };
      const decision = action.decision;
      opinion.status = decision === 'accept' ? 'accepted' : decision === 'reject' ? 'rejected' : 'deferred';
      if (decision === 'defer') opinion.revisitDay = next.day + 1;
      const applied = applyOpinionChanges(next, opinion, option);
      let working = next;
      if (preview.minutes > 0) {
        const moved = advance(next, preview.minutes);
        if (!moved.ok) return { state, ok: false, message: moved.message };
        working = moved.state;
      }
      opinion = working.opinions.find(o => o.id === action.opinionId);
      const verb = decision === 'accept' ? '批准' : decision === 'reject' ? '驳回' : '暂缓';
      const detail = applied.tags.length ? ` ${applied.tags.join('，')}。` : '';
      const revisit = decision === 'defer' ? ` 下个议事日（第 ${next.day + 1} 日）重新提出。` : '';
      working.logs.unshift({ id: `log-decide-${opinion?.id ?? action.opinionId}`, time: dateLabel(working.day, working.minutes), kind: 'council', text: `${verb}议题「${opinion?.title ?? ''}」。${detail}${revisit}`, delta: applied.gold });
      if (opinion?.storylineId && decision !== 'defer') resolveStoryWait(working, opinion.storylineId, 'opinion', opinion.id);
      return { state: working, ok: true, message: `已处理「${opinion?.title ?? ''}」。` };
    }
    case 'startExpedition': {
      const next = clone(state);
      if (next.expeditions.length >= 1) return { state, ok: false, message: '星象台一次只能支持一支远行队伍。' };
      const observatory = next.rooms.find(r => r.type === 'observatory');
      if (!observatory) return { state, ok: false, message: '需要先建造星象台。' };
      if (action.memberIds.length < 1 || action.memberIds.length > 2) return { state, ok: false, message: '远行队伍需要 1–2 人。' };
      const members = action.memberIds.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
      if (members.length !== action.memberIds.length) return { state, ok: false, message: '队伍成员无效。' };
      for (const girl of members) {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}当前无法参加远行。` };
        if (inWithdrawal(girl)) return { state, ok: false, message: `${girl.name}正在断药期，无法远行。请先使用月蚀抑制剂。` };
        if (girl.pensionMissed >= 15) return { state, ok: false, message: `${girl.name}的契约欠约过久，请先续签。` };
        girl.status = 'expedition'; girl.roomId = observatory.id;
      }
      next.expeditions.push({ id: `exp-${next.day}-${next.minutes}-${next.expeditions.length}`, roomId: observatory.id, memberIds: members.map(g => g.id), startedDay: next.day, startedMinutes: next.minutes, cyclesDone: 0, lastSettledDay: next.day, lastSettledMinutes: next.minutes });
      next.logs.unshift({ id: `log-exp-start-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: `${members.map(g => g.name).join('、')}进入星象台远行，每 60 分钟结算一次观测结果。` });
      return { state: next, ok: true, message: '远行开始，星象台将每小时回报一次。' };
    }
    case 'recallExpedition': {
      const next = clone(state); const expedition = next.expeditions.find(e => e.id === action.expeditionId);
      if (!expedition) return { state, ok: false, message: '这支远行队伍已经结束。' };
      for (const id of expedition.memberIds) { const girl = findGirl(next, id); if (girl && girl.status === 'expedition') girl.status = 'idle'; }
      next.expeditions = next.expeditions.filter(e => e.id !== expedition.id);
      next.logs.unshift({ id: `log-exp-recall-${expedition.id}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: '星象台远行队伍提前返回，最后一轮观测未结算。' });
      return { state: next, ok: true, message: '远行队伍已返回。' };
    }
    case 'clinic': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.dead) return { state, ok: false, message: '她已不在名册上。' };
      if (action.mode === 'treat') {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}正在${statusLabels[girl.status]}，现在不能开始治疗。` };
        if (treatmentFor(next, girl.id)) return { state, ok: false, message: `${girl.name}已经在治疗台上了。` };
        const quote = clinicQuote(girl, Boolean(action.kink));
        if (!quote.kink && quote.missing <= 0) return { state, ok: false, message: `${girl.name}没有需要处理的伤口。` };
        if (next.gold < quote.cost) return { state, ok: false, message: `这次治疗需要 ${quote.cost} 星砂，当前不足。` };
        const startedAt = absoluteMinutes(next.day, next.minutes);
        next.gold -= quote.cost; book(next, next.day, -quote.cost);
        girl.status = 'healing'; girl.remaining = quote.minutes;
        next.treatments.push({
          id: `treat-${girl.id}-${next.day}-${next.minutes}`, girlId: girl.id,
          startedAt, endsAt: startedAt + quote.minutes,
          hpStart: girl.hp, hpTarget: quote.kink ? girl.hp : effectiveMaxHp(girl), paid: quote.cost, kink: Boolean(action.kink),
        });
        next.logs.unshift({
          id: `log-treat-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'clinic',
          text: quote.kink
            ? `${girl.name}预约了一次癖好护理（120 分钟，${quote.cost} 星砂）。诊所把灯调暗了一档。`
            : `${girl.name}躺上诊所的治疗台（${quote.minutes} 分钟，${quote.cost} 星砂）。`,
          delta: -quote.cost,
        });
        return { state: next, ok: true, message: `${girl.name}开始治疗，约 ${quote.minutes} 分钟后结束。` };
      }
      if (action.mode === 'wipe') {
        if (girl.status === 'mission' || girl.status === 'expedition') return { state, ok: false, message: '出勤中的契约者无法进行记忆重塑。' };
        if (next.gold < 4000) return { state, ok: false, message: '记忆重塑需要 4,000 星砂。' };
        const oldLevel = girl.level;
        next.gold -= 4000; book(next, next.day, -4000);
        girl.level = 1; girl.exp = 0;
        girl.stats = { ...girl.baseStats };
        girl.baseMaxHp = Math.max(40, girl.baseMaxHp - (oldLevel - 1) * 4);
        girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
        girl.hp = girl.maxHp;
        girl.maxSpirit = effectiveGuard(girl);
        girl.spirit = girl.maxSpirit;
        girl.status = 'idle'; girl.remaining = 0; girl.conditions = [];
        next.logs.unshift({ id: `log-wipe-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}接受了记忆重塑。等级与能力回到起点，疤痕仍在。`, delta: -4000 });
        return { state: next, ok: true, message: `${girl.name}的能力已重塑至 1 级。` };
      }
      if (action.mode === 'clear') {
        if (girl.status === 'mission' || girl.status === 'expedition') return { state, ok: false, message: '出勤中的契约者无法进行记忆清除。' };
        const mental = girl.scars.filter(scar => scar.kind === 'mental');
        if (!mental.length) return { state, ok: false, message: `${girl.name}没有可清除的精神疤痕。` };
        if (next.gold < MEMORY_CLEAR_COST) return { state, ok: false, message: `记忆清除需要 ${MEMORY_CLEAR_COST.toLocaleString('en-US')} 星砂。` };
        const target = mental.find(scar => scar.id === action.clearScarId) ?? mental[0];
        next.gold -= MEMORY_CLEAR_COST; book(next, next.day, -MEMORY_CLEAR_COST);
        girl.scars = girl.scars.filter(scar => scar.id !== target.id);
        // 疤痕少了，上限跟着回来：血量按剩余疤痕重算，心防按当前共情重算。
        girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
        girl.hp = Math.min(girl.hp, girl.maxHp);
        girl.maxSpirit = effectiveGuard(girl);
        girl.spirit = girl.maxSpirit;
        next.logs.unshift({
          id: `log-clear-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'clinic',
          text: `${girl.name}做了一次记忆清除。「${target.name}」被折好收进档案袋，等级与能力没有动。`,
          delta: -MEMORY_CLEAR_COST,
        });
        return { state: next, ok: true, message: `${girl.name}的精神疤痕「${target.name}」已被清除。` };
      }
      if (action.mode === 'clone') {
        if (girl.cloneOf || girl.generation) return { state, ok: false, message: '复制体不能再次被复制。' };
        if (girl.level < 3) return { state, ok: false, message: '只有 3 级以上的契约者可以进行复制。' };
        if (next.gold < 18000) return { state, ok: false, message: '复制契约需要 18,000 星砂。' };
        if (seatsTaken(next) >= capacity(next)) return { state, ok: false, message: '没有空余席位安置复制体。' };
        next.gold -= 18000; book(next, next.day, -18000);
        const seed = hashText(`${girl.id}:${next.day}:${next.minutes}`).toString(16).padStart(8, '0');
        const copy: Girl = {
          ...clone(girl), id: `g_${seed}`, name: `${girl.name}·复制体`, codename: `${girl.codename} II`, level: 1, exp: 0,
          stats: { ...girl.baseStats }, hp: girl.baseMaxHp, maxHp: girl.baseMaxHp, baseMaxHp: girl.baseMaxHp,
          spirit: 0, maxSpirit: 0,
          fatigue: 0, bond: 20, status: 'idle', roomId: 'lounge', remaining: 0, scars: [], conditions: [],
          relationships: {}, retired: false, dead: false, retiredReason: undefined, cloneOf: girl.id, generation: (girl.generation ?? 0) + 1,
          contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, missionId: undefined,
        };
        next.girls.push(copy);
        next.logs.unshift({ id: `log-clone-${copy.id}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `以${girl.name}为原体完成复制契约。复制体「${copy.name}」从 1 级开始。`, delta: -18000 });
        return { state: next, ok: true, message: `${copy.name}已加入名册。` };
      }
      return { state, ok: false, message: '未知的诊所项目。' };
    }
    case 'hire': {
      const next = clone(state); const candidate = next.candidates.find(g => g.id === action.girlId);
      if (!candidate) return { state, ok: false, message: '这位候选者已经不在名册上。' };
      if (next.gold < candidate.cost) return { state, ok: false, message: `星砂不足，还需要 ${candidate.cost - next.gold}。` };
      const used = seatsTaken(next);
      if (used >= capacity(next)) return { state, ok: false, message: '基地席位已满，请先扩建宿舍或让资深契约者退役。' };
      next.gold -= candidate.cost;
      book(next, next.day, -candidate.cost);
      next.girls.push({ ...candidate, status: 'idle', roomId: 'lounge', remaining: 0, contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, retired: false, retiredReason: undefined });
      normalizeMarketWindow(next, true);
      next.candidates = next.candidates.filter(g => g.id !== candidate.id);
      next.marketSold = Array.from(new Set([...(next.marketSold ?? []), candidate.id]));
      normalizeMarketWindow(next);
      next.logs.unshift({ id: `log-hire-${candidate.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${candidate.name}缔结契约，事务所增加一位新的魔法少女。`, delta: -candidate.cost });
      next.opinions.unshift(makeOpinion(next, next.girls[next.girls.length - 1], '同伴', `欢迎${candidate.name}`, '新契约者已经住进宿舍。她想为对方准备一点什么。', '申请 300 星砂筹办一次小型欢迎会。'));
      return { state: next, ok: true, message: `${candidate.name}已加入夜糖事务所。` };
    }
    case 'build': {
      const next = clone(state); const room = next.rooms.find(r => r.id === (action.roomId ?? 'dorm')) ?? next.rooms.find(r => r.type === 'dorm')!;
      if (room.level >= 4) return { state, ok: false, message: '这个房间已经达到最高等级。' };
      const cost = buildCost(room);
      if (next.gold < cost) return { state, ok: false, message: `星砂不足，扩建需要 ${cost}。` };
      next.gold -= cost; room.level += 1;
      book(next, next.day, -cost);
      if (room.type === 'dorm') room.capacity += 2;
      next.logs.unshift({ id: `log-build-${room.id}-${room.level}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `${room.name}升至 ${room.level} 级${room.type === 'dorm' ? '，新增 2 个契约席位' : ''}。`, delta: -cost });
      return { state: next, ok: true, message: `${room.name}已升级${room.type === 'dorm' ? '，新增 2 个席位' : ''}。` };
    }
    case 'retire': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.status === 'mission') return { state, ok: false, message: '出勤中的契约者无法办理退役。' };
      if (girl.scars.length < 4) return { state, ok: false, message: '只有累积 4 道疤痕的契约者可以申请退役。' };
      girl.retired = true; girl.status = 'retired'; girl.retiredReason = 'injury';
      next.logs.unshift({ id: `log-retire-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}办理了退役，转任事务所文职。她的席位仍留在基地，并将按月领取退休金。` });
      return { state: next, ok: true, message: `${girl.name}已转为文职，不再参与派遣。` };
    }
    case 'changeOutfit': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.witch) return { state, ok: false, message: '魔女化期间已锁定在魔女化立绘；先点击衣柜第五格恢复普通形态。' };
      if (!girl.wardrobe.some(o => o.id === action.outfitId)) return { state, ok: false, message: '衣柜里没有这套服装。' };
      girl.outfitId = action.outfitId;
      return { state: next, ok: true, message: `${girl.name}换上了「${girl.wardrobe.find(o => o.id === action.outfitId)?.name}」。` };
    }
    case 'setExpression': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      girl.expression = action.expression;
      return { state: next, ok: true, message: `${girl.name}的表情已切换。` };
    }
    case 'setPersonality': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const text = action.text.trim().slice(0, 600);
      if (!text) return { state, ok: false, message: '性格描述不能为空。' };
      if (girl.witch) girl.witchPersonality = text;
      else girl.personality = text;
      return { state: next, ok: true, message: girl.witch ? `${girl.name}的魔女化性格记录已更新。` : `${girl.name}的性格记录已更新。` };
    }
    case 'allocateStat': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const result = allocatePoint(girl, action.stat, action.amount ?? 1);
      if (!result.ok) return { state, ok: false, message: result.message };
      const stat = statLabel[action.stat];
      return { state: next, ok: true, message: `${girl.name}的${stat}提升到 ${girl.stats[action.stat]}，还剩 ${girl.unspentPoints ?? 0} 点。` };
    }
    case 'setLevelUpMode': {
      if (state.levelUpMode === action.mode) return { state, ok: false, message: '已经是这个模式了。' };
      const next = clone(state);
      next.levelUpMode = action.mode;
      next.logs.unshift({ id: `log-level-mode-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `升级成长方式改为${action.mode === 'manual' ? '手动加点：升级只发 10 点，由你分配' : '自动加点：按职阶直接成长'}。` });
      return { state: next, ok: true, message: action.mode === 'manual' ? '以后升级会发可分配点数。' : '以后升级按职阶自动加属性。' };
    }
    case 'endNight': return endNight(state);
    case 'importWardrobe': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const base = action.mode === 'replace' ? [] : girl.wardrobe;
      const incoming = action.outfits
        .map(outfit => sanitizeOutfit(outfit, girl.color))
        .filter((outfit): outfit is Outfit => Boolean(outfit))
        .filter(outfit => !base.some(existing => existing.id === outfit.id || existing.name === outfit.name));
      if (!incoming.length) return { state, ok: false, message: '没有可以导入的新服装（名称为空或与现有衣柜重名）。' };
      const merged: Outfit[] = [];
      for (const outfit of [...base, ...incoming]) {
        if (merged.some(existing => existing.id === outfit.id || existing.name === outfit.name)) continue;
        merged.push(outfit);
      }
      const kept = merged.slice(0, WARDROBE_LIMIT);
      const added = incoming.filter(outfit => kept.some(item => item.id === outfit.id)).length;
      const dropped = incoming.length - added;
      girl.wardrobe = kept;
      if (action.outfitId && kept.some(outfit => outfit.id === action.outfitId)) girl.outfitId = action.outfitId;
      else if (!kept.some(outfit => outfit.id === girl.outfitId)) girl.outfitId = kept[0].id;
      pruneOrphanVariants(girl);
      next.logs.unshift({ id: `log-wardrobe-import-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}的衣柜${action.mode === 'replace' ? '被替换并' : ''}新增 ${added} 套服装${dropped ? `（${dropped} 套因衣柜已满未导入）` : ''}。` });
      return { state: next, ok: true, message: `已导入 ${added} 套服装${dropped ? `，${dropped} 套因衣柜已满未导入` : ''}。` };
    }
    case 'removeOutfit': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.wardrobe.length <= 1) return { state, ok: false, message: '至少要为契约者保留一套服装。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      girl.wardrobe = girl.wardrobe.filter(item => item.id !== action.outfitId);
      if (girl.outfitId === action.outfitId) girl.outfitId = girl.wardrobe[0].id;
      pruneOrphanVariants(girl);
      return { state: next, ok: true, message: `「${outfit.name}」已从衣柜移除。` };
    }
    case 'renameOutfit': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      const name = action.name.trim().slice(0, 16);
      if (!name) return { state, ok: false, message: '服装名称不能为空。' };
      if (girl.wardrobe.some(item => item.id !== outfit.id && item.name === name)) return { state, ok: false, message: '衣柜里已经有同名服装。' };
      outfit.name = name;
      if (action.description !== undefined) outfit.description = action.description.trim().slice(0, 120);
      return { state: next, ok: true, message: `服装已改名为「${name}」。` };
    }
    case 'buyItem': {
      const next = clone(state);
      const entry = action.stockId
        ? next.marketStock.find(stock => stock.id === action.stockId)
        : next.marketStock.find(stock => !stock.sold && stock.itemId === action.itemId);
      if (!entry) return { state, ok: false, message: '今日货架已经售罄，明天会重新进货。' };
      if (entry.sold) return { state, ok: false, message: '这个货位今天已经售出，明天会刷新。' };
      const item = getItem(entry.itemId);
      if (!item) return { state, ok: false, message: '货架上没有这件物资。' };
      const standing = factionStanding(next, item.faction);
      if (standing < item.standingReq) return { state, ok: false, message: `${factionInfo[item.faction].name}声望需要 ${item.standingReq}，当前 ${standing}。` };
      if (item.id === 'tax-voucher' && (next.inventory['tax-voucher'] ?? 0) > 0) return { state, ok: false, message: '税补券每 7 日只能兑换一张。' };
      if (item.id === 'moon-drug' && (next.inventory['moon-drug'] ?? 0) >= 5) return { state, ok: false, message: '抑制剂最多囤积 5 支。' };
      const price = itemPrice(next, item);
      if (next.gold < price) return { state, ok: false, message: `购买需要 ${price} 星砂。` };
      next.gold -= price; book(next, next.day, -price);
      entry.sold = true;
      next.inventory[item.id] = (next.inventory[item.id] ?? 0) + 1;
      next.logs.unshift({ id: `log-buy-${entry.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `从${factionInfo[item.faction].name}购入「${item.name}」。`, delta: -price });
      return { state: next, ok: true, message: `已购入「${item.name}」，放入事务所仓库。` };
    }
    case 'equipItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId); const item = getItem(action.itemId);
      if (!girl || !item) return { state, ok: false, message: '找不到对应的契约者或装备。' };
      if (item.slot !== action.slot) return { state, ok: false, message: '这件物资不能装备到这个槽位。' };
      if ((next.inventory[item.id] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有这件装备。' };
      const previous = girl.equipment[action.slot];
      if (previous) next.inventory[previous] = (next.inventory[previous] ?? 0) + 1;
      next.inventory[item.id] -= 1;
      girl.equipment[action.slot] = item.id;
      girl.maxHp = effectiveMaxHp(girl); girl.hp = Math.min(girl.hp, girl.maxHp);
      girl.maxSpirit = effectiveMaxSpirit(girl); girl.spirit = Math.min(girl.spirit, girl.maxSpirit);
      return { state: next, ok: true, message: `${girl.name}装备了「${item.name}」。` };
    }
    case 'unequipItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到对应的契约者。' };
      const previous = girl.equipment[action.slot];
      if (!previous) return { state, ok: false, message: '这个槽位没有装备。' };
      next.inventory[previous] = (next.inventory[previous] ?? 0) + 1;
      delete girl.equipment[action.slot];
      girl.maxHp = effectiveMaxHp(girl); girl.hp = Math.min(girl.hp, girl.maxHp);
      girl.maxSpirit = effectiveMaxSpirit(girl); girl.spirit = Math.min(girl.spirit, girl.maxSpirit);
      return { state: next, ok: true, message: `${girl.name}卸下了「${getItem(previous)?.name ?? '装备'}」。` };
    }
    case 'useItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId); const item = getItem(action.itemId);
      if (!girl || !item) return { state, ok: false, message: '找不到对应的契约者或物资。' };
      if ((next.inventory[item.id] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有这件物资。' };
      if (item.effect === 'drug') {
        if (!girl.witch) return { state, ok: false, message: '只有魔女需要月蚀抑制剂。' };
        next.inventory[item.id] -= 1;
        girl.drugUntilDay = next.day + 10; girl.withdrawalDays = 0; girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + 20);
        next.logs.unshift({ id: `log-use-drug-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}使用了月蚀抑制剂。断药状态结束，药效维持至第 ${girl.drugUntilDay} 日。` });
        return { state: next, ok: true, message: `${girl.name}的断药状态已解除。` };
      }
      if (item.effect === 'heal') {
        next.inventory[item.id] -= 1;
        girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + (item.amount ?? 40));
        return { state: next, ok: true, message: `${girl.name}恢复了 ${item.amount ?? 40} 点生命。` };
      }
      if (item.effect === 'purify') {
        next.inventory[item.id] -= 1;
        girl.corruption = Math.max(0, girl.corruption - (item.amount ?? 8));
        return { state: next, ok: true, message: `${girl.name}完成净化课程，侵蚀度下降。` };
      }
      if (item.effect === 'taxRefund') {
        next.inventory[item.id] -= 1;
        next.gold += item.amount ?? 1500; book(next, next.day, item.amount ?? 1500);
        return { state: next, ok: true, message: `税补券兑换为 ${item.amount ?? 1500} 星砂。` };
      }
      if (item.effect === 'contractDiscount') {
        next.inventory[item.id] = (next.inventory[item.id] ?? 1) - 1;
        next.inventory['permit'] = 1;
        return { state: next, ok: true, message: '执勤许可已激活，下一次签约金降低 10%。' };
      }
      return { state, ok: false, message: '这件物资需要在对应界面使用。' };
    }
    case 'acceptFactionTask': {
      const next = clone(state); const faction = action.faction; const info = next.factions[faction];
      if (!info) return { state, ok: false, message: '未知势力。' };
      if (info.envoyTaskId) return { state, ok: false, message: '今天已经接下这位代表的委托了。' };
      const mission = factionTask(next, faction);
      next.missions.unshift(mission);
      info.envoyTaskId = mission.id;
      next.logs.unshift({ id: `log-envoy-${faction}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'council', text: `接下${factionInfo[faction].name}代表${factionInfo[faction].envoy}的委托「${mission.title}」。` });
      return { state: next, ok: true, message: `${factionInfo[faction].envoy}把任务书推了过来。` };
    }
    case 'upgradeMarket': {
      const next = clone(state); const cost = marketUpgradeCost(next.marketLevel);
      if (!cost || next.marketLevel >= 4) return { state, ok: false, message: '市场已经达到最高等级。' };
      if (next.gold < cost) return { state, ok: false, message: `市场升级需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost); next.marketLevel += 1;
      // 扩建只多开窗口，不换今天已经挂牌的人，也不清掉售罄占位。
      normalizeMarketWindow(next, true);
      next.logs.unshift({ id: `log-market-${next.marketLevel}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `市场扩建至 ${next.marketLevel} 级，每日名册增加至 ${marketSize(next.marketLevel)} 位。`, delta: -cost });
      return { state: next, ok: true, message: `市场升至 ${next.marketLevel} 级。` };
    }
    case 'advancedRecruit': {
      const next = clone(state); const level = action.level;
      if (!Number.isInteger(level) || level < 1 || level > 6) return { state, ok: false, message: '高级招聘只能指定 1–6 级。' };
      if (level > next.marketLevel + 2) return { state, ok: false, message: `当前市场等级最多指定 ${next.marketLevel + 2} 级。` };
      if (next.advancedDay === next.day) return { state, ok: false, message: '今天已经进行过一次高级招聘。' };
      const cost = advancedCost(level);
      if (next.gold < cost.gold) return { state, ok: false, message: `高级招聘需要 ${cost.gold} 星砂。` };
      if (next.reputation < cost.stability) return { state, ok: false, message: `城市安定度不足，需要 ${cost.stability}。` };
      if (next.candidates.length >= next.poolLimits.candidates) return { state, ok: false, message: `候选名册已满（${next.poolLimits.candidates} 位），请先签约或等待刷新。` };
      next.gold -= cost.gold; next.reputation -= cost.stability; book(next, next.day, -cost.gold);
      next.advancedDay = next.day;
      const girl = makeCandidate(next, level, next.day + level * 31);
      girl.candidateUntilDay = next.day + 3;
      next.candidates.unshift(girl);
      unshiftMarketWindow(next, girl.id);
      next.logs.unshift({ id: `log-advanced-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'dispatch', text: `通过协会渠道指定招募 ${level} 级候选者「${girl.name}」，城市安定度 -${cost.stability}。`, delta: -cost.gold });
      return { state: next, ok: true, message: `${girl.name}已加入候选名册，保留 3 天。` };
    }
    case 'importCard': {
      const next = clone(state); const card = action.card;
      const key = girlCardHash(card);
      const g = card.girl;
      const signature = (value: typeof g | Girl) => JSON.stringify([
        value.portrait ?? '', value.portraitSpec ?? null, value.wardrobe ?? null, value.outfitId ?? '',
        ('expression' in value ? value.expression : undefined) ?? 'calm', value.importedVariants ?? {},
        value.witchForm ?? null, value.witchPersonality ?? '', value.appearance ?? '', value.personality ?? '',
        value.outfitDescription ?? '', value.color ?? '',
      ]);
      const roster = [...next.girls, ...next.candidates];
      // 同一张卡在详情里换过立绘/表情后再导出：按卡号或（自定义卡）名字+代号认人，直接更新，而不是拒收或再养一个。
      const existing = roster.find(girl => girl.cardId === key)
        ?? roster.find(girl => girl.custom && girl.cardId && girl.name === g.name && girl.codename === g.codename);
      if (existing) {
        if (existing.cardRevision === signature(g)) return { state, ok: false, message: '这张契约卡已经导入过，不能重复登记。' };
        existing.cardId = key;
        existing.cardRevision = signature(g);
        existing.portrait = g.portrait ?? '';
        existing.portraitSpec = g.portraitSpec;
        if (g.wardrobe?.length) existing.wardrobe = g.wardrobe.map(outfit => ({ ...outfit }));
        existing.outfitId = g.outfitId ?? existing.outfitId;
        existing.expression = g.expression ?? existing.expression;
        existing.importedVariants = g.importedVariants ? { ...g.importedVariants } : undefined;
        existing.witchForm = g.witchForm ? { ...g.witchForm, id: 'witchform', form: 'witch' } : existing.witchForm;
        existing.witchPersonality = g.witchPersonality ?? existing.witchPersonality;
        existing.appearance = g.appearance ?? existing.appearance;
        existing.personality = g.personality ?? existing.personality;
        existing.outfitDescription = g.outfitDescription ?? existing.outfitDescription;
        existing.title = g.title ?? existing.title;
        existing.quote = g.quote ?? existing.quote;
        existing.goal = g.goal ?? existing.goal;
        existing.color = g.color || existing.color;
        next.logs.unshift({ id: `log-card-update-${existing.id}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `契约卡「${existing.name}」已用新版本覆盖：立绘、表情与衣柜跟着卡片一起更新。` });
        return { state: next, ok: true, message: `契约卡已更新：${existing.name}的立绘与表情换成了卡里的版本。` };
      }
      if (next.candidates.length >= next.poolLimits.candidates) return { state, ok: false, message: `候选名册已满（${next.poolLimits.candidates} 位），请先移除一位候选或到设置中调高上限。` };
      if (!g.name || !Array.isArray(g.skillIds) || g.skillIds.length !== 3) return { state, ok: false, message: '契约卡资料不完整。' };
      const stats = { ...g.stats };
      const baseMaxHp = Math.round(96 + stats.empathy * 0.3);
      // 卡片自带定义的特性（自定义特性）优先；旧卡只写了 id，就只能靠全局目录。
      const cardTraits = (g.traits?.length
        ? g.traits.map(trait => ({ ...trait, tags: [...trait.tags] }))
        : g.traitIds.map(traitId => traitById.get(traitId)).filter((trait): trait is NonNullable<typeof trait> => Boolean(trait))
      ).slice(0, 6);
      const lostTraits = g.skippedTraits ?? 0;
      const id = `g_card_${key}`;
      // 出身按卡片来：导进来的少女保留她原来的立场，不再按 id 重新掷一次。
      // 旧卡片没有这个字段时，退回按名字确定性补齐，同一张卡导入结果始终一致。
      const cardOrigin = sanitizeGirlFaction(g.factionTag, g.name);
      const girl = hydrate({
        id, name: g.name, codename: g.codename, title: g.title, element: g.element, color: g.color,
        factionTag: cardOrigin,
        portrait: g.portrait ?? '', level: g.level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 0, maxSpirit: 0,
        fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
        skill: getSkill(g.skillIds[2]).name, skills: [...g.skillIds], description: g.appearance, cost: 1800 + g.level * 220,
        scars: [], relationships: {}, archetype: g.archetype, quote: g.quote,
        goal: g.goal, goalKind: '成长', traits: cardTraits, conditions: [],
        contractEndDay: next.day + 17, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: g.appearance, personality: g.personality, witchPersonality: g.witchPersonality, outfitDescription: g.outfitDescription,
        wardrobe: g.wardrobe?.length
          ? g.wardrobe
          : [customOutfitFor({ color: g.color, outfitDescription: g.outfitDescription, portrait: g.portrait, portraitSpec: g.portraitSpec })],
        outfitId: g.wardrobe?.length ? (g.outfitId ?? g.wardrobe[0].id) : 'custom',
        expression: g.expression ?? 'calm',
        corruption: 0, equipment: {}, custom: true, candidateUntilDay: next.day + 7, cardId: key, cardRevision: signature(g),
        portraitSpec: g.portraitSpec, portraitHint: g.portraitHint ?? '', importedVariants: g.importedVariants,
        witchForm: g.witchForm ? { ...g.witchForm, id: 'witchform', form: 'witch' } : undefined,
      });
      next.candidates.unshift(girl);
      unshiftMarketWindow(next, girl.id);
      archive(next, '登记', girl.name, `从契约卡导入。${girl.title}。${girl.appearance}`);
      const lostNote = lostTraits > 0 ? `（${lostTraits} 条特性没能随卡片带来，已跳过）` : '';
      next.logs.unshift({ id: `log-card-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `契约卡「${girl.name}」已导入候选名册，保留 7 天。${lostNote}` });
      return { state: next, ok: true, message: `契约卡已导入：${girl.name}进入候选名册。${lostNote}` };
    }
    case 'importCards': {
      let next = state;
      const added: string[] = [];
      const skipped: string[] = [];
      const failed: string[] = [];
      for (const card of action.cards) {
        const result = act(next, { type: 'importCard', card });
        if (result.ok) { next = result.state; added.push(card.girl.name); continue; }
        if (result.message.includes('已经导入过')) skipped.push(card.girl.name);
        else failed.push(card.girl.name);
      }
      if (!added.length) {
        return { state, ok: false, message: `没有新的契约卡进名册。${skipped.length ? `跳过重复 ${skipped.length} 张。` : ''}${failed.length ? `${failed.length} 张没能登记。` : ''}` };
      }
      const merged = clone(next);
      merged.logs.unshift({ id: `log-cardbox-${merged.day}-${merged.minutes}-${added.length}`, time: dateLabel(merged.day, merged.minutes), kind: 'base', text: `契约卡库导入 ${added.length} 张：${added.join('、')}。` });
      return { state: merged, ok: true, message: cardboxReport(added.length, skipped.length, failed.length) };
    }
    case 'refillMarket': {
      // 市场补货：卡库里还没用过的卡 → 候选者。逐张走 importCard，去重与上限都由它兜住。
      let next = state;
      const added: string[] = [];
      let duplicate = 0;
      let failed = 0;
      for (const card of action.cards ?? []) {
        if (next.candidates.length >= next.poolLimits.candidates) break;
        const result = act(next, { type: 'importCard', card });
        if (result.ok) { next = result.state; added.push(card.girl.name); continue; }
        if (result.message.includes('已经导入过')) duplicate += 1;
        else failed += 1;
      }
      if (!added.length) {
        return { state, ok: false, message: duplicate ? '卡库里的卡都已经在市场里了。' : '卡库里的卡没能补进市场。' };
      }
      const merged = clone(next);
      merged.logs.unshift({ id: `log-market-cards-${merged.day}-${added.length}`, time: dateLabel(merged.day, merged.minutes), kind: 'base', text: `市场补进了 ${added.length} 位新面孔：${added.join('、')}。` });
      return { state: merged, ok: true, message: `市场补进了 ${added.length} 位新面孔。${failed ? `另有 ${failed} 张没能登记。` : ''}` };
    }
    case 'createGirl': {
      const next = clone(state); const draft = action.draft;
      if (next.gold < 300) return { state, ok: false, message: '发布自定义契约需要 300 星砂登记费。' };
      if (next.candidates.length >= next.poolLimits.candidates) return { state, ok: false, message: '候选名册已满。' };
      if (!next.blank && next.reputation < 40) return { state, ok: false, message: '城市安定度需要达到 40 才能撰写新契约。' };
      const stats = draft.stats;
      const sum = stats.magic + stats.insight + stats.agility + stats.empathy;
      if (Object.values(stats).some(v => !Number.isFinite(v) || v < 40 || v > 90) || sum !== 260) return { state, ok: false, message: '四维每项需在 40–90，且总和必须为 260。' };
      if (draft.skillIds.length !== 3 || new Set(draft.skillIds).size !== 3) return { state, ok: false, message: '请选择三个不同的技能。' };
      if (draft.traits.length > 3) return { state, ok: false, message: '最多填写三个特性。' };
      const traits: Trait[] = draft.traits.filter(trait => trait.name.trim()).slice(0, 3).map(trait => ({
        id: `custom-trait-${hashText(`${trait.name}:${draft.name}`).toString(16)}`,
        name: trait.name.trim().slice(0, 16),
        polarity: trait.polarity,
        tags: ['自定义'],
        description: trait.description.trim().slice(0, 120) || '写在契约背面的那句话。',
      }));
      const baseMaxHp = Math.round(96 + stats.empathy * 0.3);
      const extra = draft.skillIds.reduce((acc, id) => acc + (getSkill(id).tier === 'ultimate' ? 700 : getSkill(id).tier === 'signature' ? 300 : 0), 0);
      const id = `g_${hashText(`${draft.name}:${next.day}:${next.minutes}:${next.candidates.length}`).toString(16).padStart(8, '0')}`;
      const customOutfit = customOutfitFor({ color: draft.color, outfitDescription: draft.outfitDescription, portrait: draft.portrait, portraitSpec: draft.appearanceSpec });
      const wardrobe = draft.wardrobe?.length ? draft.wardrobe.slice(0, 4) : [customOutfit];
      const witchForm = draft.witchForm ? { ...draft.witchForm, id: 'witchform' as const, form: 'witch' as const } : undefined;
      const outfitId = draft.outfitId && wardrobe.some(outfit => outfit.id === draft.outfitId) ? draft.outfitId : wardrobe[0].id;
      const validOutfitIds = new Set(wardrobe.map(outfit => outfit.id));
      if (witchForm) validOutfitIds.add('witchform');
      const importedVariants = sanitizeExpressionVariants(draft.importedVariants);
      for (const key of Object.keys(importedVariants)) {
        const parsed = parseExpressionVariantKey(key);
        if (!parsed || !validOutfitIds.has(parsed.outfitId)) delete importedVariants[key];
      }
      const girl = hydrate({
        id, name: draft.name, codename: draft.codename, title: draft.title, element: draft.element, color: draft.color,
        portrait: draft.portrait ?? wardrobe.find(outfit => outfit.portrait)?.portrait ?? '', portraitCrop: draft.portraitCrop, level: 1, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 0, maxSpirit: 0,
        fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
        skill: getSkill(draft.skillIds[2]).name, skills: draft.skillIds, description: draft.appearance, cost: 1800 + Math.max(0, sum - 260) * 40 + extra,
        scars: [], relationships: {}, archetype: draft.archetype, quote: draft.quote,
        goal: draft.goal, goalKind: '成长', traits, conditions: [],
        contractEndDay: next.day + 17, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: draft.appearance, personality: draft.personality, outfitDescription: draft.outfitDescription,
        portraitHint: draft.portraitHint?.trim().slice(0, 80) ?? '',
        wardrobe, outfitId, importedVariants, witchForm, expression: 'calm', corruption: 0, equipment: {}, custom: true, candidateUntilDay: next.day + 7,
        factionTag: draft.factionTag,
      });
      next.gold -= 300; book(next, next.day, -300);
      next.candidates.unshift(girl);
      unshiftMarketWindow(next, girl.id);
      archive(next, '登记', girl.name, `${girl.title}。${girl.appearance}`);
      next.logs.unshift({ id: `log-custom-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `新契约「${girl.name}」已发布到候选名册，保留 7 天。登记费 300 星砂。`, delta: -300 });
      return { state: next, ok: true, message: `${girl.name}已进入候选名册。` };
    }
    case 'setVariant': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const parsed = parseExpressionVariantKey(action.key);
      if (!parsed) return { state, ok: false, message: '表情差分的服装或表情无法识别。' };
      if (!isExpressionVariantData(action.dataUrl)) return { state, ok: false, message: '差分需要是 8MB 以内的图片。' };
      if (!girl.importedVariants) girl.importedVariants = {};
      const usedForOutfit = Object.keys(girl.importedVariants).filter(key => parseExpressionVariantKey(key)?.outfitId === parsed.outfitId).length;
      if (!girl.importedVariants[action.key] && usedForOutfit >= EXPRESSION_VARIANT_LIMIT) return { state, ok: false, message: `这套服装最多保存 ${EXPRESSION_VARIANT_LIMIT} 张表情差分，请先删除旧图。` };
      girl.importedVariants[action.key] = action.dataUrl;
      return { state: next, ok: true, message: `「${expressionLabel(parsed.expression)}」表情差分已保存。` };
    }
    case 'setVariants': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const entries = Object.entries(action.variants);
      if (!entries.length) return { state, ok: false, message: '没有可保存的表情差分。' };
      const staged = { ...(girl.importedVariants ?? {}) };
      for (const [key, dataUrl] of entries) {
        if (!parseExpressionVariantKey(key)) return { state, ok: false, message: `无法识别差分键「${key}」。` };
        if (!isExpressionVariantData(dataUrl)) return { state, ok: false, message: '差分需要是 8MB 以内的图片。' };
        staged[key] = dataUrl;
      }
      const perOutfit = new Map<string, number>();
      for (const key of Object.keys(staged)) {
        const parsed = parseExpressionVariantKey(key);
        if (!parsed) return { state, ok: false, message: `无法识别差分键「${key}」。` };
        perOutfit.set(parsed.outfitId, (perOutfit.get(parsed.outfitId) ?? 0) + 1);
      }
      if ([...perOutfit.values()].some(count => count > EXPRESSION_VARIANT_LIMIT)) return { state, ok: false, message: `每套服装最多保存 ${EXPRESSION_VARIANT_LIMIT} 张表情差分。` };
      girl.importedVariants = staged;
      return { state: next, ok: true, message: `已保存 ${entries.length} 张表情差分。` };
    }
    case 'deleteVariant': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.importedVariants?.[action.key]) return { state, ok: false, message: '这张表情差分已经不存在。' };
      delete girl.importedVariants[action.key];
      return { state: next, ok: true, message: '表情差分已移除。' };
    }
    case 'setOutfitDescription': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      const description = action.description.trim().slice(0, 200);
      if (!description) return { state, ok: false, message: '描述不能为空。' };
      outfit.description = description;
      return { state: next, ok: true, message: `「${outfit.name}」的描述已更新。` };
    }
    case 'setWitchForm': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!action.outfit) {
        if (!girl.witch) return { state, ok: false, message: `${girl.name}现在没有处于魔女化状态。` };
        girl.witch = false;
        return { state: next, ok: true, message: `${girl.name}已恢复普通形态；魔女化立绘仍留在衣柜第五格。` };
      }
      const activate = action.activate !== false;
      const witchAt = loadBalance().corruptionThreshold;
      if (activate && girl.corruption < witchAt && !girl.witch) return { state, ok: false, message: `${girl.name}的侵蚀还没有到能切换到魔女姿态的程度（${witchAt}）。立绘仍可以先导入。` };
      const outfit = sanitizeOutfit({ ...action.outfit, id: 'witchform', form: 'witch' }, girl.color);
      if (!outfit) return { state, ok: false, message: '这份魔女化立绘无法识别。' };
      girl.witchForm = { ...outfit, form: 'witch' };
      const witchPersonality = action.personality?.trim().slice(0, 600);
      if (witchPersonality) girl.witchPersonality = witchPersonality;
      if (!activate) return { state: next, ok: true, message: `${girl.name}的魔女化立绘已保存到衣柜第五格。` };
      girl.witch = true;
      if (!girl.witchPersonality?.trim()) girl.witchPersonality = defaultWitchPersonality(girl);
      next.logs.unshift({ id: `log-witchform-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}允许你保存了她的魔女化立绘。` });
      return { state: next, ok: true, message: `${girl.name}已切换到魔女化立绘，普通服装暂时锁定。` };
    }
    case 'clearWitchForm': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.witchForm) return { state, ok: false, message: '还没有保存过魔女化立绘。' };
      girl.witchForm = undefined;
      girl.witch = false;
      return { state: next, ok: true, message: `${girl.name}的魔女化立绘已撤下，第五格重新空出。` };
    }
    case 'mergeIncidentPool': {
      const merged = clone(state);
      const added = mergeIncidentPool(merged, action.entries, { day: merged.day, minutes: merged.minutes });
      if (added <= 0) return { state, ok: false, message: '这批事件没有能用的。' };
      merged.logs.unshift({ id: `log-incident-pool-${merged.day}-${merged.incidentSeq}`, time: dateLabel(merged.day, merged.minutes), kind: 'incident', text: `夜里又攒下 ${added} 件还没摆上桌的事。` });
      return { state: merged, ok: true, message: `桌上多出 ${added} 件还没轮到的事。` };
    }
    case 'addIncident': {
      const next = clone(state);
      if (next.incidents.some(incident => incident.id === action.incident.id)) return { state, ok: false, message: '这条事件已经在队列里了。' };
      if (next.incidents.filter(incident => incident.status === 'pending').length >= 5) return { state, ok: false, message: '待处理事件太多，先清掉手上的再说。' };
      const incident: Incident = { ...action.incident, day: next.day, status: 'pending' };
      if (!incident.options?.length) return { state, ok: false, message: '事件没有可选的应对方式。' };
      next.incidents.unshift(incident);
      next.logs.unshift({ id: `log-incident-new-${incident.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `必须现在决定：${incident.title}。` });
      return { state: next, ok: true, message: '一件必须立刻决定的事摆在了桌上。' };
    }
    case 'joinFront': {
      const next = clone(state);
      next.fronts = next.fronts ?? [];
      const front = next.fronts.find(item => item.id === action.frontId);
      if (!front) return { state, ok: false, message: '这条战线已经结束了。' };
      if (front.status !== 'open') return { state, ok: false, message: '这条战线已经有人站过去了。' };
      const squad: string[] = [];
      for (const id of action.girlIds) {
        const girl = findGirl(next, id);
        if (!girl) return { state, ok: false, message: '名单里有找不到的人。' };
        if (girl.dead || girl.retired) return { state, ok: false, message: `${girl.name}已经不在名册上了。` };
        if (girl.status === 'mission' || girl.status === 'resting') return { state, ok: false, message: `${girl.name}现在走不开。` };
        if (girl.hp <= 0) return { state, ok: false, message: `${girl.name}伤得太重，上不了街。` };
        if (girlInFront(next, girl.id)) return { state, ok: false, message: `${girl.name}已经在另一条战线上了。` };
        squad.push(girl.id);
      }
      if (!squad.length) return { state, ok: false, message: '至少要带一个人过去。' };
      front.side = action.side;
      front.squad = squad;
      front.status = 'joined';
      const backed = action.side === 'attacker' ? front.attacker : front.defender;
      next.logs.unshift({
        id: `log-front-join-${front.id}`, time: dateLabel(next.day, next.minutes), kind: 'battle',
        text: `我们站到了${factionName[backed]}这边：${frontLabel(front)}。${squad.length} 个人过去了。`,
      });
      return { state: next, ok: true, message: `已经把人派到${districts[front.district].name}。` };
    }
    case 'resolveIncident': {
      const next = clone(state); const incident = next.incidents.find(item => item.id === action.incidentId);
      if (!incident || incident.status !== 'pending') return { state, ok: false, message: '这件事已经处理过了。' };
      const option = action.optionId ? incident.options.find(item => item.id === action.optionId) : undefined;
      if (!option && incident.options.length > 0) return { state, ok: false, message: '没有这个选项。' };
      if (option) incident.choiceId = option.id;
      incident.status = 'resolved';
      incident.resolvedAt = dateLabel(next.day, next.minutes);
      applyIncidentEffect(next, incident, option?.effect ?? incident.scene?.effect ?? {});
      if (incident.templateId?.startsWith('resign-')) applyResignationChoice(next, incident);
      if (incident.storylineId) resolveStoryWait(next, incident.storylineId, 'incident', incident.id);
      return { state: next, ok: true, message: option ? `已决定：${option.label}。` : `「${incident.title}」看过了。` };
    }
    case 'startStoryline': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.retired || girl.dead) return { state, ok: false, message: '她已经不在名册上了。' };
      if (next.storylines.some(story => story.girlId === girl.id && story.status === 'active')) return { state, ok: false, message: `${girl.name}还有一条没走完的故事线。` };
      const finished = next.storylines.filter(story => story.girlId === girl.id && story.status === 'done');
      const slot = finished.length + 1;
      if (slot > STORY_SLOT_MAX) return { state, ok: false, message: `${girl.name}的三段故事都讲完了，剩下的日子该往前走了。` };
      if (girl.bond < 20) return { state, ok: false, message: `${girl.name}还没有到愿意讲过去的程度（羁绊 20）。` };
      const plan = girl.storyPlan;
      if (plan && !playableStoryPlan(plan)) return { state, ok: false, message: '这张蓝图还没有开始或结束节点，先补完再开场。' };
      if (plan) {
        const blockers = validateGraph(ensureGraph(plan)).filter(issue => issue.level === 'error');
        if (blockers.length) return { state, ok: false, message: `蓝图还有 ${blockers.length} 处要修：${blockers[0].message}` };
      }
      const storyline = plan
        ? planToStoryline(girl, plan, next.day, next.minutes)
        : buildTemplateStoryline(next, girl, action.direction);
      storyline.slot = slot;
      if (finished.length) storyline.requires = finished[finished.length - 1].id;
      next.storylines.unshift(storyline);
      if (storyline.graph) startStoryGraph(next, storyline);
      else spawnStoryBeat(next, storyline);
      next.logs.unshift({ id: `log-story-start-${storyline.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}的故事「${storyline.title}」开始了。` });
      archive(next, '关系', `${girl.name}的故事`, storyline.premise);
      return { state: next, ok: true, message: `「${storyline.title}」已开启，去详情页走第一幕。` };
    }
    case 'setStoryPlan': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!action.plan) {
        girl.storyPlan = undefined;
        return { state: next, ok: true, message: '已移除故事蓝图。' };
      }
      const plan = sanitizeStoryPlan(action.plan);
      if (!plan) return { state, ok: false, message: '剧本至少要有一幕，或者一张带开始与结束节点的蓝图。' };
      girl.storyPlan = plan;
      return {
        state: next, ok: true,
        message: plan.graph
          ? `「${plan.title}」的蓝图已保存到${girl.name}的卡片里（${plan.graph.nodes.length} 个节点）。`
          : `「${plan.title}」已保存到${girl.name}的卡片里。`,
      };
    }
    case 'addStoryline': {
      const next = clone(state); const incoming = action.storyline;
      const girl = findGirl(next, incoming.girlId);
      if (!girl) return { state, ok: false, message: '找不到这条故事线的主角。' };
      if (!incoming.beats?.length) return { state, ok: false, message: '故事线没有可用的一幕。' };
      next.storylines = next.storylines.filter(story => !(story.girlId === girl.id && story.status === 'active' && story.source === 'template'));
      next.storylines.unshift({ ...incoming, source: 'llm', status: 'active', stage: 0 });
      spawnStoryBeat(next, next.storylines[0]);
      next.logs.unshift({ id: `log-story-llm-${incoming.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `叙事者写完了「${incoming.title}」的 ${incoming.beats.length} 幕。` });
      return { state: next, ok: true, message: `故事线「${incoming.title}」已就位。` };
    }
    case 'decideStoryChoice': {
      const next = clone(state); const story = next.storylines.find(item => item.id === action.storylineId);
      if (!story || story.status !== 'active') return { state, ok: false, message: '这条故事线已经结束了。' };
      const beat = story.beats.find(item => item.id === action.beatId);
      if (!beat) return { state, ok: false, message: '找不到这一幕。' };
      if (beat.mission) return { state, ok: false, message: '这一幕要先完成她给出的委托。' };
      if (beat.resolvedChoiceId) return { state, ok: false, message: '这一幕已经做过了选择。' };
      const choice = beat.choices.find(item => item.id === action.choiceId);
      if (!choice) return { state, ok: false, message: '没有这个选项。' };
      const girl = findGirl(next, story.girlId);
      if (girl) applyStoryEffect(next, girl, choice.effect, `故事线「${story.title}」`);
      beat.resolvedChoiceId = choice.id;
      beat.resolvedAt = dateLabel(next.day, next.minutes);
      story.stage = Math.min(story.beats.length, story.stage + 1);
      if (story.stage >= story.beats.length && girl) {
        story.status = 'done';
        girl.bond = Math.min(100, girl.bond + 5);
        archive(next, '关系', `${story.title}（完）`, `${girl.name}的故事走到第四幕，选择由你做出。`);
      }
      next.logs.unshift({ id: `log-story-choice-${story.id}-${beat.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${story.title}」${beat.title}：${choice.label}。` });
      return { state: next, ok: true, message: story.status === 'done' ? '这条故事线已经走完。' : '选择已记下，继续下一幕。' };
    }
    case 'advanceStoryline': {
      const next = clone(state); const story = next.storylines.find(item => item.id === action.storylineId);
      if (!story || story.status !== 'active') return { state, ok: false, message: '这条故事线已经结束了。' };
      story.stage = Math.min(story.beats.length, story.stage + 1);
      if (story.stage >= story.beats.length) story.status = 'done';
      return { state: next, ok: true, message: '故事线向后推进了一幕。' };
    }
    case 'addCharacterEvent': {
      const next = clone(state); const incoming = action.event;
      const girl = findGirl(next, incoming.girlId);
      if (!girl) return { state, ok: false, message: '找不到事件的主角。' };
      if (next.events.some(event => event.id === incoming.id)) return { state, ok: false, message: '这个事件已经存在。' };
      next.events.unshift({ ...incoming, stage: 0, status: 'active', badge: true });
      girl.eventBadge = '新';
      next.logs.unshift({ id: `log-event-new-${incoming.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}有了一段新的私人事件：${incoming.title}。` });
      return { state: next, ok: true, message: `${girl.name}的头像上多了一个角标。` };
    }
    case 'startCharacterEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段事件。' };
      if (event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      event.status = 'active';
      event.stage = 0;
      const girl = findGirl(next, event.girlId);
      if (girl) girl.eventBadge = '!';
      return { state: next, ok: true, message: '事件开始。' };
    }
    case 'advanceEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      if (event.stage >= event.scenes.length - 1) {
        event.status = 'done'; event.badge = false;
        const girl = findGirl(next, event.girlId);
        if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 4); }
        archive(next, '关系', event.title, `${findGirl(next, event.girlId)?.name ?? '她'}的私人事件告一段落。`);
        finishStoryEvent(next, event);
        return { state: next, ok: true, message: '事件收束。' };
      }
      event.stage += 1;
      return { state: next, ok: true, message: '进入下一场。' };
    }
    case 'beginStoryEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      if (!action.passages.length) return { state, ok: false, message: '这段剧情还没有内容。' };
      event.mode = 'story';
      event.passages = action.passages;
      event.passageIndex = 0;
      event.chosen = [];
      event.summary = action.summary;
      event.pending = false;
      event.badge = false;
      return { state: next, ok: true, message: '剧情开幕。' };
    }
    case 'startStorySession': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段剧情。' };
      if (event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      const cast = (action.cast?.length ? action.cast : event.cast?.length ? event.cast : [event.girlId]).slice(0, 3);
      const opening = (action.opening ?? event.opening ?? event.hook ?? '').trim().slice(0, 600) || event.hook;
      event.mode = 'session';
      event.cast = cast;
      event.opening = opening;
      event.sessionDone = false;
      event.status = 'active';
      event.badge = false;
      event.turns = [{ id: `turn-${Date.now().toString(36)}`, role: 'narrator', text: opening, lines: action.lines ?? [], options: (action.options ?? []).slice(0, 3), at: Date.now() }];
      const girl = findGirl(next, event.girlId);
      if (girl) girl.eventBadge = '!';
      return { state: next, ok: true, message: '剧情开始。' };
    }
    case 'appendStoryTurn': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      if (event.mode !== 'session') return { state, ok: false, message: '这段剧情不是交互模式。' };
      const rounds = (event.turns ?? []).filter(turn => turn.role === 'player').length;
      if (rounds >= STORY_SESSION_TURNS) return { state, ok: false, message: `这段剧情已经走了 ${STORY_SESSION_TURNS} 轮，先结束事件吧。` };
      event.turns = [...(event.turns ?? []), action.turn];
      return { state: next, ok: true, message: '' };
    }
    case 'replaceStoryTurn': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      const index = (event.turns ?? []).findIndex(turn => turn.id === action.turnId);
      if (index < 0) return { state, ok: false, message: '找不到要重写的那一段。' };
      if (event.turns?.[index]?.role !== 'narrator') return { state, ok: false, message: '只能重写旁白那一段。' };
      const previous = event.turns[index];
      const turns = [...event.turns];
      turns[index] = { ...action.turn, id: previous.id, rewrites: (previous.rewrites ?? 0) + 1 };
      event.turns = turns;
      return { state: next, ok: true, message: '这一段已经重写。' };
    }
    case 'finishStorySession': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段剧情。' };
      if (event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      event.status = 'done'; event.badge = false; event.sessionDone = true;
      const girl = findGirl(next, event.girlId);
      const rounds = (event.turns ?? []).filter(turn => turn.role === 'player').length;
      const gain = Math.min(4, Math.max(0, Math.round(rounds * 0.8)));
      if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + gain); }
      next.logs.unshift({ id: `log-story-session-${event.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl?.name ?? '她'}的剧情「${event.title}」结束，走了 ${rounds} 轮${gain ? `，羁绊 +${gain}` : ''}。` });
      archive(next, '关系', event.title, `${girl?.name ?? '她'}的这段剧情收束了。`);
      finishStoryEvent(next, event);
      return { state: next, ok: true, message: gain ? `事件结束，羁绊 +${gain}。` : '事件结束。' };
    }
    case 'chooseStoryPort': {
      const next = clone(state);
      const story = next.storylines.find(item => item.id === action.storylineId && item.status === 'active');
      if (!story?.graph || !story.run) return { state, ok: false, message: '这条故事线没有可以选择的岔路。' };
      const node = story.graph.nodes.find(item => item.id === story.run?.waiting?.ref);
      if (!node || node.kind !== 'choice' || node.data.kind !== 'choice') return { state, ok: false, message: '现在没有在等你的选择。' };
      const edge = story.graph.edges.find(item => item.from === node.id && item.fromPort === action.port);
      const option = node.data.options.find(item => item.id === action.port);
      if (!edge || !option) return { state, ok: false, message: '这个选项走不通。' };
      const girl = findGirl(next, story.girlId);
      if (girl && option.effect) applyStoryEffect(next, girl, option.effect, '剧情「' + story.title + '」');
      story.run.waiting = undefined;
      story.run.cursor = edge.to;
      advanceStoryGraph(next, story);
      next.logs.unshift({ id: 'log-port-' + story.id + '-' + action.port, time: dateLabel(next.day, next.minutes), kind: 'story', text: '你选了：' + option.label.slice(0, 60) + '。' });
      return { state: next, ok: true, message: '剧情继续。' };
    }
    case 'chooseStoryPassage': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active' || event.mode !== 'story') return { state, ok: false, message: '这段剧情已经结束了。' };
      const index = event.passageIndex ?? 0;
      const passage = event.passages?.[index];
      const choice = passage?.choices.find(item => item.id === action.choiceId);
      if (!passage || !choice) return { state, ok: false, message: '这一段没有需要做出的选择。' };
      const girl = findGirl(next, event.girlId);
      if (girl && choice.effect) applyStoryEffect(next, girl, choice.effect, `剧情「${event.title}」`);
      event.chosen = [...(event.chosen ?? []), choice.id];
      next.logs.unshift({ id: `log-passage-${event.id}-${index}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${event.title}」：${choice.label}。` });
      const after = index + 1;
      if (after >= (event.passages?.length ?? 0)) {
        event.status = 'done';
        event.badge = false;
        if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 5); }
        archive(next, '关系', event.title, event.summary ?? `${girl?.name ?? '她'}的这段剧情收束了。`);
        finishStoryEvent(next, event);
        return { state: next, ok: true, message: '这段剧情收束了。' };
      }
      event.passageIndex = after;
      if (girl) girl.eventBadge = undefined;
      return { state: next, ok: true, message: '继续。' };
    }
    case 'resolveEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      const scene = event.scenes[event.stage];
      const choice = scene?.choices?.find(item => item.id === action.choiceId);
      if (!choice) return { state: next, ok: true, message: '这一幕没有需要做出的选择。' };
      const girl = findGirl(next, event.girlId);
      if (girl) applyStoryEffect(next, girl, choice.effect, `事件「${event.title}」`);
      event.status = 'done'; event.badge = false;
      if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 2); }
      next.logs.unshift({ id: `log-event-choice-${event.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${event.title}」：${choice.label}。` });
      finishStoryEvent(next, event);
      return { state: next, ok: true, message: '事件结束。' };
    }
    case 'setPoolLimit': {
      const next = clone(state);
      const value = Math.max(1, Math.min(40, Math.round(action.value)));
      next.poolLimits[action.pool] = value;
      return { state: next, ok: true, message: `${action.pool === 'missions' ? '事件池' : action.pool === 'monsters' ? '魔物池' : '市场池'}上限已设为 ${value}。` };
    }
    case 'deleteMission': {
      const target = state.missions.find(m => m.id === action.missionId);
      if (!target) return { state, ok: false, message: '没有找到这条事件。' };
      if (target.status === 'active') return { state, ok: false, message: '委托进行中，不能从事件池移除。' };
      if (target.storylineId) return { state, ok: false, message: '故事委托会跟着剧情走，不能从池里删掉。' };
      const next = clone(state);
      next.missions = next.missions.filter(m => m.id !== action.missionId);
      next.logs.unshift({ id: `log-pool-${action.missionId}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `从事件池移除了「${target.title}」。` });
      return { state: next, ok: true, message: '事件已从池中移除。' };
    }
    case 'deleteCandidate': {
      const target = state.candidates.find(g => g.id === action.girlId);
      if (!target) return { state, ok: false, message: '没有找到这位候选者。' };
      const next = clone(state);
      next.candidates = next.candidates.filter(g => g.id !== action.girlId);
      normalizeMarketWindow(next);
      return { state: next, ok: true, message: `${target.name} 的候选档案已移除。` };
    }
    case 'deleteMonster': {
      const target = monsters.find(m => m.id === action.monsterId);
      if (!target) return { state, ok: false, message: '没有找到这只魔物。' };
      if ((state.removedMonsters ?? []).includes(action.monsterId)) return { state, ok: false, message: '这只魔物已经离开魔物池。' };
      const next = clone(state);
      next.removedMonsters = [...(next.removedMonsters ?? []), action.monsterId];
      next.customMonsters = (next.customMonsters ?? []).filter(m => m.id !== action.monsterId);
      const affected = next.missions.filter(m => m.enemyIds?.includes(action.monsterId));
      next.missions = next.missions.filter(m => !m.enemyIds?.includes(action.monsterId) || m.status === 'active');
      for (const m of affected) if (m.status !== 'active') next.logs.unshift({ id: `log-pool-${m.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'battle', text: `「${m.title}」因魔物被移出池而消散。` });
      return { state: next, ok: true, message: `${target.name} 已从魔物池移除。` };
    }
    case 'addGeneratedContent': {
      const gate = canAcceptGeneratedContent(state);
      if (!gate.ok) return { state, ok: false, message: gate.message };
      if (state.missions.some(m => m.id === action.mission.id) || missionKeyTaken(state, action.mission)) return { state, ok: false, message: '生成内容与现有委托重复。' };
      if (action.girl && state.candidates.some(g => g.id === action.girl!.id)) return { state, ok: false, message: '生成内容与现有条目重复。' };
      if (action.envoyMission && (state.missions.some(m => m.id === action.envoyMission!.id) || missionKeyTaken(state, action.envoyMission))) return { state, ok: false, message: '使者委托与现有事件重复。' };
      if (action.items?.length && action.items.some(item => state.generatedItems.some(existing => existing.id === item.id))) return { state, ok: false, message: '生成装备与现有条目重复。' };
      const next = clone(state);
      const annotate = (m: Mission): Mission => annotateMission(next, m);
      if (action.girl) next.candidates.push(action.girl);
      next.missions.push(annotate({ ...action.mission, generated: true, sourcePack: 'llm' }));
      if (action.envoyMission) {
        next.missions.push(annotate({ ...action.envoyMission, generated: true, sourcePack: 'llm' }));
        if (action.envoyMission.faction) next.factions[action.envoyMission.faction].envoyTaskId = action.envoyMission.id;
      }
      trimMissionPools(next);
      if (action.items?.length) {
        const fresh = action.items.filter(item => validGeneratedItem(item) && !next.generatedItems.some(existing => existing.id === item.id)).slice(0, 2);
        for (const item of fresh) registerItem(item);
        next.generatedItems.push(...fresh);
      }
      const opinions = action.opinions?.length ? action.opinions : action.opinion ? [action.opinion] : [];
      if (opinions.length) {
        next.opinions = [...opinions, ...next.opinions];
        trimOpinions(next);
      }
      if (action.girl) archive(next, '少女', action.girl.name, `${action.girl.title} · ${action.girl.element} · ${action.girl.archetype}`);
      archive(next, '事件', action.mission.title, action.mission.description);
      for (const opinion of opinions) archive(next, '议程', opinion.title, opinion.text);
      if (action.envoyMission) archive(next, '代表', action.envoyMission.title, action.envoyMission.description);
      for (const item of (action.items ?? []).slice(0, 2)) archive(next, '登记', item.name, item.description);
      next.logs.unshift({ id: `log-gen-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `叙事者提交了新的夜班提案：「${action.mission.title}」。${opinions.length ? `会客厅多了 ${opinions.length} 份议题` : ''}${action.items?.length ? `${opinions.length ? '，' : ''}仓库登记了 ${action.items.length} 件新装备` : ''}。` });
      return { state: next, ok: true, message: `新的委托已出现在地图上${opinions.length ? `，会客厅收到 ${opinions.length} 份议题` : ''}。候选者改由契约卡库补充。` };
    }
    case 'saveBattleNote': {
      const note = action.note;
      if (!validBattleNote(note)) return { state, ok: false, message: '这份战斗札记不完整，无法保存。' };
      if (!state.battles.some(battle => battle.id === note.battleId)) return { state, ok: false, message: '找不到对应的战斗记录。' };
      const next = clone(state);
      next.battleNotes = [note, ...(next.battleNotes ?? []).filter(item => item.battleId !== note.battleId)].slice(0, 20);
      return { state: next, ok: true, message: `已保存「${note.title}」。` };
    }
    case 'deleteBattleNote': {
      const next = clone(state);
      const before = (next.battleNotes ?? []).length;
      next.battleNotes = (next.battleNotes ?? []).filter(item => item.battleId !== action.battleId);
      return before === next.battleNotes.length
        ? { state, ok: false, message: '这场战斗还没有札记。' }
        : { state: next, ok: true, message: '已删除这场战斗的札记。' };
    }
    default: return { state, ok: false, message: '未知操作。' };
  }
}

/** 生成前的池容量预检，避免自动补充先花掉 API 请求再被拒。 */
