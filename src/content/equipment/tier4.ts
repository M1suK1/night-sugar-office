import type { Equipment } from '../../types';

/** 四阶：要打过几场硬仗才买得起。属性 +22…30，一到两条被动，或一个技能。 */
export const tier4: Equipment[] = [
  {
    id: 't4-witch-eclipse-scepter', name: '蚀心权杖', faction: 'witch', slot: 'weapon', tier: 4, price: 6000, standingReq: 50,
    description: '杖心的蚀晶会随着持有者的心跳一起亮。它喜欢疼的人。',
    stats: { magic: 16, empathy: 8 }, passive: '造成伤害 +10%，每场战斗侵蚀 +2',
    damageBonus: 0.1, corruptionPerBattle: 2,
  },
  {
    id: 't4-witch-thorn-crown', name: '棘冠', faction: 'witch', slot: 'charm', tier: 4, price: 5400, standingReq: 50,
    description: '戴在头上会扎出血珠。血珠落下的地方，影子会更听话。',
    stats: { magic: 10, empathy: 9 }, passive: '心防上限 +18%', spiritBonusPct: 18,
  },
  {
    id: 't4-assoc-starfall-staff', name: '落星长杖', faction: 'association', slot: 'weapon', tier: 4, price: 6200, standingReq: 50,
    description: '杖顶封着一小块坠落的星屑。它落下来的时候，据说没有人听见。',
    stats: { magic: 17, insight: 9 }, passive: '造成伤害 +10%', damageBonus: 0.1,
  },
  {
    id: 't4-assoc-choir-cape', name: '合唱斗篷', faction: 'association', slot: 'charm', tier: 4, price: 5600, standingReq: 50,
    description: '内衬缝着十二个人的名字。披上它，说话就像有人在替你和声。',
    stats: { empathy: 13, insight: 8 }, passive: '心防上限 +18%', spiritBonusPct: 18,
  },
  {
    id: 't4-assoc-first-light', name: '第一盏灯', faction: 'association', slot: 'consumable', tier: 4, price: 5800, standingReq: 50,
    description: '把协会最初那盏灯里的油分装了一小瓶。恢复 140 点生命。', effect: 'heal', amount: 140,
  },
  {
    id: 't4-gov-verdict', name: '裁决器械', faction: 'government', slot: 'weapon', tier: 4, price: 6400, standingReq: 50,
    description: '只在文件上写过三次名字的器械。它出手前会先念一遍你的编号。',
    stats: { magic: 15, insight: 10 }, passive: '首轮洞察 +6，造成伤害 +6%',
    initiativeBonus: 6, damageBonus: 0.06,
  },
  {
    id: 't4-gov-sealed-armor', name: '封存胸甲', faction: 'government', slot: 'charm', tier: 4, price: 6000, standingReq: 50,
    description: '编号被磨掉的旧胸甲。它挡过什么，档案里没有写。',
    stats: { empathy: 12, insight: 8 }, passive: '生命上限 +32', maxHpBonus: 32,
  },
  // ── 原有的两条四阶 ──
  {
    id: 'moon-weapon', name: '蚀月法器', faction: 'witch', slot: 'weapon', tier: 4, price: 5200, standingReq: 50,
    description: '以月蚀碎片磨成的短杖。握久了，会听见不属于自己的心跳。',
    stats: { magic: 8 }, passive: '造成伤害 +6%，每场战斗侵蚀 +1', damageBonus: 0.06, corruptionPerBattle: 1,
  },
  {
    id: 'night-ring', name: '夜祷指环', faction: 'witch', slot: 'charm', tier: 4, price: 5600, standingReq: 50,
    description: '月蚀庭的旧戒指。戴上它的人会多出一段不该会的祷词。',
    skillId: 'night-prayer', passive: '获得第四技能「夜祷回响」',
  },
];
