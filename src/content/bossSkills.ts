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
    description: '冰冷月光被无形巨手纺织为飘忽垂落的薄纱迷雾，笼罩战场时视线与感知全遭折射，令受困其中的攻势彻底失去准星。',
  },
  {
    id: 'boss-tide-of-names', name: '名字的潮', school: 'Boss', resource: 'spirit', power: 0.9,
    targets: 3, side: 'enemy', cooldown: 2, tier: 'boss', accuracy: 40,
    effects: [{ kind: 'dot', amount: 16, duration: 2 }],
    description: '长夜中被无数次绝望呼唤过的牺牲者名册化为深黑灵潮，自废墟地表汩汩翻涌漫过脚踝，持续腐蚀着活人的意志。',
  },
  {
    id: 'boss-second-moon', name: '第二个月亮', school: 'Boss', resource: 'hp', power: 0.35,
    targets: 6, side: 'enemy', cooldown: 4, tier: 'boss', accuracy: 55,
    effects: [
      { kind: 'stun', amount: 1, duration: 1, chance: 0.25 },
      { kind: 'debuff', stat: 'agility', amount: 10, duration: 2 },
    ],
    selfEffects: [{ kind: 'buff', stat: 'magic', amount: 20, duration: 3 }],
    description: '夜幕顶端赫然翻转出另一轮不应存在的惨白倒影月相，两重天体引力交错撕扯，引爆大范围的重力失衡与精神震荡。',
  },
  {
    id: 'boss-collapse', name: '塌缩', school: 'Boss', resource: 'hp', power: 2,
    targets: 1, side: 'enemy', cooldown: 3, tier: 'boss', accuracy: 66,
    selfCost: { resource: 'hp', pct: 20 },
    effects: [],
    description: '强行以暴烈的自残威能塌缩身侧的虚空坐标，将整片空间生硬凹折凿穿，将敌方核心撕扯出毁灭性的重压创口。',
  },
  {
    id: 'boss-sugar-crown', name: '糖冠诏书', school: 'Boss', resource: 'spirit', power: 0,
    targets: 1, side: 'self', cooldown: 4, tier: 'boss',
    effects: [
      { kind: 'buff', stat: 'empathy', amount: 18, duration: 2 },
      { kind: 'shield', amount: 24, duration: 2 },
    ],
    description: '端坐王座之上的天灾以喑哑共鸣宣读属于自己的加冕辞令，咒文流淌之处，翻滚的糖晶自愈护幕与共情激荡随之强行具现。',
  },
  {
    id: 'boss-mirror-litany', name: '镜面连祷', school: 'Boss', resource: 'spirit', power: 1.4,
    targets: 2, side: 'enemy', cooldown: 2, tier: 'boss', accuracy: 52,
    effects: [{ kind: 'debuff', stat: 'insight', amount: 16, duration: 2 }],
    description: '周遭无数散落的碎镜面同时回荡起重叠交错的低沉圣咏，在来回反射的音浪冲击下，受击者的洞察神智陷入剧烈混乱。',
  },
  {
    id: 'boss-clock-hands', name: '钟针倒转', school: 'Boss', resource: 'spirit', power: 0.5,
    targets: 6, side: 'enemy', cooldown: 3, tier: 'boss', accuracy: 24,
    effects: [{ kind: 'dot', amount: 14, duration: 2 }],
    description: '旧钟楼那柄斑驳锈蚀的铜质指针突兀向后逆行弹跳一格，在时间回流的错乱法则下，此前已被愈合的旧创被强行重新撕裂。',
  },
  {
    id: 'boss-name-erasure', name: '名字抹除', school: 'Boss', resource: 'spirit', power: 2.05,
    targets: 1, side: 'enemy', cooldown: 4, tier: 'boss', accuracy: 40,
    effects: [],
    selfEffects: [{ kind: 'debuff', stat: 'insight', amount: 12, duration: 2 }],
    description: '调动深渊最残酷的因果剪除权柄，将目标的存在痕迹强行自当夜名册抹去，以自身视界短时模糊为代价重创其灵魂本源。',
  },
];

export const bossSkillById = new Map(bossSkills.map(skill => [skill.id, skill]));
