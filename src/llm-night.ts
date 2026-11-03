import type {
  Archetype, Element, Equipment, FactionId, GameState, Girl,
  GoalKind, Mission, MissionTemplate, MonsterRule, MonsterTemplate, Opinion, OpinionChange,
  OpinionDialogueLine, OpinionOutcome, OpinionOption, StatKey, TraitPolarity, WorkKind,
} from './types';
import type { DistrictId } from './districts';
import type { CommissionWindow } from './shift';
import { districts } from './districts.ts';
import { MAX_ENEMIES } from './combat.ts';
import { listItems } from './content/items.ts';
import { tierOf } from './items.ts';
import { pickEquipmentOfTier, pickMissionTemplate } from './nightPick.ts';
import { findSkill } from './content/skills.ts';
import { factionRepresentativeOf, type FactionRepresentative } from './factions.ts';
import { HOSTILITY_PAIRS } from './hostility.ts';
import { FACTION_ORDER } from './territories.ts';
import { findAnySkill, isBossSkill } from './skills.ts';
import { findMonster, monsters } from './content/monsters.ts';
import { createSeedPack } from './content/seed-pack.ts';
import { factionBrief, factionTagLabel } from './factions.ts';
import { representativeOf } from './office.ts';
import { pollutionTierLabel } from './pollution.ts';
import { DEFAULT_PROMPTS, renderPresetSystem } from './presets.ts';
import { NIGHT_ARCHETYPES, NIGHT_DIFFICULTIES, NIGHT_ELEMENTS, NIGHT_EXPRESSIONS, NIGHT_FACTIONS, NIGHT_GOALS, NIGHT_RANKS, NIGHT_SCHEMA_EXAMPLE, NIGHT_STATS, NIGHT_TOPICS, NIGHT_VERSION, NIGHT_WINDOWS, NIGHT_WORKS } from './nightSpec.ts';

// 枚举与 JSON 骨架搬到 nightSpec.ts，这里照旧再导出一遍，外部 import 路径不用改。
export * from './nightSpec.ts';

const DISTRICT_IDS = Object.keys(districts) as DistrictId[];

/** 模型看到的物品目录：内置物品 + 存档里已经登记过的一次性装备。 */
export interface NightCatalog {
  day: number;
  minutes: number;
  gold: number;
  reputation: number;
  factions: Record<FactionId, number>;
  territories: Record<DistrictId, FactionId>;
  representatives: { id: string; name: string; title: string; faction: FactionId; level: number }[];
  girls: { id: string; name: string; title?: string; element: Element; archetype?: Archetype; level: number; bond: number; fatigue: number; corruption: number; origin?: string; personality?: string; appearance?: string; quote?: string }[];
  /** 装备只给阶级统计与几个例子名：具体哪一件由程序按阶级抽（v47）。 */
  itemTiers: { tier: number; count: number; examples: string[] }[];
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
  authorId: string; authorKind?: 'girl' | 'leader'; authorFaction?: FactionId;
  topic: Opinion['topic']; faction: FactionId; district?: DistrictId;
  title: string; text: string; request: string;
  dialogue: OpinionDialogueLine[];
  options: OpinionOption[];
}

export interface NightEnvoySpec extends NightMissionSpec { faction: FactionId }

export interface NightLootSpec {
  ref: string; name: string; faction: FactionId;
  slot: 'weapon' | 'charm' | 'consumable'; description: string;
  stats?: Partial<Record<StatKey, number>>; passive?: string;
  /** v47：按阶级抽到的成品物品 id；有它就说明这件掉落是现成货，不再新造。 */
  itemId?: string;
}

