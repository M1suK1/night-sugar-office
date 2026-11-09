import type { Equipment } from '../../types';

/**
 * 五阶：三件，声望 80 才拿得到。
 * 不是“更贵的好东西”，是各方把压箱底的东西交到你手上——所以每一件都有明确的代价。
 */
export const tier5: Equipment[] = [
  {
    id: 't5-witch-eclipse-heart', name: '蚀心核', faction: 'witch', slot: 'weapon', tier: 5, price: 12000, standingReq: 80,
    description: '一枚被精密焊接在苍白骨柄内部、依然维持着低沉搏动节律的焦黑异化核心。月蚀庭坚称这是自愿献祭的升华遗存，挥动它掀起狂暴黑焰时，使用者能清晰感知到自身心室亦在同频灼痛。',
    stats: { magic: 22, empathy: 12 }, skillId: 'night-prayer',
    passive: '获得技能「夜祷回响」；造成伤害 +15%，但每场战斗侵蚀 +4',
    damageBonus: 15, corruptionPerBattle: 4,
  },
  {
    id: 't5-assoc-last-lamp', name: '最后一盏灯', faction: 'association', slot: 'weapon', tier: 5, price: 10800, standingReq: 80,
    description: '星灯协会绝密禁库底层封存的古老至宝。当灯芯引燃的刹那，整间殿堂内的阴影都会被绝对理性强行蒸发，立于光幕之下者绝不迷失，代价则是神智被高悬的光芒灼得隐隐作痛。',
    stats: { magic: 18, insight: 10, empathy: 8 }, skillId: 'star-vigil',
    passive: '获得技能「守夜灯」；心防上限 +20%，但生命上限 −10',
    spiritBonusPct: 20, maxHpBonus: -12,
  },
  {
    id: 't5-gov-sealed-verdict', name: '封存裁决书', faction: 'government', slot: 'charm', tier: 5, price: 13200, standingReq: 80,
    description: '一份未经登记且不带任何工号印记的绝密裁决文书。敢于在此笺末尾签下真名之人，便拥有在当夜强行逆转一场灾变因果的至高权柄，令恐怖的灾祸在记录中彻底“从未发生”。',
    stats: { insight: 20, magic: 14 }, skillId: 'verdict-seal',
    passive: '获得技能「一纸裁决」；首轮洞察 +8，但每场战斗后疲劳 +6',
    initiativeBonus: 8,
  },
];
