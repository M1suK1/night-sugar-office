/**
 * 夜糖事务所的九块辖区。
 *
 * 每块辖区的边界都是照着 `public/art/city.svg` 的地形手描的：
 * 河道把城市切成东西两半，辖区沿着河岸、公园、会堂、教堂这类地标走折线，
 * 所以它们大小不一、没有一块是横平竖直的矩形。
 *
 * 坐标系同地图底图：1100 × 780 像素。委托坐标是百分比，查询辖区时会换算。
 */

export type DistrictId =
  | 'candy'
  | 'station'
  | 'plaza'
  | 'greenhouse'
  | 'cathedral'
  | 'crossroad'
  | 'oldtown'
  | 'clocktower'
  | 'docks';

/** 一个辖区的环境修正。负数是「对事务所有利」。 */
export interface DistrictEffect {
  /** 调查目标修正：正数更难，负数更易。 */
  targetPct?: number;
  /** 报酬修正。 */
  rewardPct?: number;
  /** 出战魔法少女造成的伤害修正。 */
  damageDealtPct?: number;
  /** 魔法少女承受的伤害修正。 */
  damageTakenPct?: number;
  /** 敌人生命修正。 */
  enemyHpPct?: number;
  /** 敌人属性（攻/防/速）修正；污染抬高的那一项。 */
  enemyPowerPct?: number;
  /** 委托结束时额外增加的疲劳。 */
  fatigueFlat?: number;
  /** 委托结束时额外增加的侵蚀。 */
  corruptionFlat?: number;
  /** 在辖区内时每小时的精神力流失。 */
  spiritPerHour?: number;
  /** 委托成功时额外获得的声望。 */
  reputationFlat?: number;
}

export interface District {
  id: DistrictId;
  name: string;
  /** 副标题：地标或气质。 */
  subtitle: string;
  /** 区域背景介绍，显示在辖区面板里。 */
  description: string;
  /** 一行地形提要。 */
  terrain: string;
  effect: DistrictEffect;
  /** 地图上的标签锚点（像素）。 */
  label: { x: number; y: number };
  /** 辖区重心（像素），用于标签碰撞与兜底归属。 */
  center: { x: number; y: number };
  /** 多边形顶点，`x,y x,y …` 像素坐标。 */
  points: string;
  /** 选中时的光晕颜色。 */
  tint: string;
}

const MAP_WIDTH = 1100;
const MAP_HEIGHT = 780;

export const districtOrder: DistrictId[] = [
  'candy',
  'station',
  'plaza',
  'greenhouse',
  'cathedral',
  'crossroad',
  'oldtown',
  'clocktower',
  'docks',
];

