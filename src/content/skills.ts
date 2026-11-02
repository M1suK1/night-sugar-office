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
  ['glimmer-spear', '星屑穿刺', '星光系', 'hp', 1, 1, 'enemy', 0, 'basic', [], '指尖压缩凝聚未曾祈愿的清冷星尘化为肉眼难辨的极细晶针，带着电离尖啸精准贯穿目标在地面游移的暗影虚核。'],
  ['peach-ward', '桃色庇护', '星光系', 'spirit', 0.9, 2, 'ally', 2, 'signature', [{ kind: 'shield', amount: 16, duration: 2 }], '以温润桃光在同伴周遭织就流转护幕，屏障在承受剧烈撞击碎裂的瞬间，将大部分震荡锐度悄然化散入周遭夜色。'],
  ['starlight-fall', '星环坠落', '星光系', 'hp', 1.2, 3, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'agility', amount: 12, duration: 2 }], '自战局上空召引出一道缓缓倾斜旋转的冰冷星环，伴随着重力场的扭曲失衡，如崩塌的碎裂夜幕般向敌阵轰然倾泻。'],
  ['star-tax', '星税', '星光系', 'spirit', 0.5, 6, 'enemy', 3, 'signature', [{ kind: 'debuff', stat: 'magic', amount: 10, duration: 2 }], '强制向整条街区亮起的灯火抽吸一截微光，化作大范围穿透射线覆盖敌阵，以光能损耗压制全场的法术回路。', { accuracy: 28 }],
  ['star-lantern', '提灯引路', '星光系', 'spirit', 0, 3, 'ally', 3, 'signature', [{ kind: 'shield', amount: 18, duration: 2 }], '执提灯巡夜前行，将清澄暖光洒落身侧同行队员的肩头，为直面暗影的小队构筑起隔绝精神迷失的心智坚墙。'],

  // ── 糖霜系 ────────────────────────────────────────────────────────────────
  ['sugar-needle', '糖针', '糖霜系', 'hp', 0.92, 1, 'enemy', 0, 'basic', [], '虚空中凝结出一枚锋利剔透的高纯度糖晶细针，刺入皮肉时伴随高热甜腻的刺痛，并在伤处残留微苦的坚硬结晶。'],
  ['goodnight-candy', '晚安糖果', '糖霜系', 'spirit', 1, 2, 'ally', 2, 'signature', [{ kind: 'regen', amount: 8, duration: 2 }], '将抚慰神经的心智灵光包裹进薄脆糖纸，含化瞬间温和暖流直抵受创神经，令疲惫队员泛起如陷枕席的深度休整。'],
  ['white-night-frost', '白夜糖霜', '糖霜系', 'spirit', 1.1, 3, 'ally', 4, 'ultimate', [{ kind: 'shield', amount: 22, duration: 2 }], '释放浩大的低温白夜糖霜法阵覆过全场，在暴烈交锋的间隙强行凝固空气中的创痛，为全员构筑坚实的冰晶护甲。'],
  ['candy-oath', '糖誓反噬', '糖霜系', 'spirit', 1.7, 1, 'enemy', 3, 'ultimate', [], '强行撕开封印心愿的脆弱糖纸，以自身共情反噬为代价，将糖晶誓言背后的狂暴碎屑以极限杀伤力轰入单个目标。', { accuracy: 58, selfEffects: [{ kind: 'debuff', stat: 'empathy', amount: 14, duration: 2 }] }],
  ['candy-thread', '糖丝缠缚', '糖霜系', 'spirit', 0.72, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.3 }], '甩出极富韧性与黏性的拉丝热糖，如捕虫网般在敌人机动回旋的路线间无声张开，缠锁关节使其失衡迟滞。', { accuracy: 40 }],

  // ── 月影系 ────────────────────────────────────────────────────────────────
  ['frequency-prick', '频率刺', '月影系', 'spirit', 1, 1, 'enemy', 0, 'basic', [], '截取穿梭在夜雾中的刺耳无线电杂波并将其极限锐化，化作一道隐秘的高频无形音刺，狠绝穿凿敌方的共振节点。'],
  ['silent-band', '静默全频', '月影系', 'spirit', 0.75, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.35 }], '在局部空间骤然剥离一切环境声响构筑绝对死寂的真空频段，令波及的目标在剧烈耳鸣与心跳轰鸣中短暂丧失行动指令。'],
  ['moon-phase', '月相解码', '月影系', 'spirit', 1.3, 1, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'insight', amount: 18, duration: 3 }], '借由月影折射提前测算出敌方回路的运行间隙，在对方尚未出招的刹那先发制人，大幅瓦解其战术洞察与感知体系。'],
  ['silent-tithe', '静默什一税', '月影系', 'spirit', 1.15, 2, 'enemy', 2, 'signature', [], '向周边声场强行抽取一成声波共鸣，以短时的视界微损为代价，将夺取的音波动能转化为刺击敌阵的无形暗潮。', { accuracy: 46, selfEffects: [{ kind: 'debuff', stat: 'insight', amount: 8, duration: 1 }] }],
  ['moon-echo', '月影回声', '月影系', 'spirit', 1.2, 2, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'agility', amount: 14, duration: 2 }], '借由苍白月影的空间延迟折射，将敌方打出的冲击音浪反向回弹，在半拍间隙里狠狠撞碎其移动步伐与身法重心。', { accuracy: 40 }],

  // ── 梦境系 ────────────────────────────────────────────────────────────────
  ['dream-touch', '梦触', '梦境系', 'spirit', 0.95, 1, 'enemy', 0, 'basic', [], '以虚化指尖轻触虚实边界，将敌方身躯所处的那一小方现实坐标强行折入浅层梦境，带来剥落般的深层精神钝击。'],
  ['sheep-nebula', '绵羊星云', '梦境系', 'spirit', 0.8, 2, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.45 }], '召引绵羊星云的低鸣回音漫过阵列，在朦胧催眠雾气中重度干扰敌方的神经反射，令其身形沉重恍惚难以自持。'],
  ['deep-dream-fall', '深梦坠落', '梦境系', 'hp', 1.2, 2, 'enemy', 4, 'ultimate', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.25 }], '将深层无底的梦境深渊生硬拖拽至现实维度，重压般的沉溺幻觉如同泥沼覆顶，剥夺敌人对攻防时机的敏锐把控。'],
  ['dream-loan', '借梦', '梦境系', 'spirit', 1.2, 2, 'enemy', 3, 'ultimate', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.3 }], '自未眠者的神智中预支一段暴烈幻景具现于战场，以自身共情损耗为契约账单，强行对敌阵轰出大范围的精神震慑。', { accuracy: 44, selfCost: { resource: 'spirit', pct: 18 } }],
  ['sheep-count', '数羊', '梦境系', 'spirit', 0.44, 6, 'enemy', 3, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.2 }], '极具催眠韵律的数羊回音波澜起伏铺开，将整条战线的敌阵注意力彻底涣散，令复数目标在呵欠连天中身心迟钝。', { accuracy: 24 }],

  // ── 自然系 ────────────────────────────────────────────────────────────────
  ['flower-thorn', '花刺', '自然系', 'hp', 0.9, 1, 'enemy', 0, 'basic', [], '自袖口轻巧甩出带有酸涩冷露的柔韧碧绿荆棘，以极迅疾的手法刺破护甲，在创口处留下阵阵麻痹的生机毒素。'],
  ['flower-prescription', '花间处方', '自然系', 'spirit', 0.95, 2, 'ally', 2, 'signature', [{ kind: 'regen', amount: 10, duration: 3 }], '细致研磨风干草药与生机花粉调和为温润药雾，借由纯净魔力循着经络注入同伴体内，令撕裂肌理在甘香中逐步重构自愈。'],
  ['spring-growth', '春日蔓生', '自然系', 'spirit', 1.15, 3, 'ally', 4, 'ultimate', [{ kind: 'regen', amount: 14, duration: 3 }, { kind: 'shield', amount: 12, duration: 2 }], '地砖缝隙间疯狂抽枝疯长出苍翠藤蔓，以磅礴生机编织为柔韧木壁环绕全员，在抵御外力冲击的同时徐徐回哺生机。'],
  ['thorn-garden', '荆棘庭园', '自然系', 'hp', 0.52, 6, 'enemy', 3, 'signature', [{ kind: 'dot', amount: 12, duration: 3 }], '让粗壮铁刺荆棘如潮水般破土封锁整片街区，狂乱扭结的刺条将受波及的敌阵全员割裂困锁，造成绵延不绝的撕裂创痛。', { accuracy: 26 }],
  ['root-bind', '根缚', '自然系', 'hp', 0.95, 1, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'agility', amount: 12, duration: 2 }], '悄然引导粗壮树根顺着地缝无声游走缠咬住目标脚踝，随后在刹那间死死绞紧，彻底封死敌方的闪转腾挪空间。', { accuracy: 62 }],

  // ── 赤焰系 ────────────────────────────────────────────────────────────────
  ['drumbeat', '鼓点', '赤焰系', 'hp', 1.05, 1, 'enemy', 0, 'basic', [], '将体内急促奔涌的心率与魔力骤然同调，法杖化作沉重节拍重击而出，裹挟着高温烈风的钝击狠狠砸向敌方防守薄弱处。'],
  ['finale-firework', '终幕焰火', '赤焰系', 'hp', 0.95, 2, 'enemy', 2, 'signature', [{ kind: 'dot', amount: 14, duration: 2 }], '在撤步换位的瞬间甩出骤然炸裂的高热火流，如同谢幕前最为耀眼的终曲焰火，以持续翻滚的余烬灼烧正面敌人。'],
  ['crimson-encore', '赤焰安可', '赤焰系', 'hp', 1.65, 1, 'enemy', 4, 'ultimate', [{ kind: 'buff', stat: 'magic', amount: 16, duration: 2 }], '将战场视为独一无二的舞台，以狂放的高温歌喉引爆周身法力回路，在烈焰翻滚中将自身输出能级推向峰值极限。'],
  ['red-reckoning', '赤色清算', '赤焰系', 'hp', 1.85, 1, 'enemy', 3, 'ultimate', [], '以自身鲜血与生命活力为引线强行点燃过载火核，将烈焰暴击的破坏力在瞬间放大数倍，换取毁灭性的单体轰杀。', { accuracy: 62, selfCost: { resource: 'hp', pct: 22 } }],
  ['ember-step', '余烬踏步', '赤焰系', 'hp', 0.68, 2, 'enemy', 1, 'signature', [{ kind: 'dot', amount: 10, duration: 2 }], '踏着尚未完全冷却的火雨焦屑疾进，法杖擦地带出连串飞溅火星，向敌方前排抛洒久久不熄的高温持续灼痕。', { accuracy: 52 }],

  // ── 魔物 ──────────────────────────────────────────────────────────────────
  ['monster-claw', '裂爪', '魔物', 'hp', 1, 1, 'enemy', 0, 'basic', [], '以违反解剖学逻辑的骨骼扭曲角度瞬间挥动尖锐裂爪，在撕裂空气时带出刺耳刮擦声，于无防备处留下血痕。'],
  ['monster-scream', '汽笛啸叫', '魔物', 'spirit', 0.9, 2, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'agility', amount: 14, duration: 2 }], '自喉腔深处爆发出一声超越人耳承载极限界限的工业金属汽笛啸叫，剧烈震荡令临近目标的肢体平衡彻底失控。'],
  ['monster-static', '轨道静电', '魔物', 'spirit', 0.48, 6, 'enemy', 3, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.3 }], '释放出长年积蓄于锈蚀铁轨上的冰冷幽灵静电场，密集的电弧狂乱跳跃乱窜，引发敌方神经反射短路并陷入僵直。'],
  ['monster-mirror', '镜面祷词', '魔物', 'spirit', 1, 2, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'insight', amount: 16, duration: 2 }], '使周围所有反射面同时折射回荡起晦涩阴郁的祷告低语，在千百重叠的倒影回声冲击下剧烈扰乱对手的心智洞察。'],
  ['monster-mosaic', '万花筒', '魔物', 'spirit', 0.46, 6, 'enemy', 3, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.35 }], '将周围视界内的微光硬生生切碎为千万片旋转万花筒，彻底剥夺战场的光影基准，令复数目标在极度晕眩中动弹不得。'],
  ['monster-sweet-decree', '甜腻诏令', '魔物', 'spirit', 0.55, 6, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'empathy', amount: 18, duration: 2 }], '残存王座深处的恶意甜气向四方播撒带有催眠意图的意志诏令，强行压迫全场生灵的心智意志，使其共情防线动摇。'],
  ['monster-dissolve', '溶解', '魔物', 'hp', 1, 2, 'enemy', 3, 'signature', [{ kind: 'dot', amount: 16, duration: 2 }], '地面汩汩渗出滚烫而黏稠的黑色废弃糖浆，一旦漫过鞋底便如强酸般灼蚀血肉，使受困者在剧痛中连同影子一同被消融。'],
  ['monster-scales', '鳞粉', '魔物', 'hp', 0.85, 2, 'enemy', 2, 'signature', [{ kind: 'dot', amount: 10, duration: 3 }], '扑棱双翼漫天倾洒微小如霜雪的细碎糖晶鳞粉，落在皮肤上便迅速生根吸热结晶，持续啃噬伤口周围的血肉生机。'],
  ['monster-gaze', '空月凝视', '魔物', 'spirit', 1.1, 2, 'enemy', 2, 'signature', [{ kind: 'debuff', stat: 'magic', amount: 16, duration: 2 }], '头颅处泛起宛如空月缩影般的冰冷白环，无瞳孔的苍白注视如利刃般扎入目标神智，无声压榨削弱其魔力输出。'],
  ['monster-tide', '引力潮汐', '魔物', 'hp', 0.56, 6, 'enemy', 3, 'signature', [], '畸变引力场骤然倾覆失控，整条街巷的质量中心仿佛瞬间侧倾滑塌，以蛮横的重压势能重重碾过全线敌人。'],
  ['monster-rot', '腐糖', '魔物', 'hp', 0.46, 6, 'enemy', 3, 'signature', [{ kind: 'dot', amount: 12, duration: 3 }], '向全场抛洒发酵变质、散发着刺鼻腥酸恶臭的腐烂黑糖胶质，黏附创口后久久难以洗净，带来痛彻心扉的毒蚀折磨。', { accuracy: 26 }],
  ['monster-lullaby', '摇篮曲', '魔物', 'spirit', 1, 1, 'enemy', 2, 'signature', [{ kind: 'stun', amount: 1, duration: 1, chance: 0.5 }], '哼唱出一段不带任何词句、调式诡异平缓的断奏小调，温柔而残忍地诱骗防备松弛的猎物卸下警惕、沉入长眠。', { accuracy: 42 }],
  ['monster-armor', '糖壳', '魔物', 'hp', 0, 1, 'self', 3, 'signature', [{ kind: 'shield', amount: 26, duration: 2 }], '调动周身糖霜在体表飞速凝固结晶为厚重的琥珀色坚壳，外力轰击时迸发出如巨钟轰鸣般的沉闷金属防偏声。'],
  ['monster-frenzy', '狂糖', '魔物', 'hp', 0, 1, 'self', 4, 'signature', [{ kind: 'buff', stat: 'magic', amount: 18, duration: 1 }], '高浓度狂暴糖精直冲核心神经引发不可逆的狂乱兴奋，虽令自身防御步伐大失分寸，却能在短时间内激发出破坏极值。', { accuracy: 58, selfEffects: [{ kind: 'debuff', stat: 'agility', amount: 12, duration: 2 }] }],

  // ── 通用（任何出身都能用，也是「无所属」与自定义登记的底牌）────────────────
  ['plain-strike', '素手', '通用', 'hp', 1, 1, 'enemy', 0, 'basic', [], '不依托任何花哨术法回路的沉重直拳，凝聚全身肌肉与重量悍然直击，以最纯粹的物理动能破开对手防线。', { accuracy: 60 }],
  ['steady-hand', '稳手', '通用', 'hp', 0.9, 1, 'enemy', 1, 'basic', [], '深呼吸强行稳住颤抖手腕发出一记平稳重击，虽以短时专注过度导致的视界模糊为代价，却能换来极高的着力精度。', { accuracy: 68, selfEffects: [{ kind: 'debuff', stat: 'insight', amount: 6, duration: 1 }] }],
  ['borrowed-time', '借来的时间', '通用', 'spirit', 0, 1, 'self', 4, 'signature', [{ kind: 'regen', amount: 12, duration: 1 }], '调动精神强行压榨尚未支取的明日生机回补当下一口气力，代价则是四肢在后续战局中因透支而显得沉重迟缓。', { selfEffects: [{ kind: 'debuff', stat: 'agility', amount: 10, duration: 2 }] }],
  ['cut-loss', '止损', '通用', 'hp', 0.46, 6, 'enemy', 3, 'signature', [], '以绝决的自残魄力强行剥除已被法蚀浸染的表层皮肉，将溃散势能反向化作重击风暴，以此搏取全线防守的喘息契机。', { accuracy: 26, selfCost: { resource: 'hp', pct: 8 } }],
  ['hold-the-line', '守住门口', '通用', 'spirit', 0, 2, 'ally', 3, 'signature', [{ kind: 'shield', amount: 20, duration: 2 }], '将法杖横架于退路门廊前方寸土不让，以绝不后退的守护意念构筑起厚重光幕，为身后的同伴抵挡一切冲击。'],
  ['night-prayer', '夜祷回响', '通用', 'spirit', 0.85, 2, 'ally', 3, 'signature', [{ kind: 'regen', amount: 9, duration: 2 }], '轻声默念镌刻于戒圈内侧的隐秘古祷词，温暖微光沿着指缝注入受创同伴身躯，令深可见骨的撕裂创面缓缓重新咬合。'],
  ['star-vigil', '守夜灯', '通用', 'spirit', 0, 3, 'ally', 4, 'signature', [{ kind: 'shield', amount: 30, duration: 2 }, { kind: 'regen', amount: 6, duration: 2 }], '将提灯法杖高高擎起照亮四方虚空，只要身处这束不灭冷光庇护之下，受创的心防与伤势便能在稳定节奏中被徐徐抚平。'],
  ['verdict-seal', '一纸裁决', '通用', 'hp', 1.15, 1, 'enemy', 4, 'ultimate', [{ kind: 'debuff', stat: 'hit', amount: 14, duration: 2 }], '念毕整段冰冷审判文书后将印信重重按在虚空之中，强行以此纸裁决将面前强敌的攻势因果逆向抹除，大幅封杀其命中准星。', { accuracy: 72 }],
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
