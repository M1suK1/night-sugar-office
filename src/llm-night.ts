import type {
  Archetype, Element, Expression, FactionId, GameState, Girl,
  GoalKind, Mission, MissionTemplate, MonsterRule, MonsterTemplate, Opinion, OpinionChange,
  OpinionDialogueLine, OpinionOutcome, OpinionOption, StatKey, Trait, TraitPolarity, WorkKind,
} from './types';
import type { DistrictId } from './districts';
import type { CommissionWindow } from './shift';
import { districts } from './districts.ts';
import { MAX_ENEMIES } from './combat.ts';
import { listItems } from './content/items.ts';
import { findSkill, skills } from './content/skills.ts';
import { bossSkills } from './content/bossSkills.ts';
import { findAnySkill, isBossSkill } from './skills.ts';
import { findMonster, monsters } from './content/monsters.ts';
import { createSeedPack } from './content/seed-pack.ts';
import { factionBrief, factionTagLabel } from './factions.ts';
import { representativeOf } from './office.ts';
import { pollutionTierLabel } from './pollution.ts';

export const NIGHT_VERSION = 2;

export const NIGHT_STATS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];
export const NIGHT_ELEMENTS: Element[] = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系'];
export const NIGHT_ARCHETYPES: Archetype[] = ['输出', '守护', '治愈', '控制', '侦查'];
export const NIGHT_RANKS: MonsterTemplate['rank'][] = ['碎屑', '游荡', '灾厄', '王座'];
export const NIGHT_TOPICS: Opinion['topic'][] = ['经费', '排班', '设施', '同伴', '城市', '私人心愿'];
export const NIGHT_DIFFICULTIES: MissionTemplate['difficulty'][] = ['低危', '中危', '高危', '绝望'];
export const NIGHT_FACTIONS: FactionId[] = ['witch', 'association', 'government'];
export const NIGHT_GOALS: GoalKind[] = ['战斗', '调查', '社交', '生活', '成长'];
export const NIGHT_EXPRESSIONS: Expression[] = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'];
export const NIGHT_WINDOWS: CommissionWindow[] = ['urgent', 'long'];
export const NIGHT_WORKS: WorkKind[] = ['combat', 'investigation'];
const DISTRICT_IDS = Object.keys(districts) as DistrictId[];

/** 模型看到的物品目录：内置物品 + 存档里已经登记过的一次性装备。 */
export interface NightCatalog {
  day: number;
  minutes: number;
  gold: number;
  reputation: number;
  factions: Record<FactionId, number>;
  territories: Record<DistrictId, FactionId>;
  girls: { id: string; name: string; element: Element; archetype?: Archetype; level: number; bond: number; fatigue: number; corruption: number; origin?: string }[];
  items: { id: string; name: string; slot: string }[];
  skills: { id: string; name: string; school: string; side: string; tier?: string }[];
  monsters: { id: string; name: string; rank: string }[];
  pool: { missions: number; monsters: number; candidates: number };
  /** 城市态势：三方态度与首领主张、最脏的两个辖区、辖区当主。数值仍由本地结算。 */
  city?: {
    briefs: string[];
    dirtiest: { district: string; name: string; pollution: number; tier: string; owner: string }[];
    ownerOf: Record<string, string>;
    representative: string;
  };
}

export interface NightStats { magic: number; insight: number; agility: number; empathy: number }

export interface NightMonsterSpec {
  name: string; epithet: string; rank: MonsterTemplate['rank']; element: Element;
  trait: string; description: string; habit: string; weakness: string;
  maxHp: number; maxSpirit: number; stats: NightStats; skillIds: string[]; rules: MonsterRule[];
}

export interface NightCandidateSpec {
  name: string; codename: string; title: string; element: Element; archetype: Archetype;
  level: number; cost: number; stats: NightStats; skillIds: string[];
  traits: { name: string; description: string; polarity: TraitPolarity }[];
  quote: string; goal: string; goalKind: GoalKind;
  appearance: string; personality: string; outfit: string;
}

export interface NightMissionSpec {
  title: string; category: string; description: string; work: WorkKind;
  difficulty: MissionTemplate['difficulty']; district?: DistrictId; window: CommissionWindow;
  duration: number; reward: number; requirement: StatKey; target: number; rounds: number;
  recommendedLevel: number; enemyRefs: string[];
  rewardItemRef?: string; rewardGirlLevel: number;
}

export interface NightOpinionSpec {
  authorId: string; topic: Opinion['topic']; faction: FactionId; district?: DistrictId;
  title: string; text: string; request: string;
  dialogue: OpinionDialogueLine[];
  options: OpinionOption[];
}

export interface NightEnvoySpec extends NightMissionSpec { faction: FactionId }

export interface NightLootSpec {
  ref: string; name: string; faction: FactionId;
  slot: 'weapon' | 'charm' | 'consumable'; description: string;
  stats?: Partial<Record<StatKey, number>>; passive?: string;
}

export interface NightProposalV2 {
  version: 2;
  monster: NightMonsterSpec;
  candidate: NightCandidateSpec;
  mission: NightMissionSpec;
  opinion: NightOpinionSpec;
  envoy: NightEnvoySpec;
  loot: NightLootSpec[];
}

export interface NightValidation {
  ok: boolean;
  proposal: NightProposalV2 | null;
  errors: string[];
  warnings: string[];
}

type Ctx = {
  state: GameState;
  errors: string[];
  warnings: string[];
  activeGirls: Girl[];
  itemIds: Set<string>;
  lootRefs: Set<string>;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function error(ctx: Ctx, path: string, message: string) {
  ctx.errors.push(`${path}：${message}`);
}
function warn(ctx: Ctx, path: string, message: string) {
  ctx.warnings.push(`${path}：${message}`);
}

function record(ctx: Ctx, value: unknown, path: string): Record<string, unknown> {
  if (isRecord(value)) return value;
  error(ctx, path, '必须是对象');
  return {};
}

function text(ctx: Ctx, value: unknown, path: string, max: number, fallback = ''): string {
  if (typeof value === 'string' && value.trim()) return value.trim().slice(0, max);
  error(ctx, path, '必须是非空文本');
  return fallback;
}

function optText(ctx: Ctx, value: unknown, path: string, max: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    error(ctx, path, '必须是文本');
    return undefined;
  }
  return value.trim().slice(0, max) || undefined;
}

function integer(ctx: Ctx, value: unknown, path: string, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    error(ctx, path, '必须是数字');
    return fallback;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    warn(ctx, path, `${rounded} 超出 ${min}–${max}，已裁剪`);
    return Math.max(min, Math.min(max, rounded));
  }
  return rounded;
}

