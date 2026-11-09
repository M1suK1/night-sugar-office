import type { EndingRecord, GameState } from './types.ts';

/** 目前只有离城这一条终局。 */
export const LEAVE_ENDING = {
  id: 'leave' as const,
  title: '离城',
  epilogue: '樱雾市的灯还亮着，你已经不在其中。事务所留着最后一盏灯，等哪天有人回来把它重新点亮。',
};

export interface LeaveProgress {
  current: number;
  target: number;
  pct: number;
  ready: boolean;
  done: boolean;
  record?: EndingRecord;
}

export function endingRecordOf(state: GameState): EndingRecord | undefined {
  return (state.endings ?? []).find(record => record.id === 'leave');
}

/** 离城进度：只看当前星砂与门槛，不写任何缓存。 */
export function leaveProgress(state: GameState, target: number): LeaveProgress {
  const record = endingRecordOf(state);
  const safe = Math.max(1, Math.round(target));
  const current = Math.max(0, state.gold);
  return {
    current,
    target: safe,
    pct: Math.min(100, Math.floor((current / safe) * 100)),
    ready: !record && current >= safe,
    done: Boolean(record),
    record,
  };
}
