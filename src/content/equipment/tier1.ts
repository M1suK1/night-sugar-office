import type { Equipment } from '../../types';

/** 一阶：街面上买得到的东西。属性 +4…8，没有被动。 */
export const tier1: Equipment[] = [
  // ── 月蚀庭 ──
  {
    id: 't1-witch-thorn-wand', name: '荆棘短杖', faction: 'witch', slot: 'weapon', tier: 1, price: 620, standingReq: 0,
    description: '从月蚀庭旧苗圃废墟深处劈取的黑色硬木枝桠，外部细密缠绕着尚未枯死的铁质荆棘。木柄未经打磨，握持时尖刺会刺破掌心，但微弱刺痛反而能敏锐唤醒杀意。', stats: { magic: 4 },
  },
  {
    id: 't1-witch-bone-needle', name: '骨针', faction: 'witch', slot: 'weapon', tier: 1, price: 780, standingReq: 0,
    description: '以未知生物的指骨精细打磨而成的锋锐骨针，尖端带着常年浸泡苦盐药液的微黄色泽。以魔力引线穿刺时，针尖似乎总能自主顺着皮肉与结界最脆弱的缝隙滑入。', stats: { magic: 3, insight: 2 },
  },
  {
    id: 't1-witch-cinder-staff', name: '余烬杖', faction: 'witch', slot: 'weapon', tier: 1, price: 880, standingReq: 0,
    description: '削自焦黑断木的朴素长杖，顶端嵌着的一点余烬终年泛着微弱暗红。它从不提供照明，但在近身挥击时能迸发出呛人的焦木青烟与高温灼痕。', stats: { magic: 5 },
  },
  {
    id: 't1-witch-black-salt', name: '黑盐袋', faction: 'witch', slot: 'charm', tier: 1, price: 520, standingReq: 0,
    description: '以粗糙麻布缝制的小口袋，内部盛满了在药釜深处反复翻炒过的黑盐晶粒。月蚀庭的巡夜人坚信，干燥的盐粒能吸附空气中残留的悲恸气息。', stats: { empathy: 3 },
  },
  {
    id: 't1-witch-eclipse-token', name: '蚀纹小牌', faction: 'witch', slot: 'charm', tier: 1, price: 640, standingReq: 0,
    description: '一枚阴刻着半个遮蔽日轮图案的泛绿黄铜腰牌，边缘常年被粗粝手掌摩挲得锃亮圆润。贴身佩戴时，在暗处能微弱映照出异常因果的延伸痕迹。', stats: { insight: 3 },
  },
  {
    id: 't1-witch-moth-wing', name: '蛾翅夹', faction: 'witch', slot: 'charm', tier: 1, price: 700, standingReq: 0,
    description: '以生锈钢夹固定的巨大异化糖蛾标本残翅，薄膜上密布着微温的静电脉络。在午夜风起时偶尔会自发轻微颤抖，为疾步前行的佩戴者提供微妙的浮空轻盈感。', stats: { agility: 3 },
  },
  {
    id: 't1-witch-bitter-syrup', name: '苦糖浆', faction: 'witch', slot: 'consumable', tier: 1, price: 420, standingReq: 0,
    description: '密封在深色小药瓶里的黏稠黑色药浆，入口时泛着浓重苦涩与如吞锈铁般的腥甜。能够强行刺激受创神经，使用后恢复 30 点生命。', effect: 'heal', amount: 30,
  },
  {
    id: 't1-witch-thorn-censer', name: '荆棘香囊', faction: 'witch', slot: 'charm', tier: 1, price: 560, standingReq: 0,
    description: '将风干的尖刺荆棘与草药残渣密密缝入粗布的小香囊，散发着微酸刺鼻的草木苦气，能帮助巡夜队员在浓浊污染前保持呼吸道畅通。', stats: { insight: 2, empathy: 1 },
  },
  // ── 星灯协会 ──
  {
    id: 't1-assoc-chalk-wand', name: '粉笔杖', faction: 'association', slot: 'weapon', tier: 1, price: 560, standingReq: 0,
    description: '星灯协会分发给见习结界师的标准制式短杖，笔端由高纯度凝固白垩岩削磨而成，在石砖路面上迅速圈划出应急防御环阵时手感平稳顺滑。', stats: { magic: 4 },
  },
  {
    id: 't1-assoc-lantern-rod', name: '提灯杖', faction: 'association', slot: 'weapon', tier: 1, price: 760, standingReq: 0,
    description: '顶端悬挂着黄铜防风煤油小灯的实木巡夜长杖。它摇曳出的微黄光晕虽无法照彻整条长街，却足以让雨雾中并肩涉水的守夜队员看清彼此的防守方位。', stats: { magic: 3, insight: 3 },
  },
  {
    id: 't1-assoc-thread-whip', name: '银线鞭', faction: 'association', slot: 'weapon', tier: 1, price: 820, standingReq: 0,
    description: '由数十股韧性极佳的纯银丝线编结而成的短鞭，在雨幕中破空挥动时会撕开细细的冷白电离弧光，专用于轻捷地牵制游荡怪异的关节。', stats: { agility: 4 },
  },
  {
    id: 't1-assoc-lamp-charm', name: '小灯符', faction: 'association', slot: 'charm', tier: 1, price: 600, standingReq: 0,
    description: '以防水油纸折叠成的小灯形护符，夹层里封着一小截被浸润过的温热灯芯。握在掌心时始终散发着稳定的体温，安抚着受惊动摇的共情心神。', stats: { empathy: 4 },
  },
  {
    id: 't1-assoc-feather-pin', name: '羽毛别针', faction: 'association', slot: 'charm', tier: 1, price: 640, standingReq: 0,
    description: '别在协会执勤风衣领口上的金属长针，末端缀着一根取自守夜鸥羽翼的灰白羽毛，能有效梳理周身紊乱的气流阻力。', stats: { agility: 3 },
  },
  {
    id: 't1-assoc-sugar-cube', name: '方糖', faction: 'association', slot: 'charm', tier: 1, price: 700, standingReq: 0,
    description: '一枚在值班大衣口袋里被盘磨得边缘圆润的干瘪方糖，是老队员入行受训时领到的开工信物，带给人细微而切实的安慰。', stats: { empathy: 2, insight: 2 },
  },
  {
    id: 't1-assoc-bandage', name: '止血绷带', faction: 'association', slot: 'consumable', tier: 1, price: 400, standingReq: 0,
    description: '协会后勤处统一调拨的高密度棉织急救绷带，边缘印着淡粉色的星灯纹记，浸润了低阶止痛药液，使用后恢复 30 点生命。', effect: 'heal', amount: 30,
  },
  {
    id: 't1-assoc-reed-wand', name: '芦苇杖', faction: 'association', slot: 'weapon', tier: 1, price: 520, standingReq: 0,
    description: '自星见川河畔人工芦苇丛收割晒干的轻质木杖，以银丝紧密扎束防裂。握持手感轻盈若无物，在短距离闪转施术时动作格外敏捷。', stats: { magic: 3, agility: 1 },
  },
  // ── 市役所 ──
  {
    id: 't1-gov-baton', name: '制式短棍', faction: 'government', slot: 'weapon', tier: 1, price: 600, standingReq: 0,
    description: '市役所特别勤务课配发的基础防暴短棍，黑色防滑握把底端刻着早已被磨平大半的警备工号，沉重扎实、专为近身压制而生。', stats: { magic: 3, agility: 2 },
  },
  {
    id: 't1-gov-stamp-wand', name: '印章杖', faction: 'government', slot: 'weapon', tier: 1, price: 780, standingReq: 0,
    description: '长杖顶端焊装着四方重型钢印，本是夜班巡逻时在封条上加盖批号的工具，在混乱巷战中亦能充当势大力沉的破甲钝器。', stats: { insight: 4 },
  },
  {
    id: 't1-gov-flare-rod', name: '信号棒', faction: 'government', slot: 'weapon', tier: 1, price: 700, standingReq: 0,
    description: '内藏镁铝合金引火剂的合金短棒，挥击时沿途划擦出刺目白灼的应急警示火光，能短时间内强行致盲并震慑靠近的阴暗怪异。', stats: { agility: 4 },
  },
  {
    id: 't1-gov-number-tag', name: '编号牌', faction: 'government', slot: 'charm', tier: 1, price: 560, standingReq: 0,
    description: '由冷轧铅铝合金冲压制成的椭圆工号识别牌，挂在脖颈上沉甸甸贴着胸口，时刻提醒着契约者保持绝对严谨的执勤秩序感。', stats: { insight: 3 },
  },
  {
    id: 't1-gov-lead-ring', name: '铅环', faction: 'government', slot: 'charm', tier: 1, price: 620, standingReq: 0,
    description: '内径粗糙厚实的铅合金指环，重量沉坠，以金属的冰冷沉重强行压制体表不安的魔力脉冲，赋予双手坚实的手感稳定性。', stats: { empathy: 3 },
  },
  {
    id: 't1-gov-shift-bell', name: '换班铃', faction: 'government', slot: 'charm', tier: 1, price: 680, standingReq: 0,
    description: '换班时在值班室廊道敲响的铜质手摇铃，清脆单调的金属撞击声能强行驱散凌晨时分盘旋不去的迟钝睡意。', stats: { agility: 3 },
  },
  {
    id: 't1-gov-field-kit', name: '勤务包', faction: 'government', slot: 'consumable', tier: 1, price: 480, standingReq: 0,
    description: '装在硬质帆布盒内的夜勤标准应急医疗包，包含压脉带、止血粉与无菌纱布，使用后恢复 30 点生命。', effect: 'heal', amount: 30,
  },
  {
    id: 't1-gov-tin-whistle', name: '铁哨', faction: 'government', slot: 'charm', tier: 1, price: 540, standingReq: 0,
    description: '冲压马口铁小哨子，哨嘴磨损严重，吹响时能穿透雨声与警报发出尖锐破空的警戒颤音，在暗处赋予同伴无声的默契定位。', stats: { agility: 3 },
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
