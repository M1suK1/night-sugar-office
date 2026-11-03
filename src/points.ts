/**
 * 名册头像上那个「+N」点数的角标。
 *
 * 它以前是个死结：只要还有没分配的点就一直亮着，而四维都到上限、或者玩家
 * 暂时不想分的时候，那个角标就永远挂在那儿，既说不清也关不掉。
 * 现在：只在手动加点模式下提醒；每个「人 + 点数」组合可以被关掉一次，
 * 下次升级发了新点数会重新出现——提醒的是新事，不是旧账。
 */
const KEY = 'night-sugar:points-muted';

export function pointsKey(girlId: string, points: number): string {
  return `${girlId}:${points}`;
}

export function loadPointsMuted(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string').slice(-200) : [];
  } catch {
    return [];
  }
}

export function savePointsMuted(list: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...list].slice(-200)));
  } catch {
    /* 存不进去就算了：下次刷新只是又提醒一次 */
  }
}

export function shouldShowPointBadge(
  girl: { id: string; unspentPoints?: number },
  mode: 'manual' | 'auto' | undefined,
  muted: readonly string[],
): boolean {
  const points = girl.unspentPoints ?? 0;
  if (points <= 0) return false;
  if ((mode ?? 'auto') !== 'manual') return false;
  return !muted.includes(pointsKey(girl.id, points));
}