function optionalInteger(ctx: Ctx, value: unknown, path: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    error(ctx, path, '必须是数字');
    return undefined;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    warn(ctx, path, `${rounded} 超出 ${min}–${max}，已裁剪`);
    return Math.max(min, Math.min(max, rounded));
  }
  return rounded;
}

function choice<T extends string>(ctx: Ctx, value: unknown, allowed: readonly T[], path: string, fallback: T): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value as T;
  error(ctx, path, `必须是 ${allowed.join(' / ')} 之一`);
  return fallback;
}

function stringArray(ctx: Ctx, value: unknown, path: string, min: number, max: number): string[] {
  if (!Array.isArray(value)) {
    error(ctx, path, '必须是非空数组');
    return [];
  }
  const list = value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())).map(entry => entry.trim());
  if (list.length < min) error(ctx, path, `至少需要 ${min} 项`);
  if (list.length > max) warn(ctx, path, `超过 ${max} 项，已截断`);
  return Array.from(new Set(list)).slice(0, max);
}

function parseStats(ctx: Ctx, value: unknown, path: string, min: number, max: number, fallback: number): NightStats {
  const body = record(ctx, value, path);
  const out = {} as NightStats;
  for (const key of NIGHT_STATS) out[key] = integer(ctx, body[key], `${path}.${key}`, min, max, fallback);
  return out;
}

function parseRules(ctx: Ctx, value: unknown, path: string): MonsterRule[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    error(ctx, path, '必须是数组');
    return [];
  }
  if (value.length > 2) warn(ctx, path, '最多 2 条，已截断');
  const rules: MonsterRule[] = [];
  value.slice(0, 2).forEach((entry, index) => {
    const body = record(ctx, entry, `${path}[${index}]`);
    const trigger = choice(ctx, body.trigger, ['roundStart', 'hit', 'always'] as const, `${path}[${index}].trigger`, 'roundStart');
    const effect = choice(ctx, body.effect, ['heal', 'buff', 'haste', 'debuffAttacker', 'dot', 'immuneStun', 'damageReduce'] as const, `${path}[${index}].effect`, 'heal');
    const rule: MonsterRule = { trigger, effect };
    if (body.amount !== undefined) rule.amount = integer(ctx, body.amount, `${path}[${index}].amount`, 0, 30, 0);
    if (body.duration !== undefined) rule.duration = integer(ctx, body.duration, `${path}[${index}].duration`, 1, 5, 1);
    if (body.belowHpPct !== undefined) {
      if (typeof body.belowHpPct !== 'number' || !Number.isFinite(body.belowHpPct)) error(ctx, `${path}[${index}].belowHpPct`, '必须是数字');
      else rule.belowHpPct = Math.max(0, Math.min(1, Math.round(body.belowHpPct * 100) / 100));
    }
    if (body.stat !== undefined) {
      if (body.stat === 'hit') rule.stat = 'hit';
      else if (typeof body.stat === 'string' && NIGHT_STATS.includes(body.stat as StatKey)) rule.stat = body.stat as StatKey;
      else error(ctx, `${path}[${index}].stat`, '必须是 magic / insight / agility / empathy / hit');
    }
    if (typeof body.unlessEmpathyDamage === 'boolean') rule.unlessEmpathyDamage = body.unlessEmpathyDamage;
    rules.push(rule);
  });
  return rules;
}

function parseLoot(ctx: Ctx, value: unknown): NightLootSpec[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    error(ctx, 'loot', '必须是数组');
    return [];
  }
  if (value.length > 2) warn(ctx, 'loot', '最多生成 2 件装备，已截断');
  const loot: NightLootSpec[] = [];
  const refs = new Set<string>();
  value.slice(0, 2).forEach((entry, index) => {
    const path = `loot[${index}]`;
    const body = record(ctx, entry, path);
    const ref = text(ctx, body.ref, `${path}.ref`, 32);
    if (!/^[a-z0-9][a-z0-9_-]{2,31}$/i.test(ref)) error(ctx, `${path}.ref`, '只能使用 3–32 位字母、数字、下划线或连字符');
    if (refs.has(ref)) error(ctx, `${path}.ref`, 'ref 重复');
    refs.add(ref);
    const slot = choice(ctx, body.slot, ['weapon', 'charm', 'consumable'] as const, `${path}.slot`, 'charm');
    const statsRaw = body.stats === undefined || body.stats === null ? {} : record(ctx, body.stats, `${path}.stats`);
    const stats: Partial<Record<StatKey, number>> = {};
    let total = 0;
    for (const key of NIGHT_STATS) {
      if (statsRaw[key] === undefined) continue;
      const value = optionalInteger(ctx, statsRaw[key], `${path}.stats.${key}`, 0, 4);
      if (value === undefined || value === 0) continue;
      stats[key] = value;
      total += value;
    }
    if (total > 8) warn(ctx, `${path}.stats`, `属性总和 ${total} 超过 8，已裁剪`);
    let left = 8;
    for (const key of NIGHT_STATS) {
      if (!stats[key]) continue;
      const next = Math.min(stats[key]!, Math.max(0, left));
      if (next === 0) delete stats[key];
      else stats[key] = next;
      left -= next;
    }
    loot.push({
      ref,
      name: text(ctx, body.name, `${path}.name`, 16),
      faction: choice(ctx, body.faction, NIGHT_FACTIONS, `${path}.faction`, 'witch'),
      slot,
      description: text(ctx, body.description, `${path}.description`, 160),
      stats: Object.keys(stats).length ? stats : undefined,
      passive: optText(ctx, body.passive, `${path}.passive`, 80),
    });
    ctx.lootRefs.add(ref);
  });
  return loot;
}

function itemRef(ctx: Ctx, value: unknown, path: string): string | undefined {
  const ref = optText(ctx, value, path, 40);
  if (!ref) return undefined;
  if (!ctx.itemIds.has(ref) && !ctx.lootRefs.has(ref)) {
    error(ctx, path, `物品「${ref}」不在物品目录里`);
    return undefined;
  }
  return ref;
}

