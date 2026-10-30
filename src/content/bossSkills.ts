import type { Skill } from '../types';

/**
 * Boss 专属技能：只挂在 Boss 单位上，不进少女 / 魔物的公共池子。
 *
 * - `tier` 全部是 `boss`，`girlSkillPool()` / `monsterSkillPool()` 会把它们滤掉，
 *   内容工坊与契约卡导入也拒绝这个阶级。
 * - 数值按「一条能改变局势」来写：倍率高但命中低，或者干脆是场面控制。
 */
export const bossSkills: Skill[] = [
  {
    id: 'boss-hollow-veil', name: '空月纱', school: 'Boss', resource: 'spirit', power: 0.4,
    targets: 6, side: 'enemy', cooldown: 3, tier: 'boss', accuracy: 60,
    effects: [{ kind: 'debuff', stat: 'hit', amount: 10, duration: 2 }],
    description: '月光被纺成纱，罩下来的时候所有人都看不清自己在打哪里。',
  },
  {
    id: 'boss-tide-of-names', name: '名字的潮', school: 'Boss', resource: 'spirit', power: 0.9,
    targets: 3, side: 'enemy', cooldown: 2, tier: 'boss', accuracy: 40,
    effects: [{ kind: 'dot', amount: 16, duration: 2 }],
    description: '被念过太多次的名字浮上来，像涨潮一样漫过脚踝。',
  },
  {
    id: 'boss-second-moon', name: '第二个月亮', school: 'Boss', resource: 'hp', power: 0.35,
    targets: 6, side: 'enemy', cooldown: 4, tier: 'boss', accuracy: 55,
    effects: [
      { kind: 'stun', amount: 1, duration: 1, chance: 0.25 },
      { kind: 'debuff', stat: 'agility', amount: 10, duration: 2 },
    ],
    selfEffects: [{ kind: 'buff', stat: 'magic', amount: 20, duration: 3 }],
    description: '天上明明只有一个月亮，可它翻过来的时候，另一面也在发光。',
  },
  {
    id: 'boss-collapse', name: '塌缩', school: 'Boss', resource: 'hp', power: 2,
    targets: 1, side: 'enemy', cooldown: 3, tier: 'boss', accuracy: 66,
    selfCost: { resource: 'hp', pct: 20 },
    effects: [],
    description: '把身边的一小块空间按进去，代价是自己也少了一块。',
  },
  {
    id: 'boss-sugar-crown', name: '糖冠诏书', school: 'Boss', resource: 'spirit', power: 0,
    targets: 1, side: 'self', cooldown: 4, tier: 'boss',
    effects: [
      { kind: 'buff', stat: 'empathy', amount: 18, duration: 2 },
      { kind: 'shield', amount: 24, duration: 2 },
    ],
    description: '王座上的糖宣读自己的加冕词，读到哪一句，哪一句就变成真的。',
  },
  {
    id: 'boss-mirror-litany', name: '镜面连祷', school: 'Boss', resource: 'spirit', power: 1.4,
    targets: 2, side: 'enemy', cooldown: 2, tier: 'boss', accuracy: 52,
    effects: [{ kind: 'debuff', stat: 'insight', amount: 16, duration: 2 }],
    description: '每一面碎镜都在念同一段祷词，念到第二遍时你已经分不清哪句是自己想的。',
  },
  {
    id: 'boss-clock-hands', name: '钟针倒转', school: 'Boss', resource: 'spirit', power: 0.5,
    targets: 6, side: 'enemy', cooldown: 3, tier: 'boss', accuracy: 24,
    effects: [{ kind: 'dot', amount: 14, duration: 2 }],
    description: '钟楼的指针往回走了一格，所有人身上多出一段本来已经过去的伤。',
  },
  {
    id: 'boss-name-erasure', name: '名字抹除', school: 'Boss', resource: 'spirit', power: 2.05,
    targets: 1, side: 'enemy', cooldown: 4, tier: 'boss', accuracy: 40,
    effects: [],
    selfEffects: [{ kind: 'debuff', stat: 'insight', amount: 12, duration: 2 }],
    description: '它把你的名字从这一夜的名册上划掉，划完自己也忘了一部分。',
  },
];

export const bossSkillById = new Map(bossSkills.map(skill => [skill.id, skill]));
