import type { GameState } from './types.ts';
import { incidentPoolNeed } from './incidents.ts';

/** 首夜本地兜底要凑到的议案条数。 */
export const OPENING_OPINIONS = 3;
/** 首夜本地兜底要凑到的待用弹窗事件条数。 */
export const OPENING_INCIDENTS = 3;
/** 开局从卡库摆出来的选人池上限（没被选中的留在市场）。 */
export const OPENING_CARDS = 20;

export interface OpeningGaps {
  /** 待处理议案还差几条。 */
  opinions: number;
  /** 待用弹窗池还差几条。 */
  incidents: number;
  /** 委托还差几条（留两个空位给叙事者）。 */
  missions: number;
  /** 候选少女还差几位。 */
  candidates: number;
  /** 自建魔物还差几只。 */
  monsters: number;
}

/**
 * 首夜空缺：本地能补的只有议案与弹窗事件；
 * 委托、候选与魔物要叙事者现写，这里只用来判断「值不值得去请求一次」。
 */
export function openingGaps(state: GameState): OpeningGaps {
  const pendingOpinions = state.opinions.filter(opinion => opinion.status === 'pending').length;
  const openMissions = state.missions.filter(mission => mission.status === 'open' || mission.status === 'active').length;
  const ownedMonsters = state.customMonsters.filter(monster => !monster.id.startsWith('boss-mon-')).length;
  return {
    opinions: Math.max(0, OPENING_OPINIONS - pendingOpinions),
    incidents: Math.max(0, Math.min(OPENING_INCIDENTS, incidentPoolNeed(state))),
    missions: Math.max(0, state.poolLimits.missions - 2 - openMissions),
    candidates: Math.max(0, state.poolLimits.candidates - state.candidates.length),
    monsters: Math.max(0, state.poolLimits.monsters - ownedMonsters),
  };
}

/** 首夜还有没有值得补的东西。 */
export function openingNeed(state: GameState): boolean {
  const gaps = openingGaps(state);
  return gaps.opinions > 0 || gaps.incidents > 0 || gaps.missions > 0 || gaps.candidates > 0 || gaps.monsters > 0;
}

/** 一句话说明这一夜还缺什么，给界面用。 */
export function openingLabel(state: GameState): string {
  const gaps = openingGaps(state);
  const parts: string[] = [];
  if (gaps.opinions > 0) parts.push(`${gaps.opinions} 条议题`);
  if (gaps.incidents > 0) parts.push(`${gaps.incidents} 个待用事件`);
  if (gaps.missions > 0) parts.push(`${gaps.missions} 条委托`);
  if (gaps.candidates > 0) parts.push(`${gaps.candidates} 位候选`);
  if (gaps.monsters > 0) parts.push(`${gaps.monsters} 只魔物`);
  return parts.length ? `今夜还缺 ${parts.join('、')}` : '今夜该有的都有了';
}
