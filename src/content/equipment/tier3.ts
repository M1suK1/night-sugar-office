import type { Equipment } from '../../types';

/** 三阶：协会/市役所愿意为常客打开柜子。属性 +14…22，必有一条被动。 */
export const tier3: Equipment[] = [
  // ── 月蚀庭 ──
  {
    id: 't3-witch-eclipse-staff', name: '蚀月长杖', faction: 'witch', slot: 'weapon', tier: 3, price: 3200, standingReq: 35,
    description: '杖头牢牢卡死着一小块取自深渊异变核心的黑色蚀月残片，举起施术时周围物体的投影会发生轻微扭曲偏移，使法术杀伤附带侵蚀穿透。',
    stats: { magic: 12, insight: 6 }, passive: '造成伤害 +8%', damageBonus: 8,
  },
  {
    id: 't3-witch-night-thorn', name: '夜棘鞭', faction: 'witch', slot: 'weapon', tier: 3, price: 3600, standingReq: 35,
    description: '自极深污染泥潭中采割的多年生铁荆棘编织而成的长鞭，每一枚倒刺上都凝结着风化发黑的毒素，挥动瞬间破空声如毒蛇吐信般凌厉。',
    stats: { magic: 9, agility: 8 }, passive: '首轮洞察 +4', initiativeBonus: 4,
  },
  {
    id: 't3-witch-moonveil', name: '月蚀面纱', faction: 'witch', slot: 'charm', tier: 3, price: 2800, standingReq: 35,
    description: '由细密暗色水银丝线织就的半透明面纱，佩戴者面容在旁人眼中如同隔着流淌雨幕般模糊不可辨识，提供坚实的心智偏折遮蔽。',
    stats: { empathy: 10, insight: 5 }, passive: '心防上限 +12%', spiritBonusPct: 12,
  },
  {
    id: 't3-witch-cinder-ring', name: '余烬指环', faction: 'witch', slot: 'charm', tier: 3, price: 3000, standingReq: 35,
    description: '通体焦黑且布满不可修复细密裂痕的旧式金属指环，贴肉佩戴时时刻泛出微弱灼烫，以轻微过载为代价强行榨取法术的狂暴破坏力。',
    stats: { magic: 8, empathy: 7 }, passive: '每场战斗侵蚀 +1（换取伤害）', corruptionPerBattle: 1, damageBonus: 5,
  },
  {
    id: 't3-witch-black-mass', name: '黑弥撒', faction: 'witch', slot: 'consumable', tier: 3, price: 2900, standingReq: 35,
    description: '在极低温冰盒中封存的深紫色高纯度生物提取针剂，专用于在契约者濒临崩溃边缘时强行稳固灵魂锚点，使用后恢复 90 点生命。', effect: 'heal', amount: 90,
  },
  {
    id: 't3-witch-eclipse-salt', name: '蚀月盐', faction: 'witch', slot: 'consumable', tier: 3, price: 3100, standingReq: 35,
    description: '提炼自灾厄异象结晶核心的高浓缩黑盐，抛洒在污染严重的街心会剧烈沸腾变黑吸附异化残渣，使辖区污染大幅降低 16 点。', effect: 'purify', amount: 16,
  },
  // ── 星灯协会 ──
  {
    id: 't3-assoc-starweave', name: '星织长杖', faction: 'association', slot: 'weapon', tier: 3, price: 3400, standingReq: 35,
    description: '法杖全长以繁复的星图轨迹精密穿引纯银细线，每一次强力施术，银丝都会如同活物般轻微震颤调谐，将法力束流聚焦得极其收束凝聚。',
    stats: { magic: 11, insight: 8 }, passive: '造成伤害 +7%', damageBonus: 7,
  },
  {
    id: 't3-assoc-lantern-flail', name: '提灯链锤', faction: 'association', slot: 'weapon', tier: 3, price: 3300, standingReq: 35,
    description: '由镀银铰链连接黄铜防风提灯的重型打击兵器，链锤在空中疾旋呼啸时灯火依然明亮灼热，砸向敌阵时声势沉浑夺目。',
    stats: { agility: 10, magic: 7 }, passive: '首轮洞察 +4', initiativeBonus: 4,
  },
  {
    id: 't3-assoc-choir-ribbon', name: '合唱缎带', faction: 'association', slot: 'charm', tier: 3, price: 2900, standingReq: 35,
    description: '星灯协会圣咏队传承多年的厚重宽幅缎带，系在腰际随风轻扬，在生死关头高声发令时，仿佛冥冥中有历代先辈在为你的意志低声和鸣。',
    stats: { empathy: 11, insight: 5 }, passive: '心防上限 +12%', spiritBonusPct: 12,
  },
  {
    id: 't3-assoc-keeper-gloves', name: '守夜手套', faction: 'association', slot: 'charm', tier: 3, price: 2700, standingReq: 35,
    description: '指关节处反复加固缝补的皮革守夜手套，内衬嵌有保暖法印，戴着它无论握持多么冰冷的铁器都不会丧失神经感知，提供坚实体魄加成。',
    stats: { empathy: 8, magic: 6 }, passive: '生命上限 +18', maxHpBonus: 18,
  },
  {
    id: 't3-assoc-healing-light', name: '疗愈灯油', faction: 'association', slot: 'consumable', tier: 3, price: 2600, standingReq: 35,
    description: '调和了高纯度净化精油的浓缩药瓶，涂抹在深层创面处会泛起柔和的淡金色微光，能高效弥合筋骨创痛，使用后恢复 90 点生命。', effect: 'heal', amount: 90,
  },
  {
    id: 't3-gov-purify-rite', name: '净化仪典', faction: 'government', slot: 'consumable', tier: 3, price: 3000, standingReq: 35,
    description: '经由市役所严格审核审批的小型净化仪式套件，通过三方专员联手布设符印迅速压制重度污染残留，使辖区污染大幅降低 16 点。', effect: 'purify', amount: 16,
  },
  // ── 市役所 ──
  {
    id: 't3-gov-riot-rod', name: '镇暴长杖', faction: 'government', slot: 'weapon', tier: 3, price: 3500, standingReq: 35,
    description: '市役所军械库封存特批的重型合金长杖，杖头加配了惯性增压模块，轰落时的声响低沉发闷，在阵地战中具备可怕的阻滞破坏力。',
    stats: { magic: 13, agility: 6 }, passive: '造成伤害 +8%', damageBonus: 8,
  },
  {
    id: 't3-gov-archive-blade', name: '归档刃', faction: 'government', slot: 'weapon', tier: 3, price: 3700, standingReq: 35,
    description: '刃身薄如信纸、经过哑光涂层处理的冷钢战术直刃，挥斩时几乎没有任何空气割裂声，擅长以极其刁钻的速度在开战首回合切中要害。',
    stats: { insight: 11, magic: 8 }, passive: '首轮洞察 +5', initiativeBonus: 5,
  },
  {
    id: 't3-gov-duty-plate', name: '夜勤胸甲', faction: 'government', slot: 'charm', tier: 3, price: 2800, standingReq: 35,
    description: '由高强度特种合金冲压成型的双层防弹胸甲，内侧铭牌工整蚀刻着上一任殉职专员的档案编码，为身躯提供极为可靠的承重与生命保护。',
    stats: { empathy: 9, insight: 6 }, passive: '生命上限 +20', maxHpBonus: 20,
  },
  // ── 原有的三阶 ──
  {
    id: 'moon-drug', name: '月蚀抑制剂', faction: 'witch', slot: 'consumable', tier: 3, price: 2800, standingReq: 35,
    description: '月蚀庭药房在冰柜底层珍藏的特级高纯度紫色针剂，专用于在灵魂侵蚀越过临界点时强行锁住神智残余，令契约者在十日内维系清醒自我。', effect: 'drug', amount: 10,
  },
];
