import type { Equipment } from '../../types';

/** 四阶：要打过几场硬仗才买得起。属性 +22…30，一到两条被动，或一个技能。 */
export const tier4: Equipment[] = [
  {
    id: 't4-witch-eclipse-scepter', name: '蚀心权杖', faction: 'witch', slot: 'weapon', tier: 4, price: 6000, standingReq: 50,
    description: '权杖顶端嵌合的深渊蚀晶会自主呼应持有者的心跳共振起伏，散发着沉郁的紫黑冷光；它仿佛渴望着痛楚的献祭，能在侵蚀加深的代价下迸发极强破坏力。',
    stats: { magic: 16, empathy: 8 }, passive: '造成伤害 +10%，每场战斗侵蚀 +2',
    damageBonus: 10, corruptionPerBattle: 2,
  },
  {
    id: 't4-witch-thorn-crown', name: '棘冠', faction: 'witch', slot: 'charm', tier: 4, price: 5400, standingReq: 50,
    description: '由带着剧毒黑刺的古老干荆棘编结而成的环形发冠，戴在额前会刺出细密血珠，然而血水渗下的瞬间，周身操纵暗影的精准度亦被催动至巅峰。',
    stats: { magic: 10, empathy: 9 }, passive: '心防上限 +18%', spiritBonusPct: 18,
  },
  {
    id: 't4-assoc-starfall-staff', name: '落星长杖', faction: 'association', slot: 'weapon', tier: 4, price: 6200, standingReq: 50,
    description: '杖端以精巧的银爪机械牢固禁锢着一小块天外坠落的星核碎屑，挥动时长杖周围的空间微光隐隐塌陷，轰出的流星攻势具备摧枯拉朽的威能。',
    stats: { magic: 17, insight: 9 }, passive: '造成伤害 +10%', damageBonus: 10,
  },
  {
    id: 't4-assoc-choir-cape', name: '合唱斗篷', faction: 'association', slot: 'charm', tier: 4, price: 5600, standingReq: 50,
    description: '内衬以银线细密缝绣着十二位历代最英勇圣咏者名字的重叠披风，迎风扬起时身形宛如被圣光环抱，赋予持有者崇高而坚如磐石的心防韧性。',
    stats: { empathy: 13, insight: 8 }, passive: '心防上限 +18%', spiritBonusPct: 18,
  },
  {
    id: 't4-assoc-first-light', name: '第一盏灯', faction: 'association', slot: 'consumable', tier: 4, price: 5800, standingReq: 50,
    description: '分装自协会初创典礼上第一盏引路长明灯底座的珍贵金油，在重伤垂危之际服下，宛如第一抹拂晓光辉注入胸腔，瞬间奇迹般恢复 140 点生命。', effect: 'heal', amount: 140,
  },
  {
    id: 't4-gov-verdict', name: '裁决器械', faction: 'government', slot: 'weapon', tier: 4, price: 6400, standingReq: 50,
    description: '在特别勤务课绝密档案中仅被特批调出过三次的重型裁决器械，启动时内部齿轮沉重咬合，出手前能精准锁定敌方的生理弱点完成先手破防。',
    stats: { magic: 15, insight: 10 }, passive: '首轮洞察 +6，造成伤害 +6%',
    initiativeBonus: 6, damageBonus: 6,
  },
  {
    id: 't4-gov-sealed-armor', name: '封存胸甲', faction: 'government', slot: 'charm', tier: 4, price: 6000, standingReq: 50,
    description: '代号与编号在战火中被彻底烧蚀抹去的重型封存全身胸甲，它曾抵挡过何等烈度的天灾轰击已不可考，但依然能为穿戴者提供极其厚重的生命加护。',
    stats: { empathy: 12, insight: 8 }, passive: '生命上限 +32', maxHpBonus: 32,
  },
  // ── 原有的两条四阶 ──
  {
    id: 'moon-weapon', name: '蚀月法器', faction: 'witch', slot: 'weapon', tier: 4, price: 5200, standingReq: 50,
    description: '直接以月蚀深渊结晶薄片磨砺构筑的短法器，握持时间稍长便能隐隐听见其内部传来的非人心跳声，在微量侵蚀代价下赋予攻势狂躁的穿透力。',
    stats: { magic: 8 }, passive: '造成伤害 +6%，每场战斗侵蚀 +1', damageBonus: 6, corruptionPerBattle: 1,
  },
  {
    id: 'night-ring', name: '夜祷指环', faction: 'witch', slot: 'charm', tier: 4, price: 5600, standingReq: 50,
    description: '月蚀庭遗落的纯黑古戒，戒面刻有失落的祭月符文，佩戴于指间时脑海中会自动浮现出古老而幽微的深层法术回路，赋予使用者第四技能「夜祷回响」。',
    skillId: 'night-prayer', passive: '获得第四技能「夜祷回响」',
  },
];
