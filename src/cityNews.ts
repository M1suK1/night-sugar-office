import type { CityNews, CityNewsItem, CityNewsSpeaker, FactionId, GameState } from './types.ts';
import { districtOrder, districts, type DistrictId } from './districts.ts';
import { factionInfo } from './content/items.ts';
import { FACTION_ORDER } from './territories.ts';
import { HOSTILITY_PAIRS, hostilityTierLabel, hostilityValue, pairLabel, pairMembers } from './hostility.ts';
import { pollutionTierLabel } from './pollution.ts';
import { factionRepresentativeOf, rosterMembers } from './factions.ts';
import { hashText } from './rules/core.ts';
import { activePersonality } from './personality.ts';
import { outfitLine } from './outfitBrief.ts';
import { voiceLine } from './voice.ts';

export const CITY_NEWS_MAX = 3;
export const CITY_NEWS_MIN = 1;
/** 玩家接手的第一夜：不请叙事者，只播这一条。 */
export const OPENING_NEWS_DAY = 14;
/** 访谈最多几句：够一轮来回，又不会把面板撑爆。 */
export const CITY_NEWS_LINE_MAX = 10;

const TONES: CityNewsItem['tone'][] = ['faction', 'pollution', 'stability', 'street'];

function clip(text: string, limit: number): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function speakerOf(raw: unknown): CityNewsSpeaker | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!id || !name) return undefined;
  const faction = FACTION_ORDER.includes(value.faction as FactionId) ? value.faction as FactionId : undefined;
  return { id, name, title: typeof value.title === 'string' ? clip(value.title, 16) : '', ...(faction ? { faction } : {}) };
}

/** 读档 / 采纳模型结果时统一洗一遍：条数、长度、枚举、日期缺一不可。 */
export function sanitizeCityNews(raw: unknown, day: number): CityNews | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(value.items) ? value.items : [];
  const items: CityNewsItem[] = itemsRaw.slice(0, CITY_NEWS_MAX).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    const text = typeof entry.text === 'string' ? clip(entry.text, 90) : '';
    if (!text) return [];
    const tone = TONES.includes(entry.tone as CityNewsItem['tone']) ? entry.tone as CityNewsItem['tone'] : 'street';
    return [{ text, tone }];
  });
  const headline = typeof value.headline === 'string' ? clip(value.headline, 40) : '';

  // 访谈部分：主持人必须存在，嘉宾随意；谁说的话必须能在名单里找到人。
  const host = speakerOf(value.host);
  const guests = Array.isArray(value.guests)
    ? value.guests.flatMap(entry => {
      const speaker = speakerOf(entry);
      return speaker ? [speaker] : [];
    }).slice(0, 2)
    : [];
  const roster = [host, ...guests].filter((entry): entry is CityNewsSpeaker => Boolean(entry));
  const lines = Array.isArray(value.lines) && host
    ? value.lines.slice(0, CITY_NEWS_LINE_MAX).flatMap(entry => {
      if (!entry || typeof entry !== 'object') return [];
      const line = entry as Record<string, unknown>;
      const speakerId = typeof line.speakerId === 'string' ? line.speakerId.trim() : '';
      const text = typeof line.text === 'string' ? clip(line.text, 90) : '';
      if (!speakerId || !text) return [];
      const person = roster.find(item => item.id === speakerId);
      if (!person) return [];
      return [{ speakerId, speakerName: person.name, text }];
    })
    : [];

  // 只有标题、既没有条目也没有对话：当作没生成，让调用方回落到本地快讯。
  if (!items.length && !lines.length) return undefined;
  return {
    day: Number.isFinite(value.day) ? Math.max(0, Math.round(Number(value.day))) : day,
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : new Date().toISOString(),
    headline: headline || items[0]?.text.slice(0, 40) || lines[0]!.text.slice(0, 40),
    items,
    source: value.source === 'llm' ? 'llm' : 'rule',
    ...(host ? { host } : {}),
    ...(guests.length ? { guests } : {}),
    ...(lines.length ? { lines } : {}),
  };
}

