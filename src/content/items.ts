import type { Equipment, FactionId, GameState } from '../types';
import { tier1 } from './equipment/tier1.ts';
import { tier2 } from './equipment/tier2.ts';
import { tier3 } from './equipment/tier3.ts';
import { tier4 } from './equipment/tier4.ts';
import { tier5 } from './equipment/tier5.ts';
import { withItemSet } from './sets.ts';

export const factionInfo: Record<FactionId, { name: string; short: string; color: string; motto: string; envoy: string; title: string }> = {
  witch: { name: '月蚀庭', short: '月蚀', color: '#B98AD9', motto: '禁忌不是警告，是价格。', envoy: '黑川眠', title: '月蚀庭夜祷使' },
  association: { name: '星灯协会', short: '星灯', color: '#F1A7C6', motto: '让每一盏灯都不必独自亮着。', envoy: '白鹭千秋', title: '协会监察官' },
  government: { name: '樱雾市役所', short: '市役所', color: '#9CC9D2', motto: '秩序是城市最慢、也最稳的魔法。', envoy: '雨宫澄', title: '夜间事务专员' },
};

/** 内置内容里的装备（已挂上套装）：只有这一批会被控制台直接发放。 */
export const baseItems: Equipment[] = [...tier1, ...tier2, ...tier3, ...tier4, ...tier5].map(withItemSet);
/** 当前注册表：内置 + 运行时登记的炼制 / 故事专属装备。 */
export const items: Equipment[] = [...baseItems];

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
  const decorated = withItemSet(item);
  const existing = itemById.get(decorated.id);
  if (existing) {
    Object.assign(existing, decorated);
    return existing;
  }
  items.push(decorated);
  itemById.set(decorated.id, decorated);
  return decorated;
}

/**
 * 运行时登记装备的存档上限（v260）。
 *
 * 精炼 / 炼制 / 故事遗物只存在于运行时，只能靠 generatedItems 过夜。
 * 上限放在这一处，写入与读档共用——此前一边写 120、一边只留 40，超出的会被静默丢掉。
 */
export const GENERATED_ITEM_LIMIT = 200;

/** 存档里仍被引用的装备 id：仓库还有货，或者有人穿在身上。 */
export function referencedItemIds(state: Pick<GameState, 'inventory' | 'girls'>): Set<string> {
  const ids = new Set<string>();
  for (const [id, count] of Object.entries(state.inventory ?? {})) {
    if ((count ?? 0) > 0) ids.add(id);
  }
  for (const girl of state.girls ?? []) {
    for (const id of Object.values(girl.equipment ?? {})) {
      if (id) ids.add(id);
    }
  }
  return ids;
}

/** 裁剪 generatedItems：被引用的实例一定留下，其余按「新的在前」保留。 */
export function pruneGeneratedItems(list: Equipment[], keep: Set<string>): Equipment[] {
  if (list.length <= GENERATED_ITEM_LIMIT) return list;
  const kept = list.filter(item => keep.has(item.id));
  const spare = list.filter(item => !keep.has(item.id));
  const room = Math.max(0, GENERATED_ITEM_LIMIT - kept.length);
  return [...kept, ...spare.slice(0, room)];
}

/** 记下新登记的实例，并按引用关系裁剪。 */
export function rememberGeneratedItem(
  state: Pick<GameState, 'inventory' | 'girls' | 'generatedItems'>,
  item: Equipment,
): Equipment[] {
  const next = [item, ...(state.generatedItems ?? []).filter(existing => existing.id !== item.id)];
  return pruneGeneratedItems(next, referencedItemIds(state));
}
