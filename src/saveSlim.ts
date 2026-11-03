/**
 * 存档瘦身：只在体积吃紧时跑。
 *
 * 立绘、衣柜、魔女化立绘已经搬进 IndexedDB 资产，但表情差分（\`importedVariants\`）
 * 仍是内联 data URL——四套服装 × 六种表情就是二十四张图，一个角色就能顶十几兆。
 * 这里把超过阈值的差分就地重编码成更小的 WebP（有损，但差分本来就是展示用的小图）。
 *
 * 没有 canvas（Node 测试、老浏览器）时原样返回，绝不因为瘦身失败而挡住存档。
 */
import type { GameState, Girl } from './types.ts';
import { safeOptimizedImageDataUrl } from './image.ts';

/** 超过这个字符数的差分才值得重编码（约 90KB 原图）。 */
export const VARIANT_SLIM_THRESHOLD = 90_000;
/** 差分不需要立绘那么细，长边 640 足够。 */
export const VARIANT_SLIM_DIMENSION = 640;

/** 该不该压：只有明显偏大的内联图才动，避免每次存档都掉一次画质。 */
export function shouldSlimVariant(value: unknown, threshold = VARIANT_SLIM_THRESHOLD): value is string {
  return typeof value === 'string' && value.startsWith('data:image/') && value.length > threshold;
}

async function slimGirl(girl: Girl): Promise<{ girl: Girl; saved: number }> {
  const variants = girl.importedVariants;
  if (!variants || !Object.keys(variants).length) return { girl, saved: 0 };
  let saved = 0;
  let changed = false;
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(variants)) {
    if (!shouldSlimVariant(value)) { next[key] = value; continue; }
    const smaller = await safeOptimizedImageDataUrl(value, VARIANT_SLIM_DIMENSION, 0.72);
    if (typeof smaller === 'string' && smaller.length > 0 && smaller.length < value.length) {
      next[key] = smaller;
      saved += value.length - smaller.length;
      changed = true;
    } else {
      next[key] = value;
    }
  }
  return { girl: changed ? { ...girl, importedVariants: next } : girl, saved };
}

/** 整份存档瘦身；返回新的 state 与实际省下的字符数。 */
export async function slimStateForSave(state: GameState): Promise<{ state: GameState; saved: number }> {
  if (typeof document === 'undefined') return { state, saved: 0 };
  let saved = 0;
  const slimList = async (list: Girl[]) => {
    if (!list.length) return list;
    const out: Girl[] = [];
    for (const girl of list) {
      const result = await slimGirl(girl);
      saved += result.saved;
      out.push(result.girl);
    }
    return out;
  };
  const girls = await slimList(state.girls ?? []);
  const candidates = await slimList(state.candidates ?? []);
  if (!saved) return { state, saved: 0 };
  return { state: { ...state, girls, candidates }, saved };
}
