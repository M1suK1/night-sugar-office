import type { Girl, GameState } from './types.ts';
import { safeOptimizedImageDataUrl, yieldToGC } from './image.ts';

/**
 * v43 防 OOM：把存档里已经躺着的超大立绘与表情差分就地降维。
 *
 * 老存档是在「原样保留」的年代写下的：单张差分可以是 6–8MB 图片的 Base64，
 * 五套服装 × 六种表情就是两百多 MB 的字符串，读档之后每一次状态克隆都在搬这些字符。
 * 新导入的图已经走 `safeOptimizedImageDataUrl`，这里补上「存量图」这一半：
 * 只在浏览器里有 Canvas 时生效，串行处理、逐张让出事件循环，单张压到 200KB 上下。
 */

/** 超过这个长度的图才值得重编码：再短的图压下去只会掉画质、不掉内存。 */
const SLIM_THRESHOLD = 250_000;

async function slimOne(src: string | undefined): Promise<string | undefined> {
  if (typeof src !== 'string' || !src.startsWith('data:image/') || src.length <= SLIM_THRESHOLD) return src;
  const next = await safeOptimizedImageDataUrl(src);
  await yieldToGC(8);
  return next;
}

/** 逐字段降维一个角色；没有任何字段被改动时返回原对象，方便调用方判断「要不要提交」。 */
export async function slimGirlImages(girl: Girl): Promise<Girl> {
  if (typeof document === 'undefined') return girl;
  let changed = false;

  const portrait = (await slimOne(girl.portrait)) ?? girl.portrait;
  if (portrait !== girl.portrait) changed = true;

  let wardrobe = girl.wardrobe;
  if (wardrobe?.length) {
    const nextWardrobe = [];
    for (const outfit of wardrobe) {
      const slim = await slimOne(outfit.portrait);
      if (slim !== outfit.portrait) changed = true;
      nextWardrobe.push(slim === outfit.portrait ? outfit : { ...outfit, portrait: slim });
    }
    wardrobe = nextWardrobe;
  }

  let witchForm = girl.witchForm;
  if (witchForm) {
    const slim = await slimOne(witchForm.portrait);
    if (slim !== witchForm.portrait) {
      changed = true;
      witchForm = { ...witchForm, portrait: slim };
    }
  }

  let importedVariants = girl.importedVariants;
  if (importedVariants && Object.keys(importedVariants).length) {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(importedVariants)) {
      const slim = await slimOne(value);
      if (slim !== value) changed = true;
      next[key] = slim ?? value;
    }
    importedVariants = next;
  }

  if (!changed) return girl;
  return { ...girl, portrait, wardrobe, witchForm, importedVariants };
}

/**
 * 读档后清洗整份状态：名册、候选、纪念墙里的每个角色都过一遍。
 * 返回是否真的有图被降维，调用方据此决定要不要立刻回写存档。
 */
export async function slimStateImages(state: GameState): Promise<{ state: GameState; changed: boolean }> {
  if (typeof document === 'undefined') return { state, changed: false };
  let changed = false;

  const slimList = async <T extends Girl>(list: T[]): Promise<T[]> => {
    const next: T[] = [];
    for (const girl of list) {
      const slim = await slimGirlImages(girl) as T;
      if (slim !== girl) changed = true;
      next.push(slim);
    }
    return next;
  };

  const girls = await slimList(state.girls);
  const candidates = await slimList(state.candidates);
  const memorial = [];
  for (const entry of state.memorial ?? []) {
    const slim = await slimGirlImages(entry.girl);
    if (slim !== entry.girl) changed = true;
    memorial.push(slim === entry.girl ? entry : { ...entry, girl: slim });
  }

  if (!changed) return { state, changed: false };
  return { state: { ...state, girls, candidates, memorial }, changed: true };
}
