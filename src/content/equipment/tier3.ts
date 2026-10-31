import type { Equipment } from '../../types';

/** 三阶：协会/市役所愿意为常客打开柜子。属性 +14…22，必有一条被动。 */
export const tier3: Equipment[] = [
  // ── 月蚀庭 ──
  {
    id: 't3-witch-eclipse-staff', name: '蚀月长杖', faction: 'witch', slot: 'weapon', tier: 3, price: 3200, standingReq: 35,
    description: '杖头嵌着一小块真正的月蚀残片。举起来时，影子的方向会变。',
    stats: { magic: 12, insight: 6 }, passive: '造成伤害 +8%', damageBonus: 0.08,
  },
  {
    id: 't3-witch-night-thorn', name: '夜棘鞭', faction: 'witch', slot: 'weapon', tier: 3, price: 3600, standingReq: 35,
    description: '用夜里长出来的荆棘编成的鞭子。它记得每一个抽过的人。',
    stats: { magic: 9, agility: 8 }, passive: '首轮洞察 +4', initiativeBonus: 4,
  },
  {
    id: 't3-witch-moonveil', name: '月蚀面纱', faction: 'witch', slot: 'charm', tier: 3, price: 2800, standingReq: 35,
    description: '一层看不清的薄纱。戴着它的人，别人记不住脸。',
    stats: { empathy: 10, insight: 5 }, passive: '心防上限 +12%', spiritBonusPct: 12,
  },
  {
    id: 't3-witch-cinder-ring', name: '余烬指环', faction: 'witch', slot: 'charm', tier: 3, price: 3000, standingReq: 35,
    description: '环上有一道烧不掉的裂痕，摸上去是烫的。',
    stats: { magic: 8, empathy: 7 }, passive: '每场战斗侵蚀 +1（换取伤害）', corruptionPerBattle: 1, damageBonus: 0.05,
  },
  {
    id: 't3-witch-black-mass', name: '黑弥撒', faction: 'witch', slot: 'consumable', tier: 3, price: 2900, standingReq: 35,
    description: '一支给魔女续命的针。恢复 90 点生命。', effect: 'heal', amount: 90,
  },
  {
    id: 't3-witch-eclipse-salt', name: '蚀月盐', faction: 'witch', slot: 'consumable', tier: 3, price: 3100, standingReq: 35,
    description: '盐粒会在污染最重的地方自己变黑。污染 −16。', effect: 'purify', amount: 16,
  },
  // ── 星灯协会 ──
  {
    id: 't3-assoc-starweave', name: '星织长杖', faction: 'association', slot: 'weapon', tier: 3, price: 3400, standingReq: 35,
    description: '杖身织进了整段星图的银线，挥动时线会松开一点。',
    stats: { magic: 11, insight: 8 }, passive: '造成伤害 +7%', damageBonus: 0.07,
  },
  {
    id: 't3-assoc-lantern-flail', name: '提灯链锤', faction: 'association', slot: 'weapon', tier: 3, price: 3300, standingReq: 35,
    description: '链子末端挂着一盏小灯。砸下去的时候灯还亮着。',
    stats: { agility: 10, magic: 7 }, passive: '首轮洞察 +4', initiativeBonus: 4,
  },
  {
    id: 't3-assoc-choir-ribbon', name: '合唱缎带', faction: 'association', slot: 'charm', tier: 3, price: 2900, standingReq: 35,
    description: '协会合唱队的老缎带。系上它，喊话时会有人应。',
    stats: { empathy: 11, insight: 5 }, passive: '心防上限 +12%', spiritBonusPct: 12,
  },
  {
    id: 't3-assoc-keeper-gloves', name: '守夜手套', faction: 'association', slot: 'charm', tier: 3, price: 2700, standingReq: 35,
    description: '指尖磨破过又被缝好的手套。戴着它握住的东西不会凉。',
    stats: { empathy: 8, magic: 6 }, passive: '生命上限 +18', maxHpBonus: 18,
  },
  {
    id: 't3-assoc-healing-light', name: '疗愈灯油', faction: 'association', slot: 'consumable', tier: 3, price: 2600, standingReq: 35,
    description: '倒在伤口上会发出很淡的光。恢复 90 点生命。', effect: 'heal', amount: 90,
  },
  {
    id: 't3-gov-purify-rite', name: '净化仪典', faction: 'government', slot: 'consumable', tier: 3, price: 3000, standingReq: 35,
    description: '一场小型的、只有三个人参加的仪典，市役所走完流程后才准办。污染 −16。', effect: 'purify', amount: 16,
  },
  // ── 市役所 ──
  {
    id: 't3-gov-riot-rod', name: '镇暴长杖', faction: 'government', slot: 'weapon', tier: 3, price: 3500, standingReq: 35,
    description: '市役所封存编号的器械。砸下去的声音比想象中闷。',
    stats: { magic: 13, agility: 6 }, passive: '造成伤害 +8%', damageBonus: 0.08,
  },
  {
    id: 't3-gov-archive-blade', name: '归档刃', faction: 'government', slot: 'weapon', tier: 3, price: 3700, standingReq: 35,
    description: '薄得像一张纸的刀。它切开的东西会被“归档”，不再回来。',
    stats: { insight: 11, magic: 8 }, passive: '首轮洞察 +5', initiativeBonus: 5,
  },
  {
    id: 't3-gov-duty-plate', name: '夜勤胸甲', faction: 'government', slot: 'charm', tier: 3, price: 2800, standingReq: 35,
    description: '一片薄钢胸甲，内侧贴着上一任使用者的血型。',
    stats: { empathy: 9, insight: 6 }, passive: '生命上限 +20', maxHpBonus: 20,
  },
  // ── 原有的三阶 ──
  {
    id: 'moon-drug', name: '月蚀抑制剂', faction: 'witch', slot: 'consumable', tier: 3, price: 2800, standingReq: 35,
    description: '一支低温保存的紫色针剂。能让魔女在十日内维持自我。', effect: 'drug', amount: 10,
  },
];
