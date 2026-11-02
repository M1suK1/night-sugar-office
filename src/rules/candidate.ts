import { STAT_JITTER, STAT_MIN, mulberry32 } from '../content/archetypes.ts';
import { factionGirls } from '../content/factionGirls.ts';
import { getSkill } from '../content/skills.ts';
import { CONTRACT_DAYS } from '../contracts.ts';
import { effectiveGuard, effectiveMaxHp } from '../economy.ts';
import { sanitizeExpressionVariants } from '../expressions.ts';
import { factionTagFor, leaderById, sanitizeGirlFaction } from '../factions.ts';
import { defaultWitchPersonality } from '../personality.ts';
import { hashText } from '../rules/core.ts';
import { sanitizeStoryPlan } from '../storyplan.ts';
import { FACTION_ORDER } from '../territories.ts';
import type { FactionGirl, FactionId, FactionLeader, FactionRoster, GameState, Girl, GirlFaction, Outfit, StatKey } from '../types.ts';
import { clone } from './core.ts';
import { WARDROBE_LIMIT } from './labels.ts';
import { sanitizeOutfit } from './outfits.ts';
// v35 从 src/game.ts 拆出：候选者工厂与输入净化。

/**
 * 读档与建档的统一入口。
 *
 * 入参允许缺 `factionTag`（旧存档、外部导入的契约卡、种子包），所以这里收成
 * `GirlInput`；返回值一定是完整的 `Girl`，其余模块不必再判空。
 */
export type GirlInput = Omit<Girl, 'factionTag'> & { factionTag?: GirlFaction | string };
/** 雇佣覆灭势力的首领：一次性星砂。 */

/** 雇佣覆灭势力的首领：一次性星砂。 */
export const LEADER_HIRE_COST = 12000;

/** 自定义少女的数字字段兜底，避免卡片里的脏数据流进战斗。 */

/** 自定义少女的数字字段兜底，避免卡片里的脏数据流进战斗。 */
export function clampStat(value: unknown, fallback = 50): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(1, Math.min(200, n));
}

export function sanitizeSubjectStats(raw: unknown): Record<StatKey, number> {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const stats = {} as Record<StatKey, number>;
  for (const key of ['magic', 'insight', 'agility', 'empathy'] as StatKey[]) stats[key] = clampStat(src[key]);
  return stats;
}
/** 把 UI 交上来的自定义首领快照清洗成可信数据；阵营与 id 必须与名册一致。 */

/** 把 UI 交上来的自定义首领快照清洗成可信数据；阵营与 id 必须与名册一致。 */
export function sanitizeCustomLeader(input: unknown, faction: FactionId, id: string): FactionLeader | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as Partial<FactionLeader>;
  const name = typeof src.name === 'string' ? src.name.trim().slice(0, 40) : '';
  if (!name) return null;
  return {
    id, faction, name,
    title: typeof src.title === 'string' && src.title.trim() ? src.title.trim().slice(0, 30) : '外来者',
    portrait: typeof src.portrait === 'string' ? src.portrait : '',
    portraitSpec: src.portraitSpec,
    color: typeof src.color === 'string' && src.color ? src.color : '#f3aec9',
    quote: typeof src.quote === 'string' && src.quote.trim() ? src.quote.trim().slice(0, 80) : '她只对自己的名字负责。',
    note: '由事务所编入名册的少女。',
    level: Math.max(1, Math.min(20, Math.round(typeof src.level === 'number' ? src.level : 1))),
    stats: sanitizeSubjectStats(src.stats),
    skillIds: Array.isArray(src.skillIds) ? src.skillIds.filter((sid): sid is string => typeof sid === 'string').slice(0, 6) : [],
    archetype: src.archetype ?? '输出',
    origin: faction,
    titles: { association: '', government: '', witch: '', ...(src.titles ?? {}) },
    duty: src.duty ?? { faction, note: '被事务所编进名册的少女，出勤时替这一方办事。' },
    cardId: typeof src.cardId === 'string' && src.cardId.trim() ? src.cardId.trim().slice(0, 64) : undefined,
  };
}
/** 同上，随从版本。 */

