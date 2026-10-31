import type { Equipment } from '../../types';

/** 一阶：街面上买得到的东西。属性 +4…8，没有被动。 */
export const tier1: Equipment[] = [
  // ── 月蚀庭 ──
  {
    id: 't1-witch-thorn-wand', name: '荆棘短杖', faction: 'witch', slot: 'weapon', tier: 1, price: 620, standingReq: 0,
    description: '一截缠着干枯荆棘的木杖。它扎手，但扎得比魔物狠。', stats: { magic: 4 },
  },
  {
    id: 't1-witch-bone-needle', name: '骨针', faction: 'witch', slot: 'weapon', tier: 1, price: 780, standingReq: 0,
    description: '不知道是谁的骨头磨成的针。缝东西时，针会先找准最软的那道缝。', stats: { magic: 3, insight: 2 },
  },
  {
    id: 't1-witch-cinder-staff', name: '余烬杖', faction: 'witch', slot: 'weapon', tier: 1, price: 880, standingReq: 0,
    description: '杖头那点余烬从不熄灭，也从不照亮什么。', stats: { magic: 5 },
  },
  {
    id: 't1-witch-black-salt', name: '黑盐袋', faction: 'witch', slot: 'charm', tier: 1, price: 520, standingReq: 0,
    description: '小布袋里装着炒过的黑盐。月蚀庭的人说，盐能记住眼泪的形状。', stats: { empathy: 3 },
  },
  {
    id: 't1-witch-eclipse-token', name: '蚀纹小牌', faction: 'witch', slot: 'charm', tier: 1, price: 640, standingReq: 0,
    description: '一枚刻着半个日轮的铜牌。摸久了，边缘会被磨得发亮。', stats: { insight: 3 },
  },
  {
    id: 't1-witch-moth-wing', name: '蛾翅夹', faction: 'witch', slot: 'charm', tier: 1, price: 700, standingReq: 0,
    description: '夹着一片比手掌还大的蛾翅。夜里它偶尔会自己扇一下。', stats: { agility: 3 },
  },
  {
    id: 't1-witch-bitter-syrup', name: '苦糖浆', faction: 'witch', slot: 'consumable', tier: 1, price: 420, standingReq: 0,
    description: '一瓶黑得发亮的糖浆。咽下去像吞了一口铁锈。恢复 30 点生命。', effect: 'heal', amount: 30,
  },
  {
    id: 't1-witch-thorn-censer', name: '荆棘香囊', faction: 'witch', slot: 'charm', tier: 1, price: 560, standingReq: 0,
    description: '干荆棘缝进布囊，闻久了会有点晕。据说这样闻不出污染的味道。', stats: { insight: 2, empathy: 1 },
  },
  // ── 星灯协会 ──
  {
    id: 't1-assoc-chalk-wand', name: '粉笔杖', faction: 'association', slot: 'weapon', tier: 1, price: 560, standingReq: 0,
    description: '协会新人的第一根杖。它最擅长在地上画一个歪掉的圆。', stats: { magic: 4 },
  },
  {
    id: 't1-assoc-lantern-rod', name: '提灯杖', faction: 'association', slot: 'weapon', tier: 1, price: 760, standingReq: 0,
    description: '杖头挂一盏小灯。巡夜的人靠它看清路，也靠它被看清。', stats: { magic: 3, insight: 3 },
  },
  {
    id: 't1-assoc-thread-whip', name: '银线鞭', faction: 'association', slot: 'weapon', tier: 1, price: 820, standingReq: 0,
    description: '一条编进银丝的短鞭。挥动时会在空中留下细细的弧。', stats: { agility: 4 },
  },
  {
    id: 't1-assoc-lamp-charm', name: '小灯符', faction: 'association', slot: 'charm', tier: 1, price: 600, standingReq: 0,
    description: '纸做的灯形护符，里面裹着一粒真的灯芯。它不亮，但握着是温的。', stats: { empathy: 4 },
  },
  {
    id: 't1-assoc-feather-pin', name: '羽毛别针', faction: 'association', slot: 'charm', tier: 1, price: 640, standingReq: 0,
    description: '协会制服上的编号别针，插着一根白色羽毛。', stats: { agility: 3 },
  },
  {
    id: 't1-assoc-sugar-cube', name: '方糖', faction: 'association', slot: 'charm', tier: 1, price: 700, standingReq: 0,
    description: '一块被盘得发圆的方糖。据说是开工第一天揣进口袋的，一直没舍得吃。', stats: { empathy: 2, insight: 2 },
  },
  {
    id: 't1-assoc-bandage', name: '止血绷带', faction: 'association', slot: 'consumable', tier: 1, price: 400, standingReq: 0,
    description: '协会配发的标准绷带，边缘印着小小的星灯徽。恢复 30 点生命。', effect: 'heal', amount: 30,
  },
  {
    id: 't1-assoc-reed-wand', name: '芦苇杖', faction: 'association', slot: 'weapon', tier: 1, price: 520, standingReq: 0,
    description: '河边割的芦苇，晒干后缠了几圈线。它轻得不像武器，但确实是。', stats: { magic: 3, agility: 1 },
  },
  // ── 市役所 ──
  {
    id: 't1-gov-baton', name: '制式短棍', faction: 'government', slot: 'weapon', tier: 1, price: 600, standingReq: 0,
    description: '夜勤课最普通的配发品。棍身刻着编号，磨掉了一半。', stats: { magic: 3, agility: 2 },
  },
  {
    id: 't1-gov-stamp-wand', name: '印章杖', faction: 'government', slot: 'weapon', tier: 1, price: 780, standingReq: 0,
    description: '杖头是一枚印章。市役所的人相信，批过的东西才算真的存在。', stats: { insight: 4 },
  },
  {
    id: 't1-gov-flare-rod', name: '信号棒', faction: 'government', slot: 'weapon', tier: 1, price: 700, standingReq: 0,
    description: '能放出一发冷白色的光。多数时候用来喊人，偶尔用来砸。', stats: { agility: 4 },
  },
  {
    id: 't1-gov-number-tag', name: '编号牌', faction: 'government', slot: 'charm', tier: 1, price: 560, standingReq: 0,
    description: '一块两指宽的铁牌，上面刻着四位数字。夜勤课的人不问你叫什么。', stats: { insight: 3 },
  },
  {
    id: 't1-gov-lead-ring', name: '铅环', faction: 'government', slot: 'charm', tier: 1, price: 620, standingReq: 0,
    description: '沉甸甸的铅环，戴惯了会觉得手指发麻。', stats: { empathy: 3 },
  },
  {
    id: 't1-gov-shift-bell', name: '换班铃', faction: 'government', slot: 'charm', tier: 1, price: 680, standingReq: 0,
    description: '从旧岗亭上拧下来的铜铃。摇一下，就意味着有人该回来了。', stats: { agility: 3 },
  },
  {
    id: 't1-gov-field-kit', name: '勤务包', faction: 'government', slot: 'consumable', tier: 1, price: 480, standingReq: 0,
    description: '一包绷带、一小罐消毒水、一张写着流程的卡片。恢复 30 点生命。', effect: 'heal', amount: 30,
  },
  {
    id: 't1-gov-tin-whistle', name: '铁哨', faction: 'government', slot: 'charm', tier: 1, price: 540, standingReq: 0,
    description: '夜勤课的老式铁哨。吹一下，三条街外都有人回头。', stats: { agility: 3 },
  },
  // ── 原有的四条一阶 ──
  {
    id: 'star-kit', name: '星灯治疗包', faction: 'association', slot: 'consumable', tier: 1, price: 600, standingReq: 0,
    description: '协会配发的便携治疗包。恢复 40 点生命。', effect: 'heal', amount: 40,
  },
  {
    id: 'purify-course', name: '净化课程', faction: 'association', slot: 'consumable', tier: 1, price: 700, standingReq: 0,
    description: '一次由协会导师带领的净化。侵蚀度 −8。', effect: 'purify', amount: 8,
  },
  {
    id: 'permit', name: '执勤许可', faction: 'government', slot: 'consumable', tier: 1, price: 900, standingReq: 0,
    description: '下一次签约金 −10%。', effect: 'contractDiscount', amount: 10,
  },
  {
    id: 'tax-voucher', name: '税补券', faction: 'government', slot: 'consumable', tier: 1, price: 400, standingReq: 0,
    description: '每 7 日可兑换 1,500 星砂。', effect: 'taxRefund', amount: 1500,
  },
];
