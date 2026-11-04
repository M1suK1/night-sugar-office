/**
 * 星象台远行的收益口径。
 *
 * 单独放一个文件是为了避免循环依赖：missions.ts（代表委托里的借调报价）要读这套数值，
 * 而 time.ts（真正的每小时结算）已经依赖 missions.ts。两边都从这里取，谁也不用反过来引。
 */
import { loadBalance } from './balance.ts';
import type { GameState } from './types.ts';

/** 每人每小时的基础收益与经验（1 级星象台）。 */
export const EXPEDITION_GOLD_PER_HOUR = 300;
export const EXPEDITION_EXP_PER_HOUR = 10;

/** 星象台当前等级。 */
export function observatoryLevelOf(state: Pick<GameState, 'rooms'>): number {
  return state.rooms.find(room => room.type === 'observatory')?.level ?? 1;
}

/** 当前星象台每人每小时能带回多少星砂（每升 1 级 +expeditionGoldPerLevel）。 */
export function expeditionGoldPerHour(state: Pick<GameState, 'rooms'>): number {
  const level = observatoryLevelOf(state);
  return EXPEDITION_GOLD_PER_HOUR + Math.max(0, level - 1) * loadBalance().expeditionGoldPerLevel;
}