/** 现场都有谁可以上台：契约者、候选，以及三方名册里的首领与随从。 */
export function newsCastPool(state: GameState): CityNewsSpeaker[] {
  const pool: CityNewsSpeaker[] = [];
  for (const girl of state.girls ?? []) {
    if (girl.dead || girl.retired || girl.left) continue;
    pool.push({ id: girl.id, name: girl.name, title: girl.leader ? '一方出身的契约者' : girl.title || '契约者' });
  }
  for (const girl of state.candidates ?? []) {
    if (girl.dead) continue;
    pool.push({ id: girl.id, name: girl.name, title: '候选契约者' });
  }
  for (const faction of FACTION_ORDER) {
    const representative = factionRepresentativeOf(state, faction);
    if (representative && !representative.vacant) {
      pool.push({ id: representative.id, name: representative.name, title: `${factionInfo[faction].name}首领`, faction });
    }
    for (const member of rosterMembers(state, faction)) {
      pool.push({ id: member.id, name: member.name, title: `${factionInfo[faction].name}随从`, faction });
    }
  }
  return pool;
}

/** 主持人：玩家指定的优先，其次按日号在在场人物里定一位（同一天固定，读档不换人）。 */
/**
 * 台上这个人的一句简介（v177）。
 *
 * 新闻提示词以前只有「id · 名字 · 头衔」，模型只能自己编性格——写出来三个人
 * 一个腔调，全是保镖式的汇报。这里按她的档案补上性情、说话方式与外形。
 */
export function newsSpeakerBrief(state: GameState, speaker: CityNewsSpeaker): string {
  const girl = [...(state.girls ?? []), ...(state.candidates ?? [])].find(item => item.id === speaker.id);
  if (girl) {
    const parts = [`性格：${activePersonality(girl).trim().slice(0, 160)}`];
    const voice = voiceLine(girl);
    if (voice) parts.push(voice);
    const look = (girl.appearance ?? '').trim();
    if (look) parts.push(`外形：${look.slice(0, 80)}`);
    const outfit = outfitLine(girl);
    if (outfit) parts.push(outfit);
    parts.push(`对所长 ${girl.bond}/100、侵蚀 ${girl.corruption}/100`);
    return parts.join('；');
  }
  if (!speaker.faction) return '';
  const representative = factionRepresentativeOf(state, speaker.faction);
  const member = representative.id === speaker.id && !representative.vacant
    ? representative
    : rosterMembers(state, speaker.faction).find(item => item.id === speaker.id);
  const personality = (member as { personality?: string } | undefined)?.personality?.trim() ?? '';
  const appearance = (member as { appearance?: string } | undefined)?.appearance?.trim() ?? '';
  const parts: string[] = [];
  if (personality) parts.push(`性格：${personality.slice(0, 160)}`);
  if (appearance) parts.push(`外形：${appearance.slice(0, 80)}`);
  return parts.join('；');
}

export function pickNewsHost(state: GameState): CityNewsSpeaker | undefined {
  const pool = newsCastPool(state);
  if (!pool.length) return undefined;
  const chosen = state.newsHostId ? pool.find(person => person.id === state.newsHostId) : undefined;
  if (chosen) return chosen;
  const seed = hashText(`news-host:${state.day}`);
  return pool[seed % pool.length]!;
}

/** 嘉宾：火气最高那一对的另一方 + 污染最重辖区相关的代表；凑不齐就退回现场其他人。 */
/** 今晚这一档的版本号：手动刷新一次就往后挪一格。 */
export function newsRollOf(state: GameState): number {
  return state.newsRoll ?? 0;
}

/** 事务所里最近真的做过事的人（按最近一次委托排），roll 用来轮换着上节目。 */
function activeGirls(state: GameState, roll: number, hostId?: string): CityNewsSpeaker[] {
  const girls = (state.girls ?? []).filter(girl => !girl.dead && !girl.retired && !girl.left && girl.id !== hostId);
  if (!girls.length) return [];
  const rank = new Map<string, number>();
  [...(state.missionRuns ?? [])]
    .sort((left, right) => (right.day ?? 0) - (left.day ?? 0))
    .forEach((run, index) => {
      for (const id of run.girlIds) if (!rank.has(id)) rank.set(id, index);
    });
  const ordered = [...girls].sort((left, right) => (rank.get(left.id) ?? 999) - (rank.get(right.id) ?? 999));
  const shift = roll % ordered.length;
  return [...ordered.slice(shift), ...ordered.slice(0, shift)]
    .map(girl => ({ id: girl.id, name: girl.name, title: girl.title || '事务所的契约者' }));
}

/**
 * 嘉宾（v179）：事务所的人先占一个席位，剩下的给今晚最有话说的势力。
 *
 * roll 每刷新一次加一，同一个主持人也会换一批嘉宾、换一块辖区——以前每次刷新
 * 抽到的人都一样，看起来像重播。
 */
