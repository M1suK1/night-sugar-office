import { outfitLine } from './outfitBrief.ts';
import type { GameState, Girl } from './types.ts';
import { opinionHistoryText } from './opinionHistory.ts';
import type { DistrictId } from './districts.ts';
import { NODE_LABELS } from './storygraph.ts';
import { districts } from './districts.ts';
import { factionInfo, listItems } from './content/items.ts';
import { tierOf } from './items.ts';
import { factionDossiers, factionRepresentativeOf, representativeNameOf, representativeTitleOf } from './factions.ts';
import { representativeOf } from './office.ts';
import { HOSTILITY_PAIRS, hostilityTierLabel, hostilityValue, pairLabel } from './hostility.ts';
import { pollutionTierLabel } from './pollution.ts';
import { baseCommissionPool } from './rules/missions.ts';
import { traits } from './content/traits.ts';
import { battleHistoryText, chatHistoryText, dossierOf, missionHistoryText, storylineHistoryText } from './girlDossier.ts';
import { ENUM_TEXT, limitsText } from './promptSections.ts';
import { promptTokens } from './tokens.ts';

/** 宏解析上下文：本次请求的存档与「这一场写的是谁」。 */
export interface MacroContext {
  state?: GameState;
  focus?: Girl;
  /** 主角在名册里的位置（「月蚀庭首领」）；契约者没有这一项。 */
  focusRole?: string;
}

export interface MacroSpec {
  key: string;
  label: string;
  hint: string;
  budget: number;
}

export interface MacroGroup {
  id: string;
  label: string;
  hint: string;
  items: MacroSpec[];
}

const NOT_STARTED = '（未开局，这里先空着）';

function alive(state: GameState | undefined): Girl[] {
  return (state?.girls ?? []).filter(girl => !girl.retired && !girl.dead && !girl.left);
}

function argInt(arg: string | undefined, fallback: number, min = 1, max = 24): number {
  const value = Number(arg);
  return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
}

function territoryCounts(state: GameState): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const owner of Object.values(state.territories ?? {})) counts[owner] = (counts[owner] ?? 0) + 1;
  return counts;
}

function girlsText(state: GameState | undefined, arg?: string): string {
  if (!state) return NOT_STARTED;
  const list = alive(state);
  if (!list.length) return '（名册为空）';
  const limit = argInt(arg, 12, 1, 40);
  const lines = list.slice(0, limit).map(girl => [
    `- ${girl.name}（${girl.id}）· 代号「${girl.codename}」· ${girl.title} · ${girl.element}/${girl.archetype ?? '未定职阶'} · Lv.${girl.level}`,
    ` · 羁绊 ${girl.bond} · 疲劳 ${girl.fatigue} · 侵蚀 ${girl.corruption ?? 0} · 出身 ${girl.factionTag}`,
    girl.personality ? `\n  性格：${girl.personality.trim().slice(0, 80)}` : '',
    girl.appearance ? `\n  外貌：${girl.appearance.trim().slice(0, 80)}` : '',
    // v95：她现在穿着什么；魔女化之后这一行写的是形态描述。
    outfitLine(girl) ? `\n  ${outfitLine(girl).slice(0, 90)}` : '',
    girl.quote ? `\n  语气参考：「${girl.quote.trim().slice(0, 40)}」` : '',
  ].join(''));
  const rest = list.length - lines.length;
  return rest > 0 ? `${lines.join('\n')}\n（还有 ${rest} 位未列出）` : lines.join('\n');
}

function factionsText(state: GameState | undefined): string {
  if (!state) return '协会 / 市役所 / 月蚀庭（未开局，首领未知）';
  const counts = territoryCounts(state);
  return (['association', 'government', 'witch'] as const).map(faction => {
    const standing = state.factions[faction]?.standing ?? 0;
    return `- ${factionInfo[faction].name}（${faction}）· 态度 ${standing}（${standing >= 20 ? '友好' : standing <= -20 ? '敌对' : '中立'}）· 现任首领 ${representativeNameOf(state, faction)}（${representativeTitleOf(state, faction)}）· 辖区 ${counts[faction] ?? 0} · 信条「${factionDossiers[faction].doctrine}」`;
  }).join('\n');
}

function leadersText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  return (['association', 'government', 'witch'] as const).map(faction => {
    const rep = factionRepresentativeOf(state, faction);
    // 首领也是要出场的人：只给名字与头衔，模型写出来的首领就成了没有长相的空壳。
    const looks = [rep.appearance?.trim(), rep.personality?.trim()].filter(Boolean);
    const lookLine = looks.length ? `
  外貌与性格：${looks.join('；')}` : '';
    const quote = rep.quote?.trim() ? `
  语气参考：「${rep.quote.trim()}」` : '';
    return `- ${rep.name}（${rep.id}）· ${rep.title} · ${factionInfo[faction].name} · Lv.${rep.level}${lookLine}${quote}`;
  }).join('\n');
}

