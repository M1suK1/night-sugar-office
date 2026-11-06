/**
 * 委托失败的代价（v167）。
 *
 * 以前打输了只掉一点安定与好感，星砂一分不赔，委托还会放回池子重来 ——
 * 玩家感觉不到「失败」，只会觉得自己在刷一次免费的尝试。
 *
 * 这里把「赔多少、掉谁的好感」算成纯函数，**结算与预览共用**，
 * 不会出现「预览说赔 300、结算只赔 100」这种谎报。
 */
import type { BalanceRules } from './balance.ts';
import type { FactionId, GameState, Mission } from './types.ts';

export interface FailurePenalty {
  /** 实际会扣掉的星砂（已按手头余额封顶，绝不为负）。 */
  gold: number;
  /** 按规则本来该赔多少（余额不够时 > gold，用来解释「一分也赔不出来」）。 */
  due: number;
  /** 还要额外掉好感的势力。 */
  standing: { faction: FactionId; amount: number }[];
}

/** 违约金：报酬的一个百分比，压一个下限，再按手头余额封顶。 */
export function failurePenaltyOf(mission: Pick<Mission, 'reward'>, gold: number, rules: BalanceRules): FailurePenalty {
  const pct = Math.max(0, rules.missionFailurePenaltyPct ?? 20);
  const floor = Math.max(0, rules.missionFailurePenaltyMin ?? 50);
  const due = Math.max(floor, Math.round(Math.max(0, mission.reward ?? 0) * pct / 100));
  return { gold: Math.max(0, Math.min(Math.max(0, Math.round(gold)), due)), due, standing: [] };
}

/**
 * 一次失败的完整代价。
 *
 * 势力代表委托（共建 / 破坏）赔钱之外还要多掉一档好感 —— 你拿了他的任务书却没办成，
 * 他在自己人面前是要丢脸的。
 */
export function failurePenaltyFor(state: GameState, mission: Mission, rules: BalanceRules): FailurePenalty {
  const base = failurePenaltyOf(mission, state.gold, rules);
  const faction = mission.envoyFaction;
  if (mission.envoyKind && faction) {
    base.standing.push({ faction, amount: Math.max(0, rules.envoyFailureExtraStandingLoss ?? 2) });
  }
  return base;
}

/** 一句话概括代价，预览与日志共用同一套措辞。 */
export function failurePenaltyText(penalty: FailurePenalty): string {
  const standing = penalty.standing.length
    ? `；${penalty.standing.map(entry => `该势力好感 −${entry.amount}`).join('、')}`
    : '';
  if (penalty.due > penalty.gold) return `违约金 ${penalty.due} 星砂（手头只有 ${penalty.gold}，扣到 0）${standing}，安定度 −3。`;
  if (penalty.gold > 0) return `违约金 ${penalty.gold} 星砂${standing}，安定度 −3。`;
  return `没有额外的违约金${standing}，安定度 −3。`;
}
