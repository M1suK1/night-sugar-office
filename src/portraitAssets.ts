import { assetPut, assetUrl, dataUrlToBlob, storeAvailable } from './store.ts';
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
type WithPortrait = Pick<Girl, 'portrait' | 'portraitAsset'> & { id: string };

/** 资产库的最小接口：测试可以换成内存实现，生产走 store.ts。 */
export interface PortraitStore {
  available: () => boolean;
  put: (blob: Blob) => Promise<string>;
  url: (id: string) => Promise<string | undefined>;
}

const defaultStore: PortraitStore = {
  available: storeAvailable,
  put: blob => assetPut(blob, { source: 'migration' }),
  url: id => assetUrl(id),
};

function needsExtract(girl: WithPortrait): boolean {
  return typeof girl.portrait === 'string' && girl.portrait.startsWith('data:');
}

async function extractOne<T extends WithPortrait>(girl: T, store: PortraitStore): Promise<T | undefined> {
  if (!needsExtract(girl)) return undefined;
  const blob = dataUrlToBlob(girl.portrait);
  if (!blob) return undefined;
  const id = await store.put(blob);
  return { ...girl, portraitAsset: id, portrait: '' };
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
    if (girl.portrait || !girl.portraitAsset) return girl;
    const url = await store.url(girl.portraitAsset).catch(() => undefined);
    return url ? { ...girl, portrait: url } : girl;
  };
  const girls = await Promise.all(state.girls.map(restore));
  const candidates = await Promise.all(state.candidates.map(restore));
  const memorial = state.memorial?.length
    ? await Promise.all(state.memorial.map(async entry => ({ ...entry, girl: await restore(entry.girl) })))
    : state.memorial;
  return { ...state, girls, candidates, memorial };
}
