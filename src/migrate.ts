/**
 * 从 localStorage 搬迁到 IndexedDB，并把立绘抽成 assets。
 *
 * 分段策略：本步只搬「当前进度」。三个存档位与契约卡库的读取方（`saves.ts` / `cardbox.ts`）
 * 还是同步的 localStorage 版本，等它们异步化之后才能搬——否则会把数据搬走而界面读不到。
 *
 * 立绘抽取有个过渡开关 `keepInline`：v22 实际交付走的是**内联模式**（默认 true）——立绘按原字节留在
 * 存档 JSON 里，不再往 assets 表写副本（写一份等于把体积翻倍）。只有将来真要改成引用形态时，
 * 才把 `keepInline` 传 false：那时才会 `assetPut` 并把 `portrait` 清空。
 */

import type { AssetId, GameState, Girl, Outfit } from './types.ts';
import { SAVE_KEY, loadState } from './game.ts';
import { assetPut, dataUrlToBlob, kvGet, kvSet } from './store.ts';

export const SAVE_CURRENT_KEY = 'save/current';
export const MIGRATION_KEY = 'meta/migrated';
export const MIGRATION_VERSION = 2;

export interface ExtractResult {
  state: GameState;
  assets: AssetId[];
}

function legacyRead(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function legacyRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* 删不掉就留着，下次启动会再判断。 */
  }
}

async function takePortrait(dataUrl: string | undefined, bag: AssetId[]): Promise<AssetId | undefined> {
  if (!dataUrl || !dataUrl.startsWith('data:')) return undefined;
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return undefined;
  const id = await assetPut(blob, { source: 'migration' });
  bag.push(id);
  return id;
}

async function extractOutfit(outfit: Outfit, bag: AssetId[], keepInline: boolean): Promise<Outfit> {
  const id = await takePortrait(outfit.portrait, bag);
  if (!id) return outfit;
  return keepInline ? { ...outfit, portraitAsset: id } : { ...outfit, portraitAsset: id, portrait: '' };
}

async function extractGirl(girl: Girl, bag: AssetId[], keepInline: boolean): Promise<Girl> {
  const next: Girl = { ...girl };
  const portraitAsset = await takePortrait(girl.portrait, bag);
  if (portraitAsset) {
    next.portraitAsset = portraitAsset;
    if (!keepInline) next.portrait = '';
  }
  if (girl.witchForm) next.witchForm = await extractOutfit(girl.witchForm, bag, keepInline);
  if (girl.wardrobe?.length) {
    next.wardrobe = await Promise.all(girl.wardrobe.map(outfit => extractOutfit(outfit, bag, keepInline)));
  }
  return next;
}

/**
 * 把 state 里的 dataURL 立绘登记成 assets。
 *
 * 目前覆盖 `girls[].portrait`、`wardrobe[].portrait`、`witchForm.portrait`、`candidates[].portrait`。
 * `importedVariants`（表情差分）仍是 `Record<string, dataURL>`，等渲染层改造时一起换。
 */
export async function extractPortraits(state: GameState, options: { keepInline?: boolean } = {}): Promise<ExtractResult> {
  const keepInline = options.keepInline ?? true;
  // 内联模式下立绘本来就在存档里，再往 assets 写一份等于把体积翻倍；这一步留给将来真的切换引用形态时用。
  if (keepInline) return { state, assets: [] };
  const assets: AssetId[] = [];
  const girls = await Promise.all(state.girls.map(girl => extractGirl(girl, assets, keepInline)));
  const candidates = await Promise.all(state.candidates.map(girl => extractGirl(girl, assets, keepInline)));
  return { state: { ...state, girls, candidates }, assets };
}

/** 启动时调用：把本地进度搬进 IDB。失败不写标记、不删旧键，下次重试。 */
export async function migrateLegacyStorage(options: { keepInline?: boolean } = {}): Promise<{ migrated: boolean; assets: number }> {
  const done = await kvGet<number>(MIGRATION_KEY);
  if (done === MIGRATION_VERSION) return { migrated: false, assets: 0 };

  const raw = legacyRead(SAVE_KEY);
  if (!raw) {
    // 没有旧档也要打标记，免得每次启动都重扫一遍。
    await kvSet(MIGRATION_KEY, MIGRATION_VERSION);
    return { migrated: false, assets: 0 };
  }

  try {
    if (await kvGet(SAVE_CURRENT_KEY)) {
      await kvSet(MIGRATION_KEY, MIGRATION_VERSION);
      return { migrated: false, assets: 0 };
    }
    const parsed = JSON.parse(raw) as GameState;
    const extracted = await extractPortraits(parsed, options);
    await kvSet(SAVE_CURRENT_KEY, extracted.state);
    await kvSet(MIGRATION_KEY, MIGRATION_VERSION);
    legacyRemove(SAVE_KEY);
    return { migrated: true, assets: extracted.assets.length };
  } catch {
    return { migrated: false, assets: 0 };
  }
}

/**
 * 启动时读进度：先做一次性迁移，再取当前存档。
 *
 * `loadState` 仍走 JSON 校验（它只认字符串），所以这里把对象串回去再交给它——
 * 校验逻辑不动，省得两套。
 */
export async function bootState(options: { keepInline?: boolean } = {}): Promise<{ state: GameState; hadSave: boolean }> {
  await migrateLegacyStorage(options);
  const stored = await kvGet<GameState>(SAVE_CURRENT_KEY);
  const state = loadState(stored ? JSON.stringify(stored) : null);
  return { state, hadSave: Boolean(stored) };
}