export interface NightProposalV2 {
  version: 2;
  /** 旧提案字段；v32 起每日提案不再产出魔物，只为兼容旧日志保留。 */
  monster?: NightMonsterSpec;
  candidate?: NightCandidateSpec;
  mission: NightMissionSpec;
  /** 旧单条议席字段；新输出使用 opinions。 */
  opinion?: NightOpinionSpec;
  opinions?: NightOpinionSpec[];
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
  representatives: FactionRepresentative[];
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
    // v47：按阶级抽的掉落不需要 ref（没人引用它），自动补一个即可。
    const refRaw = body.ref === undefined || body.ref === null ? `loot-${index + 1}` : body.ref;
    const ref = text(ctx, refRaw, `${path}.ref`, 32);
    if (!/^[a-z0-9][a-z0-9_-]{2,31}$/i.test(ref)) error(ctx, `${path}.ref`, '只能使用 3–32 位字母、数字、下划线或连字符');
    if (refs.has(ref)) error(ctx, `${path}.ref`, 'ref 重复');
    refs.add(ref);
    const slot = choice(ctx, body.slot, ['weapon', 'charm', 'consumable'] as const, `${path}.slot`, 'charm');
    // v47：只给阶级 → 从物品表里抽一件同阶成品，不再让模型编名字与属性。
    const tier = optionalInteger(ctx, body.tier, `${path}.tier`, 1, 5);
    if (tier !== undefined) {
      const picked = pickEquipmentOfTier({ tier, slot, seed: `${ctx.state.day}:loot:${index}`, allowConsumable: true });
      if (!picked) {
        error(ctx, `${path}.tier`, `物品表里没有 ${tier} 阶的${slot === 'consumable' ? '消耗品' : '装备'}可发放`);
        return;
      }
      loot.push({
        ref, itemId: picked.id, name: picked.name, faction: picked.faction, slot: picked.slot,
        description: picked.description, stats: picked.stats, passive: picked.passive,
      });
      ctx.lootRefs.add(ref);
      ctx.itemIds.add(picked.id);
      return;
    }
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
  const work = body.work === undefined || body.work === null
    ? undefined
    : choice(ctx, body.work, NIGHT_WORKS, `${path}.work`, 'combat');
  const difficultyWanted = body.difficulty === undefined || body.difficulty === null
    ? '中危'
    : choice(ctx, body.difficulty, NIGHT_DIFFICULTIES, `${path}.difficulty`, '中危');
  // v47：只写难度时，其余数值从真实委托模板里抽；模型显式写了就照它的来（旧提案兼容）。
  const picked = pickMissionTemplate({ state: ctx.state, work, difficulty: difficultyWanted, seed: `${ctx.state.day}:${path}:${String(body.title ?? '')}` });
  const num = (key: string, raw: unknown, fallback: number, min: number, max: number): number =>
    raw === undefined || raw === null ? fallback : integer(ctx, raw, `${path}.${key}`, min, max, fallback);
  const duration = num('duration', body.duration, picked?.duration ?? 60, 45, 180);
  const enemyRefs = body.enemyRefs === undefined
    ? (picked?.enemyIds.length ? picked.enemyIds : ['generated'])
    : stringArray(ctx, body.enemyRefs, `${path}.enemyRefs`, 1, 3);
  for (const ref of enemyRefs) {
    if (ref !== 'generated' && !findMonster(ref) && !ctx.state.customMonsters.some(monster => monster.id === ref)) {
      error(ctx, `${path}.enemyRefs`, `魔物「${ref}」不在目录里`);
    }
  }
  const district = body.district === undefined || body.district === null ? undefined : choice(ctx, body.district, DISTRICT_IDS, `${path}.district`, 'oldtown');
  return {
    title: text(ctx, body.title, `${path}.title`, 30),
    category: text(ctx, body.category ?? picked?.category ?? '代表委托', `${path}.category`, 20),
    description: text(ctx, body.description, `${path}.description`, 220),
    work: work ?? picked?.work ?? 'combat',
    difficulty: difficultyWanted,
    district,
    window: body.window === undefined || body.window === null
      ? (duration >= 90 ? 'long' : 'urgent')
      : choice(ctx, body.window, NIGHT_WINDOWS, `${path}.window`, 'urgent'),
    duration,
    reward: num('reward', body.reward, picked?.reward ?? 900, 400, 1800),
    requirement: body.requirement === undefined || body.requirement === null
      ? (picked?.requirement ?? 'insight')
      : choice(ctx, body.requirement, NIGHT_STATS, `${path}.requirement`, 'insight'),
    target: num('target', body.target, picked?.target ?? 58, 40, 95),
    rounds: num('rounds', body.rounds, picked?.rounds ?? 4, 2, 6),
    recommendedLevel: num('recommendedLevel', body.recommendedLevel, picked?.recommendedLevel ?? 2, 1, 8),
    enemyRefs,
    rewardItemRef: itemRef(ctx, body.rewardItemRef, `${path}.rewardItemRef`),
    rewardGirlLevel: optionalInteger(ctx, body.rewardGirlLevel, `${path}.rewardGirlLevel`, 0, 5) ?? 0,
  };
}

