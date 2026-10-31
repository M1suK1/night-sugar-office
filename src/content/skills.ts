import type { Skill, SkillEffect, SkillResource, SkillSide, SkillTier } from '../types';

/** 技能的附加字段：命中率、施放代价、自挂效果。 */
interface Extra {
  accuracy?: number;
  selfCost?: { resource: SkillResource; pct: number };
  selfEffects?: SkillEffect[];
}

type Seed = [
  id: string, name: string, school: string, resource: SkillResource, power: number,
  targets: number, side: SkillSide, cooldown: number, tier: SkillTier,
  effects: SkillEffect[], description: string, extra?: Extra,
];

/**
 * 技能池：50 条，魔法少女与魔物共用同一张表。
 *
 * - `school` 只是流派标签（也是筛选条件），不是「谁能用」的开关；魔物抢到星光系技能、
 *   少女打出魔物系技能都合法，只看 `side` 对不对得上。
 * - 新写的条目都显式给 `accuracy`，让命中率是设计出来的数字；旧的 29 条留空，
 *   按目标数推导（见 `defaultSkillAccuracy`）。
 * - Boss 专属技能不在这张表里，见 `src/content/bossSkills.ts`。
 */
const seed: Seed[] = [
  // ── 星光系 ────────────────────────────────────────────────────────────────
  ['glimmer-spear', '星屑穿刺', '星光系', 'hp', 1, 1, 'enemy', 0, 'basic', [], '把一颗尚未许愿的星压成细针，精准地钉进目标的影子。'],
  ['peach-ward', '桃色庇护', '星光系', 'spirit', 0.9, 2, 'ally', 2, 'signature', [{ kind: 'shield', amount: 16, duration: 2 }], '用桃色的光织成一层薄薄的护幕，护幕碎裂时会把疼痛分摊给夜色。'],
  ['starlight-fall', '星环坠落', '星光系', 'hp', 1.2, 3, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'agility', amount: 12, duration: 2 }], '让一圈星环在战场上方缓缓倾斜，然后整片夜空砸下来。'],
  ['star-tax', '星税', '星光系', 'spirit', 0.5, 6, 'enemy', 3, 'signature', [{ kind: 'debuff', stat: 'magic', amount: 10, duration: 2 }], '每一盏还亮着的灯都被收走一小截光，账单平摊给整条街。', { accuracy: 28 }],
  ['star-lantern', '提灯引路', '星光系', 'spirit', 0, 3, 'ally', 3, 'signature', [{ kind: 'shield', amount: 18, duration: 2 }], '提灯的人走在最前面，被灯照到的人暂时不会迷路。'],

  // ── 糖霜系 ────────────────────────────────────────────────────────────────
  ['sugar-needle', '糖针', '糖霜系', 'hp', 0.92, 1, 'enemy', 0, 'basic', [], '一枚结晶糖针，甜得发苦。砂糖从不解释配方。'],
  ['goodnight-candy', '晚安糖果', '糖霜系', 'spirit', 1, 2, 'ally', 2, 'signature', [{ kind: 'regen', amount: 8, duration: 2 }], '把「今晚可以睡个好觉」包进糖纸里。吃下去的人会想起柔软的枕头。'],
  ['white-night-frost', '白夜糖霜', '糖霜系', 'spirit', 1.1, 3, 'ally', 4, 'ultimate', [{ kind: 'shield', amount: 22, duration: 2 }], '整座城市像被糖霜轻轻覆盖。所有伤口都暂时安静下来。'],
  ['candy-oath', '糖誓反噬', '糖霜系', 'spirit', 1.7, 1, 'enemy', 3, 'ultimate', [], '把糖纸里那句诺言撕开，甜的背面全是碎的。', { accuracy: 58, selfEffects: [{ kind: 'debuff', stat: 'empathy', amount: 14, duration: 2 }] }],
  ['candy-thread', '糖丝缠缚', '糖霜系', 'spirit', 0.72, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.3 }], '拉丝的糖比蛛网更耐心，它会等目标自己缠上来。', { accuracy: 40 }],

  // ── 月影系 ────────────────────────────────────────────────────────────────
  ['frequency-prick', '频率刺', '月影系', 'spirit', 1, 1, 'enemy', 0, 'basic', [], '把一段杂音削尖，刺进灵体的共振频率。'],
  ['silent-band', '静默全频', '月影系', 'spirit', 0.75, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.35 }], '关掉所有频道，只留下心跳。目标会短暂忘记如何行动。'],
  ['moon-phase', '月相解码', '月影系', 'spirit', 1.3, 1, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'insight', amount: 18, duration: 3 }], '零青读出月相里的漏洞，把敌人的下一步提前写进过去。'],
  ['silent-tithe', '静默什一税', '月影系', 'spirit', 1.15, 2, 'enemy', 2, 'signature', [], '所有声音都要交出一成，交不出来的那部分被悄悄拿走。', { accuracy: 46, selfEffects: [{ kind: 'debuff', stat: 'insight', amount: 8, duration: 1 }] }],
  ['moon-echo', '月影回声', '月影系', 'spirit', 1.2, 2, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'agility', amount: 14, duration: 2 }], '你喊出去的那一声会从月亮的方向返回来，只是慢了半拍。', { accuracy: 40 }],

  // ── 梦境系 ────────────────────────────────────────────────────────────────
  ['dream-touch', '梦触', '梦境系', 'spirit', 0.95, 1, 'enemy', 0, 'basic', [], '指尖碰到梦的边缘，现实就少了一小块。'],
  ['sheep-nebula', '绵羊星云', '梦境系', 'spirit', 0.8, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.45 }], '数到第七只羊时，敌人会发现自己的影子正在打盹。'],
  ['deep-dream-fall', '深梦坠落', '梦境系', 'hp', 1.2, 2, 'enemy', 4, 'ultimate', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.25 }], '把整片战场拖进一场没有底的梦。雾眠说，掉下去其实不可怕。'],
  ['dream-loan', '借梦', '梦境系', 'spirit', 1.2, 2, 'enemy', 3, 'ultimate', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.3 }], '先把别人的梦借来用一用，账记在自己身上。', { accuracy: 44, selfCost: { resource: 'spirit', pct: 18 } }],
  ['sheep-count', '数羊', '梦境系', 'spirit', 0.44, 6, 'enemy', 3, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.2 }], '一只、两只、三只……数到第六只时，整条街都开始打哈欠。', { accuracy: 24 }],

  // ── 自然系 ────────────────────────────────────────────────────────────────
  ['flower-thorn', '花刺', '自然系', 'hp', 0.9, 1, 'enemy', 0, 'basic', [], '从袖口抽出一根带露水的刺。栀子会在事后向花道歉。'],
  ['flower-prescription', '花间处方', '自然系', 'spirit', 0.95, 2, 'ally', 2, 'signature', [{ kind: 'regen', amount: 10, duration: 3 }], '每一种伤口都有适合的春天。她只是把春天碾成粉，兑进温水。'],
  ['spring-growth', '春日蔓生', '自然系', 'spirit', 1.15, 3, 'ally', 4, 'ultimate', [{ kind: 'regen', amount: 14, duration: 3 }, { kind: 'shield', amount: 12, duration: 2 }], '藤蔓从地板缝里长出来，把所有人轻轻围住。'],
  ['thorn-garden', '荆棘庭园', '自然系', 'hp', 0.52, 6, 'enemy', 3, 'signature', [{ kind: 'dot', amount: 12, duration: 3 }], '整片街区一夜之间长出荆棘，谁站着不动谁就被缠住。', { accuracy: 26 }],
  ['root-bind', '根缚', '自然系', 'hp', 0.95, 1, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'agility', amount: 12, duration: 2 }], '砖缝里的根找到了脚踝，然后很有礼貌地收紧。', { accuracy: 62 }],

  // ── 赤焰系 ────────────────────────────────────────────────────────────────
  ['drumbeat', '鼓点', '赤焰系', 'hp', 1.05, 1, 'enemy', 0, 'basic', [], '鹿铃把心跳敲成鼓点，第一下就落在敌人肋骨上。'],
  ['finale-firework', '终幕焰火', '赤焰系', 'hp', 0.95, 2, 'enemy', 2, 'signature', [{ kind: 'dot', amount: 14, duration: 2 }], '安可前的最后一束焰火。她总说，谢幕要亮一点。'],
  ['crimson-encore', '赤焰安可', '赤焰系', 'hp', 1.65, 1, 'enemy', 4, 'ultimate', [{ kind: 'buff', stat: 'magic', amount: 16, duration: 2 }], '把整场演出重新点燃。观众只有一个人，但她唱给整条街听。'],
  ['red-reckoning', '赤色清算', '赤焰系', 'hp', 1.85, 1, 'enemy', 3, 'ultimate', [], '把自己的血先浇上去，火才有理由烧得那么旺。', { accuracy: 62, selfCost: { resource: 'hp', pct: 22 } }],
  ['ember-step', '余烬踏步', '赤焰系', 'hp', 0.68, 2, 'enemy', 1, 'signature', [{ kind: 'dot', amount: 10, duration: 2 }], '踩着还没冷下去的灰往前走，每一步都在烧。', { accuracy: 52 }],

  // ── 魔物 ──────────────────────────────────────────────────────────────────
  ['monster-claw', '裂爪', '魔物', 'hp', 1, 1, 'enemy', 0, 'basic', [], '用不合常理的角度撕开空气。'],
  ['monster-scream', '汽笛啸叫', '魔物', 'spirit', 0.9, 2, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'agility', amount: 14, duration: 2 }], '一声不属于任何站台的汽笛。'],
  ['monster-static', '轨道静电', '魔物', 'spirit', 0.48, 6, 'enemy', 3, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.3 }], '铁轨上积了太久的静电荷。'],
  ['monster-mirror', '镜面祷词', '魔物', 'spirit', 1, 2, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'insight', amount: 16, duration: 2 }], '每一面镜子都在念同一句祷词。'],
  ['monster-mosaic', '万花筒', '魔物', 'spirit', 0.46, 6, 'enemy', 3, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.35 }], '光被切成太多块，方向失去了意义。'],
  ['monster-sweet-decree', '甜腻诏令', '魔物', 'spirit', 0.55, 6, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'empathy', amount: 18, duration: 2 }], '王座上的糖发出命令，所有人忽然很想服从。'],
  ['monster-dissolve', '溶解', '魔物', 'hp', 1, 2, 'enemy', 3, 'signature', [{ kind: 'dot', amount: 16, duration: 2 }], '糖浆漫过脚踝，连影子都开始融化。'],
  ['monster-scales', '鳞粉', '魔物', 'hp', 0.85, 2, 'enemy', 2, 'signature', [{ kind: 'dot', amount: 10, duration: 3 }], '细小的糖鳞落下来，像一场不祥的雪。'],
  ['monster-gaze', '空月凝视', '魔物', 'spirit', 1.1, 2, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'magic', amount: 16, duration: 2 }], '月亮没有瞳孔，但你确定它在看你。'],
  ['monster-tide', '引力潮汐', '魔物', 'hp', 0.56, 6, 'enemy', 3, 'signature', [], '整条街的重量忽然朝同一个方向倾斜。'],
  ['monster-rot', '腐糖', '魔物', 'hp', 0.46, 6, 'enemy', 3, 'signature', [{ kind: 'dot', amount: 12, duration: 3 }], '甜味放坏了，比任何毒都黏人。', { accuracy: 26 }],
  ['monster-lullaby', '摇篮曲', '魔物', 'spirit', 1, 1, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.5 }], '没有词的曲子，听的人会想躺下。', { accuracy: 42 }],
  ['monster-armor', '糖壳', '魔物', 'hp', 0, 1, 'self', 3, 'signature', [{ kind: 'shield', amount: 26, duration: 2 }], '把自己裹进一层硬糖，敲起来像敲一口钟。'],
  ['monster-frenzy', '狂糖', '魔物', 'hp', 0, 1, 'self', 4, 'signature', [{ kind: 'buff', stat: 'magic', amount: 18, duration: 1 }], '糖分冲上头顶，接下来做什么它自己也不清楚。', { accuracy: 58, selfEffects: [{ kind: 'debuff', stat: 'agility', amount: 12, duration: 2 }] }],

  // ── 通用（任何出身都能用，也是「无所属」与自定义登记的底牌）────────────────
  ['plain-strike', '素手', '通用', 'hp', 1, 1, 'enemy', 0, 'basic', [], '没有花招的一拳，谁都会。', { accuracy: 60 }],
  ['steady-hand', '稳手', '通用', 'hp', 0.9, 1, 'enemy', 1, 'basic', [], '稳住手，就能稳住这一下；代价是接下来看得没那么清。', { accuracy: 68, selfEffects: [{ kind: 'debuff', stat: 'insight', amount: 6, duration: 1 }] }],
  ['borrowed-time', '借来的时间', '通用', 'spirit', 0, 1, 'self', 4, 'signature', [{ kind: 'regen', amount: 12, duration: 1 }], '先向自己借一点明天，利息是今晚跑不快。', { selfEffects: [{ kind: 'debuff', stat: 'agility', amount: 10, duration: 2 }] }],
  ['cut-loss', '止损', '通用', 'hp', 0.46, 6, 'enemy', 3, 'signature', [], '割掉已经烂掉的部分，剩下的才守得住。', { accuracy: 26, selfCost: { resource: 'hp', pct: 8 } }],
  ['hold-the-line', '守住门口', '通用', 'spirit', 0, 2, 'ally', 3, 'signature', [{ kind: 'shield', amount: 20, duration: 2 }], '门后面是还睡着的人，所以这道门不能丢。'],
  ['night-prayer', '夜祷回响', '通用', 'spirit', 0.85, 2, 'ally', 3, 'signature', [{ kind: 'regen', amount: 9, duration: 2 }], '指环内侧的祷词被念出来时，伤口会先于记忆合拢。'],
  ['star-vigil', '守夜灯', '通用', 'spirit', 0, 3, 'ally', 4, 'signature', [{ kind: 'shield', amount: 30, duration: 2 }, { kind: 'regen', amount: 6, duration: 2 }], '灯举起来的时候，站在光里的三个人都不许走失。'],
  ['verdict-seal', '一纸裁决', '通用', 'hp', 1.15, 1, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'hit', amount: 14, duration: 2 }], '把名字念完，把纸按下去；这一夜它就当作没有发生过。', { accuracy: 72 }],
];