function districtsText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  return (Object.keys(districts) as DistrictId[]).map(id => {
    const pollution = state.pollution?.[id] ?? 0;
    const owner = state.territories?.[id];
    return `- ${districts[id].name}（${id}）· 污染 ${pollution}（${pollutionTierLabel(pollution)}）· 当主 ${owner ? factionInfo[owner].name : '无主'}`;
  }).join('\n');
}

function hostilityText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  return HOSTILITY_PAIRS.map(pair => {
    const value = hostilityValue(state, pair);
    return `- ${pairLabel(pair)}：${value}（${hostilityTierLabel(value)}）`;
  }).join('\n');
}

function officeText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  const rep = representativeOf(state);
  const lounge = state.rooms.find(room => room.type === 'lounge');
  const dorm = state.rooms.find(room => room.type === 'dorm');
  const name = state.office?.goal?.trim() || state.office?.philosophy?.trim() || '夜糖事务所';
  return `${name}（对外代表 ${rep ? `${rep.name}（${rep.codename}）` : '尚未任命'}）· 会客厅 Lv.${lounge?.level ?? 1} · 宿舍 ${dorm?.level ?? 1}`;
}

function councilText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  const pending = state.opinions.filter(opinion => opinion.status === 'pending').slice(0, 8);
  if (!pending.length) return '（今天没有待议议题）';
  return pending.map(opinion => `- ${opinion.title} · 提出者 ${opinion.authorId} · ${opinion.topic}`).join('\n');
}

function councilNeed(state: GameState | undefined, key: 'need' | 'cap' | 'pending'): string {
  if (!state) return '1';
  const lounge = state.rooms.find(room => room.type === 'lounge');
  const cap = Math.max(3, Math.min(5, 1 + (lounge?.level ?? 2)));
  const pending = state.opinions.filter(opinion => opinion.status === 'pending').length;
  if (key === 'cap') return String(cap);
  if (key === 'pending') return String(pending);
  return String(Math.max(1, cap - pending));
}

function incidentsText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  const pending = state.incidents.filter(incident => incident.status === 'pending').slice(0, 6);
  if (!pending.length) return '（没有待处理的弹窗）';
  return pending.map(incident => `- ${incident.title} · ${incident.kind}`).join('\n');
}

function storylinesText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  const active = state.storylines.filter(story => story.status === 'active');
  if (!active.length) return '（没有进行中的故事线）';
  return active.map(story => {
    const beat = story.beats.find(item => item.status !== 'done');
    const name = state.girls.find(girl => girl.id === story.girlId)?.name ?? story.girlId;
    return `- ${name} · 第 ${story.slot ?? 1} 段「${story.title}」· ${beat ? `停在「${beat.title}」` : '待推进'}`;
  }).join('\n');
}

function itemsText(state: GameState | undefined, arg?: string): string {
  const pool = [...listItems(), ...(state?.generatedItems ?? [])].filter(item => item.slot !== 'consumable');
  const wanted = Number(arg);
  const tiers = Number.isFinite(wanted) ? [Math.max(1, Math.min(5, Math.round(wanted)))] : [1, 2, 3, 4, 5];
  const rows = tiers.map(tier => {
    const bag = pool.filter(item => tierOf(item) === tier);
    return bag.length ? `- ${tier} 阶：${bag.length} 件（例：${bag.slice(0, 3).map(item => item.name).join(' / ')}）` : '';
  }).filter(Boolean);
  return rows.length ? rows.join('\n') : '（这个阶级暂时没有器物）';
}

function missionsText(_state: GameState | undefined, arg?: string): string {
  const work = arg === 'combat' || arg === 'investigation' ? arg : undefined;
  const pool = baseCommissionPool.filter(mission => !mission.boss && (!work || mission.work === work)).slice(0, 24);
  if (!pool.length) return '（委托模板为空）';
  return pool.map(mission => `- ${mission.id} · ${mission.title} · ${mission.difficulty} · ${mission.work === 'combat' ? '战斗' : '调查'} · ${mission.duration} 分钟${mission.district ? ` · ${districts[mission.district as DistrictId]?.name ?? mission.district}` : ''}`).join('\n');
}

function traitsText(): string {
  return traits.slice(0, 40).map(trait => trait.name).join('、');
}

