import { applyResignationChoice, applyResignations, tickStrain } from './resignations.ts';
import type { ActionResult, BattleNote, FactionRoster, BattleState, CharacterEvent, StoryPassage, ChronicleEntry, ContentPack, Equipment, FactionId, GameAction, GameState, Girl, GirlFaction, Incident, IncidentCard, IncidentEffect, Interception, Log, MarketStockEntry, Mission, MissionTemplate, MonsterTemplate, Opinion, OpinionOption, Outfit, Sample, Scar, StatKey, StoryBeat, StoryEffect, StoryPlan, Storyline, StoryTrigger, Trait, Treatment, FactionPair, HostilityTrack } from './types';
import { createSeedPack } from './content/seed-pack.ts';
import { girlCardHash } from './cards.ts';
import { cardboxReport } from './cardbox.ts';
import { STORY_SLOT_MAX, playableStoryPlan, sanitizeStoryPlan } from './storyplan.ts';
import { EXPRESSION_VARIANT_LIMIT, expressionLabel, isExpressionVariantData, parseExpressionVariantKey, sanitizeExpressionVariants } from './expressions.ts';
import { defaultWitchPersonality } from './personality.ts';
import { endingLabel, ensureGraph, graphBeats, validateGraph } from './storygraph.ts';
import { getSkill } from './content/skills.ts';
import { registerItem } from './content/items.ts';
import { customIncidentCards, customMissionTemplates } from './content/library.ts';
import { simulateBattle, spiritMax, outcomeLabel, ROUND_MINUTES, MAX_ENEMIES } from './combat.ts';
import { pickTraits, traitById } from './content/traits.ts';
import { battleExp, grantExp, investigationExp } from './progression.ts';
import { CONTRACT_DAYS, REMOTE_CALL_COST, pensionFor, renewalCost, pensionArrears } from './contracts.ts';
import { factionInfo, getItem, items } from './content/items.ts';
import { monsters } from './content/monsters.ts';
import { STAT_JITTER, STAT_MIN, mulberry32 } from './content/archetypes.ts';
import { advancedCost, corruptionStage, effectiveMaxHp, effectiveMaxSpirit, effectiveStats, equipmentOf, factionPrice, marketSize, marketUpgradeCost } from './economy.ts';
import { applyPct, districtAt, districts, type DistrictId } from './districts.ts';
import { loadBalance, rules } from './balance.ts';
import { SHIFT_START, SHIFT_END, WAVE_AT, WAVE_SIZES, absoluteMinutes, deadlineFor, remainingLabel, shiftStartAt, LONG_MIN_DAYS, LONG_MAX_DAYS, type CommissionWindow } from './shift.ts';
import { FACTION_ORDER, assignTerritories, canClaim, effectiveDistrictEffect, factionEffect, factionName, ownedDistricts, repairTerritories, type TerritoryMap } from './territories.ts';
import { defaultOpinionDialogue, defaultOpinionOptions, opinionOptionTags, previewOpinionOption, resolveOpinionOptions } from './opinions.ts';
import { canIntercept, defaultFactionRoster, factionCollapsed, factionGirlsOf, factionTagFor, leaderById, leaderTitle, rosterLeader, rosterMembers, sanitizeGirlFaction } from './factions.ts';
import { factionGirls } from './content/factionGirls.ts';
import { DEFAULT_OFFICE_PROFILE, sanitizeOfficeProfile } from './office.ts';
import { HOSTILITY_PAIRS, applyHostility, clampHostility, hostilityGain, incidentHostility, initialHostility, makeTrack, pairOf } from './hostility.ts';
import { frontLabel, openFrontIn, planFronts, resolveDueFronts } from './fronts.ts';
import { INCIDENT_PENDING_LIMIT, blockingIncidents, dueIncidents, expireIncidents, incidentPending, markIncidentCooldown, topUpFromFallback, mergeIncidentPool } from './incidents.ts';
import { clampPollution, districtName, initialPollution, mergeDistrictEffects, pollutionDailyRise, pollutionEffect, pollutionForecast, pollutionPenalty, pollutionRelief, pollutionSnapshotOf, pollutionTier, pollutionTierLabel, repairPollution } from './pollution.ts';

export const SAVE_KEY = 'night-sugar-office:v1';
/** 衣柜上限：三套制式 + 一格自定义礼装。 */
export const WARDROBE_LIMIT = 4;
export const statLabels: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };
export const statusLabels: Record<string, string> = { idle: '待命', mission: '派遣中', healing: '治疗中', resting: '休息中', retired: '已退役', expedition: '远行中' };
export const workLabels = { combat: '战斗', investigation: '调查' } as const;
export const workDescriptions = { combat: '与魔物交战，按 15 分钟一轮自动结算。', investigation: '调查灵异现象，以队伍最高相关能力判定。' } as const;
export const stageLabels = ['厌恶', '疏离', '戒备', '平常', '亲近', '依恋', '爱意'] as const;
export const stageHints = ['她不想与你共处一室。', '她保持礼貌，也保持距离。', '她在观察你，尚未决定是否信任。', '日常相处，不近不远。', '她开始主动分享一些小事。', '她把你放进了自己的未来。', '她愿意把最脆弱的部分交给你。'] as const;
export function relationshipStage(score: number): number {
  const value = Math.max(0, Math.min(100, score));
  if (value < 10) return 0;
  if (value < 25) return 1;
  if (value < 40) return 2;
  if (value < 55) return 3;
  if (value < 70) return 4;
  if (value < 85) return 5;
  return 6;
}
export function clock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function dateLabel(day: number, minutes: number): string {
  return `第 ${day} 日 · ${clock(minutes)}`;
}
export function capacity(state: GameState): number {
  return state.rooms.filter(r => r.type === 'dorm').reduce((sum, room) => sum + room.capacity, 0);
}
export function buildCost(room: { level: number }): number {
  return 2400 * Math.max(1, room.level);
}
export function chance(girl: Girl, mission: Mission): number {
  const stats = effectiveStats(girl);
  return Math.max(35, Math.min(99, Math.round(70 + (stats[mission.requirement] - mission.target) * 0.65 - girl.fatigue * 0.15)));
}
export function squadLimit(mission: Mission): number {
  const cap = loadBalance().squadLimit;
  return mission.work === 'combat' ? cap : Math.max(1, Math.min(cap, 2));
}
export function squadChance(girls: Girl[], mission: Mission): number {
  if (!girls.length) return 0;
  const best = Math.max(...girls.map(g => effectiveStats(g)[mission.requirement]));
  const bonus = (girls.length - 1) * 4;
  const fatigue = Math.round(girls.reduce((sum, g) => sum + g.fatigue, 0) / girls.length * 0.15);
  return Math.max(20, Math.min(99, Math.round(55 + (best + bonus - mission.target) * 0.9 - fatigue)));
}
export function drugDaysLeft(girl: Girl, day: number): number {
  return Math.max(0, (girl.drugUntilDay ?? 0) - day);
}
export function inWithdrawal(girl: Girl): boolean {
  return Boolean(girl.witch && (girl.withdrawalDays ?? 0) > 0);
}
export function marketPool(state: GameState): Girl[] {
  return state.candidates;
}
export function factionStanding(state: GameState, faction: FactionId): number {
  return state.factions[faction]?.standing ?? 0;
}
export function marketUpgrade(state: GameState): { cost: number | null; size: number } {
  return { cost: marketUpgradeCost(state.marketLevel), size: marketSize(state.marketLevel) };
}
export function itemPrice(state: GameState, item: Equipment): number {
  const standing = factionStanding(state, item.faction);
  const rebate = state.inventory['permit'] ? 0.9 : 1;
  return Math.round(factionPrice(item, standing) * rebate);
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function defaultSkills(id: string): string[] {
  const map: Record<string, string[]> = {
    yue: ['glimmer-spear', 'peach-ward', 'starlight-fall'], tang: ['sugar-needle', 'goodnight-candy', 'white-night-frost'],
    ling: ['frequency-prick', 'silent-band', 'moon-phase'], wu: ['dream-touch', 'sheep-nebula', 'deep-dream-fall'],
    zhi: ['flower-thorn', 'flower-prescription', 'spring-growth'], lu: ['drumbeat', 'finale-firework', 'crimson-encore'],
  };
  return map[id] ?? ['glimmer-spear'];
}
function defaultWardrobe(g: Girl): Outfit[] {
  return [
    { id: 'uniform', name: '值夜制服', description: '事务所统一配发的夜间制服，便于行动。', palette: [g.color, '#17141c', '#f7e9f1'], layerKey: 'uniform' },
    { id: 'casual', name: '私服', description: '下班后才会穿的衣服，袖口仍留着一点夜里的冷气。', palette: [g.color, '#241d2b', '#d9c9e2'], layerKey: 'casual' },
    { id: 'formal', name: '礼装', description: '在需要被城市记住的场合穿的那一套。', palette: [g.color, '#0e0c14', '#ffe4ef'], layerKey: 'formal' },
  ];
}
function sanitizeOutfit(outfit: Outfit, color: string): Outfit | null {
  if (!outfit || typeof outfit !== 'object' || typeof outfit.name !== 'string' || !outfit.name.trim()) return null;
  const portrait = typeof outfit.portrait === 'string' && outfit.portrait.startsWith('data:image/') ? outfit.portrait : undefined;
  return {
    id: typeof outfit.id === 'string' && outfit.id ? outfit.id.slice(0, 40) : `outfit-${hashText(outfit.name).toString(16)}`,
    name: outfit.name.trim().slice(0, 24),
    description: typeof outfit.description === 'string' ? outfit.description.slice(0, 200) : '',
    palette: Array.isArray(outfit.palette) && outfit.palette.length ? outfit.palette.filter(c => typeof c === 'string').slice(0, 4) : [color, '#17141c', '#f7e9f1'],
    layerKey: typeof outfit.layerKey === 'string' && outfit.layerKey ? outfit.layerKey : 'uniform',
    portrait,
    portraitSpec: outfit.portraitSpec,
    imported: Boolean(outfit.imported),
    custom: Boolean(outfit.custom),
    form: outfit.form === 'witch' ? 'witch' : undefined,
  };
}
/** 自定义礼装占衣柜的第一格，立绘沿用本人。 */
export function customOutfitFor(source: { color: string; outfitDescription?: string; portrait?: string; portraitSpec?: Girl['portraitSpec'] }): Outfit {
  return {
    id: 'custom',
    name: '契约礼装',
    description: source.outfitDescription?.trim() || '为她单独缝制的那一套，只有这一件。',
    palette: [source.color, '#17141c', '#ffe4ef'],
    layerKey: 'formal',
    portrait: source.portrait?.startsWith('data:image/') ? source.portrait : undefined,
    portraitSpec: source.portraitSpec,
    custom: true,
  };
}

/** 魔女化的立绘单独一格；没有上传立绘时退回程序化剪影的魔女配色。 */
export function witchOutfitFor(girl: Pick<Girl, 'color' | 'portrait' | 'portraitSpec'>): Outfit {
  return {
    id: 'witchform',
    name: '魔女化',
    description: '侵蚀越过临界点之后，她偶尔会以另一副样子站在镜子里。',
    palette: ['#2a1524', '#c478b8', '#f3aec9'],
    layerKey: 'formal',
    form: 'witch',
    portrait: girl.portrait?.startsWith('data:image/') ? girl.portrait : undefined,
    portraitSpec: girl.portraitSpec,
  };
}
/**
 * 读档与建档的统一入口。
 *
 * 入参允许缺 `factionTag`（旧存档、外部导入的契约卡、种子包），所以这里收成
 * `GirlInput`；返回值一定是完整的 `Girl`，其余模块不必再判空。
 */
type GirlInput = Omit<Girl, 'factionTag'> & { factionTag?: GirlFaction | string };
/** 雇佣覆灭势力的首领：一次性星砂。 */
const LEADER_HIRE_COST = 12000;

/** 校验并规整三方阵容；不合法时返回 null（调用方拒绝动作）。 */
function sanitizeFactionRoster(input: unknown): Record<FactionId, FactionRoster> | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<Record<FactionId, { leaderId?: unknown; memberIds?: unknown }>>;
  const leaders = new Set<string>();
  const members = new Set<string>();
  const roster = {} as Record<FactionId, FactionRoster>;
  let total = 0;
  for (const faction of FACTION_ORDER) {
    const entry = raw[faction];
    const leaderId = typeof entry?.leaderId === 'string' ? entry.leaderId : '';
    if (!leaderById(leaderId) || leaders.has(leaderId)) return null;
    leaders.add(leaderId);
    const ids = Array.isArray(entry?.memberIds) ? entry!.memberIds.filter((id): id is string => typeof id === 'string') : [];
    const unique = [...new Set(ids)];
    if (unique.length < 1 || unique.length > 4) return null;
    for (const id of unique) {
      if (!factionGirls.some(girl => girl.id === id) || members.has(id)) return null;
      members.add(id);
    }
    total += unique.length;
    roster[faction] = { leaderId, memberIds: unique };
  }
  if (total !== factionGirls.length) return null;
  return roster;
}

/** 没被开局选中的候选：契约卡来的留在市场，事务所原班人马直接退场。 */
function starterKeepInPool(girl: Girl): boolean {
  return Boolean(girl.custom);
}

function hydrate(girl: GirlInput): Girl {
  const g = clone(girl) as Girl;
  g.baseMaxHp ??= g.maxHp;
  g.baseStats ??= { ...g.stats };
  g.skills ??= defaultSkills(g.id);
  g.scars ??= [];
  g.relationships ??= {};
  g.exp ??= 0;
  g.goal ??= '在城市的夜里，找到一件值得反复去做的事。';
  g.goalKind ??= '生活';
  g.traits ??= [];
  g.conditions ??= [];
  g.contractEndDay ??= 24;
  g.contractDays ??= CONTRACT_DAYS;
  g.contractRenewals ??= 0;
  g.pensionMissed ??= 0;
  g.status ??= 'idle';
  g.appearance ??= '她的轮廓在夜灯下显得很安静。';
  g.personality ??= '安静，习惯把心事留到天亮。';
  g.outfitDescription ??= '事务所配发的深色值夜制服。';
  const closet = g.wardrobe?.length ? g.wardrobe : defaultWardrobe(g);
  g.wardrobe = closet
    .map(outfit => sanitizeOutfit(outfit, g.color))
    .filter((outfit): outfit is Outfit => Boolean(outfit))
    .filter((outfit, index, list) => list.findIndex(other => other.id === outfit.id) === index)
    .slice(0, WARDROBE_LIMIT);
  if (!g.wardrobe.length) g.wardrobe = defaultWardrobe(g);
  if (!g.outfitId || !g.wardrobe.some(outfit => outfit.id === g.outfitId)) g.outfitId = g.wardrobe[0].id;
  if (g.witchForm) {
    const witch = sanitizeOutfit({ ...g.witchForm, id: 'witchform', form: 'witch' }, g.color);
    g.witchForm = witch ? { ...witch, form: 'witch' } : undefined;
  }
  if (g.witch && !g.witchPersonality?.trim()) g.witchPersonality = defaultWitchPersonality(g);
  g.portraitHint ??= '';
  g.storyPlan = g.storyPlan ? sanitizeStoryPlan(g.storyPlan) ?? undefined : undefined;
  g.eventBadge ??= undefined;
  g.pendingTalk ??= undefined;
  g.expression ??= 'calm';
  // 出身在这里统一收口：缺字段、非法值、历史遗留的 `office` 都按 id 重新确定性生成，
  // 合法值原样保留，所以一次存读不会把一个人的来历改掉。
  g.factionTag = sanitizeGirlFaction(g.factionTag, g.id);
  g.corruption ??= 0;
  g.equipment ??= {};
  g.importedVariants = sanitizeExpressionVariants(g.importedVariants);
  g.maxHp = Math.max(40, effectiveMaxHp(g));
  g.hp = Math.min(g.hp, g.maxHp);
  g.maxSpirit = Math.max(30, g.maxSpirit ?? spiritMax(g));
  g.spirit = Math.min(g.spirit ?? g.maxSpirit, effectiveMaxSpirit(g));
  g.skill = getSkill(g.skills[g.skills.length - 1] ?? 'glimmer-spear').name;
  return g;
}
function sampleDays(): GameState['samples'] {
  return Array.from({ length: 14 }, (_, index) => {
    const day = index + 1;
    const wave = Math.sin(index * 0.9) * 180 + Math.cos(index * 0.37) * 120;
    return { day, income: Math.round(640 + index * 28 + wave), expense: Math.round(300 + index * 12 - wave * 0.25), reputation: Math.max(48, Math.min(82, Math.round(62 + index * 1.1 + Math.sin(index) * 4))) };
  });
}
function hashText(text: string): number {  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}
const candidateNames = ['南枝', '莉莉安', '灰原灯', '白栖', '苏糖', '森野眠', '折原凛', '秋山杏', '柚木澪', '花笼', '小鸟游雪', '雨森', '桐谷真昼', '叶月', '猫田铃', '白石萤'];
const candidateColors = ['#F49ABD', '#C7A7E8', '#9CC9D2', '#B9D8A8', '#D98A94', '#E8C7A7'];
const elements = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系'] as const;
const archetypes = ['输出', '守护', '控制', '治愈', '侦查'] as const;

function makeCandidate(state: GameState, level: number, salt = 0, tag?: GirlFaction): Girl {
  const seed = hashText(`${state.day}:${state.marketDay}:${state.candidates.length}:${level}:${salt}`);
  const pick = <T,>(list: readonly T[], shift: number): T => list[(seed >>> shift) % list.length];
  const element = pick(elements, 0);
  const archetype = pick(archetypes, 4);
  const name = candidateNames[seed % candidateNames.length];
  const id = `g_${seed.toString(16).padStart(8, '0')}`;
  const jitter = mulberry32(seed);
  const ceiling = 90 + (level - 1) * 3;
  const stat = (shift: number) => {
    const base = 42 + ((seed >>> shift) % 45) + (level - 1) * 3;
    const delta = Math.round((jitter() * 2 - 1) * STAT_JITTER);
    return Math.max(STAT_MIN, Math.min(ceiling, base + delta));
  };
  const stats = { magic: stat(3), insight: stat(7), agility: stat(11), empathy: stat(15) };
  const color = candidateColors[seed % candidateColors.length];
  const skills = archetype === '治愈' ? ['flower-thorn', 'flower-prescription', 'spring-growth'] : archetype === '控制' ? ['frequency-prick', 'silent-band', 'moon-phase'] : archetype === '守护' ? ['sugar-needle', 'goodnight-candy', 'white-night-frost'] : ['glimmer-spear', 'peach-ward', 'starlight-fall'];
  const baseMaxHp = Math.round(96 + stats.empathy * 0.3) + level * 4;
  return hydrate({
    id, name, codename: `${element.slice(0, 2)}协奏`, title: '刚刚递交契约的魔法少女', element, color, portrait: '',
    level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 80 + level * 2, maxSpirit: 80 + level * 2,
    fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '', skills, description: '她的档案还很薄，只有一页训练记录和一张没有署名的推荐信。', cost: 1800 + level * 400 + Math.round((stats.magic + stats.insight + stats.agility + stats.empathy) * 4),
    scars: [], relationships: {}, archetype, quote: '请多指教。我会努力不拖后腿的。',
    goal: '证明自己可以独立完成一次委托。', goalKind: '成长', traits: [], conditions: [], contractEndDay: 24, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
    appearance: pick(['浅色短发，发梢有一点不听话的卷。', '黑发扎成低马尾，耳后别着一枚旧发卡。', '亚麻色长发，眼睛比制服的颜色更浅。'], 6),
    personality: pick(['认真、容易紧张，被夸奖时会短暂地失去语言。', '看起来冷淡，其实很怕给别人添麻烦。', '好奇心旺盛，总在记录本上画看不懂的符号。'], 9),
    outfitDescription: '见习契约者的简化制服，袖口还没有绣上事务所的标记。',
    wardrobe: [], outfitId: 'uniform', expression: 'calm', corruption: 0, equipment: {}, candidateUntilDay: state.day + (salt % 2 === 0 ? 1 : 3),
    // 候选者来自三方与无所属；显式传入时用它，否则按 id 确定性分布。
    factionTag: tag ?? factionTagFor(id),
  });
}

/**
 * 补名册：先补出身缺口，再用确定性洗牌袋填满剩余名额。
 *
 * 市场只有 2–5 个非自定义槽位，纯随机经常连着几天都是同一方的人，玩家会觉得
 * 全城只剩一种出身。所以这里分两步：先看当前名册缺哪几方，按洗牌袋的顺序补；
 * 槽位不够时不硬塞，也不替换玩家自己的契约卡。
 */
function refreshMarket(state: GameState): void {
  state.candidates = state.candidates.filter(g => g.custom || (g.candidateUntilDay ?? 0) > state.day);
  const target = marketSize(state.marketLevel);
  const bag = factionBag(state.marketDay);
  let bagIndex = 0;
  const nextTag = (): GirlFaction => {
    const tag = bag[bagIndex % bag.length];
    bagIndex += 1;
    return tag;
  };
  const customCount = state.candidates.filter(g => g.custom).length;
  const slots = Math.max(0, Math.min(target, 6 - customCount));
  const nonCustom = () => state.candidates.filter(g => !g.custom);
  // 第一步：补齐缺席的出身。已有的一方不再重复补，避免四五个名额被同一方吃掉。
  for (const tag of bag) {
    if (nonCustom().length >= slots) break;
    if (nonCustom().some(g => g.factionTag === tag)) continue;
    pushCandidate(state, nextTag(), slots);
  }
  // 第二步：仍有空位时按洗牌袋顺序填满；已出现的出身照样可以再来一个。
  let guard = 0;
  while (nonCustom().length < slots && guard < 12) {
    pushCandidate(state, nextTag(), slots);
    guard += 1;
  }
  state.marketDay = state.day;
}

/** 同一天内稳定的出身洗牌袋：四个出身各一次，按 hash 轮转，不靠 `Math.random`。 */
function factionBag(day: number): GirlFaction[] {
  const order: GirlFaction[] = ['association', 'government', 'witch', 'none'];
  const offset = hashText(`faction-bag:${day}`) % order.length;
  return [...order.slice(offset), ...order.slice(0, offset)];
}

function pushCandidate(state: GameState, tag: GirlFaction, slots: number): void {
  const roll = hashText(`${state.day}:${state.marketDay}:${state.candidates.length}:${tag}`);
  const level = roll % 10 < 7 ? 1 : 2;
  const girl = makeCandidate(state, level, state.marketDay * 10 + state.candidates.length, tag);
  if (state.candidates.some(g => g.id === girl.id)) return;
  if (state.candidates.filter(g => !g.custom).length >= slots) return;
  state.candidates.push(girl);
}

export function makeFactionStock(faction: FactionId, day: number): MarketStockEntry[] {
  const pool = items.filter(item => item.faction === faction);
  if (!pool.length) return [];
  const picked: typeof pool = [];
  for (let index = 0; index < 3; index++) {
    const roll = hashText(`${faction}:${day}:${index}`);
    const duplicate = index > 0 && roll % 100 < 32;
    picked.push(duplicate ? picked[index - 1] : pool[roll % pool.length]);
  }
  return picked.map((item, index) => ({ id: `stock-${faction}-${day}-${index}`, itemId: item.id, faction, sold: false }));
}
export function makeMarketStock(day: number): MarketStockEntry[] {
  return (Object.keys(factionInfo) as FactionId[]).flatMap(faction => makeFactionStock(faction, day));
}

function addCorruption(state: GameState, girl: Girl, amount: number): void {
  if (!amount || girl.dead || girl.retired) return;
  const before = corruptionStage(girl.corruption ?? 0);
  girl.corruption = Math.max(0, Math.min(100, Math.round((girl.corruption ?? 0) + amount)));
  const after = corruptionStage(girl.corruption);
  if (after > before) {
    state.logs.unshift({ id: `log-corrupt-${girl.id}-${girl.corruption}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}的侵蚀进入「${['澄明', '浅蚀', '深蚀', '魔女'][after]}」阶段。${after === 3 ? '她的影子长出了不属于人类的角。' : '她的共情正在被某种东西缓慢替换。'}` });
    if (after === 3) {
      girl.witch = true;
      girl.drugUntilDay = Math.max(girl.drugUntilDay ?? 0, state.day + 10);
      girl.withdrawalDays = 0;
    }
  }
}

function drugTick(state: GameState, girl: Girl): void {
  if (!girl.witch || girl.dead) return;
  if ((girl.drugUntilDay ?? 0) >= state.day) { girl.withdrawalDays = 0; return; }
  if ((state.inventory['moon-drug'] ?? 0) > 0) {
    state.inventory['moon-drug'] -= 1;
    girl.drugUntilDay = state.day + 10;
    girl.withdrawalDays = 0;
    state.logs.unshift({ id: `log-drug-${girl.id}-${state.day}`, time: dateLabel(state.day, 0), kind: 'clinic', text: `仓库中的月蚀抑制剂被用于${girl.name}，药效延长至第 ${girl.drugUntilDay} 日。` });
    return;
  }
  girl.withdrawalDays = (girl.withdrawalDays ?? 0) + 1;
  const step = girl.withdrawalDays;
  const damage = step <= 3 ? 8 : step <= 6 ? 14 : step <= 9 ? 22 : 40;
  girl.hp = Math.max(0, girl.hp - damage);
  if (step === 1) state.logs.unshift({ id: `log-withdraw-${girl.id}-${state.day}`, time: dateLabel(state.day, 0), kind: 'clinic', text: `${girl.name}断药了。她把自己锁在宿舍里，说只是需要一点时间。` });
  if (girl.hp <= 0 || step >= 10) {
    girl.hp = 0; girl.dead = true; girl.status = 'retired'; girl.retired = true; girl.diedAt = dateLabel(state.day, 0);
    state.memorial.unshift({ girl: clone(girl), diedAt: girl.diedAt, cause: '断药。月蚀侵蚀吞掉了最后一点自我。', epitaph: '她终于不必再数着药片过日子。', lastBattleId: '' });
    state.logs.unshift({ id: `log-death-drug-${girl.id}`, time: dateLabel(state.day, 0), kind: 'memorial', text: `${girl.name}在断药第 ${step} 日停止了呼吸。事务所为她保留了那盏调到最暗的灯。` });
    state.girls = state.girls.filter(g => g.id !== girl.id);
  }
}

const factionTaskTitle: Record<FactionId, string> = { witch: '月蚀庭的夜间取样', association: '星灯协会的失联信号', government: '市役所的封锁线缺口' };
const factionEnemies: Record<FactionId, string[]> = { witch: ['mirror-nun', 'echo-cat'], association: ['sugar-moth', 'night-tram'], government: ['candy-king', 'echo-cat'] };
const factionReward: Record<FactionId, number> = { witch: 900, association: 760, government: 820 };

function factionTask(state: GameState, faction: FactionId): Mission {
  return annotateMission(state, {
    id: `envoy-${faction}-${state.day}`, title: factionTaskTitle[faction], category: `${factionInfo[faction].short} · 代表委托`,
    description: `${factionInfo[faction].envoy}把一份没有编号的任务书推过桌面。「今晚只交给你们。」`,
    x: 30 + (hashText(faction) % 40), y: 30 + (hashText(faction + state.day) % 40), difficulty: '中危', duration: 60,
    reward: factionReward[faction], requirement: faction === 'witch' ? 'empathy' : faction === 'association' ? 'insight' : 'agility',
    target: 74, color: factionInfo[faction].color, status: 'open', squad: [], work: 'combat', enemyIds: factionEnemies[faction],
    rounds: 4, attempts: 0, recommendedLevel: 5, faction, envoy: true,
  });
}

function makeBossMission(state: GameState): Mission {
  return annotateMission(state, {
    id: `boss-${state.day}`, title: '空月降临', category: '城市级威胁', description: '钟楼上方的空月开始下坠。三个街区同时听见了没有来源的钟声。',
    x: 50, y: 18, difficulty: '绝望', duration: 90, reward: 8000, requirement: 'magic', target: 95, window: 'long',
    color: '#C9C4FF', status: 'open', squad: [], work: 'combat', enemyIds: ['hollow-moon', 'sugar-moth', 'echo-cat'],
    rounds: 6, attempts: 0, recommendedLevel: 8, boss: true,
  });
}

/** 给任何来源的委托补上辖区、时段与接取时限（旧存档、派系、Boss、LLM 都走这里）。 */
export function annotateMission(state: GameState, mission: Mission, wave = 0): Mission {
  const district = mission.district ?? districtAt(mission.x, mission.y);
  const spawnAt = mission.spawnedAt ?? absoluteMinutes(state.day, state.minutes);
  const window: CommissionWindow = mission.window ?? (mission.duration >= 90 ? 'long' : 'urgent');
  const base: Mission = {
    ...mission,
    enemyIds: mission.enemyIds ? mission.enemyIds.slice(0, MAX_ENEMIES) : mission.enemyIds,
    district, window, wave: mission.wave ?? wave,
    spawnedAt: spawnAt, deadlineAt: mission.deadlineAt ?? deadlineFor(window, state.day, spawnAt),
  };
  // 已有快照的委托不再重算：发出去之后辖区易主或被人净化，不能回头改动这一单。
  if (mission.environment) return base;
  return { ...base, ...missionSnapshot(state, district, mission.target, mission.reward) };
}