function parseMissionTemplate(ctx: Ctx, value: unknown, path: string): MissionTemplate | undefined {
  const body = record(ctx, value, path);
  const title = text(ctx, body.title, `${path}.title`, 30);
  const category = text(ctx, body.category, `${path}.category`, 20);
  const description = text(ctx, body.description, `${path}.description`, 220);
  const difficulty = choice(ctx, body.difficulty, NIGHT_DIFFICULTIES, `${path}.difficulty`, '中危');
  const duration = integer(ctx, body.duration, `${path}.duration`, 45, 180, 60);
  const requirement = choice(ctx, body.requirement, NIGHT_STATS, `${path}.requirement`, 'insight');
  const target = integer(ctx, body.target, `${path}.target`, 40, 95, 58);
  const work = choice(ctx, body.work, NIGHT_WORKS, `${path}.work`, 'investigation');
  const rounds = integer(ctx, body.rounds, `${path}.rounds`, 2, 6, 3);
  const recommendedLevel = integer(ctx, body.recommendedLevel, `${path}.recommendedLevel`, 1, 8, 2);
  const reward = integer(ctx, body.reward, `${path}.reward`, 400, 1800, 700);
  const district = body.district === undefined || body.district === null ? undefined : choice(ctx, body.district, DISTRICT_IDS, `${path}.district`, 'oldtown');
  const window = body.window === undefined || body.window === null ? (duration >= 90 ? 'long' : 'urgent') : choice(ctx, body.window, NIGHT_WINDOWS, `${path}.window`, 'urgent');
  const enemyIds = Array.isArray(body.enemyIds)
    ? body.enemyIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  for (const id of enemyIds) if (id !== 'generated' && !findMonster(id) && !ctx.state.customMonsters.some(monster => monster.id === id)) error(ctx, `${path}.enemyIds`, `魔物「${id}」不在目录里`);
  return {
    id: `mt_lm_${Math.random().toString(36).slice(2, 8)}`,
    title, category, description, difficulty, duration, requirement, target, work,
    enemyIds: enemyIds.slice(0, MAX_ENEMIES), rounds, recommendedLevel, district, window, reward,
    rewardEquipmentId: itemRef(ctx, body.rewardEquipmentId ?? body.rewardItemRef, `${path}.rewardEquipmentId`),
    rewardGirlLevel: optionalInteger(ctx, body.rewardGirlLevel, `${path}.rewardGirlLevel`, 0, 5) ?? 0,
    color: '#8fd3c6',
  };
}

function parseMission(ctx: Ctx, value: unknown, path: string): NightMissionSpec {
  const body = record(ctx, value, path);
  const duration = integer(ctx, body.duration, `${path}.duration`, 45, 180, 60);
  const enemyRefs = body.enemyRefs === undefined
    ? ['generated']
    : stringArray(ctx, body.enemyRefs, `${path}.enemyRefs`, 1, 3);
  for (const ref of enemyRefs) {
    if (ref !== 'generated' && !findMonster(ref) && !ctx.state.customMonsters.some(monster => monster.id === ref)) {
      error(ctx, `${path}.enemyRefs`, `魔物「${ref}」不在目录里`);
    }
  }
  const district = body.district === undefined || body.district === null ? undefined : choice(ctx, body.district, DISTRICT_IDS, `${path}.district`, 'oldtown');
  return {
    title: text(ctx, body.title, `${path}.title`, 30),
    category: text(ctx, body.category ?? '代表委托', `${path}.category`, 20),
    description: text(ctx, body.description, `${path}.description`, 220),
    work: choice(ctx, body.work, NIGHT_WORKS, `${path}.work`, 'combat'),
    difficulty: choice(ctx, body.difficulty, NIGHT_DIFFICULTIES, `${path}.difficulty`, '中危'),
    district,
    window: body.window === undefined || body.window === null
      ? (duration >= 90 ? 'long' : 'urgent')
      : choice(ctx, body.window, NIGHT_WINDOWS, `${path}.window`, 'urgent'),
    duration,
    reward: integer(ctx, body.reward, `${path}.reward`, 400, 1800, 900),
    requirement: choice(ctx, body.requirement, NIGHT_STATS, `${path}.requirement`, 'insight'),
    target: integer(ctx, body.target, `${path}.target`, 40, 95, 58),
    rounds: integer(ctx, body.rounds, `${path}.rounds`, 2, 6, 4),
    recommendedLevel: integer(ctx, body.recommendedLevel, `${path}.recommendedLevel`, 1, 8, 2),
    enemyRefs,
    rewardItemRef: itemRef(ctx, body.rewardItemRef, `${path}.rewardItemRef`),
    rewardGirlLevel: optionalInteger(ctx, body.rewardGirlLevel, `${path}.rewardGirlLevel`, 0, 5) ?? 0,
  };
}

function parseChange(ctx: Ctx, value: unknown, path: string): OpinionChange | undefined {
  const body = record(ctx, value, path);
  const kind = body.kind;
  if (kind === 'gold') return { kind, amount: integer(ctx, body.amount, `${path}.amount`, -1500, 1500, 0) };
  if (kind === 'reputation') return { kind, amount: integer(ctx, body.amount, `${path}.amount`, -10, 10, 0) };
  if (kind === 'faction') {
    return {
      kind,
      faction: choice(ctx, body.faction, NIGHT_FACTIONS, `${path}.faction`, 'association'),
      amount: integer(ctx, body.amount, `${path}.amount`, -15, 15, 0),
    };
  }
  if (kind === 'item') {
    return {
      kind,
      itemId: itemRef(ctx, body.itemId, `${path}.itemId`) ?? '',
      amount: integer(ctx, body.amount, `${path}.amount`, -1, 1, 0),
    };
  }
  if (kind === 'minutes') return { kind, amount: integer(ctx, body.amount, `${path}.amount`, 0, 90, 0) };
  if (kind === 'girl') {
    const field = choice(ctx, body.field, ['bond', 'fatigue', 'corruption', 'hp'] as const, `${path}.field`, 'bond');
    const girlId = typeof body.girlId === 'string' ? body.girlId : '';
    if (!ctx.activeGirls.some(girl => girl.id === girlId)) error(ctx, `${path}.girlId`, `角色「${girlId}」不在值夜名册上`);
    const range: Record<typeof field, [number, number]> = { bond: [-5, 5], fatigue: [-20, 20], corruption: [-5, 5], hp: [-30, 30] };
    return { kind, girlId, field, amount: integer(ctx, body.amount, `${path}.amount`, range[field][0], range[field][1], 0) };
  }
  error(ctx, `${path}.kind`, '不支持的议会变化类型');
  return undefined;
}

function parseChanges(ctx: Ctx, value: unknown, path: string): OpinionChange[] {
  if (!Array.isArray(value)) {
    error(ctx, path, '必须是数组');
    return [];
  }
  return value.map((entry, index) => parseChange(ctx, entry, `${path}[${index}]`)).filter((entry): entry is OpinionChange => Boolean(entry));
}

function parseOutcome(ctx: Ctx, value: unknown, path: string): OpinionOutcome | undefined {
  const body = record(ctx, value, path);
  if (body.kind === 'territory') {
    return {
      kind: 'territory',
      district: choice(ctx, body.district, DISTRICT_IDS, `${path}.district`, 'oldtown'),
      faction: choice(ctx, body.faction, NIGHT_FACTIONS, `${path}.faction`, 'association'),
    };
  }
  if (body.kind === 'mission') {
    const template = parseMissionTemplate(ctx, body.template, `${path}.template`);
    return template ? { kind: 'mission', template } : undefined;
  }
  if (body.kind === 'join') return { kind: 'join', level: integer(ctx, body.level, `${path}.level`, 1, 5, 1) };
  if (body.kind === 'leave') {
    const girlId = typeof body.girlId === 'string' ? body.girlId : '';
    if (!ctx.activeGirls.some(girl => girl.id === girlId)) error(ctx, `${path}.girlId`, `角色「${girlId}」不在值夜名册上`);
    return { kind: 'leave', girlId };
  }
  error(ctx, `${path}.kind`, '不支持的议会结果类型');
  return undefined;
}