function nightText(state: GameState | undefined): string {
  if (!state) return NOT_STARTED;
  const pollution = Object.values(state.pollution ?? {});
  const average = pollution.length ? Math.round(pollution.reduce((sum, value) => sum + value, 0) / pollution.length) : 0;
  const clock = `${String(Math.floor(state.minutes / 60)).padStart(2, '0')}:${String(state.minutes % 60).padStart(2, '0')}`;
  return [
    `第 ${state.day} 日 ${clock}`,
    `星砂 ${state.gold}`,
    `安定度 ${state.reputation}`,
    `城市平均污染 ${average}`,
    `待议 ${state.opinions.filter(opinion => opinion.status === 'pending').length}`,
    `待处理弹窗 ${state.incidents.filter(incident => incident.status === 'pending').length}`,
    `在册 ${alive(state).length} 人`,
  ].join(' · ');
}

function heroineText(ctx: MacroContext, arg?: string): string {
  if (!ctx.focus) return '（本任务没有指定主角）';
  const role = ctx.focusRole;
  if (arg === 'brief') return dossierOf(ctx.focus, ctx.state, { brief: true, role });
  return dossierOf(ctx.focus, ctx.state, { role });
}

type Resolver = (ctx: MacroContext, arg?: string) => string;

const RESOLVERS: Record<string, Resolver> = {
  night: ctx => nightText(ctx.state),
  girls: (ctx, arg) => girlsText(ctx.state, arg),
  heroine: (ctx, arg) => heroineText(ctx, arg),
  opinions: (ctx, arg) => ctx.state ? opinionHistoryText(ctx.state, Number(arg) || undefined) : '',
  factions: ctx => factionsText(ctx.state),
  leaders: ctx => leadersText(ctx.state),
  districts: ctx => districtsText(ctx.state),
  hostility: ctx => hostilityText(ctx.state),
  office: ctx => officeText(ctx.state),
  council: ctx => councilText(ctx.state),
  'council.need': ctx => councilNeed(ctx.state, 'need'),
  'council.cap': ctx => councilNeed(ctx.state, 'cap'),
  'council.pending': ctx => councilNeed(ctx.state, 'pending'),
  incidents: ctx => incidentsText(ctx.state),
  storylines: ctx => storylinesText(ctx.state),
  items: (ctx, arg) => itemsText(ctx.state, arg),
  missions: (ctx, arg) => missionsText(ctx.state, arg),
  traits: () => traitsText(),
  kinds: () => Object.keys(NODE_LABELS).join('、'),
  limits: () => limitsText(),
  works: () => ENUM_TEXT.works,
  difficulties: () => ENUM_TEXT.difficulties,
  topics: () => ENUM_TEXT.topics,
  expressions: () => ENUM_TEXT.expressions,
  factionIds: () => ENUM_TEXT.factionIds,
  slots: () => ENUM_TEXT.slots,
  tiers: () => ENUM_TEXT.tiers,
  'history.missions': (ctx, arg) => (ctx.focus ? missionHistoryText(ctx.state, ctx.focus, argInt(arg, 6)) : '（本任务没有指定主角）'),
  'history.storylines': (ctx, arg) => (ctx.focus ? storylineHistoryText(ctx.state, ctx.focus, argInt(arg, 3)) : '（本任务没有指定主角）'),
  'history.chat': (ctx, arg) => (ctx.focus ? chatHistoryText(ctx.state, ctx.focus, argInt(arg, 20, 1, 60)) : '（本任务没有指定主角）'),
  'history.battles': (ctx, arg) => (ctx.focus ? battleHistoryText(ctx.state, ctx.focus, argInt(arg, 4)) : '（本任务没有指定主角）'),
};

