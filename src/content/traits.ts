import type { Trait, TraitPolarity } from '../types';

type SeedTrait = [id: string, name: string, polarity: TraitPolarity, tags: string, description: string];

const seed: SeedTrait[] = [
  ['cat-sense', '猫缘', 'positive', '猫,夜,温柔', '流浪猫会主动靠近她，猫类事件更愿意把她卷进来。'],
  ['sweet-tooth', '甜食依赖', 'neutral', '甜食,压力', '压力大时更想去糖果街，也更容易被甜味线索吸引。'],
  ['clean-freak', '洁癖', 'negative', '洁净,强迫', '脏乱的现场会让她分心，她也会坚持把基地擦得一尘不染。'],
  ['fear-dark', '怕黑', 'negative', '黑暗,恐惧', '独自进入没有灯的地方时，她会先停下脚步。'],
  ['protective', '护短', 'positive', '同伴,冲突', '同伴受辱时，她可能当面顶撞玩家。'],
  ['perfectionist', '完美主义', 'negative', '工作,执念', '连续失败会让她更疲惫，也更难接受“差不多”。'],
  ['star-allergy', '星象过敏', 'neutral', '星象,身体', '在星象台待久了会头晕，但能听见别人听不见的回声。'],
  ['grudge', '记仇', 'negative', '冲突,记忆', '关系下降后，她需要更长时间才愿意恢复。'],
  ['collector', '收集癖', 'neutral', '物件,城市', '喜欢把无主的小东西带回家，也更容易提出逛街意见。'],
  ['rain-melancholy', '雨夜忧郁', 'negative', '雨,孤独', '雨夜里的她话更少，但写下的句子更长。'],
  ['talkative', '话痨', 'positive', '人群,表达', '议事厅里最常发言的人，常常也是最先跑题的人。'],
  ['quiet', '沉默寡言', 'neutral', '独处,观察', '她很少提意见，但交回来的情报通常更准。'],
  ['night-owl', '夜行性', 'positive', '夜,工作', '深夜出勤时精神更好，白天反而容易困。'],
  ['sugar-rush', '糖分亢奋', 'neutral', '甜食,战斗', '开战前吃糖会让她更兴奋，也更容易冲得太前。'],
  ['moon-bound', '月相牵引', 'neutral', '月,星象', '月圆前后情绪起伏明显，星象类事件更容易找上她。'],
  ['tidy-hands', '巧手', 'positive', '物件,修复', '擅长修理小东西，基地设施损坏时能帮上忙。'],
  ['sleepless', '浅眠', 'negative', '夜,疲劳', '很难睡整觉，休息恢复的疲劳略少。'],
  ['loyal', '恋旧', 'positive', '记忆,同伴', '对旧物与旧人很难放手，返聘时羁绊下降更少。'],
  ['curious', '好奇心', 'neutral', '调查,城市', '听到奇怪的声音就想去看，调查类事件更愿意接。'],
  ['stage-fright', '怯场', 'negative', '人群,表达', '被太多人注视时会僵住，议事厅发言更少。'],
  ['cat-nap', '随处打盹', 'neutral', '猫,休息', '能在任何地方睡着，休息时恢复更快。'],
  ['clock-sense', '钟表直觉', 'positive', '钟声,时间', '总能准确说出过了多久，对时间类异常敏感。'],
  ['sweet-scent', '甜味记号', 'neutral', '甜食,追踪', '身上总有一点糖味，追踪时容易被发现，也容易被记住。'],
  ['scarred-pride', '伤痕自尊', 'negative', '疤痕,执念', '不愿让人看见疤痕，治疗时会刻意避开同伴。'],
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