function parseOutcomes(ctx: Ctx, value: unknown, path: string): OpinionOutcome[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    error(ctx, path, '必须是数组');
    return [];
  }
  return value.map((entry, index) => parseOutcome(ctx, entry, `${path}[${index}]`)).filter((entry): entry is OpinionOutcome => Boolean(entry));
}

function materialPenalty(changes: OpinionChange[]): boolean {
  return changes.some(change => {
    if (change.kind === 'gold' || change.kind === 'reputation') return change.amount < 0;
    if (change.kind === 'item') return change.amount < 0;
    if (change.kind === 'minutes') return change.amount > 0;
    if (change.kind === 'girl') return change.field === 'fatigue' || change.field === 'corruption' ? change.amount > 0 : change.field === 'hp' && change.amount < 0;
    return false;
  });
}

function validateOption(ctx: Ctx, option: OpinionOption, path: string, faction: FactionId, authorId: string) {
  type BondChange = Extract<OpinionChange, { kind: 'girl' }>;
  const allBonds = (option.changes ?? []).filter((change): change is BondChange => change.kind === 'girl' && change.field === 'bond');
  const bond = allBonds.filter(change => change.girlId === authorId);
  const otherBonds = allBonds.filter(change => change.girlId !== authorId);
  const factionChanges = option.changes?.filter(change => change.kind === 'faction') ?? [];
  const outcomes = option.outcomes ?? [];
  if (option.id === 'defer') {
    if (outcomes.length) error(ctx, path, '暂缓不能包含结构性结果');
    if (otherBonds.length) error(ctx, path, '暂缓只能改动提出者的羁绊');
    for (const change of option.changes ?? []) {
      if (change.kind === 'girl' && change.field === 'bond' && change.girlId === authorId && change.amount === -1) continue;
      if (change.kind === 'faction' && change.faction === faction && change.amount === -2) continue;
      error(ctx, path, '暂缓只能包含提出者羁绊 −1 与所属势力态度 −2');
    }
    if (bond.length !== 1 || factionChanges.length !== 1) error(ctx, path, '暂缓必须包含提出者羁绊 −1 与势力态度 −2');
    return;
  }
  if (option.id === 'reject') {
    const penalty = materialPenalty(option.changes ?? []);
    if (otherBonds.length) error(ctx, path, '驳回只能改动提出者的羁绊');
    if (bond.length !== 1 || bond[0].amount !== -2) error(ctx, path, '驳回必须只包含提出者羁绊 −2');
    if (factionChanges.length !== 1 || !factionChanges.some(change => change.kind === 'faction' && change.faction === faction && change.amount === -4)) {
      error(ctx, path, '驳回必须只包含所属势力态度 −4');
    }
    if (!penalty) error(ctx, path, '驳回必须包含至少一项实际资源惩罚');
    return;
  }
  const cost = (option.changes ?? []).some(change => {
    if (change.kind === 'gold' || change.kind === 'reputation' || change.kind === 'faction' || change.kind === 'item') return change.amount < 0;
    if (change.kind === 'minutes') return change.amount > 0;
    if (change.kind === 'girl') return change.field === 'bond' ? change.amount < 0 : change.field === 'fatigue' || change.field === 'corruption' ? change.amount > 0 : change.amount < 0;
    return false;
  }) || outcomes.some(outcome => outcome.kind === 'leave');
  const benefit = (option.changes ?? []).some(change => {
    if (change.kind === 'gold' || change.kind === 'reputation' || change.kind === 'faction' || change.kind === 'item') return change.amount > 0;
    if (change.kind === 'girl') return change.field === 'bond' ? change.amount > 0 : change.field === 'fatigue' || change.field === 'corruption' ? change.amount < 0 : change.amount > 0;
    return false;
  }) || outcomes.some(outcome => outcome.kind !== 'leave');
  if (!cost) error(ctx, path, '批准必须包含至少一项成本或风险');
  if (!benefit) error(ctx, path, '批准必须包含至少一项收益或结果');
}

function parseOption(ctx: Ctx, value: unknown, path: string, faction: FactionId, authorId: string): OpinionOption | undefined {
  const body = record(ctx, value, path);
  if (body.id !== 'accept' && body.id !== 'defer' && body.id !== 'reject') {
    error(ctx, `${path}.id`, '必须是 accept / defer / reject');
    return undefined;
  }
  const option: OpinionOption = {
    id: body.id,
    label: text(ctx, body.label, `${path}.label`, 10, body.id === 'accept' ? '批准' : body.id === 'defer' ? '暂缓' : '驳回'),
    effect: text(ctx, body.effect, `${path}.effect`, 160),
    changes: parseChanges(ctx, body.changes, `${path}.changes`),
    outcomes: parseOutcomes(ctx, body.outcomes, `${path}.outcomes`),
  };
  validateOption(ctx, option, path, faction, authorId);
  return option;
}

