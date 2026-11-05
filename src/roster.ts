/**
 * 开局编成的可选池。
 *
 * 三方名册以前只认静态内容里的 3 位首领 + 9 位随从；现在玩家自己带来的少女
 * （契约卡库里的卡、名册里、候选池里）也可以坐进这些位置。这里只负责把不同来源
 * 的数据折成同一种 `RosterSubject`，校验与快照仍在 `game.ts` 的 `setStarters`。
 */
import type { FactionGirl, FactionId, FactionLeader, FactionRoster, GameState, Girl, GirlCard } from './types.ts';
import type { CardBoxEntry } from './cardbox.ts';
import { factionGirls } from './content/factionGirls.ts';
import { factionLeaders } from './content/factionLeaders.ts';
import { customGirlOf, customLeaderOf, customRosterOf, subjectOfCustom, subjectOfGirl, subjectOfLeader, type RosterSubject } from './factions.ts';
import { FACTION_ORDER } from './territories.ts';
import { usedCardIds } from './cardMarket.ts';

/**
 * 契约卡库里的卡 → 面板条目。
 *
 * v36 起卡库索引里就带着名字、等级、属性、出身等元数据，所以这里**不再解析卡面原文**：
 * 60 张带立绘的卡逐个 `JSON.parse` 就是开局 OOM 的来源。立绘留空，`GirlPortrait`
 * 会退回程序化剪影；真正被编进名册的那几张会在 `importCards` 时按 hash 单独读原文。
 */
export function cardSubject(entry: CardBoxEntry): RosterSubject {
  return subjectOfCustom({
    id: `card-${entry.hash}`,
    name: entry.name,
    factionTag: entry.factionTag,
    level: entry.level,
    color: entry.color,
    portrait: '',
    portraitSpec: entry.portraitSpec,
    stats: { ...entry.stats },
    skillIds: [...entry.skillIds],
    codename: entry.codename,
    quote: entry.quote,
    title: entry.title,
    cardId: entry.hash,
  });
}

function girlSubject(girl: Girl): RosterSubject {
  return subjectOfCustom({
    id: girl.id,
    name: girl.name,
    factionTag: girl.factionTag ?? 'association',
    level: girl.level,
    color: girl.color,
    portrait: girl.portrait,
    portraitSpec: girl.portraitSpec,
    stats: { ...girl.stats },
    skillIds: [...girl.skills],
    wardrobe: girl.wardrobe, outfitId: girl.outfitId, expression: girl.expression,
    codename: girl.codename,
    quote: girl.quote,
    title: girl.title,
    cardId: girl.cardId,
    // v85：卡上的魔女化立绘跟着人走，编进势力时才能真的用上。
    witch: girl.witch || undefined,
    witchForm: girl.witchForm,
  });
}

/**
 * 可编进势力的全部人。
 *
 * v27 起卡库是唯一的人事来源：`cardsOnly` 为真时（卡库够 TOP 张）只给卡与自定义，
 * 内置三位首领与九位随从完全不出现；不足 20 张时才把它们补在后面。
 * `limit` 是选人池上限（= `OPENING_CARDS`），保证池子不会被卡片撑爆。
 */
export interface RosterPoolOptions {
  /** 卡库够 TOP 张：不掺内置角色。 */
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
    push(cardSubject(entry));
  }
  for (const subject of customRosterOf(state)) push(subject);
  if (!options.cardsOnly) {
    // v85：静态名册废掉之后这里只剩空缺占位，不该出现在池子里。
    for (const faction of FACTION_ORDER) {
      const leader = factionLeaders[faction];
      if (!leader.vacant) push(subjectOfLeader(leader));
    }
    for (const girl of factionGirls) push(subjectOfGirl(girl));
  }
  return list;
}

/** 卡库够 TOP 张时编成界面不显示内置角色。 */
export const STARTER_DEFAULT = ['yue', 'tang', 'ling', 'wu'];

/** 开局默认勾进事务所的契约少女数：先 2 位，三方名册再各补首领与随从。 */
export const STARTER_COUNT = 2;

/** 开局默认勾选：卡库前 2 张；卡不够 TOP 张时再用默认角色补到 2 位。 */
export function starterPicks(state: GameState, cardsOnly: boolean): string[] {
  const cards = [...state.girls, ...state.candidates]
    .filter(girl => Boolean(girl.cardId) && !girl.dead && !girl.retired)
    .map(girl => girl.id);
  const picked = [...new Set(cards)].slice(0, STARTER_COUNT);
  if (cardsOnly) return picked;
  const defaults = STARTER_DEFAULT.filter(id => state.girls.some(girl => girl.id === id && !girl.dead));
  const fallback = defaults.length ? defaults : state.girls.filter(girl => !girl.dead && !girl.retired).map(girl => girl.id).slice(0, 4);
  return [...new Set([...picked, ...fallback])].slice(0, STARTER_COUNT);
}