/** 同上，随从版本。 */
export function sanitizeCustomGirl(input: unknown, faction: FactionId, id: string): FactionGirl | null {
  if (!input || typeof input !== 'object') return null;
  const src = input as Partial<FactionGirl>;
  const name = typeof src.name === 'string' ? src.name.trim().slice(0, 40) : '';
  if (!name) return null;
  return {
    id, faction, name,
    codename: typeof src.codename === 'string' && src.codename.trim() ? src.codename.trim().slice(0, 20) : name,
    title: typeof src.title === 'string' && src.title.trim() ? src.title.trim().slice(0, 30) : '外来者',
    portrait: typeof src.portrait === 'string' ? src.portrait : '',
    portraitSpec: src.portraitSpec,
    color: typeof src.color === 'string' && src.color ? src.color : '#f3aec9',
    level: Math.max(1, Math.min(20, Math.round(typeof src.level === 'number' ? src.level : 1))),
    stats: sanitizeSubjectStats(src.stats),
    skills: Array.isArray(src.skills) ? src.skills.filter((sid): sid is string => typeof sid === 'string').slice(0, 6) : [],
    tag: faction,
    quote: typeof src.quote === 'string' && src.quote.trim() ? src.quote.trim().slice(0, 80) : '她只对自己的名字负责。',
    note: '由事务所编入名册的少女。',
    cardId: typeof src.cardId === 'string' && src.cardId.trim() ? src.cardId.trim().slice(0, 64) : undefined,
  };
}

/**
 * 校验并规整三方阵容；不合法时返回 null（调用方拒绝动作）。
 *
 * 首领与随从都可以是原属成员，也可以是玩家自己带来的自定义少女：静态名册与
 * `customLeaders` / `customGirls` 快照合起来算作可选池。
 */

/**
 * 校验并规整三方阵容；不合法时返回 null（调用方拒绝动作）。
 *
 * 首领与随从都可以是原属成员，也可以是玩家自己带来的自定义少女：静态名册与
 * `customLeaders` / `customGirls` 快照合起来算作可选池。
 */
export function sanitizeFactionRoster(
  input: unknown,
  customLeaders: FactionLeader[] = [],
  customGirls: FactionGirl[] = [],
): { roster: Record<FactionId, FactionRoster>; leaders: FactionLeader[]; girls: FactionGirl[] } | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<Record<FactionId, { leaderId?: unknown; memberIds?: unknown }>>;
  const leaderSource = new Map(customLeaders.map(leader => [leader.id, leader]));
  const girlSource = new Map(customGirls.map(girl => [girl.id, girl]));
  const leaders = new Set<string>();
  const members = new Set<string>();
  const roster = {} as Record<FactionId, FactionRoster>;
  const usedLeaders: FactionLeader[] = [];
  const usedGirls: FactionGirl[] = [];
  for (const faction of FACTION_ORDER) {
    const entry = raw[faction];
    const leaderId = typeof entry?.leaderId === 'string' ? entry.leaderId : '';
    const customLeader = leaderSource.get(leaderId);
    if (!leaderById(leaderId) && !customLeader) return null;
    if (leaders.has(leaderId) || members.has(leaderId)) return null;
    leaders.add(leaderId);
    if (customLeader) usedLeaders.push({ ...customLeader, faction });
    const ids = Array.isArray(entry?.memberIds) ? entry!.memberIds.filter((id): id is string => typeof id === 'string') : [];
    const unique = [...new Set(ids)];
    if (unique.length < 1 || unique.length > 4) return null;
    for (const id of unique) {
      const customGirl = girlSource.get(id);
      if (!factionGirls.some(girl => girl.id === id) && !customGirl) return null;
      if (members.has(id) || leaders.has(id)) return null;
      members.add(id);
      if (customGirl) usedGirls.push({ ...customGirl, faction });
    }
    roster[faction] = { leaderId, memberIds: unique };
  }
  return { roster, leaders: usedLeaders, girls: usedGirls };
}

