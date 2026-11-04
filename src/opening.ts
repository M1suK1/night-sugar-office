import type { GameState } from './types.ts';
import { CARD_FILE_BYTES_MAX } from './fileLimits.ts';
import { incidentPoolNeed } from './incidents.ts';
import { spawnableMonsters } from './rules/encounters.ts';

/**
 * 首夜本地要补到的议案条数。
 *
 * v85：会客厅等级决定每天最多摆几条议题（2 级 3 条 … 4 级 5 条），开局补缺也跟着走。
 */
export const OPENING_OPINIONS = 3;

/** 当前会客厅能摆几条议题（2 级 3 条、3 级 4 条、4 级 5 条）。 */
export function councilCapacity(state: GameState): number {
  const lounge = state.rooms.find(room => room.type === 'lounge');
  return Math.max(3, Math.min(5, 1 + (lounge?.level ?? 2)));
}
/** 首夜本地兜底要凑到的待用弹窗事件条数。 */
export const OPENING_INCIDENTS = 3;
/**
 * 第一次空月最早出现在第几日。
 *
 * 开局是第 14 夜：原本 16 日就挂空月，玩家只有两夜发育——招不起人、也练不出等级。
 * 现在留足十天（第 24 夜），足够招人、升两三级、攒一笔钱再上桌。
 */
export const FIRST_BOSS_DAY = 24;

/** 开局从卡库摆出来的选人池上限（没被选中的留在市场）。 */
export const OPENING_CARDS = 30;

/**
 * 开局预读的卡数。
 *
 * 现在是 0：点「开始新游戏」不读任何卡，先打开卡库让玩家自己挑，挑完再按选择导入。
 * 读图那几秒因此落在玩家已经做完决定之后，也不会再把「默认前几张」硬塞进名册。
 */
export const OPENING_IMPORT_CARDS = 0;
/**
 * 开局愿意一次性读进内存的卡面总量。
 *
 * 一张带 1024 立绘的卡约 2–3MB，30 张就是 60–90MB。v92 之后落盘时立绘会搬进资产库、
 * 存档里只留引用，所以这套上限管的是开局那一次读卡；第一次导入卡之后就会瘦下来。
 * 预算按「单张卡上限 ×2」给，够把 30 人的选人池铺满大半。超过预算的卡留在卡库里，
 * 由市场按缺口逐日补货（`refillMarket` 会按 hash 单张读）。
 */
export const OPENING_CARD_BYTES = CARD_FILE_BYTES_MAX * 2;

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
  // 魔物按「真实能上场的」算：注册表里的魔物 + 自制魔物，不再按复制出来的池子条目数。
  const monsterPool = spawnableMonsters(state).length;
  return {
    opinions: Math.max(0, councilCapacity(state) - pendingOpinions),
    incidents: Math.max(0, Math.min(OPENING_INCIDENTS, incidentPoolNeed(state))),
    missions: Math.max(0, state.poolLimits.missions - openMissions),
    candidates: Math.max(0, state.poolLimits.candidates - state.candidates.length),
    monsters: Math.max(0, state.poolLimits.monsters - monsterPool),
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