export const districts: Record<DistrictId, District> = {
  candy: {
    id: 'candy',
    name: '糖果公园',
    subtitle: '西北 · 喷泉与樱树',
    terrain: '草坪、喷泉、樱树林',
    description:
      '旧城西北角唯一还亮着灯的地方。喷泉在夜里仍旧转着水，樱树把影子铺到长椅和旋转木马上。白天有孩子在这里追鸽子，入夜后剩下一圈昏黄路灯，和偶尔忘了回家的情侣。事务所的委托人喜欢约在喷泉边见面——他们觉得这里安全，尽管树影深处总能听见布料摩擦的声音。',
    effect: { targetPct: -6, rewardPct: 8, fatigueFlat: -2 },
    label: { x: 214, y: 176 },
    center: { x: 240, y: 150 },
    points: '0,0 430,0 520,120 450,250 300,320 0,300',
    tint: '244, 180, 205',
  },
  station: {
    id: 'station',
    name: '北岸桥头',
    subtitle: '北河岸 · 高架与月台',
    terrain: '高架铁桥、货运月台',
    description:
      '星见川北段的铁桥在午夜之后才真正醒过来。货运列车一节一节碾过铁轨，把整片河岸震得发麻；桥墩底下堆着没人认领的行李箱，月台尽头的钟永远慢七分钟。这里的委托大多和「消失的班次」有关——有人上车，没人记得他下车。桥头风大，魔法少女在这里作战时，礼服与披风会被吹得猎猎作响。',
    effect: { damageDealtPct: 10, fatigueFlat: 4 },
    label: { x: 560, y: 96 },
    center: { x: 600, y: 120 },
    points: '430,0 699,0 730,100 757,200 740,260 600,220 520,120',
    tint: '150, 196, 236',
  },
  plaza: {
    id: 'plaza',
    name: '月见台',
    subtitle: '东北 · 穹顶天文台',
    terrain: '观星台、穹顶广场、玻璃回廊',
    description:
      '城市东北的高地上，天文台的穹顶像一枚半开的眼。广场铺着抛光石板，夜里映出整片天空；望远镜旁总放着一杯没人喝的咖啡。这里的居民相信，只要在月见台许愿，愿望就会被写进星图。事务所不这么看——他们只注意到，每次观星会之后，城里的失踪案就会多一件。',
    effect: { damageTakenPct: -8, reputationFlat: 2 },
    label: { x: 974, y: 140 },
    center: { x: 1000, y: 120 },
    points: '872,0 1100,0 1100,300 930,360 795,300 902,100',
    tint: '186, 196, 246',
  },
  greenhouse: {
    id: 'greenhouse',
    name: '玻璃温室',
    subtitle: '东岸 · 植物园穹顶',
    terrain: '玻璃穹顶、藤蔓、暖雾',
    description:
      '东岸的植物园在战前是富人的温室，如今玻璃裂了三分之一，藤蔓从裂缝里垂下来，把钢架缠成一片会呼吸的森林。里面恒温、恒湿，雾气贴着地面走，脚步声会被苔藓吃掉。园艺社的学生仍每周来修剪，他们说温室里有一株会开花的植物在等某个人——没人见过它开花。',
    effect: { enemyHpPct: -10, rewardPct: 10, fatigueFlat: 3 },
    label: { x: 1000, y: 400 },
    center: { x: 960, y: 420 },
    points: '930,360 1100,300 1100,540 980,560 900,500 820,455 795,300',
    tint: '160, 214, 190',
  },
  cathedral: {
    id: 'cathedral',
    name: '旧教堂',
    subtitle: '东南河岸 · 烛火与钟声',
    terrain: '哥特教堂、墓园、石阶',
    description:
      '教堂建在星见川东南的河湾上，尖顶正对着河心。礼拜早就停了。彩色玻璃碎了大半，烛台却每晚都被点起来——点烛的人从不留名。守墓人住在教堂后的石屋里，他说地窖比教堂本身更老，老到不属于这座城。在这里作战，脚步会不自觉放轻，像怕惊醒什么。',
    effect: { targetPct: 6, damageDealtPct: 12 },
    label: { x: 828, y: 588 },
    center: { x: 840, y: 560 },
    points: '795,455 820,455 900,500 980,560 960,600 900,680 848,700 840,600 795,500',
    tint: '226, 168, 196',
  },
  crossroad: {
    id: 'crossroad',
    name: '南十字',
    subtitle: '东南远端 · 十字路口',
    terrain: '四向大道、废弃商街',
    description:
      '四条大道在南十字交汇，路牌却指向四个不存在的方向。战前这里是全城最热闹的商街，现在只剩卷帘门、碎玻璃和永不熄灭的红绿灯。出租车司机宁可绕三公里也不肯开进来。据说在路口中央站满十三分钟，会听见有人在背后叫你的名字——事务所的档案里，这条记录被标了三次重点。',
    effect: { damageTakenPct: -10, targetPct: -3 },
    label: { x: 980, y: 700 },
    center: { x: 990, y: 690 },
    points: '960,600 1100,560 1100,780 660,780 702,700 848,700 900,680',
    tint: '236, 176, 156',
  },
  oldtown: {
    id: 'oldtown',
    name: '旧城区',
    subtitle: '西侧 · 迷宫般的旧楼',
    terrain: '老公寓、防火巷、屋顶水箱',
    description:
      '旧城区占了西边最大的一片地：八层老公寓挤在一起，防火巷窄得只能侧身过，晾衣绳在头顶织成网。地图在这里是失效的——同一扇门，白天通向三楼，夜里可能通向地下室。这里的委托最杂，报酬也最高，因为没人愿意在天黑后爬那些没有灯的楼梯。',
    effect: { fatigueFlat: 6, rewardPct: 15 },
    label: { x: 140, y: 424 },
    center: { x: 200, y: 420 },
    points: '0,300 300,320 440,250 460,420 500,520 300,600 0,560',
    tint: '208, 176, 236',
  },
  clocktower: {
    id: 'clocktower',
    name: '旧钟楼',
    subtitle: '中西部 · 会堂与钟塔',
    terrain: '石砌会堂、钟塔、拱廊',
    description:
      '会堂的钟塔是城里少数还走得准的钟。整点报时会传遍半个旧城，声音沉得像从地底下传上来。会堂正门挂着褪色的市徽，台阶上常年坐着几个下棋的老人。钟楼内部不对访客开放，但事务所知道，钟摆后面的那扇门每隔几年就会自己开一次。',
    effect: { spiritPerHour: -2, damageDealtPct: 8 },
    label: { x: 520, y: 390 },
    center: { x: 555, y: 385 },
    points: '440,250 600,220 740,260 651,300 606,400 648,500 500,520 460,420',
    tint: '226, 196, 156',
  },
  docks: {
    id: 'docks',
    name: '星见川码头',
    subtitle: '西南沿河 · 货栈与浮桥',
    terrain: '木栈桥、货栈、河雾',
    description:
      '星见川在码头这一段最宽，河水黑得能照见灯。木栈桥一根根伸进河里，货栈的铁门锈死了大半，剩下几扇夜里会自己开合。摆渡人只在雾起时出船，收的船资是一段记忆。事务所的老主顾说，码头的水位每年都在涨，可没人见过它淹上来。',
    effect: { damageTakenPct: -8, targetPct: 4 },
    label: { x: 200, y: 690 },
    center: { x: 260, y: 660 },
    points: '0,560 300,600 500,520 660,500 700,600 702,700 662,780 0,780',
    tint: '156, 206, 220',
  },
};

