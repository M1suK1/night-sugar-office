import { loadBalance } from '../balance.ts';
import { FACTION_PURIFICATION, rosterLeader, rosterMembers } from '../factions.ts';
import { hostilityOf } from '../hostility.ts';
import { clone, dateLabel } from './core.ts';
import type { ActionResult, CharacterEvent, FactionId, GameState } from '../types.ts';

/** 冷却记在 `incidentCooldowns` 里，和一般事件共用一套账。 */
export const SUMMON_TEMPLATE = 'summon-leader';
export const SUMMON_FACTIONS = Object.keys(FACTION_PURIFICATION) as FactionId[];

/**
 * 今天有没有人来召见：概率按日号离散滚动，同一份存档同一天的结果固定，
 * 反复读档不会重掷；冷却按模板 id 记，跨天生效。
 */
export function summonRollsToday(state: GameState, chance: number, cooldownDays: number): boolean {
  if (chance <= 0) return false;
  const roll = (state.day * 37 + 11) % 100;
  if (roll >= chance) return false;
  const last = state.incidentCooldowns?.[SUMMON_TEMPLATE];
  if (typeof last === 'number' && state.day - last < cooldownDays) return false;
  return true;
}
/** 今天轮到来的是哪一方：按日号轮转，三方都不会被冷落太久。 */
export function summonFactionToday(day: number): FactionId {
  const size = SUMMON_FACTIONS.length;
  return SUMMON_FACTIONS[((day % size) + size) % size] ?? SUMMON_FACTIONS[0]!;
}

/** 对立势力到场的火气门槛（v123）：到 50，对方才会派一个人过来盯着。 */
export const RIVAL_HOSTILITY_FLOOR = 50;

/**
 * 势力场面里的出场阵容：首领 + 一位随从，火气到门槛时再叫上对立势力的一位。
 *
 * v123：以前只有首领一个人站在那儿，随从明明在名册里却从不出现；
 * 提示词里也没有谁在场，模型就自己编几个人（或者干脆写成独白）。
 * cast 同时是说话人白名单与舞台的立绘来源，所以必须在这里定下来。
 */
export function factionSceneCast(state: GameState, faction: FactionId): string[] {
  const cast: string[] = [];
  const leader = rosterLeader(state, faction);
  if (leader && !leader.vacant) cast.push(leader.id);
  const mate = rosterMembers(state, faction).find(person => !cast.includes(person.id));
  if (mate) cast.push(mate.id);
  const hottest = hostilityOf(state, faction)[0];
  if (hottest && hottest.track.value >= RIVAL_HOSTILITY_FLOOR) {
    const rivalLeader = rosterLeader(state, hottest.other);
    if (rivalLeader && !rivalLeader.vacant && !cast.includes(rivalLeader.id)) cast.push(rivalLeader.id);
    else {
      const rivalMate = rosterMembers(state, hottest.other).find(person => !cast.includes(person.id));
      if (rivalMate) cast.push(rivalMate.id);
    }
  }
  return cast;
}
/**
 * 召见这件事本身：一个出场首领与一位随从的交互事件。
 *
 * v160：首领必须取自当前编成（`rosterLeader`），不能用静态占位；
 * 席位空缺时返回 undefined，不制造「席位空缺的传唤」。
 */
export function buildSummonEvent(state: GameState, faction: FactionId): CharacterEvent | undefined {
  const leader = rosterLeader(state, faction);
  if (!leader || leader.vacant) return undefined;
  return {
    id: `summon-${state.day}-${faction}`,
    girlId: leader.id,
    title: `${leader.name}的传唤`,
    hook: `${leader.name}的人把一张只写了时间的纸条压在柜台上：「今晚请所长过来一趟。」`,
    scenes: [],
    mode: 'session',
    cast: factionSceneCast(state, faction),
    // v169：这两句引子只给界面看，不进提示词 —— 约谈要以玩家先开口为起点。
    hookInPrompt: false,
    stage: 1,
    status: 'active',
    day: state.day,
    minutes: state.minutes,
    source: 'template',
    badge: true,
  };
}

/**
 * 打烊后的召见判定：掷中就塞一个事件进列表并记冷却。
 * 返回被召见的那一方（没触发就是 undefined），方便外面写一条日志。
 */
export function maybeSummon(state: GameState): { faction: FactionId; leaderName: string } | undefined {
  const rules = loadBalance();
  if (!summonRollsToday(state, rules.leaderSummonChance, rules.leaderSummonCooldownDays)) return undefined;
  const faction = summonFactionToday(state.day);
  const event = buildSummonEvent(state, faction);
  if (!event) return undefined;
  if (state.events.some(entry => entry.id === event.id)) return undefined;
  state.events.unshift(event);
  state.incidentCooldowns = { ...state.incidentCooldowns, [SUMMON_TEMPLATE]: state.day };
  state.logs.unshift({
    id: `log-summon-${event.id}`,
    time: dateLabel(state.day, state.minutes), kind: 'incident',
    text: `${rosterLeader(state, faction).name}传话过来：请所长今夜过去一趟。`,
  });
  return { faction, leaderName: rosterLeader(state, faction).name };
}

/** 主动约见的事件 id：一天一方一次，用来去重与直接打开。 */
export function meetEventId(state: GameState, faction: FactionId): string {
  return `meet-${state.day}-${faction}`;
}

export function buildMeetEvent(state: GameState, faction: FactionId, leaderName: string, leaderId: string): CharacterEvent {
  return {
    id: meetEventId(state, faction),
    girlId: leaderId,
    title: `登门拜访${leaderName}`,
    hook: `你让人递了帖子。${leaderName}回话：「今晚门不锁，来的时候别带公务。」`,
    scenes: [],
    mode: 'session',
    cast: factionSceneCast(state, faction),
    // v169：这两句引子只给界面看，不进提示词 —— 约谈要以玩家先开口为起点。
    hookInPrompt: false,
    stage: 1,
    status: 'active',
    day: state.day,
    minutes: state.minutes,
    source: 'template',
    badge: true,
  };
}

/** 主动约见：势力档案里的按钮走这条；一天一方只建一次事件。 */
export function applyMeetLeader(state: GameState, action: { faction: FactionId }): ActionResult {
  const next = clone(state);
  const leader = rosterLeader(next, action.faction);
  if (!leader || leader.vacant) return { state, ok: false, message: '这一方还没有首领，先去编成里从卡库补人。' };
  const id = meetEventId(next, action.faction);
  if (next.events.some(event => event.id === id)) {
    return { state, ok: true, message: `今天已经见过${leader.name}了。` };
  }
  next.events.unshift(buildMeetEvent(next, action.faction, leader.name, leader.id));
  next.logs.unshift({
    id: `log-meet-${id}`,
    time: dateLabel(next.day, next.minutes), kind: 'incident',
    text: `你主动约见了${leader.name}。`,
  });
  return { state: next, ok: true, message: `${leader.name}答应今晚见你。` };
}