function parseOpinion(ctx: Ctx, value: unknown): NightOpinionSpec {
  const path = 'opinion';
  const body = record(ctx, value, path);
  const authorId = typeof body.authorId === 'string' ? body.authorId : '';
  const author = ctx.activeGirls.find(girl => girl.id === authorId);
  if (!author) error(ctx, `${path}.authorId`, `角色「${authorId}」不在值夜名册上`);
  const district = body.district === undefined || body.district === null ? undefined : choice(ctx, body.district, DISTRICT_IDS, `${path}.district`, 'oldtown');
  const derivedFaction = district ? ctx.state.territories[district] : undefined;
  const faction = body.faction === undefined || body.faction === null
    ? (derivedFaction ?? 'association')
    : choice(ctx, body.faction, NIGHT_FACTIONS, `${path}.faction`, derivedFaction ?? 'association');
  if (body.faction === undefined || body.faction === null) warn(ctx, `${path}.faction`, '缺少所属势力，已按辖区归属补齐');
  const topic = choice(ctx, body.topic, NIGHT_TOPICS, `${path}.topic`, '排班');
  const dialogueRaw = body.dialogue;
  if (!Array.isArray(dialogueRaw)) error(ctx, `${path}.dialogue`, '必须是 3–5 句对白');
  const dialogue: OpinionDialogueLine[] = [];
  if (Array.isArray(dialogueRaw)) {
    if (dialogueRaw.length < 3) error(ctx, `${path}.dialogue`, '至少需要 3 句对白');
    if (dialogueRaw.length > 5) warn(ctx, `${path}.dialogue`, '最多 5 句，已截断');
    dialogueRaw.slice(0, 5).forEach((entry, index) => {
      const linePath = `${path}.dialogue[${index}]`;
      const line = record(ctx, entry, linePath);
      const speakerId = typeof line.speakerId === 'string' ? line.speakerId : author?.id;
      if (!speakerId || !ctx.activeGirls.some(girl => girl.id === speakerId)) error(ctx, `${linePath}.speakerId`, `角色「${speakerId ?? ''}」不在值夜名册上`);
      const speaker = typeof line.speaker === 'string' && line.speaker.trim()
        ? line.speaker.trim().slice(0, 24)
        : ctx.activeGirls.find(girl => girl.id === speakerId)?.name ?? '提出者';
      dialogue.push({
        speakerId,
        speaker,
        text: text(ctx, line.text, `${linePath}.text`, 240),
        expression: line.expression === undefined ? 'calm' : choice(ctx, line.expression, NIGHT_EXPRESSIONS, `${linePath}.expression`, 'calm'),
      });
    });
  }
  const optionsRaw = body.options;
  if (!Array.isArray(optionsRaw)) error(ctx, `${path}.options`, '必须是恰好 3 项');
  const options: OpinionOption[] = [];
  if (Array.isArray(optionsRaw)) {
    if (optionsRaw.length !== 3) error(ctx, `${path}.options`, '必须恰好 3 项');
    optionsRaw.slice(0, 3).forEach((entry, index) => {
      const option = parseOption(ctx, entry, `${path}.options[${index}]`, faction, author?.id ?? authorId);
      if (option) options.push(option);
    });
  }
  const ids = options.map(option => option.id).sort().join(',');
  if (ids !== 'accept,defer,reject') error(ctx, `${path}.options`, '必须同时包含 accept / defer / reject');
  return {
    authorId: author?.id ?? ctx.activeGirls[0]?.id ?? '',
    topic, faction, district,
    title: text(ctx, body.title, `${path}.title`, 30),
    text: text(ctx, body.text, `${path}.text`, 300),
    request: text(ctx, body.request, `${path}.request`, 160),
    dialogue, options,
  };
}

function parseMonster(ctx: Ctx, value: unknown): NightMonsterSpec {
  const path = 'monster';
  const body = record(ctx, value, path);
  const skillIds = stringArray(ctx, body.skillIds, `${path}.skillIds`, 1, 4);
  for (const id of skillIds) {
    if (!findAnySkill(id)) { error(ctx, `${path}.skillIds`, `技能「${id}」不在技能目录里`); continue; }
    // Boss 技能只挂在 Boss 身上：这一夜的魔物如果被写成王座/灾厄，允许它带一组。
    if (isBossSkill(id) && !['王座', '灾厄'].includes(String(body.rank ?? ''))) error(ctx, `${path}.skillIds`, `技能「${id}」是 Boss 专用，普通魔物不能带`);
  }
  return {
    name: text(ctx, body.name, `${path}.name`, 12),
    epithet: text(ctx, body.epithet, `${path}.epithet`, 20),
    rank: choice(ctx, body.rank, NIGHT_RANKS, `${path}.rank`, '游荡'),
    element: choice(ctx, body.element, NIGHT_ELEMENTS, `${path}.element`, '月影系'),
    trait: text(ctx, body.trait, `${path}.trait`, 160),
    description: text(ctx, body.description, `${path}.description`, 300),
    habit: text(ctx, body.habit, `${path}.habit`, 160),
    weakness: text(ctx, body.weakness, `${path}.weakness`, 160),
    maxHp: integer(ctx, body.maxHp, `${path}.maxHp`, 60, 240, 120),
    maxSpirit: integer(ctx, body.maxSpirit, `${path}.maxSpirit`, 40, 140, 80),
    stats: parseStats(ctx, body.stats, `${path}.stats`, 30, 110, 60),
    skillIds,
    rules: parseRules(ctx, body.rules, `${path}.rules`),
  };
}

function parseCandidate(ctx: Ctx, value: unknown): NightCandidateSpec {
  const path = 'candidate';
  const body = record(ctx, value, path);
  const stats = parseStats(ctx, body.stats, `${path}.stats`, 35, 95, 60);
  let total = NIGHT_STATS.reduce((sum, key) => sum + stats[key], 0);
  if (total > 330) {
    warn(ctx, `${path}.stats`, `四维总和 ${total} 超过 330，已下调`);
    while (total > 330) {
      const key = NIGHT_STATS.reduce((best, current) => stats[current] > stats[best] ? current : best, 'magic');
      stats[key] -= 1;
      total -= 1;
    }
  } else if (total < 200) {
    warn(ctx, `${path}.stats`, `四维总和 ${total} 低于 200，已上调`);
    while (total < 200) {
      const key = NIGHT_STATS.reduce((best, current) => stats[current] < stats[best] ? current : best, 'magic');
      stats[key] += 1;
      total += 1;
    }
  }
  const skillIds = stringArray(ctx, body.skillIds, `${path}.skillIds`, 1, 3);
  for (const id of skillIds) if (!findSkill(id)) error(ctx, `${path}.skillIds`, `技能「${id}」不在技能目录里`);
  const traitsRaw = body.traits;
  const candidateTraits: NightCandidateSpec['traits'] = [];
  if (traitsRaw !== undefined) {
    if (!Array.isArray(traitsRaw)) error(ctx, `${path}.traits`, '必须是数组');
    else {
      if (traitsRaw.length > 3) warn(ctx, `${path}.traits`, '最多 3 条，已截断');
      traitsRaw.slice(0, 3).forEach((entry, index) => {
        const trait = record(ctx, entry, `${path}.traits[${index}]`);
        const polarityRaw = trait.polarity;
        const polarity: TraitPolarity = polarityRaw === 'positive' || polarityRaw === '正面' ? 'positive'
          : polarityRaw === 'negative' || polarityRaw === '负面' ? 'negative'
            : polarityRaw === 'neutral' || polarityRaw === '中立' ? 'neutral' : 'positive';
        if (polarityRaw !== undefined && !['positive', 'negative', 'neutral', '正面', '负面', '中立'].includes(String(polarityRaw))) {
          error(ctx, `${path}.traits[${index}].polarity`, '必须是 正面 / 负面 / 中立');
        }
        candidateTraits.push({
          name: text(ctx, trait.name, `${path}.traits[${index}].name`, 12),
          description: text(ctx, trait.description, `${path}.traits[${index}].description`, 120),
          polarity,
        });
      });
    }
  }
  return {
    name: text(ctx, body.name, `${path}.name`, 12),
    codename: text(ctx, body.codename, `${path}.codename`, 12),
    title: text(ctx, body.title, `${path}.title`, 30),
    element: choice(ctx, body.element, NIGHT_ELEMENTS, `${path}.element`, '星光系'),
    archetype: choice(ctx, body.archetype, NIGHT_ARCHETYPES, `${path}.archetype`, '治愈'),
    level: integer(ctx, body.level, `${path}.level`, 1, 5, 1),
    cost: integer(ctx, body.cost, `${path}.cost`, 200, 900, 420),
    stats, skillIds, traits: candidateTraits,
    quote: text(ctx, body.quote, `${path}.quote`, 40),
    goal: text(ctx, body.goal, `${path}.goal`, 120),
    goalKind: choice(ctx, body.goalKind, NIGHT_GOALS, `${path}.goalKind`, '生活'),
    appearance: text(ctx, body.appearance, `${path}.appearance`, 180),
    personality: text(ctx, body.personality, `${path}.personality`, 180),
    outfit: text(ctx, body.outfit, `${path}.outfit`, 180),
  };
}

