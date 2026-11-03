import { loadBalance } from '../balance.ts';
import { FACTION_PURIFICATION, factionLeader } from '../factions.ts';
import { dateLabel } from './core.ts';
import type { CharacterEvent, FactionId, GameState } from '../types.ts';

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

/** 召见这件事本身：一个只出场首领的交互事件。 */
export function buildSummonEvent(state: GameState, faction: FactionId): CharacterEvent {
  const leader = factionLeader(faction);
  return {
    id: `summon-${state.day}-${faction}`,
    girlId: leader.id,
    title: `${leader.name}的传唤`,
    hook: `${leader.name}的人把一张只写了时间的纸条压在柜台上：「今晚请所长过来一趟。」`,
    scenes: [],
    mode: 'session',
    cast: [leader.id],
    stage: 1,
    status: 'active',
    day: state.day,
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
  if (state.events.some(entry => entry.id === event.id)) return undefined;
  state.events.unshift(event);
  state.incidentCooldowns = { ...state.incidentCooldowns, [SUMMON_TEMPLATE]: state.day };
  state.logs.unshift({
    id: `log-summon-${event.id}`,
    time: dateLabel(state.day, state.minutes), kind: 'incident',
    text: `${factionLeader(faction).name}传话过来：请所长今夜过去一趟。`,
  });
  return { faction, leaderName: factionLeader(faction).name };
}
