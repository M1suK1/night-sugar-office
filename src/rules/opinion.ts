import { CONTRACT_DAYS } from '../contracts.ts';
import type { DistrictId } from '../districts.ts';
import { effectiveMaxHp } from '../economy.ts';
import { settleTruce, startWar } from '../fronts.ts';
import { clampHostility, pairLabel } from '../hostility.ts';
import { defaultOpinionDialogue, defaultOpinionOptions, opinionOptionTags } from '../opinions.ts';
import type { FactionId, GameState, Girl, Opinion, OpinionOption } from '../types.ts';
import { makeCandidate } from './candidate.ts';
import { book, dateLabel, findGirl, hashText, shiftTerritory } from './core.ts';
import { deployMissionTemplate } from './missions.ts';
import { capacity, seatsTaken } from './roster.ts';
// v35 从 src/game.ts 拆出：议题生成与决议结算。

/** 每天能摆到议事桌上的议题上限：会客厅 2 级 3 条，3 级 4 条，4 级 5 条。 */
export function opinionLimit(state: GameState): number {
  const lounge = state.rooms.find(room => room.type === 'lounge');
  return Math.max(3, Math.min(5, 1 + (lounge?.level ?? 2)));
}
/** 超出上限的待议不删除，标为 shelved 留在档案里；不再回到议事桌。 */

