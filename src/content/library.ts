import type { Element, Equipment, FactionId, GameState, IncidentCard, IncidentCardEffect, IncidentEffect, MarketStockEntry, MissionTemplate, MonsterRule, MonsterTemplate, Skill, SkillEffect, SkillResource, SkillSide, SkillTier, StatKey } from '../types.ts';
import { districts } from '../districts.ts';
import { skillById, skills } from './skills.ts';
import { itemById, items } from './items.ts';
import { monsterById, monsters } from './monsters.ts';
import { findEffectPreset } from './effectPresets.ts';

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
  incidents: IncidentCard[];
}

export const emptyLibrary = (): ContentLibrary => ({ schemaVersion: LIBRARY_SCHEMA, updatedAt: new Date().toISOString(), skills: [], items: [], monsters: [], missions: [], incidents: [] });

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
const INCIDENT_KINDS: IncidentCard['kind'][] = ['faction', 'environment', 'girl'];
const INCIDENT_TRIGGERS: IncidentCard['trigger'][] = ['manual', 'pool'];

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

export function newContentId(kind: 'skill' | 'item' | 'monster' | 'mission' | 'incident'): string {
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
    id: newContentId('mission'), title: '未命名调查委托', category: '民间琐事',
    description: '', difficulty: '中危', duration: 60, requirement: 'insight', target: 60,
    work: 'investigation', enemyIds: [], rounds: 3, recommendedLevel: 3,
    window: 'urgent', reward: 600, rewardGirlLevel: 0, color: '#c9a7e8',
  };
}

/** 调查委托：目标值与判定属性是核心，不需要敌人和战斗轮数。 */
export function emptyInvestigationMission(): MissionTemplate {
  return { ...emptyMission(), work: 'investigation' };
}

/** 战斗委托：敌人与轮数是核心，目标值只是生成时的占位。 */
export function emptyCombatMission(): MissionTemplate {
  return {
    ...emptyMission(),
    title: '未命名战斗委托', work: 'combat', requirement: 'magic', target: 60,
    enemyIds: [], rounds: 3, duration: 60,
  };
}

export function emptyIncidentCard(): IncidentCard {
  return {
    id: newContentId('incident'), title: '未命名弹窗', body: '夜色里有人敲了敲门，留下一个必须现在决定的问题。',
    kind: 'environment', options: [
      { id: 'opt-1', label: '先听听看', hint: '把话听完', effect: { gold: -120, girl: { bond: 2 } } },
      { id: 'opt-2', label: '让她离开', hint: '不惹麻烦', effect: { reputation: -1 } },
    ],
    trigger: 'manual', weight: 5, oncePerDay: false, source: 'custom',
  };
}

export function sanitizeEffect(raw: unknown): SkillEffect | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const preset = findEffectPreset(typeof value.preset === 'string' ? value.preset : undefined);
  const kind = preset?.effect.kind ?? oneOf(value.kind, EFFECT_KINDS, 'dot');
  const effect: SkillEffect = {
    kind,
    amount: Math.round(number(value.amount, preset?.effect.amount ?? (kind === 'shield' ? 10 : 6), 0, 200)),
    duration: Math.round(number(value.duration, preset?.effect.duration ?? 1, 1, 9)),
  };
  if (preset) {
    effect.preset = preset.id;
    effect.label = preset.name;
    effect.category = preset.category;
    if (preset.effect.stat) effect.stat = preset.effect.stat;
  } else if (EFFECT_STATS.includes(value.stat as NonNullable<SkillEffect['stat']>)) {
    effect.stat = value.stat as NonNullable<SkillEffect['stat']>;
  }
  if (value.chance !== undefined) effect.chance = number(value.chance, preset?.effect.chance ?? 1, 0, 1);
  else if (preset?.effect.chance !== undefined) effect.chance = preset.effect.chance;
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
  if (value.damageBonus !== undefined) item.damageBonus = Math.round(number(value.damageBonus, 0, 0, 100));
  if (value.initiativeBonus !== undefined) item.initiativeBonus = Math.round(number(value.initiativeBonus, 0, 0, 100));
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

export function sanitizeMission(raw: unknown, monsterPool: Set<string> = new Set(monsterById.keys()), itemPool: Set<string> = new Set(itemById.keys())): MissionTemplate | undefined {
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
  const rewardEquipmentId = typeof value.rewardEquipmentId === 'string' && itemPool.has(value.rewardEquipmentId)
    ? value.rewardEquipmentId
    : undefined;
  const rewardGirlLevel = Math.round(number(value.rewardGirlLevel, 0, 0, 12));
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
    rewardEquipmentId,
    rewardGirlLevel: rewardGirlLevel > 0 ? rewardGirlLevel : undefined,
    color: color(value.color, '#c9a7e8'),
  };
}

