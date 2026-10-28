import type { Girl } from './types';

const WITCH_TRAITS = [
  '偏执', '冷酷', '易怒', '多疑', '嫉妒',
  '控制欲强', '占有欲强', '缺乏同理心', '沉迷疼痛', '习惯用甜言蜜语诱捕靠近的人',
];

function sentence(text: string): string {
  const clean = text.trim().replace(/[。.!！?？\s]+$/, '');
  return clean ? `${clean}。` : '';
}

/** 魔女化后默认追加的负面性格；保留原本执念，但把表达扭曲成占有。 */
export function defaultWitchPersonality(girl: Pick<Girl, 'personality'>): string {
  const base = sentence(girl.personality);
  return `${base}魔女化后，她变得${WITCH_TRAITS.join('、')}。原本的执念还在，只是被扭曲成了不肯放手的占有：她会把疼痛说成亲昵，把威胁说成挽留，也会用温柔的语气要求你永远留在她身边。`;
}

/** 当前形态下实际用于展示与叙事的性格描述。 */
export function activePersonality(girl: Pick<Girl, 'personality' | 'witch' | 'witchPersonality'>): string {
  if (!girl.witch) return girl.personality;
  return girl.witchPersonality?.trim() || defaultWitchPersonality(girl);
}