export function pickNewsGuests(state: GameState, hostId?: string, roll = newsRollOf(state)): CityNewsSpeaker[] {
  const pool = newsCastPool(state).filter(person => person.id !== hostId);
  if (!pool.length) return [];
  const picked: CityNewsSpeaker[] = [];
  const take = (person: CityNewsSpeaker | undefined) => {
    if (!person || person.id === hostId) return;
    if (picked.length >= 2) return;
    if (picked.some(entry => entry.id === person.id)) return;
    picked.push(person);
  };

  // ① 事务所的人：她们才聊得出「自己做过的事」。
  take(activeGirls(state, roll, hostId)[0]);

  // ② 火气最高那一对里，跟所长更疏远的一方。
  const hottest = [...HOSTILITY_PAIRS]
    .map(pair => ({ pair, value: hostilityValue(state, pair) }))
    .sort((left, right) => right.value - left.value)[0];
  if (hottest) {
    const [a, b] = pairMembers(hottest.pair);
    const rival = (state.factions[a]?.standing ?? 0) <= (state.factions[b]?.standing ?? 0) ? a : b;
    const rivals = pool.filter(person => person.faction === rival);
    take(rivals.length ? rivals[roll % rivals.length] : undefined);
  }
  // ③ 辖区当主；辖区本身也跟着 roll 换。
  const district = rolledDistrict(state, roll);
  if (district) {
    const owners = pool.filter(person => person.faction === state.territories?.[district]);
    take(owners.length ? owners[roll % owners.length] : undefined);
  }
  for (const person of pool) take(person);
  return picked;
}

/** 今晚聊哪块辖区：污染最重的前四块里按 roll 轮换。 */
function rolledDistrict(state: GameState, roll: number): DistrictId | undefined {
  const ranked = [...districtOrder]
    .map(id => ({ id, pollution: state.pollution?.[id] ?? 0 }))
    .sort((left, right) => right.pollution - left.pollution)
    .slice(0, 4)
    .map(item => item.id as DistrictId);
  if (!ranked.length) return undefined;
  return ranked[roll % ranked.length];
}

/** 一句话概括今晚的局面，本地兜底与提示词共用。 */
export function newsTalkingPoints(state: GameState, roll = newsRollOf(state)): { faction: string; pollution: string; stability: string; street: string } {
  const hottest = [...HOSTILITY_PAIRS]
    .map(pair => ({ pair, value: hostilityValue(state, pair) }))
    .sort((a, b) => b.value - a.value)[0];
  const faction = hottest && hottest.value >= 40
    ? `${pairLabel(hottest.pair)}的敌意 ${hottest.value}（${hostilityTierLabel(hottest.value)}）`
    : (() => {
      const best = [...FACTION_ORDER].sort((a, b) => (state.factions[b]?.standing ?? 0) - (state.factions[a]?.standing ?? 0))[0];
      return best ? `${factionInfo[best].name}的态度 ${state.factions[best]?.standing ?? 0}` : '三方今晚都没什么表示';
    })();
  const dirtiestId = rolledDistrict(state, roll);
  const dirtiest = dirtiestId ? { id: dirtiestId, pollution: state.pollution?.[dirtiestId] ?? 0 } : undefined;
  const pollution = dirtiest
    ? `${districts[dirtiest.id].name}的污染 ${dirtiest.pollution}（${pollutionTierLabel(dirtiest.pollution)}）`
    : '污染读数缺席';
  const busiest = state.missions.filter(mission => mission.status !== 'done')[0];
  return {
    faction,
    pollution,
    stability: `安定度 ${state.reputation}`,
    street: busiest ? `派遣栏还挂着「${clip(busiest.title, 16)}」` : '派遣栏今晚空着',
  };
}

/** 没有 API Key、或模型两次都不合格时的本地访谈：全部由当前存档算出来。 */

/** 玩家接手的第一夜：不生成，只播这一条。电台口吻，用名字称呼所长，不用「你」。 */
export function openingCityNews(day = OPENING_NEWS_DAY, playerName = ''): CityNews {
  const name = playerName.trim() || '新任所长';
  return {
    day,
    generatedAt: new Date().toISOString(),
    headline: '夜糖事务所，今夜重新开张',
    items: [{
      tone: 'street',
      text: `${name}继承了事务所——它在多年沉寂后重新开张。今夜明灯已亮，这座城市会不会在新的手上变得更好？`,
    }],
    source: 'rule',
  };
}

/** 今天的播报有没有过期（换了业务日就要重写；第一夜固定用开场那一条）。 */
export function newsIsStale(news: CityNews | undefined, day: number): boolean {
  if (day <= OPENING_NEWS_DAY) return false;
  if (!news || news.day !== day) return true;
  return !news.items.length && !(news.lines?.length ?? 0);
}