/** 把模型 JSON 规范化成运行时可用的提案；所有硬错误都会阻止采纳。 */
export function validateNightProposal(raw: unknown, state: GameState): NightValidation {
  const ctx: Ctx = {
    state,
    errors: [],
    warnings: [],
    activeGirls: state.girls.filter(girl => !girl.retired && !girl.dead),
    itemIds: new Set([
      ...state.generatedItems.map(item => item.id),
      ...listItems().map(item => item.id),
    ]),
    lootRefs: new Set(),
  };
  if (!ctx.activeGirls.length) return { ok: false, proposal: null, errors: ['名册上没有可参与值夜的契约者'], warnings: [] };
  if (!isRecord(raw)) return { ok: false, proposal: null, errors: ['提案必须是 JSON 对象'], warnings: [] };
  if (raw.version !== NIGHT_VERSION) error(ctx, 'version', `必须是 ${NIGHT_VERSION}`);
  const loot = parseLoot(ctx, raw.loot);
  const envoy = parseMission(ctx, raw.envoy, 'envoy');
  const envoyBody = record(ctx, raw.envoy, 'envoy');
  const proposal: NightProposalV2 = {
    version: 2,
    monster: parseMonster(ctx, raw.monster),
    candidate: parseCandidate(ctx, raw.candidate),
    mission: parseMission(ctx, raw.mission, 'mission'),
    opinion: parseOpinion(ctx, raw.opinion),
    envoy: { ...envoy, faction: choice(ctx, envoyBody.faction, NIGHT_FACTIONS, 'envoy.faction', 'association') },
    loot,
  };
  if (!raw.monster) error(ctx, 'monster', '缺少魔物');
  if (!raw.candidate) error(ctx, 'candidate', '缺少候选者');
  if (!raw.mission) error(ctx, 'mission', '缺少委托');
  if (!raw.opinion) error(ctx, 'opinion', '缺少议会提案');
  if (!raw.envoy) error(ctx, 'envoy', '缺少使者委托');
  return { ok: ctx.errors.length === 0, proposal, errors: ctx.errors, warnings: ctx.warnings };
}

export function buildNightCatalog(state: GameState): NightCatalog {
  const active = state.girls.filter(girl => !girl.retired && !girl.dead);
  const dumpest = Object.entries(state.pollution ?? {})
    .map(([district, pollution]) => ({ district, pollution: pollution ?? 0 }))
    .sort((a, b) => b.pollution - a.pollution)
    .slice(0, 2);
  const rep = representativeOf(state);
  return {
    day: state.day,
    minutes: state.minutes,
    gold: state.gold,
    reputation: state.reputation,
    factions: { witch: state.factions.witch.standing, association: state.factions.association.standing, government: state.factions.government.standing },
    territories: state.territories,
    girls: active.map(girl => ({ id: girl.id, name: girl.name, element: girl.element, archetype: girl.archetype, level: girl.level, bond: girl.bond, fatigue: girl.fatigue, corruption: girl.corruption, origin: factionTagLabel(girl.factionTag) })),
    items: [
      ...listItems().map(item => ({ id: item.id, name: item.name, slot: item.slot })),
      ...state.generatedItems.map(item => ({ id: item.id, name: item.name, slot: item.slot })),
    ],
    // 一个池子，少女与魔物共用；`boss-` 开头的是 Boss 专属，只有王座/灾厄能带。
    skills: [...skills, ...bossSkills].map(skill => ({ id: skill.id, name: skill.name, school: skill.school, side: skill.side, tier: skill.tier })),
    monsters: [
      ...state.customMonsters.filter(monster => !state.removedMonsters.includes(monster.id)).map(monster => ({ id: monster.id, name: monster.name, rank: monster.rank })),
      ...monsters.filter(monster => !state.removedMonsters.includes(monster.id)).map(monster => ({ id: monster.id, name: monster.name, rank: monster.rank })),
    ],
    pool: {
      missions: Math.max(0, state.poolLimits.missions - state.missions.filter(mission => mission.status !== 'done').length),
      monsters: Math.max(0, state.poolLimits.monsters - (state.customMonsters.length + monsters.length - state.removedMonsters.length)),
      candidates: Math.max(0, state.poolLimits.candidates - state.candidates.length),
    },
    city: {
      briefs: NIGHT_FACTIONS.map(id => factionBrief(id, state.factions[id].standing)),
      dirtiest: dumpest.map(({ district, pollution }) => ({
        district,
        name: districts[district as DistrictId].name,
        pollution,
        tier: pollutionTierLabel(pollution),
        owner: state.territories?.[district as DistrictId] ?? 'none',
      })),
      ownerOf: Object.fromEntries(DISTRICT_IDS.map(id => [id, state.territories?.[id] ?? 'none'])),
      representative: rep ? `${rep.name}（${rep.codename}）` : '尚未任命',
    },
  };
}

