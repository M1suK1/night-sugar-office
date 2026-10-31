import type { Equipment, FactionId } from '../types';
import { tier1 } from './equipment/tier1.ts';
import { tier2 } from './equipment/tier2.ts';
import { tier3 } from './equipment/tier3.ts';
import { tier4 } from './equipment/tier4.ts';
import { tier5 } from './equipment/tier5.ts';

export const factionInfo: Record<FactionId, { name: string; short: string; color: string; motto: string; envoy: string; title: string }> = {
  witch: { name: '月蚀庭', short: '月蚀', color: '#B98AD9', motto: '禁忌不是警告，是价格。', envoy: '黑川眠', title: '月蚀庭夜祷使' },
  association: { name: '星灯协会', short: '星灯', color: '#F1A7C6', motto: '让每一盏灯都不必独自亮着。', envoy: '白鹭千秋', title: '协会监察官' },
  government: { name: '樱雾市役所', short: '市役所', color: '#9CC9D2', motto: '秩序是城市最慢、也最稳的魔法。', envoy: '雨宫澄', title: '夜间事务专员' },
};

export const items: Equipment[] = [...tier1, ...tier2, ...tier3, ...tier4, ...tier5];

export const itemById = new Map(items.map(i => [i.id, i]));
export function findItem(id: string | undefined): Equipment | undefined {
  return id ? itemById.get(id) : undefined;
}
/** 当前已注册的全部物品，包含内置、故事奖励与一次性生成装备。 */
export function listItems(): Equipment[] {
  return items;
}
export function getItem(id: string | undefined): Equipment | undefined {
  return findItem(id);
}
/** 故事线奖励的专属装备：登记后 getItem / 装备栏 / 背包都能直接识别。 */
export function registerItem(item: Equipment): Equipment {
  const existing = itemById.get(item.id);
  if (existing) return existing;
  items.push(item);
  itemById.set(item.id, item);
  return item;
}
