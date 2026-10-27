import type { Element, Equipment, FactionId, GameState, MarketStockEntry, MissionTemplate, MonsterRule, MonsterTemplate, Skill, SkillEffect, SkillResource, SkillSide, SkillTier, StatKey } from '../types.ts';
import { districts } from '../districts.ts';
import { skillById, skills } from './skills.ts';
import { itemById, items } from './items.ts';
import { monsterById, monsters } from './monsters.ts';

export const LIBRARY_KEY = 'night-sugar:content:v1';
export const CUSTOM_PREFIX = 'custom-';
export const LIBRARY_SCHEMA = 1;
export const STAT_KEYS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];

export interface ContentLibrary {
  schemaVersion: number;
  updatedAt: string;
  skills: Skill[];
  items: Equipment[];
  monsters: MonsterTemplate[];
  missions: MissionTemplate[];
}

export const emptyLibrary = (): ContentLibrary => ({ schemaVersion: LIBRARY_SCHEMA, updatedAt: new Date().toISOString(), skills: [], items: [], monsters: [], missions: [] });

const FACTION_IDS: FactionId[] = ['witch', 'association', 'government'];
const ELEMENTS: Element[] = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物'];
const RANKS: MonsterTemplate['rank'][] = ['碎屑', '游荡', '灾厄', '王座'];
const BODY_PLANS: MonsterTemplate['spec']['bodyPlan'][] = ['moth', 'feline', 'humanoid', 'machine', 'swarm', 'orb'];
const CORES: MonsterTemplate['spec']['core'][] = ['眼', '心', '钟', '糖', '月'];
const AURAS: MonsterTemplate['spec']['aura'][] = ['静电', '余烬', '花瓣', '故障'];
const MOTIFS: MonsterTemplate['spec']['motif'][] = ['猫', '糖', '星', '月', '蝶', '钟'];
const EFFECT_KINDS: SkillEffect['kind'][] = ['dot', 'stun', 'shield', 'buff', 'debuff', 'regen'];
const EFFECT_STATS: NonNullable<SkillEffect['stat']>[] = [...STAT_KEYS, 'hit', 'initiative'];
const ITEM_SLOTS: Equipment['slot'][] = ['weapon', 'charm', 'consumable'];
const ITEM_EFFECTS: NonNullable<Equipment['effect']>[] = ['drug', 'heal', 'purify', 'contractDiscount', 'taxRefund'];
const RULE_TRIGGERS: MonsterRule['trigger'][] = ['roundStart', 'hit', 'always'];
const RULE_EFFECTS: MonsterRule['effect'][] = ['heal', 'buff', 'haste', 'debuffAttacker', 'dot', 'immuneStun', 'damageReduce'];
const RULE_STATS: NonNullable<MonsterRule['stat']>[] = [...STAT_KEYS, 'hit'];
const MISSION_DIFFICULTIES: MissionTemplate['difficulty'][] = ['低危', '中危', '高危', '绝望'];
const MISSION_WORKS: MissionTemplate['work'][] = ['combat', 'investigation'];
const MISSION_WINDOWS: NonNullable<MissionTemplate['window']>[] = ['urgent', 'long'];

const clamp = (min: number, max: number, value: number) => Math.max(min, Math.min(max, value));
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const number = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? clamp(min, max, parsed) : fallback;
};
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);
const customId = (value: unknown, kind: string) => {
  const id = typeof value === 'string' ? value.trim() : '';
  return id.startsWith(`${CUSTOM_PREFIX}${kind}-`) && /^[a-z0-9-]{6,64}$/.test(id) ? id : '';
};
const color = (value: unknown, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value) : fallback);

export function newContentId(kind: 'skill' | 'item' | 'monster' | 'mission'): string {
  const stamp = Date.now().toString(36);
  const salt = Math.floor(Math.random() * 46656).toString(36).padStart(3, '0');
  return `${CUSTOM_PREFIX}${kind}-${stamp}${salt}`;
}

export function emptySkill(): Skill {
  return {
    id: newContentId('skill'), name: '未命名技能', school: '自制', resource: 'hp', power: 1,
    targets: 1, side: 'enemy', cooldown: 0, tier: 'basic', effects: [], description: '',
  };
}

