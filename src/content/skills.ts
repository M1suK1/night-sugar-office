import type { Skill, SkillEffect, SkillResource, SkillSide, SkillTier } from '../types';

type Seed = [id: string, name: string, school: string, resource: SkillResource, power: number, targets: number, side: SkillSide, cooldown: number, tier: SkillTier, effects: SkillEffect[], description: string];

const seed: Seed[] = [
  ['glimmer-spear', '星屑穿刺', '星光系', 'hp', 1, 1, 'enemy', 0, 'basic', [], '把一颗尚未许愿的星压成细针，精准地钉进目标的影子。'],
  ['peach-ward', '桃色庇护', '星光系', 'spirit', 0.9, 2, 'ally', 2, 'signature', [{ kind: 'shield', amount: 16, duration: 2 }], '用桃色的光织成一层薄薄的护幕，护幕碎裂时会把疼痛分摊给夜色。'],
  ['starlight-fall', '星环坠落', '星光系', 'hp', 1.35, 3, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'agility', amount: 12, duration: 2 }], '让一圈星环在战场上方缓缓倾斜，然后整片夜空砸下来。'],

  ['sugar-needle', '糖针', '糖霜系', 'hp', 0.92, 1, 'enemy', 0, 'basic', [], '一枚结晶糖针，甜得发苦。砂糖从不解释配方。'],
  ['goodnight-candy', '晚安糖果', '糖霜系', 'spirit', 1, 2, 'ally', 2, 'signature', [{ kind: 'regen', amount: 8, duration: 2 }], '把「今晚可以睡个好觉」包进糖纸里。吃下去的人会想起柔软的枕头。'],
  ['white-night-frost', '白夜糖霜', '糖霜系', 'spirit', 1.1, 3, 'ally', 4, 'ultimate', [{ kind: 'shield', amount: 22, duration: 2 }], '整座城市像被糖霜轻轻覆盖。所有伤口都暂时安静下来。'],

  ['frequency-prick', '频率刺', '月影系', 'spirit', 1, 1, 'enemy', 0, 'basic', [], '把一段杂音削尖，刺进灵体的共振频率。'],
  ['silent-band', '静默全频', '月影系', 'spirit', 0.75, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.35 }], '关掉所有频道，只留下心跳。目标会短暂忘记如何行动。'],
  ['moon-phase', '月相解码', '月影系', 'spirit', 1.3, 1, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'insight', amount: 18, duration: 3 }], '零青读出月相里的漏洞，把敌人的下一步提前写进过去。'],

  ['dream-touch', '梦触', '梦境系', 'spirit', 0.95, 1, 'enemy', 0, 'basic', [], '指尖碰到梦的边缘，现实就少了一小块。'],
  ['sheep-nebula', '绵羊星云', '梦境系', 'spirit', 0.8, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.45 }], '数到第七只羊时，敌人会发现自己的影子正在打盹。'],
  ['deep-dream-fall', '深梦坠落', '梦境系', 'hp', 1.2, 2, 'enemy', 4, 'ultimate', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.25 }], '把整片战场拖进一场没有底的梦。雾眠说，掉下去其实不可怕。'],

  ['flower-thorn', '花刺', '自然系', 'hp', 0.9, 1, 'enemy', 0, 'basic', [], '从袖口抽出一根带露水的刺。栀子会在事后向花道歉。'],
  ['flower-prescription', '花间处方', '自然系', 'spirit', 0.95, 2, 'ally', 2, 'signature', [{ kind: 'regen', amount: 10, duration: 3 }], '每一种伤口都有适合的春天。她只是把春天碾成粉，兑进温水。'],
  ['spring-growth', '春日蔓生', '自然系', 'spirit', 1.15, 3, 'ally', 4, 'ultimate', [{ kind: 'regen', amount: 14, duration: 3 }, { kind: 'shield', amount: 12, duration: 2 }], '藤蔓从地板缝里长出来，把所有人轻轻围住。'],

  ['drumbeat', '鼓点', '赤焰系', 'hp', 1.05, 1, 'enemy', 0, 'basic', [], '鹿铃把心跳敲成鼓点，第一下就落在敌人肋骨上。'],
  ['finale-firework', '终幕焰火', '赤焰系', 'hp', 0.95, 2, 'enemy', 2, 'signature', [{ kind: 'dot', amount: 14, duration: 2 }], '安可前的最后一束焰火。她总说，谢幕要亮一点。'],
  ['crimson-encore', '赤焰安可', '赤焰系', 'hp', 1.65, 1, 'enemy', 4, 'ultimate', [{ kind: 'buff', stat: 'magic', amount: 16, duration: 2 }], '把整场演出重新点燃。观众只有一个人，但她唱给整条街听。'],

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

  ['night-prayer', '夜祷回响', '月影系', 'spirit', 0.85, 2, 'ally', 3, 'signature', [{ kind: 'regen', amount: 9, duration: 2 }], '指环内侧的祷词被念出来时，伤口会先于记忆合拢。'],
];

export const skills: Skill[] = seed.map(([id, name, school, resource, power, targets, side, cooldown, tier, effects, description]) => ({ id, name, school, resource, power, targets, side, cooldown, tier, effects, description }));
export const skillById = new Map(skills.map(s => [s.id, s]));
/** 严格查询：找不到就返回 undefined，调用方决定如何提示，不再假装它是第一个技能。 */
export function findSkill(id: string | undefined): Skill | undefined {
  return id ? skillById.get(id) : undefined;
}
export function getSkill(id: string): Skill {
  return findSkill(id) ?? skills[0];
}
export const tierLabels: Record<SkillTier, string> = { basic: '基础', signature: '本职', ultimate: '奥义' };
export const resourceLabels: Record<SkillResource, string> = { hp: '血量', spirit: '共情值' };
export const effectKindLabels: Record<SkillEffect['kind'], string> = {
  dot: '持续伤害', stun: '眩晕', shield: '护盾', buff: '增益', debuff: '减益', regen: '持续恢复',
};
export function effectText(e: SkillEffect): string {
  const stat = e.stat ? ` ${e.stat === 'hit' ? '命中' : e.stat === 'initiative' ? '先手' : e.stat === 'magic' ? '魔力' : e.stat === 'insight' ? '洞察' : e.stat === 'agility' ? '敏捷' : '共情'}` : '';
  const chance = e.chance ? ` · ${Math.round(e.chance * 100)}%` : '';
  return `${e.label ?? effectKindLabels[e.kind]}${stat} ${e.amount} · ${e.duration} 轮${chance}`;
}
