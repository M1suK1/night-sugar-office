/**
 * 测试用的合成三方名册（v85）。
 *
 * 静态三方名册（`content/factionLeaders.ts` / `content/factionGirls.ts`）已经废除：
 * 首领全是「席位空缺」占位，随从表恒为空。任何还需要「那方真的有人」的测试
 * （拦截战、代表委托、编成、首领雇佣）都必须先用这里播种一份合成名册。
 *
 * 关键约定：这里造人走的是真实的 `subjectOfCustom → customLeaderOf / customGirlOf`
 * 路径，而不是手写一份字面量。等级口径（首领 10 级、随从 8–9 级）、默认属性、
 * 月蚀庭的默认魔女形态都由被测代码决定，所以测试断言的是真实行为，不是另一套
 * 平行实现。
 */
import assert from 'node:assert/strict';
import { act } from '../src/game.ts';
import { customGirlOf, customLeaderOf, subjectOfCustom } from '../src/factions.ts';
import { FACTION_ORDER } from '../src/territories.ts';
import type {
  FactionGirl, FactionId, FactionLeader, FactionRoster, GameState, Outfit, StatKey,
} from '../src/types.ts';

/** 三个真实存在的技能 id：名册里的人一律带上一套，免得战斗里放不出招。 */
export const FIXTURE_SKILLS = ['moon-slash', 'moon-guard', 'moon-ult'];

/** 合成人物的默认四维；拦不住/打不过都从这里的数值调。 */
export const FIXTURE_STATS: Record<StatKey, number> = { magic: 72, insight: 64, agility: 60, empathy: 56 };

const FACTION_COLOR: Record<FactionId, string> = {
  association: '#f1a7c6',
  government: '#9cc9d2',
  witch: '#b98ad9',
};

function statsOf(patch?: Partial<Record<StatKey, number>>): Record<StatKey, number> {
  return { ...FIXTURE_STATS, ...(patch ?? {}) };
}

export interface FixtureLeaderOptions {
  /** 默认 `fx-leader-<faction>-<name>`，带 fx 前缀免得撞上事务所名册里的人。 */
  id?: string;
  title?: string;
  level?: number;
  stats?: Partial<Record<StatKey, number>>;
  quote?: string;
  skillIds?: string[];
  /** 三套头衔；不传时 `customLeaderOf` 会把同一句头衔填进三方。 */
  titles?: Partial<Record<FactionId, string>>;
  witch?: boolean;
  witchForm?: Outfit;
}

export interface FixtureGirlOptions {
  id?: string;
  title?: string;
  level?: number;
  stats?: Partial<Record<StatKey, number>>;
  quote?: string;
  skills?: string[];
  codename?: string;
  witch?: boolean;
  witchForm?: Outfit;
}

/**
 * 合成一位首领。
 *
 * 等级固定落在首领口径（10 级），属性来自 `options.stats`，其余字段与玩家从卡库
 * 编进来的首领完全一样。
 */
export function makeLeader(faction: FactionId, name: string, options: FixtureLeaderOptions = {}): FactionLeader {
  const subject = subjectOfCustom({
    id: options.id ?? `fx-leader-${faction}-${name}`,
    name,
    factionTag: faction,
    level: options.level ?? 1,
    color: FACTION_COLOR[faction],
    portrait: '',
    stats: statsOf(options.stats),
    skillIds: [...(options.skillIds ?? FIXTURE_SKILLS)],
    quote: options.quote ?? `${name}只认自己签下的那一页。`,
    title: options.title ?? '临时主事',
    witch: options.witch,
    witchForm: options.witchForm,
  });
  const leader = customLeaderOf(faction, subject);
  return options.titles ? { ...leader, titles: { ...leader.titles, ...options.titles } } : leader;
}

/** 合成一位随从；等级固定落在随从口径（8–9 级）。 */
export function makeGirl(faction: FactionId, name: string, options: FixtureGirlOptions = {}): FactionGirl {
  const subject = subjectOfCustom({
    id: options.id ?? `fx-member-${faction}-${name}`,
    name,
    factionTag: faction,
    level: options.level ?? 4,
    color: FACTION_COLOR[faction],
    portrait: '',
    stats: statsOf(options.stats),
    skillIds: [...(options.skills ?? FIXTURE_SKILLS)],
    codename: options.codename,
    quote: options.quote ?? `${name}今晚只是替人看着这条街。`,
    title: options.title ?? '临时随从',
    witch: options.witch,
    witchForm: options.witchForm,
  });
  return customGirlOf(faction, subject);
}

export interface FactionSeed {
  leader?: FactionLeader;
  members?: FactionGirl[];
}

/** 按势力点名的种子；没点名的势力会拿到一整套默认人手（否则名册校验不过）。 */
export type RosterSeed = Partial<Record<FactionId, FactionSeed>>;

export interface SeededRoster {
  roster: Record<FactionId, FactionRoster>;
  leaders: FactionLeader[];
  girls: FactionGirl[];
}

/**
 * 把种子折成 `assignFactionRoster` / `setStarters` 要的三份数据。
 *
 * 没点名的势力补一位首领与一位随从：`sanitizeFactionRoster` 要求三方都坐满
 * 首领与 1–4 位随从，缺一方整份名册就会被判不合法。
 */
export function seedRoster(seed: RosterSeed = {}): SeededRoster {
  const roster = {} as Record<FactionId, FactionRoster>;
  const leaders: FactionLeader[] = [];
  const girls: FactionGirl[] = [];
  for (const faction of FACTION_ORDER) {
    const entry = seed[faction];
    const leader = entry?.leader ?? makeLeader(faction, `临时主事·${faction}`);
    const members = entry?.members ?? [makeGirl(faction, `临时随从·${faction}`)];
    roster[faction] = { leaderId: leader.id, memberIds: members.map(member => member.id) };
    // 席位决定现属势力：`sanitizeFactionRoster` 会按席位再盖一次章。
    leaders.push({ ...leader, faction });
    girls.push(...members.map(member => ({ ...member, faction, tag: faction })));
  }
  return { roster, leaders, girls };
}

/**
 * 给 state 播种一份三方名册（走真实的 `assignFactionRoster` 动作）。
 *
 * 断言 `ok === true`：播种失败说明 fixture 本身不合法，测试该当场炸掉，
 * 而不是带着空名册跑出一个看起来「通过」的假结果。
 */
export function withFactionRoster(state: GameState, seed: RosterSeed = {}): GameState {
  const { roster, leaders, girls } = seedRoster(seed);
  const result = act(state, { type: 'assignFactionRoster', roster, leaders, girls });
  assert.ok(result.ok, `播种三方名册失败：${result.message}`);
  return result.state;
}
