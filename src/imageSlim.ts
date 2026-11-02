import type { Girl, GameState } from './types.ts';
import { isPersistablePortrait, safeOptimizedImageDataUrl, yieldToGC } from './image.ts';

/**
 * v43 防 OOM：把存档里已经躺着的超大立绘与表情差分就地降维，
 * 顺手清掉根本不可能加载出来的地址。
 *
 * 老存档是在「原样保留」的年代写下的：单张差分可以是 6–8MB 图片的 Base64，
 * 五套服装 × 六种表情就是两百多 MB 的字符串，读档之后每一次状态克隆都在搬这些字符。
 * 新导入的图已经走 `safeOptimizedImageDataUrl`，这里补上「存量图」这一半。
 *
 * 「清地址」和「重新编码」是两件事：
 *   - `blob:` / `http:` 这类活不过刷新的地址一定要清（纯字符串判断，没有 Canvas 也能做）；
 *   - 重新编码需要 Canvas，没有环境时跳过，图保持原样。
 */

/** 超过这个长度的图才值得重编码：再短的图压下去只会掉画质、不掉内存。 */
const SLIM_THRESHOLD = 250_000;

const canReencode = () => typeof document !== 'undefined';

async function slimOne(src: string | undefined): Promise<string | undefined> {
  if (!src || !canReencode()) return src;
  if (!src.startsWith('data:image/') || src.length <= SLIM_THRESHOLD) return src;
  const next = await safeOptimizedImageDataUrl(src);
  await yieldToGC(8);
  return next;
}

/** 逐字段清洗一个角色；没有任何字段被改动时返回原对象，方便调用方判断「要不要提交」。 */
export async function slimGirlImages(girl: Girl): Promise<Girl> {
  let changed = false;

  /** 清掉活不过刷新的地址：宁可回落到剪影，也不留一张永远加载不出来的破图。 */
  const keepPortrait = (src: string | undefined): string | undefined => {
    if (src && !isPersistablePortrait(src)) { changed = true; return undefined; }
    return src;
  };

  const portrait = (await slimOne(keepPortrait(girl.portrait))) ?? '';
  if (portrait !== girl.portrait) changed = true;

  let wardrobe = girl.wardrobe;
  if (wardrobe?.length) {
    const nextWardrobe = [];
    for (const outfit of wardrobe) {
      const slim = await slimOne(keepPortrait(outfit.portrait));
      if (slim !== outfit.portrait) changed = true;
      nextWardrobe.push(slim === outfit.portrait ? outfit : { ...outfit, portrait: slim });
    }
    wardrobe = nextWardrobe;
  }

  let witchForm = girl.witchForm;
  if (witchForm) {
    const slim = await slimOne(keepPortrait(witchForm.portrait));
    if (slim !== witchForm.portrait) {
      changed = true;
      witchForm = { ...witchForm, portrait: slim };
    }
  }

  let importedVariants = girl.importedVariants;
  if (importedVariants && Object.keys(importedVariants).length) {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(importedVariants)) {
      const slim = await slimOne(keepPortrait(value));
      if (slim !== value) changed = true;
      if (slim) next[key] = slim;
    }
    importedVariants = next;
  }

  if (!changed) return girl;
  return { ...girl, portrait, wardrobe, witchForm, importedVariants };
}

/**
 * 读档后清洗整份状态：名册、候选、纪念墙里的每个角色都过一遍。
 * 返回是否真的有图被改动，调用方据此决定要不要立刻回写存档。
 */
export async function slimStateImages(state: GameState): Promise<{ state: GameState; changed: boolean }> {
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