/**
 * 把辖区当前的环境、污染与当主冻结成委托快照。
 *
 * 目标与报酬只在这里应用一次，快照本身也留在这份数据里，所以详情面板、战斗与结算
 * 读到的都是同一份口径。
 */
function missionSnapshot(state: GameState, district: DistrictId, target: number, reward: number): Pick<Mission, 'environment' | 'pollutionAtSpawn' | 'ownerAtSpawn' | 'target' | 'reward'> {
  const owner = state.territories?.[district] ?? FACTION_ORDER[0];
  const level = pollutionForecast(state, district).level;
  const environment = mergeDistrictEffects(districts[district].effect, factionEffect[owner], pollutionEffect(level));
  return {
    environment,
    pollutionAtSpawn: level,
    ownerAtSpawn: owner,
    target: applyPct(target, environment.targetPct),
    reward: applyPct(reward, environment.rewardPct),
  };
}

function bossTick(state: GameState, elapsed: number): void {
  if (!state.boss) return;
  const now = state.day * 1440 + state.minutes;
  if (now >= state.boss.deadline) {
    state.reputation = Math.max(0, state.reputation - 6);
    state.boss.defeated = true;
    state.boss = null;
    state.missions = state.missions.filter(m => m.id !== `boss-${state.bossCycle}`);
    state.logs.unshift({ id: `log-boss-timeout-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'battle', text: '空月自行离开了城市上空。没有人感到轻松，安定度仍然下降了。' });
    return;
  }
  state.boss.lastTick += elapsed;
  while (state.boss.lastTick >= 180) {
    state.boss.lastTick -= 180;
    state.reputation = Math.max(0, state.reputation - 1);
  }
}

const conditionCatalog = [  { name: '夜惊', kind: 'debuff' as const, description: '连续几晚在同一个时刻惊醒，白天会下意识避开钟声。', stat: 'insight' as StatKey, amount: -3 },
  { name: '手部震颤', kind: 'debuff' as const, description: '握笔时手指会轻轻发抖，写下的字比平时更用力。', stat: 'agility' as StatKey, amount: -4 },
  { name: '幻听', kind: 'debuff' as const, description: '在安静的房间里，偶尔会听见并不存在的汽笛。', stat: 'empathy' as StatKey, amount: -3 },
  { name: '过度警觉', kind: 'buff' as const, description: '很难真正放松，但危险靠近时她总是第一个察觉。', stat: 'insight' as StatKey, amount: 4 },
  { name: '甜食安抚', kind: 'buff' as const, description: '随身带着糖，情绪低落时会好得快一点。', stat: 'empathy' as StatKey, amount: 2 },
];
function addCondition(state: GameState, girl: Girl, source: string): void {
  const seed = hashText(girl.id + state.day + source);
  const base = conditionCatalog[seed % conditionCatalog.length];
  girl.conditions.push({ id: `cond-${girl.id}-${seed.toString(16)}`, name: base.name, kind: base.kind, source, description: base.description, remaining: 3, removable: true, stat: base.stat, amount: base.amount });
  state.logs.unshift({ id: `log-cond-${girl.id}-${seed}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}在「${source}」之后出现了「${base.name}」。${base.description}` });
}
function gainTrait(state: GameState, girl: Girl, source: string, chance = 0.35): void {
  if (!girl.traits || girl.dead) return;
  const seed = hashText(`${girl.id}:${state.day}:${state.minutes}:${source}:${girl.traits.length}`);
  if (seed % 100 >= chance * 100) return;
  const [trait] = pickTraits(seed, 1, girl.traits.map(t => t.id));
  if (!trait) return;
  girl.traits.push({ ...trait, gainedAt: dateLabel(state.day, state.minutes) });
  state.logs.unshift({ id: `log-trait-${girl.id}-${trait.id}-${seed}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}在「${source}」之后显露出新的特性「${trait.name}」。${trait.description}` });
}
function tickConditions(girl: Girl, days: number): void {
  for (const condition of girl.conditions) condition.remaining -= days;
  girl.conditions = girl.conditions.filter(condition => condition.remaining > 0);
}
function accruePension(state: GameState, days: number): void {
  let paid = 0;
  let missing = 0;
  for (const girl of state.girls) {
    if (girl.dead || !girl.retired) continue;
    for (let i = 0; i < days; i++) {
      const daily = Math.max(1, Math.round(pensionFor(girl) / 10));
      if (state.gold - paid - daily >= 0) paid += daily;
      else missing += daily;
    }
  }
  if (paid) { state.gold -= paid; book(state, state.day, -paid); }
  if (missing) {
    state.pensionDebt += missing;
    state.logs.unshift({ id: `log-pension-${state.day}-${state.pensionDebt}`, time: dateLabel(state.day, state.minutes), kind: 'finance', text: `退休金账户出现 ${missing} 星砂缺口，已记入事务所欠款。`, delta: -missing });
  }
  for (const girl of state.girls) {
    if (girl.dead || girl.retired) continue;
    if (state.day > girl.contractEndDay) girl.pensionMissed = Math.min(60, girl.pensionMissed + days);
  }
}
function makeOpinion(state: GameState, author: Girl, topic: Opinion['topic'], title: string, text: string, request: string, context: { faction?: FactionId; district?: DistrictId } = {}): Opinion {
  const district = context.district ?? (topic === '城市' ? 'candy' : undefined);
  const faction = context.faction ?? (district ? state.territories[district] : undefined);
  return {
    id: `op-${state.day}-${hashText(author.id + title + state.minutes)}`, day: state.day, authorId: author.id, topic,
    title, text, request, status: 'pending', faction,
    options: defaultOpinionOptions(topic, { authorId: author.id, authorName: author.name, faction, district }),
    dialogue: defaultOpinionDialogue(topic, { authorId: author.id, authorName: author.name, faction, district, request }),
    assistantNote: state.assistantId === author.id ? `${author.name}亲自提交，附了一份写得很短的预算。` : undefined,
  };
}
function generateOpinions(state: GameState): void {
  if (state.opinions.filter(opinion => opinion.status === 'pending').length >= 6) return;
  const pool = state.girls.filter(girl => !girl.dead && girl.status !== 'mission');
  if (!pool.length) return;
  const author = pool[hashText(`${state.day}:${state.minutes}`) % pool.length];
  const topics: { topic: Opinion['topic']; title: string; text: string; request: string }[] = [
    { topic: '经费', title: '想把会客厅的灯换暖一点', text: '现在的白光太像诊所。夜里回来的人，应该看见一点偏黄的光。', request: '申请 600 星砂更换会客厅灯具。' },
    { topic: '排班', title: '下周的夜班可以少排一个人吗', text: '连续出勤之后，大家的恢复速度明显变慢了。', request: '下一周期战斗委托最多接两件。' },
    { topic: '设施', title: '星象台的窗需要修', text: '上次的异常让它裂了一道缝，零青说风声会干扰收听。', request: '申请 900 星砂维修星象台。' },
    { topic: '同伴', title: '给新来的人办一场欢迎会', text: '不必很大，只要有糖和一张写着名字的卡片。', request: '申请 300 星砂筹办小型欢迎会。' },
    { topic: '城市', title: '糖果街的灯又灭了', text: '居民说不是电的问题。她们想再去看看。', request: '把糖果街的调查优先级提前。' },
    { topic: '私人心愿', title: '想请半天假', text: '不是去玩。只是想去看看城南那棵还没开的树。', request: '批准半天个人时间，不扣羁绊。' },
  ];
  const pick = topics[hashText(`${author.id}:${state.day}`) % topics.length];
  state.opinions.unshift(makeOpinion(state, author, pick.topic, pick.title, pick.text, pick.request));
  state.logs.unshift({ id: `log-op-${author.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'council', text: `${author.name}向事务所提交了议题「${pick.title}」。` });
}
function settleExpedition(state: GameState, expeditionId: string, at: { day: number; minutes: number }): void {
  const expedition = state.expeditions.find(e => e.id === expeditionId);
  if (!expedition) return;
  const members = expedition.memberIds.map(id => findGirl(state, id)).filter((g): g is Girl => Boolean(g));
  if (!members.length) { state.expeditions = state.expeditions.filter(e => e.id !== expeditionId); return; }
  const seed = hashText(`${expedition.id}:${expedition.cyclesDone}:${at.day}:${at.minutes}`);
  const gain = 60 + (seed % 121);
  const found = seed % 10 < 6;
  state.gold += gain;
  book(state, at.day, gain);
  expedition.cyclesDone += 1;
  expedition.lastSettledDay = at.day;
  expedition.lastSettledMinutes = at.minutes;
  for (const girl of members) {
    girl.fatigue = Math.min(100, girl.fatigue + 5);
    girl.bond = Math.min(100, girl.bond + 1);
    grantExp(girl, 2);
    if (found) gainTrait(state, girl, '星象台远行', 0.12);
  }
  state.logs.unshift({ id: `log-exp-${expedition.id}-${expedition.cyclesDone}`, time: dateLabel(at.day, at.minutes), kind: 'expedition', text: `星象台远行第 ${expedition.cyclesDone} 轮：${members.map(g => g.name).join('、')}带回 ${gain} 星砂${found ? '和一段可以写进档案的见闻' : '，但没有发现异常'}。`, delta: gain });
  if (members.some(girl => girl.fatigue >= 95)) {
    for (const girl of members) { if (girl.status === 'expedition') { girl.status = 'idle'; girl.roomId = 'lounge'; girl.remaining = 0; } }
    state.expeditions = state.expeditions.filter(item => item.id !== expeditionId);
    state.logs.unshift({ id: `log-exp-tired-${expedition.id}`, time: dateLabel(at.day, at.minutes), kind: 'expedition', text: `远行队因疲劳达到极限自动返回。${members.map(g => g.name).join('、')}需要休息。` });
  }
}
function sampleFor(state: GameState, day: number): Sample {
  let sample = state.samples.find(s => s.day === day);
  if (!sample) {
    sample = { day, income: 0, expense: 0, reputation: state.reputation };
    state.samples.push(sample);
    state.samples.sort((a, b) => a.day - b.day);
    if (state.samples.length > 60) state.samples.shift();
  }
  return sample;
}
function book(state: GameState, day: number, money: number): void {
  const sample = sampleFor(state, day);
  if (money > 0) sample.income += money;
  if (money < 0) sample.expense += -money;
  sample.reputation = state.reputation;
}
function archive(state: GameState, kind: ChronicleEntry['kind'], title: string, summary: string): void {
  state.chronicle.unshift({ id: `chr-${Date.now()}-${state.chronicle.length}`, day: state.day, at: dateLabel(state.day, state.minutes), kind, title, summary });
  state.chronicle = state.chronicle.slice(0, 200);
}
// ---------------------------------------------------------------- 辖区与委托时段

const baseCommissionPool = createSeedPack().missions.filter(m => !m.boss);

/** 把自制委托模板转成可进入轮转池的委托快照；坐标与时限由 makeCommission 再算。 */
function missionSeed(template: MissionTemplate): Mission {
  return {
    id: `custom-${template.id}`,
    title: template.title,
    category: template.category,
    description: template.description,
    x: 50,
    y: 50,
    difficulty: template.difficulty,
    duration: template.duration,
    reward: template.reward,
    requirement: template.requirement,
    target: template.target,
    color: template.color,
    status: 'open',
    squad: [],
    work: template.work,
    enemyIds: [...template.enemyIds].slice(0, MAX_ENEMIES),
    rounds: template.rounds,
    attempts: 0,
    recommendedLevel: template.recommendedLevel,
    district: template.district,
    window: template.window,
    rewardEquipmentId: template.rewardEquipmentId,
    rewardGirlLevel: template.rewardGirlLevel,
    generated: false,
    sourcePack: 'workshop',
    templateId: template.id,
  };
}

function commissionPool(): Mission[] {
  return [...baseCommissionPool, ...customMissionTemplates().map(missionSeed)];
}

/** 蓝图「阶段委托」可以一键套用的现有委托模板。 */
export interface MissionTemplateOption {
  id: string; title: string; category: string; description: string;
  difficulty: string; duration: number; requirement: StatKey; target: number;
  work: 'combat' | 'investigation'; monsters: MonsterTemplate[];
}

export function missionTemplates(): MissionTemplateOption[] {
  return commissionPool().map(template => ({
    id: template.id,
    title: template.title,
    category: template.category,
    description: template.description,
    difficulty: template.difficulty,
    duration: template.duration,
    requirement: template.requirement,
    target: template.target,
    work: template.work,
    monsters: (template.enemyIds ?? [])
      .map(id => monsters.find(monster => monster.id === id))
      .filter((monster): monster is MonsterTemplate => Boolean(monster)),
  }));
}