export const NIGHT_SCHEMA_EXAMPLE = {
  version: 2,
  monster: {
    name: '', epithet: '', rank: '游荡', element: '月影系', trait: '', description: '', habit: '', weakness: '',
    maxHp: 120, maxSpirit: 80, stats: { magic: 70, insight: 48, agility: 66, empathy: 35 },
    skillIds: ['monster-claw'], rules: [{ trigger: 'roundStart', effect: 'heal', amount: 3 }],
  },
  candidate: {
    name: '', codename: '', title: '', element: '星光系', archetype: '治愈', level: 1, cost: 420,
    stats: { magic: 64, insight: 58, agility: 52, empathy: 72 }, skillIds: ['glimmer-spear'],
    traits: [{ name: '', description: '', polarity: '正面' }], quote: '', goal: '', goalKind: '生活',
    appearance: '', personality: '', outfit: '',
  },
  mission: {
    title: '', category: '', description: '', work: 'combat', difficulty: '中危', district: 'oldtown',
    window: 'urgent', duration: 75, reward: 1200, requirement: 'insight', target: 62, rounds: 5,
    recommendedLevel: 3, enemyRefs: ['generated'], rewardItemRef: 'loot-1', rewardGirlLevel: 0,
  },
  opinion: {
    authorId: '', topic: '经费', faction: 'witch', district: null, title: '', text: '', request: '',
    dialogue: [{ speakerId: '', speaker: '', text: '', expression: 'sad' }],
    options: [
      { id: 'accept', label: '批准', effect: '', changes: [{ kind: 'gold', amount: -600 }], outcomes: [] },
      { id: 'defer', label: '暂缓', effect: '', changes: [{ kind: 'girl', girlId: '', field: 'bond', amount: -1 }, { kind: 'faction', faction: 'witch', amount: -2 }], outcomes: [] },
      { id: 'reject', label: '驳回', effect: '', changes: [{ kind: 'girl', girlId: '', field: 'bond', amount: -2 }, { kind: 'faction', faction: 'witch', amount: -4 }, { kind: 'gold', amount: -300 }], outcomes: [] },
    ],
  },
  envoy: {
    faction: 'association', title: '', description: '', work: 'investigation', difficulty: '中危', district: 'station',
    window: 'urgent', duration: 45, reward: 720, requirement: 'empathy', target: 52, rounds: 3,
    recommendedLevel: 2, enemyRefs: ['generated'], rewardGirlLevel: 0,
  },
  loot: [{ ref: 'loot-1', name: '', faction: 'witch', slot: 'charm', description: '', stats: { insight: 4 }, passive: '' }],
};

/** 系统提示词：目录、规则、JSON 形状一次给全。 */
export function buildNightPrompt(state: GameState): string {
  const catalog = buildNightCatalog(state);
  const names = (values: readonly string[]) => values.join(' / ');
  const city = catalog.city;
  const cityBlock = city ? [
    '【城市态势】',
    ...city.briefs.map(brief => `- ${brief.split('\n').join(' / ')}`),
    `- 最脏的辖区：${city.dirtiest.map(item => `${item.name}（污染 ${item.pollution} · ${item.tier} · 当主 ${item.owner}）`).join('、') || '无'}`,
    `- 夜糖事务所是重开的中立委托机构，收留三方与无所属的少女；当前对外代表 ${city.representative}。`,
    '- 辖区污染会改变委托目标与魔物状态，但污染数值只能由程序结算，不要出现在 JSON 里。',
    '- 少女的「出身」只说明她从哪里来，不代表雇主；她们的雇主一律是夜糖事务所。',
    '- 事件文本可以写协会的净化班与技术禁令、市役所的回收车与编号、月蚀庭净血派的受洗名单；但协会不是纯善，月蚀庭也不是单纯受害者。',
  ].join('\n') : '';
  return `【今晚的机制目录】
${JSON.stringify(catalog)}

${cityBlock}

【硬性规则】
1. 只输出一个 JSON 对象，不要 Markdown、解释或思维链。
2. 所有 id 必须来自目录：authorId、speakerId、girlId、faction、district、itemId、skillId、enemyRefs 中的魔物 id。唯一可以新造的是 loot[].ref。
3. opinion.options 必须恰好 3 项，id 分别为 accept / defer / reject。
4. defer 只能包含提出者羁绊 −1 与 opinion.faction 的势力态度 −2，不能有资源变化或 outcomes。
5. reject 必须包含提出者羁绊 −2、opinion.faction 的势力态度 −4，并至少包含一项实际资源惩罚（星砂、安定度、物品、时间、疲劳、侵蚀或生命）。
6. accept 必须同时包含至少一项成本/风险，以及至少一项收益/结果。
7. opinion.dialogue 写 3–5 句，speakerId 必须是名册上的角色；expression 只能是 ${names(NIGHT_EXPRESSIONS)}。
8. 魔物元素 ${names(NIGHT_ELEMENTS)}，位阶 ${names(NIGHT_RANKS)}；候选者职业 ${names(NIGHT_ARCHETYPES)}，目标类型 ${names(NIGHT_GOALS)}。
9. 委托难度 ${names(NIGHT_DIFFICULTIES)}，工作类型 ${names(NIGHT_WORKS)}，时限 ${names(NIGHT_WINDOWS)}。
10. 所有数值必须是整数。数值范围：魔物 maxHp 60–240、maxSpirit 40–140、四维 30–110、rules 最多 2 条；候选者四维 35–95 且总和 200–330、cost 200–900、level 1–5、技能 1–3 个；委托 duration 45–180、reward 400–1800、target 40–95、rounds 2–6、recommendedLevel 1–8；议会单个变化 gold ≤1500、reputation ≤10、faction ≤15、bond ≤5、fatigue ≤20、minutes ≤90。
11. loot 最多 2 件，每件属性总和 ≤8，最多 1 条 passive；rewardItemRef 可以指向 loot[].ref 或目录里的物品 id。
12. 颜色、立绘、SVG、坐标、本地 id 由程序生成，不要填写。

【JSON 形状】
${JSON.stringify(NIGHT_SCHEMA_EXAMPLE)}

把空字符串替换成与今晚局势一致的文案；保持字段完整。`;
}

function mapEnemyRefs(refs: string[], generatedMonster: string): string[] {
  return refs.map(ref => ref === 'generated' ? generatedMonster : ref);
}

function mapItemRef(ref: string | undefined, lootIds: Map<string, string>): string | undefined {
  if (!ref) return undefined;
  return lootIds.get(ref) ?? ref;
}

function mapMissionTemplate(template: MissionTemplate, stamp: string, index: number, lootIds: Map<string, string>): MissionTemplate {
  return {
    ...template,
    id: `mt_lm_${stamp}_${index}`,
    rewardEquipmentId: mapItemRef(template.rewardEquipmentId, lootIds),
  };
}

function materializeLoot(proposal: NightProposalV2, stamp: string) {
  const ids = new Map<string, string>();
  const items = proposal.loot.map((loot, index) => {
    const id = `lm_item_${stamp}_${index}`;
    ids.set(loot.ref, id);
    return {
      id, name: loot.name, faction: loot.faction, slot: loot.slot,
      price: 0, standingReq: 0, description: loot.description,
      stats: loot.stats, passive: loot.passive,
    };
  });
  return { ids, items };
}

