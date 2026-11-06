import { assetDataUrl, assetPut, assetUrl, dataUrlToBlob, storeAvailable } from './store.ts';
import type { GameState, Girl } from './types.ts';

/**
 * 存档瘦身的最后一块：把立绘从「内联 data URL」搬进 IndexedDB 资产库。
 *
 * 之前每张立绘都以 data URL 躺在存档里，一个人几百 KB，五个人就上兆；
 * 而资产库本来就按内容哈希存图、还带引用清理。这里只做两件事：
 *   1. 落盘前把内联立绘换成 `portraitAsset` 引用（存档里留一个 id）；
 *   2. 读档后按引用把图取回来，界面拿到的还是原来的 data URL，别的地方一行都不用改。
 * 资产库不可用（隐私模式、旧浏览器）时原样返回，功能不受影响，只是不省空间。
 */
type WithPortrait = Pick<Girl, 'portrait' | 'portraitAsset' | 'importedVariants' | 'variantAssets'> & { id: string };

/** 资产库的最小接口：测试可以换成内存实现，生产走 store.ts。 */
export interface PortraitStore {
  available: () => boolean;
  put: (blob: Blob) => Promise<string>;
  url: (id: string) => Promise<string | undefined>;
  /** 表情差分要用 data URL 回填：导出存档时 blob URL 会失效。 */
  dataUrl?: (id: string) => Promise<string | undefined>;
}

const defaultStore: PortraitStore = {
  available: storeAvailable,
  put: blob => assetPut(blob, { source: 'migration' }),
  url: id => assetUrl(id),
  dataUrl: id => assetDataUrl(id),
};

function needsExtract(girl: WithPortrait): boolean {
  return typeof girl.portrait === 'string' && girl.portrait.startsWith('data:');
}

/** 差分的内容指纹：长度 + 首尾片段，避免每次落盘都重算哈希。 */
function variantFingerprint(dataUrl: string): string {
  return `${dataUrl.length}:${dataUrl.slice(0, 64)}:${dataUrl.slice(-64)}`;
}

/** 已经登记过的差分：同一个会话里反复保存时不再重复写资产库。 */
const variantAssetCache = new Map<string, string>();
/** 每个存储实现一份缓存命名空间，避免不同 store（含测试用的内存实现）互相串 id。 */
const storeIds = new WeakMap<object, number>();
let nextStoreId = 0;
function variantCacheKey(store: PortraitStore, dataUrl: string): string {
  let id = storeIds.get(store as object);
  if (!id) { id = (nextStoreId += 1); storeIds.set(store as object, id); }
  return `${id}:${variantFingerprint(dataUrl)}`;
}

/** 把内联差分换成 `variantAssets`；没有可搬的就返回 undefined。 */
async function extractVariants<T extends WithPortrait>(girl: T, store: PortraitStore): Promise<T | undefined> {
  const entries = Object.entries(girl.importedVariants ?? {});
  if (!entries.length) return undefined;
  const inline: Record<string, string> = {};
  const assets: Record<string, string> = { ...(girl.variantAssets ?? {}) };
  let moved = false;
  for (const [key, value] of entries) {
    if (typeof value !== 'string' || !value.startsWith('data:')) { inline[key] = value; continue; }
    const cacheKey = variantCacheKey(store, value);
    const cached = variantAssetCache.get(cacheKey);
    if (cached) { assets[key] = cached; moved = true; continue; }
    const blob = dataUrlToBlob(value);
    if (!blob) { inline[key] = value; continue; }
    try {
      const id = await store.put(blob);
      assets[key] = id;
      variantAssetCache.set(cacheKey, id);
      moved = true;
    } catch {
      // 单张图写不进去就留在存档里，别让整次保存失败。
      inline[key] = value;
    }
  }
  if (!moved) return undefined;
  return {
    ...girl,
    importedVariants: Object.keys(inline).length ? inline : undefined,
    variantAssets: Object.keys(assets).length ? assets : undefined,
  };
}

async function extractOne<T extends WithPortrait>(girl: T, store: PortraitStore): Promise<T | undefined> {
  let next: T = girl;
  let changed = false;
  if (needsExtract(girl)) {
    const blob = dataUrlToBlob(girl.portrait);
    if (blob) {
      const id = await store.put(blob);
      next = { ...next, portraitAsset: id, portrait: '' };
      changed = true;
    }
  }
  const variants = await extractVariants(next, store);
  if (variants) { next = variants; changed = true; }
  return changed ? next : undefined;
}

/** 落盘前调用：返回的 state 可以安全写进存档（立绘已换成引用）。 */
export async function extractStatePortraits(state: GameState, store: PortraitStore = defaultStore): Promise<{ state: GameState; extracted: number }> {
  if (!store.available()) return { state, extracted: 0 };
  let extracted = 0;
  const mapAll = async <T extends WithPortrait>(list: T[]): Promise<T[]> => {
    const out: T[] = [];
    for (const item of list) {
      const swapped = await extractOne(item, store);
      if (swapped) { extracted += 1; out.push(swapped); } else out.push(item);
    }
    return out;
  };
  const girls = await mapAll(state.girls);
  const candidates = await mapAll(state.candidates);
  const memorial = state.memorial?.length
    ? await Promise.all(state.memorial.map(async entry => {
      const swapped = await extractOne(entry.girl, store);
      if (!swapped) return entry;
      extracted += 1;
      return { ...entry, girl: swapped };
    }))
    : state.memorial;
  if (!extracted) return { state, extracted: 0 };
  return { state: { ...state, girls, candidates, memorial }, extracted };
}

/** 读档后调用：把引用解析回 data URL，界面照旧直接用 girl.portrait。 */
export async function hydrateStatePortraits(state: GameState, store: PortraitStore = defaultStore): Promise<GameState> {
  if (!store.available()) return state;
  const restore = async <T extends WithPortrait>(girl: T): Promise<T> => {
    let next: T = girl;
    if (!girl.portrait && girl.portraitAsset) {
      const url = await store.url(girl.portraitAsset).catch(() => undefined);
      if (url) next = { ...next, portrait: url };
    }
    const assets = next.variantAssets;
    if (assets && Object.keys(assets).length) {
      const variants = { ...(next.importedVariants ?? {}) };
      let changed = false;
      for (const [key, id] of Object.entries(assets)) {
        if (variants[key]) continue;
        const read = store.dataUrl ?? store.url;
        const url = await read(id).catch(() => undefined);
        if (url) { variants[key] = url; changed = true; }
      }
      if (changed) next = { ...next, importedVariants: variants };
    }
    return next;
  };
  const girls = await Promise.all(state.girls.map(restore));
  const candidates = await Promise.all(state.candidates.map(restore));
  const memorial = state.memorial?.length
    ? await Promise.all(state.memorial.map(async entry => ({ ...entry, girl: await restore(entry.girl) })))
    : state.memorial;
  return { ...state, girls, candidates, memorial };
}
