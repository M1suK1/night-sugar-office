import type { CityNews, CityNewsItem, GameState } from './types.ts';
import { districtOrder, districts } from './districts.ts';
import { factionInfo } from './content/items.ts';
import { FACTION_ORDER } from './territories.ts';
import { HOSTILITY_PAIRS, hostilityTierLabel, hostilityValue, pairLabel } from './hostility.ts';
import { pollutionTierLabel } from './pollution.ts';

export const CITY_NEWS_MAX = 3;
export const CITY_NEWS_MIN = 1;
/** 玩家接手的第一夜：不请叙事者，只播这一条。 */
export const OPENING_NEWS_DAY = 14;

const TONES: CityNewsItem['tone'][] = ['faction', 'pollution', 'stability', 'street'];

function clip(text: string, limit: number): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
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
  // 只有标题没有条目的播报没有意义：宁可当作没生成，让调用方回落到本地快讯。
  if (!items.length) return undefined;
  return {
    day: Number.isFinite(value.day) ? Math.max(0, Math.round(Number(value.day))) : day,
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : new Date().toISOString(),
    headline: headline || items[0]!.text.slice(0, 40),
    items,
    source: value.source === 'llm' ? 'llm' : 'rule',
  };
}

/** 没有 API Key、或模型两次都不合格时的本地播报：全部由当前存档算出来。 */
export function localCityNews(state: GameState, day = state.day): CityNews {
  const items: CityNewsItem[] = [];
  const hottest = [...HOSTILITY_PAIRS]
    .map(pair => ({ pair, value: hostilityValue(state, pair) }))
    .sort((a, b) => b.value - a.value)[0];
  if (hottest && hottest.value >= 40) {
    items.push({
      tone: 'faction',
      text: `${pairLabel(hottest.pair)}的敌意升到 ${hottest.value}（${hostilityTierLabel(hottest.value)}）；通讯员说，两边的车队已经在辖区边界上互相别过灯。`,
    });
  } else {
    const best = [...FACTION_ORDER].sort((a, b) => (state.factions[b]?.standing ?? 0) - (state.factions[a]?.standing ?? 0))[0];
    if (best) {
      const standing = state.factions[best]?.standing ?? 0;
      items.push({ tone: 'faction', text: `${factionInfo[best].name}的态度是 ${standing}，他们的代表今晚照例在会客厅留了话。` });
    }
  }

  const dirtiest = [...districtOrder]
    .map(id => ({ id, pollution: state.pollution?.[id] ?? 0 }))
    .sort((a, b) => b.pollution - a.pollution)[0];
  if (dirtiest) {
    items.push({
      tone: 'pollution',
      text: `${districts[dirtiest.id].name}的污染读数 ${dirtiest.pollution}（${pollutionTierLabel(dirtiest.pollution)}），巡守班建议今晚绕开那一侧的排水沟。`,
    });
  }

  if (state.reputation <= 30) {
    items.push({ tone: 'stability', text: `城市安定度只剩 ${state.reputation}，市政厅的灯亮得比平时早，街角的告示栏贴出了新的宵禁提醒。` });
  } else if (state.reputation >= 70) {
    items.push({ tone: 'stability', text: `安定度 ${state.reputation}，夜市的摊子重新支起来了，连回收车的司机都在车里哼歌。` });
  } else {
    items.push({ tone: 'stability', text: `安定度 ${state.reputation}，不好也不坏——够让便利店继续通宵，不够让家长放心。` });
  }

  const busiest = state.missions.filter(mission => mission.status !== 'done').slice(0, 1)[0];
  items.push({
    tone: 'street',
    text: busiest
      ? `派遣栏还挂着「${clip(busiest.title, 16)}」，据说是今晚最不好收尾的一桩。`
      : '派遣栏今晚意外地干净，只剩几张没有人认领的旧告示在风里翻页。',
  });

  return {
    day,
    generatedAt: new Date().toISOString(),
    headline: `${day} 日 · 夜色照样会准时到站`,
    items: items.slice(0, CITY_NEWS_MAX),
    source: 'rule',
  };
}

/** 玩家接手的第一夜：不生成，只播这一条。 */
export function openingCityNews(day = OPENING_NEWS_DAY): CityNews {
  return {
    day,
    generatedAt: new Date().toISOString(),
    headline: '夜糖事务所，今夜重新开张',
    items: [{
      tone: 'street',
      text: '你继承了事务所——它在多年沉寂后重新开张。今夜明灯已亮，城市是否会在你的领导下变得更好？',
    }],
    source: 'rule',
  };
}

/** 今天的播报有没有过期（换了业务日就要重写；第一夜固定用开场那一条）。 */
export function newsIsStale(news: CityNews | undefined, day: number): boolean {
  if (day <= OPENING_NEWS_DAY) return false;
  return !news || news.day !== day || !news.items.length;
}
