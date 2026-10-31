import type { Equipment } from '../../types';

/** 二阶：小有积蓄之后。属性 +8…14，约四分之一带一条小被动。 */
export const tier2: Equipment[] = [
  // ── 月蚀庭 ──
  {
    id: 't2-witch-bone-lance', name: '蚀骨长针', faction: 'witch', slot: 'weapon', tier: 2, price: 1400, standingReq: 20,
    description: '比手臂还长的针，针尖永远朝着人。', stats: { magic: 6, insight: 4 },
  },
  {
    id: 't2-witch-vesper-staff', name: '晚祷杖', faction: 'witch', slot: 'weapon', tier: 2, price: 1900, standingReq: 20,
    description: '杖身刻满祷词，念到一半就会自己接下去。', stats: { magic: 8 },
  },
  {
    id: 't2-witch-blood-salt', name: '血盐瓶', faction: 'witch', slot: 'charm', tier: 2, price: 1600, standingReq: 20,
    description: '一小瓶暗红色的盐。放在心口，心跳会变得慢而稳。', stats: { empathy: 8 },
  },
  {
    id: 't2-witch-eclipse-earring', name: '蚀月耳坠', faction: 'witch', slot: 'charm', tier: 2, price: 2000, standingReq: 20,
    description: '一弯黑色的月牙，坠在耳下会轻轻发烫。', stats: { insight: 6, empathy: 4 },
  },
  {
    id: 't2-witch-bitter-draught', name: '蚀血药剂', faction: 'witch', slot: 'consumable', tier: 2, price: 1400, standingReq: 20,
    description: '喝下去像有人在血管里点了一盏灯。恢复 55 点生命。', effect: 'heal', amount: 55,
  },
  {
    id: 't2-witch-salt-bath', name: '苦盐浴', faction: 'witch', slot: 'consumable', tier: 2, price: 1500, standingReq: 20,
    description: '一包粗盐，倒进热水里泡到水变凉。污染 −10。', effect: 'purify', amount: 10,
  },
  // ── 星灯协会 ──
  {
    id: 't2-assoc-stitch-staff', name: '星缝长杖', faction: 'association', slot: 'weapon', tier: 2, price: 1600, standingReq: 20,
    description: '杖头是一根穿了银线的针。协会的人用它把裂开的东西缝回去。', stats: { magic: 7, insight: 4 },
  },
  {
    id: 't2-assoc-wick-whip', name: '灯芯鞭', faction: 'association', slot: 'weapon', tier: 2, price: 1800, standingReq: 20,
    description: '鞭梢是一小截灯芯，抽出去会拖出一道暖色的弧。', stats: { agility: 6, magic: 4 },
  },
  {
    id: 't2-assoc-lamp-brooch', name: '星灯胸针', faction: 'association', slot: 'charm', tier: 2, price: 1700, standingReq: 20,
    description: '别在左胸的星形胸针，夜里贴近会看见极细的光。', stats: { empathy: 7 },
  },
  {
    id: 't2-assoc-silver-band', name: '银线手环', faction: 'association', slot: 'charm', tier: 2, price: 1900, standingReq: 20,
    description: '绕腕两圈的银线，动起来会响一声很轻的铃。', stats: { agility: 7 },
  },
  {
    id: 't2-assoc-bandage-roll', name: '星灯绷带卷', faction: 'association', slot: 'consumable', tier: 2, price: 1200, standingReq: 20,
    description: '一整卷压实的绷带，撕开就有淡淡的消毒水味。恢复 55 点生命。', effect: 'heal', amount: 55,
  },
  {
    id: 't2-assoc-purify-oil', name: '净灯油', faction: 'association', slot: 'consumable', tier: 2, price: 1600, standingReq: 20,
    description: '点一盏灯，烧掉一间屋子里的浊气。污染 −10。', effect: 'purify', amount: 10,
  },
  // ── 市役所 ──
  {
    id: 't2-gov-serial-baton', name: '编号长棍', faction: 'government', slot: 'weapon', tier: 2, price: 1500, standingReq: 20,
    description: '棍身刻着两位数编号，比普通短棍长出一截。', stats: { magic: 5, agility: 5 },
  },
  {
    id: 't2-gov-searchlight', name: '探照杖', faction: 'government', slot: 'weapon', tier: 2, price: 2000, standingReq: 20,
    description: '杖头能打出一柱冷光。被照到的东西会有一瞬间动不了。', stats: { insight: 8 },
  },
  {
    id: 't2-gov-suppress-rod', name: '镇压杖', faction: 'government', slot: 'weapon', tier: 2, price: 2100, standingReq: 20,
    description: '夜勤课真正动粗时用的东西。它不漂亮，但很管用。', stats: { magic: 9 },
  },
  {
    id: 't2-gov-shift-band', name: '夜勤袖章', faction: 'government', slot: 'charm', tier: 2, price: 1500, standingReq: 20,
    description: '深蓝色的袖章，缝着值班组的号码。戴上它，说话会变得简短。', stats: { insight: 6, empathy: 4 },
  },
  {
    id: 't2-gov-first-aid', name: '急救针', faction: 'government', slot: 'consumable', tier: 2, price: 1300, standingReq: 20,
    description: '一支一次性针剂，说明书只有一行字。恢复 55 点生命。', effect: 'heal', amount: 55,
  },
  {
    id: 't2-gov-decon-spray', name: '除染喷雾', faction: 'government', slot: 'consumable', tier: 2, price: 1500, standingReq: 20,
    description: '喷一遍，墙上的霉斑会退成浅灰色。污染 −10。', effect: 'purify', amount: 10,
  },
  {
    id: 't2-gov-ration-voucher', name: '夜勤补给券', faction: 'government', slot: 'consumable', tier: 2, price: 1400, standingReq: 20,
    description: '下一次签约金 −15%。', effect: 'contractDiscount', amount: 15,
  },
  // ── 原有的五条二阶 ──
  {
    id: 'silver-wand', name: '银线法器', faction: 'association', slot: 'weapon', tier: 2, price: 2200, standingReq: 20,
    description: '一根缠着银线的细杖，轻得像一句还没说完的安慰。',
    stats: { magic: 5, insight: 3 },
  },
  {
    id: 'association-badge', name: '协会徽章', faction: 'association', slot: 'charm', tier: 2, price: 2200, standingReq: 20,
    description: '星灯协会的银质徽章。别在衣领内侧，心防更稳。',
    spiritBonusPct: 15, passive: '心防上限 +15%',
  },
  {
    id: 'black-sugar', name: '黑糖护符', faction: 'witch', slot: 'charm', tier: 2, price: 1800, standingReq: 20,
    description: '一块苦得发咸的黑糖。含在嘴里时，心防更不容易被击穿。',
    stats: { empathy: 6 }, spiritBonusPct: 10, passive: '心防上限 +10%',
  },
  {
    id: 'riot-charm', name: '防暴护符', faction: 'government', slot: 'charm', tier: 2, price: 1500, standingReq: 20,
    description: '市役所配发的制式护符。生命上限 +10。',
    maxHpBonus: 10, passive: '生命上限 +10',
  },
  {
    id: 'pocket-watch', name: '市役所怀表', faction: 'government', slot: 'charm', tier: 2, price: 2100, standingReq: 20,
    description: '表盖内侧刻着值班编号。首轮洞察 +3。',
    stats: { agility: 4 }, initiativeBonus: 3, passive: '首轮洞察 +3',
  },
];
