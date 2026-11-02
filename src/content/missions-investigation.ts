import type { Mission } from '../types.ts';

/**
 * v42 扩充的调查委托（10 条）。
 *
 * 与 seed-pack 的 3 条（candy、cat、tower）及 extraMissions 的 3 条
 * （lost-ticket、sweet-ledger、bell-count）合计凑满 16 条完整调查委托矩阵。
 * 覆盖四级难度：低危 4 / 中危 5 / 高危 5 / 绝望 2，均衡考核魔力、洞察、敏捷、共情。
 */
export const extraInvestigationMissions: Mission[] = [
  // ── 低危 ──
  {
    id: 'music-box-leak', title: '走失的发条八音盒', category: '市民求助',
    description: '玻璃温室管理处的老花匠在拂晓交班时发现，自己珍藏多年的黄铜八音盒不知何时自行拧紧了发条，蹦跳着穿过通风百叶窗潜入了热带灌木深处。温室内的多株感应蕨类叶片正伴随微弱的单音节奏规律颤动，若不尽快顺着声响轨迹敏捷绕过荆棘陷阱将其回收，发条耗尽崩裂时微弱的思念结晶将被泥土彻底稀释。',
    x: 50, y: 50, difficulty: '低危', duration: 35, reward: 460, requirement: 'agility', target: 66, color: '#A0D8B8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 2,
  },

  // ── 中危 ──
  {
    id: 'rain-gauge', title: '逆流的雨量计', category: '异象调查',
    description: '星见川水文观测站的特种铜质雨量计在连绵阴雨中录得了倒流数据。积水漏斗非但没有蓄积雨水，反而如泉眼般不断向上空喷吐泛着微甜气泡的粉白水汽；周围百米内的重力参数轻微失衡，雨丝呈现反常的自下而上漂浮轨迹。需要身手矫捷的调查员在失重水滴间快速穿梭，校准被异常因果倒置的刻度浮标。',
    x: 50, y: 50, difficulty: '中危', duration: 55, reward: 790, requirement: 'agility', target: 75, color: '#90C8D8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'wax-diary', title: '浸蜡的空白日记', category: '心愿回收',
    description: '市立图书馆古籍修复室内的一本厚重牛皮纸日记，被多层厚实的红色封蜡严密浇铸包裹。在无风的深夜，日记内页会隔着封蜡透出微弱的光影翻动声，隐约投射出一名少女在窗前写下心愿又反复涂黑的模糊笔画。唯有以极度细致入微的洞察力隔空解析封蜡下的灵能震颤，方能在不损毁纸张的前提下拓印出日记真正主人的未竟之愿。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 820, requirement: 'insight', target: 78, color: '#D8B898',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 4,
  },

  // ── 高危 ──
  {
    id: 'gravity-hall', title: '颠倒的重力回廊', category: '异象调查',
    description: '北岸旧桥隧道的中央防空支洞内发生了剧烈的空间曲率滑塌。原本铺设在地面的检修铁轨被生生剥离反转悬挂于穹顶之上，水泵排出的废水在头顶倒悬成一条奔涌暗河；穿过隧道的脚步声会被放大数十倍并在天花板与墙壁间狂乱反弹。调查员必须在颠倒翻转的失衡通道中克服剧烈前庭眩晕，摸索寻获扭曲重力场的锚定符石。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1150, requirement: 'agility', target: 82, color: '#B0A0D0',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'faded-monument', title: '褪色的誓言碑文', category: '心愿回收',
    description: '旧城区中心广场边缘矗立的无名守护者纪念碑，碑面雕刻的先烈名字正在被某种恶意的时间霉菌迅速侵蚀剥落。每当一笔字迹被风化抚平，整座街区的一段集体记忆便随之陷入空白，已有数位老者遗忘了自己挚友的容貌。必须调动极为深沉柔和的共情回路注入石碑基座，与石缝中残存的执念温存共鸣，抢救性唤醒即将沉底的城市记忆。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1220, requirement: 'empathy', target: 83, color: '#C8A8B8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'frozen-second', title: '静止的第三秒钟', category: '异象调查',
    description: '旧钟楼下方交警执勤岗亭的时钟在午夜三点零三分的第三秒突兀卡死停摆。以岗亭为中心方圆二十米的圆形区域内，一切分子热运动与空气流动皆被绝对锁死在静止的一瞬：悬空的水滴凝固如钻石、飘落的枯叶硬如铁片，踏入其中的生物神经传导亦将陷入完全停滞。唯有以极高能级的纯净魔力强行共振震碎时间冰壳，方能重启时空的流动。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1260, requirement: 'magic', target: 84, color: '#98B8D8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'mercury-thermometer', title: '溢出的水银刻度', category: '结界修复',
    description: '市立气象观测塔顶端的特种水银气压计发生破裂泄漏，溢出的活性水银并未滴落，而是化作无数颗具备原生知觉的水银微粒在管道内壁高速攀爬。仪器读数被强行固定在不可思议的负压极值，周围空间的大气压随之剧烈跌宕，窗框开始发生危险的内陷形变。必须凭借老练的洞察眼力，在成千上万颗水银微粒中揪出作为分裂母体的那颗核心水银核。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1320, requirement: 'insight', target: 85, color: '#A8B0B8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'shadow-choir-echo', title: '空教室的无声合唱', category: '心愿回收',
    description: '第三废弃中学位于顶层的音乐教室，在每逢暴雨侵袭的子夜都会从锁孔内溢出浓烈的旧乐谱油墨苦味。房间内空无一人，但积满灰尘的琴凳与黑板前却隐隐立着七道微弱透明的身影；它们无声地张大着嘴唇合唱着无人知晓的毕业挽歌，将绝望的窒息感辐射至整个楼道。调查员需以绝不设防的赤诚共情融入合唱，安抚未曾毕业的游魂。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1380, requirement: 'empathy', target: 86, color: '#B898C8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 7,
  },

  // ── 绝望 ──
  {
    id: 'hollow-seam', title: '穹顶空月的因果裂隙', category: '结界修复',
    description: '星见川上空的云层撕裂开一道微型高维狭缝，空月冰冷深邃的平整白环倒影直接穿透穹顶，将纯粹的无序引力潮汐泼洒在两岸防汛堤上。接触到虚无引力波的水域与混凝土护坡正在发生恐怖的无机物溶解，常人的理性防御在此类非人天象面前犹如薄纸。唯有事务所最顶尖的超感洞察者方能承受直视深渊的视界冲击，精密引导符文大阵弥合天幕创口。',
    x: 50, y: 50, difficulty: '绝望', duration: 100, reward: 2100, requirement: 'insight', target: 90, color: '#B4A8E0',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 8,
  },
  {
    id: 'lost-archive', title: '遗忘之城的盲端档案', category: '心愿回收',
    description: '市役所绝密地库的最底层盲端，出现了一道通往已被城市历史主动除名的“第零区”的折叠回廊。回廊深处堆叠着数千册封皮泛黄的契约底账，每一页上都记录着某位彻底自所有市民记忆与档案中抹除存在的魔法少女真名。此处的时空充斥着足以让心智瞬间瘫痪的永恒悲恸，唯有拥有圣母般坚韧心防与至高共情容积的契约者，方能深入盲端带回最初的铭文。',
    x: 50, y: 50, difficulty: '绝望', duration: 110, reward: 2300, requirement: 'empathy', target: 92, color: '#D0A0B0',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 9,
  },
];
