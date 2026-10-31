import type { EliteBuff, MonsterTemplate } from '../types.ts';

/**
 * 精英不是另一种魔物，而是一层「buff」：普通怪被它挑中就成了精英。
 * 六条各有明确偏科，玩家看名字就该知道该带谁、该怎么打。
 */
export const eliteBuffs: EliteBuff[] = [
  {
    id: 'elite-overload', name: '过载', color: '#8fd3f0',
    blurb: '糖分在体内烧成了静电，它的动作比同类快半拍，抽动时会漏出白色的光。',
    counter: '别跟它比先手：带一个高洞察的少女，把它的加速拖到第二轮再打断。',
    hpMul: 1.6, statMul: 1.15, empathyMul: 1.1,
    skillIds: ['monster-static'],
    rules: [{ trigger: 'roundStart', effect: 'haste', amount: 3 }],
  },
  {
    id: 'elite-mirror', name: '镜面', color: '#b8c9ee',
    blurb: '表皮像糖壳一样反光，所有落在它身上的伤口都会先被照一遍。',
    counter: '减伤是固定的，堆一次高伤的收益高于多段小伤害。',
    hpMul: 1.5, statMul: 1.1, empathyMul: 1.25,
    skillIds: ['monster-mirror'],
    rules: [{ trigger: 'always', effect: 'damageReduce', amount: 10 }],
  },
  {
    id: 'elite-sweet', name: '嗜甜', color: '#e8a7c2',
    blurb: '它一直在吃，吃到伤口自己长回去。地上留下的糖渣是它吃过的证据。',
    counter: '拖长战斗只会喂饱它：两轮内打完，或用持续伤害压掉回复。',
    hpMul: 1.7, statMul: 1.1, empathyMul: 1.2,
    skillIds: ['monster-sweet-decree'],
    rules: [{ trigger: 'roundStart', effect: 'heal', amount: 8 }],
  },
  {
    id: 'elite-night', name: '夜行', color: '#9b8fd0',
    blurb: '它不反射光，只反射声音，出手比看见的更快。',
    counter: '敏捷领先时先控后打；命中不够就别硬拼，先降它速度。',
    hpMul: 1.45, statMul: 1.3, empathyMul: 1.05,
    skillIds: ['monster-scream'],
    rules: [{ trigger: 'always', effect: 'buff', stat: 'agility', amount: 6 }],
  },
  {
    id: 'elite-swarm', name: '群聚', color: '#c9b36a',
    blurb: '它把自己拆成了很多份，每一份都以为自己才是本体。',
    counter: '群攻技能一次清掉分身，否则每轮都在补人。',
    hpMul: 1.4, statMul: 1.12, empathyMul: 1.3,
    skillIds: ['monster-mosaic'],
    rules: [{ trigger: 'hit', effect: 'debuffAttacker', stat: 'hit', amount: 4, duration: 2 }],
  },
  {
    id: 'elite-plague', name: '结症', color: '#7fb2a0',
    blurb: '它走过的地方会结晶，伤口里也长出糖。',
    counter: '带净化或解毒，别让持续伤害叠到第三层。',
    hpMul: 1.65, statMul: 1.08, empathyMul: 1.35,
    skillIds: ['monster-dissolve'],
    rules: [{ trigger: 'roundStart', effect: 'dot', amount: 3, duration: 2 }],
  },
];

export const ELITE_IDS = eliteBuffs.map(buff => buff.id);

export function eliteBuffById(id: string | undefined | null): EliteBuff | undefined {
  return id ? eliteBuffs.find(buff => buff.id === id) : undefined;
}

/** 把 buff 套到一只普通怪上：浅拷贝，模板本体不动。 */
export function applyEliteBuff(monster: MonsterTemplate, buff: EliteBuff): MonsterTemplate {
  const stats = { ...monster.stats };
  for (const key of Object.keys(stats) as Array<keyof typeof stats>) {
    const scaled = stats[key] * buff.statMul;
    stats[key] = Math.round(key === 'empathy' ? scaled * buff.empathyMul : scaled);
  }
  const skillIds = [...new Set([...monster.skillIds, ...buff.skillIds.filter(id => !monster.skillIds.includes(id))])];
  const rules = [...(monster.rules ?? [])];
  const extra = buff.rules ?? [];
  for (const rule of extra) {
    if (!rules.some(item => item.trigger === rule.trigger && item.effect === rule.effect && item.amount === rule.amount)) rules.push(rule);
  }
  return {
    ...monster,
    name: `${monster.name}（${buff.name}）`,
    maxHp: Math.round(monster.maxHp * buff.hpMul),
    stats,
    skillIds,
    rules,
  };
}
