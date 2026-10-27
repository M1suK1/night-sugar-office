import type { Equipment, FactionId } from '../types';

export const factionInfo: Record<FactionId, { name: string; short: string; color: string; motto: string; envoy: string; title: string }> = {
  witch: { name: '月蚀庭', short: '月蚀', color: '#B98AD9', motto: '禁忌不是警告，是价格。', envoy: '黑川眠', title: '月蚀庭夜祷使' },
  association: { name: '星灯协会', short: '星灯', color: '#F1A7C6', motto: '让每一盏灯都不必独自亮着。', envoy: '白鹭千秋', title: '协会监察官' },
  government: { name: '樱雾市役所', short: '市役所', color: '#9CC9D2', motto: '秩序是城市最慢、也最稳的魔法。', envoy: '雨宫澄', title: '夜间事务专员' },
};

export const items: Equipment[] = [
  {
    id: 'moon-drug', name: '月蚀抑制剂', faction: 'witch', slot: 'consumable', price: 2400, standingReq: 20,
    description: '一支低温保存的紫色针剂。能让魔女在十日内维持自我。', effect: 'drug', amount: 10,
  },
  {
    id: 'moon-weapon', name: '蚀月法器', faction: 'witch', slot: 'weapon', price: 3200, standingReq: 40,
    description: '以月蚀碎片磨成的短杖。握久了，会听见不属于自己的心跳。',
    stats: { magic: 8 }, passive: '造成伤害 +6%，每场战斗侵蚀 +1', damageBonus: 0.06, corruptionPerBattle: 1,
  },
  {
    id: 'black-sugar', name: '黑糖护符', faction: 'witch', slot: 'charm', price: 1800, standingReq: 30,
    description: '一块苦得发咸的黑糖。含在嘴里时，共情值更难被击穿。',
    stats: { empathy: 6 }, spiritBonus: 10, passive: '共情值上限 +10',
  },
  {
    id: 'night-ring', name: '夜祷指环', faction: 'witch', slot: 'charm', price: 4200, standingReq: 55,
    description: '月蚀庭的旧戒指。戴上它的人会多出一段不该会的祷词。',
    skillId: 'night-prayer', passive: '获得第四技能「夜祷回响」',
  },
  {
    id: 'star-kit', name: '星灯治疗包', faction: 'association', slot: 'consumable', price: 600, standingReq: 0,
    description: '协会配发的便携治疗包。恢复 40 点生命。', effect: 'heal', amount: 40,
  },
  {
    id: 'silver-wand', name: '银线法器', faction: 'association', slot: 'weapon', price: 2400, standingReq: 20,
    description: '一根缠着银线的细杖，轻得像一句还没说完的安慰。',
    stats: { magic: 5, insight: 3 },
  },
  {
    id: 'association-badge', name: '协会徽章', faction: 'association', slot: 'charm', price: 2200, standingReq: 35,
    description: '星灯协会的银质徽章。别在衣领内侧，共情值更稳定。',
    spiritBonus: 12, passive: '共情值上限 +12',
  },
  {
    id: 'purify-course', name: '净化课程', faction: 'association', slot: 'consumable', price: 1600, standingReq: 25,
    description: '一次由协会导师带领的净化。侵蚀度 −8。', effect: 'purify', amount: 8,
  },
  {
    id: 'riot-charm', name: '防暴护符', faction: 'government', slot: 'charm', price: 1500, standingReq: 10,
    description: '市役所配发的制式护符。生命上限 +10。',
    maxHpBonus: 10, passive: '生命上限 +10',
  },
  {
    id: 'pocket-watch', name: '市役所怀表', faction: 'government', slot: 'charm', price: 2600, standingReq: 30,
    description: '表盖内侧刻着值班编号。首轮洞察 +3。',
    stats: { agility: 4 }, initiativeBonus: 3, passive: '首轮洞察 +3',
  },
  {
    id: 'permit', name: '执勤许可', faction: 'government', slot: 'consumable', price: 900, standingReq: 20,
    description: '下一次签约金 −10%。', effect: 'contractDiscount', amount: 10,
  },
  {
    id: 'tax-voucher', name: '税补券', faction: 'government', slot: 'consumable', price: 0, standingReq: 45,
    description: '每 7 日可兑换 1,500 星砂。', effect: 'taxRefund', amount: 1500,
  },
];

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
