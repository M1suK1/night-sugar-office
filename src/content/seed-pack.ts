import type { ContentPack, Girl, Mission, Skill, StatKey } from '../types';
import { skills } from './skills.ts';
import { monsters } from './monsters.ts';

const base = (magic: number, insight: number, agility: number, empathy: number): Record<StatKey, number> => ({ magic, insight, agility, empathy });
const relations = (own: string, values: Record<string, number>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const id of ['yue', 'tang', 'ling', 'wu', 'zhi', 'lu']) if (id !== own) out[id] = values[id] ?? 40;
  return out;
};

export const seedGirls: Girl[] = [
  {
    id: 'yue', name: '月见桃', codename: '绯色回响', title: '把夜晚染成桃色的魔法少女', element: '星光系', color: '#F49ABD', portrait: '/art/yue.svg',
    level: 6, hp: 120, maxHp: 120, baseMaxHp: 120, spirit: 100, maxSpirit: 100, fatigue: 40, bond: 62, exp: 0,
    stats: base(88, 74, 62, 80), status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '星环坠落', skills: ['glimmer-spear', 'peach-ward', 'starlight-fall'], cost: 2800,
    description: '事务所里最擅长把「没关系」说得像真的的人。她的星光很轻，落到人身上却刚好够暖。',
    scars: [], relationships: relations('yue', { tang: 66, ling: 44, wu: 51, zhi: 58, lu: 39 }), archetype: '输出', quote: '任务结束后，要一起看星星吗？',
  },
  {
    id: 'tang', name: '砂糖', codename: '白夜糖霜', title: '用糖纸包住噩梦的魔法少女', element: '糖霜系', color: '#F7C9DC', portrait: '/art/tang.svg',
    level: 5, hp: 96, maxHp: 96, baseMaxHp: 96, spirit: 88, maxSpirit: 88, fatigue: 58, bond: 48, exp: 0,
    stats: base(58, 70, 60, 94), status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '白夜糖霜', skills: ['sugar-needle', 'goodnight-candy', 'white-night-frost'], cost: 2400,
    description: '总是随身带着一罐水果糖。她记得每个人的口味，却总说自己不爱吃甜的。',
    scars: [], relationships: relations('tang', { yue: 71, ling: 46, wu: 55, zhi: 62, lu: 36 }), archetype: '治愈', quote: '睡不着的话，我这里还有一颗糖。',
  },
  {
    id: 'ling', name: '零青', codename: '静默频率', title: '收听城市杂音的魔法少女', element: '月影系', color: '#8FB6C9', portrait: '/art/ling.svg',
    level: 5, hp: 104, maxHp: 104, baseMaxHp: 104, spirit: 94, maxSpirit: 94, fatigue: 44, bond: 35, exp: 0,
    stats: base(72, 92, 80, 66), status: 'idle', roomId: 'observatory', remaining: 0,
    skill: '静默全频', skills: ['frequency-prick', 'silent-band', 'moon-phase'], cost: 2600,
    description: '她能听见城市里所有不该被听见的声音。摘下耳机时，反而显得有点不知所措。',
    scars: [], relationships: relations('ling', { yue: 42, tang: 47, wu: 61, zhi: 38, lu: 44 }), archetype: '控制', quote: '别说话。……刚才那个频率，又出现了。',
  },
  {
    id: 'wu', name: '雾眠', codename: '梦境收集者', title: '在梦与猫之间巡游的魔法少女', element: '梦境系', color: '#C7A7E8', portrait: '/art/wu.svg',
    level: 3, hp: 100, maxHp: 100, baseMaxHp: 100, spirit: 96, maxSpirit: 96, fatigue: 20, bond: 56, exp: 0,
    stats: base(66, 84, 74, 78), status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '深梦坠落', skills: ['dream-touch', 'sheep-nebula', 'deep-dream-fall'], cost: 2200,
    description: '白天几乎都在打盹，却对每一只流浪猫的名字了如指掌。她说梦是猫走过后留下的脚印。',
    scars: [], relationships: relations('wu', { yue: 53, tang: 60, ling: 64, zhi: 41, lu: 48 }), archetype: '控制', quote: '你也听见了吗？那只三花猫在叫你的名字。',
  },
  {
    id: 'zhi', name: '栀子', codename: '春日药笺', title: '在废墟缝隙里种药的魔法少女', element: '自然系', color: '#B9D8A8', portrait: '/art/zhi.svg',
    level: 4, hp: 110, maxHp: 110, baseMaxHp: 110, spirit: 90, maxSpirit: 90, fatigue: 30, bond: 40, exp: 0,
    stats: base(74, 68, 62, 90), status: 'idle', roomId: 'clinic', remaining: 0,
    skill: '春日蔓生', skills: ['flower-thorn', 'flower-prescription', 'spring-growth'], cost: 2400,
    description: '诊所的架子上有三十七种晒干的花。她相信每一种伤口，都能等到自己的春天。',
    scars: [], relationships: relations('zhi', { yue: 57, tang: 63, ling: 36, wu: 43, lu: 52 }), archetype: '治愈', quote: '先把手伸出来。伤口不会因为逞强就自己长好。',
  },
  {
    id: 'lu', name: '鹿铃', codename: '赤焰节拍', title: '把战斗当成演出的魔法少女', element: '赤焰系', color: '#D98A94', portrait: '/art/lu.svg',
    level: 6, hp: 132, maxHp: 132, baseMaxHp: 132, spirit: 72, maxSpirit: 72, fatigue: 36, bond: 32, exp: 0,
    stats: base(94, 58, 93, 66), status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '赤焰安可', skills: ['drumbeat', 'finale-firework', 'crimson-encore'], cost: 3200,
    description: '地下乐队的鼓手，夜晚街区的守护者。越是危急的时刻，她的心跳就越稳。',
    scars: [], relationships: relations('lu', { yue: 38, tang: 34, ling: 46, wu: 49, zhi: 51 }), archetype: '输出', quote: '下一首，献给还没放弃的人。',
  },
];

