/**
 * 营业时间与委托时段。
 *
 * 一整天（1440 分钟）对玩家来说太长了：真正有事发生的只有夜里那六个小时。
 * 事务所 20:00 开门，次日 02:00 打烊；跨过午夜那段 00:00–02:00 仍算同一夜，白天整段被跳过，由「前往下一天」切换。
 * 委托按三个时段依次放出，每一份都带时限。
 */

export const SHIFT_START = 20 * 60;
export const SHIFT_END = 26 * 60;
export const SHIFT_MINUTES = SHIFT_END - SHIFT_START;

/** 三个时段的开门时刻（相对营业开始的分钟数）。 */
export const WAVE_AT = [0, 120, 240] as const;
/** 每个时段放出的委托数量。 */
export const WAVE_SIZES = [3, 2, 2] as const;

export type CommissionWindow = 'urgent' | 'long';

export const windowLabel: Record<CommissionWindow, string> = {
  urgent: '紧急',
  long: '长期',
};

export const windowNote: Record<CommissionWindow, string> = {
  urgent: '两小时内必须接下，否则自动撤销',
  long: '2–7 天内有效，可跨夜保留',
};

/** 长期委托的天数范围。 */
import { loadBalance } from './balance.ts';

export const LONG_MIN_DAYS = 2;
export const LONG_MAX_DAYS = 7;

/** 0 → 20:00 … 360 → 26:00（次日 02:00）；用在时间条与委托倒计时上。 */
export function clockLabel(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** 距离打烊还剩多少分钟（可为负）。 */
export function minutesToClose(minutes: number): number {
  return SHIFT_END - minutes;
}

export function shiftElapsed(minutes: number): number {
  return Math.max(0, Math.min(SHIFT_MINUTES, minutes - SHIFT_START));
}

export type ShiftPhase = 'closed' | 'open' | 'deep' | 'midnight' | 'closing';

export function shiftPhase(minutes: number): ShiftPhase {
  if (minutes < SHIFT_START || minutes >= SHIFT_END) return 'closed';
  const elapsed = minutes - SHIFT_START;
  if (elapsed < 120) return 'open';
  if (elapsed < 240) return 'deep';
  if (elapsed < 300) return 'midnight';
  return 'closing';
}

export const phaseLabel: Record<ShiftPhase, string> = {
  closed: '尚未营业',
  open: '刚开门',
  deep: '夜正中',
  midnight: '跨午夜',
  closing: '接近打烊',
};

export function absoluteMinutes(day: number, minutes: number): number {
  return day * 1440 + minutes;
}

export function shiftStartAt(day: number): number {
  return absoluteMinutes(day, SHIFT_START);
}

/** 某一夜打烊的绝对分钟（次日 02:00）。 */
export function shiftCloseAt(day: number): number {
  return absoluteMinutes(day, SHIFT_END);
}

/** 某一次委托的接受截止时间（绝对分钟）。长期委托按业务日跨天。 */
export function deadlineFor(kind: CommissionWindow, day: number, spawnedAt: number, longDays = LONG_MIN_DAYS): number {
  if (kind === 'long') {
    const days = Math.max(loadBalance().longMinDays, Math.min(loadBalance().longMaxDays, Math.round(longDays)));
    return shiftCloseAt(day + days - 1);
  }
  const close = absoluteMinutes(day, SHIFT_END);
  return Math.min(close, spawnedAt + 120);
}

/** 委托是否已经过了接受时限。 */
export function isExpiredAt(deadlineAt: number, now: number): boolean {
  return Number.isFinite(deadlineAt) && now >= deadlineAt;
}

/** 「还剩 1 小时 20 分」「剩 3 天」这类文案。 */
export function remainingLabel(deadlineAt: number, now: number): string {
  const left = deadlineAt - now;
  if (left <= 0) return '已截止';
  if (left >= 1440) {
    const days = Math.floor(left / 1440);
    const hours = Math.floor((left % 1440) / 60);
    return hours === 0 ? `剩 ${days} 天` : `剩 ${days} 天 ${hours} 小时`;
  }
  if (left < 60) return `剩 ${left} 分`;
  const h = Math.floor(left / 60);
  const m = left % 60;
  return m === 0 ? `剩 ${h} 小时` : `剩 ${h} 小时 ${m} 分`;
}