export const MACRO_GROUPS: MacroGroup[] = [
  {
    id: 'heroine', label: '她是谁', hint: '本场主角的全量档案；换任务换人，宏本身不变',
    items: [
      { key: 'heroine', label: '全量档案', hint: '身份/外形/性情/能力/此刻/关系/心愿/契约/随身', budget: 800 },
      { key: 'heroine:brief', label: '压缩档案', hint: '只要身份、性情、关系与心愿', budget: 150 },
    ],
  },
  {
    id: 'history', label: '她的过往', hint: '按需取用，带参数控制条数与预算',
    items: [
      { key: 'history.missions:6', label: '任务经历', hint: '最近 6 次结算过的委托', budget: 300 },
      { key: 'history.storylines', label: '故事线经历', hint: '三段故事走到哪、选了什么、结局', budget: 320 },
      { key: 'history.chat:20', label: '聊天记录', hint: '最近 20 条她与所长说过的话', budget: 420 },
      { key: 'history.battles:4', label: '战斗经历', hint: '最近 4 场战报的胜负与伤害', budget: 260 },
    ],
  },
  {
    id: 'city', label: '事务所与城市', hint: '随存档实时计算',
    items: [
      { key: 'night', label: '今夜概览', hint: '日期、时间、星砂、安定度、污染', budget: 60 },
      { key: 'girls', label: '在册名册', hint: '可点名的人（id + 关系 + 状态）', budget: 900 },
      { key: 'factions', label: '三方势力', hint: '态度、现任首领、辖区、立场', budget: 300 },
      { key: 'leaders', label: '三方首领 id', hint: 'authorId 白名单', budget: 120 },
      { key: 'districts', label: '九辖区', hint: '污染、档位与当主', budget: 600 },
      { key: 'hostility', label: '势力敌意', hint: '三对势力的敌意值与档位', budget: 80 },
      { key: 'office', label: '事务所', hint: '名称、对外代表、会客厅与宿舍等级', budget: 80 },
      { key: 'council', label: '待议议题', hint: '标题、提出者与主题', budget: 200 },
      { key: 'opinions', label: '最近提过的议题', hint: '含已决议的；写提案时要求换角度，默认 12 条', budget: 260 },
      { key: 'council.need', label: '本次需要几条议题', hint: '按会客厅上限算出来的缺口', budget: 8 },
      { key: 'incidents', label: '待处理弹窗', hint: '标题与类型', budget: 160 },
      { key: 'storylines', label: '进行中的故事线', hint: '谁、第几段、停在哪一幕', budget: 160 },
    ],
  },
  {
    id: 'catalog', label: '目录', hint: '给提案与蓝图用的机制目录',
    items: [
      { key: 'missions', label: '委托模板', hint: '全部模板；加 :combat / :investigation 过滤', budget: 500 },
      { key: 'missions:combat', label: '只看战斗模板', hint: '战斗委托会沿用模板的魔物组合', budget: 300 },
      { key: 'items', label: '器物阶级', hint: '每阶件数与示例', budget: 200 },
      { key: 'items:3', label: '只看三阶器物', hint: '写 loot 时给个参照', budget: 60 },
      { key: 'traits', label: '特性词表', hint: '可用的特性名', budget: 120 },
    ],
  },
  {
    id: 'enum', label: '枚举与阈值', hint: '直接读代码常量，改代码就自动跟着变',
    items: [
      { key: 'kinds', label: '节点种类', hint: '九种 StoryNodeKind', budget: 20 },
      { key: 'limits', label: '蓝图阈值', hint: '节点数与各类节点上限', budget: 40 },
      { key: 'works', label: '委托工作类型', hint: 'combat / investigation', budget: 10 },
      { key: 'difficulties', label: '难度档位', hint: '低危 / 中危 / 高危 / 绝望', budget: 10 },
      { key: 'topics', label: '议题主题', hint: '六个 topic', budget: 12 },
      { key: 'expressions', label: '表情', hint: '六种 expression', budget: 12 },
      { key: 'factionIds', label: '势力 id', hint: '三方 id', budget: 10 },
      { key: 'slots', label: '槽位', hint: 'weapon / charm / consumable', budget: 10 },
      { key: 'tiers', label: '阶级', hint: '1–5', budget: 8 },
      { key: 'backdrops', label: '可用背景', hint: '九块辖区 + 四个房间的背景 id 与中文名', budget: 120 },
    ],
  },
];

/** 展开 `{{key}}` 与 `{{key:arg}}`；未注册的键原样留着，交给后面的变量替换。 */
export function resolveMacros(text: string, ctx: MacroContext = {}): { text: string; used: string[]; missing: string[]; tokens: number } {
  const used: string[] = [];
  const missing: string[] = [];
  const output = text.replace(/\{\{([a-zA-Z_][\w.]*)(?::([^{}]*))?\}\}/g, (match, key: string, arg?: string) => {
    const resolver = RESOLVERS[key];
    if (!resolver) return match;
    const value = resolver(ctx, arg);
    if (value === undefined || value === null) {
      missing.push(key);
      return '';
    }
    used.push(arg ? `${key}:${arg}` : key);
    return value;
  });
  return { text: output, used, missing, tokens: promptTokens(output) };
}

/** 编辑器里估算一条宏在当前存档下的开销。 */
export function macroPreview(key: string, ctx: MacroContext = {}): string {
  const [name, ...rest] = key.split(':');
  const resolver = RESOLVERS[name ?? ''];
  if (!resolver) return '';
  const value = resolver(ctx, rest.join(':') || undefined);
  return value.length > 400 ? `${value.slice(0, 400)}…` : value;
}
