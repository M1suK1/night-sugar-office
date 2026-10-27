import type { MonsterTemplate } from '../types';

export const monsters: MonsterTemplate[] = [
  {
    id: 'night-tram', name: '末班车', epithet: '第十三号站台的回声', rank: '灾厄', element: '月影系', color: '#79C7C9',
    maxHp: 240, maxSpirit: 120,
    stats: { magic: 82, insight: 78, agility: 74, empathy: 40 },
    skillIds: ['monster-claw', 'monster-scream', 'monster-static'],
    trait: '每轮结束时若未被眩晕，速度提高 4。',
    description: '一节没有编号的电车，在午夜后多停了一站。车窗里坐满了没有脸的人，他们都在等一个不会来的名字。',
    spec: { bodyPlan: 'machine', scale: 1.08, appendages: 6, core: '钟', palette: { body: '#1E3A3E', shade: '#0E2023', rim: '#A8E4E2' }, aura: '故障', motif: '钟' },
    codex: { habit: '只在整点前后出现，沿着废弃的轨道缓慢滑行。', weakness: '车头灯是它的感知核心，从侧面接近会安全得多。' },
    rules: [{ trigger: 'roundStart', effect: 'haste', amount: 4 }],
  },
  {
    id: 'echo-cat', name: '回声猫', epithet: '吃掉名字的小客人', rank: '游荡', element: '梦境系', color: '#C7A7E8',
    maxHp: 130, maxSpirit: 90,
    stats: { magic: 60, insight: 72, agility: 88, empathy: 55 },
    skillIds: ['monster-claw', 'monster-scream'],
    trait: '被击中时，攻击者命中率下降 4，持续 1 轮。',
    description: '一只由回声拼成的猫。它叫你的名字时，声音比你更像你。不要答应。',
    spec: { bodyPlan: 'feline', scale: 0.82, appendages: 4, core: '月', palette: { body: '#3A2B4E', shade: '#1B1428', rim: '#D9C2F2' }, aura: '静电', motif: '猫' },
    codex: { habit: '在空店铺之间跳来跳去，收集被遗忘的称呼。', weakness: '害怕真正的名字，尤其是被认真叫出口的那种。' },
    rules: [{ trigger: 'hit', effect: 'debuffAttacker', stat: 'hit', amount: 4, duration: 2 }],
  },
  {
    id: 'mirror-nun', name: '镜修女', epithet: '万花筒圣咏', rank: '灾厄', element: '月影系', color: '#9FB4E8',
    maxHp: 280, maxSpirit: 160,
    stats: { magic: 86, insight: 84, agility: 62, empathy: 52 },
    skillIds: ['monster-claw', 'monster-mirror', 'monster-mosaic'],
    trait: '每有 1 面镜子存活，受到的首次伤害减免 15%。',
    description: '她站在镜厅正中央，身后是无数个背对众生的自己。她为你祈祷，但祷词里没有你的名字。',
    spec: { bodyPlan: 'humanoid', scale: 1.0, appendages: 2, core: '眼', palette: { body: '#232B45', shade: '#12172A', rim: '#C6D3FF' }, aura: '故障', motif: '月' },
    codex: { habit: '在无人教堂里重演一场没有结束的仪式。', weakness: '无法直视真实的倒影，破碎镜面会让她短暂失语。' },
    rules: [{ trigger: 'always', effect: 'damageReduce', amount: 15 }],
  },
  {
    id: 'candy-king', name: '糖王', epithet: '坐在王座上的蛀牙', rank: '王座', element: '糖霜系', color: '#F49ABD',
    maxHp: 360, maxSpirit: 150,
    stats: { magic: 90, insight: 70, agility: 58, empathy: 72 },
    skillIds: ['monster-claw', 'monster-sweet-decree', 'monster-dissolve'],
    trait: '每轮恢复 6 点血量，除非本回合受到共情伤害。',
    description: '糖果街曾经最受欢迎的吉祥物。孩子们把愿望塞进它嘴里，直到它再也吐不出别的东西。',
    spec: { bodyPlan: 'humanoid', scale: 1.28, appendages: 5, core: '糖', palette: { body: '#5A1F36', shade: '#2B0E1B', rim: '#FFC7DE' }, aura: '花瓣', motif: '糖' },
    codex: { habit: '把整条街的甜味都吸进王座，再慢慢吐出来。', weakness: '共情攻击能打断它的糖分再生。' },
    rules: [{ trigger: 'roundStart', effect: 'heal', amount: 6, unlessEmpathyDamage: true }],
  },
  {
    id: 'sugar-moth', name: '糖蛾', epithet: '失眠电波的鳞粉', rank: '碎屑', element: '糖霜系', color: '#F7C9DC',
    maxHp: 95, maxSpirit: 70,
    stats: { magic: 56, insight: 66, agility: 80, empathy: 48 },
    skillIds: ['monster-claw', 'monster-scales'],
    trait: '被击中时向攻击者散播 6 点持续伤害，持续 1 轮。',
    description: '从坏掉的霓虹灯里孵出来的蛾子。翅膀上的花纹是别人没说出口的梦话。',
    spec: { bodyPlan: 'moth', scale: 0.78, appendages: 4, core: '糖', palette: { body: '#4A2E3E', shade: '#251520', rim: '#FFD7E8' }, aura: '花瓣', motif: '蝶' },
    codex: { habit: '绕着糖果街的招牌飞，啃食过甜的灯光。', weakness: '怕冷，降温会让鳞粉失去黏性。' },
    rules: [{ trigger: 'hit', effect: 'dot', amount: 6, duration: 1 }],
  },
  {
    id: 'hollow-moon', name: '空月', epithet: '没有背面的天体', rank: '王座', element: '星光系', color: '#C9C4FF',
    maxHp: 420, maxSpirit: 200,
    stats: { magic: 96, insight: 92, agility: 50, empathy: 64 },
    skillIds: ['monster-claw', 'monster-gaze', 'monster-tide'],
    trait: '免疫眩晕；每轮开始时若血量低于一半，魔力提高 8。',
    description: '它不是月亮，只是月亮缺席时留下的洞。所有仰望过它的人，都会短暂地忘记自己为什么抬头。',
    spec: { bodyPlan: 'orb', scale: 1.34, appendages: 3, core: '月', palette: { body: '#1B1830', shade: '#0A0818', rim: '#E4DFFF' }, aura: '余烬', motif: '星' },
    codex: { habit: '悬在旧钟楼上空，缓慢地改变城市的影子长度。', weakness: '洞察足够高的人能看见它背面的裂口。' },
    rules: [{ trigger: 'always', effect: 'immuneStun' }, { trigger: 'roundStart', effect: 'buff', stat: 'magic', amount: 8, belowHpPct: 0.5 }],
  },
];
export const monsterById = new Map(monsters.map(m => [m.id, m]));
export function getMonster(id: string): MonsterTemplate {
  return monsterById.get(id) ?? monsters[0];
}
export const rankOrder = ['碎屑', '游荡', '灾厄', '王座'] as const;