function parseChange(ctx: Ctx, value: unknown, path: string, fallbackGirlId?: string): OpinionChange | undefined {
  const body = record(ctx, value, path);
  const kind = body.kind;
  if (kind === 'gold') return { kind, amount: integer(ctx, body.amount, `${path}.amount`, -9000, 1500, 0) };
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
  if (kind === 'hostility') {
    return {
      kind,
      pair: choice(ctx, body.pair, HOSTILITY_PAIRS, `${path}.pair`, 'association-witch'),
      amount: integer(ctx, body.amount, `${path}.amount`, -20, 20, 0),
    };
  }
  if (kind === 'girl') {
    const field = choice(ctx, body.field, ['bond', 'fatigue', 'corruption', 'hp'] as const, `${path}.field`, 'bond');
    let girlId = typeof body.girlId === 'string' ? body.girlId : '';
    if (!ctx.activeGirls.some(girl => girl.id === girlId)) {
      // 模型常把「三方首领」的 id 写进 girlId（名册里只有少女）。这时改成提出者：
      // defer/reject 本来就要求改提出者的羁绊，改写比整份提案作废更接近它的本意。
      const fallback = [fallbackGirlId, ctx.activeGirls[0]?.id].find(id => id && ctx.activeGirls.some(girl => girl.id === id));
      if (!fallback) {
        error(ctx, `${path}.girlId`, `角色「${girlId}」不在值夜名册上；可用：${ctx.activeGirls.map(girl => `${girl.id}（${girl.name}）`).join('、')}`);
        return undefined;
      }
      warn(ctx, `${path}.girlId`, `角色「${girlId}」不在值夜名册上，已改写为「${fallback}」`);
      girlId = fallback;
    }
    const range: Record<typeof field, [number, number]> = { bond: [-5, 5], fatigue: [-20, 20], corruption: [-5, 5], hp: [-30, 30] };
    return { kind, girlId, field, amount: integer(ctx, body.amount, `${path}.amount`, range[field][0], range[field][1], 0) };
  }
  error(ctx, `${path}.kind`, '不支持的议会变化类型');
  return undefined;
}

