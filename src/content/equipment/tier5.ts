import type { Equipment } from '../../types';

/**
 * 五阶：三件，声望 80 才拿得到。
 * 不是“更贵的好东西”，是各方把压箱底的东西交到你手上——所以每一件都有明确的代价。
 */
export const tier5: Equipment[] = [
  {
    id: 't5-witch-eclipse-heart', name: '蚀心核', faction: 'witch', slot: 'weapon', tier: 5, price: 12000, standingReq: 80,
    description: '一颗还在跳的东西，被嵌在骨柄上。月蚀庭说这是自愿的，也没人再追问。',
    stats: { magic: 22, empathy: 12 }, skillId: 'night-prayer',
    passive: '获得技能「夜祷回响」；造成伤害 +15%，但每场战斗侵蚀 +4',
    damageBonus: 0.15, corruptionPerBattle: 4,
  },
  {
    id: 't5-assoc-last-lamp', name: '最后一盏灯', faction: 'association', slot: 'weapon', tier: 5, price: 10800, standingReq: 80,
    description: '协会禁书里提过一次的器物：用它点亮的房间，不会再有人走失——包括不该留下的那些人。',
    stats: { magic: 18, insight: 10, empathy: 8 }, skillId: 'star-vigil',
    passive: '获得技能「守夜灯」；心防上限 +20%，但生命上限 −10',
    spiritBonusPct: 20, maxHpBonus: -12,
  },
  {
    id: 't5-gov-sealed-verdict', name: '封存裁决书', faction: 'government', slot: 'charm', tier: 5, price: 13200, standingReq: 80,
    description: '一份没有编号的裁决书。签下名字的人，可以在一次夜里让某件事“从未发生”。',
    stats: { insight: 20, magic: 14 }, skillId: 'verdict-seal',
    passive: '获得技能「一纸裁决」；首轮洞察 +8，但每场战斗后疲劳 +6',
    initiativeBonus: 8,
  },
];