export function emptyItem(): Equipment {
  return {
    id: newContentId('item'), name: '未命名装备', faction: 'witch', slot: 'charm', price: 800,
    standingReq: 0, description: '', passive: '', stats: {},
  };
}

export function emptyMonster(): MonsterTemplate {
  return {
    id: newContentId('monster'), name: '未命名魔物', epithet: '尚未命名的回声', rank: '碎屑', element: '魔物',
    color: '#c9a7e8', maxHp: 120, maxSpirit: 80,
    stats: { magic: 55, insight: 55, agility: 55, empathy: 45 }, skillIds: ['monster-claw'],
    trait: '', description: '', rules: [],
    spec: {
      bodyPlan: 'orb', scale: 1, appendages: 3, core: '眼',
      palette: { body: '#34283f', shade: '#191221', rim: '#d9c2f2' }, aura: '故障', motif: '星',
    },
    codex: { habit: '', weakness: '' },
  };
}

export function emptyMission(): MissionTemplate {
  return {
    id: newContentId('mission'), title: '未命名委托', category: '民间琐事',
    description: '', difficulty: '中危', duration: 60, requirement: 'insight', target: 60,
    work: 'investigation', enemyIds: [], rounds: 3, recommendedLevel: 3,
    window: 'urgent', reward: 600, color: '#c9a7e8',
  };
}

export function sanitizeEffect(raw: unknown): SkillEffect | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const kind = oneOf(value.kind, EFFECT_KINDS, 'dot');
  const effect: SkillEffect = {
    kind,
    amount: Math.round(number(value.amount, kind === 'shield' ? 10 : 6, 0, 200)),
    duration: Math.round(number(value.duration, 1, 1, 9)),
  };
  if (EFFECT_STATS.includes(value.stat as NonNullable<SkillEffect['stat']>)) effect.stat = value.stat as NonNullable<SkillEffect['stat']>;
  if (value.chance !== undefined) effect.chance = number(value.chance, 1, 0, 1);
  return effect;
}

export function sanitizeSkill(raw: unknown): Skill | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const id = customId(value.id, 'skill');
  if (!id) return undefined;
  const name = text(value.name, 24);
  if (!name) return undefined;
  const effects = Array.isArray(value.effects) ? value.effects.map(sanitizeEffect).filter((e): e is SkillEffect => Boolean(e)).slice(0, 6) : [];
  return {
    id, name,
    school: text(value.school, 16) || '自制',
    resource: oneOf<SkillResource>(value.resource, ['hp', 'spirit'], 'hp'),
    power: number(value.power, 1, 0.1, 3),
    targets: Math.round(number(value.targets, 1, 1, 4)),
    side: oneOf<SkillSide>(value.side, ['enemy', 'ally', 'self'], 'enemy'),
    cooldown: Math.round(number(value.cooldown, 0, 0, 10)),
    tier: oneOf<SkillTier>(value.tier, ['basic', 'signature', 'ultimate'], 'basic'),
    effects,
    description: text(value.description, 400),
  };
}

export function sanitizeItem(raw: unknown, skillPool: Set<string> = new Set(skillById.keys())): Equipment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const id = customId(value.id, 'item');
  if (!id) return undefined;
  const name = text(value.name, 24);
  if (!name) return undefined;
  const stats: Partial<Record<StatKey, number>> = {};
  if (value.stats && typeof value.stats === 'object') {
    for (const key of STAT_KEYS) {
      const amount = number((value.stats as Record<string, unknown>)[key], 0, -20, 40);
      if (amount) stats[key] = Math.round(amount);
    }
  }
  const item: Equipment = {
    id, name,
    faction: oneOf<FactionId>(value.faction, FACTION_IDS, 'witch'),
    slot: oneOf<Equipment['slot']>(value.slot, ITEM_SLOTS, 'charm'),
    price: Math.round(number(value.price, 800, 0, 100000)),
    standingReq: Math.round(number(value.standingReq, 0, 0, 100)),
    description: text(value.description, 400),
  };
  if (value.passive) item.passive = text(value.passive, 120);
  if (Object.keys(stats).length) item.stats = stats;
  if (typeof value.skillId === 'string' && skillPool.has(value.skillId)) item.skillId = value.skillId;
  if (value.corruptionPerBattle !== undefined) item.corruptionPerBattle = Math.round(number(value.corruptionPerBattle, 0, -20, 20));
  if (value.maxHpBonus !== undefined) item.maxHpBonus = Math.round(number(value.maxHpBonus, 0, 0, 300));
  if (value.spiritBonus !== undefined) item.spiritBonus = Math.round(number(value.spiritBonus, 0, 0, 200));
  if (value.effect !== undefined) item.effect = oneOf(value.effect, ITEM_EFFECTS, 'heal');
  if (value.amount !== undefined) item.amount = Math.round(number(value.amount, 0, 0, 5000));
  return item;
}

