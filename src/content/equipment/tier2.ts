import type { Equipment } from '../../types';

/** 二阶：小有积蓄之后。属性 +8…14，约四分之一带一条小被动。 */
export const tier2: Equipment[] = [
  // ── 月蚀庭 ──
  {
    id: 't2-witch-bone-lance', name: '蚀骨长针', faction: 'witch', slot: 'weapon', tier: 2, price: 1400, standingReq: 20,
    description: '足有一臂之长、通体经过硬化防腐处理的骨质刺枪，刃脊处隐现细密铭文，重量配比极具侵略性，枪尖似乎总在不受控地渴望挑向对手咽喉。', stats: { magic: 6, insight: 4 },
  },
  {
    id: 't2-witch-vesper-staff', name: '晚祷杖', faction: 'witch', slot: 'weapon', tier: 2, price: 1900, standingReq: 20,
    description: '杖身刻满了月蚀庭旧式晚祷铭文的古木法杖，念及中段时木纹间便会自主渗出冷光代为诵读，将魔力能级稳步放大。', stats: { magic: 8 },
  },
  {
    id: 't2-witch-blood-salt', name: '血盐瓶', faction: 'witch', slot: 'charm', tier: 2, price: 1600, standingReq: 20,
    description: '装在铅玻璃瓶中的深红高纯度结晶盐，贴在胸口能让紊乱奔涌的心率迅速平复为迟缓坚韧的节律，显著增强对抗精神污染的心防韧性。', stats: { empathy: 8 },
  },
  {
    id: 't2-witch-eclipse-earring', name: '蚀月耳坠', faction: 'witch', slot: 'charm', tier: 2, price: 2000, standingReq: 20,
    description: '以淬火黑铜打制的一弯细长月牙耳坠，当周边空间产生隐秘的恶意因果波动时，耳垂处便会泛起微弱刺痛的预警热流。', stats: { insight: 6, empathy: 4 },
  },
  {
    id: 't2-witch-bitter-draught', name: '蚀血药剂', faction: 'witch', slot: 'consumable', tier: 2, price: 1400, standingReq: 20,
    description: '在暗红玻璃管中密封的深层缓释药剂，服下后如同有一簇冷焰顺着主动脉一路引燃神经，瞬间强效压制创伤，恢复 55 点生命。', effect: 'heal', amount: 55,
  },
  {
    id: 't2-witch-salt-bath', name: '苦盐浴', faction: 'witch', slot: 'consumable', tier: 2, price: 1500, standingReq: 20,
    description: '一包掺杂了微温草药灰烬与高浓度提炼黑盐的调配浸剂，融水后释放出强烈的吸附气味，能迅速中和环境恶质，使辖区污染降低 8 点。', effect: 'purify', amount: 10,
  },
  // ── 星灯协会 ──
  {
    id: 't2-assoc-stitch-staff', name: '星缝长杖', faction: 'association', slot: 'weapon', tier: 2, price: 1600, standingReq: 20,
    description: '杖身以精湛手法嵌入整圈柔韧星纹银丝的长法杖，在挥动时银线如发丝般轻微舒展收紧，让引导而出的法球轨迹格外精密平顺。', stats: { magic: 7, insight: 4 },
  },
  {
    id: 't2-assoc-wick-whip', name: '灯芯鞭', faction: 'association', slot: 'weapon', tier: 2, price: 1800, standingReq: 20,
    description: '以特制浸油棉绳与钢丝绞合而成的长鞭，鞭梢始终拖曳着一星不熄的明亮火苗，破空挥打时如闪电划破暗巷，攻势凌厉迅捷。', stats: { agility: 6, magic: 4 },
  },
  {
    id: 't2-assoc-lamp-brooch', name: '星灯胸针', faction: 'association', slot: 'charm', tier: 2, price: 1700, standingReq: 20,
    description: '星灯协会资深监察员获授的银质提灯浮雕胸针，内部嵌有一粒极其微小的净化晶石，时刻向佩戴者的心智散发着稳定的温润护持。', stats: { empathy: 7 },
  },
  {
    id: 't2-assoc-silver-band', name: '银线手环', faction: 'association', slot: 'charm', tier: 2, price: 1900, standingReq: 20,
    description: '由数根细若游丝的纯银锁链并联编成的手环，贴合手腕脉搏跳动，在施法过载产生反噬时能及时吸收过滤神经杂音。', stats: { agility: 7 },
  },
  {
    id: 't2-assoc-bandage-roll', name: '星灯绷带卷', faction: 'association', slot: 'consumable', tier: 2, price: 1200, standingReq: 20,
    description: '浸透了高阶星露药油的加长防菌绷带卷，散发着安神的薄荷清冷香气，能快速包扎重度割裂伤口，使用后恢复 55 点生命。', effect: 'heal', amount: 55,
  },
  {
    id: 't2-assoc-purify-oil', name: '净灯油', faction: 'association', slot: 'consumable', tier: 2, price: 1600, standingReq: 20,
    description: '装在滴管瓶中的淡金色提炼灯油，滴入受侵蚀的泥土或砖缝便会引燃无烟冷火，高效分解空气中的异象残渣，使辖区污染降低 8 点。', effect: 'purify', amount: 10,
  },
  // ── 市役所 ──
  {
    id: 't2-gov-serial-baton', name: '编号长棍', faction: 'government', slot: 'weapon', tier: 2, price: 1500, standingReq: 20,
    description: '特别勤务课配发给行动队长的加重合金防暴棍，端头带有冲压防滑倒角，挥舞时呼啸破风，在压制暴乱魔物时表现沉重蛮横。', stats: { magic: 5, agility: 5 },
  },
  {
    id: 't2-gov-searchlight', name: '探照杖', faction: 'government', slot: 'weapon', tier: 2, price: 2000, standingReq: 20,
    description: '顶端加装了超高压聚光灯组的重型铝合金法杖，开启时射出一道刺穿百米浓雾的耀眼笔直光柱，在开阔地带排查隐匿目标时无所遁形。', stats: { insight: 8 },
  },
  {
    id: 't2-gov-suppress-rod', name: '镇压杖', faction: 'government', slot: 'weapon', tier: 2, price: 2100, standingReq: 20,
    description: '棍身内置压电储能环的高压约束器械，接触瞬间向目标神经爆发出强烈麻痹电弧，大幅削弱对方的攻击协调性。', stats: { magic: 9 },
  },
  {
    id: 't2-gov-shift-band', name: '夜勤袖章', faction: 'government', slot: 'charm', tier: 2, price: 1500, standingReq: 20,
    description: '由荧光红白反光织物缝制的夜巡执勤袖章，内衬绣有急救流程指示图，在混乱黑夜中不仅便于队友定位，更给予佩戴者深厚的安全感。', stats: { insight: 6, empathy: 4 },
  },
  {
    id: 't2-gov-first-aid', name: '急救针', faction: 'government', slot: 'consumable', tier: 2, price: 1300, standingReq: 20,
    description: '装在耐压铝筒内的全自动弹簧推注急救针，能在战线危急关头强行将神经兴奋剂与凝血素打入体内，使用后恢复 55 点生命。', effect: 'heal', amount: 55,
  },
  {
    id: 't2-gov-decon-spray', name: '除染喷雾', faction: 'government', slot: 'consumable', tier: 2, price: 1500, standingReq: 20,
    description: '市役所清扫队专用的便携高压除染喷雾罐，喷洒出的乳白色泡沫能迅速中和街角堆积的畸变腐糖与酸液，使辖区污染降低 8 点。', effect: 'purify', amount: 10,
  },
  {
    id: 't2-gov-ration-voucher', name: '夜勤补给券', faction: 'government', slot: 'consumable', tier: 2, price: 1400, standingReq: 20,
    description: '盖有后勤课红色印章的夜勤紧急物资调拨券，可在各哨所补给点临时换取压缩给养与抗蚀药物，使用后恢复 55 点生命。', effect: 'contractDiscount', amount: 15,
  },
  // ── 原有的五条二阶 ──
  {
    id: 'silver-wand', name: '银线法器', faction: 'association', slot: 'weapon', tier: 2, price: 2200, standingReq: 20,
    description: '由纯度极高的深层银矿锻打拉丝制成的法器短杖，对细微魔力波动的响应灵敏至极，能显著缩短术式构筑的前摇间隙。',
    stats: { magic: 7, insight: 4 },
  },
  {
    id: 'association-badge', name: '协会徽章', faction: 'association', slot: 'charm', tier: 2, price: 2200, standingReq: 20,
    description: '铸刻着古典灯塔徽记的协会纯银胸章，别在领口内侧时能稳定核心心智节律，使心防屏障在承受暴击时更不易产生裂隙。',
    stats: { empathy: 4 }, spiritBonusPct: 15, passive: '心防上限 +15%',
  },
  {
    id: 'black-sugar', name: '黑糖护符', faction: 'witch', slot: 'charm', tier: 2, price: 1800, standingReq: 20,
    description: '一块经过特殊脱水凝固、表面泛着金属冷光的暗黑硬糖，含在舌底时微咸的苦味直冲颅顶，极大地增强了神智对重压的耐受极限。',
    stats: { empathy: 8 }, spiritBonusPct: 10, passive: '心防上限 +10%',
  },
  {
    id: 'riot-charm', name: '防暴护符', faction: 'government', slot: 'charm', tier: 2, price: 1500, standingReq: 20,
    description: '以高强度防爆纤维包裹铅芯制成的制式便携护符，重量感十足，贴胸悬挂时能有效缓冲外力钝击，为肉体提供坚实的生命承载加成。',
    stats: { empathy: 4 }, maxHpBonus: 16, passive: '生命上限 +16',
  },
  {
    id: 'pocket-watch', name: '市役所怀表', faction: 'government', slot: 'charm', tier: 2, price: 2100, standingReq: 20,
    description: '市役所老专员常用的旧式发条怀表，走针极其严准平稳，开盖瞬间发条运转的节奏能帮助契约者在开局第一拍迅速锁定战局破绽。',
    stats: { agility: 5, insight: 2 }, initiativeBonus: 4, passive: '首轮洞察 +4',
  },
];
