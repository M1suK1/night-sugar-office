import type { CityNews, CityNewsItem, CityNewsLine, GameState } from './types.ts';
import { districtOrder, districts } from './districts.ts';
import { factionInfo } from './content/items.ts';
import { FACTION_ORDER } from './territories.ts';
import { HOSTILITY_PAIRS, hostilityTierLabel, hostilityValue, pairLabel } from './hostility.ts';
import { CITY_NEWS_MAX, newsTalkingPoints, pickNewsGuests, pickNewsHost } from './cityNews.ts';
/**
 * 本地快报 / 本地访谈的文案原料。
 *
 * items 是要闻摘要，必须是完整句子（播报面板只显示这几行时也要读得通）；
 * lines 才是访谈里的短句。两者不要混用同一份文案。
 */
function clipLocal(text: string, limit: number): string {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > limit ? value.slice(0, limit) + '…' : value;
}
function localNewsItems(state: GameState): CityNewsItem[] {
  const hottest = [...HOSTILITY_PAIRS]
    .map(pair => ({ pair, value: hostilityValue(state, pair) }))
    .sort((a, b) => b.value - a.value)[0];
  const factionItem = hottest && hottest.value >= 40
    ? `${pairLabel(hottest.pair)}的敌意升到 ${hottest.value}（${hostilityTierLabel(hottest.value)}）；通讯员说，两边的车队已经在辖区边界上互相别过灯。`
    : (() => {
      const best = [...FACTION_ORDER].sort((a, b) => (state.factions[b]?.standing ?? 0) - (state.factions[a]?.standing ?? 0))[0];
      if (!best) return '三方今晚都没什么表示，会客厅的灯一直亮着。';
      return `${factionInfo[best].name}的态度是 ${state.factions[best]?.standing ?? 0}，他们的代表今晚照例在会客厅留了话。`;
    })();

  const dirtiest = [...districtOrder]
    .map(id => ({ id, pollution: state.pollution?.[id] ?? 0 }))
    .sort((a, b) => b.pollution - a.pollution)[0];
  const pollutionItem = dirtiest
    ? `${districts[dirtiest.id].name}的水沟里浮起一层冷光，巡守班建议今晚绕开那一侧。`
    : '仪器今晚又坏了，巡守班说读数先空着。';

  const stabilityItem = state.reputation <= 30
    ? `市政厅的灯亮得比平时早，街角的告示栏贴出了新的宵禁提醒。`
    : state.reputation >= 70
      ? `夜市的摊子重新支起来了，连回收车的司机都在车里哼歌。`
      : `不好也不坏——够让便利店继续通宵，不够让家长放心。`;

  const busiest = state.missions.filter(mission => mission.status !== 'done')[0];
  const streetItem = busiest
    ? `派遣栏还挂着「${clipLocal(busiest.title, 16)}」，据说是今晚最不好收尾的一桩。`
    : '派遣栏今晚意外地干净，只剩几张没有人认领的旧告示在风里翻页。';

  const items: CityNewsItem[] = [
    { tone: 'faction', text: factionItem },
    { tone: 'pollution', text: pollutionItem },
    { tone: 'stability', text: stabilityItem },
    { tone: 'street', text: streetItem },
  ];
  return items.slice(0, CITY_NEWS_MAX);
}

/** 没有 API Key、或模型两次都不合格时的本地访谈：全部由当前存档算出来。 */
export function localCityNews(state: GameState, day = state.day): CityNews {
  const points = newsTalkingPoints(state);
  const host = pickNewsHost(state);
  const guests = pickNewsGuests(state, host?.id);
  const items = localNewsItems(state);

  const lines: CityNewsLine[] = [];
  if (host) {
    lines.push({ speakerId: host.id, speakerName: host.name, text: `晚上好，这里是夜糖电台。今晚先说${points.faction}。` });
    guests.forEach((guest, index) => {
      lines.push({ speakerId: guest.id, speakerName: guest.name, text: index === 0 ? `${points.pollution}，这条街我比谁都清楚。` : `${points.stability}。你们的事务所还撑得住吗。` });
      lines.push({ speakerId: host.id, speakerName: host.name, text: index === 0 ? '撑不撑得住，得看今晚谁肯接单。' : '这话我记下了，回头会转给所长。' });
    });
    lines.push({ speakerId: host.id, speakerName: host.name, text: `${points.street}。今晚就到这里。` });
  }

  return {
    day,
    generatedAt: new Date().toISOString(),
    headline: `${day} 日 · 夜色照样会准时到站`,
    items,
    source: 'rule',
    ...(host ? { host } : {}),
    ...(guests.length ? { guests: guests.slice(0, 2) } : {}),
    ...(lines.length ? { lines } : {}),
  };
}
