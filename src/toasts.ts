/**
 * 屏幕右下角那排提示的状态机。
 *
 * 之前它是「一条链式 setTimeout 删一个」：一旦这次定时被重渲染或切标签页打断，
 * 那条提示就永远留在屏幕上；再加上同一句话被连着推两次，就成了「关不掉的提示」。
 * 现在过期只看 createdAt，入队去重，关闭按 id。
 */
export interface ToastEntry {
  message: string;
  ok: boolean;
  id: number;
  createdAt: number;
}

export const TOAST_LIMIT = 8;
export const TOAST_DEDUPE_MS = 3000;
export const TOAST_TTL_MS = 6000;
export const TOAST_SHOWN = 4;

/** 入队：同一句话三秒内不重复；超过上限挤掉最旧的。 */
export function pushToast(list: readonly ToastEntry[], entry: ToastEntry): ToastEntry[] {
  if (!entry.message) return [...list];
  const duplicate = list.some(item => item.message === entry.message && entry.createdAt - item.createdAt < TOAST_DEDUPE_MS);
  if (duplicate) return [...list];
  return [...list, entry].slice(-TOAST_LIMIT);
}

/** 到期清理：只看时间，不看「删第几条」。 */
export function expireToasts(list: readonly ToastEntry[], now: number, ttlMs = TOAST_TTL_MS): ToastEntry[] {
  return list.filter(entry => now - entry.createdAt < ttlMs).slice(0, TOAST_SHOWN);
}

/** 点 ✕ 关掉一条。 */
export function dismissToast(list: readonly ToastEntry[], id: number): ToastEntry[] {
  return list.filter(entry => entry.id !== id);
}
