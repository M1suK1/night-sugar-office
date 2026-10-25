import type { Archetype, StatKey } from '../types';

export type PlayableArchetype = Exclude<Archetype, '魔物'>;

export const STAT_MIN = 40;
export const STAT_MAX = 90;
export const STAT_TOTAL = 260;

export const archetypes: PlayableArchetype[] = ['输出', '守护', '治愈', '控制', '侦查'];

export const archetypeDescriptions: Record<PlayableArchetype, string> = {
  输出: '抢先击破核心，魔力与敏捷优先。',
  守护: '替同伴挡住第一击，共情与洞察优先。',
  治愈: '维持队伍的灵魂与生命，共情优先。',
  控制: '打乱敌方节奏，洞察与魔力优先。',
  侦查: '先看见危险，洞察与敏捷优先。',
};

const allocations: Record<PlayableArchetype, Record<StatKey, number>> = {
  输出: { magic: 88, insight: 54, agility: 72, empathy: 46 },
  守护: { magic: 58, insight: 60, agility: 54, empathy: 88 },
  治愈: { magic: 56, insight: 68, agility: 48, empathy: 88 },
  控制: { magic: 78, insight: 88, agility: 48, empathy: 46 },
  侦查: { magic: 46, insight: 88, agility: 86, empathy: 40 },
};

/** Every preset stays inside 40–90 and totals exactly 260. */
export function statsForArchetype(archetype: PlayableArchetype): Record<StatKey, number> {
  const stats = { ...allocations[archetype] };
  const keys = Object.keys(stats) as StatKey[];
  for (const key of keys) stats[key] = Math.max(STAT_MIN, Math.min(STAT_MAX, Math.round(stats[key])));
  let remainder = STAT_TOTAL - keys.reduce((sum, key) => sum + stats[key], 0);
  let guard = 0;
  while (remainder !== 0 && guard++ < 1000) {
    const candidates = keys.filter(key => remainder > 0 ? stats[key] < STAT_MAX : stats[key] > STAT_MIN);
    if (!candidates.length) break;
    candidates.sort((a, b) => remainder > 0 ? stats[a] - stats[b] : stats[b] - stats[a]);
    stats[candidates[0]] += remainder > 0 ? 1 : -1;
    remainder += remainder > 0 ? -1 : 1;
  }
  return stats;
}
