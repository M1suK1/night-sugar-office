import type { Mission } from '../types.ts';

/**
 * v42 扩充战斗委托分卷一：单体（1只）与双子（2只）编队。
 * 单挑刺客、前排肉盾+后排输出、双子互补等战术组合。
 */
export const combatMissionsLow: Mission[] = [
  // ── 单体敌方（1 只）──
  {
    id: 'c-single-tailor', title: '暗巷里的裁缝铁剪', category: '紧急委托',
    description: '旧衣坊废墟后方的逼仄狭巷内，连续三晚传出金属铁剪高速裁切布料的刺耳咔嚓声。多名夜班工人的外套后摆被凭空齐整剪下一截，伤痕平滑如镜且散落着微量月影磷光；无头使魔在阴影中飞速游移，必须派遣身法轻捷的少女迅速将其截停拆解。',
    x: 50, y: 50, difficulty: '低危', duration: 40, reward: 520, requirement: 'agility', target: 68, color: '#A098B0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['scissor-tailor'], enemyCount: 1, rounds: 4, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-hound', title: '沥青深坑的吠声', category: '清缴委托',
    description: '旧北岸公路修补工地的滚烫沥青储池深处，被过量恶意沉淀凝聚出了一头狂暴的黏稠黑犬。它在废弃沥青路面上狂奔咆哮，飞溅的滚烫焦油将街角路标融化扭曲，附近的巡警已被其迫入工棚，急需强力输出者正面压制击碎其焦油核心。',
    x: 50, y: 50, difficulty: '低危', duration: 40, reward: 550, requirement: 'magic', target: 70, color: '#787080',
    status: 'open', squad: [], work: 'combat', enemyIds: ['asphalt-hound'], enemyCount: 1, rounds: 4, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-snake', title: '废弃录音机里的蛇', category: '异象调查',
    description: '家电回收站角落的一台开盘式磁带录音机在无电源接入下自行倒带飞旋，磁头磨擦出如毒蛇吐信般的尖锐静电声。长达数十米的变异褐黑磁带在地面如灵蛇游走，企图将靠近者的脚踝绞杀捆扎，必须以精准的洞察力切断磁带蛇的信息神经。',
    x: 50, y: 50, difficulty: '低危', duration: 45, reward: 580, requirement: 'insight', target: 70, color: '#908878',
    status: 'open', squad: [], work: 'combat', enemyIds: ['tape-snake'], enemyCount: 1, rounds: 4, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-spider', title: '结糖的地下电缆', category: '清缴委托',
    description: '地下管线检修井内被焦糖巨蛛编织出了一座巨大的结晶甜网。高压电缆被糖丝死死缠绕，变电箱表层不断渗出泛着微焦甜香的黑色浓胶，电网负荷急剧攀升；若不及时潜入潮湿阴暗的管井斩杀巨蛛，片区电网将在暴雨中引发严重短路爆炸。',
    x: 50, y: 50, difficulty: '低危', duration: 55, reward: 780, requirement: 'magic', target: 75, color: '#C88868',
    status: 'open', squad: [], work: 'combat', enemyIds: ['caramel-spider'], enemyCount: 1, rounds: 5, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-nurse', title: '静默病房巡视', category: '紧急委托',
    description: '废弃市立第三疗养院三楼的隔离病房内，每到午夜都会响起沉闷胶底护士鞋的走动声。面部被厚重白色纱布死死裹紧的静默护士手推装满未知药剂的不锈钢推车，正机械地试图为残留病床上的游魂注射高危安眠药液，必须在走廊深处将其强行缴械制服。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 840, requirement: 'empathy', target: 76, color: '#90B0B8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['silent-nurse'], enemyCount: 1, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-single-dancer', title: '永不停步的足尖鞋', category: '紧急委托',
    description: '旧歌剧院顶楼排练厅内，一具胸膛发条崩裂外露的芭蕾木偶在积水地板上疯狂旋舞。漫天飞舞的粉紫缎带如利刃般切碎了周遭所有橡木把杆与镜面，舞步卷起的气流将整座排练厅化作窒息风暴；唯有以极强身法切入其旋转中枢，方能强行卡死发条。',
    x: 50, y: 50, difficulty: '低危', duration: 60, reward: 880, requirement: 'agility', target: 78, color: '#D890B0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['ribbon-dancer'], enemyCount: 1, rounds: 5, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-horse', title: '废墟间的灰烬残影', category: '清缴委托',
    description: '旧砖窑厂废墟中央升腾起刺鼻的焦硫浓雾，由大火余烬与焦烂稻草凝聚而成的灰烬战马在瓦砾堆上狂乱踩踏。它的蹄铁下迸溅着微温的暗红火花，所经之处枯草与木梁无火自燃，必须派出拥有极高机动压制能力的契约者迅速扑灭这团暴走狂焰。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 920, requirement: 'magic', target: 78, color: '#C07060',
    status: 'open', squad: [], work: 'combat', enemyIds: ['ash-horse'], enemyCount: 1, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-single-shoes', title: '踏夜而过的猩红双足', category: '紧急委托',
    description: '一对自行在街头狂舞奔逃的染血红鞋将沿途三条街区的地面踩踏出道道焦黑裂隙。它的速度越来越快、几乎化作一道猩红残影，任何企图伸手抓取它的路人皆被凌空踢断肋骨；必须布设结界并派遣老练战斗员在它彻底冲垮商业街防护网前将其击落。',
    x: 50, y: 50, difficulty: '低危', duration: 65, reward: 960, requirement: 'agility', target: 80, color: '#D04060',
    status: 'open', squad: [], work: 'combat', enemyIds: ['red-shoes'], enemyCount: 1, rounds: 5, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-knight', title: '古城防线的锈蚀重骑', category: '清缴委托',
    description: '南十字护城河遗址的残破石桥上，一尊丈余高的大理石发条重甲骑士正手持螺旋破城枪轰鸣冲锋。厚重的精钢马甲抵挡了一切寻常物理轰击，桥体已出现危险网状裂痕；必须顶住可怕的正面冲击力，以高阶破坏魔法精准轰击其背部脆弱发条。',
    x: 50, y: 50, difficulty: '中危', duration: 80, reward: 1280, requirement: 'magic', target: 84, color: '#A09070',
    status: 'open', squad: [], work: 'combat', enemyIds: ['clockwork-knight'], enemyCount: 1, rounds: 6, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-single-nun', title: '中庭肃清的铁律修女', category: '紧急委托',
    description: '旧大教堂荒废的中庭喷泉旁，身披冷轧铅板重铠的铁律修女正在默念古老戒律。她手中的审判钢尺泛着刺目寒芒，对踏入中庭的生灵降下无差别的严厉惩戒，多名调查员被其一击打穿心防；急需事务所精锐主力正面交锋，击碎其执念面具。',
    x: 50, y: 50, difficulty: '中危', duration: 85, reward: 1350, requirement: 'insight', target: 86, color: '#888898',
    status: 'open', squad: [], work: 'combat', enemyIds: ['iron-nun'], enemyCount: 1, rounds: 6, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-single-siren', title: '盲端水闸的沉船海妖', category: '清缴委托',
    description: '星见川码头深水泄洪闸门处弥漫着经久不散的湿冷白雾，浮标之上卧伏着人身蛇尾的雾港海妖。它用模仿落水少女的凄凉呼救声迷惑过往巡逻艇，水下潜伏的触须已撕裂两道铁栅；必须在暴雨引发洪峰前深入浓雾斩杀海妖核心。',
    x: 50, y: 50, difficulty: '低危', duration: 80, reward: 1300, requirement: 'empathy', target: 84, color: '#6888A0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['mist-siren'], enemyCount: 1, rounds: 6, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-owl', title: '钟塔顶端的时之鸮', category: '结界修复',
    description: '旧钟楼尖顶铜钟上盘踞着机械巨鸟铜钟夜鸮，胸口倒转的齿轮使方圆百米的时间流速陷入混乱。交巡队员的步调被强行拉慢数倍，空中雨滴悬停如针；唯有以极强洞察力预判其动作节奏，在时钟摆锤咬合的瞬间将其机械中枢强行制动。',
    x: 50, y: 50, difficulty: '低危', duration: 70, reward: 980, requirement: 'insight', target: 80, color: '#B0B8D0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['clock-owl'], enemyCount: 1, rounds: 5, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-single-herald', title: '黑羽飘落的终局信使', category: '紧急委托',
    description: '宣告深渊开宴的终焉传令使舒展六翼降临在最高的无线电发射铁塔之巅。黑雪般的焦黑羽毛漫天飘落，引力畸变使街道上的汽车纷纷离地悬空，全城防空警报在杂波中长鸣；这是直面天灾领主的前哨决战，唯有最顶级的契约编队方能涉险登塔迎敌。',
    x: 50, y: 50, difficulty: '中危', duration: 95, reward: 2200, requirement: 'magic', target: 92, color: '#684860',
    status: 'open', squad: [], work: 'combat', enemyIds: ['abyss-herald'], enemyCount: 1, rounds: 6, attempts: 0, recommendedLevel: 3,
  },

  // ── 双体敌方（2 只）──
  {
    id: 'c-pair-tailor-dancer', title: '缝纫室里的无声舞伴', category: '紧急委托',
    description: '旧服装厂三楼的大厅内，剪影裁缝与缎带舞女正在空旷的地板上默契共演。铁剪的飞速开合与缎带的致命缠绕形成无缝配合，任何踏入大厅的搜救队员都会被缎带死死绊倒、随即被铁剪斩落外衣与灵体，必须在双人配合成型前强行将其分割击破。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 880, requirement: 'agility', target: 76, color: '#C098B8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['scissor-tailor', 'ribbon-dancer'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-pair-wasp-spider', title: '配电井的蛛网与毒针', category: '清缴委托',
    description: '地下变电竖井深处，焦糖蜘蛛与纺锤金蜂构筑起了恶毒的立体防线。粘稠的焦糖蛛网封锁了全部撤退路线，金蜂则在空中利用高压电弧发动精准的高速俯冲刺杀；队员必须在黏液沼泽与麻痹毒针的双重夹击下沉着应战，夺回配电井控制权。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 920, requirement: 'magic', target: 77, color: '#D0A050',
    status: 'open', squad: [], work: 'combat', enemyIds: ['caramel-spider', 'spindle-wasp'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-pair-clown-doll', title: '废弃橱窗的双重噩梦', category: '异象调查',
    description: '玩具百货商店被打碎的橱窗内部，糖霜小丑正手持爆炸糖球狂笑着掩护发足狂奔的裂纹瓷偶。瓷偶体表的高热火焰与小丑泼洒的腐蚀热糖浆相互引燃，在人行道上构筑起一道致命火墙；必须以高阶魔力强行熄灭火势，将两具狂乱人偶逐一击碎。',
    x: 50, y: 50, difficulty: '低危', duration: 60, reward: 890, requirement: 'magic', target: 76, color: '#E8A060',
    status: 'open', squad: [], work: 'combat', enemyIds: ['candy-clown', 'porcelain-doll'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-pair-mirror-mimic', title: '水银立镜的双生倒影', category: '结界修复',
    description: '旧教堂镜厅深处的巴洛克落地镜裂开，镜修女与影中双子联袂跨出镜框。镜修女的阴郁祷词持续削弱全场心防洞察，影中双子则精准镜像复制对手的术式反噬攻击者；两道冰冷水银身躯在微光中交替重叠，必须以非对称战术强行破解镜像闭环。',
    x: 50, y: 50, difficulty: '高危', duration: 75, reward: 1160, requirement: 'insight', target: 82, color: '#88A0D0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['mirror-nun', 'mirror-mimic'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-pair-hound-shadow', title: '暗影与沥青的午夜合围', category: '清缴委托',
    description: '月见台背街昏暗的巷道口，两头异化巨兽悄然堵住了去路。沥青犬在前排以滚烫身躯蛮横撞击防线，噬光黑犬则潜伏在阴影深处专门咬碎照明法球与退路；队伍面临视界被剥夺与高温冲撞的险境，急需经验丰富的小队以大范围圣光战术轰开包围。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 940, requirement: 'magic', target: 78, color: '#585068',
    status: 'open', squad: [], work: 'combat', enemyIds: ['asphalt-hound', 'shadow-eater'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-pair-storm-cubs', title: '双生电弧的暴走幼兽', category: '紧急委托',
    description: '城南变电所的变压器顶端，两只体型精瘦的噬电幼兽正疯狂啃噬接地铜排。高压电流在两只幼兽身躯之间架起一道持续放电的耀眼电浆电桥，巡检工人已被电流击晕在梯子旁；必须在整座配电房起火前登顶，迅速将两头过载幼兽强行分离开来并消灭。',
    x: 50, y: 50, difficulty: '低危', duration: 45, reward: 640, requirement: 'agility', target: 72, color: '#D8C040',
    status: 'open', squad: [], work: 'combat', enemyIds: ['storm-cub', 'storm-cub'], enemyCount: 2, rounds: 4, attempts: 0, recommendedLevel: 2,
  },
  {
    id: 'c-pair-nurse-needle', title: '地下暗室的非法巡诊', category: '清缴委托',
    description: '防空洞底层的隐秘地下诊所内，静默护士与水银注剂师正在对俘获的游魂实施残忍的药物实验。护士以纱布缠绕压制目标，注剂师则手持高压针筒不断注射神经毒剂并为护士回血增益；两者构成了极难缠的续航循环，必须集中火力先击穿注剂师。',
    x: 50, y: 50, difficulty: '高危', duration: 75, reward: 1200, requirement: 'empathy', target: 82, color: '#80A8B0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['silent-nurse', 'silver-needle'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-pair-conductor-tram', title: '盲端站台的末班车长', category: '紧急委托',
    description: '驶往江边盲端的末班幽灵电车缓缓靠站，手提幽绿风灯的雾中列车员与庞大的电车本体同时亮起车灯。列车员的高频检票剪与电车受电弓的暴走高压电弧相互呼应，将整座站台封锁成绝地；出勤队员需在狭窄站台内同时应战重型机车与鬼魅列车员。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1280, requirement: 'agility', target: 84, color: '#68B0B8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['night-tram', 'fog-conductor'], enemyCount: 2, rounds: 6, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-pair-opera-choir', title: '断顶剧院的二重绝响', category: '异象调查',
    description: '大剧院穹顶天窗破碎的残骸之上，假面歌姬的高亢女高音正与铁皮合唱团的沉闷风琴轰鸣激烈交融。极具破坏力的声波风暴在半空中凝聚成肉眼可见的白色光圈，沿街商业大厦玻璃整齐粉碎；必须派出高心防契约者顶住声浪强行登顶切断合奏。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1260, requirement: 'insight', target: 83, color: '#90B0D8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['opera-singer', 'tin-choir'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-pair-radio-sheep', title: '午夜调频的深沉催眠', category: '异象调查',
    description: '广播电台废弃发射天线下方，午夜电台正持续向全城播送沙哑的旧时代晚安小调，失眠羊则在周围散播具有催眠沉沦特性的黑色羊毛雾。多名值班警员在岗位上陷入不可唤醒的昏睡与噩梦；必须在电台信号扩散前强行砸毁发射装置并将魔物肃清。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 880, requirement: 'insight', target: 76, color: '#B098A8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['midnight-radio', 'insomniac-sheep'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-pair-matron-tree', title: '雨夜老街的深潭伞影', category: '紧急委托',
    description: '糖果公园深处的雨伞树伸展开数米宽的湿漉漉黑色油布伞盖，无面主妇端坐于树根下方低声哭诉。伞盖下聚集着被雨水吞噬的市民记忆，主妇的手掌不断探向路过行人的面孔企图剥离五官；必须以强火法术点燃伞树，彻底破除雨夜迷障。',
    x: 50, y: 50, difficulty: '高危', duration: 75, reward: 1180, requirement: 'empathy', target: 81, color: '#788878',
    status: 'open', squad: [], work: 'combat', enemyIds: ['umbrella-tree', 'faceless-homemaker'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-pair-frame-echo', title: '迷宫画框里的双面猫', category: '结界修复',
    description: '旧宅书房悬挂的迷宫画框深处传来尖锐猫叫，回声猫的幽影在画中无尽回廊中穿梭自如、向现世抛射尖锐杂波。任何企图伸手触碰画框的调查员都会被瞬间吸入画内迷宫迷失方向；必须在画框空间彻底稳定前从现实端强行轰碎画框四角榫卯。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 950, requirement: 'insight', target: 79, color: '#A890B8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['labyrinth-frame', 'echo-cat'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-pair-weaver-moth', title: '结晶冰棺与飞蛾磷光', category: '紧急委托',
    description: '地下冷库中央耸立起结晶织棺者精心雕琢的巨大糖棺，周围盘旋着喷吐高热鳞粉的糖蛾提供火力掩护。织棺者不断为飞蛾修复晶莹护盾，飞蛾则以炽热鳞粉灼烧靠近者；两者的冷热攻防转换极为严密，急需高输出强破防小队定点击溃。',
    x: 50, y: 50, difficulty: '中危', duration: 85, reward: 1360, requirement: 'magic', target: 85, color: '#C8D8E8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['coffin-weaver', 'sugar-moth'], enemyCount: 2, rounds: 6, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-pair-knight-owl', title: '旧卫城防的机械双卫', category: '清缴委托',
    description: '护城河钟楼废墟前，发条重骑与铜钟夜鸮结成了钢铁防线。夜鸮在高空逆转齿轮扭曲敌方的行动先手，重骑则在地面发动势大力沉的冲锋破阵；在时间迟滞与重骑长枪的威胁下，队伍必须极其谨慎地协同规避并实施致命打击。',
    x: 50, y: 50, difficulty: '高危', duration: 85, reward: 1380, requirement: 'agility', target: 86, color: '#A0A8B8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['clockwork-knight', 'clock-owl'], enemyCount: 2, rounds: 6, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'c-pair-wick-cinder', title: '永夜熔炉的残焰双驹', category: '清缴委托',
    description: '老热电厂焚化车间内，灯芯蛾在半空挥洒滚烫火星引燃空气，灰烬战马在地面踏碎煤渣冲锋陷阵。两者将车间化作一片熊熊火海，烈焰逼退了消防队；必须派出具备强大耐火与水相法术的契约者冲入火场，彻底熄灭两头狂乱炎兽。',
    x: 50, y: 50, difficulty: '中危', duration: 65, reward: 940, requirement: 'magic', target: 79, color: '#D06848',
    status: 'open', squad: [], work: 'combat', enemyIds: ['paper-lantern', 'ash-horse'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'c-pair-pendulum-bell', title: '旧钟楼的停摆双影', category: '结界修复',
    description: '钟楼齿轮密室中，机械钟摆人正疯狂挥动铁锤砸毁校准机构，铜钟夜鸮则在房梁上俯冲骚扰维修人员。两者的机械运作节奏逐渐产生谐振，整座钟楼即将被暴力拆解；必须赶在午夜最后一声报时前彻底制服这对暴走的机械使魔。',
    x: 50, y: 50, difficulty: '中危', duration: 70, reward: 960, requirement: 'insight', target: 79, color: '#98A0B0',
    status: 'open', squad: [], work: 'combat', enemyIds: ['ember-bird', 'clock-owl'], enemyCount: 2, rounds: 5, attempts: 0, recommendedLevel: 3,
  },
];