/** 把辖区标签换算成委托坐标，并对落在河里的抖动做回退。 */
export function districtPin(districtId: DistrictId, salt: string): { x: number; y: number } {
  const region = districts[districtId];
  const baseX = (region.label.x / 1100) * 100;
  const baseY = (region.label.y / 780) * 100;
  for (let attempt = 0; attempt < 6; attempt++) {
    const seed = hashText(`${districtId}:${salt}:${attempt}`);
    const x = Math.max(3, Math.min(97, baseX + ((seed % 61) - 30) / 14));
    const y = Math.max(4, Math.min(96, baseY + ((Math.floor(seed / 61) % 61) - 30) / 16));
    if (districtAt(x, y) === districtId) return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  return { x: Math.round(baseX * 10) / 10, y: Math.round(baseY * 10) / 10 };
}

/** 按辖区环境生成一份夜间委托。 */
function makeCommission(state: GameState, wave: number, slot: number): Mission {
  const pool = commissionPool();
  const template = pool[hashText(`${state.day}:${wave}:${slot}:${districts[districtOrderFor(state.day, wave, slot)].id}`) % pool.length];
  const regionId = template.district ?? districtOrderFor(state.day, wave, slot);
  const region = districts[regionId];
  const window: CommissionWindow = template.window ?? (slot === 0 ? 'long' : 'urgent');
  const spawnAt = shiftStartAt(state.day) + WAVE_AT[wave];
  const pin = districtPin(regionId, `${state.day}-${wave}-${slot}`);
  const longDays = window === 'long'
    ? LONG_MIN_DAYS + (hashText(`long:${state.day}:${wave}:${slot}`) % (LONG_MAX_DAYS - LONG_MIN_DAYS + 1))
    : undefined;
  const snapshot = missionSnapshot(state, regionId, template.target, template.reward);
  const target = snapshot.target + (longDays ? (longDays - 2) * 2 : 0);
  const urgentBonus = window === 'urgent' ? 1.3 : 0.9 + 0.22 * (longDays ?? 2);
  const reward = Math.round(snapshot.reward * urgentBonus);
  return {
    ...clone(template),
    id: `c-${state.day}-${wave}-${slot}-${template.id}`,
    district: regionId,
    window,
    wave,
    longDays,
    spawnedAt: spawnAt,
    deadlineAt: deadlineFor(window, state.day, spawnAt, longDays),
    x: pin.x,
    y: pin.y,
    target,
    reward,
    environment: snapshot.environment,
    pollutionAtSpawn: snapshot.pollutionAtSpawn,
    ownerAtSpawn: snapshot.ownerAtSpawn,
    color: template.templateId ? template.color : `rgb(${region.tint})`,
    category: `${region.name} · ${template.category}`,
    status: 'open',
    squad: [],
    girlId: undefined,
    attempts: 0,
    rounds: template.rounds ?? Math.max(2, Math.floor(template.duration / ROUND_MINUTES)),
    generated: false,
    sourcePack: 'shift',
    recommendedLevel: template.recommendedLevel ?? 3,
  };
}

/** 内容工坊「投放测试」：把一份自制模板直接变成当前夜晚可接的委托。 */
export function deployMissionTemplate(state: GameState, template: MissionTemplate): Mission {
  const regionId = template.district ?? districtOrderFor(state.day, state.shift.wave, 0);
  const region = districts[regionId];
  const pin = districtPin(regionId, `workshop-${template.id}-${state.day}-${state.minutes}-${state.missions.length}`);
  const window = template.window ?? 'urgent';
  const spawnAt = absoluteMinutes(state.day, state.minutes);
  const longDays = window === 'long' ? LONG_MIN_DAYS : undefined;
  const seeded = missionSeed(template);
  // 投放测试的委托同样要冻结环境：否则工坊里看到的数值和玩家接到的不是一份。
  const snapshot = missionSnapshot(state, regionId, seeded.target, seeded.reward);
  return {
    ...seeded,
    target: snapshot.target,
    reward: snapshot.reward,
    environment: snapshot.environment,
    pollutionAtSpawn: snapshot.pollutionAtSpawn,
    ownerAtSpawn: snapshot.ownerAtSpawn,
    id: `w-${state.day}-${state.minutes}-${state.missions.length}-${template.id}`,
    district: regionId,
    window,
    longDays,
    spawnedAt: spawnAt,
    deadlineAt: deadlineFor(window, state.day, spawnAt, longDays),
    x: pin.x,
    y: pin.y,
    category: `${region.name} · ${template.category}`,
    status: 'open',
    squad: [],
    girlId: undefined,
    attempts: 0,
    rounds: template.rounds,
  };
}

/** 把工坊里的弹窗事件卡快照成当前夜晚的 Incident；之后删卡不会破坏已有存档。 */
export function deployIncidentCard(state: GameState, card: IncidentCard): Incident {
  return {
    id: `incident-${card.id}-${state.day}-${state.minutes}-${state.incidents.length}`,
    cardId: card.id,
    day: state.day,
    kind: card.kind,
    source: 'custom',
    title: card.title,
    body: card.body,
    faction: card.faction,
    girlId: card.girlId,
    district: card.district,
    options: card.options.map((option, index) => {
      const { district, ...rest } = option.effect;
      const effect: IncidentEffect = { ...rest };
      if (district) {
        effect.district = {
          id: district.id,
          targetPct: district.targetPct,
          rewardPct: district.rewardPct,
          untilDay: state.day + district.days,
        };
      }
      return { id: `opt-${index + 1}`, label: option.label, hint: option.hint, effect };
    }),
    status: 'pending',
  };
}

const districtRotation = ['candy', 'station', 'plaza', 'greenhouse', 'cathedral', 'crossroad', 'oldtown', 'clocktower', 'docks'] as const;

function districtOrderFor(day: number, wave: number, slot: number): DistrictId {
  return districtRotation[(day * 3 + wave * 4 + slot * 7) % districtRotation.length];
}

/**
 * 推进时间或换日之后调用：先让过期的委托退场，再把该出现的时段委托放上地图。
 * 返回本次变动条数，方便上层决定要不要提示。
 */
export function syncShift(state: GameState): number {
  const now = absoluteMinutes(state.day, state.minutes);
  let changed = 0;
  for (const mission of state.missions) {
    if (mission.storylineId) continue;
    if (mission.status !== 'open' || mission.deadlineAt === undefined) continue;
    if (now < mission.deadlineAt) continue;
    mission.status = 'expired';
    mission.squad = [];
    changed += 1;
    state.logs.unshift({ id: `log-expire-${mission.id}`, time: dateLabel(state.day, state.minutes), kind: 'dispatch', text: `「${mission.title}」超过接取时限，委托已自动撤销。` });
  }
  if (state.minutes < SHIFT_START) return changed;
  if (state.shift.day !== state.day) state.shift = { day: state.day, wave: 0 };
  while (state.shift.wave < WAVE_AT.length && now >= shiftStartAt(state.day) + WAVE_AT[state.shift.wave]) {
    const wave = state.shift.wave;
    const fresh: string[] = [];
    for (let slot = 0; slot < WAVE_SIZES[wave]; slot++) {
      const mission = makeCommission(state, wave, slot);
      if (state.missions.some(existing => existing.id === mission.id)) continue;
      state.missions.unshift(mission);
      fresh.push(`${mission.title}（${mission.window === 'urgent' ? '紧急' : '长期'}）`);
      changed += 1;
    }
    state.shift.wave += 1;
    for (const incident of dueIncidents(state, 'wave', { day: state.day, minutes: state.minutes }, { wave })) {
      state.incidents.unshift(incident);
      markIncidentCooldown(state, incident);
      state.logs.unshift({ id: `log-incident-wave-${incident.id}`, time: dateLabel(state.day, state.minutes), kind: 'incident', text: `第 ${wave + 1} 时段，有人敲了敲窗：${incident.title}。` });
    }
    if (fresh.length) {
      state.logs.unshift({ id: `log-wave-${state.day}-${wave}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `第 ${wave + 1} 时段委托送达：${fresh.join('、')}。` });
    }
  }
  return changed;
}

/** 打烊后清掉上一晚没被接下的短委托；未到期的长期委托留在板上。 */
function closeShift(state: GameState): number {
  const now = absoluteMinutes(state.day, state.minutes);
  const before = state.missions.length;
  const longLeft = state.missions
    .filter(mission => mission.status === 'open' && mission.window === 'long' && (mission.deadlineAt ?? 0) > now)
    .sort((a, b) => (b.deadlineAt ?? 0) - (a.deadlineAt ?? 0))
    .slice(0, 8);
  const kept = new Set(longLeft.map(mission => mission.id));
  state.missions = state.missions.filter(mission => mission.status === 'done' || mission.status === 'active' || kept.has(mission.id) || Boolean(mission.storylineId));
  return before - state.missions.length;
}

export function missionDeadlineLabel(mission: Mission, state: GameState): string {
  if (mission.deadlineAt === undefined) return '';
  return remainingLabel(mission.deadlineAt, absoluteMinutes(state.day, state.minutes));
}

// ---------------------------------------------------------------- 辖区易主
const clamp100 = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** 把一片辖区移交给某个势力。超过单势力上限时拒绝，并留下记录。 */
export function shiftTerritory(state: GameState, districtId: DistrictId, faction: FactionId, source: string): boolean {
  const from = state.territories[districtId];
  if (from === faction) return false;
  if (!canClaim(state.territories, faction)) {
    state.logs.unshift({ id: `log-territory-full-${districtId}-${state.day}-${state.minutes}`, time: dateLabel(state.day, state.minutes), kind: 'territory', text: `${factionName[faction]}的辖区已达 ${rules().territoryLimit} 片上限，${districts[districtId].name}暂时维持现状。` });
    return false;
  }
  state.territories[districtId] = faction;
  state.territoryLog.unshift({ day: state.day, minutes: state.minutes, district: districtId, from, to: faction });
  state.territoryLog = state.territoryLog.slice(0, 60);
  const pair = pairOf(from as FactionId, faction);
  if (pair) applyHostility(state, [{ pair, delta: 6, reason: `${districts[districtId].name}换了手` }]);
  archive(state, '辖区', `${districts[districtId].name}易主`, `${factionName[from]} → ${factionName[faction]}（${source}）`);
  state.logs.unshift({ id: `log-territory-${districtId}-${state.day}-${state.minutes}`, time: dateLabel(state.day, state.minutes), kind: 'territory', text: `${districts[districtId].name}的夜巡权转交给${factionName[faction]}（${source}）。` });
  return true;
}

// ---------------------------------------------------------------- 强制事件
function incidentId(state: GameState, prefix: string): string {
  return `inc-${prefix}-${state.day}-${state.minutes}-${state.incidents.length}`;
}

/** 规则兜底事件：势力施压、环境异常、角色状态。 */
export function makeRuleIncident(state: GameState): Incident | null {
  if (incidentPending(state).length >= INCIDENT_PENDING_LIMIT) return null;
  const strained = state.girls.find(girl => !girl.retired && girl.status !== 'mission' && (girl.corruption >= 60 || girl.fatigue >= 90));
  if (strained) {
    return {
      id: incidentId(state, 'girl'), day: state.day, kind: 'girl', source: 'rule',
      title: `${strained.name}的状态不太对`, girlId: strained.id,
      body: strained.corruption >= 60
        ? `${strained.name}的手背上浮出一层不属于她的纹路。她坚持说没事，但杯子在她手里碎了一次。`
        : `${strained.name}已经连续几晚没有睡整觉，今晚出勤时在门口停了很久才推门进来。`,
      options: [
        { id: 'rest', label: '强制她休息一晚', hint: '损失一次出勤，状态回稳', effect: { girl: { fatigue: -40, corruption: -6, spirit: 12 } } },
        { id: 'clinic', label: '送去月光诊所', hint: '花费 900 星砂，压制侵蚀', effect: { gold: -900, girl: { fatigue: -28, corruption: -12 } } },
        { id: 'push', label: '照常出勤', hint: '保住今晚的人手，代价由她承担', effect: { girl: { fatigue: 6, corruption: 8 }, reputation: 1 } },
      ],
      status: 'pending',
    };
  }
  const weakest = FACTION_ORDER.map(id => ({ id, standing: state.factions[id].standing })).sort((a, b) => a.standing - b.standing)[0];
  if (weakest && weakest.standing < 35) {
    const faction = weakest.id;
    const target = ownedDistricts(state.territories, faction)[0] ?? Object.keys(state.territories)[0] as DistrictId;
    return {
      id: incidentId(state, 'faction'), day: state.day, kind: 'faction', source: 'rule', faction, district: target,
      title: `${factionName[faction]}要一个说法`,
      body: `${factionName[faction]}的联络人没有预约就坐进了会客厅。他把一张辖区地图推过来，指尖停在${districts[target].name}上：这里最近的事，事务所处理得太慢了。`,
      options: [
        { id: 'compensate', label: '赔付星砂并道歉', hint: '花费 800 星砂，关系回稳', effect: { gold: -800, faction: { id: faction, standing: 10 } } },
        { id: 'handover', label: `把${districts[target].name}的夜巡权交出去`, hint: '关系大幅改善，安定度受损', effect: { territory: { id: target, faction }, reputation: -3 } },
        { id: 'refuse', label: '拒绝，按事务所的节奏来', hint: '保住辖区，关系恶化', effect: { faction: { id: faction, standing: -12 }, reputation: 2 } },
      ],
      status: 'pending',
    };
  }
  if (state.shift.wave >= 1) {
    const pool = Object.keys(state.territories) as DistrictId[];
    const district = pool[hashText(`incident:${state.day}:${state.minutes}`) % pool.length];
    return {
      id: incidentId(state, 'env'), day: state.day, kind: 'environment', source: 'rule', district,
      title: `${districts[district].name}的结界出现了裂隙`,
      body: `巡检报告说${districts[district].name}边缘的结界薄了一层。雾从裂隙里渗出来，带着不属于这条街的气味。派人去补，还是先封住？`,
      options: [
        { id: 'repair', label: '立刻派人修补', hint: '花费 500 星砂，安定度上升', effect: { gold: -500, reputation: 2, district: { id: district, targetPct: -3, rewardPct: -5, untilDay: state.day + 1 } } },
        { id: 'seal', label: '先封街，明晚再说', hint: '损失一点安定度，挡住雾', effect: { reputation: -2, district: { id: district, targetPct: 4, rewardPct: -6, untilDay: state.day + 1 } } },
        { id: 'ignore', label: '维持原样', hint: '什么都不做，风险留给下一次', effect: { reputation: -1 } },
      ],
      status: 'pending',
    };
  }
  return null;
}

/**
 * 从内容工坊的「随机池」弹窗里抽一张。
 * roll 取 0–1，保留纯函数以便测试；oncePerDay 会排除当天已经出现过的卡。
 */
export function pickPoolIncidentCard(cards: IncidentCard[], incidents: Incident[], day: number, roll: number): IncidentCard | undefined {
  const pool = cards.filter(card => card.trigger === 'pool' && (!card.oncePerDay || !incidents.some(incident => incident.day === day && incident.cardId === card.id)));
  if (!pool.length) return undefined;
  const total = pool.reduce((sum, card) => sum + Math.max(1, card.weight), 0);
  let point = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const card of pool) {
    point -= Math.max(1, card.weight);
    if (point < 0) return card;
  }
  return pool[pool.length - 1];
}

/** 打烊开门时给随机池一次抽选机会；没配置池卡时什么都不做。 */
function rollPoolIncident(state: GameState): Incident | undefined {
  const cards = customIncidentCards();
  const pool = cards.filter(card => card.trigger === 'pool');
  if (!pool.length || incidentPending(state).length >= INCIDENT_PENDING_LIMIT) return undefined;
  const chance = Math.min(80, 25 + pool.length * 15);
  if (hashText(`pool-chance:${state.day}`) % 100 >= chance) return undefined;
  const card = pickPoolIncidentCard(cards, state.incidents, state.day, (hashText(`pool-roll:${state.day}`) % 10000) / 10000);
  return card ? deployIncidentCard(state, card) : undefined;
}

/** 应用事件选项的效果。 */
/** 某位契约者是不是已经站在某条还没打完的战线上。 */
function girlInFront(state: GameState, girlId: string): boolean {
  return (state.fronts ?? []).some(front => (front.status === 'open' || front.status === 'joined') && (front.squad ?? []).includes(girlId));
}

export function applyIncidentEffect(state: GameState, incident: Incident, effect: Incident['options'][number]['effect']): void {
  if (effect.gold) {
    state.gold = Math.max(0, state.gold + effect.gold);
    book(state, state.day, effect.gold);
  }
  if (effect.reputation) state.reputation = clamp100(state.reputation + effect.reputation);
  if (effect.faction) {
    const record = state.factions[effect.faction.id];
    record.standing = clamp100(record.standing + effect.faction.standing);
  }
  const girl = incident.girlId ? findGirl(state, incident.girlId) : undefined;
  if (girl && effect.girl) {
    if (effect.girl.fatigue) girl.fatigue = clamp100(girl.fatigue + effect.girl.fatigue);
    if (effect.girl.spirit) girl.spirit = Math.max(0, Math.min(effectiveMaxSpirit(girl), girl.spirit + effect.girl.spirit));
    if (effect.girl.bond) girl.bond = clamp100(girl.bond + effect.girl.bond);
    if (effect.girl.corruption) {
      if (effect.girl.corruption > 0) addCorruption(state, girl, effect.girl.corruption);
      else girl.corruption = clamp100(girl.corruption + effect.girl.corruption);
    }
  }
  if (effect.territory) shiftTerritory(state, effect.territory.id, effect.territory.faction, `事件「${incident.title}」`);
  if (effect.hostility) {
    applyHostility(state, [incidentHostility(effect.hostility.pair, effect.hostility.delta, incident.source === 'llm')]);
  }
  if (effect.district) {
    // 临时修正直接落到该辖区还没接的委托上，省掉一层状态。
    for (const mission of state.missions) {
      if (mission.status !== 'open' || (mission.district ?? '') !== effect.district.id) continue;
      if (effect.district.targetPct) mission.target = Math.max(10, applyPct(mission.target, effect.district.targetPct));
      if (effect.district.rewardPct) mission.reward = Math.max(0, applyPct(mission.reward, effect.district.rewardPct));
    }
  }
  state.logs.unshift({ id: `log-incident-${incident.id}`, time: dateLabel(state.day, state.minutes), kind: 'incident', text: `「${incident.title}」已决：${incident.options.find(option => option.id === incident.choiceId)?.label ?? '维持现状'}。` });
}

// ---------------------------------------------------------------- 故事线
const storyBeats = [
  { title: '第一幕 · 未寄出的信', scene: '她把一封信放在桌上，没有推向你，也没有收回去。', hook: '信纸边缘有一道被反复折过的痕。' },
  { title: '第二幕 · 旧名字', scene: '旧城区的路灯下，她念出一个名字，然后立刻否认自己认识这个人。', hook: '那个名字写在辖区的旧档案里。' },
  { title: '第三幕 · 雨里的选择', scene: '雨把整条糖果街洗得发亮。她站在街口，等你先说要去哪。', hook: '她今晚没有带伞。' },
  { title: '第四幕 · 回到会客厅', scene: '回到会客厅时已经快打烊了。她坐在那把多出来的椅子上，第一次没有先开口。', hook: '桌上放着两杯还温着的茶。' },
];

function storyChoices(beat: number, girl: Girl): Storyline['beats'][number]['choices'] {
  const warm = { id: 'warm', label: '先听她说完', intent: '把这一晚留给她', effect: { bond: 4, corruption: -2 } };
  const push = { id: 'push', label: '追问下去', intent: '把话挑明', effect: { bond: -2, corruption: 3 } };
  const work = { id: 'work', label: '先去处理街上的事', intent: '把委托放在前面', effect: { gold: 320, bond: -3, reputation: 1 } };
  if (beat % 2 === 0) return [warm, push, work];
  const promise = { id: 'promise', label: '答应她一个具体的未来', intent: '给出可以兑现的承诺', effect: { bond: 6, corruption: -3, trigger: { kind: 'dialogue', topic: '夜里的约定', prompt: `和${girl.name}聊聊今晚答应她的那件事。` } } };
  return [promise, warm, work];
}

const storyRank: Record<string, number> = { 简单: 1, 常规: 2, 棘手: 3, 危险: 4 };

/** 把一幕的委托目标落成地图上的特殊委托。奖励与目标由难度在本地计算，不交给模型。 */

function storyGraphNode(story: Storyline, id: string) {
  return story.graph?.nodes.find(node => node.id === id);
}

function storyGraphEdge(story: Storyline, nodeId: string, port = 'out') {
  return story.graph?.edges.find(edge => edge.from === nodeId && (
    port === 'out' || edge.fromPort === port || (port === 'success' && edge.fromPort === 'out')
  ));
}

export function startStoryGraph(state: GameState, story: Storyline): void {
  if (!story.graph) return;
  story.run = { cursor: story.graph.entry, visited: [], steps: 0 };
  advanceStoryGraph(state, story);
}

export function advanceStoryGraph(state: GameState, story: Storyline): void {
  if (!story.graph || !story.run || story.status !== 'active') return;
  const girl = state.girls.find(item => item.id === story.girlId);
  if (!girl) { story.status = 'abandoned'; return; }
  for (let guard = 0; guard < 64; guard += 1) {
    const run = story.run;
    if (!run) return;
    const node = storyGraphNode(story, run.cursor);
    if (!node) { story.status = 'abandoned'; return; }
    run.visited.push(node.id);
    run.steps += 1;
    if (run.steps > 512) { run.stalled = true; return; }
    const step = (port = 'out') => {
      const edge = storyGraphEdge(story, node.id, port);
      if (!edge) { story.status = 'abandoned'; return false; }
      run.cursor = edge.to;
      return true;
    };

    if (node.kind === 'start') { if (!step()) return; continue; }
    if (node.kind === 'scene') {
      if (node.data.kind === 'scene' && node.data.narration) {
        state.logs.unshift({ id: 'log-graph-' + story.id + '-' + run.steps, time: dateLabel(state.day, state.minutes), kind: 'story', text: node.data.narration.slice(0, 240) });
      }
      if (!step()) return;
      continue;
    }
    if (node.kind === 'reward') {
      if (node.data.kind === 'reward') {
        applyStoryEffect(state, girl, node.data.effect ?? {}, '剧情「' + story.title + '」');
        if (node.data.equipmentId) state.inventory[node.data.equipmentId] = (state.inventory[node.data.equipmentId] ?? 0) + 1;
        const trait = node.data.trait;
        if (trait?.name && !girl.traits.some(item => item.name === trait.name)) {
          girl.traits.push({ id: 'trait-' + hashText(trait.name), name: trait.name, polarity: 'neutral', tags: ['剧情'], description: trait.description });
        }
      }
      if (!step()) return;
      continue;
    }
    if (node.kind === 'choice') {
      run.waiting = { kind: 'choice', ref: node.id };
      return;
    }
    if (node.kind === 'mission') {
      if (node.data.kind !== 'mission') return;
      const beat: StoryBeat = {
        id: node.id, index: story.beats.length, title: node.title, summary: '', scene: '', hook: '',
        choices: [], status: 'open', mission: node.data.spec,
      };
      story.beats.push(beat);
      const mission = storyMissionForBeat(state, story, beat);
      state.missions.unshift(mission);
      beat.missionId = mission.id;
      run.waiting = { kind: 'mission', ref: mission.id };
      return;
    }
    if (node.kind === 'incident') {
      if (node.data.kind !== 'incident') return;
      const spec = node.data.spec;
      const card = spec.cardId ? customIncidentCards().find(entry => entry.id === spec.cardId) : undefined;
      const incident: Incident = card
        ? { ...deployIncidentCard(state, card), id: 'inc-' + story.id + '-' + node.id, storylineId: story.id }
        : {
          id: 'inc-' + story.id + '-' + node.id, day: state.day, kind: spec.kind, source: 'rule',
          title: spec.title || node.title, body: spec.body,
          faction: spec.faction, district: spec.district,
          options: spec.options.map((option, index) => ({ id: 'o' + (index + 1), label: option.label, hint: option.hint, effect: option.effect })),
          status: 'pending', storylineId: story.id,
        };
      state.incidents.unshift(incident);
      run.waiting = { kind: 'incident', ref: incident.id };
      return;
    }
    if (node.kind === 'opinion') {
      if (node.data.kind !== 'opinion') return;
      const spec = node.data.spec;
      const faction = spec.options.find(option => option.shift)?.shift?.faction;
      const opinion: Opinion = {
        id: 'op-' + story.id + '-' + node.id, day: state.day, authorId: girl.id, topic: spec.topic,
        title: spec.title || node.title, text: spec.text, request: spec.request, status: 'pending', faction,
        options: spec.options.map((option) => ({ id: option.id, label: option.label, effect: option.effect, shift: option.shift, changes: [], outcomes: [] })),
        storylineId: story.id,
      };
      state.opinions.unshift(opinion);
      run.waiting = { kind: 'opinion', ref: opinion.id };
      return;
    }
    if (node.kind === 'event') {
      const event = addEvent(state, girl, node.data.kind === 'event' ? node.data.title || node.title : node.title, node.data.kind === 'event' ? node.data.hook : '', 'story', story.id);
      event.storyNodeId = node.id;
      run.waiting = { kind: 'event', ref: event.id };
      return;
    }
    if (node.kind === 'wait') {
      const days = node.data.kind === 'wait' ? node.data.days ?? 0 : 0;
      const minutes = node.data.kind === 'wait' ? node.data.minutes ?? 0 : 0;
      if (days * 1440 + minutes <= 0) { if (!step()) return; continue; }
      run.waiting = { kind: 'wait', ref: node.id, until: absoluteMinutes(state.day, state.minutes) + days * 1440 + minutes };
      return;
    }
    if (node.kind === 'end') {
      story.status = 'done';
      story.run = undefined;
      const ending = endingLabel(node);
      story.ending = ending || undefined;
      archive(state, '关系', girl.name + '的故事', node.data.kind === 'end' ? node.data.summary || story.premise : story.premise);
      state.logs.unshift({
        id: 'log-graph-end-' + story.id,
        time: dateLabel(state.day, state.minutes),
        kind: 'story',
        text: ending ? '「' + story.title + '」走到结局：' + ending + '。' : '「' + story.title + '」收束了。',
      });
      return;
    }
    return;
  }
}

export function resolveStoryWait(state: GameState, storylineId: string, kind: 'mission' | 'incident' | 'opinion' | 'event' | 'choice' | 'wait', ref: string, result: 'success' | 'failure' = 'success'): void {
  const story = state.storylines.find(item => item.id === storylineId && item.status === 'active');
  if (!story?.run || !story.graph) return;
  if (story.run.waiting?.kind !== kind || story.run.waiting.ref !== ref) return;
  let fromNode = ref;
  if (kind === 'mission') fromNode = story.beats.find(beat => beat.missionId === ref)?.id ?? ref;
  if (kind === 'event') fromNode = state.events.find(event => event.id === ref)?.storyNodeId ?? ref;
  const port = kind === 'mission' ? (result === 'failure' ? 'failure' : 'success') : 'out';
  const edge = storyGraphEdge(story, fromNode, port);
  story.run.waiting = undefined;
  if (!edge) {
    story.status = 'done';
    story.run = undefined;
    const girl = state.girls.find(item => item.id === story.girlId);
    state.logs.unshift({
      id: `log-graph-stop-${story.id}-${Date.now()}`,
      time: dateLabel(state.day, state.minutes),
      kind: 'story',
      text: result === 'failure'
        ? `「${story.title}」没能继续下去，${girl?.name ?? '她'}的故事在这里收束。`
        : `「${story.title}」没有接续的节点，故事在这里收束。`,
    });
    return;
  }
  story.run.cursor = edge.to;
  advanceStoryGraph(state, story);
}

export function planToStoryline(girl: Girl, plan: StoryPlan, day: number, minutes: number): Storyline {
  const graph = plan.graph ?? ensureGraph(plan);
  const beats = plan.beats.length ? plan.beats.map((beat, index) => ({
    ...beat,
    id: `plan-${index + 1}`,
    index,
    choices: beat.choices.map((choice, at) => ({ ...choice, id: `c${at + 1}` })),
    status: (index === 0 ? 'open' : 'locked') as StoryBeat['status'],
    missionId: undefined,
    eventId: undefined,
    resolvedChoiceId: undefined,
    resolvedAt: undefined,
  })) : graphBeats(graph);
  return {
    id: `story-manual-${girl.id}-${day}-${minutes}`,
    girlId: girl.id, title: plan.title.slice(0, 40), premise: plan.premise.slice(0, 400), tone: plan.tone.slice(0, 40),
    beats, stage: 0, status: 'active', createdAt: new Date().toISOString(), day, source: 'manual',
    graph,
  };
}
export function storyMissionForBeat(state: GameState, story: Storyline, beat: StoryBeat): Mission {
  const spec = beat.mission;
  const rank = storyRank[spec?.difficulty ?? '常规'] ?? 2;
  const district = spec?.district ?? districtAt(20 + (hashText(`${story.id}:${beat.id}`) % 58), 25 + (hashText(beat.id) % 50));
  const region = districts[district];
  const duration = Math.max(60, Math.min(180, Math.round(spec?.duration ?? 90)));
  const pin = districtPin(district, `${story.id}:${beat.id}`);
  const now = absoluteMinutes(state.day, state.minutes);
  const target = applyPct(spec?.target ?? 45 + rank * 7, region.effect.targetPct);
  const reward = applyPct(260 + rank * 120, region.effect.rewardPct);
  const companionId = spec?.companion ? ensureStoryCompanion(state, story, beat) : undefined;
  const monsters = spec?.monsters ?? [];
  if (monsters.length) {
    state.customMonsters ??= [];
    for (const monster of monsters) if (!state.customMonsters.some(item => item.id === monster.id)) state.customMonsters.push(monster);
  }
  return {
    id: `sm-${story.id}-${beat.id}`,
    title: (spec?.title ?? beat.title).slice(0, 40),
    category: `${region.name} · 故事委托`,
    description: (beat.summary || beat.hook).slice(0, 240),
    x: pin.x, y: pin.y,
    difficulty: spec?.difficulty ?? '常规',
    duration,
    reward,
    requirement: spec?.requirement ?? 'insight',
    target,
    color: `rgb(${region.tint})`,
    status: 'open',
    squad: [],
    work: monsters.length ? 'combat' : 'investigation',
    enemyIds: monsters.length ? monsters.map(monster => monster.id).slice(0, MAX_ENEMIES) : undefined,
    rounds: monsters.length ? Math.max(2, Math.ceil(duration / ROUND_MINUTES)) : undefined,
    attempts: 0,
    recommendedLevel: 3,
    district,
    window: 'long',
    longDays: 2,
    spawnedAt: now,
    deadlineAt: deadlineFor('long', state.day, now, 2),
    generated: false,
    sourcePack: 'story',
    storylineId: story.id,
    storyBeatId: beat.id,
    storyGoal: (spec?.goal ?? `完成「${beat.title}」：${beat.hook}`).slice(0, 200),
    requiredGirlId: companionId ?? spec?.requiredGirlId,
    rewardEquipmentId: spec?.rewardEquipment ? registerItem({ ...spec.rewardEquipment, id: spec.rewardEquipment.id || `relic-${hashText(`${story.id}:${beat.id}`).toString(16)}` }).id : undefined,
  };
}

/** 为故事线当前这一幕发出委托；已经发过则不重复。 */
function ensureStoryCompanion(state: GameState, story: Storyline, beat: StoryBeat): string {
  const spec = beat.mission;
  if (!spec?.companion) return '';
  const id = `sg-${hashText(`${story.id}:${beat.id}`).toString(16).padStart(8, '0')}`;
  const known = state.girls.find(girl => girl.id === id) ?? state.candidates.find(girl => girl.id === id);
  if (known) return known.id;
  const c = spec.companion;
  const stats = { magic: 58, insight: 58, agility: 58, empathy: 58 };
  const baseMaxHp = Math.round(96 + stats.empathy * 0.3) + 6;
  state.candidates.unshift(hydrate({
    id, name: c.name.slice(0, 12), codename: c.codename.slice(0, 10) || '羁绊协奏', title: '被故事带进事务所的少女',
    element: c.element, color: c.color ?? '#e6a8c8', portrait: '', level: 6,
    hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 88, maxSpirit: 88,
    fatigue: 0, bond: 12, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '', skills: ['glimmer-spear', 'peach-ward', 'starlight-fall'], description: c.appearance.slice(0, 160),
    cost: 2400, scars: [], relationships: {}, archetype: c.archetype, quote: c.quote ?? '……我跟着她来的。',
    goal: '弄清自己为什么会出现在这条故事里。', goalKind: '成长', traits: [], conditions: [],
    contractEndDay: 24, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
    appearance: c.appearance.slice(0, 160), personality: c.personality.slice(0, 160),
    outfitDescription: c.outfitDescription.slice(0, 160),
    wardrobe: [], outfitId: 'uniform', expression: 'calm', corruption: 0, equipment: {},
    candidateUntilDay: state.day + 6,
  }));
  return id;
}

export function spawnStoryBeat(state: GameState, story: Storyline): Mission | null {
  if (story.status !== 'active') return null;
  if (story.stage >= story.beats.length) { story.status = 'done'; return null; }
  const beat = story.beats[story.stage];
  if (!beat.mission) { beat.status = 'open'; return null; }
  if (beat.missionId) {
    const existing = state.missions.find(item => item.id === beat.missionId);
    if (existing) return existing;
  }
  const mission = storyMissionForBeat(state, story, beat);
  beat.missionId = mission.id;
  beat.status = 'open';
  state.missions.unshift(mission);
  state.logs.unshift({
    id: `log-story-beat-${story.id}-${beat.id}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'story',
    text: `「${story.title}」${beat.title}：她给出了一份特殊委托——${mission.title}。`,
  });
  return mission;
}

/** 故事委托完成：标记这一幕，并生成她单独的剧情事件。 */
export function completeStoryMission(state: GameState, mission: Mission): CharacterEvent | undefined {
  if (!mission.storylineId || !mission.storyBeatId) return undefined;
  const story = state.storylines.find(item => item.id === mission.storylineId);
  if (!story || story.status !== 'active') return undefined;
  const beat = story.beats.find(item => item.id === mission.storyBeatId);
  const girl = findGirl(state, story.girlId);
  if (!beat || !girl) return undefined;
  beat.status = 'done';
  if (story.run) { resolveStoryWait(state, story.id, 'mission', mission.id, 'success'); return undefined; }
  if (beat.eventId && state.events.some(event => event.id === beat.eventId)) return undefined;
  const spec = beat.mission;
  if (spec?.rewardEquipment) {
    const item = registerItem({ ...spec.rewardEquipment, id: mission.rewardEquipmentId ?? spec.rewardEquipment.id });
    state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
    state.logs.unshift({ id: `log-story-relic-${beat.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `委托带回了一件只属于她的东西：${item.name}。已放进事务所背包。` });
  }
  if (spec?.followUpIncident) {
    const incident: Incident = { ...spec.followUpIncident, id: `inc-story-${beat.id}-${state.day}`, day: state.day, status: 'pending', source: spec.followUpIncident.source ?? 'rule' };
    state.incidents.unshift(incident);
    state.incidents = state.incidents.slice(0, 5);
    state.logs.unshift({ id: `log-story-incident-${beat.id}`, time: dateLabel(state.day, state.minutes), kind: 'incident', text: `${girl.name}的事刚放下，桌上又多了一件必须现在决定的事。` });
  }
  const event = addEvent(state, girl, beat.title, beat.hook, 'story', story.id);
  event.scenes[0].narration = `委托「${mission.title}」结束了。${mission.storyGoal ? `她做到了：${mission.storyGoal}` : ''}回到会客厅时，她还有别的想说的。`;
  if (spec?.followUpEvent && spec.followUpEvent.title) {
    event.scenes.push({
      id: `${event.id}-extra`,
      title: spec.followUpEvent.title.slice(0, 30),
      narration: spec.followUpEvent.hook.slice(0, 400),
      lines: [{ speaker: girl.name, text: spec.followUpEvent.hook.slice(0, 120) }],
      choices: [],
    });
  }
  beat.eventId = event.id;
  event.mode = 'story';
  event.passages = [];
  event.passageIndex = 0;
  event.pending = true;
  state.logs.unshift({ id: `log-story-done-${beat.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `「${story.title}」${beat.title}的委托完成，她的事件已经就绪。` });
  return event;
}

/** 故事委托失败：走「失败」出口；没有失败出口时故事在这里收束。 */
function failStoryMission(state: GameState, mission: Mission, reason: string): void {
  if (!mission.storylineId || !mission.storyBeatId) return;
  const story = state.storylines.find(item => item.id === mission.storylineId && item.status === 'active');
  if (!story) return;
  const beat = story.beats.find(item => item.id === mission.storyBeatId);
  if (beat) beat.status = 'done';
  state.logs.unshift({
    id: `log-story-fail-${mission.id}-${Date.now()}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'story',
    text: `「${mission.title}」${reason}，故事走向了另一条路。`,
  });
  if (!story.run) { story.status = 'done'; return; }
  resolveStoryWait(state, story.id, 'mission', mission.id, 'failure');
}

/** 剧情事件结束：推进到下一幕，并发出下一份委托。 */
export function finishStoryEvent(state: GameState, event: CharacterEvent): void {
  if (!event.storylineId) return;
  const story = state.storylines.find(item => item.id === event.storylineId && item.status === 'active');
  if (!story) return;
  if (story.run) { resolveStoryWait(state, story.id, 'event', event.id); return; }
  const beat = story.beats.find(item => item.eventId === event.id);
  const girl = findGirl(state, story.girlId);
  if (!beat) return;
  story.stage = Math.max(story.stage, beat.index + 1);
  if (girl) girl.bond = Math.min(100, girl.bond + 5);
  if (story.stage >= story.beats.length) {
    story.status = 'done';
    if (girl) archive(state, '关系', `${story.title}（完）`, `${girl.name}的故事走到最后一幕，选择由你做出。`);
    state.logs.unshift({ id: `log-story-fin-${story.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `「${story.title}」讲完了。` });
    return;
  }
  spawnStoryBeat(state, story);
  state.logs.unshift({ id: `log-story-next-${story.id}-${story.stage}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `「${story.title}」进入${story.beats[story.stage].title}。` });
}

/** 不依赖 LLM 也能走完的模板故事线；LLM 可用时由 App 换成生成版。 */
export function buildTemplateStoryline(state: GameState, girl: Girl, direction = ''): Storyline {
  const tone = direction.trim() || ['旧事', '契约', '城市传说'][hashText(`${girl.id}:${state.day}`) % 3];
  return {
    id: `story-${girl.id}-${state.day}-${state.minutes}`,
    girlId: girl.id,
    title: `${girl.name}的${tone}`,
    premise: `${girl.name}有一件一直没说的事。它和${districts[districtAt(30 + (hashText(girl.id) % 40), 40)].name}有关，也可能和你有关。`,
    tone,
    beats: storyBeats.map((beat, index) => {
      const beatDistrict = districtAt(20 + ((hashText(girl.id) + index * 17) % 58), 25 + ((hashText(beat.title) + index * 11) % 50));
      return {
        id: `beat-${index + 1}`,
        index,
        title: beat.title,
        summary: '',
        scene: beat.scene,
        hook: beat.hook,
        choices: storyChoices(index, girl),
        mission: {
          title: beat.title.replace(/^第.幕 · /, ''),
          goal: `完成「${beat.title.replace(/^第.幕 · /, '')}」：${beat.hook}`,
          category: '故事委托',
          difficulty: ['简单', '常规', '棘手', '危险'][index] ?? '常规',
          duration: 90,
          district: beatDistrict,
        },
        status: index === 0 ? 'open' : 'locked',
      };
    }),
    stage: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
    day: state.day,
    source: 'template',
  };
}

/** 故事线效果落地：资源、羁绊、侵蚀、特性，以及它触发的其他内容。 */
export function applyStoryEffect(state: GameState, girl: Girl, effect: StoryEffect, source: string): void {
  if (effect.gold) {
    state.gold = Math.max(0, state.gold + effect.gold);
    book(state, state.day, effect.gold);
  }
  if (effect.reputation) state.reputation = clamp100(state.reputation + effect.reputation);
  if (effect.bond) girl.bond = clamp100(girl.bond + effect.bond);
  if (effect.corruption) {
    if (effect.corruption > 0) addCorruption(state, girl, effect.corruption);
    else girl.corruption = clamp100(girl.corruption + effect.corruption);
  }
  if (effect.trait) {
    girl.traits.push({ id: `story-trait-${hashText(effect.trait.name).toString(16)}`, name: effect.trait.name.slice(0, 16), polarity: 'positive', tags: ['故事线'], description: effect.trait.description.slice(0, 120), gainedAt: dateLabel(state.day, state.minutes) });
  }
  if (effect.skill) {
    const skill = getSkill(effect.skill.id);
    if (!girl.skills.includes(skill.id)) {
      girl.skills.push(skill.id);
      state.logs.unshift({ id: `log-story-skill-${girl.id}-${skill.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}在故事里学会了「${skill.name}」。` });
    }
  }
  if (effect.growth) {
    for (const key of Object.keys(effect.growth) as StatKey[]) {
      const amount = effect.growth[key] ?? 0;
      if (!amount) continue;
      girl.stats[key] = Math.max(20, Math.min(99, girl.stats[key] + amount));
    }
  }
  if (effect.buff?.name) {
    const buff = effect.buff;
    girl.conditions.push({
      id: `cond-story-${girl.id}-${hashText(buff.name).toString(16)}-${state.day}-${state.minutes}`,
      name: buff.name.slice(0, 16),
      kind: 'buff',
      source,
      description: (buff.description ?? '故事带来的临时状态。').slice(0, 120),
      remaining: Math.max(1, buff.days ?? 3),
      removable: true,
      stat: buff.stat,
      amount: buff.amount,
    });
  }
  if (effect.trigger) fireStoryTrigger(state, girl, effect.trigger, source);
}

/** 故事线的高潮会向事务所抛出真实的内容：委托、议题、事件、对话或辖区变动。 */
export function fireStoryTrigger(state: GameState, girl: Girl, trigger: StoryTrigger, source: string): void {
  const now = absoluteMinutes(state.day, state.minutes);
  if (trigger.kind === 'territory') {
    shiftTerritory(state, trigger.district, trigger.faction, source);
    return;
  }
  if (trigger.kind === 'dialogue') {
    girl.pendingTalk = { topic: trigger.topic.slice(0, 24), prompt: trigger.prompt.slice(0, 240), day: state.day };
    state.logs.unshift({ id: `log-story-talk-${girl.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}在会客厅等你，说有话要谈。` });
    return;
  }
  if (trigger.kind === 'opinion') {
    const opinion = makeOpinion(state, girl, trigger.topic, trigger.title.slice(0, 40), trigger.text.slice(0, 240), trigger.request.slice(0, 80), { faction: trigger.shift?.faction, district: trigger.shift?.district });
    if (trigger.shift) opinion.options[0].shift = trigger.shift;
    state.opinions.unshift(opinion);
    return;
  }
  if (trigger.kind === 'incident') {
    state.incidents.unshift({
      id: incidentId(state, 'story'), day: state.day, kind: trigger.incidentKind, source: 'rule',
      title: trigger.title.slice(0, 40), body: trigger.body.slice(0, 320), girlId: girl.id,
      options: trigger.options, status: 'pending',
    });
    return;
  }
  if (trigger.kind === 'event') {
    addEvent(state, girl, trigger.title, trigger.hook, source);
    return;
  }
  const district = trigger.district ?? districtAt(20 + (hashText(girl.id) % 60), 25 + (hashText(trigger.title) % 50));
  const pool = commissionPool();
  const template = pool[hashText(`${girl.id}:${trigger.title}`) % pool.length];
  const pin = districtPin(district, `${girl.id}:${state.day}`);
  const spawnAt = now;
  state.missions.unshift({
    ...clone(template),
    id: `s-${state.day}-${state.minutes}-${girl.id}`,
    title: trigger.title.slice(0, 40),
    category: `${districts[district].name} · 故事线`,
    description: trigger.description.slice(0, 240),
    district,
    window: 'long',
    longDays: 2,
    wave: state.shift.wave,
    spawnedAt: spawnAt,
    deadlineAt: deadlineFor('long', state.day, spawnAt, 2),
    x: pin.x,
    y: pin.y,
    status: 'open',
    storylineId: state.storylines.find(story => story.girlId === girl.id && story.status === 'active')?.id,
    squad: [],
    attempts: 0,
    generated: false,
    sourcePack: 'story',
    duration: trigger.duration ?? template.duration,
    target: applyPct(template.target, districts[district].effect.targetPct),
    reward: applyPct(template.reward, districts[district].effect.rewardPct),
  });
  state.logs.unshift({ id: `log-story-mission-${girl.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}的故事把一份委托带上了地图：${trigger.title}。` });
}

// ---------------------------------------------------------------- 角色事件
function addEvent(state: GameState, girl: Girl, title: string, hook: string, source: string, storylineId?: string): CharacterEvent {
  const event: CharacterEvent = {
    id: `evt-${girl.id}-${state.day}-${state.events.length}`,
    girlId: girl.id,
    storylineId,
    title: title.slice(0, 40),
    hook: hook.slice(0, 240),
    scenes: [
      { id: 'scene-1', title: '开场', narration: `${genderOf(girl)}在会客厅等你，桌上的茶已经凉了一半。`, lines: [{ speaker: girl.name, tone: '低声', text: hook.slice(0, 160) }] },
      {
        id: 'scene-2', title: '抉择', narration: '她把选择留给你，自己只是看着窗外。',
        lines: [{ speaker: girl.name, tone: '平静', text: '你打算怎么做？我听你的。' }],
        choices: [
          { id: 'stay', label: '留下，把这一晚给她', intent: '陪伴', effect: { bond: 6, corruption: -3 } },
          { id: 'ask', label: '先问清楚她想要什么', intent: '把决定权还给她', effect: { bond: 3, corruption: 1 } },
          { id: 'leave', label: '让她先休息，明晚再谈', intent: '保持距离', effect: { bond: -2, gold: 200 } },
        ],
      },
    ],
    stage: 0,
    status: 'active',
    day: state.day,
    source: source === 'llm' ? 'llm' : 'template',
    badge: true,
  };
  state.events.unshift(event);
  girl.eventBadge = '新';
  state.logs.unshift({ id: `log-event-${event.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}有一段只会在今晚发生的事：${event.title}。` });
  return event;
}

/** 无 Key 时的兜底剧情：四幕、每幕两百多字，选项只给轻度数值变化。 */
export function buildTemplateArc(girl: Girl, premise: string, hook: string): StoryPassage[] {
  const name = girl.name;
  return [
    {
      id: 'p1', title: '第一幕 · 等到灯灭',
      narration: `夜班的钟走到一半，${name}才出现在门口。她没有敲门，只是站在那里，手指在袖口里反复摩挲着什么。会客厅的灯把她影子拉得很长，一直铺到你脚边。${hook ? `${hook.replace(/[。！？]$/, '')}。` : ''}窗外有人在关店，卷帘门落下的声音一层层传上来，像某种提醒：再不说，就天亮了。她抬眼看你，又很快移开，像在确认你有没有在看她。你忽然想起她今天本该休息，委托表上那一行被她自己划掉了，理由只写了三个字：想走走。她没说要去哪里，也没有带你。现在她站在这里，鞋底还沾着外面的雨。你侧过身，把门口的位置让出来，又觉得这个动作太像在等她解释，于是只是把门推得更开了一点。`,
      lines: [
        { speaker: name, tone: '轻声', text: '我是不是来得不是时候。' },
        { speaker: '你', tone: '', text: '你来了就是时候。' },
      ],
      choices: [
        { id: 'p1-a', label: '把椅子往她那边挪一点', intent: '让她知道你想听', effect: { bond: 3 } },
        { id: 'p1-b', label: '先不催她，去倒一杯热水', intent: '把节奏交给她', effect: { bond: 2, corruption: -1 } },
      ],
    },
    {
      id: 'p2', title: '第二幕 · 那件旧事',
      narration: `水汽在杯口散开，她终于开口，说的却是与今晚无关的旧事。${premise ? `「${premise.replace(/[。！？]$/, '')}」这件事，她一直没跟任何人讲完。` : '她讲起刚签下契约的那几个月，说自己那时候连影子都不敢照镜子。'}说到这里她停住，指腹在杯壁上按出一个小小的印子，像是在衡量你会不会笑她。你没有接话，房间里只剩下呼吸和远处的车声。她忽然补了一句：其实我不怕你笑，我怕你记不住。你问她那句话是什么意思，她想了想，说记不住也没关系，反正她自己也快记不清了。说完她低头笑了一下，笑意没有到眼睛里。窗外有车经过，灯光扫过她的侧脸，又退回去，房间里重新只剩下那盏没关的台灯。`,
      lines: [
        { speaker: name, tone: '停顿', text: '……你是不是觉得我很奇怪。' },
        { speaker: '你', tone: '', text: '我在听。' },
      ],
      choices: [
        { id: 'p2-a', label: '问她后来是怎么撑过来的', intent: '让她把故事讲完', effect: { bond: 3, corruption: 1 } },
        { id: 'p2-b', label: '告诉她，你记得她第一次出任务的样子', intent: '把记忆还给她', effect: { bond: 4 } },
      ],
    },
    {
      id: 'p3', title: '第三幕 · 没说出口的',
      narration: `${name}把杯子放回桌面，动作轻得像怕惊动什么。她说起今晚那件事的结尾，声音比刚才低，句子也开始不完整。你听得出她在绕开某个名字、某段路、某一次没能救下的结果。窗外开始起雾，玻璃上凝出一层白，把城市揉得模糊。她抬手在雾上画了一道，又立刻擦掉，像在替自己收回一句不该说的话。你忽然明白，她不是在求你替她解决什么，她只是想有一个人知道，那一晚她其实也害怕。你没有催她，只把灯调暗了一点。她顺着这个动作继续说，说到某个名字时停了两秒，然后换了个说法绕过去。你知道那里有一道她还没准备好的口子，就没有去碰。她也没有再解释，只是把杯子往你这边推了推，像是把话题也一起推过来。`,
      lines: [
        { speaker: name, tone: '低声', text: '你会不会觉得，我不该怕。' },
        { speaker: '你', tone: '', text: '会怕，才说明你在乎。' },
      ],
      choices: [
        { id: 'p3-a', label: '承认你也怕过', intent: '与她站在同一边', effect: { bond: 4, corruption: -1 } },
        { id: 'p3-b', label: '把她的手从杯子上拿开', intent: '先让她停下来', effect: { bond: 3, corruption: 1 } },
      ],
    },
    {
      id: 'p4', title: '第四幕 · 天亮之前',
      narration: `${name}站起身，走到窗边，把雾擦出一小块清楚的地方。她说，那就这样吧，明天还有委托。语气恢复成平时的样子，好像刚才那一小时没有发生过。但她没有立刻走，而是回头看了你一眼，把一样东西留在桌上——不是信，也不是礼物，只是一张写着字的便签：下次别让我一个人说这么久。门合上之后，走廊的灯还亮着，你听见她的脚步在楼梯拐角停了一下，才继续往下。会客厅重新安静下来，杯子里剩的水已经凉透了。你坐了一会儿，才想起明天还有一整个夜班的委托要排。把便签收好之后，你在值班表上她那一栏多画了一个圈，提醒自己别再把她的名字排在最后一个。走廊尽头传来电梯到站的声音，又安静下去，像这一晚终于肯放过你。`,
      lines: [
        { speaker: name, tone: '回头', text: '晚安。明天见。' },
        { speaker: '你', tone: '', text: '明天见。' },
      ],
      choices: [
        { id: 'p4-a', label: '把那张便签收进抽屉', intent: '记住这一晚', effect: { bond: 4, corruption: -2 } },
        { id: 'p4-b', label: '追出去，送她到街口', intent: '不让这一晚就到这里', effect: { bond: 5, corruption: 1 } },
      ],
    },
  ];
}

function genderOf(girl: Girl): string {
  return girl.appearance?.includes('他') && !girl.appearance?.includes('她') ? '他' : '她';
}


export function createInitialState(pack: ContentPack = createSeedPack(), seed = pack.hash): GameState {
  const all = pack.girls.map(hydrate);
  const zhiIndex = all.findIndex(g => g.id === 'zhi');
  if (zhiIndex >= 0) {
    const zhi = all[zhiIndex];
    zhi.retired = true; zhi.retiredReason = 'contract'; zhi.status = 'retired';
    zhi.contractEndDay = 14; zhi.pensionMissed = 0;
  }
  const hired = all.filter(g => g.id !== 'lu');
  const candidates = all.filter(g => g.id === 'lu');
  if (candidates[0]) candidates[0] = { ...candidates[0], level: 6, cost: 3200, status: 'idle' };
  const rooms = [
    { id: 'lounge', name: '会客厅', type: 'lounge' as const, level: 2, capacity: 0, description: '铺着旧地毯的会客厅，窗外正对樱雾市的河。' },
    { id: 'clinic', name: '月光诊所', type: 'clinic' as const, level: 1, capacity: 0, description: '栀子管理的诊所，空气里有晒干的花和酒精味。' },
    { id: 'dorm', name: '晚安宿舍', type: 'dorm' as const, level: 3, capacity: 6, description: '每个床位都有一盏可以调到最暗的小灯。' },
    { id: 'observatory', name: '星象台', type: 'observatory' as const, level: 1, capacity: 0, description: '零青常常在这里收听城市上空的杂音。' },
  ];
  const spawnAt = shiftStartAt(14);
  const missions = clone(pack.missions).map((m, index) => {
    const district = m.district ?? districtAt(m.x, m.y);
    const region = districts[district];
    const window: CommissionWindow = index % 2 === 0 ? 'long' : 'urgent';
    const longDays = window === 'long' ? 3 : undefined;
    return {
      ...m, squad: m.squad ?? [], attempts: m.attempts ?? 0, recommendedLevel: m.recommendedLevel ?? 3,
      rounds: m.rounds ?? Math.max(2, Math.floor(m.duration / ROUND_MINUTES)),
      district, window, longDays, wave: 0, spawnedAt: spawnAt,
      deadlineAt: deadlineFor(window, 14, spawnAt, longDays),
      target: applyPct(m.target, region.effect.targetPct), reward: applyPct(m.reward, region.effect.rewardPct),
    };
  });
  const logs: Log[] = [
    { id: 'l-1', time: '第 14 日 · 20:05', kind: 'story', text: '樱雾市进入夜间结界维护时段，事务所开始第十三夜的值班。' },
    { id: 'l-2', time: '第 14 日 · 20:20', kind: 'base', text: '晚安宿舍完成本月第三次床品更换，砂糖在每张床上放了一颗糖。' },
    { id: 'l-3', time: '第 14 日 · 20:40', kind: 'finance', text: '收到上月委托尾款，星砂储备补充。', delta: 480 },
  ];
  const state: GameState = {
    version: 16, day: 14, minutes: SHIFT_START, gold: 12840, reputation: 76,
    prologueSeen: false,
    factionRoster: defaultFactionRoster(),
    startersPicked: false,
    girls: hired, candidates, missions, rooms, logs, samples: sampleDays(), completed: [],
    messages: {}, memorial: [], battles: [], battleNotes: [], packHash: pack.hash,
    opinions: [], expeditions: [], councilDay: 14, pensionDebt: 0,
    factions: { witch: { standing: 50, stockDay: 14, envoyDay: 14 }, association: { standing: 50, stockDay: 14, envoyDay: 14 }, government: { standing: 50, stockDay: 14, envoyDay: 14 } },
    inventory: {}, marketStock: makeMarketStock(14), marketLevel: 1, marketDay: 14, boss: null, bossCycle: 0, nextBossDay: 16, customSkills: [], customMonsters: [], generatedItems: [], chronicle: [],
    poolLimits: { missions: 12, monsters: 8, candidates: 6 }, removedMonsters: [],
    shift: { day: 14, wave: 0 },
    territories: assignTerritories(seed), territoryLog: [], incidents: [], incidentPool: [], incidentSeq: 0, incidentCooldowns: {}, storylines: [], events: [], treatments: [],
    pollution: initialPollution(), hostility: initialHostility(), fronts: [], warHistory: [], office: sanitizeOfficeProfile(DEFAULT_OFFICE_PROFILE),
  };
  const seedAuthor = state.girls.find(girl => girl.id === 'ling');
  if (seedAuthor) {
    const seedOpinion = makeOpinion(state, seedAuthor, '设施', '星象台的窗需要修', '上次的异常让它裂了一道缝。风声会干扰收听，我不想在关键的时候漏掉一段求救。', '申请 900 星砂维修星象台。', { district: 'candy' });
    state.opinions = [{ ...seedOpinion, id: 'op-seed-14', assistantNote: '零青把裂缝的位置画在了便签背面。' }];
  }
  syncShift(state);
  return state;
}

/** 全空档案：只有启动资金、一间会客厅和城里的九片辖区。 */
export function createBlankState(pack: ContentPack = createSeedPack(), seed = `${pack.hash}:${Math.random()}`): GameState {
  const state: GameState = {
    version: 16, day: 14, minutes: SHIFT_START, gold: 6000, reputation: 0, blank: true,
    prologueSeen: false,
    factionRoster: defaultFactionRoster(),
    startersPicked: false,
    girls: [], candidates: [], missions: [], completed: [],
    rooms: [{ id: 'lounge', name: '会客厅', type: 'lounge', level: 1, capacity: 0, description: '刚租下的会客厅，只有一张桌子、一盏灯和一把多余的椅子。' }],
    logs: [
      { id: 'l-1', time: '第 14 日 · 20:00', kind: 'story', text: '钥匙插进锁孔的时候，门牌还是空的。第十三夜，樱雾市多了一间没有名字的事务所。' },
      { id: 'l-2', time: '第 14 日 · 20:01', kind: 'base', text: '账上只有 6000 星砂，没有契约者，也没有委托。今晚先从认识这座城开始。' },
    ],
    samples: sampleDays(), messages: {}, memorial: [], battles: [], battleNotes: [], packHash: pack.hash,
    opinions: [], expeditions: [], councilDay: 14, pensionDebt: 0,
    factions: { witch: { standing: 50, stockDay: 14, envoyDay: 14 }, association: { standing: 50, stockDay: 14, envoyDay: 14 }, government: { standing: 50, stockDay: 14, envoyDay: 14 } },
    inventory: {}, marketStock: makeMarketStock(14), marketLevel: 1, marketDay: 14, boss: null, bossCycle: 0, nextBossDay: 16, customSkills: [], customMonsters: [], generatedItems: [], chronicle: [],
    poolLimits: { missions: 12, monsters: 8, candidates: 6 }, removedMonsters: [],
    shift: { day: 14, wave: 0 },
    territories: assignTerritories(seed), territoryLog: [], incidents: [], incidentPool: [], incidentSeq: 0, incidentCooldowns: {}, storylines: [], events: [], treatments: [],
    pollution: initialPollution(), hostility: initialHostility(), fronts: [], warHistory: [], office: sanitizeOfficeProfile(DEFAULT_OFFICE_PROFILE),
  };
  syncShift(state);
  return state;
}
export function createInitialFromPack(pack: ContentPack): GameState {
  return createInitialState(pack);
}

function findGirl(state: GameState, id: string): Girl | undefined {
  return state.girls.find(g => g.id === id);
}
/** 差分也允许先给候选者准备；入队后随角色卡一起带走。 */
function findRosterGirl(state: GameState, id: string): Girl | undefined {
  return state.girls.find(g => g.id === id) ?? state.candidates.find(g => g.id === id);
}
/** 服装被移除后，不再保留这套衣服的表情差分。 */
function pruneOrphanVariants(girl: Girl): void {
  if (!girl.importedVariants) return;
  const outfitIds = new Set([...girl.wardrobe.map(outfit => outfit.id), 'witchform']);
  for (const key of Object.keys(girl.importedVariants)) {
    const parsed = parseExpressionVariantKey(key);
    if (!parsed || !outfitIds.has(parsed.outfitId)) delete girl.importedVariants[key];
  }
}
function applyScar(state: GameState, girl: Girl, scar: Scar): void {
  girl.scars.push(scar);
  girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
  girl.hp = Math.min(girl.hp, girl.maxHp);
  const effect = scar.effect;
  if (effect.kind === 'stat' && effect.stat) {
    const key = effect.stat as StatKey;
    girl.stats[key] = Math.max(20, girl.stats[key] + effect.amount);
  }
  if (effect.kind === 'maxSpirit') girl.maxSpirit = Math.max(30, girl.maxSpirit + effect.amount);
  state.logs.unshift({ id: `log-scar-${scar.id}`, time: dateLabel(state.day, state.minutes), kind: 'memorial', text: `${girl.name}留下了第 ${girl.scars.length} 道疤痕「${scar.name}」。${scar.condition}。` });
}
function recordBattle(state: GameState, battle: BattleState): void {
  state.battles.unshift(battle);
  state.battles = state.battles.slice(0, 20);
  const kept = new Set(state.battles.map(item => item.id));
  state.battleNotes = (state.battleNotes ?? []).filter(note => kept.has(note.battleId)).slice(0, 20);
}
/**
 * 拦截战的结算分支。
 *
 * 只做「打完并作废原委托」这一件事：不发原委托的报酬与声望，不净化污染，不换辖区，
 * 也不推故事节点。战后的人物状态（HP、疲惫、侵蚀、疤痕、羁绊）仍由 `settleCombat`
 * 的公共收尾处理，这里不复制第二套。
 */
function settleInterception(state: GameState, mission: Mission, interception: Interception, battle: BattleState, at: { day: number; minutes: number }): void {
  const win = battle.outcome === 'victory';
  interception.outcome = win ? 'win' : 'loss';
  mission.status = 'expired';
  mission.squad = [];
  mission.girlId = undefined;
  const faction = interception.faction;
  const drop = win ? 4 : 2;
  state.factions[faction].standing = Math.max(0, state.factions[faction].standing - drop);
  const name = factionName[faction];
  state.logs.unshift({
    id: `log-intercept-${mission.id}`,
    time: dateLabel(at.day, at.minutes),
    kind: 'battle',
    text: win
      ? `拦截战：我们在${districtOfMission(mission).name}打退了${name}的人，「${mission.title}」就此作废。他们不会忘记这笔账（${name}声望 −${drop}）。`
      : `拦截战：${name}在${districtOfMission(mission).name}拦下了「${mission.title}」，原委托作废（${name}声望 −${drop}）。`,
  });
  state.reputation = Math.max(0, state.reputation - 1);
  book(state, at.day, 0);
}
/**
 * 月蚀庭委托的连带声望：帮他们一次，另外两方各记一笔。
 *
 * 只在成功结算之后调用（战斗胜利 / 调查成功），失败不额外扣。
 */
function applyWitchBounty(state: GameState): void {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  state.factions.association.standing = clamp(state.factions.association.standing - 2);
  state.factions.government.standing = clamp(state.factions.government.standing - 2);
  state.factions.witch.standing = clamp(state.factions.witch.standing + 3);
}

/**
 * 判断这次委托会不会被辖区当主拦下；命中时把拦截编队写进 `mission.interception`。
 *
 * `canIntercept` 是唯一判定入口：委托详情里的红色预警也调它，所以不会出现
 * 「UI 说要被拦、结算却放过」的谎报。
 */
export function interceptionFor(state: GameState, mission: Mission): Interception | undefined {
  if (mission.interception) return mission.interception;
  if (!canIntercept(state, mission)) return undefined;
  const owner = mission.district ? state.territories[mission.district] : undefined;
  if (!owner) return undefined;
  // 那条街上已经有两拨人在打了，今晚不会再有人来拦我们。
  if (mission.district && openFrontIn(state, mission.district)) return undefined;
  const roster = rosterMembers(state, owner).length ? rosterMembers(state, owner) : factionGirlsOf(owner);
  if (!roster.length) return undefined;
  const count = Math.max(1, Math.min(3, 1 + Math.floor(mission.recommendedLevel / 4)));
  const highest = [...roster].sort((a, b) => b.level - a.level)[0];
  const rest = roster.filter(girl => girl.id !== highest.id);
  const seed = hashText(`intercept:${mission.id}`);
  const picked = rest
    .map((girl, index) => ({ girl, key: hashText(`${seed}:${girl.id}:${index}`) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, Math.max(0, count - 1))
    .map(entry => entry.girl);
  mission.interception = { faction: owner, girlIds: [highest.id, ...picked.map(girl => girl.id)] };
  return mission.interception;
}
function settleCombat(state: GameState, mission: Mission, squad: Girl[], at: { day: number; minutes: number }): BattleState {
  const interception = mission.interception;
  const factionPool = rosterMembers(state, interception?.faction ?? 'association');
  const pool = factionPool.length ? factionPool : (interception ? factionGirlsOf(interception.faction) : []);
  const enemies = interception ? pool.filter(girl => interception.girlIds.includes(girl.id)) : [];
  const battle = simulateBattle({
    mission, girls: squad, day: at.day, minutes: at.minutes,
    woundedEnemies: mission.worsened, monsters: state.customMonsters,
    battleKind: interception ? 'interception' : 'commission',
    enemyGirls: interception ? enemies : undefined,
  });
  mission.attempts += 1;
  mission.lastOutcome = battle.outcome;
  const rewards = battle.rewards ?? { gold: 0, exp: 0, bond: 0 };
  if (interception) {
    settleInterception(state, mission, interception, battle, at);
  } else if (battle.outcome === 'victory') {
    state.gold += rewards.gold;
    state.reputation = Math.min(100, state.reputation + (mission.boss ? 8 : 2));
    book(state, at.day, rewards.gold);
    state.completed.push(mission.id);
    mission.status = 'done';
    completeStoryMission(state, mission);
    grantTemplateRewards(state, mission, at);
    if (mission.faction) {
      state.factions[mission.faction].standing = Math.min(100, state.factions[mission.faction].standing + 6);
      state.reputation = Math.max(0, Math.min(100, state.reputation + (mission.faction === 'witch' ? -2 : mission.faction === 'association' ? 2 : 1)));
      if (mission.faction === 'witch') applyWitchBounty(state);
    }
    if (mission.boss && state.boss) { state.boss = null; state.bossCycle += 1; }
    state.logs.unshift({ id: `log-win-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `战斗胜利：${mission.title}。魔物已被清除，事件移出委托池。${mission.boss ? '空月退去，城市恢复呼吸。' : ''}`, delta: rewards.gold });
  } else if (battle.outcome === 'defeat') {
    state.reputation = Math.max(0, state.reputation - 3);
    if (mission.faction) state.factions[mission.faction].standing = Math.max(0, state.factions[mission.faction].standing - 3);
    book(state, at.day, 0);
    mission.squad = [];
    mission.girlId = undefined;
    if (mission.storylineId) {
      mission.status = 'expired';
      failStoryMission(state, mission, '战斗失败');
    } else {
      mission.status = 'open';
    }
    state.logs.unshift({ id: `log-lose-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `战斗失败：${mission.title}。${mission.storylineId ? '故事线因此转向失败分支。' : '全员失去行动能力，委托仍留在事件池中。'}` });
  } else {
    state.gold += rewards.gold;
    book(state, at.day, rewards.gold);
    mission.status = 'open';
    mission.worsened = true;
    mission.squad = [];
    mission.girlId = undefined;
    state.logs.unshift({ id: `log-repel-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `${outcomeLabel(battle.outcome)}：${mission.title}。获得 ${rewards.gold} 星砂，魔物带伤退去（下次血量 -20%）。`, delta: rewards.gold });
  }
  for (const unit of battle.units.filter(u => u.side === 'ally')) {
    const girl = findGirl(state, unit.uid.replace('ally-', ''));
    if (!girl) continue;
    girl.hp = Math.max(1, unit.hp);
    girl.spirit = Math.max(0, unit.spirit);
    if (battle.outcome === 'victory' || battle.outcome === 'repelled') {
      grantExp(girl, battleExp(mission.recommendedLevel));
      girl.contractEndDay += mission.attempts % 2 === 0 ? 1 : 0;
    }
    girl.bond = Math.max(0, Math.min(100, girl.bond + rewards.bond));
    for (const peer of squad) {
      if (peer.id === girl.id) continue;
      const current = girl.relationships[peer.id] ?? 40;
      girl.relationships[peer.id] = Math.max(0, Math.min(100, current + (battle.outcome === 'victory' ? 2 : battle.outcome === 'defeat' ? -2 : 1)));
    }
    if (battle.outcome === 'victory' || battle.outcome === 'repelled') {
      girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 12) + 6);
    }
    const gearCorruption = equipmentOf(girl).reduce((sum, item) => sum + (item.corruptionPerBattle ?? 0), 0);
    // 污染造成的侵蚀只从快照读一份：`environment` 已经是地形 + 当主 + 污染的和。
    addCorruption(state, girl, 3 + gearCorruption + (mission.boss ? 6 : 0) + (battle.outcome === 'defeat' ? 2 : 0) + (mission.environment?.corruptionFlat ?? 0));
  }
  if (battle.outcome === 'defeat') {
    for (const scar of battle.scars ?? []) {
      const girl = state.girls.find(g => scar.id.startsWith(`scar-${g.id}-`));
      if (girl) {
        applyScar(state, girl, scar);
        if (scar.fatal) killGirl(state, girl, battle, mission);
      }
    }
  } else {
    for (const girl of squad) {
      if (girl.dead) continue;
      gainTrait(state, girl, mission.title, 0.35);
      if (battle.outcome === 'repelled') addCondition(state, girl, mission.title);
      if (hashText(`${girl.id}:${mission.id}:${state.day}`) % 100 < 28) {
        state.opinions.unshift(makeOpinion(state, girl, '同伴', `想再去一次「${mission.title}」`, `这次没有彻底解决。她认为下一次可以做得更好。`, '申请把该委托重新排入优先队列。'));
      }
    }
  }
  applySettleEnvironment(state, mission, squad.filter(girl => !girl.dead));
  // 拦截战不净化污染、也不换辖区：这不是完成委托，只是把那张单子打作废。
  if (!interception) {
    applyPollutionRelief(state, mission, battle.outcome === 'victory' ? 'win' : 'loss');
    if (battle.outcome === 'victory' && mission.faction && mission.district) {
      shiftTerritory(state, mission.district, mission.faction, '阵营委托完成');
    }
  }
  recordBattle(state, battle);
  return battle;
}
function killGirl(state: GameState, girl: Girl, battle: BattleState, mission: Mission): void {
  if (girl.dead) return;
  girl.dead = true;
  girl.diedAt = dateLabel(state.day, state.minutes);
  girl.status = 'retired';
  girl.remaining = 0;
  girl.missionId = undefined;
  state.memorial.unshift({
    girl: clone(girl), diedAt: girl.diedAt, cause: `在「${mission.title}」中承受了第五道疤痕。`,
    epitaph: girl.quote ?? '愿她终于可以好好睡一觉。', lastBattleId: battle.id,
  });
  state.logs.unshift({ id: `log-death-${girl.id}-${Date.now()}`, time: girl.diedAt, kind: 'memorial', text: `${girl.name}的契约终止了。事务所为她保留了靠窗的位置。` });
  state.reputation = Math.max(0, state.reputation - 5);
  for (const other of state.girls) {
    if (other.id === girl.id) continue;
    const score = other.relationships[girl.id] ?? 40;
    if (score >= 55) other.relationships[girl.id] = Math.max(0, score - 3);
    if (score >= 70) other.bond = Math.max(0, other.bond - 3);
  }
  state.missions.forEach(m => { m.squad = m.squad.filter(id => id !== girl.id); });
  state.girls = state.girls.filter(g => g.id !== girl.id);
  state.messages[girl.id] = state.messages[girl.id] ?? [];
}
function districtOfMission(mission: Mission) {
  return districts[mission.district ?? districtAt(mission.x, mission.y)];
}
export interface ClinicQuote { missing: number; cost: number; minutes: number; perHour: number; maxMinutes: number; kink: boolean }

/**
 * 诊所报价。
 * 普通治疗：按缺失血量收费，半小时一档向上取整（12 点/小时 → 30 分钟恢复 6 点），最长 5 小时。
 * 治疗癖好：与血量无关，固定 2 小时、单独收费。
 */
export function clinicQuote(girl: Girl, kink = false): ClinicQuote {
  const balance = loadBalance();
  const missing = Math.max(0, effectiveMaxHp(girl) - girl.hp);
  if (kink) {
    return { missing, cost: balance.clinicKinkFee, minutes: 120, perHour: 0, maxMinutes: 120, kink: true };
  }
  const raw = Math.ceil((missing / Math.max(1, balance.clinicHpPerHour)) * 60);
  const minutes = Math.min(300, Math.max(30, Math.ceil(raw / 30) * 30));
  return { missing, cost: balance.clinicBase + missing * balance.clinicPerHp, minutes, perHour: balance.clinicHpPerHour, maxMinutes: 300, kink: false };
}
/** 正在进行的治疗；没有则返回 undefined。 */
export function treatmentFor(state: GameState, girlId: string): Treatment | undefined {
  return state.treatments.find(item => item.girlId === girlId);
}
/** 辖区环境在结算时的统一修正：疲劳、精神力。声望在各自分支里结算。 */
function applySettleEnvironment(state: GameState, mission: Mission, squad: Girl[]): void {
  const region = districtOfMission(mission);
  // 有快照时只认快照：`mission.environment` 已经是「静态地形 + 当主 + 污染」的和，
  // 再读一次 terrain/territory 会把地形与当主的疲劳算两遍。
  const extraFatigue = mission.environment
    ? (mission.environment.fatigueFlat ?? 0)
    : (region.effect.fatigueFlat ?? 0) + (mission.district ? effectiveDistrictEffect(state.territories, mission.district).fatigueFlat ?? 0 : 0);
  const spiritDrain = (region.effect.spiritPerHour ?? 0) * Math.max(0, Math.round(mission.duration / 60));
  for (const girl of squad) {
    if (extraFatigue) girl.fatigue = Math.max(0, Math.min(100, girl.fatigue + extraFatigue));
    if (spiritDrain) girl.spirit = Math.max(0, girl.spirit + spiritDrain);
  }
}

/**
 * 委托结束后的污染变化。
 *
 * 完成降低、失败略升；势力只在这里影响数值（净化量），不影响每日自然上升。
 * 没有辖区的委托（城市级威胁等）不动污染。
 */
function applyPollutionRelief(state: GameState, mission: Mission, result: 'win' | 'loss'): number {
  const district = mission.district;
  if (!district) return 0;
  const before = clampPollution(state.pollution?.[district] ?? 0);
  const snapshot = pollutionSnapshotOf(state, mission);
  const relief = result === 'win' ? pollutionRelief(snapshot) : -pollutionPenalty(snapshot);
  const after = clampPollution(before - relief);
  state.pollution[district] = after;
  const ownerName = factionName[snapshot.owner] ?? snapshot.owner;
  state.logs.unshift({
    id: `log-pollution-${mission.id}-${state.day}-${state.minutes}-${result}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'dispatch',
    text: `${districtName(district)}污染 ${before} → ${after}（${result === 'win' ? '完成' : '失败'}委托「${mission.title}」，${ownerName}净化 ${relief > 0 ? `+${relief}` : relief}）`,
  });
  if (pollutionTier(before) !== pollutionTier(after)) {
    state.logs.unshift({
      id: `log-pollution-tier-${district}-${state.day}-${after}`,
      time: dateLabel(state.day, state.minutes),
      kind: 'story',
      text: `${districtName(district)}从「${pollutionTierLabel(before)}」变为「${pollutionTierLabel(after)}」。`,
    });
  }
  return relief;
}

/** 工坊委托的额外报酬：装备进背包，契约者直接入职；席位不足时留作免费候选者。 */
function grantTemplateRewards(state: GameState, mission: Mission, at: { day: number; minutes: number }): void {
  if (!mission.templateId) return;
  if (mission.rewardEquipmentId) {
    const item = items.find(entry => entry.id === mission.rewardEquipmentId);
    if (item) {
      state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
      state.logs.unshift({ id: `log-mission-gear-${mission.id}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `委托「${mission.title}」的额外报酬「${item.name}」已放进事务所背包。` });
    }
  }
  const rawLevel = Math.round(mission.rewardGirlLevel ?? 0);
  if (rawLevel <= 0) return;
  const level = Math.min(12, Math.max(1, rawLevel));
  let candidate: Girl | undefined;
  for (let attempt = 0; attempt < 24 && !candidate; attempt++) {
    const next = makeCandidate(state, level, hashText(`${mission.id}:girl-reward`) + attempt * 7919);
    if (!state.girls.some(girl => girl.id === next.id) && !state.candidates.some(girl => girl.id === next.id)) candidate = next;
  }
  if (!candidate) return;
  if (state.girls.filter(girl => !girl.dead).length < capacity(state)) {
    state.girls.push({
      ...candidate, cost: 0, status: 'idle', roomId: 'lounge', remaining: 0,
      contractEndDay: at.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0,
      pensionMissed: 0, retired: false, retiredReason: undefined, candidateUntilDay: undefined,
    });
    state.logs.unshift({ id: `log-mission-girl-${mission.id}`, time: dateLabel(at.day, at.minutes), kind: 'story', text: `委托「${mission.title}」带回了一位新的契约者「${candidate.name}」。她没有收下签约金，直接住进了宿舍。` });
  } else {
    state.candidates.push({ ...candidate, cost: 0, custom: true, candidateUntilDay: at.day + 7 });
    state.logs.unshift({ id: `log-mission-girl-${mission.id}`, time: dateLabel(at.day, at.minutes), kind: 'story', text: `委托「${mission.title}」带回了一位新的契约者「${candidate.name}」。宿舍已经住满，她暂时留在候选名册，签约金为 0。` });
  }
}

