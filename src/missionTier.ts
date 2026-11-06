/**
 * 战斗委托的难度分级（v161）。
 *
 * 以前难度是手写的：同样是「1 只游荡」会分别出现在低危、中危、高危。
 * 这里按魔物阶级加权、再按总分归档，模板、工坊、运行时的战斗委托共用一套口径。
 */
import { findMonster } from './content/monsters.ts';
import { suggestedLevel } from './missionLevel.ts';

export type MissionTier = '低危' | '中危' | '高危' | '绝望';

export const TIER_ORDER: MissionTier[] = ['低危', '中危', '高危', '绝望'];

/** 阶级权重：数量越多、阶级越高，分数越高。 */
export const RANK_WEIGHT: Record<string, number> = {
  碎屑: 1,
  游荡: 2,
  灾厄: 4,
  王座: 7,
};

/** 未知魔物按「游荡」估，宁可高估也不要让一单凭空变简单。 */
const UNKNOWN_WEIGHT = 2;

export function battleScore(enemyIds: readonly string[] = []): number {
  return enemyIds.reduce((sum, id) => sum + (RANK_WEIGHT[findMonster(id)?.rank ?? ''] ?? UNKNOWN_WEIGHT), 0);
}

export function tierForScore(score: number): MissionTier {
  if (score <= 2) return '低危';
  if (score <= 5) return '中危';
  if (score <= 9) return '高危';
  return '绝望';
}

/** 一份编成的完整评级：档位、分数、只数。 */
export function gradeOfEnemies(enemyIds: readonly string[] = []): { tier: MissionTier; score: number; count: number } {
  const score = battleScore(enemyIds);
  return { tier: tierForScore(score), score, count: enemyIds.length };
}

/** 推荐等级：档位起底，按只数加档（和工坊的 suggestedLevel 同一套）。 */
export function missionLevelFor(tier: MissionTier, count: number): number {
  return suggestedLevel(tier, count);
}

export function tierRank(tier: string): number {
  const index = TIER_ORDER.indexOf(tier as MissionTier);
  return index < 0 ? 1 : index;
}

/** 低危在前、同档内编成更重的在前。 */
export function compareMissionsByTier(
  a: { difficulty: string; enemyIds?: readonly string[] },
  b: { difficulty: string; enemyIds?: readonly string[] },
): number {
  return tierRank(a.difficulty) - tierRank(b.difficulty)
    || battleScore(b.enemyIds) - battleScore(a.enemyIds);
}
