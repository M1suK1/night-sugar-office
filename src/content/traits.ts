import type { Trait, TraitPolarity } from '../types';

type SeedTrait = [id: string, name: string, polarity: TraitPolarity, tags: string, description: string];

const seed: SeedTrait[] = [
  ['cat-sense', '猫缘', 'positive', '猫,夜,温柔', '在深夜穿行于阴暗巷弄时格外受流浪猫的亲近依赖，涉足涉猫异象或追踪线索时总会成为最先被注意到的焦点。'],
  ['sweet-tooth', '甜食依赖', 'neutral', '甜食,压力', '每当出勤疲惫或压力攀升时对糖分的渴望便格外强烈，极易被街区空气中弥漫的焦糖与香精气味牵引走神。'],
  ['clean-freak', '洁癖', 'negative', '洁净,强迫', '对废墟现场的污泥血迹与杂乱陈设怀有强烈的排斥本能，出勤归来哪怕深夜也定要将自己的制服与桌面擦拭如新。'],
  ['fear-dark', '怕黑', 'negative', '黑暗,恐惧', '对完全失去光源的死角怀有深层本能畏惧，独自步入无灯街区时会不由自主地放缓脚步、呼吸加重。'],
  ['protective', '护短', 'positive', '同伴,冲突', '平日看似克制收敛，但只要并肩作战的同伴遭遇外界无端贬损，即便面对所长也敢于当场直言抗辩。'],
  ['perfectionist', '完美主义', 'negative', '工作,执念', '对自己与团队的标准极其苛刻，连续受挫会成倍加深其精神损耗，绝不容许以敷衍草率的交代结案。'],
  ['star-allergy', '星象过敏', 'neutral', '星象,身体', '身处空旷高台时极易受高维引力干扰而眩晕，但耳朵却能敏锐捕捉到常人难以察觉的星象低语与空间共鸣。'],
  ['grudge', '记仇', 'negative', '冲突,记忆', '看似冷淡自持实则心思深沉，一旦在争执或冷落中心生隔阂，需要长久温和的日常相处方能慢慢重新破冰。'],
  ['collector', '收集癖', 'neutral', '物件,城市', '对路边被遗弃的旧发卡、小铁盒等无主物件怀有莫名留恋，总忍不住带回抽屉收藏，闲暇时也更偏好市集闲逛。'],
  ['rain-melancholy', '雨夜忧郁', 'negative', '雨,孤独', '每逢冷雨连绵的深宵整个人会变得格外沉默，但在执勤记录与备忘纸条上留下的笔触却异乎寻常的详实细腻。'],
  ['talkative', '话痨', 'positive', '人群,表达', '在会客厅议案讨论中思维活跃且表达欲极强，发言频率最高，却也最容易顺着琐事联想而不知不觉偏离议题。'],
  ['quiet', '沉默寡言', 'neutral', '独处,观察', '在长桌例会上向来寡言少语、不争虚名，但出勤排查后提交归档的线索笔记往往最为精准扎实。'],
  ['night-owl', '夜行性', 'positive', '夜,工作', '生物钟完全倒向深宵阴影，午夜之后的巡逻行动中反应力与精神格外敏锐，而在日出拂晓时分则极易哈欠连连。'],
  ['sugar-rush', '糖分亢奋', 'neutral', '甜食,战斗', '战前习惯通过咀嚼高浓度硬糖刺激神经回路，这让她战意昂扬的同时，偶尔也会因步调过快而脱离阵型。'],
  ['moon-bound', '月相牵引', 'neutral', '月,星象', '受城市上空月相盈亏潮汐的牵扯极其显著，满月周期内心绪波动加剧，对星象异变维度的异象感应尤为强烈。'],
  ['tidy-hands', '巧手', 'positive', '物件,修复', '拥有一双对精细机械与微小物件极富耐心的巧手，在基地各类管线设备发生老化松脱时总能沉着拆解修缮。'],
  ['sleepless', '浅眠', 'negative', '夜,疲劳', '神经始终维持着潜意识的警惕防备，即便躺在宿舍软床上也极易惊醒，深度睡眠对疲劳的化解效率稍显缓慢。'],
  ['loyal', '恋旧', 'positive', '记忆,同伴', '骨子里极度看重过往情分与旧时习惯，即便在退役返聘等动荡关头，彼此积累的信任羁绊也绝不会轻易褪色。'],
  ['curious', '好奇心', 'neutral', '调查,城市', '对隐匿在雨水与墙缝深处的怪异杂音怀有旺盛的好奇天性，面对因果未明的复杂调查委托时行动最为主动。'],
  ['stage-fright', '怯场', 'negative', '人群,表达', '在受到多道目光同时聚焦时会感到肢体拘谨与呼吸紧绷，因而在多方代表齐聚的大型议事场合往往倾向保持静默。'],
  ['cat-nap', '随处打盹', 'neutral', '猫,休息', '具备随时随地迅速沉入深层放松的特殊体格，即便倚着简陋椅背小憩片刻，也能以惊人的效率恢复精力。'],
  ['clock-sense', '钟表直觉', 'positive', '钟声,时间', '仿佛体内天然长着一枚精密发条钟摆，无需看表便能精确报时，对时钟倒转或空间滞缓等诡变嗅觉敏锐。'],
  ['sweet-scent', '甜味记号', 'neutral', '甜食,追踪', '体表魔力自然逸散出微不可察的天然焦糖甘香，这在隐匿潜伏时稍显劣势，却往往更容易被市民与同伴辨识铭记。'],
  ['scarred-pride', '伤痕自尊', 'negative', '疤痕,执念', '自尊心极其要强，本能地抗拒将受创伤痕示于人前，在接受药浴处理时总是刻意等同伴离开后才肯褪下外衫。'],
];

export const traits: Trait[] = seed.map(([id, name, polarity, tags, description]) => ({
  id, name, polarity, tags: tags.split(','), description,
}));
export const traitById = new Map(traits.map(trait => [trait.id, trait]));

export function pickTraits(seedValue: number, count: number, owned: string[]): Trait[] {
  const pool = traits.filter(trait => !owned.includes(trait.id));
  const picked: Trait[] = [];
  let cursor = seedValue || 1;
  while (picked.length < count && pool.length) {
    cursor = (cursor * 1664525 + 1013904223) >>> 0;
    const index = cursor % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

export function traitPolarityLabel(polarity: TraitPolarity): string {
  return polarity === 'positive' ? '正面' : polarity === 'negative' ? '负面' : '中性';
}