/** Fisher-Yates；`random` 可注入，测试里才好复现。 */
export function shuffleWith<T>(items: T[], random: () => number = Math.random): T[] {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [list[index], list[target]] = [list[target]!, list[index]!];
  }
  return list;
}

export interface StarterAssignment {
  picked: string[];
  roster: Record<FactionId, FactionRoster>;
}

/**
 * 开局随机分配：名册挑几位、三方各坐一位首领与一位随从。
 *
 * 只在池子里有足够的人（≥6）时才接手；否则返回 `null`，让调用方退回默认分配。
 * 三名首领优先取同势力的人，凑不齐再退到任意人——避免月蚀庭的首领是星灯协会的人这种出戏。
 */
export function randomStarterAssignment(
  pool: RosterSubject[],
  options: { count?: number; random?: () => number; pickable?: Set<string> } = {},
): StarterAssignment | null {
  const random = options.random ?? Math.random;
  const count = Math.max(1, options.count ?? STARTER_COUNT);
  const ids = shuffleWith([...new Set(pool.map(subject => subject.id))], random);
  if (ids.length < 6) return null;
  // v85：事务所名额只能给真实存在的人（名册/候选）。卡库里还没导入的条目只有
  // `card-<hash>` 这种临时 id，坐进事务所会让 setStarters 校验不过。
  const eligible = options.pickable ? ids.filter(id => options.pickable!.has(id)) : ids;
  const picked = eligible.slice(0, Math.min(count, 6));
  const rest = ids.filter(id => !picked.includes(id));
  const byId = new Map(pool.map(subject => [subject.id, subject]));

  const roster = {} as Record<FactionId, FactionRoster>;
  const taken = new Set<string>();
  const leaders: string[] = [];
  for (const faction of FACTION_ORDER) {
    const preferred = rest.find(id => !taken.has(id) && byId.get(id)?.faction === faction);
    const leaderId = preferred ?? rest.find(id => !taken.has(id)) ?? '';
    if (leaderId) { taken.add(leaderId); leaders.push(leaderId); }
    roster[faction] = { leaderId, memberIds: [] };
  }
  for (const faction of FACTION_ORDER) {
    const memberId = rest.find(id => !taken.has(id));
    if (!memberId) break;
    taken.add(memberId);
    roster[faction].memberIds = [memberId];
  }
  return { picked, roster };
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
 * 卡够 TOP 张时，用卡把三方先坐满：3 位首领 + 剩下的人轮流当随从。
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

/**
 * 卡 → 编成池条目（v85 批三）。
 *
 * 与 `cardSubject` 不同：这里手上已经有解析好的卡了，所以立绘、魔女化立绘、出身都跟着走，
 * 直接拿去坐三方名册的位置。
 */
export function subjectFromCard(card: GirlCard, id: string): RosterSubject {
  const girl = card.girl;
  return subjectOfCustom({
    id,
    name: girl.name,
    factionTag: girl.factionTag ?? 'association',
    level: girl.level,
    color: girl.color,
    portrait: girl.portrait ?? '',
    portraitSpec: girl.portraitSpec,
    stats: { ...girl.stats },
    skillIds: [...girl.skillIds],
    codename: girl.codename,
    quote: girl.quote,
    title: girl.title,
    wardrobe: girl.wardrobe, outfitId: girl.outfitId, expression: girl.expression,
    witchForm: girl.witchForm ? { ...girl.witchForm, id: 'witchform', form: 'witch' } : undefined,
  });
}

/**
 * 开局：三方首领与随从全部从卡库随机取（v83 待定 1 的决定）。
 *
 * 卡不够 6 张时返回 null，调用方退回内置名册。首领与随从的等级仍按名册口径压
 * （首领 10 级、随从 8–9 级），立绘与魔女化立绘原样带过去。
 */
export function factionSnapshotFromCards(
  cards: GirlCard[],
  options: { random?: () => number } = {},
): { roster: Record<FactionId, FactionRoster>; leaders: FactionLeader[]; girls: FactionGirl[] } | null {
  if (cards.length < 6) return null;
  const pool = shuffleWith(cards.map((card, index) => subjectFromCard(card, `card-${card.girl.name}-${index}`)), options.random);
  const roster = cardFactionRoster(pool);
  if (!roster) return null;
  const byId = new Map(pool.map(subject => [subject.id, subject]));
  const leaders: FactionLeader[] = [];
  const girls: FactionGirl[] = [];
  for (const faction of FACTION_ORDER) {
    const leader = byId.get(roster[faction].leaderId);
    if (leader) leaders.push(customLeaderOf(faction, leader));
    for (const memberId of roster[faction].memberIds) {
      const member = byId.get(memberId);
      if (member) girls.push(customGirlOf(faction, member));
    }
  }
  return { roster, leaders, girls };
}
