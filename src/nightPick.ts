import type { Equipment, GameState, Mission, StatKey, WorkKind } from './types.ts';
import { baseCommissionPool } from './rules/missions.ts';
import { rollEnemies } from './rules/encounters.ts';
import { listItems } from './content/items.ts';
import { tierOf } from './items.ts';
import { hashText } from './rules/core.ts';
import { mulberry32 } from './content/archetypes.ts';

/**
 * v47：委托与装备改由「指定难度 + 本地抽模板」决定。
 *
 * 每日提案与蓝图阶段委托都不再让模型写时长、报酬、目标值、敌人组合，
 * 只写 title / description / work / difficulty；其余从真实委托模板里挑一条，
 * 数值与敌人原样沿用。装备同理：只指定阶级，从物品表里抽一件同阶成品。
 *
 * 抽取全部用种子做确定性随机：同一天同一份提案、同一张蓝图的同一幕，
 * 重开或读档都抽到同一条，不会读档变样。
 */

export interface PickedMission {
  template: Mission;
  work: WorkKind;
  difficulty: string;
  duration: number;
  reward: number;
  requirement: StatKey;
  target: number;
  rounds: number;
  recommendedLevel: number;
  enemyIds: string[];
  category: string;
}

const NIGHT_DIFF_ORDER = ['低危', '中危', '高危', '绝望'];

/** 按难度找最接近的一档（同档优先，否则取差值最小的，平手取更低危的那档）。 */
function nearestDifficulty(wanted: string, available: string[]): string | undefined {
  if (available.includes(wanted)) return wanted;
  const want = NIGHT_DIFF_ORDER.indexOf(wanted);
  if (want < 0 || !available.length) return available[0];
  let best = available[0];
  let bestGap = Number.POSITIVE_INFINITY;
  for (const candidate of available) {
    const index = NIGHT_DIFF_ORDER.indexOf(candidate);
    if (index < 0) continue;
    const gap = Math.abs(index - want);
    if (gap < bestGap) { best = candidate; bestGap = gap; }
  }
  return best;
}

/**
 * 抽一条委托模板并把它的数值摊平。
 * `work` 缺省时先按难度挑，战斗/调查都可能；`seed` 决定同种子内取哪一条。
 */
export function pickMissionTemplate(opts: {
  state?: GameState;
  work?: WorkKind;
  difficulty: string;
  seed: string;
}): PickedMission | undefined {
  const pool = baseCommissionPool.filter(mission => !mission.boss);
  if (!pool.length) return undefined;
  const byWork = opts.work ? pool.filter(mission => mission.work === opts.work) : pool;
  const usable = byWork.length ? byWork : pool;
  const difficulty = nearestDifficulty(opts.difficulty, usable.map(mission => mission.difficulty));
  const matched = usable.filter(mission => mission.difficulty === difficulty);
  const bag = matched.length ? matched : usable;
  const pick = bag[hashText(`${opts.seed}:${difficulty}:${opts.work ?? 'any'}`) % bag.length];
  if (!pick) return undefined;
  const enemyIds = pick.work !== 'combat'
    ? []
    : pick.enemyIds?.length
      ? [...pick.enemyIds]
      : opts.state
        ? rollEnemies(opts.state, { count: pick.enemyCount ?? 1, difficulty: pick.difficulty, pollution: 40, missionId: pick.id }).ids
        : [];
  return {
    template: pick,
    work: pick.work,
    difficulty: pick.difficulty,
    duration: pick.duration,
    reward: pick.reward,
    requirement: pick.requirement,
    target: pick.target,
    rounds: pick.rounds ?? 3,
    recommendedLevel: pick.recommendedLevel,
    enemyIds,
    category: pick.category,
  };
}

export type EquipmentSlot = 'weapon' | 'charm' | 'consumable';

/**
 * 按阶级抽一件成品装备。
 * 默认排除消耗品（奖励节点与掉落想要的是能留下来的东西）；同阶内按种子确定性随机。
 */
export function pickEquipmentOfTier(opts: {
  tier: number;
  slot?: EquipmentSlot;
  seed: string;
  /** 也允许消耗品（每日提案的 loot 想给补给时可以打开）。 */
  allowConsumable?: boolean;
}): Equipment | undefined {
  const tier = Math.max(1, Math.min(5, Math.round(opts.tier)));
  const pool = listItems().filter(item => {
    if (!opts.allowConsumable && item.slot === 'consumable') return false;
    if (opts.slot && item.slot !== opts.slot) return false;
    return tierOf(item) === tier;
  });
  if (!pool.length) return undefined;
  const pick = pool[hashText(`${opts.seed}:tier${tier}`) % pool.length];
  return pick ? { ...pick } : undefined;
}

/** 给测试与调试用：把种子转成一个稳定的 0–1 随机数。 */
export function seededRoll(seed: string): number {
  return mulberry32(hashText(seed))();
}
