import type { Mission } from '../types.ts';
import { combatMissionsLow } from './missions-combat-low.ts';
import { combatMissionsHigh } from './missions-combat-high.ts';
import { extraInvestigationMissions } from './missions-investigation.ts';

/**
 * 委托模板池的第二批（战斗 6 + 调查 3），与 seed-pack 的 7 条合起来是战斗 10 + 调查 6。
 *
 * 模板只决定「这一单是什么事」：判哪个属性、文案、多长。难度不写在这里——生成时按辖区
 * 污染度抽档再反向缩放（见 `makeCommission`）；战斗模板也不写死 `enemyIds`，只写
 * `enemyCount`，具体是哪几只由 `rollEnemies` 抽。所以这张表里没有 `district`：坐标由
 * `districtPin()` 按辖区反推，同一个模板不会永远刷在同一个地方。
 */
export const extraMissions: Mission[] = [
  {
    id: 'canteen-fog', title: '食堂里散不掉的雾', category: '异象调查',
    description: '第七初级中学的半地下食堂在打烊熄灯后，后厨铁灶处连续数夜升腾起泛着微甜腥气的不散白雾。巡夜人汇报称，每逢凌晨一点半，雾气深处便会传出极其均匀的瓷盘清洗碰撞声；伴随着某种干涩女声逐个点数盘子，从一缓缓念至七十便戛然而止，随后餐桌下便会渗出冰凉黏稠的焦糖冷水。必须在晨班厨工推门前压制浓雾源头，查清被困在第七十个盘子背后的回声。',
    x: 50, y: 50, difficulty: '中危', duration: 70, reward: 880, requirement: 'insight', target: 74, color: '#B9C7D8',
    status: 'open', squad: [], work: 'combat', enemyCount: 2, rounds: 4, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'shutter-song', title: '卷帘门后的合唱', category: '紧急委托',
    description: '糖果街歇业后的两排铁皮店铺在深夜两点会同时陷入同频共振，整排锈蚀的卷帘门板发出如沉闷风琴般的持续蜂鸣。临街居民证实，金属震颤的夹缝中压抑着多重声线混杂的儿童合唱声，反复低哼着同一段没有词句的安眠曲调；一旦有行人驻足侧耳，门下缝隙便会伸出细长的半透明糖浆丝线缠绕脚踝。必须在商业街晨间开闸前切断声波谐振点。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 940, requirement: 'magic', target: 76, color: '#D8A8B8',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'tooth-collector', title: '收牙人', category: '市民求助',
    description: '旧城区与糖果公园交界处的数户家庭在同一晚报案，称家中幼童在睡梦中整齐脱落了左侧尖牙；次晨枕下并未发现童话里的银币，取而代之的是一枚边缘带有体温、微光浮动且阴刻着量产警备编号的惨白瓷片。失落的牙床伤口已泛出淡淡的月影磷光，若不及时追缉游荡在街巷天花板缝隙间的收牙人，孩子们的真实名字将被彻底拓印带走。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 860, requirement: 'empathy', target: 73, color: '#E8D6A8',
    status: 'open', squad: [], work: 'combat', enemyCount: 2, rounds: 4, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'wet-parade', title: '雨中的游行', category: '紧急委托',
    description: '未申报的无声游行队伍于大雨滂沱的午夜径直横穿十字街口。近百名身披湿透黑色油布雨衣的人影保持着机械整齐的步伐前移，雨水顺着帽檐如瀑滑落，却照不出一张面向正前方的五官面孔——它们的身躯朝向前方行进，头颅却全部诡异地向后扭转一百八十度，空洞眼窝齐齐注视着沿途的二楼窗棂。这支失控的人群正在把路面踩成泥泞深渊，必须强行拦截队首。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1180, requirement: 'agility', target: 80, color: '#9FB0C8',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'mirror-tide', title: '镜潮', category: '结界修复',
    description: '旧教堂深处的巴洛克镜厅在月相隐没的夜晚发生了反常的灵潮倒灌。数十面落地仪容镜的平整表面如沸水般剧烈荡漾，不断向外溢出泛着微温的浑浊咸水；积水已漫过脚踝，水面上漂浮着无数封粘着封蜡、收件人栏赫然写着整座城市不同失踪少女名字的泛黄信函。镜中倒影正在试图伸手抓取岸上的人，必须在镜面彻底融化前重固边缘符印。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1240, requirement: 'insight', target: 82, color: '#A8B8E8',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'depot-nest', title: '货场尽头的巢', category: '异象调查',
    description: '星见川码头最深处锈穿的十号冷藏集装箱内，被某种具备强迫筑巢倾向的未知异象营建起了一座蛛网状巨巢。无数旧糖纸、停运班车票根以及扭曲折断的铜质收音天线，被精巧编织成极复杂的月相螺旋几何图案，箱体内不断向外辐射出微弱的脉冲杂音与灼热甜气。货场巡警已有多人出现持续性幻听，必须强行破门拆毁巢核。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1300, requirement: 'magic', target: 83, color: '#C8A8C0',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'lost-ticket', title: '找不回的车票', category: '心愿回收',
    description: '老北岸车站早已荒废的五号盲端站台前，每到清晨初雾弥漫时，总有一位披着旧棉大衣的老妇人机械地向空荡荡的铁轨探询同一班列车。她掌心里紧攥着泛黄发脆的薄纸票根，然而那班跨江特别列车早在三十年前的法蚀大火中便已注销停运。老人游荡的执念正逐渐在空气中拉扯出一段废弃的车厢幽灵，需要队员以极温和的共情引导回收票根上的遗憾。',
    x: 50, y: 50, difficulty: '低危', duration: 40, reward: 520, requirement: 'insight', target: 68, color: '#B8D0C8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'sweet-ledger', title: '糖账', category: '异象调查',
    description: '糖果街老行会典当行内的百年账簿连续数晚在紧闭的保险箱内自行翻动页码。泛黄纸页上由隐形墨水渗出大量尚未发生的星砂欠款与契约抵押条目，而每一笔预支账单底部的画押签名，皆精确描摹着次日即将推门而入的市民字迹。这种将未来苦难提前折现的恶质因果若不尽快查清并闭环清算，受牵连者的心智将在黎明时分被当场质押。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 780, requirement: 'insight', target: 76, color: '#D8C8A8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'bell-count', title: '少敲的一下', category: '结界修复',
    description: '旧城区中央耸立的旧钟楼依照惯例本应在午夜敲响整整十二声厚重铜音，然而近期却始终在第十一下之后突兀陷入死寂。在消失的那一声停顿里，钟楼方圆三里内的居民皆能隐约听见自家防盗门锁在无人触碰下轻轻转动的金属咔嗒声，仿佛有看不见的手在逐门试探钥匙。必须潜入满是灰尘与锈齿轮的钟楼顶层，修补被异常截留的那一声震鸣。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 820, requirement: 'magic', target: 77, color: '#C0B0D8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 4,
  },
  ...combatMissionsLow,
  ...combatMissionsHigh,
  ...extraInvestigationMissions,
];
