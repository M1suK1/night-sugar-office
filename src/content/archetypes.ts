import type { Archetype, StatKey } from '../types';

export type PlayableArchetype = Exclude<Archetype, '魔物'>;

export const archetypes: PlayableArchetype[] = ['输出', '守护', '治愈', '控制', '侦查'];

export const archetypeDescriptions: Record<PlayableArchetype, string> = {
  输出: '抢先击破核心，魔力与敏捷优先。',
  守护: '替同伴挡住第一击，共情与洞察优先。',
  治愈: '维持队伍的灵魂与生命，共情优先。',
  控制: '打乱敌方节奏，洞察与魔力优先。',
  侦查: '先看见危险，洞察与敏捷优先。',
};

const allocations: Record<PlayableArchetype, Record<StatKey, number>> = {
  输出: { magic: 92, insight: 52, agility: 72, empathy: 44 },
  守护: { magic: 58, insight: 60, agility: 54, empathy: 88 },
  治愈: { magic: 52, insight: 68, agility: 44, empathy: 96 },
  控制: { magic: 74, insight: 92, agility: 48, empathy: 46 },
  侦查: { magic: 46, insight: 92, agility: 82, empathy: 40 },
};

/** 260 points total, every stat inside the 40–96 creation range. */
export function statsForArchetype(archetype: PlayableArchetype): Record<StatKey, number> {
  return { ...allocations[archetype] };
}