export const seedMissions: Mission[] = [
  {
    id: 'candy', title: '糖果街的失眠电波', category: '异象调查', description: '糖果街的霓虹灯连续七晚在凌晨三点同时变成灰白色。居民说，灯灭的瞬间会听见有人轻声数糖。',
    x: 24, y: 27, difficulty: '低危', duration: 45, reward: 680, requirement: 'empathy', target: 70, color: '#F49ABD',
    status: 'open', squad: [], work: 'investigation', attempts: 0,
  },
  {
    id: 'station', title: '末班车上的第十三人', category: '紧急委托', description: '末班电车每晚多载一名乘客。司机不敢回头，只在到站时听见第十三声脚步。',
    x: 66, y: 25, difficulty: '高危', duration: 60, reward: 920, requirement: 'agility', target: 80, color: '#E86A8A',
    status: 'open', squad: [], work: 'combat', enemyIds: ['night-tram', 'echo-cat'], rounds: 4, attempts: 0,
  },
  {
    id: 'mirror', title: '镜中的另一轮月亮', category: '结界修复', description: '旧教堂的镜厅里出现了第二个夜空。镜中的月亮比真实的更圆，也更近。',
    x: 42, y: 51, difficulty: '中危', duration: 90, reward: 1240, requirement: 'insight', target: 75, color: '#9FB4E8',
    status: 'open', squad: [], work: 'combat', enemyIds: ['mirror-nun'], rounds: 6, attempts: 0,
  },
  {
    id: 'cat', title: '寻找走失的星尾猫', category: '市民求助', description: '一只尾巴上有星形斑纹的三花猫走失了。委托人没有留下姓名，只留下一小袋猫薄荷。',
    x: 76, y: 62, difficulty: '低危', duration: 30, reward: 420, requirement: 'agility', target: 65, color: '#B9D8A8',
    status: 'open', squad: [], work: 'investigation', attempts: 0,
  },
  {
    id: 'tower', title: '旧钟楼的未寄信', category: '心愿回收', description: '旧钟楼每天傍晚都会多出一封没有收件人的信。信纸很旧，邮戳却是明天。',
    x: 27, y: 76, difficulty: '中危', duration: 60, reward: 760, requirement: 'empathy', target: 78, color: '#C7A7E8',
    status: 'open', squad: [], work: 'investigation', attempts: 0,
  },
  {
    id: 'arcade', title: '糖果王座上的蛀牙', category: '紧急委托', description: '废弃游乐场的糖王雕像开始进食。它把整条街的甜味吸进王座，再吐出没有味道的雾。',
    x: 58, y: 72, difficulty: '高危', duration: 90, reward: 1420, requirement: 'magic', target: 82, color: '#D98A94',
    status: 'open', squad: [], work: 'combat', enemyIds: ['candy-king', 'sugar-moth'], rounds: 6, attempts: 0,
  },
  {
    id: 'hollow', title: '空月悬在钟楼上', category: '结界修复', description: '月亮缺席的第七夜，旧钟楼上方出现了一个没有背面的天体。仰望它的人会忘记自己为什么抬头。',
    x: 12, y: 52, difficulty: '绝望', duration: 90, reward: 2000, requirement: 'insight', target: 90, color: '#C9C4FF',
    status: 'open', squad: [], work: 'combat', enemyIds: ['hollow-moon'], rounds: 6, attempts: 0,
  },
];

export function packHash(pack: Pick<ContentPack, 'girls' | 'monsters' | 'skills' | 'id'>): string {
  const text = JSON.stringify([pack.id, pack.girls.map(g => [g.id, g.name, g.stats]), pack.monsters.map(m => [m.id, m.name, m.stats]), pack.skills.map(s => [s.id, s.power])]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createSeedPack(): ContentPack {
  const pack: ContentPack = {
    id: 'seed-night-sugar', hash: '', schemaVersion: 2, promptVersion: 'seed-1', source: 'seed',
    createdAt: '2026-10-23T00:00:00.000Z',
    palette: { ink: '#0B0B10', rose: '#F49ABD', blush: '#FFD6E5', mist: '#85828F', frost: '#9CC9D2' },
    girls: seedGirls, monsters, skills: skills as Skill[], missions: seedMissions,
    notes: '手工编写的起始内容包。后期由 LLM 按模板生成，并经过本地校验与数值分配。',
  };
  pack.hash = packHash(pack);
  return pack;
}
