import type { EffectCategory, SkillEffect } from '../types';

/** 技能效果的“种类”。筛选和下拉都按这个分组，不再依赖关键词搜索。 */
export const EFFECT_CATEGORIES: EffectCategory[] = ['offense', 'defense', 'speed', 'mind', 'control', 'sustain'];
export const EFFECT_CATEGORY_LABELS: Record<EffectCategory, string> = {
  offense: '进攻',
  defense: '防护',
  speed: '速度',
  mind: '精神',
  control: '控制',
  sustain: '续航',
};

export interface SkillEffectPreset {
  id: string;
  name: string;
  category: EffectCategory;
  summary: string;
  effect: Omit<SkillEffect, 'preset' | 'label' | 'category'>;
}

/**
 * 可以反复套用的状态模板。
 * 数值保持克制：单项最多 14，控制类靠概率和持续轮数体现强度。
 */
export const skillEffectPresets: SkillEffectPreset[] = [
  {
    id: 'power-surge', name: '锋芒增幅', category: 'offense',
    summary: '短时间抬高魔力，让下一次攻击更重。',
    effect: { kind: 'buff', stat: 'magic', amount: 12, duration: 2 },
  },
  {
    id: 'guard-break', name: '破势', category: 'offense',
    summary: '压低敌方魔力，削弱它的反击。',
    effect: { kind: 'debuff', stat: 'magic', amount: 12, duration: 2 },
  },
  {
    id: 'true-aim', name: '锁定', category: 'offense',
    summary: '把注意力收束成一条线，提高命中。',
    effect: { kind: 'buff', stat: 'hit', amount: 10, duration: 2 },
  },
  {
    id: 'dust-veil', name: '迷眼', category: 'offense',
    summary: '用糖尘或碎光遮住视线，降低敌方命中。',
    effect: { kind: 'debuff', stat: 'hit', amount: 10, duration: 2 },
  },
  {
    id: 'peach-shield', name: '桃色护盾', category: 'defense',
    summary: '一层会替人疼的薄光，优先吸收伤害。',
    effect: { kind: 'shield', amount: 18, duration: 2 },
  },
  {
    id: 'glass-shield', name: '碎镜护壁', category: 'defense',
    summary: '更薄、更久，适合拖过一轮长线战斗。',
    effect: { kind: 'shield', amount: 12, duration: 3 },
  },
  {
    id: 'swift-step', name: '疾步', category: 'speed',
    summary: '脚步变轻，闪避与出手都更从容。',
    effect: { kind: 'buff', stat: 'agility', amount: 12, duration: 2 },
  },
  {
    id: 'sticky-syrup', name: '糖浆缠足', category: 'speed',
    summary: '让鞋底黏在地面上，拖慢敌方动作。',
    effect: { kind: 'debuff', stat: 'agility', amount: 12, duration: 2 },
  },
  {
    id: 'first-read', name: '先读', category: 'speed',
    summary: '提前半步看见动作，先手更靠前。',
    effect: { kind: 'buff', stat: 'initiative', amount: 10, duration: 2 },
  },
  {
    id: 'offbeat', name: '乱拍', category: 'speed',
    summary: '打乱敌方节奏，让它的先手落后。',
    effect: { kind: 'debuff', stat: 'initiative', amount: 10, duration: 2 },
  },
  {
    id: 'clear-sight', name: '澄明视界', category: 'mind',
    summary: '看穿伪装与月相里的漏洞。',
    effect: { kind: 'buff', stat: 'insight', amount: 14, duration: 3 },
  },
  {
    id: 'moon-blind', name: '月盲', category: 'mind',
    summary: '让对方的判断蒙上一层月雾。',
    effect: { kind: 'debuff', stat: 'insight', amount: 14, duration: 3 },
  },
  {
    id: 'empathy-link', name: '共感回路', category: 'mind',
    summary: '把彼此的呼吸接上，共情更稳定。',
    effect: { kind: 'buff', stat: 'empathy', amount: 14, duration: 3 },
  },
  {
    id: 'frosted-heart', name: '霜心', category: 'mind',
    summary: '让情绪暂时冻结，难以被理解。',
    effect: { kind: 'debuff', stat: 'empathy', amount: 14, duration: 3 },
  },
  {
    id: 'brief-stun', name: '短暂眩晕', category: 'control',
    summary: '打断一次行动，稳定但不够持久。',
    effect: { kind: 'stun', amount: 1, duration: 1, chance: 0.35 },
  },
  {
    id: 'deep-sleep', name: '深眠', category: 'control',
    summary: '把目标拖进两轮梦，命中率更低。',
    effect: { kind: 'stun', amount: 1, duration: 2, chance: 0.2 },
  },
  {
    id: 'burn-mark', name: '灼痕', category: 'sustain',
    summary: '留下会持续发热的伤口。',
    effect: { kind: 'dot', amount: 10, duration: 3 },
  },
  {
    id: 'corrosion', name: '腐蚀', category: 'sustain',
    summary: '更疼，但只持续两轮。',
    effect: { kind: 'dot', amount: 14, duration: 2 },
  },
  {
    id: 'spring-balm', name: '回春', category: 'sustain',
    summary: '缓慢愈合，适合长线消耗。',
    effect: { kind: 'regen', amount: 10, duration: 3 },
  },
  {
    id: 'night-lullaby', name: '夜安曲', category: 'sustain',
    summary: '短促而温柔的恢复，能顶住一轮爆发。',
    effect: { kind: 'regen', amount: 14, duration: 2 },
  },
];

export const effectPresetById = new Map(skillEffectPresets.map(preset => [preset.id, preset]));

export function findEffectPreset(id: string | undefined): SkillEffectPreset | undefined {
  return id ? effectPresetById.get(id) : undefined;
}