function parseChanges(ctx: Ctx, value: unknown, path: string, fallbackGirlId?: string): OpinionChange[] {
  if (!Array.isArray(value)) {
    error(ctx, path, '必须是数组');
    return [];
  }
  return value.map((entry, index) => parseChange(ctx, entry, `${path}[${index}]`, fallbackGirlId)).filter((entry): entry is OpinionChange => Boolean(entry));
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
  if (body.kind === 'truce') {
    return {
      kind: 'truce',
      pair: choice(ctx, body.pair, HOSTILITY_PAIRS, `${path}.pair`, 'association-witch'),
      days: integer(ctx, body.days, `${path}.days`, 5, 20, 10),
    };
  }
  if (body.kind === 'war') {
    return { kind: 'war', pair: choice(ctx, body.pair, HOSTILITY_PAIRS, `${path}.pair`, 'association-witch') };
  }
  if (body.kind === 'join') return { kind: 'join', level: integer(ctx, body.level, `${path}.level`, 1, 5, 1) };
  if (body.kind === 'leave') {
    const girlId = typeof body.girlId === 'string' ? body.girlId : '';
    if (!ctx.activeGirls.some(girl => girl.id === girlId)) error(ctx, `${path}.girlId`, `角色「${girlId}」不在值夜名册上；可用：${ctx.activeGirls.map(girl => `${girl.id}（${girl.name}）`).join('、')}`);
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
  const leaderAuthor = ctx.representatives.some(rep => rep.id === authorId);
  if (option.id === 'defer') {
    if (outcomes.length) error(ctx, path, '暂缓不能包含结构性结果');
    if (otherBonds.length) error(ctx, path, '暂缓只能改动提出者的羁绊');
    for (const change of option.changes ?? []) {
      if (change.kind === 'girl' && change.field === 'bond' && change.girlId === authorId && change.amount === -1) continue;
      if (change.kind === 'faction' && change.faction === faction && change.amount === -2) continue;
      error(ctx, path, '暂缓只能包含提出者羁绊 −1 与所属势力态度 −2');
    }
    if (factionChanges.length !== 1) error(ctx, path, '暂缓必须包含势力态度 −2');
    if (!leaderAuthor && bond.length !== 1) error(ctx, path, '暂缓必须包含提出者羁绊 −1');
    return;
  }
  if (option.id === 'reject') {
    const penalty = materialPenalty(option.changes ?? []);
    if (otherBonds.length) error(ctx, path, '驳回只能改动提出者的羁绊');
    if (!leaderAuthor && (bond.length !== 1 || bond[0].amount !== -2)) error(ctx, path, '驳回必须只包含提出者羁绊 −2');
    if (factionChanges.length !== 1 || !factionChanges.some(change => change.kind === 'faction' && change.faction === faction && change.amount === -4)) {
      error(ctx, path, '驳回必须只包含所属势力态度 −4');
    }
    if (!penalty && !outcomes.some(outcome => outcome.kind === 'war')) error(ctx, path, '驳回必须包含至少一项实际资源惩罚或开战后果');
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
    changes: parseChanges(ctx, body.changes, `${path}.changes`, authorId),
    outcomes: parseOutcomes(ctx, body.outcomes, `${path}.outcomes`),
  };
  validateOption(ctx, option, path, faction, authorId);
  return option;
}

function parseOpinion(ctx: Ctx, value: unknown): NightOpinionSpec {
  const path = 'opinion';
  const body = record(ctx, value, path);
  const authorKind: 'girl' | 'leader' = body.authorKind === 'leader' ? 'leader' : 'girl';
  let authorId = typeof body.authorId === 'string' ? body.authorId : '';
  let authorFaction: FactionId | undefined;
  let representative: FactionRepresentative | undefined;
  let author: Girl | undefined;
  if (authorKind === 'leader') {
    if (body.authorFaction === undefined || body.authorFaction === null) error(ctx, `${path}.authorFaction`, '代表提案必须写明 authorFaction');
    authorFaction = choice(ctx, body.authorFaction, NIGHT_FACTIONS, `${path}.authorFaction`, 'association');
    representative = factionRepresentativeOf(ctx.state, authorFaction);
    if (authorId && authorId !== representative.id) {
      error(ctx, `${path}.authorId`, `代表提案必须使用该方首领 ${representative.id}（${representative.name}）；可用代表：${ctx.representatives.map(rep => `${rep.id}（${rep.name}）`).join('、')}`);
    }
    authorId = representative.id;
  } else {
    author = ctx.activeGirls.find(girl => girl.id === authorId);
    if (!author) error(ctx, `${path}.authorId`, `角色「${authorId}」不在值夜名册上；可用：${ctx.activeGirls.map(girl => `${girl.id}（${girl.name}）`).join('、')}`);
  }
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
      const speakerId = typeof line.speakerId === 'string' ? line.speakerId : author?.id ?? representative?.id;
      const girlSpeaker = ctx.activeGirls.find(girl => girl.id === speakerId);
      const repSpeaker = ctx.representatives.find(rep => rep.id === speakerId);
      if (!speakerId || (!girlSpeaker && !repSpeaker)) {
        error(ctx, `${linePath}.speakerId`, `角色「${speakerId ?? ''}」不在值夜名册或三方代表里；可用：${[...ctx.activeGirls.map(girl => `${girl.id}（${girl.name}）`), ...ctx.representatives.map(rep => `${rep.id}（${rep.name}）`)].join('、')}`);
      }
      const speaker = typeof line.speaker === 'string' && line.speaker.trim()
        ? line.speaker.trim().slice(0, 24)
        : girlSpeaker?.name ?? repSpeaker?.name ?? '提出者';
      dialogue.push({
        speakerId,
        speaker,
        text: text(ctx, line.text, `${linePath}.text`, 240),
        expression: line.expression === undefined ? 'calm' : choice(ctx, line.expression, NIGHT_EXPRESSIONS, `${linePath}.expression`, 'calm'),
      });
    });
  }
  const optionsRaw = body.options;
  if (!Array.isArray(optionsRaw)) error(ctx, `${path}.options`, '必须给出 accept 与 reject 两项');
  const options: OpinionOption[] = [];
  if (Array.isArray(optionsRaw)) {
    // v47：只要 accept / reject 两个分支；defer 由程序固定补，模型写多了也不收。
    const kept = optionsRaw.filter(entry => {
      if (!isRecord(entry)) return false;
      return entry.id === 'accept' || entry.id === 'reject';
    });
    if (kept.length !== 2) error(ctx, `${path}.options`, '必须恰好是 accept 与 reject 两项');
    kept.slice(0, 2).forEach((entry, index) => {
      const option = parseOption(ctx, entry, `${path}.options[${index}]`, faction, author?.id ?? authorId);
      if (option) options.push(option);
    });
  }
  const ids = options.map(option => option.id).sort().join(',');
  if (ids !== 'accept,reject') error(ctx, `${path}.options`, '必须同时包含 accept 与 reject');
  const relations = options.flatMap(option => (option.outcomes ?? [])
    .filter((outcome): outcome is Extract<OpinionOutcome, { kind: 'truce' | 'war' }> => outcome.kind === 'truce' || outcome.kind === 'war')
    .map(outcome => ({ option, outcome })));
  const touchesRelations = relations.length > 0 || options.some(option => (option.changes ?? []).some(change => change.kind === 'hostility'));
  if (touchesRelations && authorKind !== 'leader') error(ctx, `${path}.authorKind`, '停战、开战与敌意变化必须由三方首领提出');
  for (const { option, outcome } of relations) {
    if (!authorFaction || !outcome.pair.split('-').includes(authorFaction)) {
      error(ctx, `${path}.options`, `关系提案的 pair「${outcome.pair}」必须包含提案方 ${authorFaction ?? '（未填写）'}`);
    }
    if (outcome.kind === 'truce' && option.id !== 'accept') error(ctx, `${path}.options`, '停战只能写在 accept 选项里');
    if (outcome.kind === 'war' && option.id !== 'reject') error(ctx, `${path}.options`, '开战只能作为 reject 的后果');
  }
  const acceptOption = options.find(option => option.id === 'accept');
  const spend = Math.abs((acceptOption?.changes ?? [])
    .filter((change): change is Extract<OpinionChange, { kind: 'gold' }> => change.kind === 'gold' && change.amount < 0)
    .reduce((sum, change) => sum + change.amount, 0));
  const cedesDistrict = (acceptOption?.outcomes ?? []).some(outcome => outcome.kind === 'territory');
  if (relations.some(({ outcome }) => outcome.kind === 'truce') && spend < 3000 && !cedesDistrict) {
    error(ctx, `${path}.options`, '停战/换辖区的批准必须至少支付 3000 星砂，或割让一个辖区');
  }
  return {
    authorId: author?.id ?? representative?.id ?? ctx.activeGirls[0]?.id ?? '',
    authorKind, authorFaction,
    topic, faction, district,
    title: text(ctx, body.title, `${path}.title`, 30),
    text: text(ctx, body.text, `${path}.text`, 300),
    request: text(ctx, body.request, `${path}.request`, 160),
    dialogue, options,
  };
}

