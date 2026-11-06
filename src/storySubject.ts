/**
 * 一段剧情里的「在场的人」。
 *
 * 以前三处都只在 `state.girls` / `state.candidates` 里找人（剧情大纲、重写、主角宏），
 * 于是「登门拜访首领」这种事件直接断了：`event.girlId` 是势力名册里的首领，
 * 提示词里的 `{{heroine}}` 变成「（本任务没有指定主角）」，App 那边也拿不到 target，
 * 玩家写完一句就再没有下文。
 *
 * 这里把「按 id 找人」收敛成一个函数：契约者 → 候选 → 追悼 → 三方名册（首领/随从）。
 * 名册里的人不是 `Girl`，投影成一个 Girl 形态只为**提示词与演出**用，绝不会写回 state。
 */
import type { CharacterEvent, FactionGirl, FactionId, FactionLeader, GameState, Girl } from './types.ts';
import { factionInfo } from './content/items.ts';
import { FACTION_ORDER } from './territories.ts';
import { leaderById, leaderTitle, rosterLeader, rosterMembers } from './factions.ts';
import { portraitString } from './portrait.ts';
import { hydrate } from './rules/candidate.ts';

export type RosterSeat = { kind: 'leader' | 'member'; faction: FactionId };

export type StoryPerson = {
  /** 给提示词、演出与档案用的 Girl 形态（名册成员是投影，不是真的契约者）。 */
  girl: Girl;
  /** 在名册里的位置，例如「月蚀庭首领」；契约者没有这一项。 */
  role?: string;
  /** 她在名册里的座位；契约者没有。 */
  seat?: RosterSeat;
  /** 名册条目自带的一句说明（首领/随从档案里的 note）。 */
  note?: string;
};

function personIn(state: GameState, id: string): { person: FactionLeader | FactionGirl; seat: RosterSeat } | undefined {
  if (!id) return undefined;
  for (const faction of FACTION_ORDER) {
    const leader = rosterLeader(state, faction);
    if (leader && leader.id === id && !leader.vacant) return { person: leader, seat: { kind: 'leader', faction } };
    const member = rosterMembers(state, faction).find(girl => girl.id === id);
    if (member) return { person: member, seat: { kind: 'member', faction } };
  }
  // 刚被换下座位、但还留在自定义表里的人也要认得（免得一句话没说就断线）。
  const customLeader = (state.customFactionLeaders ?? []).find(leader => leader.id === id && !leader.vacant);
  if (customLeader) return { person: customLeader, seat: { kind: 'leader', faction: customLeader.faction } };
  const customGirl = (state.customFactionGirls ?? []).find(girl => girl.id === id);
  if (customGirl) return { person: customGirl, seat: { kind: 'member', faction: customGirl.faction } };
  const staticLeader = leaderById(id);
  if (staticLeader && !staticLeader.vacant) return { person: staticLeader, seat: { kind: 'leader', faction: staticLeader.faction } };
  return undefined;
}

function roleOf(seat: RosterSeat): string {
  return `${factionInfo[seat.faction].name}${seat.kind === 'leader' ? '首领' : '随从'}`;
}

/** 名册成员 → Girl 形态。只用于提示词与演出。 */
function projectPerson(person: FactionLeader | FactionGirl, seat: RosterSeat): Girl {
  const isLeader = seat.kind === 'leader';
  const leader = isLeader ? (person as FactionLeader) : undefined;
  const member = isLeader ? undefined : (person as FactionGirl);
  const title = isLeader
    ? roleOf(seat)
    : `${roleOf(seat)} · ${member!.title}`;
  const skillIds = isLeader ? (leader!.skillIds ?? []) : (member!.skills ?? []);
  const stats = { ...person.stats };
  const baseMaxHp = Math.round(96 + stats.empathy * 0.3) + person.level * 4;
  const origin = isLeader ? (leader!.origin ?? seat.faction) : (member!.tag ?? seat.faction);
  return hydrate({
    id: person.id,
    name: person.name,
    codename: member?.codename ?? leaderTitle(leader!, seat.faction),
    title,
    element: (seat.faction === 'association' ? '星光系' : seat.faction === 'government' ? '糖霜系' : '月影系') as Girl['element'],
    color: person.color,
    portrait: portraitString(person) || person.portrait,
    portraitSpec: person.portraitSpec,
    level: person.level,
    hp: baseMaxHp,
    maxHp: baseMaxHp,
    baseMaxHp,
    spirit: 0,
    maxSpirit: 0,
    fatigue: 0,
    bond: 0,
    exp: 0,
    stats,
    baseStats: { ...stats },
    status: 'idle',
    roomId: 'lounge',
    remaining: 0,
    skill: '',
    skills: [...skillIds],
    description: 'note' in person ? person.note : '',
    cost: 0,
    scars: [],
    relationships: {},
    archetype: isLeader ? leader!.archetype : '输出',
    quote: person.quote,
    goal: isLeader ? '守住自己那一方剩下的辖区，或者找一个不需要再替谁守门的位置。' : '替这一方把夜里的活干完。',
    goalKind: '成长',
    traits: [],
    conditions: [],
    contractEndDay: 0,
    contractDays: 0,
    contractRenewals: 0,
    pensionMissed: 0,
    appearance: person.appearance ?? '',
    personality: person.personality ?? '',
    outfitDescription: '',
    wardrobe: person.wardrobe ?? [],
    outfitId: person.outfitId ?? 'uniform',
    expression: person.expression ?? 'calm',
    corruption: 0,
    equipment: {},
    factionTag: origin,
    leader: isLeader,
    starter: false,
    witch: person.witch,
    witchForm: person.witchForm,
  }, { clone: false });
}

function inOwnRoster(state: GameState, id: string): Girl | undefined {
  return (state.girls ?? []).find(girl => girl.id === id);
}

/** 按 id 找人：契约者 → 候选 → 追悼 → 三方名册。 */
export function storyPersonOf(state: GameState | undefined, id: string | undefined): StoryPerson | undefined {
  if (!state || !id) return undefined;
  const own = inOwnRoster(state, id)
    ?? (state.candidates ?? []).find(girl => girl.id === id)
    ?? (state.memorial ?? []).map(entry => entry.girl).find(girl => girl.id === id);
  if (own) return { girl: own };
  const found = personIn(state, id);
  if (!found) return undefined;
  const girl = projectPerson(found.person, found.seat);
  return { girl, role: roleOf(found.seat), seat: found.seat, note: girl.description };
}

/** 只要 Girl 形态时用它。 */
export function storyGirlOf(state: GameState | undefined, id: string | undefined): Girl | undefined {
  return storyPersonOf(state, id)?.girl;
}

/** 一段剧情的主角：先看 girlId，再看 cast 里第一个不是所长的名字。 */
export function storyFocusOf(state: GameState | undefined, event: Pick<CharacterEvent, 'girlId' | 'cast'>): StoryPerson | undefined {
  if (!state) return undefined;
  const byOwner = storyPersonOf(state, event.girlId);
  if (byOwner) return byOwner;
  for (const id of event.cast ?? []) {
    if (id === 'player') continue;
    const byCast = storyPersonOf(state, id);
    if (byCast) return byCast;
  }
  return undefined;
}
