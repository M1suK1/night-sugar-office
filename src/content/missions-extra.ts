import type { Mission } from '../types.ts';

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
    description: '学校食堂的蒸汽连续几晚不肯散去，白雾里能听见有人在数盘子。值班的阿姨说，数到七十就会停下。',
    x: 50, y: 50, difficulty: '中危', duration: 70, reward: 880, requirement: 'insight', target: 74, color: '#B9C7D8',
    status: 'open', squad: [], work: 'combat', enemyCount: 2, rounds: 4, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'shutter-song', title: '卷帘门后的合唱', category: '紧急委托',
    description: '糖果街闭店的商铺整排卷帘门同时发出低鸣，像一群人在门后压着嗓子唱同一段旋律。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 940, requirement: 'magic', target: 76, color: '#D8A8B8',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'tooth-collector', title: '收牙人', category: '市民求助',
    description: '三个街区的孩子在同一晚掉了同一颗乳牙，枕头下没有硬币，只有一枚温热的、刻着编号的瓷片。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 860, requirement: 'empathy', target: 73, color: '#E8D6A8',
    status: 'open', squad: [], work: 'combat', enemyCount: 2, rounds: 4, attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'wet-parade', title: '雨中的游行', category: '紧急委托',
    description: '一场没有申报的游行在雨里穿过十字街。队伍很长，脚步声很齐，但没有一张脸是朝前的。',
    x: 50, y: 50, difficulty: '高危', duration: 80, reward: 1180, requirement: 'agility', target: 80, color: '#9FB0C8',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 5, attempts: 0, recommendedLevel: 5,
  },
  {
    id: 'mirror-tide', title: '镜潮', category: '结界修复',
    description: '旧教堂的镜厅夜里涨潮了。镜面涌出温热的水，水里漂着别人家的、还没拆封的信。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1240, requirement: 'insight', target: 82, color: '#A8B8E8',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'depot-nest', title: '货场尽头的巢', category: '异象调查',
    description: '码头的废弃货柜里攒起了一个巢：糖纸、车票、断掉的天线，全被编成了同一种花纹。',
    x: 50, y: 50, difficulty: '高危', duration: 90, reward: 1300, requirement: 'magic', target: 83, color: '#C8A8C0',
    status: 'open', squad: [], work: 'combat', enemyCount: 3, rounds: 6, attempts: 0, recommendedLevel: 6,
  },
  {
    id: 'lost-ticket', title: '找不回的车票', category: '心愿回收',
    description: '一位老人每晚来车站问同一班车。她的票根还在口袋里，可那趟车三十年前就停运了。',
    x: 50, y: 50, difficulty: '低危', duration: 40, reward: 520, requirement: 'insight', target: 68, color: '#B8D0C8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 3,
  },
  {
    id: 'sweet-ledger', title: '糖账', category: '异象调查',
    description: '糖果街的老账房连着三晚自己翻页。账本上记的全是还没发生的欠款，签名栏写着自己的名字。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 780, requirement: 'insight', target: 76, color: '#D8C8A8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 4,
  },
  {
    id: 'bell-count', title: '少敲的一下', category: '结界修复',
    description: '钟楼每晚敲十二下，最近只敲十一下。缺的那一声里，有人听见了自己家的门锁在转。',
    x: 50, y: 50, difficulty: '中危', duration: 60, reward: 820, requirement: 'magic', target: 77, color: '#C0B0D8',
    status: 'open', squad: [], work: 'investigation', attempts: 0, recommendedLevel: 4,
  },
];