export function sanitizeIncidentEffect(raw: unknown): IncidentCardEffect {
  const effect: IncidentCardEffect = {};
  if (!raw || typeof raw !== 'object') return effect;
  const value = raw as Record<string, unknown>;
  const gold = Math.round(number(value.gold, 0, -3000, 3000));
  if (gold) effect.gold = gold;
  const reputation = Math.round(number(value.reputation, 0, -10, 10));
  if (reputation) effect.reputation = reputation;
  if (value.faction && typeof value.faction === 'object') {
    const record = value.faction as Record<string, unknown>;
    const standing = Math.round(number(record.standing, 0, -20, 20));
    if (standing && FACTION_IDS.includes(record.id as FactionId)) effect.faction = { id: record.id as FactionId, standing };
  }
  if (value.girl && typeof value.girl === 'object') {
    const record = value.girl as Record<string, unknown>;
    const girl: NonNullable<IncidentEffect['girl']> = {};
    const fatigue = Math.round(number(record.fatigue, 0, -50, 50));
    const spirit = Math.round(number(record.spirit, 0, -50, 50));
    const corruption = Math.round(number(record.corruption, 0, -20, 20));
    const bond = Math.round(number(record.bond, 0, -10, 10));
    if (fatigue) girl.fatigue = fatigue;
    if (spirit) girl.spirit = spirit;
    if (corruption) girl.corruption = corruption;
    if (bond) girl.bond = bond;
    if (Object.keys(girl).length) effect.girl = girl;
  }
  if (value.district && typeof value.district === 'object') {
    const record = value.district as Record<string, unknown>;
    if (typeof record.id === 'string' && record.id in districts) {
      const district: NonNullable<IncidentCardEffect['district']> = { id: record.id as NonNullable<IncidentCardEffect['district']>['id'], days: Math.round(number(record.days, 1, 1, 7)) };
      const targetPct = Math.round(number(record.targetPct, 0, -30, 30));
      const rewardPct = Math.round(number(record.rewardPct, 0, -30, 30));
      if (targetPct) district.targetPct = targetPct;
      if (rewardPct) district.rewardPct = rewardPct;
      effect.district = district;
    }
  }
  if (value.territory && typeof value.territory === 'object') {
    const record = value.territory as Record<string, unknown>;
    if (typeof record.id === 'string' && record.id in districts && FACTION_IDS.includes(record.faction as FactionId)) {
      effect.territory = { id: record.id as NonNullable<IncidentCardEffect['territory']>['id'], faction: record.faction as FactionId };
    }
  }
  return effect;
}

export function sanitizeIncidentCard(raw: unknown): IncidentCard | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const id = customId(value.id, 'incident');
  if (!id) return undefined;
  const title = text(value.title, 30);
  const body = text(value.body, 600);
  if (!title || !body) return undefined;
  const options: IncidentCard['options'] = [];
  if (Array.isArray(value.options)) {
    value.options.slice(0, 3).forEach((entry, index) => {
      if (!entry || typeof entry !== 'object') return;
      const option = entry as Record<string, unknown>;
      const label = text(option.label, 20);
      if (!label) return;
      options.push({ id: `opt-${index + 1}`, label, hint: text(option.hint, 60), effect: sanitizeIncidentEffect(option.effect) });
    });
  }
  if (options.length < 2) return undefined;
  const faction = FACTION_IDS.includes(value.faction as FactionId) ? value.faction as FactionId : undefined;
  const district = typeof value.district === 'string' && value.district in districts ? value.district as NonNullable<IncidentCard['district']> : undefined;
  return {
    id, title, body,
    kind: oneOf<IncidentCard['kind']>(value.kind, INCIDENT_KINDS, 'environment'),
    faction, district,
    girlId: typeof value.girlId === 'string' && value.girlId.trim() ? value.girlId.trim().slice(0, 64) : undefined,
    options,
    trigger: oneOf<IncidentCard['trigger']>(value.trigger, INCIDENT_TRIGGERS, 'manual'),
    weight: Math.round(number(value.weight, 5, 1, 20)),
    oncePerDay: value.oncePerDay === true,
    source: 'custom',
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
  const cleanItems = dedupe(Array.isArray(value.items) ? value.items.map(entry => sanitizeItem(entry, skillPool)) : []);
  const itemPool = new Set([...itemById.keys(), ...cleanItems.map(item => item.id)]);
  const cleanMonsters = dedupe(Array.isArray(value.monsters) ? value.monsters.map(entry => sanitizeMonster(entry, skillPool)) : []);
  const monsterPool = new Set([...monsterById.keys(), ...cleanMonsters.map(monster => monster.id)]);
  return {
    schemaVersion: LIBRARY_SCHEMA,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    skills: cleanSkills,
    items: cleanItems,
    monsters: cleanMonsters,
    missions: dedupe(Array.isArray(value.missions) ? value.missions.map(entry => sanitizeMission(entry, monsterPool, itemPool)) : []),
    incidents: dedupe(Array.isArray(value.incidents) ? value.incidents.map(sanitizeIncidentCard) : []),
  };
}