export function sanitizeRule(raw: unknown): MonsterRule | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const trigger = oneOf<MonsterRule['trigger']>(value.trigger, RULE_TRIGGERS, 'roundStart');
  const effect = oneOf<MonsterRule['effect']>(value.effect, RULE_EFFECTS, 'heal');
  const rule: MonsterRule = { trigger, effect };
  if (['heal', 'buff', 'haste', 'debuffAttacker', 'dot', 'damageReduce'].includes(effect)) {
    rule.amount = Math.round(number(value.amount, effect === 'damageReduce' ? 15 : 4, 0, effect === 'damageReduce' ? 90 : 200));
  }
  if (effect === 'buff' || effect === 'debuffAttacker') rule.stat = oneOf<NonNullable<MonsterRule['stat']>>(value.stat, RULE_STATS, effect === 'buff' ? 'magic' : 'hit');
  if (effect === 'buff' || effect === 'debuffAttacker' || effect === 'dot') rule.duration = Math.round(number(value.duration, effect === 'dot' ? 1 : 2, 1, 99));
  if (value.belowHpPct !== undefined) rule.belowHpPct = number(value.belowHpPct, 0.5, 0.1, 1);
  if (effect === 'heal' && value.unlessEmpathyDamage === true) rule.unlessEmpathyDamage = true;
  return rule;
}

export function sanitizeMonster(raw: unknown, skillPool: Set<string> = new Set(skillById.keys())): MonsterTemplate | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const id = customId(value.id, 'monster');
  if (!id) return undefined;
  const name = text(value.name, 24);
  if (!name) return undefined;
  const stats = {} as Record<StatKey, number>;
  for (const key of STAT_KEYS) stats[key] = Math.round(number((value.stats as Record<string, unknown> | undefined)?.[key], 55, 1, 200));
  const specRaw = (value.spec && typeof value.spec === 'object' ? value.spec : {}) as Record<string, unknown>;
  const paletteRaw = (specRaw.palette && typeof specRaw.palette === 'object' ? specRaw.palette : {}) as Record<string, unknown>;
  const codexRaw = (value.codex && typeof value.codex === 'object' ? value.codex : {}) as Record<string, unknown>;
  const skillIds = Array.isArray(value.skillIds)
    ? [...new Set(value.skillIds.filter((entry): entry is string => typeof entry === 'string' && skillPool.has(entry)))].slice(0, 6)
    : [];
  const rules = Array.isArray(value.rules) ? value.rules.map(sanitizeRule).filter((rule): rule is MonsterRule => Boolean(rule)).slice(0, 6) : [];
  return {
    id, name,
    epithet: text(value.epithet, 30),
    rank: oneOf<MonsterTemplate['rank']>(value.rank, RANKS, '碎屑'),
    element: oneOf<Element>(value.element, ELEMENTS, '魔物'),
    color: color(value.color, '#c9a7e8'),
    maxHp: Math.round(number(value.maxHp, 120, 10, 2000)),
    maxSpirit: Math.round(number(value.maxSpirit, 80, 0, 500)),
    stats,
    skillIds: skillIds.length ? skillIds : ['monster-claw'],
    trait: text(value.trait, 200),
    description: text(value.description, 800),
    spec: {
      bodyPlan: oneOf(specRaw.bodyPlan, BODY_PLANS, 'orb'),
      scale: number(specRaw.scale, 1, 0.4, 2),
      appendages: Math.round(number(specRaw.appendages, 3, 0, 10)),
      core: oneOf(specRaw.core, CORES, '眼'),
      palette: {
        body: color(paletteRaw.body, '#34283f'),
        shade: color(paletteRaw.shade, '#191221'),
        rim: color(paletteRaw.rim, '#d9c2f2'),
      },
      aura: oneOf(specRaw.aura, AURAS, '故障'),
      motif: oneOf(specRaw.motif, MOTIFS, '星'),
    },
    codex: { habit: text(codexRaw.habit, 200), weakness: text(codexRaw.weakness, 200) },
    rules,
  };
}

