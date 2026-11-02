import type { MonsterTemplate } from '../types';
import { extraMonsters } from './monsters-extra.ts';
import { magicalMonsters } from './monsters-magical.ts';

export const monsters: MonsterTemplate[] = [
  {
    id: 'night-tram', name: '末班车', epithet: '第十三号盲端站台的回声', rank: '灾厄', element: '月影系', color: '#79C7C9',
    maxHp: 240, maxSpirit: 120,
    stats: { magic: 82, insight: 78, agility: 74, empathy: 40 },
    skillIds: ['monster-claw', 'monster-scream', 'monster-static'],
    trait: '每轮结束时若未陷入眩晕，受电弓电弧过载，速度提高 4。',
    description: '一节通体漆黑、锈蚀严重的无编号电车，总在午夜两点后突兀滑入早已废弃的岔道。车厢内泛着惨绿色的管灯杂波，靠窗座位上整齐端坐着失去面部轮廓的乘客残影，在铁轨尖锐的摩擦嘶鸣中，机械地等待着永远无法抵达的下一站。',
    spec: { bodyPlan: 'machine', scale: 1.08, appendages: 6, core: '钟', palette: { body: '#1E3A3E', shade: '#0E2023', rim: '#A8E4E2' }, aura: '故障', motif: '钟' },
    codex: { habit: '通常仅在整点前后的深雾时刻出没，沿着星见川两岸断裂的旧铁轨低速巡弋，将沿途滞留者的呼吸声卷入车厢。', weakness: '车头那盏开裂的高压弧光灯是其感知核心，避开正面直射、自车厢侧翼或受电弓接点发起冲击能有效阻滞其机动。' },
    rules: [{ trigger: 'roundStart', effect: 'haste', amount: 4 }],
  },
  {
    id: 'echo-cat', name: '回声猫', epithet: '剥蚀名字的巷尾窃听者', rank: '游荡', element: '梦境系', color: '#C7A7E8',
    maxHp: 130, maxSpirit: 90,
    stats: { magic: 60, insight: 72, agility: 88, empathy: 55 },
    skillIds: ['monster-claw', 'monster-scream'],
    trait: '被击中时散发刺耳回声干扰，攻击者命中率下降 4，持续 1 轮。',
    description: '由巷弄深处的空气振颤与无数窃窃私语聚合成形的畸变灵体，通体泛着重叠模糊的淡紫微光。它在废弃店面与雨棚钢梁间无声穿梭，擅长捕捉过路人留在砖缝里的残存心声；每当它在昏暗街角试探着念出你的真名时，音调与喉底微弱的喘息比你自己的声带还要逼真数倍。',
    spec: { bodyPlan: 'feline', scale: 0.82, appendages: 4, core: '月', palette: { body: '#3A2B4E', shade: '#1B1428', rim: '#D9C2F2' }, aura: '静电', motif: '猫' },
    codex: { habit: '出没于居民区狭窄逼仄的防火巷道，极度热衷于收集被市民在争执或梦呓中不慎遗落的称呼与小名。', weakness: '对坚定清晰的真名呼唤极其敏感，一旦被契约者以纯净共情正面喝破本质，其回声结构便会迅速震颤涣散。' },
    rules: [{ trigger: 'hit', effect: 'debuffAttacker', stat: 'hit', amount: 4, duration: 2 }],
  },
  {
    id: 'mirror-nun', name: '镜修女', epithet: '万花筒圣咏的折射残响', rank: '灾厄', element: '月影系', color: '#9FB4E8',
    maxHp: 280, maxSpirit: 160,
    stats: { magic: 86, insight: 84, agility: 62, empathy: 52 },
    skillIds: ['monster-claw', 'monster-mirror', 'monster-mosaic'],
    trait: '每有 1 面护卫镜片存活，受到的首次直接伤害减免 15%。',
    description: '孤立于废弃教堂镜厅中央的修长人形异象，头罩下垂落着由碎水银镜片拼凑而成的重叠面纱。她向着空无一人的主祭坛双手合十低沉祝祷，祷词反复折射回荡，化作撕裂耳膜的玻璃刮擦声，而在周遭层叠的倒影之中，无数个背对众生的虚相正悄然举起尖锐的碎镜利刃。',
    spec: { bodyPlan: 'humanoid', scale: 1.0, appendages: 2, core: '眼', palette: { body: '#232B45', shade: '#12172A', rim: '#C6D3FF' }, aura: '故障', motif: '月' },
    codex: { habit: '徘徊于旧教堂镜厅及周边高反射建筑内部，强迫踏入光线折射范围内的生物加入其永无休止的唱诗仪式。', weakness: '无法承受未经扭曲的真实视线注视，以钝击强行震碎其身侧的折射主镜，将诱发其法术回路发生毁灭性反噬。' },
    rules: [{ trigger: 'always', effect: 'damageReduce', amount: 15 }],
  },
  {
    id: 'candy-king', name: '糖王', epithet: '盘踞在废墟王座上的蛀蚀者', rank: '王座', element: '糖霜系', color: '#F49ABD',
    maxHp: 360, maxSpirit: 150,
    stats: { magic: 90, insight: 70, agility: 58, empathy: 72 },
    skillIds: ['monster-claw', 'monster-sweet-decree', 'monster-dissolve'],
    trait: '每轮恢复 6 点血量，除非本回合受到带有共情穿透的心智伤害。',
    description: '曾作为糖果街庆典象征的巨大石膏吉祥物，在经年累月的欲望侵蚀下异化为可怖的贪食实体。庞大的身躯瘫陷于黏稠斑驳的宝座之中，皲裂的胸腔内不断鼓胀出恶质的结晶糖浆，无数早已风化的市民心愿被它塞入层叠的利齿深处，咀嚼成剥夺味觉与生机的苍白迷雾。',
    spec: { bodyPlan: 'humanoid', scale: 1.28, appendages: 5, core: '糖', palette: { body: '#5A1F36', shade: '#2B0E1B', rim: '#FFC7DE' }, aura: '花瓣', motif: '糖' },
    codex: { habit: '常年盘踞于废弃游乐场的中央大厅，如水泵般源源不断抽吸整条商业街遗留的香精气息与狂热残留。', weakness: '糖壳外层高度依赖执念维持硬度，共情属性的穿透攻击能够直接撼动其核心心智，彻底打断其糖分自愈机制。' },
    rules: [{ trigger: 'roundStart', effect: 'heal', amount: 6, unlessEmpathyDamage: true }],
  },
  {
    id: 'sugar-moth', name: '糖蛾', epithet: '变电网失眠杂波的鳞粉群', rank: '碎屑', element: '糖霜系', color: '#F7C9DC',
    maxHp: 95, maxSpirit: 70,
    stats: { magic: 56, insight: 66, agility: 80, empathy: 48 },
    skillIds: ['monster-claw', 'monster-scales'],
    trait: '被击中时向攻击者散播 6 点灼热结晶持续伤害，持续 1 轮。',
    description: '自过载短路的电光招牌缝隙中密集孵化的异化飞蛾，薄如蝉翼的双翅上分布着如电视无信号雪花般的微光杂斑。成群振翅时会散发高温甜香与微量静电，它们所抖落的炽热鳞粉一旦附着在皮肉上，便会迅速吸附体温并结晶为难以剥离的刺痛糖斑。',
    spec: { bodyPlan: 'moth', scale: 0.78, appendages: 4, core: '糖', palette: { body: '#4A2E3E', shade: '#251520', rim: '#FFD7E8' }, aura: '花瓣', motif: '蝶' },
    codex: { habit: '极度嗜好高压霓虹灯管的电热，常常在深夜三点围绕着闪烁的招牌狂乱盘旋，啃食过饱和的冷白灯光。', weakness: '对环境温度骤降极不耐受，遭遇霜冷法术打击时鳞粉会迅速失去黏性，失去飞行浮力跌落。' },
    rules: [{ trigger: 'hit', effect: 'dot', amount: 6, duration: 1 }],
  },
  {
    id: 'hollow-moon', name: '空月', epithet: '抹去背面投影的高维蚀核', rank: '王座', element: '星光系', color: '#C9C4FF', storyOnly: true,
    maxHp: 420, maxSpirit: 200,
    stats: { magic: 96, insight: 92, agility: 50, empathy: 64 },
    skillIds: ['boss-hollow-veil', 'boss-tide-of-names', 'boss-sugar-crown', 'boss-mirror-litany'],
    trait: '意志绝对稳固、免疫眩晕；每轮开始时若血量低于半数，深渊引力过载，魔力提高 8。',
    description: '它并非悬挂在苍穹上的自然实体，而是城市理性秩序缺席时撕裂开的虚无空洞。没有背面、没有纹理，唯有一轮冰冷深邃的平整白环静静俯视众生；所有不慎与其轮廓对视的生灵，都会在短短数秒内丧失记忆与思考的连贯性，任由灵魂本源被深渊无声分解。',
    spec: { bodyPlan: 'orb', scale: 1.34, appendages: 3, core: '月', palette: { body: '#1B1830', shade: '#0A0818', rim: '#E4DFFF' }, aura: '余烬', motif: '星' },
    codex: { habit: '悬浮停滞于旧钟楼尖顶的虚空坐标，以极微小的曲率扭曲全城影子的延伸朝向与魔力回路。', weakness: '唯有精神洞察极高的老练契约者方能在其刺目的冷光边缘，捕捉到底层结构那道不可自愈的裂缝缺陷。' },
    rules: [{ trigger: 'always', effect: 'immuneStun' }, { trigger: 'roundStart', effect: 'buff', stat: 'magic', amount: 8, belowHpPct: 0.5 }],
    bossSkillIds: ['boss-hollow-veil', 'boss-tide-of-names', 'boss-sugar-crown', 'boss-mirror-litany'],
    bossPhaseSkillIds: ['boss-second-moon', 'boss-collapse', 'boss-clock-hands', 'boss-name-erasure'],
  },
  {
    id: 'candy-throne', name: '糖霜王座', epithet: '自我册封与剥夺的甜腻深渊', rank: '王座', element: '糖霜系', color: '#F2A0C0',
    bossOnly: true,
    maxHp: 2400, maxSpirit: 360,
    stats: { magic: 96, insight: 88, agility: 72, empathy: 180 },
    skillIds: ['boss-sugar-crown', 'boss-clock-hands'],
    trait: '三阶段天灾首领：血量降至 62% 与 30% 时变阵，二阶段将召唤两只糖蛾助战，每轮自愈 12 点生命。',
    description: '在甜味被彻底抽离的深夜，废弃游乐场的这尊畸形造物正贪婪地抽取着整座城市的神经快感。它将王座的椅腿扎入地下配电干线，以结晶糖霜为自己铸造起层层高耸的假冠；端坐其上的非人意志正发出贪婪的吞咽声，把整条街区的温暖幻觉转化为致人窒息的流淌胶质。',
    spec: { bodyPlan: 'machine', scale: 1.38, appendages: 6, core: '糖', palette: { body: '#5A1F36', shade: '#2B0E1B', rim: '#FFC7DE' }, aura: '花瓣', motif: '糖' },
    codex: { habit: '把周边辖区的所有糖分沉淀强行汇聚至王座底盘，再通过脉冲般的甜雾反哺顶冠的防御结界。', weakness: '底座受力结构极为沉重笨拙，集中火力切断其与地表管道连接的支撑椅脚，比正面轰击顶冠更为奏效。' },
    rules: [{ trigger: 'roundStart', effect: 'heal', amount: 12 }],
  },
  ...extraMonsters,
  ...magicalMonsters,
];
export const monsterById = new Map(monsters.map(m => [m.id, m]));
/** 严格查询：找不到就返回 undefined，调用方可以把这条引用当作失效内容处理。 */
export function findMonster(id: string | undefined): MonsterTemplate | undefined {
  return id ? monsterById.get(id) : undefined;
}
export function getMonster(id: string): MonsterTemplate {
  return findMonster(id) ?? monsters[0];
}
export const rankOrder = ['碎屑', '游荡', '灾厄', '王座'] as const;