export const CONTENT_PACK_FORMAT = 'night-sugar/content-library';

export interface ContentPackFile {
  format: typeof CONTENT_PACK_FORMAT;
  version: number;
  exportedAt: string;
  skills: Skill[];
  items: Equipment[];
  monsters: MonsterTemplate[];
  missions: MissionTemplate[];
  incidents: IncidentCard[];
}

/** 导出当前内容库；格式固定，便于人工检查和跨设备分享。 */
export function exportContentPack(library: ContentLibrary): ContentPackFile {
  const clean = sanitizeLibrary(library);
  return {
    format: CONTENT_PACK_FORMAT,
    version: LIBRARY_SCHEMA,
    exportedAt: new Date().toISOString(),
    skills: clean.skills,
    items: clean.items,
    monsters: clean.monsters,
    missions: clean.missions,
    incidents: clean.incidents,
  };
}

export interface ContentPackReadResult {
  ok: boolean;
  pack?: ContentLibrary;
  errors: string[];
  invalid: number;
}

/** 校验导入文本；只接受本格式，条目逐条走 sanitize，坏条目计入 invalid。 */
export function readContentPack(raw: string): ContentPackReadResult {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, errors: ['文件不是合法的 JSON。'], invalid: 0 }; }
  if (!parsed || typeof parsed !== 'object') return { ok: false, errors: ['内容包必须是一个 JSON 对象。'], invalid: 0 };
  const value = parsed as Record<string, unknown>;
  if (value.format !== CONTENT_PACK_FORMAT) return { ok: false, errors: ['不是夜糖事务所的内容包（format 不匹配）。'], invalid: 0 };
  const version = typeof value.version === 'number' ? value.version : 0;
  if (!Number.isInteger(version) || version < 1 || version > LIBRARY_SCHEMA) {
    return { ok: false, errors: [`内容包版本 ${String(value.version ?? '未知')} 不受支持（当前支持 1）。`], invalid: 0 };
  }
  const pack = sanitizeLibrary(value);
  const rawCount = ['skills', 'items', 'monsters', 'missions', 'incidents']
    .reduce((sum, key) => sum + (Array.isArray(value[key]) ? (value[key] as unknown[]).length : 0), 0);
  const cleanCount = pack.skills.length + pack.items.length + pack.monsters.length + pack.missions.length + pack.incidents.length;
  return { ok: true, pack, errors: [], invalid: Math.max(0, rawCount - cleanCount) };
}

export type ImportStrategy = 'skip' | 'overwrite' | 'rename';

export interface ContentMergeResult {
  library: ContentLibrary;
  added: number;
  replaced: number;
  skipped: number;
  renamed: number;
  conflicts: number;
}

type ItemKind = 'skills' | 'items' | 'monsters' | 'missions' | 'incidents';
type Planned<T> = { action: 'add' | 'replace'; originalId: string; entry: T };