/**
 * 补齐少女的默认字段。
 *
 * `clone: false` 给「输入本来就是刚拼好的新字面量」的调用方用（例如契约卡导入）：
 * 这时再深拷贝一次等于把 2–3MB 的立绘字符串多复制一份，20 张卡就是几十 MB 的瞬时开销。
 */
export function hydrate(girl: GirlInput, options: { clone?: boolean } = {}): Girl {
  const g = (options.clone === false ? { ...girl } : clone(girl)) as Girl;
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
  // 心防不再是独立字段：它等于面板共情 × 2，读档时按当前属性重算。
  g.maxSpirit = effectiveGuard(g);
  g.spirit = g.spirit > 0 ? Math.min(g.spirit, g.maxSpirit) : g.maxSpirit;
  g.skill = getSkill(g.skills[g.skills.length - 1] ?? 'glimmer-spear').name;
  return g;
}

export function sampleDays(): GameState['samples'] {
  return Array.from({ length: 14 }, (_, index) => {
    const day = index + 1;
    const wave = Math.sin(index * 0.9) * 180 + Math.cos(index * 0.37) * 120;
    return { day, income: Math.round(640 + index * 28 + wave), expense: Math.round(300 + index * 12 - wave * 0.25), reputation: Math.max(48, Math.min(82, Math.round(62 + index * 1.1 + Math.sin(index) * 4))) };
  });
}

export const candidateNames = ['南枝', '莉莉安', '灰原灯', '白栖', '苏糖', '森野眠', '折原凛', '秋山杏', '柚木澪', '花笼', '小鸟游雪', '雨森', '桐谷真昼', '叶月', '猫田铃', '白石萤'];

export const candidateColors = ['#F49ABD', '#C7A7E8', '#9CC9D2', '#B9D8A8', '#D98A94', '#E8C7A7'];

export const elements = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系'] as const;

export const archetypes = ['输出', '守护', '控制', '治愈', '侦查'] as const;

export function makeCandidate(state: GameState, level: number, salt = 0, tag?: GirlFaction): Girl {
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
    level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 0, maxSpirit: 0,
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
 * 换日清理：只把过期的原生候选清掉。
 *
 * v27 起市场不再自己造人——候选者的唯一来源是契约卡库（`refillMarket`），
 * 没有卡就空着，由界面提示玩家去加卡。这里保留过期逻辑，是为了让老档里
 * 还挂着的原生候选照常到期，不留下永远占位的旧面孔。
 */

export function genderOf(girl: Girl): string {
  return girl.appearance?.includes('他') && !girl.appearance?.includes('她') ? '他' : '她';
}

export function defaultSkills(id: string): string[] {
  const map: Record<string, string[]> = {
    yue: ['glimmer-spear', 'peach-ward', 'starlight-fall'], tang: ['sugar-needle', 'goodnight-candy', 'white-night-frost'],
    ling: ['frequency-prick', 'silent-band', 'moon-phase'], wu: ['dream-touch', 'sheep-nebula', 'deep-dream-fall'],
    zhi: ['flower-thorn', 'flower-prescription', 'spring-growth'], lu: ['drumbeat', 'finale-firework', 'crimson-encore'],
  };
  return map[id] ?? ['glimmer-spear'];
}

export function defaultWardrobe(g: Girl): Outfit[] {
  return [
    { id: 'uniform', name: '值夜制服', description: '事务所统一配发的夜间制服，便于行动。', palette: [g.color, '#17141c', '#f7e9f1'], layerKey: 'uniform' },
    { id: 'casual', name: '私服', description: '下班后才会穿的衣服，袖口仍留着一点夜里的冷气。', palette: [g.color, '#241d2b', '#d9c9e2'], layerKey: 'casual' },
    { id: 'formal', name: '礼装', description: '在需要被城市记住的场合穿的那一套。', palette: [g.color, '#0e0c14', '#ffe4ef'], layerKey: 'formal' },
  ];
}