/** 把已校验的模型提案变成真正的运行时对象；模型数值不再被固定模板覆盖。 */
export function materializeNightProposal(proposal: NightProposalV2, state: GameState): {
  monster: MonsterTemplate; girl: Girl; mission: Mission; opinion: Opinion; envoyMission: Mission;
  items: ReturnType<typeof materializeLoot>['items'];
} {
  const pack = createSeedPack();
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 999).toString(36)}`;
  const monsterBase = monsters.find(m => m.rank === proposal.monster.rank) ?? monsters[1];
  const monster: MonsterTemplate = {
    ...monsterBase,
    id: `lm_${stamp}`,
    name: proposal.monster.name,
    epithet: proposal.monster.epithet,
    rank: proposal.monster.rank,
    element: proposal.monster.element,
    color: monsterBase.color,
    maxHp: proposal.monster.maxHp,
    maxSpirit: proposal.monster.maxSpirit,
    stats: proposal.monster.stats,
    skillIds: proposal.monster.skillIds,
    trait: proposal.monster.trait,
    description: proposal.monster.description,
    spec: { ...monsterBase.spec },
    codex: { habit: proposal.monster.habit, weakness: proposal.monster.weakness },
    rules: proposal.monster.rules,
  };
  const baseGirl = pack.girls[1] ?? pack.girls[0];
  const candidate = proposal.candidate;
  const maxHp = Math.round(60 + candidate.stats.empathy * 0.8);
  const maxSpirit = Math.round(50 + candidate.stats.insight * 0.5);
  const girl: Girl = {
    ...baseGirl,
    id: `g_${stamp}`,
    name: candidate.name,
    codename: candidate.codename,
    title: candidate.title,
    element: candidate.element,
    archetype: candidate.archetype,
    color: '#f3aec9',
    portrait: '',
    level: candidate.level,
    stats: { ...candidate.stats },
    baseStats: { ...candidate.stats },
    hp: maxHp, maxHp, baseMaxHp: maxHp,
    spirit: maxSpirit, maxSpirit,
    status: 'idle', roomId: 'lounge', remaining: 0, missionId: undefined,
    skill: findSkill(candidate.skillIds[0])?.name ?? candidate.skillIds[0],
    skills: candidate.skillIds,
    goal: candidate.goal,
    goalKind: candidate.goalKind,
    appearance: candidate.appearance,
    personality: candidate.personality,
    outfitDescription: candidate.outfit,
    quote: candidate.quote,
    traits: candidate.traits.map((trait, index): Trait => ({
      id: `trait_lm_${stamp}_${index}`, name: trait.name, polarity: trait.polarity, tags: [], description: trait.description,
    })),
    corruption: 0, witch: false, drugUntilDay: undefined, withdrawalDays: 0,
    contractEndDay: state.day + 20, contractDays: 20, contractRenewals: 0, pensionMissed: 0,
    relationships: { player: 20 },
    scars: [], conditions: [], retired: false, dead: false,
    cost: candidate.cost,
    expression: 'calm',
  };
  const loot = materializeLoot(proposal, stamp);
  const baseMission = pack.missions.find(m => m.work === proposal.mission.work) ?? pack.missions[0];
  const missionSpec = proposal.mission;
  const mission: Mission = {
    ...baseMission,
    id: `m_${stamp}`,
    title: missionSpec.title,
    category: missionSpec.category,
    description: missionSpec.description,
    x: 18 + Math.floor(Math.random() * 62),
    y: 24 + Math.floor(Math.random() * 52),
    difficulty: missionSpec.difficulty,
    duration: missionSpec.duration,
    reward: missionSpec.reward,
    requirement: missionSpec.requirement,
    target: missionSpec.target,
    color: '#f3aec9',
    status: 'open',
    squad: [],
    work: missionSpec.work,
    enemyIds: mapEnemyRefs(missionSpec.enemyRefs, monster.id),
    rounds: missionSpec.rounds,
    attempts: 0,
    worsened: false,
    lastOutcome: undefined,
    recommendedLevel: missionSpec.recommendedLevel,
    faction: undefined,
    envoy: false,
    boss: false,
    generated: true,
    sourcePack: 'llm',
    district: missionSpec.district,
    window: missionSpec.window,
    rewardEquipmentId: mapItemRef(missionSpec.rewardItemRef, loot.ids),
    rewardGirlLevel: missionSpec.rewardGirlLevel,
  };
  const author = state.girls.find(girl => girl.id === proposal.opinion.authorId && !girl.retired && !girl.dead)
    ?? [...state.girls].filter(girl => !girl.retired && !girl.dead).sort((a, b) => b.bond - a.bond)[0]
    ?? state.girls[0];
  const options = proposal.opinion.options.map((option, optionIndex) => ({
    ...option,
    changes: option.changes?.map(change => change.kind === 'item'
      ? { ...change, itemId: mapItemRef(change.itemId, loot.ids) ?? change.itemId }
      : change),
    outcomes: option.outcomes?.map((outcome, outcomeIndex) => outcome.kind === 'mission'
      ? { ...outcome, template: mapMissionTemplate(outcome.template, stamp, optionIndex * 10 + outcomeIndex, loot.ids) }
      : outcome),
  })) as OpinionOption[];
  const opinion: Opinion = {
    id: `op_${stamp}`,
    day: state.day,
    authorId: author?.id ?? proposal.opinion.authorId,
    topic: proposal.opinion.topic,
    title: proposal.opinion.title,
    text: proposal.opinion.text,
    request: proposal.opinion.request,
    status: 'pending',
    faction: proposal.opinion.faction,
    options,
    dialogue: proposal.opinion.dialogue.map(line => ({
      ...line,
      speakerId: line.speakerId ?? author?.id,
      speaker: line.speaker || author?.name || '提出者',
    })),
    assistantNote: '这份议题的文案、选项、消耗与后果由叙事引擎起草，并经本地规则校验。',
  };
  const envoySpec = proposal.envoy;
  const envoyMission: Mission = {
    ...mission,
    id: `m_env_${stamp}`,
    title: envoySpec.title,
    category: envoySpec.category || '代表委托',
    description: envoySpec.description,
    faction: envoySpec.faction,
    envoy: true,
    work: envoySpec.work,
    difficulty: envoySpec.difficulty,
    duration: envoySpec.duration,
    reward: envoySpec.reward,
    requirement: envoySpec.requirement,
    target: envoySpec.target,
    rounds: envoySpec.rounds,
    recommendedLevel: envoySpec.recommendedLevel,
    enemyIds: mapEnemyRefs(envoySpec.enemyRefs, monster.id),
    district: envoySpec.district,
    window: envoySpec.window,
    rewardEquipmentId: mapItemRef(envoySpec.rewardItemRef, loot.ids),
    rewardGirlLevel: envoySpec.rewardGirlLevel,
    x: (mission.x + 31) % 78 + 8,
    y: (mission.y + 19) % 58 + 12,
  };
  return { monster, girl, mission, opinion, envoyMission, items: loot.items };
}