export function sanitizeMission(raw: unknown, monsterPool: Set<string> = new Set(monsterById.keys())): MissionTemplate | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const id = customId(value.id, 'mission');
  if (!id) return undefined;
  const title = text(value.title, 24);
  if (!title) return undefined;
  const work = oneOf<MissionTemplate['work']>(value.work, MISSION_WORKS, 'investigation');
  const enemyIds = Array.isArray(value.enemyIds)
    ? [...new Set(value.enemyIds.filter((entry): entry is string => typeof entry === 'string' && monsterPool.has(entry)))].slice(0, 3)
    : [];
  if (work === 'combat' && enemyIds.length === 0) {
    const fallback = monsterPool.has('monster-claw') ? 'monster-claw' : [...monsterPool][0];
    if (!fallback) return undefined;
    enemyIds.push(fallback);
  }
  const district = typeof value.district === 'string' && value.district in districts ? value.district as MissionTemplate['district'] : undefined;
  return {
    id, title,
    category: text(value.category, 16) || '民间琐事',
    description: text(value.description, 300),
    difficulty: oneOf<MissionTemplate['difficulty']>(value.difficulty, MISSION_DIFFICULTIES, '中危'),
    duration: Math.round(number(value.duration, 60, 15, 240) / 15) * 15,
    requirement: oneOf<StatKey>(value.requirement, STAT_KEYS, 'insight'),
    target: Math.round(number(value.target, 60, 30, 120)),
    work,
    enemyIds,
    rounds: Math.round(number(value.rounds, 3, 2, 8)),
    recommendedLevel: Math.round(number(value.recommendedLevel, 3, 1, 12)),
    district,
    window: value.window === undefined ? undefined : oneOf<NonNullable<MissionTemplate['window']>>(value.window, MISSION_WINDOWS, 'urgent'),
    reward: Math.round(number(value.reward, 600, 0, 5000)),
    color: color(value.color, '#c9a7e8'),
  };
}

