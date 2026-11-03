/**
 * 文件体积上限的唯一出处。
 *
 * 契约卡带着立绘、衣柜与表情差分，一张纯 PNG 卡十兆二十兆是常态
 * （`data/cards/` 里现成的几张是 10–22MB）。这些上限以前散落在各处：
 * 卡库扫描收 24MB、「导入角色卡」却自己写死 8MB，于是卡库收得进去的卡
 * 从文件导入反而被判成「文件过大」。
 */

/** 单张契约卡的兜底上限：只拦「明显不是契约卡」的文件，真正的约束是 IndexedDB 配额。 */
export const CARD_FILE_BYTES_MAX = 24 * 1024 * 1024;
/** 存档的上限，与存档位（`SLOT_BYTES_LIMIT`）保持一致。 */
export const SAVE_FILE_BYTES_MAX = 96_000_000;

/** 给人看的体积。 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

export interface FileGuardResult {
  ok: boolean;
  message?: string;
}

/** 导入契约卡前的体积检查。 */
export function cardFileGuard(size: number): FileGuardResult {
  if (Number.isFinite(size) && size > CARD_FILE_BYTES_MAX) {
    return { ok: false, message: `这张卡有 ${formatBytes(size)}，超过 ${formatBytes(CARD_FILE_BYTES_MAX)} 的上限，可能不是契约卡。` };
  }
  return { ok: true };
}

/** 导入存档前的体积检查。 */
export function saveFileGuard(size: number): FileGuardResult {
  if (Number.isFinite(size) && size > SAVE_FILE_BYTES_MAX) {
    return { ok: false, message: `这个存档有 ${formatBytes(size)}，超过 ${formatBytes(SAVE_FILE_BYTES_MAX)} 的上限，可能已经损坏。` };
  }
  return { ok: true };
}
