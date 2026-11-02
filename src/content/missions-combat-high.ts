import type { Mission } from '../types.ts';

/**
 * v42 扩充战斗委托分卷二：中型小队（3只）、大型卫队（4只）、蜂群潮涌（5只）与终焉满编（6只）。
 * 深度考验我方多目标法术、先手控场、抗压心防与长线阵地战战术。
 */
export const combatMissionsHigh: Mission[] = [
  // ── 3 只魔物编队（21 条）──
  {
    id: 'c-trio-choir-matron', title: '街角托儿所的夜半点名', category: '紧急委托',
    description: '废弃托儿所紧锁的铁门内，无面主妇端坐讲台，空心合唱童在两侧发出诡异复调，裂纹瓷偶在过道来回巡视。它们正强行给空座点名并企图抓捕路过孩童填补席位；多重精神噪音与物理突击交织，必须组成攻守兼备的三人队迅速破门镇压。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 940, requirement: 'empathy', target: 78, color: '#A898A0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['faceless-homemaker', 'hollow-choir', 'porcelain-doll'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'c-trio-wax-hive', title: '高压电塔下的蜜蜡工坊', category: '清缴委托',
    description: '南十字变电枢纽三号铁塔上，两只蜜蜡蜂与一头纺锤金蜂筑成了电离子蜂房。蜜蜡蜂吐出高粘度导电蜡浆封堵检修爬梯，金蜂则在空中进行带电刺杀；变电站即将瘫痪，必须顶住高压电击与毒刺，迅速捣毁铁塔上的三重蜂群。',
    x: 50, y: 50, difficulty: '中危', duration: 70, reward: 960, requirement: 'magic', target: 78, color: '#D8B840',
    status: 'open', squad: [], work: 'combat', enemyIds: ['wax-bee', 'wax-bee', 'spindle-wasp'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-trio-hospital', title: '停尸间长廊的夜班医护', category: '清缴委托',
    description: '地下太平间漫长冰冷的走廊内，静默护士手推铁车、水银注剂师手持高压针筒、裂纹瓷偶作为先锋开道。三者组成了兼备肉盾、毒伤、回血与自爆破片的极恶医疗组；狭窄地形下战斗极其凶险，必须精准集火切断其医疗支援链路。',
    x: 50, y: 50, difficulty: '高危', duration: 75, reward: 1220, requirement: 'empathy', target: 82, color: '#7898A0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['silent-nurse', 'silver-needle', 'porcelain-doll'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-trio-railway', title: '荒废编组站的铁轨卫队', category: '紧急委托',
    description: '星见川北岸荒废数十年的列车编组站上，末班车轰鸣亮灯，雾中列车员挥舞铁钳，磁带蛇在枕木缝隙如绊索游走。三者封锁了货场咽喉，任何潜入者都会在铁轨静电与蛇身绞杀中遭到列车正面冲撞；急需高机动队伍强行破局。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1260, requirement: 'agility', target: 83, color: '#68A8B0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['night-tram', 'fog-conductor', 'tape-snake'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-trio-circus', title: '废弃马戏团的午夜开幕', category: '异象调查',
    description: '游乐场破旧帐篷中央，糖霜小丑扔掷爆炸糖球，踏夜红鞋以残影身法高速踢击，缎带舞女抛洒缠绕丝缎。三位一体的怪诞杂耍表演将舞台化为绞肉机，狂乱的笑声与音浪撕扯着周围的心智防护；必须派遣兼具身法与爆发的主力队拆除剧场。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1250, requirement: 'agility', target: 83, color: '#E07888',
    status: 'open', squad: [], work: 'combat', enemyIds: ['candy-clown', 'red-shoes', 'ribbon-dancer'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-trio-radio-noise', title: '穿透发射塔的三重噪音', category: '异象调查',
    description: '广播电视塔天线平台被三头声音系魔物彻底占领：午夜电台放大杂波，假面歌姬发出刺穿心防的超高音女高音，回声猫在钢梁间敏捷弹跳制造全向折射。强烈的精神污染风暴向全城辐射，必须顶住心智轰炸强行登顶实施绝杀。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1280, requirement: 'insight', target: 84, color: '#98A0D0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['midnight-radio', 'opera-singer', 'echo-cat'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-trio-shadow-hunt', title: '熄灭街灯后的三方合围', category: '清缴委托',
    description: '整条商业街的霓虹灯被同时破坏熄灭，黑暗中噬光黑犬封锁光照，沥青犬正面冲击阵型，剪影裁缝在阴影深处高速突袭侧翼。队伍面临视距被彻底剥夺与多角度撕咬的双重危机，唯有依靠大范围星光法术照亮长夜方能反败为胜。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1270, requirement: 'magic', target: 84, color: '#483850',
    status: 'open', squad: [], work: 'combat', enemyIds: ['shadow-eater', 'asphalt-hound', 'scissor-tailor'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-trio-church-rite', title: '大教堂偏殿的苦修审判', category: '紧急委托',
    description: '旧教堂深处的审判偏殿内，铁律修女挥动重戒尺主导裁决，镜修女念诵侵蚀祷词削弱神智，影中双子在前排严丝合缝复制防御。三者结成了森严的宗教裁判阵列，对任何外来生灵进行灭顶制裁；急需精通破解护盾的专家小队深入圣殿。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1340, requirement: 'insight', target: 86, color: '#8888A0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['iron-nun', 'mirror-nun', 'mirror-mimic'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-trio-clockwork', title: '无情咬合的齿轮重骑', category: '结界修复',
    description: '钟楼齿轮大厅内，机械钟摆人抡击巨锤，发条重骑架枪冲锋，铜钟夜鸮在高处逆转时间流速。金属撞击声震耳欲聋，时间与重力的复合压制令作战空间极为逼仄；必须以极限机动撕开机械重围，逐个切断其动力轴承。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1360, requirement: 'agility', target: 86, color: '#A09880',
    status: 'open', squad: [], work: 'combat', enemyIds: ['ember-bird', 'clockwork-knight', 'clock-owl'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-trio-sugar-swarm', title: '甜品冷库的暴走虫巢', category: '清缴委托',
    description: '废弃冷饮加工厂的主车间彻底化为甜味地狱。两只巨型糖蛾在空中挥洒灼热结晶鳞粉，地面上一只焦糖巨蛛吐出高韧性糖丝封杀走位；冰库内热气蒸腾、冷热交加，出勤小队必须在持续灼伤与减速黏网中强行实施定点剿灭。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 940, requirement: 'magic', target: 78, color: '#D890A8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['sugar-moth', 'sugar-moth', 'caramel-spider'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'c-trio-storm-pack', title: '变电枢纽的三重电弧', category: '紧急委托',
    description: '北岸变电枢纽遭到三只噬电幼兽的集群啃噬，三头异兽身躯交错连成高压电浆火网，整片街区路灯疯狂爆闪。电弧在变压器间肆意弹射，抢修队伍被逼入绝境；必须以极快身手迅速切入战场，在整座变电站被雷暴吞噬前将幼兽全数歼灭。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 900, requirement: 'agility', target: 77, color: '#E0B830',
    status: 'open', squad: [], work: 'combat', enemyIds: ['storm-cub', 'storm-cub', 'storm-cub'], enemyCount: 3, rounds: 4, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'c-trio-mirror-maze', title: '仪容镜深处的折叠重影', category: '结界修复',
    description: '旧百货大楼的试衣长廊内，迷宫画框将空间折叠扭曲，镜修女吟诵削弱洞察的晦涩祷词，影中双子在数重倒影中同步反击。虚妄的空间与水银倒影层层嵌套，一旦出招不慎便会遭到全额反震；必须以最高级别的洞察力锁定现世实体。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1290, requirement: 'insight', target: 85, color: '#9098C8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['labyrinth-frame', 'mirror-nun', 'mirror-mimic'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-trio-harbor-mist', title: '星见川码头的沉水引航', category: '清缴委托',
    description: '星见川卸货码头被浓厚江雾死死锁住。雾港海妖在江心发出哀鸣诱骗搜救艇，沥青犬在栈桥撕咬缆绳，笼中雀女在吊车顶端散布群体抑郁气场。整座码头陷入精神与肉体的双重绝境，唯有兼顾强力输出与心防护持的队伍方能突破迷雾。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1280, requirement: 'empathy', target: 84, color: '#7090A8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['mist-siren', 'asphalt-hound', 'caged-bird'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-trio-sleep-stealers', title: '偷窃整夜睡意的三道幽影', category: '心愿回收',
    description: '旧城区三处住宅区在同一晚陷入集体失眠狂躁。失眠羊在屋顶喷吐梦魇雾气，缎带舞女在阳台狂舞束缚逃生者，笼中雀女哀鸣削弱心智抵抗力；居民们的清醒意识正被无声榨取，必须派遣高敏捷高共情小队夜袭斩断盗梦锁链。',
    x: 50, y: 50, difficulty: '中危', duration: 70, reward: 950, requirement: 'empathy', target: 79, color: '#B098C0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['insomniac-sheep', 'ribbon-dancer', 'caged-bird'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-trio-ash-cinder', title: '焚化炉深处的不灭余烬', category: '清缴委托',
    description: '垃圾焚化厂的地下炉膛深处，灰烬战马踏碎熔渣狂奔，灯芯蛾在半空播撒烈火鳞粉，裂纹瓷偶全身赤红冲撞防线。三头火系怪异将车间化作熔炉炼狱，耐火防线已濒临崩溃；出勤队员需顶住灼热气浪，以高阶水相与压制法术强行破除火海。',
    x: 50, y: 50, difficulty: '中危', duration: 70, reward: 970, requirement: 'magic', target: 80, color: '#D85840',
    status: 'open', squad: [], work: 'combat', enemyIds: ['ash-horse', 'paper-lantern', 'porcelain-doll'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-trio-casket-guard', title: '地下墓室的水晶灵柩', category: '紧急委托',
    description: '大教堂地下墓穴最底层，结晶织棺者正为水晶棺注入厚重糖霜结晶，糖霜小丑扔掷爆炸糖团掩护，糖蛾在半空泼洒毒热鳞粉。敌方阵线拥有极高自愈护盾与多段远程灼烧，必须派出精于穿透打击与暴击输出的队伍强行轰碎冰棺防线。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1350, requirement: 'magic', target: 86, color: '#D0C8E0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['coffin-weaver', 'candy-clown', 'sugar-moth'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-trio-street-sweepers', title: '凌晨三点的无声清道夫', category: '异象调查',
    description: '糖果街打烊后的空旷主干道上，雨伞树撑起漆黑雨幕，剪影裁缝滑行裁剪行人的投影，磁带蛇如绊索在地面缠绕追猎。三者保持着令人发指的默契节奏在街心无声推移，已有多名巡警失联；必须以雷霆手段拦截清道夫队伍，恢复长街秩序。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 930, requirement: 'agility', target: 78, color: '#889888',
    status: 'open', squad: [], work: 'combat', enemyIds: ['umbrella-tree', 'scissor-tailor', 'tape-snake'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'c-trio-opera-troupe', title: '沉沦剧院的弦乐三重奏', category: '异象调查',
    description: '大剧院舞台正中，假面歌姬的高亢哀歌与铁皮合唱团的金属轰鸣、空心合唱童的空灵童声交织成灭顶风暴。三重不同频段的声波撕扯着全场的心防，防守结界正在片片碎裂；必须顶住精神穿透，以最果断的高爆发战术强行打断咏唱。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1320, requirement: 'empathy', target: 85, color: '#A098C8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['opera-singer', 'tin-choir', 'hollow-choir'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-trio-dark-court', title: '黑夜法庭的先锋裁决', category: '紧急委托',
    description: '宣告深渊开宴的终焉传令使现身高空，地面上铁律修女手持钢尺森然伫立，影中双子以水银之躯护持两翼。天灾领主与古代审判官联手的威压令整座街区为之战栗，这是极高烈度的前哨战，唯有最坚毅老练的契约少女小队方可接单迎战。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1480, requirement: 'magic', target: 88, color: '#685068',
    status: 'open', squad: [], work: 'combat', enemyIds: ['abyss-herald', 'iron-nun', 'mirror-mimic'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 8,
  },
  {
    id: 'c-trio-sugar-royalty', title: '废弃王座前的狂热近卫', category: '清缴委托',
    description: '游乐场糖果王座前方，糖果巨王端坐高台，糖霜小丑在台下杂耍抛弹，焦糖蜘蛛在穹顶挂下无数粘稠陷阱。王座周边被腐蚀性甜浆彻底浸润，怪物们在暴走狂热中轰击靠近者；必须以极度严谨的编队分工逐一瓦解近卫，直取糖王首级。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1360, requirement: 'magic', target: 85, color: '#E08878',
    status: 'open', squad: [], work: 'combat', enemyIds: ['candy-king', 'candy-clown', 'caramel-spider'], enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-trio-silent-ward', title: '废弃疗养院的巡回查房', category: '紧急委托',
    description: '三号疗养院重症监护区内，静默护士推车查房，笼中雀女散发绝望气场剥夺防抗意识，水银注剂师手持高压针筒伺机实施致死注射。受困病患的生命之火行将熄灭，调查队伍需顶住持续削弱，迅速破门斩断这一残酷的查房流程。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1260, requirement: 'empathy', target: 83, color: '#88A0A8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['silent-nurse', 'caged-bird', 'silver-needle'], enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 6,
  },

  // ── 4 只魔物编队（10 条）──
  {
    id: 'c-quad-parade-brass', title: '雨夜铁皮卫兵大游行', category: '紧急委托',
    description: '两台铁皮合唱团在街心齐鸣金属风琴，机械钟摆人手持铁锤轰击路面，发条重骑架枪领队冲锋。四头重甲机械使魔结成坚不可摧的铁壁游行阵列，沿街一切防御工事皆被碾为齑粉；必须派出顶级法术破甲小队，正面硬撼钢铁狂潮。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1400, requirement: 'magic', target: 86, color: '#908878',
    status: 'open', squad: [], work: 'combat', enemyIds: ['tin-choir', 'tin-choir', 'ember-bird', 'clockwork-knight'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-quad-sugar-surge', title: '沸腾糖浆的甜蜜狂潮', category: '紧急委托',
    description: '糖果商业街爆发了前所未有的魔物暴动：糖王端坐指挥，小丑投掷滚烫糖球，焦糖蜘蛛张开巨网，糖蛾在半空泼洒结晶鳞粉。四重甜蜜灾厄将长街化作滚烫胶质沼泽，商户护栏全线崩溃；急需精锐战斗小队冒死突入，粉碎暴动中枢。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1420, requirement: 'magic', target: 87, color: '#E88090',
    status: 'open', squad: [], work: 'combat', enemyIds: ['candy-king', 'candy-clown', 'caramel-spider', 'sugar-moth'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-quad-shadow-prowl', title: '街角暗巷的四方围猎', category: '清缴委托',
    description: '深夜四岔路口的路灯彻底熄灭，噬光黑犬吞噬光亮，沥青犬阻截退路，磁带蛇封锁脚踝，剪影裁缝在死角挥舞利剪。四方异象形成严丝合缝的暗杀合围，已有多支巡逻队失陷；必须以全域圣光轰炸强行撕开黑夜，粉碎包围圈。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1380, requirement: 'agility', target: 85, color: '#504860',
    status: 'open', squad: [], work: 'combat', enemyIds: ['shadow-eater', 'asphalt-hound', 'tape-snake', 'scissor-tailor'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-quad-choir-assembly', title: '破败礼拜堂的圣咏集会', category: '结界修复',
    description: '大教堂破败穹顶下，假面歌姬领唱，两组空心合唱童发出空灵和声，铁律修女在大门前手持戒尺阻绝退路。四重神圣与侵蚀交织的声波结界将整座礼拜堂化作心智熔炉，踏入者心防濒临解体；唯有拥有至高心防与共情者方能涉险破阵。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1440, requirement: 'empathy', target: 87, color: '#9088B0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['opera-singer', 'hollow-choir', 'hollow-choir', 'iron-nun'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-quad-electric-hive', title: '变电总站的电离蜂巢', category: '紧急委托',
    description: '全城核心变电总站顶层遭到了群蜂占领：两只蜜蜡蜂喷涂绝缘蜡，纺锤金蜂高速刺击，噬电幼兽吞噬变压器持续释放大范围电离弧光。四重电磁异象即将引发全市大停电，出勤少女必须在刺目雷暴中强行突进，全数歼灭盘踞的电兽群。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1390, requirement: 'agility', target: 85, color: '#E0C838',
    status: 'open', squad: [], work: 'combat', enemyIds: ['wax-bee', 'wax-bee', 'spindle-wasp', 'storm-cub'], enemyCount: 4, rounds: 5, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'c-quad-mirror-labyrinth', title: '多重水银迷宫的极限折射', category: '结界修复',
    description: '地下商场地砖化为活动水银立镜：迷宫画框打乱阵型，镜修女念诵侵蚀祷词，两尊影中双子从左右两侧同时镜像反弹攻击。整座长廊陷入无法目视真实实体的死循环，稍有不慎便会被反伤致死；必须以绝对理性的洞察力逐个击穿水银中枢。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1460, requirement: 'insight', target: 88, color: '#8898C0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['labyrinth-frame', 'mirror-nun', 'mirror-mimic', 'mirror-mimic'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 8,
  },
  {
    id: 'c-quad-hospital-night', title: '医院太平间的通宵会诊', category: '紧急委托',
    description: '第三医院地下两层完全被两名静默护士、一名水银注剂师与一具狂暴裂纹瓷偶所盘踞。双护士交替压制缠绕，注剂师疯狂注射毒素与回血，瓷偶在前排狂乱冲撞并碎裂反伤；队伍面临长线消耗与爆发破片的重压，必须速战速决。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1420, requirement: 'empathy', target: 86, color: '#8098A0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['silent-nurse', 'silent-nurse', 'silver-needle', 'porcelain-doll'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-quad-night-train-crew', title: '幽灵列车的全体乘务组', category: '紧急委托',
    description: '深夜末班电车拉响刺耳长鸣，两名雾中列车员挥舞铁钳在车顶奔跑，回声猫在车厢连廊尖啸骚扰，末班车本体在铁轨上全速撞击沿途阻碍。四位一体的重型幽灵列车已逼近跨江大桥桥头，出勤小队必须空降车顶强行实施紧急制动。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1450, requirement: 'agility', target: 87, color: '#60A0A8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['night-tram', 'fog-conductor', 'fog-conductor', 'echo-cat'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-quad-doll-theater', title: '提线木偶剧的闭幕狂欢', category: '异象调查',
    description: '废弃偶戏馆舞台上，缎带舞女旋舞缠绕，裂纹瓷偶喷射烈焰碎瓷，踏夜红鞋狂暴踢击，剪影裁缝伺机斩落影子。四具异变人偶的狂欢将戏馆化作血腥修罗场，观众席的假人木偶正在被逐一激活；必须以压倒性的火力将舞台连同四偶彻底轰平。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1430, requirement: 'agility', target: 86, color: '#D07088',
    status: 'open', squad: [], work: 'combat', enemyIds: ['ribbon-dancer', 'porcelain-doll', 'red-shoes', 'scissor-tailor'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 7,
  },
  {
    id: 'c-quad-harbor-drown', title: '盲端防汛水闸的沉船群妖', category: '清缴委托',
    description: '星见川深水闸门被两头雾港海妖、一只笼中雀女与一条沥青犬所攻破。海妖在水面制造迷失之雾与刺骨旋涡，雀女散播抑郁侵蚀削弱抵抗，沥青犬在堤防疯狂撕咬防汛缆绳；闸门一旦失守整座旧城区将被淹没，急需全能精锐全力赴援。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1460, requirement: 'empathy', target: 87, color: '#608898',
    status: 'open', squad: [], work: 'combat', enemyIds: ['mist-siren', 'mist-siren', 'caged-bird', 'asphalt-hound'], enemyCount: 4, rounds: 6, attempts: 0, recommendedLevel: 8,
  },

  // ── 5 只魔物编队（5 条）──
  {
    id: 'c-quint-storm-swarm', title: '超高压电网的暴走雷暴群', category: '紧急委托',
    description: '三只噬电幼兽疯狂啃食高压母线引爆链式反应，一只纺锤金蜂与一只蜜蜡蜂在空中架设电浆杀阵。五只雷系异兽将主变电所变成了一座持续放电数万伏特的高温雷池，电弧横扫之处一切防卫系统瘫痪；必须以极高机动性与群体控场逐一拆解群兽。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1560, requirement: 'agility', target: 88, color: '#E8C028',
    status: 'open', squad: [], work: 'combat', enemyIds: ['storm-cub', 'storm-cub', 'storm-cub', 'spindle-wasp', 'wax-bee'], enemyCount: 5, rounds: 6, attempts: 0, recommendedLevel: 8,
  },
  {
    id: 'c-quint-sugar-delirium', title: '糖霜王国的近卫总暴动', category: '紧急委托',
    description: '游乐场废墟深处糖霜王国发起全线反扑：糖王居中统帅，糖霜小丑狂抛爆弹，焦糖蜘蛛张开覆地巨网，两只糖蛾在空中倾泻灼热鳞粉雨。五位一体的甜蜜天灾在街区形成全屏火力覆盖，前线防线摇摇欲坠；必须顶住持续剧毒灼伤发动绝地反击。',
    x: 50, y: 50, difficulty: '绝望', duration: 95, reward: 1980, requirement: 'magic', target: 90, color: '#E87888',
    status: 'open', squad: [], work: 'combat', enemyIds: ['candy-king', 'candy-clown', 'caramel-spider', 'sugar-moth', 'sugar-moth'], enemyCount: 5, rounds: 6, attempts: 0, recommendedLevel: 8,
  },
  {
    id: 'c-quint-doll-carnival', title: '午夜玩具店的五重狂想', category: '异象调查',
    description: '市中心最大的玩具商场百叶窗轰然落下，缎带舞女、裂纹瓷偶、踏夜红鞋、剪影裁缝与笼中雀女同时在展厅内暴起。缠绕、烈焰、飞踢、剪裁与精神哀鸣交织成毁灭五重奏，商场内的巡夜员危在旦夕；唯有顶尖多面手编队方能平息这场玩具狂欢。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1580, requirement: 'agility', target: 88, color: '#D87090',
    status: 'open', squad: [], work: 'combat', enemyIds: ['ribbon-dancer', 'porcelain-doll', 'red-shoes', 'scissor-tailor', 'caged-bird'], enemyCount: 5, rounds: 6, attempts: 0, recommendedLevel: 8,
  },
  {
    id: 'c-quint-shadow-pack', title: '吞噬整座街区的暗影狂潮', category: '清缴委托',
    description: '月见台地下防空洞内涌出滔天黑潮：两只噬光黑犬吞光匿形，一只沥青犬正面冲击，一条磁带蛇绊锁双腿，一只剪影裁缝飞速收割生命。全街区陷入不见五指的极暗绝境，普通探照设备瞬间被侵蚀失效；急需强力大范围清场魔法逆转战局。',
    x: 50, y: 50, difficulty: '绝望', duration: 95, reward: 2050, requirement: 'magic', target: 91, color: '#383048',
    status: 'open', squad: [], work: 'combat', enemyIds: ['shadow-eater', 'shadow-eater', 'asphalt-hound', 'tape-snake', 'scissor-tailor'], enemyCount: 5, rounds: 6, attempts: 0, recommendedLevel: 8,
  },
  {
    id: 'c-quint-church-inquisition', title: '圣殿地下的全套裁判所', category: '紧急委托',
    description: '大教堂地宫中央开启了古代裁判大阵：铁律修女手持戒尺坐镇中枢，镜修女吟诵削弱心防的祷词，影中双子反弹外来攻势，两组空心合唱童在石壁深处发出撕裂神智的合声。五重审判构筑起绝对禁区，唯有意志如钢铁般坚毅的精锐编队方可涉险破阵。',
    x: 50, y: 50, difficulty: '绝望', duration: 100, reward: 2150, requirement: 'insight', target: 92, color: '#787898',
    status: 'open', squad: [], work: 'combat', enemyIds: ['iron-nun', 'mirror-nun', 'mirror-mimic', 'hollow-choir', 'hollow-choir'], enemyCount: 5, rounds: 6, attempts: 0, recommendedLevel: 9,
  },

  // ── 6 只魔物编队（满编 6 体！5 条）──
  {
    id: 'c-sext-grand-parade', title: '午夜十二点的使魔大巡游', category: '紧急委托',
    description: '当午夜零点钟声敲响，庞大的幽灵列车末班车开道，两尊铁皮合唱团奏响工业铜音，机械钟摆人挥锤砸碎路障，踏夜红鞋在车顶疾走狂踏，糖霜小丑在车尾疯狂抛撒爆炸彩弹。六头怪异结成百米长的无敌巡游巨龙横贯市中心主干道，全城拉响最高警报！',
    x: 50, y: 50, difficulty: '绝望', duration: 100, reward: 2300, requirement: 'agility', target: 92, color: '#B06878',
    status: 'open', squad: [], work: 'combat', enemyIds: ['night-tram', 'tin-choir', 'tin-choir', 'ember-bird', 'red-shoes', 'candy-clown'], enemyCount: 6, rounds: 6, attempts: 0, recommendedLevel: 9,
  },
  {
    id: 'c-sext-sugar-apocalypse', title: '淹没街区的终极糖霜浪潮', category: '紧急委托',
    description: '整座糖果公园被翻涌沸腾的甜腻深渊所吞没：结晶织棺者以冰棺固守全阵，糖果巨王高踞中央狂暴输出，糖霜小丑泼洒腐蚀热浆，焦糖巨蛛吐出天罗地网，两只糖蛾在半空疯狂泼洒致死鳞粉雨。六重天灾级糖系异象形成全屏杀戮矩阵，亟待最强阵容赴战！',
    x: 50, y: 50, difficulty: '绝望', duration: 105, reward: 2450, requirement: 'magic', target: 93, color: '#E86078',
    status: 'open', squad: [], work: 'combat', enemyIds: ['coffin-weaver', 'candy-king', 'candy-clown', 'caramel-spider', 'sugar-moth', 'sugar-moth'], enemyCount: 6, rounds: 6, attempts: 0, recommendedLevel: 9,
  },
  {
    id: 'c-sext-radioactive-choir', title: '撕裂夜空的六重绝望合鸣', category: '异象调查',
    description: '电视塔顶端的全向发射天线遭到六头声学异象的同时寄生：假面歌姬领衔主唱，午夜电台全频段过载广播，铁皮合唱团轰鸣风琴低音，两组空心合唱童吟唱撕裂神智的复调童谣，回声猫在钢构之间制造无尽谐振。全域心防屏障在共振中寸寸瓦解，这是心智的终极死斗！',
    x: 50, y: 50, difficulty: '绝望', duration: 100, reward: 2350, requirement: 'empathy', target: 92, color: '#8878B8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['opera-singer', 'midnight-radio', 'tin-choir', 'hollow-choir', 'hollow-choir', 'echo-cat'], enemyCount: 6, rounds: 6, attempts: 0, recommendedLevel: 9,
  },
  {
    id: 'c-sext-hospital-ward', title: '重症监护室的极限大沦陷', category: '紧急委托',
    description: '第三市立医院地下重症监护区全面沦陷为地狱：两名静默护士手持纱布在走廊交替缠绕封锁，两名水银注剂师推着高压药车持续抽吸生机并注射剧毒兴奋剂，两具狂暴的裂纹瓷偶全身浴火发起自杀式冲撞反伤。极限的控制、剧毒、回血与自爆合流，唯有真正的传奇小队方能荡平长廊！',
    x: 50, y: 50, difficulty: '绝望', duration: 105, reward: 2400, requirement: 'empathy', target: 93, color: '#709098',
    status: 'open', squad: [], work: 'combat', enemyIds: ['silent-nurse', 'silent-nurse', 'silver-needle', 'silver-needle', 'porcelain-doll', 'porcelain-doll'], enemyCount: 6, rounds: 6, attempts: 0, recommendedLevel: 9,
  },
  {
    id: 'c-sext-abyss-legion', title: '宣告城市终局的深渊军团', category: '紧急委托',
    description: '深渊的终极帷幕在九辖区交界的中央裂谷彻底拉开：终焉传令使舒展六翼降下黑雪与引力畸变，发条重骑发起破城铁蹄冲锋，铁律修女手握审判钢尺斩落生机，结晶织棺者撑起坚不可摧的结晶巨盾，噬光黑犬剥夺一切光芒，影中双子全额镜像反弹致命攻击！满编六大灾厄异象齐聚，事务所迎来守护城市的终极试炼！',
    x: 50, y: 50, difficulty: '绝望', duration: 120, reward: 2800, requirement: 'magic', target: 95, color: '#503858',
    status: 'open', squad: [], work: 'combat', enemyIds: ['abyss-herald', 'clockwork-knight', 'iron-nun', 'coffin-weaver', 'shadow-eater', 'mirror-mimic'], enemyCount: 6, rounds: 6, attempts: 0, recommendedLevel: 10,
  },
];