export function parseMonster(ctx: Ctx, value: unknown): NightMonsterSpec {
  const path = 'monster';
  const body = record(ctx, value, path);
  const stats = parseStats(ctx, body.stats, `${path}.stats`, 30, 110, 60);
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
    // v25 起心防不再单独给数：它等于共情 × 2，由 stats 推出。
    maxSpirit: stats.empathy * 2,
    stats,
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
    appearance: text(ctx, body.appearance, `${path}.appearance`, 200),
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
    representatives: FACTION_ORDER.map(faction => factionRepresentativeOf(state, faction)),
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
  const opinionRows = Array.isArray(raw.opinions)
    ? raw.opinions.slice(0, 3)
    : raw.opinion ? [raw.opinion] : [];
  const opinions = opinionRows.map(row => parseOpinion(ctx, row));
  const proposal: NightProposalV2 = {
    version: 2,
    monster: undefined,
    candidate: raw.candidate ? parseCandidate(ctx, raw.candidate) : undefined,
    mission: parseMission(ctx, raw.mission, 'mission'),
    opinion: opinions[0],
    opinions,
    envoy: { ...envoy, faction: choice(ctx, envoyBody.faction, NIGHT_FACTIONS, 'envoy.faction', 'association') },
    loot,
  };
  if (!raw.mission) error(ctx, 'mission', '缺少委托');
  if (!opinions.length) error(ctx, 'opinions', '缺少议会提案');
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
    representatives: FACTION_ORDER.map(faction => {
      const rep = factionRepresentativeOf(state, faction);
      return { id: rep.id, name: rep.name, title: rep.title, faction, level: rep.level };
    }),
    girls: active.map(girl => ({
      id: girl.id, name: girl.name, title: girl.title, element: girl.element, archetype: girl.archetype,
      level: girl.level, bond: girl.bond, fatigue: girl.fatigue, corruption: girl.corruption,
      origin: factionTagLabel(girl.factionTag),
      // 契约卡带回来的性格与外貌也要给模型：不然它只能照着旧内置角色编。
      personality: clipLine(girl.personality, 120), appearance: clipLine(girl.appearance, 120), quote: clipLine(girl.quote, 60),
    })),
    itemTiers: [1, 2, 3, 4, 5].map(tier => {
      const bag = [...listItems(), ...state.generatedItems].filter(item => tierOf(item) === tier && item.slot !== 'consumable');
      return { tier, count: bag.length, examples: bag.slice(0, 3).map(item => item.name) };
    }).filter(row => row.count > 0),
    pool: {
      missions: Math.max(0, state.poolLimits.missions - state.missions.filter(mission => mission.status !== 'done').length),
      monsters: Math.max(0, state.poolLimits.monsters - state.customMonsters.filter(monster => !monster.id.startsWith('boss-mon-')).length),
      candidates: Math.max(0, state.poolLimits.candidates - state.candidates.length),
    },
    city: {
      briefs: NIGHT_FACTIONS.map(id => factionBrief(id, state.factions[id].standing, factionRepresentativeOf(state, id))),
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


function clipLine(text: string | undefined, limit: number): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

/** 默认 daily 分区（预设还没绑定时、以及测试里的兜底）：用 DEFAULT_PROMPTS 里的默认文本渲染。 */
export function composeDailySections(ctx: { state: GameState }): string[] {
  const entries = DEFAULT_PROMPTS.filter(entry => entry.scope === 'daily');
  const rendered = renderPresetSystem(entries, {}, ctx);
  return [rendered.system];
}

/** 提案的锁定契约：只有解析器需要的 JSON 骨架与整数要求。其余文字在预设的 daily 分区里。 */
export function dailyContract(): string {
  return [
    '【JSON 形状】只输出一个 JSON 对象，不要 Markdown 代码块：',
    JSON.stringify(NIGHT_SCHEMA_EXAMPLE),
    '',
    '把空字符串替换成与今晚局势一致的文案；保持字段完整；所有数值必须是整数。',
  ].join('\n');
}

/** 兼容旧调用与测试：默认 daily 分区 + 锁定契约拼出来的系统提示。 */
export function buildNightPrompt(state: GameState): string {
  const parts = composeDailySections({ state }).map(part => part.trim()).filter(Boolean);
  parts.push(dailyContract());
  return parts.join('\n\n');
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
  const items: Equipment[] = [];
  proposal.loot.forEach((loot, index) => {
    // v47：按阶级抽到的成品直接从物品表来，不再新造一件。
    if (loot.itemId) { ids.set(loot.ref, loot.itemId); return; }
    const id = `lm_item_${stamp}_${index}`;
    ids.set(loot.ref, id);
    items.push({
      id, name: loot.name, faction: loot.faction, slot: loot.slot,
      price: 0, standingReq: 0, description: loot.description,
      stats: loot.stats, passive: loot.passive,
    } as Equipment);
  });
  return { ids, items };
}

/** 把已校验的模型提案变成真正的运行时对象；模型数值不再被固定模板覆盖。 */
/** 把已校验的模型提案变成运行时对象；v32 起不再生成新魔物，敌人只从现有魔物池里选。 */
export function materializeNightProposal(proposal: NightProposalV2, state: GameState): {
  girl?: Girl; mission: Mission; opinion: Opinion; opinions: Opinion[]; envoyMission: Mission;
  items: ReturnType<typeof materializeLoot>['items'];
} {
  const pack = createSeedPack();
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 999).toString(36)}`;
  const loot = materializeLoot(proposal, stamp);
  const enemyPool = [...monsters, ...(state.customMonsters ?? [])].filter(monster =>
    monster && !monster.storyOnly && !monster.bossOnly && !monster.id.startsWith('boss-mon-') && !(state.removedMonsters ?? []).includes(monster.id),
  );
  const resolveEnemyRefs = (refs: string[], salt: number): string[] => {
    const valid = refs.filter(ref => ref !== 'generated' && enemyPool.some(monster => monster.id === ref)).slice(0, MAX_ENEMIES);
    if (valid.length) return valid;
    if (!enemyPool.length) return [];
    const picks: string[] = [];
    for (let index = 0; index < Math.min(2, enemyPool.length); index += 1) {
      const pick = enemyPool[(salt + index) % enemyPool.length];
      if (pick && !picks.includes(pick.id)) picks.push(pick.id);
    }
    return picks;
  };
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
    enemyIds: resolveEnemyRefs(missionSpec.enemyRefs, state.missions.length),
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
  const specs = (proposal.opinions?.length ? proposal.opinions : proposal.opinion ? [proposal.opinion] : []).slice(0, 3);
  const opinions = specs.map((spec, index) => {
    const leaderAuthor = spec.authorKind === 'leader' && spec.authorFaction
      ? factionRepresentativeOf(state, spec.authorFaction)
      : undefined;
    const author = leaderAuthor
      ?? state.girls.find(girl => girl.id === spec.authorId && !girl.retired && !girl.dead)
      ?? [...state.girls].filter(girl => !girl.retired && !girl.dead).sort((a, b) => b.bond - a.bond)[0]
      ?? state.girls[0];
    const options = spec.options.map((option, optionIndex) => ({
      ...option,
      changes: option.changes?.map(change => change.kind === 'item'
        ? { ...change, itemId: mapItemRef(change.itemId, loot.ids) ?? change.itemId }
        : change),
      outcomes: option.outcomes?.map((outcome, outcomeIndex) => outcome.kind === 'mission'
        ? { ...outcome, template: mapMissionTemplate(outcome.template, `${stamp}_${index}`, optionIndex * 10 + outcomeIndex, loot.ids) }
        : outcome),
    })) as OpinionOption[];
    // v47：模型只写 accept / reject，「暂缓」由程序固定补一条，界面仍是三个按钮。
    if (!options.some(option => option.id === 'defer')) {
      options.splice(1, 0, {
        id: 'defer',
        label: '暂缓',
        effect: '把这条议题推到下个议事日再谈。',
        changes: [
          { kind: 'girl', girlId: author?.id ?? spec.authorId, field: 'bond', amount: -1 },
          { kind: 'faction', faction: spec.faction, amount: -2 },
        ],
        outcomes: [],
      } as OpinionOption);
    }
    return {
      id: `op_${stamp}_${index}`,
      day: state.day,
      authorId: author?.id ?? spec.authorId,
      authorKind: spec.authorKind ?? 'girl',
      authorFaction: spec.authorFaction,
      topic: spec.topic,
      title: spec.title,
      text: spec.text,
      request: spec.request,
      status: 'pending',
      faction: spec.faction,
      options,
      dialogue: spec.dialogue.map(line => ({
        ...line,
        speakerId: line.speakerId ?? author?.id,
        speaker: line.speaker || author?.name || '提出者',
      })),
      assistantNote: '这份议题的文案、选项、消耗与后果由叙事引擎起草，并经本地规则校验。',
    } satisfies Opinion;
  });
  const opinion = opinions[0]!;
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
    enemyIds: resolveEnemyRefs(envoySpec.enemyRefs, state.missions.length + 1),
    district: envoySpec.district,
    window: envoySpec.window,
    rewardEquipmentId: mapItemRef(envoySpec.rewardItemRef, loot.ids),
    rewardGirlLevel: envoySpec.rewardGirlLevel,
    x: (mission.x + 31) % 78 + 8,
    y: (mission.y + 19) % 58 + 12,
  };
  return { mission, opinion, opinions, envoyMission, items: loot.items };
}