export const skills: Skill[] = seed.map(([id, name, school, resource, power, targets, side, cooldown, tier, effects, description, extra]) => {
  const skill: Skill = { id, name, school, resource, power, targets, side, cooldown, tier, effects, description };
  if (extra?.accuracy !== undefined) skill.accuracy = extra.accuracy;
  if (extra?.selfCost) skill.selfCost = extra.selfCost;
  if (extra?.selfEffects) skill.selfEffects = extra.selfEffects;
  return skill;
});
export const skillById = new Map(skills.map(s => [s.id, s]));
/** 严格查询：找不到就返回 undefined，调用方决定如何提示，不再假装它是第一个技能。 */
export function findSkill(id: string | undefined): Skill | undefined {
  return id ? skillById.get(id) : undefined;
}
export function getSkill(id: string): Skill {
  return findSkill(id) ?? skills[0];
}
export const tierLabels: Record<SkillTier, string> = { basic: '基础', signature: '本职', ultimate: '奥义', boss: 'Boss' };
export const resourceLabels: Record<SkillResource, string> = { hp: '血量', spirit: '共情值' };
export const effectKindLabels: Record<SkillEffect['kind'], string> = {
  dot: '持续伤害', stun: '眩晕', shield: '护盾', buff: '增益', debuff: '减益', regen: '持续恢复', drain: '吸血', purify: '净化',
};
/** 流派标签：筛选与图鉴共用，顺序即 UI 顺序。 */
export const skillSchools = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物', '通用'] as const;
export const tierOrder: SkillTier[] = ['basic', 'signature', 'ultimate'];
export function effectText(e: SkillEffect): string {
  const stat = e.stat ? ` ${e.stat === 'hit' ? '命中' : e.stat === 'initiative' ? '先手' : e.stat === 'magic' ? '魔力' : e.stat === 'insight' ? '洞察' : e.stat === 'agility' ? '敏捷' : '共情'}` : '';
  const chance = e.chance ? ` · ${Math.round(e.chance * 100)}%` : '';
  return `${e.label ?? effectKindLabels[e.kind]}${stat} ${e.amount} · ${e.duration} 轮${chance}`;
}
/** 技能的一行摘要：命中 / 目标 / 自扣，用在详情与回放里。 */
export function skillSummary(skill: Skill): string {
  const parts: string[] = [];
  parts.push(skill.side === 'enemy' ? `命中 ${skillAccuracyOf(skill)}%` : '必中');
  parts.push(`${skill.targets} 目标`);
  if (skill.selfCost) parts.push(`自扣 ${skill.selfCost.pct}% ${resourceLabels[skill.selfCost.resource]}`);
  return parts.join(' · ');
}
/** 与 `combat.ts` 的同名推导保持一致的本地实现，避免内容层反向依赖战斗层。 */
function skillAccuracyOf(skill: Skill): number {
  if (skill.accuracy !== undefined) return Math.min(95, Math.max(20, Math.round(skill.accuracy)));
  const count = Math.min(6, Math.max(1, Math.round(skill.targets || 1)));
  return Math.min(95, Math.max(20, 50 - 6 * (count - 1)));
}