/** 把内容包合并进当前库；冲突可跳过、覆盖或另存为新 id（并重映射跨条目引用）。 */
export function mergeContentPack(current: ContentLibrary, incoming: ContentLibrary, strategy: ImportStrategy): ContentMergeResult {
  const base = sanitizeLibrary(current);
  const pack = sanitizeLibrary(incoming);
  const skillRename = new Map<string, string>();
  const itemRename = new Map<string, string>();
  const monsterRename = new Map<string, string>();
  const nextId = (kind: 'skill' | 'item' | 'monster' | 'mission' | 'incident') => newContentId(kind);

  const plan = <T extends { id: string }>(kind: ItemKind, list: T[], singular: 'skill' | 'item' | 'monster' | 'mission' | 'incident', rename: Map<string, string> | undefined) => {
    const existing = new Set(base[kind].map(entry => entry.id));
    const entries: Planned<T>[] = [];
    let conflicts = 0, skipped = 0, replaced = 0, renamed = 0;
    for (const entry of list) {
      if (!existing.has(entry.id)) {
        entries.push({ action: 'add', originalId: entry.id, entry });
        continue;
      }
      conflicts++;
      if (strategy === 'skip') { skipped++; continue; }
      if (strategy === 'overwrite') {
        replaced++;
        entries.push({ action: 'replace', originalId: entry.id, entry });
        continue;
      }
      const id = nextId(singular);
      rename?.set(entry.id, id);
      renamed++;
      entries.push({ action: 'add', originalId: entry.id, entry: { ...entry, id } });
    }
    return { entries, conflicts, skipped, replaced, renamed };
  };

  const skillPlan = plan('skills', pack.skills, 'skill', skillRename);
  const itemPlan = plan('items', pack.items.map(entry => ({ ...entry, skillId: entry.skillId ? skillRename.get(entry.skillId) ?? entry.skillId : undefined })), 'item', itemRename);
  const monsterPlan = plan('monsters', pack.monsters.map(entry => ({ ...entry, skillIds: entry.skillIds.map(id => skillRename.get(id) ?? id) })), 'monster', monsterRename);
  const missionPlan = plan('missions', pack.missions.map(entry => ({
    ...entry,
    enemyIds: entry.enemyIds.map(id => monsterRename.get(id) ?? id),
    rewardEquipmentId: entry.rewardEquipmentId ? itemRename.get(entry.rewardEquipmentId) ?? entry.rewardEquipmentId : undefined,
  })), 'mission', undefined);
  const incidentPlan = plan('incidents', pack.incidents, 'incident', undefined);

  const apply = <T extends { id: string }>(kind: ItemKind, entries: Planned<T>[]): T[] => {
    const replacements = new Map(entries.filter(entry => entry.action === 'replace').map(entry => [entry.originalId, entry.entry]));
    const result = base[kind].map(entry => replacements.get(entry.id) ?? entry) as T[];
    result.push(...entries.filter(entry => entry.action === 'add').map(entry => entry.entry));
    return result;
  };

  return {
    library: sanitizeLibrary({
      schemaVersion: LIBRARY_SCHEMA,
      updatedAt: new Date().toISOString(),
      skills: apply('skills', skillPlan.entries),
      items: apply('items', itemPlan.entries),
      monsters: apply('monsters', monsterPlan.entries),
      missions: apply('missions', missionPlan.entries),
      incidents: apply('incidents', incidentPlan.entries),
    }),
    added: skillPlan.entries.filter(entry => entry.action === 'add').length
      + itemPlan.entries.filter(entry => entry.action === 'add').length
      + monsterPlan.entries.filter(entry => entry.action === 'add').length
      + missionPlan.entries.filter(entry => entry.action === 'add').length
      + incidentPlan.entries.filter(entry => entry.action === 'add').length,
    replaced: skillPlan.replaced + itemPlan.replaced + monsterPlan.replaced + missionPlan.replaced + incidentPlan.replaced,
    skipped: skillPlan.skipped + itemPlan.skipped + monsterPlan.skipped + missionPlan.skipped + incidentPlan.skipped,
    renamed: skillPlan.renamed + itemPlan.renamed + monsterPlan.renamed,
    conflicts: skillPlan.conflicts + itemPlan.conflicts + monsterPlan.conflicts + missionPlan.conflicts + incidentPlan.conflicts,
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
let currentIncidents: IncidentCard[] = [];

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
  currentIncidents = [...clean.incidents];
}

/** 当前注册的自制委托模板；game.ts 的轮转池会追加它们。 */
export function customMissionTemplates(): MissionTemplate[] {
  return [...currentMissions];
}

/** 当前注册的自制弹窗事件卡；工坊与蓝图导入会读取它们。 */
export function customIncidentCards(): IncidentCard[] {
  return [...currentIncidents];
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

export type WorkshopKind = 'skill' | 'item' | 'monster' | 'mission' | 'incident';

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
    if (state.missions.some(mission => mission.rewardEquipmentId === id)) used.push('当前委托的报酬');
    if (currentMissions.some(mission => mission.rewardEquipmentId === id)) used.push('自制委托的报酬');
  }
  if (kind === 'monster') {
    if (state.missions.some(mission => mission.enemyIds?.includes(id))) used.push('当前委托');
    if (state.battles.some(battle => battle.units.some(unit => unit.monster?.id === id))) used.push('战斗记录');
  }
  if (kind === 'mission') {
    if (state.missions.some(mission => mission.templateId === id)) used.push('当前夜晚的委托');
  }
  if (kind === 'incident') {
    if (state.incidents.some(incident => incident.cardId === id)) used.push('当前弹窗记录');
    if (state.girls.some(girl => girl.storyPlan?.graph?.nodes.some(node => node.data.kind === 'incident' && node.data.spec.cardId === id))) used.push('契约者故事蓝图');
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
  return `技能 ${library.skills.length} · 装备 ${library.items.length} · 魔物 ${library.monsters.length} · 委托 ${library.missions.length} · 弹窗 ${library.incidents.length}`;
}