function settleInvestigation(state: GameState, mission: Mission, squad: Girl[], at: { day: number; minutes: number }): void {
  const success = squadChance(squad, mission) >= 50 && Math.max(...squad.map(g => g.stats[mission.requirement])) + (squad.length - 1) * 4 >= mission.target;
  const region = districtOfMission(mission);
  mission.attempts += 1;
  if (success) {
    state.gold += mission.reward;
    state.reputation = Math.min(100, state.reputation + 1 + (region.effect.reputationFlat ?? 0));
    book(state, at.day, mission.reward);
    state.completed.push(mission.id);
    mission.status = 'done';
    completeStoryMission(state, mission);
    grantTemplateRewards(state, mission, at);
    state.logs.unshift({ id: `log-inv-${mission.id}-${mission.attempts}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `调查完成：${mission.title}。${squad.map(g => g.name).join('、')}带回了可以写进档案的答案。${region.name}的环境让这次行动${region.effect.rewardPct && region.effect.rewardPct > 0 ? '额外顺利' : '格外磨人'}。`, delta: mission.reward });
    for (const girl of squad) {
      grantExp(girl, investigationExp(mission.recommendedLevel));
      girl.bond = Math.min(100, girl.bond + 1);
      girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 15));
      girl.contractEndDay += mission.attempts % 2 === 0 ? 1 : 0;
      gainTrait(state, girl, mission.title, 0.3);
    }
    const corrupt = mission.environment?.corruptionFlat ?? 0;
    if (corrupt) for (const girl of squad) addCorruption(state, girl, corrupt);
    applySettleEnvironment(state, mission, squad);
    applyPollutionRelief(state, mission, 'win');
    if (mission.faction && mission.district) shiftTerritory(state, mission.district, mission.faction, '阵营委托完成');
    if (mission.faction === 'witch') applyWitchBounty(state);
    if (hashText(`${mission.id}:${state.day}`) % 100 < 22) {
      const author = squad[0];
      if (author) state.opinions.unshift(makeOpinion(state, author, '城市', '关于下一次调查的路线', '她想把糖果街和旧钟楼的线索并在一起看。', '申请一次不消耗星砂的线索整理时间。'));
    }
  } else {
    mission.status = 'open';
    mission.squad = [];
    mission.girlId = undefined;
    book(state, at.day, 0);
    state.logs.unshift({ id: `log-inv-fail-${mission.id}-${mission.attempts}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `调查受阻：${mission.title}。线索不足，委托仍在事件池中。${region.name}的环境让线索更难拼合。` });
    for (const girl of squad) girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 10));
    const lost = mission.environment?.corruptionFlat ?? 0;
    if (lost) for (const girl of squad) addCorruption(state, girl, lost);
    applySettleEnvironment(state, mission, squad);
    applyPollutionRelief(state, mission, 'loss');
  }
  for (const girl of squad) {
    girl.status = 'idle'; girl.remaining = 0; girl.missionId = undefined;
  }
  if (success) { mission.squad = []; mission.girlId = undefined; }
}
function advanceClock(state: GameState, to: number): void {
  const now = state.day * 1440 + state.minutes;
  const elapsed = to - now;
  if (elapsed <= 0) return;
  const previousDay = state.day;
  // 营业夜从 20:00 起算：00:00–02:00 仍属于前一天的「第 N 日」，只是分钟数越过 1440。
  const nextDay = Math.floor((to - SHIFT_START) / 1440);
  state.day = nextDay;
  state.minutes = to - nextDay * 1440;
  const days = state.day - previousDay;
  if (days > 0) {
    accruePension(state, days);
    for (const girl of state.girls) tickConditions(girl, days);
    for (let i = 0; i < days; i++) processDay(state);
    for (const opinion of state.opinions) {
      if (opinion.status === 'deferred' && (opinion.revisitDay ?? Infinity) <= state.day) {
        opinion.status = 'pending';
        state.logs.unshift({ id: `log-op-revisit-${opinion.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'council', text: `暂缓的议题「${opinion.title}」重新回到议事桌。` });
      }
    }
    if (state.day > state.councilDay) { state.councilDay = state.day; generateOpinions(state); }
  }
  bossTick(state, elapsed);
  for (const girl of state.girls) {
    if (girl.status === 'mission' || girl.status === 'healing' || girl.status === 'resting') girl.remaining = Math.max(0, girl.remaining - elapsed);
  }
  for (const story of [...state.storylines]) {
    if (story.status !== 'active' || story.run?.waiting?.kind !== 'wait') continue;
    const until = story.run.waiting.until;
    if (typeof until === 'number' && until <= to) resolveStoryWait(state, story.id, 'wait', story.run.waiting.ref);
  }
  settleTreatments(state, to);
}

/** 诊所治疗按分钟线性回血；到点后恢复待命，带癖好的治疗在结束时留下痕迹。 */
function settleTreatments(state: GameState, to: number): void {
  if (!state.treatments.length) return;
  for (const treatment of [...state.treatments]) {
    const girl = state.girls.find(item => item.id === treatment.girlId);
    if (!girl || girl.dead) { state.treatments = state.treatments.filter(item => item.id !== treatment.id); continue; }
    const total = Math.max(1, treatment.endsAt - treatment.startedAt);
    const progress = Math.max(0, Math.min(1, (to - treatment.startedAt) / total));
    girl.hp = Math.min(treatment.hpTarget, Math.round(treatment.hpStart + (treatment.hpTarget - treatment.hpStart) * progress));
    if (to < treatment.endsAt) continue;
    state.treatments = state.treatments.filter(item => item.id !== treatment.id);
    girl.status = 'idle'; girl.remaining = 0;
    if (treatment.kink) {
      // 癖好护理只影响关系，不留下永久特性。
      girl.bond = Math.min(100, girl.bond + 4);
      girl.corruption = Math.min(100, (girl.corruption ?? 0) + 3);
    }
    state.logs.unshift({
      id: `log-treat-done-${girl.id}-${state.day}-${state.minutes}`, time: dateLabel(state.day, state.minutes), kind: 'clinic',
      text: `${girl.name}结束了这次治疗，血量恢复到 ${girl.hp}/${effectiveMaxHp(girl)}${treatment.kink ? '。离开时她没说下次还会不会受伤。' : '。'}`,
    });
  }
}
function processDay(state: GameState): void {
  // 顺序本身就是可测行为：药物 → 疲劳侵蚀 → 污染日增 → 敌意值 → 势力库存/来使 → 市场 → BOSS → 战线。
  applyHostility(state, hostilityGain(state));
  for (const girl of [...state.girls]) {
    drugTick(state, girl);
    if (!girl.dead && girl.fatigue >= 80) addCorruption(state, girl, 2);
  }
  // 离职压力：条件连续成立几天才会开口；这里只累计与触发，不碰侵蚀度。
  tickStrain(state);
  applyResignations(state);
  // 污染只自然上涨，任何势力都不加也不减；三方只影响「完成委托后净化多少」。
  // 只在跨档时写日志，避免每天九条噪声。
  if (state.pollution) {
    for (const id of Object.keys(state.pollution) as DistrictId[]) {
      const level = clampPollution(state.pollution[id]);
      const next = clampPollution(level + pollutionDailyRise(level));
      state.pollution[id] = next;
      if (pollutionTier(next) !== pollutionTier(level)) {
        state.logs.unshift({
          id: `log-pollution-${id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'territory',
          text: `${districts[id].name}的污染跨过了一个台阶：${level} → ${next}（${pollutionTierLabel(next)}）。`,
        });
      }
    }
  }
  for (const faction of Object.keys(state.factions) as FactionId[]) {
    if (state.factions[faction].stockDay < state.day) {
      state.factions[faction].stockDay = state.day;
      state.marketStock = state.marketStock.filter(entry => entry.faction !== faction).concat(makeFactionStock(faction, state.day));
    }
    if (state.factions[faction].envoyDay < state.day) {
      state.factions[faction].envoyDay = state.day;
      state.factions[faction].envoyTaskId = undefined;
    }
  }
  if (state.marketDay < state.day) refreshMarket(state);
  if (state.day >= state.nextBossDay && !state.boss) {
    state.bossCycle += 1;
    const mission = makeBossMission(state);
    state.missions.unshift(mission);
    state.boss = { id: `boss-${state.bossCycle}`, appearedDay: state.day, lastTick: 0, deadline: state.day * 1440 + 48 * 60, missionId: mission.id };
    state.nextBossDay = state.day + 3;
    state.logs.unshift({ id: `log-boss-${state.bossCycle}`, time: dateLabel(state.day, state.minutes), kind: 'battle', text: '空月出现在钟楼上空。城市进入最高警戒，委托池新增城市级威胁。' });
  }
  // 敌意值满 100 就在这一天变成两条街上的战线；没人管的话到点自己打完。
  planFronts(state, { day: state.day, minutes: state.minutes });
  resolveDueFronts(state, { day: state.day, minutes: state.minutes });
}
function careRecovery(girl: Girl, mode: 'resting'): void {
  if (mode === 'resting') {
    const penalty = girl.scars.reduce((sum, s) => sum + (s.effect.kind === 'fatigueRecovery' ? s.effect.amount : 0), 0);
    const perHour = loadBalance().dormFatiguePerHour;
    girl.fatigue = Math.max(0, girl.fatigue - Math.max(10, Math.round(perHour * 1.5) + penalty));
    girl.corruption = Math.max(0, (girl.corruption ?? 0) - 5);
  }
  girl.status = 'idle'; girl.remaining = 0;
}
function advance(state: GameState, minutes: number): ActionResult {
  if (!Number.isFinite(minutes) || minutes < 1) return { state, ok: false, message: '推进时间需要至少一分钟。' };
  if (minutes > 180) return { state, ok: false, message: '一次最多推进 180 分钟，请分段安排夜晚。' };
  if (blockingIncidents(state).length > 0) return { state, ok: false, message: '桌上还有必须立刻决定的事，先处理它。' };
  const nowAbs = absoluteMinutes(state.day, state.minutes);
  const closeAbs = absoluteMinutes(state.day, SHIFT_END);
  if (nowAbs >= closeAbs || state.minutes < SHIFT_START) return { state, ok: false, message: '今晚已经打烊，前往下一天继续营业。' };
  const step = Math.min(minutes, closeAbs - nowAbs);
  const next = clone(state);
  syncShift(next);
  const end = next.day * 1440 + next.minutes + step;
  let lastBattle: BattleState | undefined;
  for (let guard = 0; guard < 24; guard++) {
    const events: { at: number; mission?: Mission; girl?: Girl; expedition?: GameState['expeditions'][number] }[] = [];
    for (const mission of next.missions) {
      if (mission.status !== 'active') continue;
      const squad = mission.squad.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g && g.status === 'mission'));
      if (!squad.length) continue;
      const remaining = Math.min(...squad.map(g => g.remaining));
      events.push({ at: next.day * 1440 + next.minutes + remaining, mission });
    }
    for (const girl of next.girls) {
      if (girl.status === 'healing' || girl.status === 'resting') events.push({ at: next.day * 1440 + next.minutes + girl.remaining, girl });
    }
    for (const expedition of next.expeditions) {
      const last = expedition.lastSettledDay * 1440 + expedition.lastSettledMinutes;
      const nextAt = last + 60;
      if (nextAt <= end) events.push({ at: nextAt, expedition });
    }
    const due = events.filter(e => e.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    advanceClock(next, due.at);
    if (due.mission) {
      const mission = next.missions.find(m => m.id === due.mission!.id)!;
      const squad = mission.squad.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
      // 先判拦截再分流：被拦下的调查委托也打成一场战斗，而不是先结算调查再补一场。
      const intercept = interceptionFor(next, mission);
      if (intercept) lastBattle = settleCombat(next, mission, squad, { day: next.day, minutes: next.minutes });
      else if (mission.work === 'combat' && mission.enemyIds?.length) lastBattle = settleCombat(next, mission, squad, { day: next.day, minutes: next.minutes });
      else settleInvestigation(next, mission, squad, { day: next.day, minutes: next.minutes });
      for (const girl of squad) { girl.status = 'idle'; girl.remaining = 0; girl.missionId = undefined; }
      if (mission.status === 'done' || mission.status === 'expired') {
        mission.squad = [];
        mission.girlId = undefined;
      }
      for (const incident of dueIncidents(next, 'missionDone', { day: next.day, minutes: next.minutes }, { work: mission.work, wave: next.shift.wave })) {
        next.incidents.unshift(incident);
        markIncidentCooldown(next, incident);
        next.logs.unshift({ id: `log-incident-mission-${incident.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `委托收尾时，有人等在门口：${incident.title}。` });
      }
    } else if (due.girl) {
      const girl = findGirl(next, due.girl.id);
      if (girl) careRecovery(girl, 'resting');
    } else if (due.expedition) {
      settleExpedition(next, due.expedition.id, { day: next.day, minutes: next.minutes });
    }
  }
  advanceClock(next, end);
  syncShift(next);
  for (const girl of next.girls) {
    if (girl.dead || girl.retired || girl.status === 'mission' || girl.status === 'expedition') continue;
    if (next.day > girl.contractEndDay && girl.pensionMissed >= 15) {
      girl.retired = true; girl.retiredReason = 'contract'; girl.status = 'retired'; girl.remaining = 0;
      next.logs.unshift({ id: `log-contract-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}的契约已欠约 ${girl.pensionMissed} 日，事务所为她办理了强制退休。她仍会按月领取退休金。` });
    }
  }
  const closed = next.minutes >= SHIFT_END;
  return { state: next, ok: true, message: closed ? '打烊时间到了。接下今晚的账，明晚再开张。' : lastBattle ? `${outcomeLabel(lastBattle.outcome)}：${lastBattle.missionTitle}` : `时间推进 ${step} 分钟。`, battle: lastBattle };
}

/** 结算今晚：把剩余时间走完、撤回未接委托、休整，然后开门进入下一天 20:00。 */
/** 打烊前先给过期弹窗结账：没人处理就掉一点安定度，然后让它们退出桌面。 */
function settleExpiredIncidents(state: GameState): GameState {
  if (!expireIncidents({ ...state, incidents: state.incidents.map(item => ({ ...item })) } as GameState, { day: state.day, minutes: state.minutes }).length) return state;
  const next = clone(state);
  for (const expired of expireIncidents(next, { day: next.day, minutes: next.minutes })) {
    applyIncidentEffect(next, expired, { reputation: -1 });
    next.logs.unshift({ id: `log-incident-expire-${expired.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `「${expired.title}」没有人处理，就这样过去了。夜里少了一点信任。` });
  }
  return next;
}

function endNight(state: GameState): ActionResult {
  if (blockingIncidents(state).length > 0) return { state, ok: false, message: '还有必须立刻决定的事。处理完才能打烊。' };
  let current = settleExpiredIncidents(state);
  let battle: BattleState | undefined;
  for (let guard = 0; guard < 4; guard++) {
    const now = absoluteMinutes(current.day, current.minutes);
    const close = absoluteMinutes(current.day, SHIFT_END);
    if (now >= close) break;
    const result = advance(current, Math.min(180, close - now));
    if (!result.ok) break;
    current = result.state;
    battle = result.battle ?? battle;
  }
  const next = clone(current);
  const dismissed = closeShift(next);
  for (const girl of next.girls) {
    if (girl.dead || girl.retired || girl.status === 'mission' || girl.status === 'expedition') continue;
    girl.fatigue = Math.max(0, girl.fatigue - 12);
    girl.spirit = Math.min(effectiveMaxSpirit(girl), girl.spirit + 20);
  }
  const closedDay = next.minutes < SHIFT_START || next.minutes >= SHIFT_END ? next.day + 1 : next.day;
  advanceClock(next, absoluteMinutes(closedDay, SHIFT_START));
  next.shift = { day: next.day, wave: 0 };
  syncShift(next);
  for (const incident of dueIncidents(next, 'dayStart', { day: next.day, minutes: next.minutes }, { wave: 0 })) {
    next.incidents.unshift(incident);
    markIncidentCooldown(next, incident);
    next.logs.unshift({ id: `log-incident-night-${incident.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `第 ${next.day} 日开门前，有人把一件事放在了桌上：${incident.title}。` });
  }
  topUpFromFallback(next, { day: next.day, minutes: next.minutes }, 3);
  const poolIncident = rollPoolIncident(next);
  if (poolIncident) {
    next.incidents.unshift(poolIncident);
    next.logs.unshift({ id: `log-incident-pool-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `随机事件池抽中了「${poolIncident.title}」。${poolIncident.body.slice(0, 40)}` });
  }
  next.logs.unshift({ id: `log-night-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `打烊。${dismissed ? `${dismissed} 份没被接下的委托被撤回。` : '没有未接的委托。'}夜色退去，第 ${next.day} 日 20:00，事务所重新开门。` });
  return { state: next, ok: true, message: `第 ${next.day} 日开门，新的委托已经贴上告示板。`, battle };
}
function dispatch(state: GameState, girlIds: string[], missionId: string): ActionResult {
  const next = clone(state);
  const mission = next.missions.find(m => m.id === missionId);
  if (!mission || mission.status !== 'open') return { state, ok: false, message: '这项委托当前无法接取。' };
  if (mission.requiredGirlId && !girlIds.includes(mission.requiredGirlId)) {
    const partner = findGirl(next, mission.requiredGirlId) ?? next.candidates.find(girl => girl.id === mission.requiredGirlId);
    return { state, ok: false, message: `这份委托要求${partner?.name ?? '指定的契约者'}同行，先把她编进小队。` };
  }
  if (mission.deadlineAt !== undefined && absoluteMinutes(next.day, next.minutes) >= mission.deadlineAt) {
    mission.status = 'expired';
    if (mission.storylineId) failStoryMission(next, mission, '超过期限');
    return { state: next, ok: false, message: `「${mission.title}」已过接取时限，委托自动撤销。` };
  }
  const squad = girlIds.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
  if (squad.length !== girlIds.length || !squad.length) return { state, ok: false, message: '请选择可出勤的契约者。' };
  if (squad.length > squadLimit(mission)) return { state, ok: false, message: `${workLabels[mission.work]}最多派遣 ${squadLimit(mission)} 人。` };
  for (const girl of squad) {
    if (girl.left) return { state, ok: false, message: `${girl.name}已经解除了契约，不能再出勤。` };
    if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}当前${statusLabels[girl.status]}，无法出勤。` };
    if (inWithdrawal(girl)) return { state, ok: false, message: `${girl.name}正在断药期，无法出勤。请先使用月蚀抑制剂。` };
    if (girl.hp < 25) return { state, ok: false, message: `${girl.name}的血量过低，请先治疗。` };
    if (girl.fatigue >= 80) return { state, ok: false, message: `${girl.name}的疲劳过高，请先休息。` };
  }
  mission.status = 'active';
  mission.squad = squad.map(g => g.id);
  mission.girlId = squad[0].id;
  for (const girl of squad) {
    girl.status = 'mission'; girl.remaining = mission.duration; girl.missionId = mission.id;
  }
  next.logs.unshift({ id: `log-dispatch-${mission.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'dispatch', text: `${squad.map(g => g.name).join('、')}已前往${districtOfMission(mission).name}的「${mission.title}」。${mission.work === 'combat' ? `魔物：${(mission.enemyIds ?? []).length} 体，预计 ${mission.rounds} 轮。` : '以调查与共情为主，不进入战斗。'}` });
  return { state: next, ok: true, message: `${squad.map(g => g.name).join('、')}已出发。` };
}
function care(state: GameState, girlId: string, mode: 'resting'): ActionResult {
  const next = clone(state); const girl = findGirl(next, girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}正在${statusLabels[girl.status]}，无法安排照顾。` };
  if (mode === 'resting') {
    if (girl.fatigue === 0) return { state, ok: false, message: `${girl.name}现在并不疲惫。` };
    girl.status = 'resting'; girl.remaining = 90;
    next.logs.unshift({ id: `log-rest-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}回到晚安宿舍休息（90 分钟）。${girl.corruption ? '宿舍的安静让侵蚀暂时退了一点。' : ''}` });
    return { state: next, ok: true, message: `${girl.name}开始休息，90 分钟后恢复。` };
  }
  return { state, ok: false, message: '宿舍只负责休息。受伤请去诊所。' };
}
function talkResponse(girl: Girl, text: string, bond: number): string {
  const stage = relationshipStage(bond);
  if (girl.id === 'wu' && /猫|咪|尾巴/.test(text)) return '雾眠把帽子掀开一角——里面蜷着一只不属于任何品种的小猫。「帽子里的猫说，它记得你上次留下的脚步声。」';
  if (/累|休息|睡/.test(text)) return stage >= 4 ? '「有一点。不过你在这里的话，我可以再撑一会儿。」她把额头轻轻靠在桌沿。' : '「我还好。谢谢关心。」她点点头，没有再多说。';
  if (/星星|月|夜/.test(text)) return stage >= 4 ? '「今晚的月亮很像你说话时的停顿。」她望向窗外，耳尖有一点红。' : '「夜空很安静。适合工作。」她把视线移回档案。';
  if (/对不起|抱歉/.test(text)) return stage >= 5 ? '「不要为已经发生的事道歉。你还在，就够了。」' : '「没关系。真的。」她停了一下，又补了一句，「至少现在没关系。」';
  if (stage >= 6) return `「你来了。」${girl.name}没有抬头，却把身边的位置往你这边挪了挪，「今天也想听你说说话。」`;
  if (stage >= 5) return `「嗯。」${girl.name}把杯子推到你面前，「先喝点热的。剩下的，慢慢说。」`;
  if (stage >= 3) return `「我在听。」${girl.name}合上手里的档案，「不过，如果你只是路过，也没关系。」`;
  return `「……知道了。」${girl.name}的语气很轻，像是在确认自己是否应该继续这个话题。`;
}
function talk(state: GameState, girlId: string, text: string, remote = false, reply?: string): ActionResult {
  const clean = text.trim();
  if (!clean) return { state, ok: false, message: '想说些什么，再按下发送。' };
  const next = clone(state); const girl = findGirl(next, girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (clean.length > 200) return { state, ok: false, message: '一次最多说 200 个字。' };
  if (remote) {
    if (!girl.retired) return { state, ok: false, message: `${girl.name}还没有退役，直接去会客厅找她吧。` };
    if (next.gold < REMOTE_CALL_COST) return { state, ok: false, message: `远程联络需要 ${REMOTE_CALL_COST} 星砂，当前不足。` };
    next.gold -= REMOTE_CALL_COST; book(next, next.day, -REMOTE_CALL_COST);
    const firstToday = girl.lastTalkDay !== next.day;
    const gain = firstToday ? 1 : 0;
    girl.lastTalkDay = next.day; girl.talksToday = firstToday ? 1 : (girl.talksToday ?? 0) + 1;
    girl.bond = Math.min(100, girl.bond + gain);
    const messages = next.messages[girl.id] ?? [];
    messages.push({ role: 'player', text: clean });
    const spoken = reply?.trim().slice(0, 400) || talkResponse(girl, clean, girl.bond);
    messages.push({ role: 'girl', text: reply?.trim() ? spoken : `（电话那头有很轻的电流声）${spoken}` });
    next.messages[girl.id] = messages.slice(-60);
    next.logs.unshift({ id: `log-call-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'relationship', text: `与退休在家的${girl.name}通了一次电话（${REMOTE_CALL_COST} 星砂）。`, delta: -REMOTE_CALL_COST });
    return { state: next, ok: true, message: gain ? `电话接通了。与${girl.name}的羁绊 +1。` : `电话接通了，但今晚已经聊过很久。` };
  }
  if (girl.retired) return { state, ok: false, message: `${girl.name}已经退役，改用远程联络吧。` };
  if (girl.status === 'mission') return { state, ok: false, message: `${girl.name}正在出勤，等她回来再聊吧。` };
  if (girl.status === 'expedition') return { state, ok: false, message: `${girl.name}正在星象台远行，暂时联络不上。` };
  const count = girl.lastTalkDay === next.day ? (girl.talksToday ?? 0) : 0;
  const assistantBonus = next.assistantId === girl.id ? 1 : 0;
  const gain = count < 3 ? 2 + assistantBonus : 0;
  girl.lastTalkDay = next.day; girl.talksToday = count + 1;
  girl.bond = Math.min(100, girl.bond + gain);
  const messages = next.messages[girl.id] ?? [];
  messages.push({ role: 'player', text: clean });
  messages.push({ role: 'girl', text: reply?.trim().slice(0, 400) || talkResponse(girl, clean, girl.bond) });
  next.messages[girl.id] = messages.slice(-60);
  return { state: next, ok: true, message: gain ? `与${girl.name}的羁绊 +${gain}。` : '今晚已经聊得够多了，明天再继续吧。' };
}
function applyOpinionChanges(state: GameState, opinion: Opinion, option: OpinionOption): { gold: number; tags: string[] } {
  let gold = 0;
  for (const change of option.changes ?? []) {
    if (change.kind === 'gold') {
      state.gold = Math.max(0, state.gold + change.amount);
      gold += change.amount;
      if (change.amount !== 0) book(state, state.day, change.amount);
    } else if (change.kind === 'reputation') {
      state.reputation = Math.max(0, Math.min(100, state.reputation + change.amount));
    } else if (change.kind === 'faction') {
      const target = state.factions[change.faction];
      if (target) target.standing = Math.max(0, Math.min(100, target.standing + change.amount));
    } else if (change.kind === 'item') {
      state.inventory[change.itemId] = Math.max(0, (state.inventory[change.itemId] ?? 0) + change.amount);
    } else if (change.kind === 'girl') {
      const girl = findGirl(state, change.girlId);
      if (girl) {
        if (change.field === 'bond') girl.bond = Math.max(0, Math.min(100, girl.bond + change.amount));
        if (change.field === 'fatigue') girl.fatigue = Math.max(0, Math.min(100, girl.fatigue + change.amount));
        if (change.field === 'corruption') girl.corruption = Math.max(0, Math.min(100, girl.corruption + change.amount));
        if (change.field === 'hp') girl.hp = Math.max(0, Math.min(effectiveMaxHp(girl), girl.hp + change.amount));
      }
    }
  }
  for (const outcome of option.outcomes ?? []) {
    if (outcome.kind === 'territory') {
      shiftTerritory(state, outcome.district, outcome.faction, `议会决议「${opinion.title}」`);
    } else if (outcome.kind === 'mission') {
      const mission = deployMissionTemplate(state, outcome.template);
      state.missions.push(mission);
      state.logs.unshift({ id: `log-op-mission-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'dispatch', text: `议会决议追加了特殊委托「${mission.title}」。` });
    } else if (outcome.kind === 'join') {
      const level = Math.max(1, Math.min(12, Math.round(outcome.level)));
      let candidate: Girl | undefined;
      for (let attempt = 0; attempt < 24 && !candidate; attempt++) {
        const next = makeCandidate(state, level, hashText(`${opinion.id}:join`) + attempt * 7919);
        if (!state.girls.some(girl => girl.id === next.id) && !state.candidates.some(girl => girl.id === next.id)) candidate = next;
      }
      if (candidate) {
        if (state.girls.filter(girl => !girl.dead).length < capacity(state)) {
          state.girls.push({ ...candidate, cost: 0, status: 'idle', roomId: 'lounge', remaining: 0, contractEndDay: state.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, retired: false, retiredReason: undefined, candidateUntilDay: undefined });
          state.logs.unshift({ id: `log-op-join-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `议会带来了新的契约者「${candidate.name}」，没有收取签约金。` });
        } else {
          state.candidates.push({ ...candidate, cost: 0, custom: true, candidateUntilDay: state.day + 7 });
          state.logs.unshift({ id: `log-op-join-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `宿舍已满，新的契约者「${candidate.name}」留在候选名册，签约金为 0。` });
        }
      }
    } else if (outcome.kind === 'leave') {
      const girl = findGirl(state, outcome.girlId);
      if (girl) {
        girl.retired = true; girl.retiredReason = 'contract'; girl.status = 'retired'; girl.remaining = 0;
        state.logs.unshift({ id: `log-op-leave-${opinion.id}`, time: dateLabel(state.day, state.minutes), kind: 'council', text: `议会决议结束了与「${girl.name}」的契约，她离开了值夜名册。` });
      }
    }
  }
  if (option.shift && !(option.outcomes ?? []).some(outcome => outcome.kind === 'territory')) shiftTerritory(state, option.shift.district, option.shift.faction, `议会决议「${opinion.title}」`);
  return { gold, tags: opinionOptionTags(option, state) };
}

export function act(state: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'reset': {
      const next = action.mode === 'blank' ? createBlankState() : createInitialState();
      return { state: next, ok: true, message: action.mode === 'blank' ? '空白档案已建立：只有会客厅与启动资金。' : '进度已重置。' };
    }
    case 'advance': return advance(state, action.minutes);
    case 'dispatch': return dispatch(state, action.girlIds, action.missionId);
    case 'care': return care(state, action.girlId, action.mode);
    case 'talk': return talk(state, action.girlId, action.text, action.remote, action.reply);
    case 'renewContract': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.retired) return { state, ok: false, message: `${girl.name}已经退役，请使用返聘。` };
      const cost = renewalCost(girl) + pensionArrears(girl);
      if (next.gold < cost) return { state, ok: false, message: `续签需要 ${cost} 星砂（含欠缴退休金 ${pensionArrears(girl)}）。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.contractEndDay = Math.max(next.day, girl.contractEndDay) + girl.contractDays;
      girl.contractRenewals += 1; girl.pensionMissed = 0;
      girl.bond = Math.min(100, girl.bond + 3);
      next.logs.unshift({ id: `log-renew-${girl.id}-${girl.contractRenewals}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${girl.name}续签 ${girl.contractDays} 日契约（第 ${girl.contractRenewals} 次续签），并结清退休金欠款。`, delta: -cost });
      return { state: next, ok: true, message: `${girl.name}的契约延长至第 ${girl.contractEndDay} 日。` };
    }
    case 'rehire': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.retired || girl.retiredReason !== 'contract') return { state, ok: false, message: '只有因欠约退休的契约者可以返聘。' };
      const cost = 600 + girl.level * 120;
      if (next.gold < cost) return { state, ok: false, message: `返聘需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.retired = false; girl.retiredReason = undefined; girl.status = 'idle'; girl.contractEndDay = next.day + CONTRACT_DAYS; girl.pensionMissed = 0;
      girl.bond = Math.max(0, girl.bond - 5);
      next.logs.unshift({ id: `log-rehire-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `${girl.name}接受返聘，重新回到夜班名册。` });
      return { state: next, ok: true, message: `${girl.name}已返聘，契约重新生效。` };
    }
    case 'setAssistant': {
      const next = clone(state);
      if (!action.girlId) { next.assistantId = undefined; return { state: next, ok: true, message: '已取消值班助理。' }; }
      const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.bond < 40) return { state, ok: false, message: `${girl.name}还需要更多信任（羁绊 40）才能担任值班助理。` };
      next.assistantId = action.girlId;
      next.logs.unshift({ id: `log-assistant-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}开始担任值班助理，会替你整理议题与排班。` });
      return { state: next, ok: true, message: `${girl.name}成为值班助理。` };
    }
    case 'seenPrologue': {
      if (state.prologueSeen) return { state, ok: true, message: '' };
      const next = clone(state);
      next.prologueSeen = true;
      return { state: next, ok: true, message: '' };
    }
    case 'setStarters': {
      const ids = Array.isArray(action.girlIds) ? [...new Set(action.girlIds)] : [];
      if (ids.length < 4 || ids.length > 6) return { state, ok: false, message: '开局编成至少 4 人、最多 6 人。' };
      const pool = new Set<string>([
        ...state.candidates.map(girl => girl.id),
        ...state.girls.filter(girl => !girl.retired).map(girl => girl.id),
      ]);
      if (ids.some(id => !pool.has(id))) return { state, ok: false, message: '有一位少女不在候选里。' };
      const roster = sanitizeFactionRoster(action.roster);
      if (!roster) return { state, ok: false, message: '三方阵容不合法：每方 1 位首领、1–4 位随从。' };
      const drafted = ids.map(id => {
        const existing = [...state.candidates, ...state.girls].find(girl => girl.id === id);
        return existing;
      }).filter((girl): girl is Girl => Boolean(girl));
      if (drafted.length !== ids.length) return { state, ok: false, message: '有一位少女不在候选里。' };
      const rosterGirlIds = new Set(FACTION_ORDER.flatMap(faction => roster[faction].memberIds));
      if (drafted.some(girl => rosterGirlIds.has(girl.id))) return { state, ok: false, message: '已经进入名册的少女不能再进势力阵容。' };
      const next = clone(state);
      const starters = drafted.map(girl => hydrate({ ...girl, candidateUntilDay: 0, status: 'idle', remaining: 0, roomId: 'lounge' }));
      const starterIds = new Set(starters.map(girl => girl.id));
      // 没被选中的原班人马直接离开事务所，不回市场。
      next.girls = starters;
      next.candidates = next.candidates.filter(girl => !starterIds.has(girl.id) && starterKeepInPool(girl));
      next.factionRoster = roster;
      next.startersPicked = true;
      next.logs.unshift({ id: `log-starters-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `开局编成完成：${starters.length} 位契约少女，三方阵容已定。` });
      return { state: next, ok: true, message: '编成已确认。' };
    }
    case 'hireLeader': {
      const leader = leaderById(action.leaderId);
      if (!leader) return { state, ok: false, message: '没有这位首领。' };
      const owner = FACTION_ORDER.find(faction => rosterLeader(state, faction).id === leader.id);
      if (!owner) return { state, ok: false, message: '她现在已经不在任何一方了。' };
      if (!factionCollapsed(state, owner)) return { state, ok: false, message: '她还有辖区要守。' };
      if (state.girls.some(girl => girl.id === leader.id && !girl.retired)) return { state, ok: false, message: '她已经在名册里。' };
      if (state.gold < LEADER_HIRE_COST) return { state, ok: false, message: `星砂不足（需要 ${LEADER_HIRE_COST}）。` };
      const next = clone(state);
      next.gold -= LEADER_HIRE_COST;
      next.factions[owner].standing = 0;
      for (const faction of FACTION_ORDER) if (faction !== owner) next.factions[faction].standing = Math.min(100, next.factions[faction].standing + 3);
      const baseMaxHp = Math.round(96 + leader.stats.empathy * 0.3) + leader.level * 4;
      next.girls.unshift(hydrate({
        id: leader.id, name: leader.name, codename: leaderTitle(leader, owner), title: leaderTitle(leader, owner),
        element: (owner === 'association' ? '星光系' : owner === 'government' ? '糖霜系' : '月影系') as Girl['element'], color: leader.color, portrait: '', portraitSpec: leader.portraitSpec,
        level: leader.level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp,
        spirit: 80 + leader.level * 2, maxSpirit: 80 + leader.level * 2,
        fatigue: 0, bond: 40, exp: 0, stats: { ...leader.stats }, baseStats: { ...leader.stats },
        status: 'idle', roomId: 'lounge', remaining: 0, skill: '', skills: [...leader.skillIds],
        description: leader.note, cost: 0, scars: [], relationships: {}, archetype: leader.archetype,
        quote: leader.quote, goal: '找一个不需要再替谁守门的位置。', goalKind: '成长', traits: [], conditions: [],
        contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: '', personality: '', outfitDescription: '', wardrobe: [], outfitId: 'uniform', expression: 'calm',
        corruption: 0, equipment: {}, factionTag: leader.origin, leader: true, starter: false,
      }));
      next.chronicle.unshift({ id: `chr-hire-${leader.id}-${next.day}`, at: dateLabel(next.day, next.minutes), day: next.day, kind: '登记', title: `${leader.name} 并入事务所`, summary: `${factionInfo[owner].name} 名下已无辖区，${leader.name} 签下了契约。` });
      next.logs.unshift({ id: `log-hire-${leader.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `${leader.name} 成为事务所的契约者（−${LEADER_HIRE_COST} 星砂）。` });
      return { state: next, ok: true, message: `${leader.name} 已加入。` };
    }
    case 'setOfficeProfile': {
      const next = clone(state);
      const profile = sanitizeOfficeProfile(action.profile);
      const before = state.office ?? DEFAULT_OFFICE_PROFILE;
      if (profile.background === before.background && profile.philosophy === before.philosophy && profile.goal === before.goal) {
        return { state, ok: false, message: '事务所档案没有变化。' };
      }
      next.office = profile;
      next.logs.unshift({ id: `log-office-profile-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: '事务所档案已更新：背景、理念与目标写进了世界书。' });
      return { state: next, ok: true, message: '事务所档案已写入世界书。' };
    }
    case 'decideOpinion': {
      const next = clone(state); let opinion = next.opinions.find(o => o.id === action.opinionId);
      if (!opinion || opinion.status !== 'pending') return { state, ok: false, message: '这项议题已经处理过了。' };
      const option = resolveOpinionOptions(next, opinion).find(entry => entry.id === action.decision);
      if (!option) return { state, ok: false, message: '找不到这个选项。' };
      const preview = previewOpinionOption(next, opinion, option);
      if (!preview.ok) return { state, ok: false, message: `资源不足：${preview.missing.join('；')}` };
      const decision = action.decision;
      opinion.status = decision === 'accept' ? 'accepted' : decision === 'reject' ? 'rejected' : 'deferred';
      if (decision === 'defer') opinion.revisitDay = next.day + 1;
      const applied = applyOpinionChanges(next, opinion, option);
      let working = next;
      if (preview.minutes > 0) {
        const moved = advance(next, preview.minutes);
        if (!moved.ok) return { state, ok: false, message: moved.message };
        working = moved.state;
      }
      opinion = working.opinions.find(o => o.id === action.opinionId);
      const verb = decision === 'accept' ? '批准' : decision === 'reject' ? '驳回' : '暂缓';
      const detail = applied.tags.length ? ` ${applied.tags.join('，')}。` : '';
      const revisit = decision === 'defer' ? ` 下个议事日（第 ${next.day + 1} 日）重新提出。` : '';
      working.logs.unshift({ id: `log-decide-${opinion?.id ?? action.opinionId}`, time: dateLabel(working.day, working.minutes), kind: 'council', text: `${verb}议题「${opinion?.title ?? ''}」。${detail}${revisit}`, delta: applied.gold });
      if (opinion?.storylineId && decision !== 'defer') resolveStoryWait(working, opinion.storylineId, 'opinion', opinion.id);
      return { state: working, ok: true, message: `已处理「${opinion?.title ?? ''}」。` };
    }
    case 'startExpedition': {
      const next = clone(state);
      if (next.expeditions.length >= 1) return { state, ok: false, message: '星象台一次只能支持一支远行队伍。' };
      const observatory = next.rooms.find(r => r.type === 'observatory');
      if (!observatory) return { state, ok: false, message: '需要先建造星象台。' };
      if (action.memberIds.length < 1 || action.memberIds.length > 2) return { state, ok: false, message: '远行队伍需要 1–2 人。' };
      const members = action.memberIds.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
      if (members.length !== action.memberIds.length) return { state, ok: false, message: '队伍成员无效。' };
      for (const girl of members) {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}当前无法参加远行。` };
        if (inWithdrawal(girl)) return { state, ok: false, message: `${girl.name}正在断药期，无法远行。请先使用月蚀抑制剂。` };
        if (girl.pensionMissed >= 15) return { state, ok: false, message: `${girl.name}的契约欠约过久，请先续签。` };
        girl.status = 'expedition'; girl.roomId = observatory.id;
      }
      next.expeditions.push({ id: `exp-${next.day}-${next.minutes}-${next.expeditions.length}`, roomId: observatory.id, memberIds: members.map(g => g.id), startedDay: next.day, startedMinutes: next.minutes, cyclesDone: 0, lastSettledDay: next.day, lastSettledMinutes: next.minutes });
      next.logs.unshift({ id: `log-exp-start-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: `${members.map(g => g.name).join('、')}进入星象台远行，每 60 分钟结算一次观测结果。` });
      return { state: next, ok: true, message: '远行开始，星象台将每小时回报一次。' };
    }
    case 'recallExpedition': {
      const next = clone(state); const expedition = next.expeditions.find(e => e.id === action.expeditionId);
      if (!expedition) return { state, ok: false, message: '这支远行队伍已经结束。' };
      for (const id of expedition.memberIds) { const girl = findGirl(next, id); if (girl && girl.status === 'expedition') girl.status = 'idle'; }
      next.expeditions = next.expeditions.filter(e => e.id !== expedition.id);
      next.logs.unshift({ id: `log-exp-recall-${expedition.id}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: '星象台远行队伍提前返回，最后一轮观测未结算。' });
      return { state: next, ok: true, message: '远行队伍已返回。' };
    }
    case 'clinic': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.dead) return { state, ok: false, message: '她已不在名册上。' };
      if (action.mode === 'treat') {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}正在${statusLabels[girl.status]}，现在不能开始治疗。` };
        if (treatmentFor(next, girl.id)) return { state, ok: false, message: `${girl.name}已经在治疗台上了。` };
        const quote = clinicQuote(girl, Boolean(action.kink));
        if (!quote.kink && quote.missing <= 0) return { state, ok: false, message: `${girl.name}没有需要处理的伤口。` };
        if (next.gold < quote.cost) return { state, ok: false, message: `这次治疗需要 ${quote.cost} 星砂，当前不足。` };
        const startedAt = absoluteMinutes(next.day, next.minutes);
        next.gold -= quote.cost; book(next, next.day, -quote.cost);
        girl.status = 'healing'; girl.remaining = quote.minutes;
        next.treatments.push({
          id: `treat-${girl.id}-${next.day}-${next.minutes}`, girlId: girl.id,
          startedAt, endsAt: startedAt + quote.minutes,
          hpStart: girl.hp, hpTarget: quote.kink ? girl.hp : effectiveMaxHp(girl), paid: quote.cost, kink: Boolean(action.kink),
        });
        next.logs.unshift({
          id: `log-treat-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'clinic',
          text: quote.kink
            ? `${girl.name}预约了一次癖好护理（120 分钟，${quote.cost} 星砂）。诊所把灯调暗了一档。`
            : `${girl.name}躺上诊所的治疗台（${quote.minutes} 分钟，${quote.cost} 星砂）。`,
          delta: -quote.cost,
        });
        return { state: next, ok: true, message: `${girl.name}开始治疗，约 ${quote.minutes} 分钟后结束。` };
      }
      if (action.mode === 'wipe') {
        if (girl.status === 'mission' || girl.status === 'expedition') return { state, ok: false, message: '出勤中的契约者无法进行记忆重塑。' };
        if (next.gold < 4000) return { state, ok: false, message: '记忆重塑需要 4,000 星砂。' };
        const oldLevel = girl.level;
        next.gold -= 4000; book(next, next.day, -4000);
        girl.level = 1; girl.exp = 0;
        girl.stats = { ...girl.baseStats };
        girl.baseMaxHp = Math.max(40, girl.baseMaxHp - (oldLevel - 1) * 4);
        girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
        girl.hp = girl.maxHp;
        girl.maxSpirit = Math.max(30, girl.maxSpirit - (oldLevel - 1) * 2);
        girl.spirit = girl.maxSpirit;
        girl.status = 'idle'; girl.remaining = 0; girl.conditions = [];
        next.logs.unshift({ id: `log-wipe-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}接受了记忆重塑。等级与能力回到起点，疤痕仍在。`, delta: -4000 });
        return { state: next, ok: true, message: `${girl.name}的能力已重塑至 1 级。` };
      }
      if (action.mode === 'clone') {
        if (girl.cloneOf || girl.generation) return { state, ok: false, message: '复制体不能再次被复制。' };
        if (girl.level < 3) return { state, ok: false, message: '只有 3 级以上的契约者可以进行复制。' };
        if (next.gold < 18000) return { state, ok: false, message: '复制契约需要 18,000 星砂。' };
        if (next.girls.filter(g => !g.dead).length >= capacity(next)) return { state, ok: false, message: '没有空余席位安置复制体。' };
        next.gold -= 18000; book(next, next.day, -18000);
        const seed = hashText(`${girl.id}:${next.day}:${next.minutes}`).toString(16).padStart(8, '0');
        const copy: Girl = {
          ...clone(girl), id: `g_${seed}`, name: `${girl.name}·复制体`, codename: `${girl.codename} II`, level: 1, exp: 0,
          stats: { ...girl.baseStats }, hp: girl.baseMaxHp, maxHp: girl.baseMaxHp, baseMaxHp: girl.baseMaxHp,
          spirit: Math.max(30, girl.maxSpirit - (girl.level - 1) * 2), maxSpirit: Math.max(30, girl.maxSpirit - (girl.level - 1) * 2),
          fatigue: 0, bond: 20, status: 'idle', roomId: 'lounge', remaining: 0, scars: [], conditions: [],
          relationships: {}, retired: false, dead: false, retiredReason: undefined, cloneOf: girl.id, generation: (girl.generation ?? 0) + 1,
          contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, missionId: undefined,
        };
        next.girls.push(copy);
        next.logs.unshift({ id: `log-clone-${copy.id}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `以${girl.name}为原体完成复制契约。复制体「${copy.name}」从 1 级开始。`, delta: -18000 });
        return { state: next, ok: true, message: `${copy.name}已加入名册。` };
      }
      return { state, ok: false, message: '未知的诊所项目。' };
    }
    case 'hire': {
      const next = clone(state); const candidate = next.candidates.find(g => g.id === action.girlId);
      if (!candidate) return { state, ok: false, message: '这位候选者已经不在名册上。' };
      if (next.gold < candidate.cost) return { state, ok: false, message: `星砂不足，还需要 ${candidate.cost - next.gold}。` };
      const used = next.girls.filter(g => !g.dead).length;
      if (used >= capacity(next)) return { state, ok: false, message: '基地席位已满，请先扩建宿舍或让资深契约者退役。' };
      next.gold -= candidate.cost;
      book(next, next.day, -candidate.cost);
      next.girls.push({ ...candidate, status: 'idle', roomId: 'lounge', remaining: 0, contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, retired: false, retiredReason: undefined });
      next.candidates = next.candidates.filter(g => g.id !== candidate.id);
      next.logs.unshift({ id: `log-hire-${candidate.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${candidate.name}缔结契约，事务所增加一位新的魔法少女。`, delta: -candidate.cost });
      next.opinions.unshift(makeOpinion(next, next.girls[next.girls.length - 1], '同伴', `欢迎${candidate.name}`, '新契约者已经住进宿舍。她想为对方准备一点什么。', '申请 300 星砂筹办一次小型欢迎会。'));
      return { state: next, ok: true, message: `${candidate.name}已加入夜糖事务所。` };
    }
    case 'build': {
      const next = clone(state); const room = next.rooms.find(r => r.id === (action.roomId ?? 'dorm')) ?? next.rooms.find(r => r.type === 'dorm')!;
      if (room.level >= 4) return { state, ok: false, message: '这个房间已经达到最高等级。' };
      const cost = buildCost(room);
      if (next.gold < cost) return { state, ok: false, message: `星砂不足，扩建需要 ${cost}。` };
      next.gold -= cost; room.level += 1;
      book(next, next.day, -cost);
      if (room.type === 'dorm') room.capacity += 2;
      next.logs.unshift({ id: `log-build-${room.id}-${room.level}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `${room.name}升至 ${room.level} 级${room.type === 'dorm' ? '，新增 2 个契约席位' : ''}。`, delta: -cost });
      return { state: next, ok: true, message: `${room.name}已升级${room.type === 'dorm' ? '，新增 2 个席位' : ''}。` };
    }
    case 'retire': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.status === 'mission') return { state, ok: false, message: '出勤中的契约者无法办理退役。' };
      if (girl.scars.length < 4) return { state, ok: false, message: '只有累积 4 道疤痕的契约者可以申请退役。' };
      girl.retired = true; girl.status = 'retired'; girl.retiredReason = 'injury';
      next.logs.unshift({ id: `log-retire-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}办理了退役，转任事务所文职。她的席位仍留在基地，并将按月领取退休金。` });
      return { state: next, ok: true, message: `${girl.name}已转为文职，不再参与派遣。` };
    }
    case 'changeOutfit': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.witch) return { state, ok: false, message: '魔女化期间已锁定在魔女化立绘；先点击衣柜第五格恢复普通形态。' };
      if (!girl.wardrobe.some(o => o.id === action.outfitId)) return { state, ok: false, message: '衣柜里没有这套服装。' };
      girl.outfitId = action.outfitId;
      return { state: next, ok: true, message: `${girl.name}换上了「${girl.wardrobe.find(o => o.id === action.outfitId)?.name}」。` };
    }
    case 'setExpression': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      girl.expression = action.expression;
      return { state: next, ok: true, message: `${girl.name}的表情已切换。` };
    }
    case 'setPersonality': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const text = action.text.trim().slice(0, 600);
      if (!text) return { state, ok: false, message: '性格描述不能为空。' };
      if (girl.witch) girl.witchPersonality = text;
      else girl.personality = text;
      return { state: next, ok: true, message: girl.witch ? `${girl.name}的魔女化性格记录已更新。` : `${girl.name}的性格记录已更新。` };
    }
    case 'endNight': return endNight(state);
    case 'importWardrobe': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const base = action.mode === 'replace' ? [] : girl.wardrobe;
      const incoming = action.outfits
        .map(outfit => sanitizeOutfit(outfit, girl.color))
        .filter((outfit): outfit is Outfit => Boolean(outfit))
        .filter(outfit => !base.some(existing => existing.id === outfit.id || existing.name === outfit.name));
      if (!incoming.length) return { state, ok: false, message: '没有可以导入的新服装（名称为空或与现有衣柜重名）。' };
      const merged: Outfit[] = [];
      for (const outfit of [...base, ...incoming]) {
        if (merged.some(existing => existing.id === outfit.id || existing.name === outfit.name)) continue;
        merged.push(outfit);
      }
      const kept = merged.slice(0, WARDROBE_LIMIT);
      const added = incoming.filter(outfit => kept.some(item => item.id === outfit.id)).length;
      const dropped = incoming.length - added;
      girl.wardrobe = kept;
      if (action.outfitId && kept.some(outfit => outfit.id === action.outfitId)) girl.outfitId = action.outfitId;
      else if (!kept.some(outfit => outfit.id === girl.outfitId)) girl.outfitId = kept[0].id;
      pruneOrphanVariants(girl);
      next.logs.unshift({ id: `log-wardrobe-import-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}的衣柜${action.mode === 'replace' ? '被替换并' : ''}新增 ${added} 套服装${dropped ? `（${dropped} 套因衣柜已满未导入）` : ''}。` });
      return { state: next, ok: true, message: `已导入 ${added} 套服装${dropped ? `，${dropped} 套因衣柜已满未导入` : ''}。` };
    }
    case 'removeOutfit': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.wardrobe.length <= 1) return { state, ok: false, message: '至少要为契约者保留一套服装。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      girl.wardrobe = girl.wardrobe.filter(item => item.id !== action.outfitId);
      if (girl.outfitId === action.outfitId) girl.outfitId = girl.wardrobe[0].id;
      pruneOrphanVariants(girl);
      return { state: next, ok: true, message: `「${outfit.name}」已从衣柜移除。` };
    }
    case 'renameOutfit': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      const name = action.name.trim().slice(0, 16);
      if (!name) return { state, ok: false, message: '服装名称不能为空。' };
      if (girl.wardrobe.some(item => item.id !== outfit.id && item.name === name)) return { state, ok: false, message: '衣柜里已经有同名服装。' };
      outfit.name = name;
      if (action.description !== undefined) outfit.description = action.description.trim().slice(0, 120);
      return { state: next, ok: true, message: `服装已改名为「${name}」。` };
    }
    case 'buyItem': {
      const next = clone(state);
      const entry = action.stockId
        ? next.marketStock.find(stock => stock.id === action.stockId)
        : next.marketStock.find(stock => !stock.sold && stock.itemId === action.itemId);
      if (!entry) return { state, ok: false, message: '今日货架已经售罄，明天会重新进货。' };
      if (entry.sold) return { state, ok: false, message: '这个货位今天已经售出，明天会刷新。' };
      const item = getItem(entry.itemId);
      if (!item) return { state, ok: false, message: '货架上没有这件物资。' };
      const standing = factionStanding(next, item.faction);
      if (standing < item.standingReq) return { state, ok: false, message: `${factionInfo[item.faction].name}声望需要 ${item.standingReq}，当前 ${standing}。` };
      if (item.id === 'tax-voucher' && (next.inventory['tax-voucher'] ?? 0) > 0) return { state, ok: false, message: '税补券每 7 日只能兑换一张。' };
      if (item.id === 'moon-drug' && (next.inventory['moon-drug'] ?? 0) >= 5) return { state, ok: false, message: '抑制剂最多囤积 5 支。' };
      const price = itemPrice(next, item);
      if (next.gold < price) return { state, ok: false, message: `购买需要 ${price} 星砂。` };
      next.gold -= price; book(next, next.day, -price);
      entry.sold = true;
      next.inventory[item.id] = (next.inventory[item.id] ?? 0) + 1;
      next.logs.unshift({ id: `log-buy-${entry.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `从${factionInfo[item.faction].name}购入「${item.name}」。`, delta: -price });
      return { state: next, ok: true, message: `已购入「${item.name}」，放入事务所仓库。` };
    }
    case 'equipItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId); const item = getItem(action.itemId);
      if (!girl || !item) return { state, ok: false, message: '找不到对应的契约者或装备。' };
      if (item.slot !== action.slot) return { state, ok: false, message: '这件物资不能装备到这个槽位。' };
      if ((next.inventory[item.id] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有这件装备。' };
      const previous = girl.equipment[action.slot];
      if (previous) next.inventory[previous] = (next.inventory[previous] ?? 0) + 1;
      next.inventory[item.id] -= 1;
      girl.equipment[action.slot] = item.id;
      girl.maxHp = effectiveMaxHp(girl); girl.hp = Math.min(girl.hp, girl.maxHp);
      girl.maxSpirit = effectiveMaxSpirit(girl); girl.spirit = Math.min(girl.spirit, girl.maxSpirit);
      return { state: next, ok: true, message: `${girl.name}装备了「${item.name}」。` };
    }
    case 'unequipItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到对应的契约者。' };
      const previous = girl.equipment[action.slot];
      if (!previous) return { state, ok: false, message: '这个槽位没有装备。' };
      next.inventory[previous] = (next.inventory[previous] ?? 0) + 1;
      delete girl.equipment[action.slot];
      girl.maxHp = effectiveMaxHp(girl); girl.hp = Math.min(girl.hp, girl.maxHp);
      girl.maxSpirit = effectiveMaxSpirit(girl); girl.spirit = Math.min(girl.spirit, girl.maxSpirit);
      return { state: next, ok: true, message: `${girl.name}卸下了「${getItem(previous)?.name ?? '装备'}」。` };
    }
    case 'useItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId); const item = getItem(action.itemId);
      if (!girl || !item) return { state, ok: false, message: '找不到对应的契约者或物资。' };
      if ((next.inventory[item.id] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有这件物资。' };
      if (item.effect === 'drug') {
        if (!girl.witch) return { state, ok: false, message: '只有魔女需要月蚀抑制剂。' };
        next.inventory[item.id] -= 1;
        girl.drugUntilDay = next.day + 10; girl.withdrawalDays = 0; girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + 20);
        next.logs.unshift({ id: `log-use-drug-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}使用了月蚀抑制剂。断药状态结束，药效维持至第 ${girl.drugUntilDay} 日。` });
        return { state: next, ok: true, message: `${girl.name}的断药状态已解除。` };
      }
      if (item.effect === 'heal') {
        next.inventory[item.id] -= 1;
        girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + (item.amount ?? 40));
        return { state: next, ok: true, message: `${girl.name}恢复了 ${item.amount ?? 40} 点生命。` };
      }
      if (item.effect === 'purify') {
        next.inventory[item.id] -= 1;
        girl.corruption = Math.max(0, girl.corruption - (item.amount ?? 8));
        return { state: next, ok: true, message: `${girl.name}完成净化课程，侵蚀度下降。` };
      }
      if (item.effect === 'taxRefund') {
        next.inventory[item.id] -= 1;
        next.gold += item.amount ?? 1500; book(next, next.day, item.amount ?? 1500);
        return { state: next, ok: true, message: `税补券兑换为 ${item.amount ?? 1500} 星砂。` };
      }
      if (item.effect === 'contractDiscount') {
        next.inventory[item.id] = (next.inventory[item.id] ?? 1) - 1;
        next.inventory['permit'] = 1;
        return { state: next, ok: true, message: '执勤许可已激活，下一次签约金降低 10%。' };
      }
      return { state, ok: false, message: '这件物资需要在对应界面使用。' };
    }
    case 'acceptFactionTask': {
      const next = clone(state); const faction = action.faction; const info = next.factions[faction];
      if (!info) return { state, ok: false, message: '未知势力。' };
      if (info.envoyTaskId) return { state, ok: false, message: '今天已经接下这位代表的委托了。' };
      const mission = factionTask(next, faction);
      next.missions.unshift(mission);
      info.envoyTaskId = mission.id;
      next.logs.unshift({ id: `log-envoy-${faction}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'council', text: `接下${factionInfo[faction].name}代表${factionInfo[faction].envoy}的委托「${mission.title}」。` });
      return { state: next, ok: true, message: `${factionInfo[faction].envoy}把任务书推了过来。` };
    }
    case 'upgradeMarket': {
      const next = clone(state); const cost = marketUpgradeCost(next.marketLevel);
      if (!cost || next.marketLevel >= 4) return { state, ok: false, message: '市场已经达到最高等级。' };
      if (next.gold < cost) return { state, ok: false, message: `市场升级需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost); next.marketLevel += 1;
      refreshMarket(next);
      next.logs.unshift({ id: `log-market-${next.marketLevel}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `市场扩建至 ${next.marketLevel} 级，每日名册增加至 ${marketSize(next.marketLevel)} 位。`, delta: -cost });
      return { state: next, ok: true, message: `市场升至 ${next.marketLevel} 级。` };
    }
    case 'advancedRecruit': {
      const next = clone(state); const level = action.level;
      if (!Number.isInteger(level) || level < 1 || level > 6) return { state, ok: false, message: '高级招聘只能指定 1–6 级。' };
      if (level > next.marketLevel + 2) return { state, ok: false, message: `当前市场等级最多指定 ${next.marketLevel + 2} 级。` };
      if (next.advancedDay === next.day) return { state, ok: false, message: '今天已经进行过一次高级招聘。' };
      const cost = advancedCost(level);
      if (next.gold < cost.gold) return { state, ok: false, message: `高级招聘需要 ${cost.gold} 星砂。` };
      if (next.reputation < cost.stability) return { state, ok: false, message: `城市安定度不足，需要 ${cost.stability}。` };
      if (next.candidates.length >= 6) return { state, ok: false, message: '候选名册已满，请先签约或等待刷新。' };
      next.gold -= cost.gold; next.reputation -= cost.stability; book(next, next.day, -cost.gold);
      next.advancedDay = next.day;
      const girl = makeCandidate(next, level, next.day + level * 31);
      girl.candidateUntilDay = next.day + 3;
      next.candidates.push(girl);
      next.logs.unshift({ id: `log-advanced-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'dispatch', text: `通过协会渠道指定招募 ${level} 级候选者「${girl.name}」，城市安定度 -${cost.stability}。`, delta: -cost.gold });
      return { state: next, ok: true, message: `${girl.name}已加入候选名册，保留 3 天。` };
    }
    case 'importCard': {
      const next = clone(state); const card = action.card;
      if (next.candidates.length >= next.poolLimits.candidates) return { state, ok: false, message: `候选名册已满（${next.poolLimits.candidates} 位），请先移除一位候选或到设置中调高上限。` };
      const key = girlCardHash(card);
      if ([...next.girls, ...next.candidates].some(girl => girl.cardId === key)) return { state, ok: false, message: '这张契约卡已经导入过，不能重复登记。' };
      const g = card.girl;
      if (!g.name || !Array.isArray(g.skillIds) || g.skillIds.length !== 3) return { state, ok: false, message: '契约卡资料不完整。' };
      const stats = { ...g.stats };
      const baseMaxHp = Math.round(96 + stats.empathy * 0.3);
      // 卡片自带定义的特性（自定义特性）优先；旧卡只写了 id，就只能靠全局目录。
      const cardTraits = (g.traits?.length
        ? g.traits.map(trait => ({ ...trait, tags: [...trait.tags] }))
        : g.traitIds.map(traitId => traitById.get(traitId)).filter((trait): trait is NonNullable<typeof trait> => Boolean(trait))
      ).slice(0, 6);
      const lostTraits = g.skippedTraits ?? 0;
      const id = `g_card_${key}`;
      // 出身按卡片来：导进来的少女保留她原来的立场，不再按 id 重新掷一次。
      // 旧卡片没有这个字段时，退回按名字确定性补齐，同一张卡导入结果始终一致。
      const cardOrigin = sanitizeGirlFaction(g.factionTag, g.name);
      const girl = hydrate({
        id, name: g.name, codename: g.codename, title: g.title, element: g.element, color: g.color,
        factionTag: cardOrigin,
        portrait: g.portrait ?? '', level: g.level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 80, maxSpirit: 80,
        fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
        skill: getSkill(g.skillIds[2]).name, skills: [...g.skillIds], description: g.appearance, cost: 1800 + g.level * 220,
        scars: [], relationships: {}, archetype: g.archetype, quote: g.quote,
        goal: g.goal, goalKind: '成长', traits: cardTraits, conditions: [],
        contractEndDay: next.day + 17, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: g.appearance, personality: g.personality, witchPersonality: g.witchPersonality, outfitDescription: g.outfitDescription,
        wardrobe: g.wardrobe?.length
          ? g.wardrobe
          : [customOutfitFor({ color: g.color, outfitDescription: g.outfitDescription, portrait: g.portrait, portraitSpec: g.portraitSpec })],
        outfitId: g.wardrobe?.length ? (g.outfitId ?? g.wardrobe[0].id) : 'custom',
        expression: g.expression ?? 'calm',
        corruption: 0, equipment: {}, custom: true, candidateUntilDay: next.day + 7, cardId: key,
        portraitSpec: g.portraitSpec, portraitHint: g.portraitHint ?? '', importedVariants: g.importedVariants,
        witchForm: g.witchForm ? { ...g.witchForm, id: 'witchform', form: 'witch' } : undefined,
      });
      next.candidates.push(girl);
      archive(next, '登记', girl.name, `从契约卡导入。${girl.title}。${girl.appearance}`);
      const lostNote = lostTraits > 0 ? `（${lostTraits} 条特性没能随卡片带来，已跳过）` : '';
      next.logs.unshift({ id: `log-card-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `契约卡「${girl.name}」已导入候选名册，保留 7 天。${lostNote}` });
      return { state: next, ok: true, message: `契约卡已导入：${girl.name}进入候选名册。${lostNote}` };
    }
    case 'importCards': {
      let next = state;
      const added: string[] = [];
      const skipped: string[] = [];
      const failed: string[] = [];
      for (const card of action.cards) {
        const result = act(next, { type: 'importCard', card });
        if (result.ok) { next = result.state; added.push(card.girl.name); continue; }
        if (result.message.includes('已经导入过')) skipped.push(card.girl.name);
        else failed.push(card.girl.name);
      }
      if (!added.length) {
        return { state, ok: false, message: `没有新的契约卡进名册。${skipped.length ? `跳过重复 ${skipped.length} 张。` : ''}${failed.length ? `${failed.length} 张没能登记。` : ''}` };
      }
      const merged = clone(next);
      merged.logs.unshift({ id: `log-cardbox-${merged.day}-${merged.minutes}-${added.length}`, time: dateLabel(merged.day, merged.minutes), kind: 'base', text: `契约卡库导入 ${added.length} 张：${added.join('、')}。` });
      return { state: merged, ok: true, message: cardboxReport(added.length, skipped.length, failed.length) };
    }
    case 'createGirl': {
      const next = clone(state); const draft = action.draft;
      if (next.gold < 300) return { state, ok: false, message: '发布自定义契约需要 300 星砂登记费。' };
      if (next.candidates.length >= 6) return { state, ok: false, message: '候选名册已满。' };
      if (!next.blank && next.reputation < 40) return { state, ok: false, message: '城市安定度需要达到 40 才能撰写新契约。' };
      const stats = draft.stats;
      const sum = stats.magic + stats.insight + stats.agility + stats.empathy;
      if (Object.values(stats).some(v => !Number.isFinite(v) || v < 40 || v > 90) || sum !== 260) return { state, ok: false, message: '四维每项需在 40–90，且总和必须为 260。' };
      if (draft.skillIds.length !== 3 || new Set(draft.skillIds).size !== 3) return { state, ok: false, message: '请选择三个不同的技能。' };
      if (draft.traits.length > 3) return { state, ok: false, message: '最多填写三个特性。' };
      const traits: Trait[] = draft.traits.filter(trait => trait.name.trim()).slice(0, 3).map(trait => ({
        id: `custom-trait-${hashText(`${trait.name}:${draft.name}`).toString(16)}`,
        name: trait.name.trim().slice(0, 16),
        polarity: trait.polarity,
        tags: ['自定义'],
        description: trait.description.trim().slice(0, 120) || '写在契约背面的那句话。',
      }));
      const baseMaxHp = Math.round(96 + stats.empathy * 0.3);
      const extra = draft.skillIds.reduce((acc, id) => acc + (getSkill(id).tier === 'ultimate' ? 700 : getSkill(id).tier === 'signature' ? 300 : 0), 0);
      const id = `g_${hashText(`${draft.name}:${next.day}:${next.minutes}:${next.candidates.length}`).toString(16).padStart(8, '0')}`;
      const customOutfit = customOutfitFor({ color: draft.color, outfitDescription: draft.outfitDescription, portrait: draft.portrait, portraitSpec: draft.appearanceSpec });
      const wardrobe = draft.wardrobe?.length ? draft.wardrobe.slice(0, 4) : [customOutfit];
      const witchForm = draft.witchForm ? { ...draft.witchForm, id: 'witchform' as const, form: 'witch' as const } : undefined;
      const outfitId = draft.outfitId && wardrobe.some(outfit => outfit.id === draft.outfitId) ? draft.outfitId : wardrobe[0].id;
      const validOutfitIds = new Set(wardrobe.map(outfit => outfit.id));
      if (witchForm) validOutfitIds.add('witchform');
      const importedVariants = sanitizeExpressionVariants(draft.importedVariants);
      for (const key of Object.keys(importedVariants)) {
        const parsed = parseExpressionVariantKey(key);
        if (!parsed || !validOutfitIds.has(parsed.outfitId)) delete importedVariants[key];
      }
      const girl = hydrate({
        id, name: draft.name, codename: draft.codename, title: draft.title, element: draft.element, color: draft.color,
        portrait: draft.portrait ?? wardrobe.find(outfit => outfit.portrait)?.portrait ?? '', level: 1, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 80, maxSpirit: 80,
        fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
        skill: getSkill(draft.skillIds[2]).name, skills: draft.skillIds, description: draft.appearance, cost: 1800 + Math.max(0, sum - 260) * 40 + extra,
        scars: [], relationships: {}, archetype: draft.archetype, quote: draft.quote,
        goal: draft.goal, goalKind: '成长', traits, conditions: [],
        contractEndDay: next.day + 17, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: draft.appearance, personality: draft.personality, outfitDescription: draft.outfitDescription,
        portraitHint: draft.portraitHint?.trim().slice(0, 80) ?? '',
        wardrobe, outfitId, importedVariants, witchForm, expression: 'calm', corruption: 0, equipment: {}, custom: true, candidateUntilDay: next.day + 7,
        factionTag: draft.factionTag,
      });
      next.gold -= 300; book(next, next.day, -300);
      next.candidates.push(girl);
      archive(next, '登记', girl.name, `${girl.title}。${girl.appearance}`);
      next.logs.unshift({ id: `log-custom-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `新契约「${girl.name}」已发布到候选名册，保留 7 天。登记费 300 星砂。`, delta: -300 });
      return { state: next, ok: true, message: `${girl.name}已进入候选名册。` };
    }
    case 'setVariant': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const parsed = parseExpressionVariantKey(action.key);
      if (!parsed) return { state, ok: false, message: '表情差分的服装或表情无法识别。' };
      if (!isExpressionVariantData(action.dataUrl)) return { state, ok: false, message: '差分需要是 1.6MB 以内的图片。' };
      if (!girl.importedVariants) girl.importedVariants = {};
      const usedForOutfit = Object.keys(girl.importedVariants).filter(key => parseExpressionVariantKey(key)?.outfitId === parsed.outfitId).length;
      if (!girl.importedVariants[action.key] && usedForOutfit >= EXPRESSION_VARIANT_LIMIT) return { state, ok: false, message: `这套服装最多保存 ${EXPRESSION_VARIANT_LIMIT} 张表情差分，请先删除旧图。` };
      girl.importedVariants[action.key] = action.dataUrl;
      return { state: next, ok: true, message: `「${expressionLabel(parsed.expression)}」表情差分已保存。` };
    }
    case 'setVariants': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const entries = Object.entries(action.variants);
      if (!entries.length) return { state, ok: false, message: '没有可保存的表情差分。' };
      const staged = { ...(girl.importedVariants ?? {}) };
      for (const [key, dataUrl] of entries) {
        if (!parseExpressionVariantKey(key)) return { state, ok: false, message: `无法识别差分键「${key}」。` };
        if (!isExpressionVariantData(dataUrl)) return { state, ok: false, message: '差分需要是 1.6MB 以内的图片。' };
        staged[key] = dataUrl;
      }
      const perOutfit = new Map<string, number>();
      for (const key of Object.keys(staged)) {
        const parsed = parseExpressionVariantKey(key);
        if (!parsed) return { state, ok: false, message: `无法识别差分键「${key}」。` };
        perOutfit.set(parsed.outfitId, (perOutfit.get(parsed.outfitId) ?? 0) + 1);
      }
      if ([...perOutfit.values()].some(count => count > EXPRESSION_VARIANT_LIMIT)) return { state, ok: false, message: `每套服装最多保存 ${EXPRESSION_VARIANT_LIMIT} 张表情差分。` };
      girl.importedVariants = staged;
      return { state: next, ok: true, message: `已保存 ${entries.length} 张表情差分。` };
    }
    case 'deleteVariant': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.importedVariants?.[action.key]) return { state, ok: false, message: '这张表情差分已经不存在。' };
      delete girl.importedVariants[action.key];
      return { state: next, ok: true, message: '表情差分已移除。' };
    }
    case 'setOutfitDescription': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const outfit = girl.wardrobe.find(item => item.id === action.outfitId);
      if (!outfit) return { state, ok: false, message: '衣柜里没有这套服装。' };
      const description = action.description.trim().slice(0, 200);
      if (!description) return { state, ok: false, message: '描述不能为空。' };
      outfit.description = description;
      return { state: next, ok: true, message: `「${outfit.name}」的描述已更新。` };
    }
    case 'setWitchForm': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!action.outfit) {
        if (!girl.witch) return { state, ok: false, message: `${girl.name}现在没有处于魔女化状态。` };
        girl.witch = false;
        return { state: next, ok: true, message: `${girl.name}已恢复普通形态；魔女化立绘仍留在衣柜第五格。` };
      }
      const activate = action.activate !== false;
      const witchAt = loadBalance().corruptionThreshold;
      if (activate && girl.corruption < witchAt && !girl.witch) return { state, ok: false, message: `${girl.name}的侵蚀还没有到能切换到魔女姿态的程度（${witchAt}）。立绘仍可以先导入。` };
      const outfit = sanitizeOutfit({ ...action.outfit, id: 'witchform', form: 'witch' }, girl.color);
      if (!outfit) return { state, ok: false, message: '这份魔女化立绘无法识别。' };
      girl.witchForm = { ...outfit, form: 'witch' };
      const witchPersonality = action.personality?.trim().slice(0, 600);
      if (witchPersonality) girl.witchPersonality = witchPersonality;
      if (!activate) return { state: next, ok: true, message: `${girl.name}的魔女化立绘已保存到衣柜第五格。` };
      girl.witch = true;
      if (!girl.witchPersonality?.trim()) girl.witchPersonality = defaultWitchPersonality(girl);
      next.logs.unshift({ id: `log-witchform-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}允许你保存了她的魔女化立绘。` });
      return { state: next, ok: true, message: `${girl.name}已切换到魔女化立绘，普通服装暂时锁定。` };
    }
    case 'clearWitchForm': {
      const next = clone(state); const girl = findRosterGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.witchForm) return { state, ok: false, message: '还没有保存过魔女化立绘。' };
      girl.witchForm = undefined;
      girl.witch = false;
      return { state: next, ok: true, message: `${girl.name}的魔女化立绘已撤下，第五格重新空出。` };
    }
    case 'mergeIncidentPool': {
      const merged = clone(state);
      const added = mergeIncidentPool(merged, action.entries, { day: merged.day, minutes: merged.minutes });
      if (added <= 0) return { state, ok: false, message: '这批事件没有能用的。' };
      merged.logs.unshift({ id: `log-incident-pool-${merged.day}-${merged.incidentSeq}`, time: dateLabel(merged.day, merged.minutes), kind: 'incident', text: `夜里又攒下 ${added} 件还没摆上桌的事。` });
      return { state: merged, ok: true, message: `桌上多出 ${added} 件还没轮到的事。` };
    }
    case 'addIncident': {
      const next = clone(state);
      if (next.incidents.some(incident => incident.id === action.incident.id)) return { state, ok: false, message: '这条事件已经在队列里了。' };
      if (next.incidents.filter(incident => incident.status === 'pending').length >= 5) return { state, ok: false, message: '待处理事件太多，先清掉手上的再说。' };
      const incident: Incident = { ...action.incident, day: next.day, status: 'pending' };
      if (!incident.options?.length) return { state, ok: false, message: '事件没有可选的应对方式。' };
      next.incidents.unshift(incident);
      next.logs.unshift({ id: `log-incident-new-${incident.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `必须现在决定：${incident.title}。` });
      return { state: next, ok: true, message: '一件必须立刻决定的事摆在了桌上。' };
    }
    case 'joinFront': {
      const next = clone(state);
      next.fronts = next.fronts ?? [];
      const front = next.fronts.find(item => item.id === action.frontId);
      if (!front) return { state, ok: false, message: '这条战线已经结束了。' };
      if (front.status !== 'open') return { state, ok: false, message: '这条战线已经有人站过去了。' };
      const squad: string[] = [];
      for (const id of action.girlIds) {
        const girl = findGirl(next, id);
        if (!girl) return { state, ok: false, message: '名单里有找不到的人。' };
        if (girl.dead || girl.retired) return { state, ok: false, message: `${girl.name}已经不在名册上了。` };
        if (girl.status === 'mission' || girl.status === 'resting') return { state, ok: false, message: `${girl.name}现在走不开。` };
        if (girl.hp <= 0) return { state, ok: false, message: `${girl.name}伤得太重，上不了街。` };
        if (girlInFront(next, girl.id)) return { state, ok: false, message: `${girl.name}已经在另一条战线上了。` };
        squad.push(girl.id);
      }
      if (!squad.length) return { state, ok: false, message: '至少要带一个人过去。' };
      front.side = action.side;
      front.squad = squad;
      front.status = 'joined';
      const backed = action.side === 'attacker' ? front.attacker : front.defender;
      next.logs.unshift({
        id: `log-front-join-${front.id}`, time: dateLabel(next.day, next.minutes), kind: 'battle',
        text: `我们站到了${factionName[backed]}这边：${frontLabel(front)}。${squad.length} 个人过去了。`,
      });
      return { state: next, ok: true, message: `已经把人派到${districts[front.district].name}。` };
    }
    case 'resolveIncident': {
      const next = clone(state); const incident = next.incidents.find(item => item.id === action.incidentId);
      if (!incident || incident.status !== 'pending') return { state, ok: false, message: '这件事已经处理过了。' };
      const option = action.optionId ? incident.options.find(item => item.id === action.optionId) : undefined;
      if (!option && incident.options.length > 0) return { state, ok: false, message: '没有这个选项。' };
      if (option) incident.choiceId = option.id;
      incident.status = 'resolved';
      incident.resolvedAt = dateLabel(next.day, next.minutes);
      applyIncidentEffect(next, incident, option?.effect ?? incident.scene?.effect ?? {});
      if (incident.templateId?.startsWith('resign-')) applyResignationChoice(next, incident);
      if (incident.storylineId) resolveStoryWait(next, incident.storylineId, 'incident', incident.id);
      return { state: next, ok: true, message: option ? `已决定：${option.label}。` : `「${incident.title}」看过了。` };
    }
    case 'startStoryline': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.retired || girl.dead) return { state, ok: false, message: '她已经不在名册上了。' };
      if (next.storylines.some(story => story.girlId === girl.id && story.status === 'active')) return { state, ok: false, message: `${girl.name}还有一条没走完的故事线。` };
      const finished = next.storylines.filter(story => story.girlId === girl.id && story.status === 'done');
      const slot = finished.length + 1;
      if (slot > STORY_SLOT_MAX) return { state, ok: false, message: `${girl.name}的三段故事都讲完了，剩下的日子该往前走了。` };
      if (girl.bond < 20) return { state, ok: false, message: `${girl.name}还没有到愿意讲过去的程度（羁绊 20）。` };
      const plan = girl.storyPlan;
      if (plan && !playableStoryPlan(plan)) return { state, ok: false, message: '这张蓝图还没有开始或结束节点，先补完再开场。' };
      if (plan) {
        const blockers = validateGraph(ensureGraph(plan)).filter(issue => issue.level === 'error');
        if (blockers.length) return { state, ok: false, message: `蓝图还有 ${blockers.length} 处要修：${blockers[0].message}` };
      }
      const storyline = plan
        ? planToStoryline(girl, plan, next.day, next.minutes)
        : buildTemplateStoryline(next, girl, action.direction);
      storyline.slot = slot;
      if (finished.length) storyline.requires = finished[finished.length - 1].id;
      next.storylines.unshift(storyline);
      if (storyline.graph) startStoryGraph(next, storyline);
      else spawnStoryBeat(next, storyline);
      next.logs.unshift({ id: `log-story-start-${storyline.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}的故事「${storyline.title}」开始了。` });
      archive(next, '关系', `${girl.name}的故事`, storyline.premise);
      return { state: next, ok: true, message: `「${storyline.title}」已开启，去详情页走第一幕。` };
    }
    case 'setStoryPlan': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!action.plan) {
        girl.storyPlan = undefined;
        return { state: next, ok: true, message: '已移除故事蓝图。' };
      }
      const plan = sanitizeStoryPlan(action.plan);
      if (!plan) return { state, ok: false, message: '剧本至少要有一幕，或者一张带开始与结束节点的蓝图。' };
      girl.storyPlan = plan;
      return {
        state: next, ok: true,
        message: plan.graph
          ? `「${plan.title}」的蓝图已保存到${girl.name}的卡片里（${plan.graph.nodes.length} 个节点）。`
          : `「${plan.title}」已保存到${girl.name}的卡片里。`,
      };
    }
    case 'addStoryline': {
      const next = clone(state); const incoming = action.storyline;
      const girl = findGirl(next, incoming.girlId);
      if (!girl) return { state, ok: false, message: '找不到这条故事线的主角。' };
      if (!incoming.beats?.length) return { state, ok: false, message: '故事线没有可用的一幕。' };
      next.storylines = next.storylines.filter(story => !(story.girlId === girl.id && story.status === 'active' && story.source === 'template'));
      next.storylines.unshift({ ...incoming, source: 'llm', status: 'active', stage: 0 });
      spawnStoryBeat(next, next.storylines[0]);
      next.logs.unshift({ id: `log-story-llm-${incoming.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `叙事者写完了「${incoming.title}」的 ${incoming.beats.length} 幕。` });
      return { state: next, ok: true, message: `故事线「${incoming.title}」已就位。` };
    }
    case 'decideStoryChoice': {
      const next = clone(state); const story = next.storylines.find(item => item.id === action.storylineId);
      if (!story || story.status !== 'active') return { state, ok: false, message: '这条故事线已经结束了。' };
      const beat = story.beats.find(item => item.id === action.beatId);
      if (!beat) return { state, ok: false, message: '找不到这一幕。' };
      if (beat.mission) return { state, ok: false, message: '这一幕要先完成她给出的委托。' };
      if (beat.resolvedChoiceId) return { state, ok: false, message: '这一幕已经做过了选择。' };
      const choice = beat.choices.find(item => item.id === action.choiceId);
      if (!choice) return { state, ok: false, message: '没有这个选项。' };
      const girl = findGirl(next, story.girlId);
      if (girl) applyStoryEffect(next, girl, choice.effect, `故事线「${story.title}」`);
      beat.resolvedChoiceId = choice.id;
      beat.resolvedAt = dateLabel(next.day, next.minutes);
      story.stage = Math.min(story.beats.length, story.stage + 1);
      if (story.stage >= story.beats.length && girl) {
        story.status = 'done';
        girl.bond = Math.min(100, girl.bond + 5);
        archive(next, '关系', `${story.title}（完）`, `${girl.name}的故事走到第四幕，选择由你做出。`);
      }
      next.logs.unshift({ id: `log-story-choice-${story.id}-${beat.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${story.title}」${beat.title}：${choice.label}。` });
      return { state: next, ok: true, message: story.status === 'done' ? '这条故事线已经走完。' : '选择已记下，继续下一幕。' };
    }
    case 'advanceStoryline': {
      const next = clone(state); const story = next.storylines.find(item => item.id === action.storylineId);
      if (!story || story.status !== 'active') return { state, ok: false, message: '这条故事线已经结束了。' };
      story.stage = Math.min(story.beats.length, story.stage + 1);
      if (story.stage >= story.beats.length) story.status = 'done';
      return { state: next, ok: true, message: '故事线向后推进了一幕。' };
    }
    case 'addCharacterEvent': {
      const next = clone(state); const incoming = action.event;
      const girl = findGirl(next, incoming.girlId);
      if (!girl) return { state, ok: false, message: '找不到事件的主角。' };
      if (next.events.some(event => event.id === incoming.id)) return { state, ok: false, message: '这个事件已经存在。' };
      next.events.unshift({ ...incoming, stage: 0, status: 'active', badge: true });
      girl.eventBadge = '新';
      next.logs.unshift({ id: `log-event-new-${incoming.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}有了一段新的私人事件：${incoming.title}。` });
      return { state: next, ok: true, message: `${girl.name}的头像上多了一个角标。` };
    }
    case 'startCharacterEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段事件。' };
      if (event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      event.status = 'active';
      event.stage = 0;
      const girl = findGirl(next, event.girlId);
      if (girl) girl.eventBadge = '!';
      return { state: next, ok: true, message: '事件开始。' };
    }
    case 'advanceEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      if (event.stage >= event.scenes.length - 1) {
        event.status = 'done'; event.badge = false;
        const girl = findGirl(next, event.girlId);
        if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 4); }
        archive(next, '关系', event.title, `${findGirl(next, event.girlId)?.name ?? '她'}的私人事件告一段落。`);
        finishStoryEvent(next, event);
        return { state: next, ok: true, message: '事件收束。' };
      }
      event.stage += 1;
      return { state: next, ok: true, message: '进入下一场。' };
    }
    case 'beginStoryEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      if (!action.passages.length) return { state, ok: false, message: '这段剧情还没有内容。' };
      event.mode = 'story';
      event.passages = action.passages;
      event.passageIndex = 0;
      event.chosen = [];
      event.summary = action.summary;
      event.pending = false;
      event.badge = false;
      return { state: next, ok: true, message: '剧情开幕。' };
    }
    case 'chooseStoryPort': {
      const next = clone(state);
      const story = next.storylines.find(item => item.id === action.storylineId && item.status === 'active');
      if (!story?.graph || !story.run) return { state, ok: false, message: '这条故事线没有可以选择的岔路。' };
      const node = story.graph.nodes.find(item => item.id === story.run?.waiting?.ref);
      if (!node || node.kind !== 'choice' || node.data.kind !== 'choice') return { state, ok: false, message: '现在没有在等你的选择。' };
      const edge = story.graph.edges.find(item => item.from === node.id && item.fromPort === action.port);
      const option = node.data.options.find(item => item.id === action.port);
      if (!edge || !option) return { state, ok: false, message: '这个选项走不通。' };
      const girl = findGirl(next, story.girlId);
      if (girl && option.effect) applyStoryEffect(next, girl, option.effect, '剧情「' + story.title + '」');
      story.run.waiting = undefined;
      story.run.cursor = edge.to;
      advanceStoryGraph(next, story);
      next.logs.unshift({ id: 'log-port-' + story.id + '-' + action.port, time: dateLabel(next.day, next.minutes), kind: 'story', text: '你选了：' + option.label.slice(0, 60) + '。' });
      return { state: next, ok: true, message: '剧情继续。' };
    }
    case 'chooseStoryPassage': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active' || event.mode !== 'story') return { state, ok: false, message: '这段剧情已经结束了。' };
      const index = event.passageIndex ?? 0;
      const passage = event.passages?.[index];
      const choice = passage?.choices.find(item => item.id === action.choiceId);
      if (!passage || !choice) return { state, ok: false, message: '这一段没有需要做出的选择。' };
      const girl = findGirl(next, event.girlId);
      if (girl && choice.effect) applyStoryEffect(next, girl, choice.effect, `剧情「${event.title}」`);
      event.chosen = [...(event.chosen ?? []), choice.id];
      next.logs.unshift({ id: `log-passage-${event.id}-${index}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${event.title}」：${choice.label}。` });
      const after = index + 1;
      if (after >= (event.passages?.length ?? 0)) {
        event.status = 'done';
        event.badge = false;
        if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 5); }
        archive(next, '关系', event.title, event.summary ?? `${girl?.name ?? '她'}的这段剧情收束了。`);
        finishStoryEvent(next, event);
        return { state: next, ok: true, message: '这段剧情收束了。' };
      }
      event.passageIndex = after;
      if (girl) girl.eventBadge = undefined;
      return { state: next, ok: true, message: '继续。' };
    }
    case 'resolveEvent': {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      const scene = event.scenes[event.stage];
      const choice = scene?.choices?.find(item => item.id === action.choiceId);
      if (!choice) return { state: next, ok: true, message: '这一幕没有需要做出的选择。' };
      const girl = findGirl(next, event.girlId);
      if (girl) applyStoryEffect(next, girl, choice.effect, `事件「${event.title}」`);
      event.status = 'done'; event.badge = false;
      if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 2); }
      next.logs.unshift({ id: `log-event-choice-${event.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${event.title}」：${choice.label}。` });
      finishStoryEvent(next, event);
      return { state: next, ok: true, message: '事件结束。' };
    }
    case 'setPoolLimit': {
      const next = clone(state);
      const value = Math.max(1, Math.min(40, Math.round(action.value)));
      next.poolLimits[action.pool] = value;
      return { state: next, ok: true, message: `${action.pool === 'missions' ? '事件池' : action.pool === 'monsters' ? '魔物池' : '市场池'}上限已设为 ${value}。` };
    }
    case 'deleteMission': {
      const target = state.missions.find(m => m.id === action.missionId);
      if (!target) return { state, ok: false, message: '没有找到这条事件。' };
      if (target.status === 'active') return { state, ok: false, message: '委托进行中，不能从事件池移除。' };
      if (target.storylineId) return { state, ok: false, message: '故事委托会跟着剧情走，不能从池里删掉。' };
      const next = clone(state);
      next.missions = next.missions.filter(m => m.id !== action.missionId);
      next.logs.unshift({ id: `log-pool-${action.missionId}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `从事件池移除了「${target.title}」。` });
      return { state: next, ok: true, message: '事件已从池中移除。' };
    }
    case 'deleteCandidate': {
      const target = state.candidates.find(g => g.id === action.girlId);
      if (!target) return { state, ok: false, message: '没有找到这位候选者。' };
      const next = clone(state);
      next.candidates = next.candidates.filter(g => g.id !== action.girlId);
      return { state: next, ok: true, message: `${target.name} 的候选档案已移除。` };
    }
    case 'deleteMonster': {
      const target = monsters.find(m => m.id === action.monsterId);
      if (!target) return { state, ok: false, message: '没有找到这只魔物。' };
      if ((state.removedMonsters ?? []).includes(action.monsterId)) return { state, ok: false, message: '这只魔物已经离开魔物池。' };
      const next = clone(state);
      next.removedMonsters = [...(next.removedMonsters ?? []), action.monsterId];
      next.customMonsters = (next.customMonsters ?? []).filter(m => m.id !== action.monsterId);
      const affected = next.missions.filter(m => m.enemyIds?.includes(action.monsterId));
      next.missions = next.missions.filter(m => !m.enemyIds?.includes(action.monsterId) || m.status === 'active');
      for (const m of affected) if (m.status !== 'active') next.logs.unshift({ id: `log-pool-${m.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'battle', text: `「${m.title}」因魔物被移出池而消散。` });
      return { state: next, ok: true, message: `${target.name} 已从魔物池移除。` };
    }
    case 'addGeneratedContent': {
      const gate = canAcceptGeneratedContent(state);
      if (!gate.ok) return { state, ok: false, message: gate.message };
      if (state.missions.some(m => m.id === action.mission.id) || state.candidates.some(g => g.id === action.girl.id) || state.customMonsters.some(m => m.id === action.monster.id)) return { state, ok: false, message: '生成内容与现有条目重复。' };
      if (action.envoyMission && state.missions.some(m => m.id === action.envoyMission!.id)) return { state, ok: false, message: '使者委托与现有事件重复。' };
      if (action.items?.length && action.items.some(item => state.generatedItems.some(existing => existing.id === item.id))) return { state, ok: false, message: '生成装备与现有条目重复。' };
      const next = clone(state);
      const annotate = (m: Mission): Mission => annotateMission(next, m);
      next.customMonsters.push(action.monster);
      next.candidates.push(action.girl);
      next.missions.push(annotate({ ...action.mission, generated: true, sourcePack: 'llm' }));
      if (action.envoyMission) {
        next.missions.push(annotate({ ...action.envoyMission, generated: true, sourcePack: 'llm' }));
        if (action.envoyMission.faction) next.factions[action.envoyMission.faction].envoyTaskId = action.envoyMission.id;
      }
      if (action.items?.length) {
        const fresh = action.items.filter(item => validGeneratedItem(item) && !next.generatedItems.some(existing => existing.id === item.id)).slice(0, 2);
        for (const item of fresh) registerItem(item);
        next.generatedItems.push(...fresh);
      }
      if (action.opinion) next.opinions.unshift(action.opinion);
      archive(next, '魔物', action.monster.name, `${action.monster.epithet}。${action.monster.description}`);
      archive(next, '少女', action.girl.name, `${action.girl.title} · ${action.girl.element} · ${action.girl.archetype}`);
      archive(next, '事件', action.mission.title, action.mission.description);
      if (action.opinion) archive(next, '议程', action.opinion.title, action.opinion.text);
      if (action.envoyMission) archive(next, '代表', action.envoyMission.title, action.envoyMission.description);
      for (const item of (action.items ?? []).slice(0, 2)) archive(next, '登记', item.name, item.description);
      next.logs.unshift({ id: `log-gen-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `叙事者提交了新的夜班提案：「${action.mission.title}」。市场出现候选者 ${action.girl.name}${action.opinion ? `，会客厅多了一份议题「${action.opinion.title}」` : ''}${action.items?.length ? `，仓库登记了 ${action.items.length} 件新装备` : ''}。` });
      return { state: next, ok: true, message: '新的委托已出现在地图上，候选者进入市场，会客厅也收到了议题。' };
    }
    case 'saveBattleNote': {
      const note = action.note;
      if (!validBattleNote(note)) return { state, ok: false, message: '这份战斗札记不完整，无法保存。' };
      if (!state.battles.some(battle => battle.id === note.battleId)) return { state, ok: false, message: '找不到对应的战斗记录。' };
      const next = clone(state);
      next.battleNotes = [note, ...(next.battleNotes ?? []).filter(item => item.battleId !== note.battleId)].slice(0, 20);
      return { state: next, ok: true, message: `已保存「${note.title}」。` };
    }
    case 'deleteBattleNote': {
      const next = clone(state);
      const before = (next.battleNotes ?? []).length;
      next.battleNotes = (next.battleNotes ?? []).filter(item => item.battleId !== action.battleId);
      return before === next.battleNotes.length
        ? { state, ok: false, message: '这场战斗还没有札记。' }
        : { state: next, ok: true, message: '已删除这场战斗的札记。' };
    }
    default: return { state, ok: false, message: '未知操作。' };
  }
}

/** 生成前的池容量预检，避免自动补充先花掉 API 请求再被拒。 */
export function canAcceptGeneratedContent(state: GameState): { ok: boolean; message: string } {
  const open = state.missions.filter(m => m.status !== 'done').length;
  if (open + 2 > state.poolLimits.missions) return { ok: false, message: '事件池至少需要两个空位，先移除事件再生成。' };
  if (state.candidates.length >= state.poolLimits.candidates) return { ok: false, message: '市场池已满，先移除一位候选者再生成。' };
  if (state.customMonsters.length + monsters.length - state.removedMonsters.length >= state.poolLimits.monsters) return { ok: false, message: '魔物池已满，先移除一只魔物再生成。' };
  return { ok: true, message: '' };
}

function validGeneratedItem(item: unknown): item is Equipment {
  if (!item || typeof item !== 'object') return false;
  const entry = item as Equipment;
  if (typeof entry.id !== 'string' || !entry.id.startsWith('lm_item_')) return false;
  if (typeof entry.name !== 'string' || !entry.name || typeof entry.description !== 'string') return false;
  if (!['weapon', 'charm', 'consumable'].includes(entry.slot)) return false;
  if (!['witch', 'association', 'government'].includes(entry.faction)) return false;
  if (entry.stats && (typeof entry.stats !== 'object' || Array.isArray(entry.stats))) return false;
  return true;
}

const characterIds = new Set(['yue', 'tang', 'ling', 'wu', 'zhi', 'lu']);
function safeId(id: unknown): id is string {
  return typeof id === 'string' && (characterIds.has(id) || /^g_[a-z0-9]{6,}$/.test(id));
}
function validGirl(value: unknown): value is Girl {
  if (!value || typeof value !== 'object') return false;
  const g = value as Girl;
  if (!safeId(g.id) || typeof g.name !== 'string' || !g.name) return false;
  if (!g.stats || typeof g.stats !== 'object') return false;
  for (const key of ['magic', 'insight', 'agility', 'empathy'] as StatKey[]) if (!Number.isFinite(g.stats[key])) return false;
  if (!['idle', 'mission', 'healing', 'resting', 'retired', 'expedition'].includes(g.status)) return false;
  if (!Number.isFinite(g.hp) || !Number.isFinite(g.maxHp) || !Number.isFinite(g.fatigue) || !Number.isFinite(g.bond)) return false;
  if (!Array.isArray(g.skills) || !g.skills.every(s => typeof s === 'string' && getSkill(s))) return false;
  return true;
}
function migrate(raw: Record<string, unknown>): GameState | null {
  if (raw.version !== 1) return null;
  try {
    const pack = createSeedPack();
    const base = createInitialState(pack);
    const oldGirls = Array.isArray(raw.girls) ? raw.girls as Girl[] : [];
    const girls = oldGirls.length ? oldGirls.map(g => {
      const seed = pack.girls.find(s => s.id === g.id);
      return hydrate({ ...(seed ?? base.girls[0]), ...g, skills: seed?.skills ?? defaultSkills(g.id), scars: [], relationships: seed?.relationships ?? {}, baseMaxHp: g.maxHp, spirit: seed?.spirit ?? 80, maxSpirit: seed?.maxSpirit ?? 80, exp: 0 });
    }) : base.girls;
    const missions = base.missions.map(m => {
      const old = (raw.missions as Mission[] | undefined)?.find(x => x.id === m.id);
      return old ? { ...m, status: old.status, girlId: old.girlId, squad: old.girlId ? [old.girlId] : [], attempts: old.status === 'done' ? 1 : 0 } : m;
    });
    return { ...base, day: Number(raw.day) || 14, minutes: Number(raw.minutes) || 0, gold: Number(raw.gold) || 0, reputation: Number(raw.reputation) || 50, girls, missions, logs: Array.isArray(raw.logs) ? raw.logs.slice(0, 300) : base.logs, completed: Array.isArray(raw.completed) ? raw.completed.filter(x => typeof x === 'string') : [], samples: Array.isArray(raw.samples) ? raw.samples.slice(-60) : base.samples, messages: {}, memorial: [], battles: [] };
  } catch { return null; }
}
const BATTLE_NOTE_EXPRESSIONS = new Set(['calm', 'smile', 'surprise', 'sad', 'angry', 'shy']);
export function validBattleNote(value: unknown): value is BattleNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<BattleNote>;
  if (typeof note.battleId !== 'string' || !note.battleId) return false;
  if (typeof note.title !== 'string' || typeof note.hook !== 'string' || typeof note.summary !== 'string') return false;
  if (note.source !== 'llm' && note.source !== 'template') return false;
  if (!Number.isFinite(note.charCount) || typeof note.createdAt !== 'string') return false;
  if (!Array.isArray(note.scenes) || note.scenes.length < 1 || note.scenes.length > 8) return false;
  let lineTotal = 0;
  for (const scene of note.scenes) {
    if (!scene || typeof scene !== 'object') return false;
    if (typeof scene.id !== 'string' || typeof scene.title !== 'string' || typeof scene.narration !== 'string') return false;
    if (!Number.isFinite(scene.roundFrom) || !Number.isFinite(scene.roundTo) || scene.roundTo < scene.roundFrom) return false;
    if (!Array.isArray(scene.lines) || scene.lines.length > 80) return false;
    lineTotal += scene.lines.length;
    for (const line of scene.lines) {
      if (!line || typeof line !== 'object') return false;
      if (!Number.isFinite(line.round) || !BATTLE_NOTE_EXPRESSIONS.has(line.expression)) return false;
      if (line.speakerSide !== 'ally' && line.speakerSide !== 'enemy') return false;
      if (typeof line.speakerId !== 'string' || !line.speakerId || typeof line.text !== 'string' || !line.text.trim()) return false;
      if (line.mode !== undefined && line.mode !== 'speech' && line.mode !== 'thought') return false;
    }
  }
  return lineTotal <= 240;
}

export function loadState(raw: string | null): GameState {
  if (!raw) return createInitialState();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return createInitialState(); }
  if (!parsed || typeof parsed !== 'object') return createInitialState();
  const value = parsed as Record<string, unknown>;
  if (value.version === 1) return migrate(value) ?? createInitialState();
  if (![3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(value.version as number)) return createInitialState();
  try {
    const blankSave = value.blank === true;
    if (!Array.isArray(value.girls) || (!value.girls.length && !blankSave) || !value.girls.every(validGirl)) return createInitialState();
    const ids = new Set<string>();
    for (const girl of value.girls) {
      if (ids.has(girl.id)) return createInitialState();
      ids.add(girl.id);
      if (girl.scars && !Array.isArray(girl.scars)) return createInitialState();
      if (girl.relationships && (typeof girl.relationships !== 'object' || Array.isArray(girl.relationships))) return createInitialState();
    }
    if (!Array.isArray(value.rooms) || value.rooms.length < 1 || value.rooms.length > 4) return createInitialState();
    if (!Array.isArray(value.missions)) return createInitialState();
    for (const mission of value.missions as Mission[]) {
      if (!mission || typeof mission.id !== 'string' || !['open', 'active', 'done', 'expired'].includes(mission.status)) return createInitialState();
      if (!Array.isArray(mission.squad)) return createInitialState();
      if (mission.status === 'active') {
        if (!mission.squad.length) return createInitialState();
        for (const id of mission.squad) {
          const girl = (value.girls as Girl[]).find(g => g.id === id);
          if (!girl || girl.status !== 'mission' || girl.missionId !== mission.id) return createInitialState();
        }
      }
    }
    if (!Array.isArray(value.logs) || value.logs.length > 300) return createInitialState();
    if (!Array.isArray(value.samples) || value.samples.length > 60) return createInitialState();
    const messages = value.messages && typeof value.messages === 'object' && !Array.isArray(value.messages) ? value.messages as Record<string, unknown> : {};
    for (const [key, list] of Object.entries(messages)) {
      if (!ids.has(key)) return createInitialState();
      if (!Object.hasOwn(messages, key) || !Array.isArray(list) || list.length > 60) return createInitialState();
      for (const m of list) if (!m || typeof m !== 'object' || !['girl', 'player', 'system'].includes((m as { role: string }).role) || typeof (m as { text: unknown }).text !== 'string') return createInitialState();
    }
    const state = clone(value) as unknown as GameState;
    const previousVersion = Number(value.version);
    state.version = 16;
    // 老存档不该被开场打断：只有本版之后新建的档才可能没看过。
    state.prologueSeen = previousVersion >= 15 ? value.prologueSeen !== false : true;
    // 阵容：老存档直接沿用静态名册，编成保持“已完成”，不再逼老玩家重选。
    state.factionRoster = sanitizeFactionRoster(state.factionRoster) ?? defaultFactionRoster();
    state.startersPicked = previousVersion >= 16 ? value.startersPicked === true : true;
    const rawHostility = (state.hostility ?? {}) as Partial<Record<FactionPair, HostilityTrack>>;
    state.hostility = HOSTILITY_PAIRS.reduce((map, pair) => {
      const saved = rawHostility[pair];
      map[pair] = makeTrack(pair, typeof saved?.value === 'number' ? clampHostility(saved.value) : 0, saved?.reason ?? '旧账还没算清');
      return map;
    }, {} as Record<FactionPair, HostilityTrack>);
    state.fronts = (Array.isArray(state.fronts) ? state.fronts : [])
      .filter(front => front && typeof front.id === 'string' && Boolean(districts[front.district]) && HOSTILITY_PAIRS.includes(front.pair))
      .slice(-8);
    state.warHistory = (Array.isArray(state.warHistory) ? state.warHistory : [])
      .filter(record => record && HOSTILITY_PAIRS.includes(record.pair) && Number.isFinite(record.day))
      .slice(-40);
    state.girls = state.girls.map(hydrate);
    state.candidates = Array.isArray(state.candidates) ? state.candidates.map(hydrate).slice(0, 6) : [];
    if (previousVersion < 8 && (state.minutes < SHIFT_START || state.minutes >= SHIFT_END)) {
      state.minutes = SHIFT_START;
      state.logs.unshift({ id: `log-shift-migrate-${Date.now()}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: '事务所改为 20:00–次日 02:00 营业，午夜之后仍算同一夜。今晚重新开门。' });
    }
    const shiftSpawn = shiftStartAt(state.day);
    state.missions.forEach(m => {
      m.attempts ??= 0; m.squad ??= m.girlId ? [m.girlId] : []; m.recommendedLevel ??= 3;
      m.district ??= districtAt(m.x, m.y);
      m.window ??= m.duration >= 90 ? 'long' : 'urgent';
      if (m.window === 'long') m.longDays = Math.max(2, Math.min(7, m.longDays ?? 2));
      m.wave ??= 0;
      m.spawnedAt ??= shiftSpawn;
      m.deadlineAt ??= deadlineFor(m.window, state.day, m.spawnedAt, m.longDays);
    });
    state.shift ??= { day: state.day, wave: previousVersion < 7 ? WAVE_AT.length : 0 };
    if (state.shift.day !== state.day) state.shift = { day: state.day, wave: 0 };
    state.territories = repairTerritories((state.territories ?? {}) as Partial<TerritoryMap>, `${state.packHash ?? createSeedPack().hash}:${previousVersion}`);
    // 污染在旧档里整段缺失：按九区初始值补齐，已有数值只做 0–100 收敛，不重置玩家清理过的辖区。
    state.pollution = repairPollution(state.pollution);
    state.office = sanitizeOfficeProfile(state.office ?? DEFAULT_OFFICE_PROFILE);
    state.territoryLog = Array.isArray(state.territoryLog) ? state.territoryLog.slice(0, 60) : [];
    state.incidents = Array.isArray(state.incidents) ? state.incidents.filter(item => item && typeof item.id === 'string' && Array.isArray(item.options)).slice(0, 8) : [];
    for (const incident of state.incidents) {
      if (incident.status === 'resolved' || incident.status === 'expired') continue;
      if (typeof incident.expiresAt !== 'number') incident.expiresAt = (state.day * 1440 + state.minutes) + (incident.ttlMinutes ?? 240);
    }
    state.storylines = Array.isArray(state.storylines) ? state.storylines.filter(item => item && typeof item.id === 'string' && Array.isArray(item.beats)).slice(0, 12) : [];
    state.events = Array.isArray(state.events) ? state.events.filter(item => item && typeof item.id === 'string' && Array.isArray(item.scenes)).slice(0, 12) : [];
    state.treatments = Array.isArray(state.treatments) ? state.treatments.filter(item => {
      if (!item || typeof item.id !== 'string' || typeof item.girlId !== 'string') return false;
      const girl = state.girls.find(g => g.id === item.girlId);
      return Boolean(girl) && Number.isFinite(item.endsAt) && item.endsAt > absoluteMinutes(state.day, state.minutes);
    }).slice(0, 6) : [];
    if (previousVersion < 10) {
      for (const girl of state.girls) {
        if (girl.status === 'healing' || girl.status === 'resting') { girl.status = 'idle'; girl.remaining = 0; }
      }
    }
    state.blank = value.blank === true;
    state.memorial ??= []; state.battles = Array.isArray(state.battles) ? state.battles.slice(0, 20) : [];
    const battleIds = new Set(state.battles.map(battle => battle.id));
    const seenNotes = new Set<string>();
    const notes: BattleNote[] = [];
    for (const note of Array.isArray(state.battleNotes) ? state.battleNotes : []) {
      if (!validBattleNote(note) || !battleIds.has(note.battleId) || seenNotes.has(note.battleId)) continue;
      seenNotes.add(note.battleId);
      notes.push(note);
    }
    state.battleNotes = notes.slice(0, 20);
    state.packHash ??= createSeedPack().hash;
    state.opinions = Array.isArray(state.opinions) ? state.opinions.filter(opinion => opinion && typeof opinion.id === 'string' && Array.isArray(opinion.options)).slice(0, 30) : [];
    for (const opinion of state.opinions) {
      opinion.options = resolveOpinionOptions(state, opinion);
      if (opinion.status === 'deferred' && typeof opinion.revisitDay !== 'number') opinion.revisitDay = state.day + 1;
    }
    state.expeditions = Array.isArray(state.expeditions) ? state.expeditions.slice(0, 1) : [];
    state.councilDay ??= state.day; state.pensionDebt ??= 0;
    state.incidentPool = Array.isArray(state.incidentPool) ? state.incidentPool.filter(item => item && typeof item.id === 'string' && Array.isArray(item.options)).slice(0, 10) : [];
    state.incidentSeq = Number.isFinite(Number(state.incidentSeq)) ? Number(state.incidentSeq) : 0;
    state.incidentCooldowns = state.incidentCooldowns && typeof state.incidentCooldowns === 'object' ? state.incidentCooldowns : {};
    // 极端旧档连 `factions` 都没有时按 50 补齐；有存档的声望一律原样保留，不重置进度。
    state.factions ??= { witch: { standing: 50, stockDay: state.day, envoyDay: state.day }, association: { standing: 50, stockDay: state.day, envoyDay: state.day }, government: { standing: 50, stockDay: state.day, envoyDay: state.day } };
    for (const faction of Object.keys(state.factions) as FactionId[]) {
      const f = state.factions[faction];
      f.standing = Math.max(0, Math.min(100, Number(f.standing) || 0));
      f.stockDay ??= state.day; f.envoyDay ??= state.day;
    }
    state.inventory = state.inventory && typeof state.inventory === 'object' ? state.inventory : {};
    state.generatedItems = Array.isArray(state.generatedItems) ? state.generatedItems.filter(validGeneratedItem).slice(0, 40) : [];
    for (const item of state.generatedItems) registerItem(item);
    const rawStock = Array.isArray(state.marketStock) ? state.marketStock : [];
    state.marketStock = rawStock.filter((entry): entry is MarketStockEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as MarketStockEntry;
      const item = getItem(candidate.itemId);
      return typeof candidate.id === 'string' && Boolean(item) && item!.faction === candidate.faction && typeof candidate.sold === 'boolean';
    }).slice(0, 24);
    for (const faction of Object.keys(state.factions) as FactionId[]) {
      if (!state.marketStock.some(entry => entry.faction === faction)) state.marketStock = state.marketStock.concat(makeFactionStock(faction, state.day));
    }
    state.marketStock = state.marketStock.filter((entry, index, list) => list.findIndex(other => other.id === entry.id) === index);
    state.marketLevel = Math.max(1, Math.min(4, Number(state.marketLevel) || 1));
    state.marketDay ??= state.day;
    state.boss ??= null; state.bossCycle ??= 0; state.nextBossDay ??= state.day + 2;
    state.customSkills ??= [];
    state.customMonsters ??= [];
    state.poolLimits ??= { missions: 12, monsters: 8, candidates: 6 };
    state.removedMonsters ??= [];
    state.chronicle = Array.isArray(state.chronicle)
      ? state.chronicle.filter((entry): entry is ChronicleEntry => Boolean(entry) && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.summary === 'string' && Number.isFinite(entry.day)).slice(0, 200)
      : [];
    return state;
  } catch { return createInitialState(); }
}

/** Strict import used by the save importer: malformed files must not silently reset progress. */
export function importState(raw: string): GameState | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as Record<string, unknown>;
  if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].includes(Number(value.version))) return null;
  if (!Array.isArray(value.girls) || (!value.girls.length && value.blank !== true)) return null;
  if (!value.girls.every(validGirl)) return null;
  if (!Number.isFinite(value.day) || !Number.isFinite(value.gold)) return null;
  return loadState(raw);
}