export function sanitizeLibrary(raw: unknown): ContentLibrary {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const dedupe = <T extends { id: string }>(list: (T | undefined)[]): T[] => {
    const seen = new Set<string>();
    return list.filter((entry): entry is T => {
      if (!entry || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
  };
  const cleanSkills = dedupe(Array.isArray(value.skills) ? value.skills.map(sanitizeSkill) : []);
  const skillPool = new Set([...skillById.keys(), ...cleanSkills.map(skill => skill.id)]);
  const cleanMonsters = dedupe(Array.isArray(value.monsters) ? value.monsters.map(entry => sanitizeMonster(entry, skillPool)) : []);
  const monsterPool = new Set([...monsterById.keys(), ...cleanMonsters.map(monster => monster.id)]);
  return {
    schemaVersion: LIBRARY_SCHEMA,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    skills: cleanSkills,
    items: dedupe(Array.isArray(value.items) ? value.items.map(entry => sanitizeItem(entry, skillPool)) : []),
    monsters: cleanMonsters,
    missions: dedupe(Array.isArray(value.missions) ? value.missions.map(entry => sanitizeMission(entry, monsterPool)) : []),
  };
}

export function loadLibrary(raw?: string | null): ContentLibrary {
  let source = raw;
  if (source === undefined) {
    try { source = typeof localStorage === 'undefined' ? null : localStorage.getItem(LIBRARY_KEY); } catch { source = null; }
  }
  if (!source) return emptyLibrary();
  try { return sanitizeLibrary(JSON.parse(source)); } catch { return emptyLibrary(); }
}

export function saveLibrary(library: ContentLibrary): ContentLibrary {
  const clean = sanitizeLibrary({ ...library, updatedAt: new Date().toISOString() });
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(clean)); } catch { /* 无 localStorage 时只保留内存注册 */ }
  return clean;
}

function purgeCustom<T extends { id: string }>(list: T[], map: Map<string, T>): void {
  for (let index = list.length - 1; index >= 0; index--) {
    if (!list[index].id.startsWith(CUSTOM_PREFIX)) continue;
    map.delete(list[index].id);
    list.splice(index, 1);
  }
}

let currentMissions: MissionTemplate[] = [];

/** 把内容库同步进运行期注册表；重复调用会替换同名自制条目。 */
export function applyLibrary(library: ContentLibrary): void {
  const clean = sanitizeLibrary(library);
  purgeCustom(skills, skillById);
  purgeCustom(items, itemById);
  purgeCustom(monsters, monsterById);
  for (const skill of clean.skills) { skills.push(skill); skillById.set(skill.id, skill); }
  for (const item of clean.items) { items.push(item); itemById.set(item.id, item); }
  for (const monster of clean.monsters) { monsters.push(monster); monsterById.set(monster.id, monster); }
  currentMissions = [...clean.missions];
}

/** 当前注册的自制委托模板；game.ts 的轮转池会追加它们。 */
export function customMissionTemplates(): MissionTemplate[] {
  return [...currentMissions];
}

export function initContentLibrary(): ContentLibrary {
  const library = loadLibrary();
  applyLibrary(library);
  return library;
}

/** 把自制装备补进当前货架；已存在的条目保持售罄状态。 */
export function withCustomStock(stock: MarketStockEntry[]): MarketStockEntry[] {
  const custom = items.filter(item => item.id.startsWith(CUSTOM_PREFIX));
  const customIds = new Set(custom.map(item => item.id));
  const kept = stock.filter(entry => !entry.itemId.startsWith(CUSTOM_PREFIX) || customIds.has(entry.itemId));
  for (const item of custom) {
    if (kept.some(entry => entry.itemId === item.id)) continue;
    kept.push({ id: `stock-custom-${item.id}`, itemId: item.id, faction: item.faction, sold: false });
  }
  return kept;
}

export type WorkshopKind = 'skill' | 'item' | 'monster' | 'mission';

/** 删除前检查当前存档里的引用，避免把正在使用的技能/装备/魔物删掉。 */
export function contentUsage(state: GameState, kind: WorkshopKind, id: string): string[] {
  const used: string[] = [];
  if (kind === 'skill') {
    if (state.girls.some(girl => girl.skills.includes(id) || girl.skill === id)) used.push('契约者技能栏');
    if (items.some(item => item.skillId === id)) used.push('装备附带技能');
  }
  if (kind === 'item') {
    if ((state.inventory[id] ?? 0) > 0) used.push('仓库库存');
    if (state.girls.some(girl => girl.equipment.weapon === id || girl.equipment.charm === id)) used.push('契约者装备');
  }
  if (kind === 'monster') {
    if (state.missions.some(mission => mission.enemyIds?.includes(id))) used.push('当前委托');
    if (state.battles.some(battle => battle.units.some(unit => unit.monster?.id === id))) used.push('战斗记录');
  }
  if (kind === 'mission') {
    if (state.missions.some(mission => mission.templateId === id)) used.push('当前夜晚的委托');
  }
  return used;
}

export function ruleText(rule: MonsterRule): string {
  const amount = rule.amount ?? 0;
  switch (rule.effect) {
    case 'heal': return `每轮开始恢复 ${amount} 点生命${rule.unlessEmpathyDamage ? '（受共情伤害的回合不触发）' : ''}`;
    case 'buff': return `每轮开始若血量低于 ${Math.round((rule.belowHpPct ?? 0) * 100) || 100}%，${rule.stat ?? 'magic'} +${amount}`;
    case 'haste': return `每轮开始速度 +${amount}`;
    case 'debuffAttacker': return `被击中时攻击者${rule.stat === 'hit' ? '命中' : rule.stat ?? '命中'} -${amount}，持续 ${rule.duration ?? 1} 轮`;
    case 'dot': return `被击中时向攻击者附加 ${amount} 点持续伤害，持续 ${rule.duration ?? 1} 轮`;
    case 'immuneStun': return '免疫眩晕';
    case 'damageReduce': return `受到的伤害减免 ${amount}%`;
    default: return '未设置';
  }
}

export function libraryCounts(library: ContentLibrary): string {
  return `技能 ${library.skills.length} · 装备 ${library.items.length} · 魔物 ${library.monsters.length} · 委托 ${library.missions.length}`;
}