export const districtIds = districtOrder;

export function isDistrictId(value: unknown): value is DistrictId {
  return typeof value === 'string' && (districtOrder as string[]).includes(value);
}

function pointsOf(district: District): { x: number; y: number }[] {
  return district.points
    .trim()
    .split(/\s+/)
    .map(chunk => {
      const [x, y] = chunk.split(',').map(Number);
      return { x, y };
    });
}

const parsedPoints = new Map<DistrictId, { x: number; y: number }[]>();

function polygon(id: DistrictId) {
  let cached = parsedPoints.get(id);
  if (!cached) {
    cached = pointsOf(districts[id]);
    parsedPoints.set(id, cached);
  }
  return cached;
}

function insidePolygon(x: number, y: number, poly: { x: number; y: number }[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function distanceTo(x: number, y: number, point: { x: number; y: number }) {
  return Math.hypot(x - point.x, y - point.y);
}

/**
 * 根据委托的百分比坐标判定辖区。
 * 落在河道、地图边缘这类「不属于任何辖区」的位置时，归给最近的辖区重心，
 * 保证任何委托都有一块地可以落脚。
 */
export function districtAt(xPct: number, yPct: number): DistrictId {
  const px = (xPct / 100) * MAP_WIDTH;
  const py = (yPct / 100) * MAP_HEIGHT;
  for (const id of districtOrder) {
    if (insidePolygon(px, py, polygon(id))) return id;
  }
  let closest: DistrictId = 'oldtown';
  let best = Infinity;
  for (const id of districtOrder) {
    const d = distanceTo(px, py, districts[id].center);
    if (d < best) {
      best = d;
      closest = id;
    }
  }
  return closest;
}

export function districtOf(pin: { x: number; y: number; district?: DistrictId }): DistrictId {
  if (pin.district && isDistrictId(pin.district)) return pin.district;
  return districtAt(pin.x, pin.y);
}

export function districtOfMission(mission: { x: number; y: number; district?: DistrictId }): District {
  return districts[districtOf(mission)];
}

/** 辖区内是否临河。用于地图描边与文案。 */
export function isRiverDistrict(id: DistrictId): boolean {
  return id === 'station' || id === 'clocktower' || id === 'docks' || id === 'cathedral' || id === 'plaza';
}

export type EffectTone = 'good' | 'bad' | 'neutral';

export interface EffectLine {
  label: string;
  value: string;
  tone: EffectTone;
}

function signed(value: number, suffix = '%') {
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

/** 把结构化的环境修正翻译成面板上的中文条目。 */
export function effectLines(effect: DistrictEffect): EffectLine[] {
  const lines: EffectLine[] = [];
  if (effect.targetPct) {
    lines.push({ label: '调查目标', value: signed(effect.targetPct), tone: effect.targetPct > 0 ? 'bad' : 'good' });
  }
  if (effect.rewardPct) {
    lines.push({ label: '委托报酬', value: signed(effect.rewardPct), tone: effect.rewardPct > 0 ? 'good' : 'bad' });
  }
  if (effect.damageDealtPct) {
    lines.push({ label: '造成伤害', value: signed(effect.damageDealtPct), tone: effect.damageDealtPct > 0 ? 'good' : 'bad' });
  }
  if (effect.damageTakenPct) {
    lines.push({ label: '承受伤害', value: signed(effect.damageTakenPct), tone: effect.damageTakenPct < 0 ? 'good' : 'bad' });
  }
  if (effect.enemyHpPct) {
    lines.push({ label: '敌人生命', value: signed(effect.enemyHpPct), tone: effect.enemyHpPct < 0 ? 'good' : 'bad' });
  }
  if (effect.enemyPowerPct) {
    lines.push({ label: '敌人属性', value: signed(effect.enemyPowerPct), tone: effect.enemyPowerPct < 0 ? 'good' : 'bad' });
  }
  if (effect.fatigueFlat) {
    lines.push({ label: '疲劳', value: signed(effect.fatigueFlat, ''), tone: effect.fatigueFlat < 0 ? 'good' : 'bad' });
  }
  if (effect.corruptionFlat) {
    lines.push({ label: '侵蚀', value: signed(effect.corruptionFlat, ''), tone: effect.corruptionFlat > 0 ? 'bad' : 'good' });
  }
  if (effect.spiritPerHour) {
    lines.push({ label: '精神力', value: `${signed(effect.spiritPerHour, '')}/时`, tone: effect.spiritPerHour < 0 ? 'bad' : 'good' });
  }
  if (effect.reputationFlat) {
    lines.push({ label: '声望', value: signed(effect.reputationFlat, ''), tone: 'good' });
  }
  return lines;
}

/** 一句话总结辖区的环境倾向，用于委托卡片。 */
export function effectSummary(id: DistrictId): string {
  return effectLines(districts[id].effect)
    .slice(0, 2)
    .map(line => `${line.label}${line.value}`)
    .join(' · ');
}

/** 数值换算：百分比修正落到具体委托上。 */
export function applyPct(base: number, pct?: number): number {
  if (!pct) return base;
  return Math.max(1, Math.round(base * (1 + pct / 100)));
}
