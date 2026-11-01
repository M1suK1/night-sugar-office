/**
 * 开局编成的可选池。
 *
 * 三方名册以前只认静态内容里的 3 位首领 + 9 位随从；现在玩家自己带来的少女
 * （契约卡库里的卡、名册里、候选池里）也可以坐进这些位置。这里只负责把不同来源
 * 的数据折成同一种 `RosterSubject`，校验与快照仍在 `game.ts` 的 `setStarters`。
 */
import type { FactionId, FactionRoster, GameState, Girl } from './types.ts';
import type { CardBoxEntry } from './cardbox.ts';
import { parseGirlCard } from './cards.ts';
import { factionGirls } from './content/factionGirls.ts';
import { factionLeaders } from './content/factionLeaders.ts';
import { customRosterOf, subjectOfCustom, subjectOfGirl, subjectOfLeader, type RosterSubject } from './factions.ts';
import { FACTION_ORDER } from './territories.ts';
import { usedCardIds } from './cardMarket.ts';

/** 契约卡库里的卡 → 面板条目；卡已经存了全量数据，解析失败就当没有这张。 */
export function cardSubject(entry: CardBoxEntry): RosterSubject | undefined {
  const parsed = parseGirlCard(entry.raw);
  if (!parsed.ok) return undefined;
  const girl = parsed.card.girl;
  return subjectOfCustom({
    id: `card-${entry.hash}`,
    name: girl.name,
    factionTag: girl.factionTag ?? 'none',
    level: girl.level,
    color: girl.color,
    portrait: girl.portrait ?? '',
    portraitSpec: girl.portraitSpec,
    stats: girl.stats,
    skillIds: girl.skillIds,
    codename: girl.codename,
    quote: girl.quote,
    title: girl.title,
    cardId: entry.hash,
  });
}

function girlSubject(girl: Girl): RosterSubject {
  return subjectOfCustom({
    id: girl.id,
    name: girl.name,
    factionTag: girl.factionTag,
    level: girl.level,
    color: girl.color,
    portrait: girl.portrait,
    portraitSpec: girl.portraitSpec,
    stats: { ...girl.stats },
    skillIds: [...girl.skills],
    codename: girl.codename,
    quote: girl.quote,
    title: girl.title,
    cardId: girl.cardId,
  });
}

/**
 * 可编进势力的全部人。
 *
 * v27 起卡库是唯一的人事来源：`cardsOnly` 为真时（卡库够 20 张）只给卡与自定义，
 * 内置三位首领与九位随从完全不出现；不足 20 张时才把它们补在后面。
 * `limit` 是选人池上限（= `OPENING_CARDS`），保证池子不会被卡片撑爆。
 */
export interface RosterPoolOptions {
  /** 卡库够 20 张：不掺内置角色。 */
  cardsOnly?: boolean;
  /** 池子上限，0 表示不截。 */
  limit?: number;
}

export function rosterPool(state: GameState, library: CardBoxEntry[] = [], options: RosterPoolOptions = {}): RosterSubject[] {
  const limit = Math.max(0, options.limit ?? 0);
  const list: RosterSubject[] = [];
  const seen = new Set<string>();
  const push = (subject: RosterSubject) => {
    if (seen.has(subject.id)) return;
    if (limit > 0 && list.length >= limit) return;
    seen.add(subject.id);
    list.push(subject);
  };
  // 已经在局里的自定义少女（含开局导进来的卡）排最前，然后是卡库里还没导入的卡。
  for (const girl of [...state.girls, ...state.candidates]) {
    if (!girl.custom) continue;
    if (girl.dead || girl.retired) continue;
    push(girlSubject(girl));
  }
  const used = usedCardIds(state);
  for (const entry of library) {
    if (used.has(entry.hash)) continue;
    const subject = cardSubject(entry);
    if (subject) push(subject);
  }
  for (const subject of customRosterOf(state)) push(subject);
  if (!options.cardsOnly) {
    for (const faction of FACTION_ORDER) push(subjectOfLeader(factionLeaders[faction]));
    for (const girl of factionGirls) push(subjectOfGirl(girl));
  }
  return list;
}

/** 卡库够 20 张时编成界面不显示内置角色。 */
export const STARTER_DEFAULT = ['yue', 'tang', 'ling', 'wu'];

/** 开局默认勾选：卡库前 6 张；卡不够 20 张时再用默认四人补到至少四位。 */
export function starterPicks(state: GameState, cardsOnly: boolean): string[] {
  const cards = [...state.girls, ...state.candidates]
    .filter(girl => Boolean(girl.cardId) && !girl.dead && !girl.retired)
    .map(girl => girl.id);
  const picked = [...new Set(cards)].slice(0, 6);
  if (cardsOnly) return picked;
  const defaults = STARTER_DEFAULT.filter(id => state.girls.some(girl => girl.id === id && !girl.dead));
  const fallback = defaults.length ? defaults : state.girls.filter(girl => !girl.dead && !girl.retired).map(girl => girl.id).slice(0, 4);
  return [...new Set([...picked, ...fallback])].slice(0, 6);
}

/** 面板条目现在坐在哪：`{ faction, role }`；没编进名册就是空。 */
export function rosterSeatOf(state: GameState, id: string): { faction: FactionId; role: 'leader' | 'member' } | undefined {
  for (const faction of FACTION_ORDER) {
    const saved = state.factionRoster?.[faction];
    if (!saved) continue;
    if (saved.leaderId === id) return { faction, role: 'leader' };
    if (saved.memberIds.includes(id)) return { faction, role: 'member' };
  }
  return undefined;
}

/**
 * 卡够 20 张时，用卡把三方先坐满：3 位首领 + 剩下的人轮流当随从。
 * 默认阵容里的内置首领与随从在 cardsOnly 下已经不在池子里，不能再拿来预填。
 */
export function cardFactionRoster(pool: RosterSubject[], taken: string[] = []): Record<FactionId, FactionRoster> | null {
  const free = pool.filter(subject => !taken.includes(subject.id));
  if (free.length < 6) return null;
  const roster = {} as Record<FactionId, FactionRoster>;
  const leaders = free.slice(0, 3);
  const rest = free.slice(3);
  FACTION_ORDER.forEach((faction, index) => { roster[faction] = { leaderId: leaders[index]!.id, memberIds: [] }; });
  // 只坐最低限度的 1 位随从，剩下的卡留在市场里等雇佣。
  rest.slice(0, FACTION_ORDER.length).forEach((subject, index) => {
    roster[FACTION_ORDER[index]!].memberIds.push(subject.id);
  });
  return roster;
}
