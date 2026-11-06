import { loadBalance } from './balance.ts';
import { battleScore } from './missionTier.ts';
import type { CommissionWindow } from './shift.ts';
import type { GameState, Mission } from './types';

/**
 * v165：标准委托的星砂与经验口径。
 *
 * 星砂不再由模板随手写死，而是按队伍机会成本（星象台 300/人/小时）、
 * 治疗准备金和难度风险倍率计算；经验按魔物阶级/数量 × 时长计算。
 * Boss、势力首领、剧情委托不走这里。
 */

export const MISSION_REWARD_VERSION = 2;
export const MIN_REWARD = 520;
export const EXPEDITION_HOURLY = 300;
export const TREATMENT_PER_MEMBER = 160;

const RISK: Record<string, number> = { 低危: 1.15, 中危: 1.25, 高危: 1.45, 绝望: 1.70 };
const INVESTIGATION_THREAT: Record<string, number> = { 低危: 2, 中危: 4, 高危: 7, 绝望: 10 };

export interface MissionRewardInput {
  work: Mission['work'];
  difficulty: string;
  duration: number;
  enemyCount: number;
  window?: CommissionWindow;
  longDays?: number;
}

/** 急件与长期委托的时段修正；基础值只按难度、时长与编成算。 */
export function windowRewardMultiplier(window?: CommissionWindow, longDays?: number): number {
  if (window === 'urgent') return 1.15;
  if (window === 'long') return 0.95 + 0.12 * Math.max(2, Math.min(7, longDays ?? 2));
  return 1;
}

/** 战斗按推荐编成取 1/2/3 人；调查固定按 2 人算机会成本。 */
export function rewardTeamSize(work: Mission['work'], enemyCount: number): number {
  return work === 'combat' ? Math.min(3, Math.max(1, enemyCount)) : 2;
}

/** 标准委托的基础报酬；不含辖区修正，调用方再套 missionSnapshot。 */
export function missionRewardFor(input: MissionRewardInput): number {
  const team = rewardTeamSize(input.work, input.enemyCount);
  const opportunity = team * EXPEDITION_HOURLY * (input.duration / 60);
  const treatment = input.work === 'combat' ? team * TREATMENT_PER_MEMBER : 0;
  const risk = RISK[input.difficulty] ?? RISK['中危'];
  // 1–3 只已由队伍人数体现；超过 3 只才用数值页的多怪奖励补人。
  const countBonus = input.work === 'combat'
    ? 1 + Math.max(0, input.enemyCount - 3) * loadBalance().rewardPerExtraMonster / 100
    : 1;
  const base = (opportunity + treatment) * risk * countBonus;
  return Math.max(MIN_REWARD, Math.round(base * windowRewardMultiplier(input.window, input.longDays)));
}

/**
 * 委托的基础经验（不含胜利系数与个人升级上限）。
 *
 * 战斗：威胁值 = 魔物阶级权重之和（碎屑 1 / 游荡 2 / 灾厄 4 / 王座 7）。
 * 调查：没有魔物，按难度折算成 threat，再乘 0.5。
 */
export function missionBaseExp(mission: Pick<Mission, 'work' | 'difficulty' | 'duration' | 'enemyIds' | 'boss'>): number {
  const threat = mission.work === 'combat'
    ? battleScore(mission.enemyIds ?? []) + (mission.boss ? 7 : 0)
    : INVESTIGATION_THREAT[mission.difficulty] ?? 4;
  const scale = mission.work === 'combat' ? 1 : 0.5;
  return Math.max(0, Math.round((28 + 6 * threat) * (mission.duration / 60) * scale));
}

function isSpecialMission(mission: Mission): boolean {
  return Boolean(mission.boss || mission.faction || mission.envoy || mission.storylineId);
}

/**
 * 读档时重算未接取的标准委托；已接取/已完成不动，幂等。
 * 辖区修正用委托上已冻结的 environment.rewardPct，不重新冻结环境。
 */
export function rebaseOpenMissionRewards(state: GameState): number {
  let changed = 0;
  for (const mission of state.missions) {
    if (mission.status !== 'open' || mission.rewardVersion === MISSION_REWARD_VERSION) continue;
    if (isSpecialMission(mission)) continue;
    const base = missionRewardFor({
      work: mission.work,
      difficulty: mission.difficulty,
      duration: mission.duration,
      enemyCount: mission.enemyIds?.length ?? 0,
      window: mission.window,
      longDays: mission.longDays,
    });
    const env = 1 + (mission.environment?.rewardPct ?? 0) / 100;
    mission.reward = Math.max(MIN_REWARD, Math.round(base * env));
    mission.rewardVersion = MISSION_REWARD_VERSION;
    changed += 1;
  }
  return changed;
}
