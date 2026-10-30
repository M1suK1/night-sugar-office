/**
 * 开局编成的可选池。
 *
 * 三方名册以前只认静态内容里的 3 位首领 + 9 位随从；现在玩家自己带来的少女
 * （契约卡库里的卡、名册里、候选池里）也可以坐进这些位置。这里只负责把不同来源
 * 的数据折成同一种 `RosterSubject`，校验与快照仍在 `game.ts` 的 `setStarters`。
 */
import type { FactionId, GameState, Girl } from './types.ts';
import type { CardBoxEntry } from './cardbox.ts';
import { parseGirlCard } from './cards.ts';
import { factionGirls } from './content/factionGirls.ts';
import { factionLeaders } from './content/factionLeaders.ts';
import { customRosterOf, subjectOfCustom, subjectOfGirl, subjectOfLeader, type RosterSubject } from './factions.ts';
import { FACTION_ORDER } from './territories.ts';

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
  });
}

/**
 * 可编进势力的全部人。
 *
 * 顺序有意为之：原属首领 → 原属随从 → 已编进名册的自定义少女 → 契约卡库 → 名册 / 候选池。
 * id 冲突时先出现的一方胜出，避免同一张卡在两个来源里各算一次。
 */
export function rosterPool(state: GameState, library: CardBoxEntry[] = []): RosterSubject[] {
  const list: RosterSubject[] = [];
  const seen = new Set<string>();
  const push = (subject: RosterSubject) => {
    if (seen.has(subject.id)) return;
    seen.add(subject.id);
    list.push(subject);
  };
  for (const faction of FACTION_ORDER) push(subjectOfLeader(factionLeaders[faction]));
  for (const girl of factionGirls) push(subjectOfGirl(girl));
  for (const subject of customRosterOf(state)) push(subject);
  for (const entry of library) {
    const subject = cardSubject(entry);
    if (subject) push(subject);
  }
  for (const girl of [...state.girls, ...state.candidates]) {
    if (!girl.custom) continue;
    if (girl.dead || girl.retired) continue;
    push(girlSubject(girl));
  }
  return list;
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