/** 超出上限的待议不删除，标为 shelved 留在档案里；不再回到议事桌。 */
export function trimOpinions(state: GameState): number {
  const limit = opinionLimit(state);
  const pending = state.opinions.filter(opinion => opinion.status === 'pending');
  if (pending.length <= limit) return 0;
  const keep = new Set(pending.slice(0, limit).map(opinion => opinion.id));
  let shelved = 0;
  for (const opinion of pending) {
    if (keep.has(opinion.id)) continue;
    opinion.status = 'shelved';
    shelved += 1;
    state.logs.unshift({ id: `log-op-shelved-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'council', text: `议题「${opinion.title}」超出今晚的处理上限，已转入档案，等待以后重提。` });
  }
  return shelved;
}

export function makeOpinion(state: GameState, author: Girl, topic: Opinion['topic'], title: string, text: string, request: string, context: { faction?: FactionId; district?: DistrictId } = {}): Opinion {
  const district = context.district ?? (topic === '城市' ? 'candy' : undefined);
  const faction = context.faction ?? (district ? state.territories[district] : undefined);
  return {
    id: `op-${state.day}-${hashText(author.id + title + state.minutes)}`, day: state.day, authorId: author.id, topic,
    title, text, request, status: 'pending', faction,
    options: defaultOpinionOptions(topic, { authorId: author.id, authorName: author.name, faction, district }),
    dialogue: defaultOpinionDialogue(topic, { authorId: author.id, authorName: author.name, faction, district, request }),
    assistantNote: state.assistantId === author.id ? `${author.name}亲自提交，附了一份写得很短的预算。` : undefined,
  };
}
/**
 * 生成一条议题；`variant` 让同一个时段也能补出不同的议题（首夜连补三条时用）。
 * 返回是否真的加了一条：同一个议题标题还挂在待议里就不再重复提。
 */

export function applyOpinionChanges(state: GameState, opinion: Opinion, option: OpinionOption): { gold: number; tags: string[] } {
  let gold = 0;
  for (const change of option.changes ?? []) {
    if (change.kind === 'gold') {
      state.gold = Math.max(0, state.gold + change.amount);
      gold += change.amount;
      if (change.amount !== 0) book(state, state.day, change.amount);
    } else if (change.kind === 'reputation') {
      state.reputation = Math.max(0, Math.min(100, state.reputation + change.amount));
    } else if (change.kind === 'faction') {
      const target = state.factions[change.faction];
      if (target) target.standing = Math.max(0, Math.min(100, target.standing + change.amount));
    } else if (change.kind === 'item') {
      state.inventory[change.itemId] = Math.max(0, (state.inventory[change.itemId] ?? 0) + change.amount);
    } else if (change.kind === 'hostility') {
      const track = state.hostility?.[change.pair];
      if (track) {
        const nextValue = clampHostility(track.value + change.amount);
        state.hostility[change.pair] = { ...track, value: nextValue, updatedDay: state.day };
        state.logs.unshift({ id: `log-op-hostility-${opinion.id}-${change.pair}`, time: dateLabel(state.day, state.minutes), kind: 'territory', text: `${pairLabel(change.pair)}的敌意 ${track.value} → ${nextValue}（议会决议「${opinion.title}」）。` });
      }
    } else if (change.kind === 'girl') {
      const girl = findGirl(state, change.girlId);
      if (girl) {
        if (change.field === 'bond') girl.bond = Math.max(0, Math.min(100, girl.bond + change.amount));
        if (change.field === 'fatigue') girl.fatigue = Math.max(0, Math.min(100, girl.fatigue + change.amount));
        if (change.field === 'corruption') girl.corruption = Math.max(0, Math.min(100, girl.corruption + change.amount));
        if (change.field === 'hp') girl.hp = Math.max(0, Math.min(effectiveMaxHp(girl), girl.hp + change.amount));
      }
    }
  }
  for (const outcome of option.outcomes ?? []) {
    if (outcome.kind === 'territory') {
      shiftTerritory(state, outcome.district, outcome.faction, `议会决议「${opinion.title}」`);
    } else if (outcome.kind === 'mission') {
      const mission = deployMissionTemplate(state, outcome.template);
      state.missions.push(mission);
      state.logs.unshift({ id: `log-op-mission-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'dispatch', text: `议会决议追加了特殊委托「${mission.title}」。` });
    } else if (outcome.kind === 'join') {
      const level = Math.max(1, Math.min(12, Math.round(outcome.level)));
      let candidate: Girl | undefined;
      for (let attempt = 0; attempt < 24 && !candidate; attempt++) {
        const next = makeCandidate(state, level, hashText(`${opinion.id}:join`) + attempt * 7919);
        if (!state.girls.some(girl => girl.id === next.id) && !state.candidates.some(girl => girl.id === next.id)) candidate = next;
      }
      if (candidate) {
        if (seatsTaken(state) < capacity(state)) {
          state.girls.push({ ...candidate, cost: 0, status: 'idle', roomId: 'lounge', remaining: 0, contractEndDay: state.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, retired: false, retiredReason: undefined, candidateUntilDay: undefined });
          state.logs.unshift({ id: `log-op-join-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `议会带来了新的契约者「${candidate.name}」，没有收取签约金。` });
        } else {
          state.candidates.push({ ...candidate, cost: 0, custom: true, candidateUntilDay: state.day + 7 });
          state.logs.unshift({ id: `log-op-join-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `宿舍已满，新的契约者「${candidate.name}」留在候选名册，签约金为 0。` });
        }
      }
    } else if (outcome.kind === 'truce') {
      settleTruce(state, outcome.pair, outcome.days, `议会决议「${opinion.title}」`);
    } else if (outcome.kind === 'war') {
      const track = state.hostility?.[outcome.pair];
      if (track) state.hostility[outcome.pair] = { ...track, value: 100, updatedDay: state.day, reason: `议会拒绝「${opinion.title}」，谈崩了` };
      startWar(state, outcome.pair, { day: state.day, minutes: state.minutes }, `议会驳回「${opinion.title}」，${pairLabel(outcome.pair)}当场开战。`);
    } else if (outcome.kind === 'leave') {
      const girl = findGirl(state, outcome.girlId);
      if (girl) {
        girl.retired = true; girl.retiredReason = 'contract'; girl.status = 'retired'; girl.remaining = 0;
        state.logs.unshift({ id: `log-op-leave-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'council', text: `议会决议结束了与「${girl.name}」的契约，她离开了值夜名册。` });
      }
    }
  }
  if (option.shift && !(option.outcomes ?? []).some(outcome => outcome.kind === 'territory')) shiftTerritory(state, option.shift.district, option.shift.faction, `议会决议「${opinion.title}」`);
  return { gold, tags: opinionOptionTags(option, state) };
}
