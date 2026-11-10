/**
 * 魔法少女对战的人数口径（v237）。
 *
 * 只处理「对面是人」的战斗：辖区当主的拦截战、势力的破坏行动。
 * 规则是双方最多三人，且我方编队不得超过对面出场人数（1v1 / 2v2 / 3v3）。
 * 魔物委托与 Boss 战不在这里改，仍走原来的 `squadLimit`。
 */
import { canIntercept, rosterMembers } from '../factions.ts';
import type { GameState, Mission } from '../types.ts';
import { envoyRaidSquadIds } from './envoy.ts';
import { squadLimit } from './roster.ts';

/** 魔法少女对战单边最多几人。 */
export const MAX_DUEL_SIDE = 3;

/** 拦截战对面会派几个人：推荐等级每 4 级多一个，夹在 1–3。 */
export function interceptionSquadSize(mission: Pick<Mission, 'recommendedLevel'>): number {
  const level = Number.isFinite(mission.recommendedLevel) ? mission.recommendedLevel : 1;
  return Math.max(1, Math.min(MAX_DUEL_SIDE, 1 + Math.floor(level / 4)));
}

/**
 * 这一场最终对上的是不是魔法少女；是的话返回对面人数。
 *
 * 与 `interceptionFor` 用同一套公式与同一份名册，所以界面上的上限不会和结算差一档。
 * 破坏行动在建单时就把对面阵容写进了 `interception`；旧档没写时按同一业务日重算。
 */
export function duelOpponents(state: GameState, mission: Mission): number | undefined {
  const known = mission.interception?.girlIds?.length ?? 0;
  if (known) return Math.max(1, Math.min(MAX_DUEL_SIDE, known));
  if (mission.envoyKind === 'raid' && mission.envoyTarget) {
    const day = mission.spawnedAt ? Math.floor(mission.spawnedAt / 1440) : state.day;
    const legacy = envoyRaidSquadIds(state, mission.envoyTarget, day).length;
    return legacy ? Math.min(MAX_DUEL_SIDE, legacy) : undefined;
  }
  if (!canIntercept(state, mission)) return undefined;
  const owner = mission.district ? state.territories[mission.district] : undefined;
  if (!owner) return undefined;
  const roster = rosterMembers(state, owner);
  return Math.max(1, Math.min(interceptionSquadSize(mission), roster.length));
}

/** 这场委托最多能派几个人：对上魔法少女时与对面人数相等，否则沿用原规则。 */
export function squadLimitFor(state: GameState, mission: Mission): number {
  return duelOpponents(state, mission) ?? squadLimit(mission);
}
