/**
 * 表情差分找回（v175）。
 *
 * 差分有两种存法：内联 `importedVariants`（data URL），或者搬进资产库后的
 * `variantAssets`（资产 id）。如果资产读不回来、又没做回填，界面上就是「差分全没了」——
 * 但数据往往还在别处：要么资产库里有，要么当初的契约卡原文里有。
 *
 * 这里把两条路都试一遍，只补缺的键，不动其它数据。
 */
import { assetDataUrl } from './store.ts';
import { readCardRaw } from './cardbox.ts';
import type { GameState, Girl } from './types.ts';

export interface VariantDeps {
  dataUrl: (id: string) => Promise<string | undefined>;
  readCard: (hash: string) => Promise<string | undefined>;
}

const defaultDeps: VariantDeps = { dataUrl: assetDataUrl, readCard: readCardRaw };

export interface VariantReport {
  id: string;
  name: string;
  /** 存档里现有的内联差分条数。 */
  inline: number;
  /** 资产引用条数。 */
  assets: number;
  /** 资产库里读得回来的条数。 */
  resolvable: number;
  /** 从契约卡原文里补回来的条数。 */
  fromCard: number;
  /** 补完之后内联差分总数。 */
  total: number;
  cardId?: string;
}

type VariantCarrier = Pick<Girl, 'id' | 'name' | 'importedVariants' | 'variantAssets' | 'cardId'>;

function variantCount(girl: VariantCarrier): number {
  return Object.keys(girl.importedVariants ?? {}).length;
}

/** 只看不补：告诉玩家差分现在到底在哪一层。 */
export async function diagnoseVariants(state: GameState, deps: VariantDeps = defaultDeps): Promise<VariantReport[]> {
  const carriers: VariantCarrier[] = [
    ...(state.girls ?? []),
    ...(state.candidates ?? []),
    ...(state.memorial ?? []).map(entry => entry.girl),
  ];
  const out: VariantReport[] = [];
  for (const girl of carriers) {
    const inline = variantCount(girl);
    const assets = Object.keys(girl.variantAssets ?? {}).length;
    let resolvable = 0;
    for (const id of Object.values(girl.variantAssets ?? {})) {
      const url = await deps.dataUrl(id).catch(() => undefined);
      if (url && url.startsWith('data:image/')) resolvable += 1;
    }
    out.push({
      id: girl.id, name: girl.name, inline, assets, resolvable, fromCard: 0, total: inline, cardId: girl.cardId,
    });
  }
  return out;
}

async function recoverOne(girl: VariantCarrier, deps: VariantDeps): Promise<{ girl: VariantCarrier; report: VariantReport } | undefined> {
  const variants: Record<string, string> = { ...(girl.importedVariants ?? {}) };
  const before = Object.keys(variants).length;
  let resolvable = 0;

  // ① 资产库：把 variantAssets 读回 data URL。
  for (const [key, id] of Object.entries(girl.variantAssets ?? {})) {
    if (variants[key]) continue;
    const url = await deps.dataUrl(id).catch(() => undefined);
    if (url && url.startsWith('data:image/')) {
      variants[key] = url;
      resolvable += 1;
    }
  }

  // ② 契约卡原文：卡里带着当初导出的差分，按卡号读回来。
  let fromCard = 0;
  if (Object.keys(variants).length === before && girl.cardId) {
    const raw = await deps.readCard(girl.cardId).catch(() => undefined);
    if (raw) {
      try {
        const card = JSON.parse(raw) as { girl?: { importedVariants?: Record<string, string> } };
        for (const [key, value] of Object.entries(card.girl?.importedVariants ?? {})) {
          if (variants[key] || typeof value !== 'string' || !value.startsWith('data:image/')) continue;
          variants[key] = value;
          fromCard += 1;
        }
      } catch {
        // 卡原文坏了就当没有；不抛错，恢复流程继续。
      }
    }
  }

  const total = Object.keys(variants).length;
  const changed = total > before;
  const report: VariantReport = {
    id: girl.id, name: girl.name,
    inline: before,
    assets: Object.keys(girl.variantAssets ?? {}).length,
    resolvable, fromCard, total,
    cardId: girl.cardId,
  };
  if (!changed) return { girl, report };
  return { girl: { ...girl, importedVariants: variants }, report };
}

/** 补差分：先读资产库，再读卡面原文。返回新的 state 与每人的明细。 */
export async function recoverVariants(state: GameState, deps: VariantDeps = defaultDeps): Promise<{ state: GameState; reports: VariantReport[] }> {
  const reports: VariantReport[] = [];
  const fix = async (girl: Girl): Promise<Girl> => {
    const result = await recoverOne(girl, deps);
    if (!result) return girl;
    reports.push(result.report);
    return result.girl as Girl;
  };
  const girls: Girl[] = [];
  for (const girl of state.girls ?? []) girls.push(await fix(girl));
  const candidates: Girl[] = [];
  for (const girl of state.candidates ?? []) candidates.push(await fix(girl));
  const memorial = [];
  for (const entry of state.memorial ?? []) memorial.push({ ...entry, girl: await fix(entry.girl) });
  return { state: { ...state, girls, candidates, memorial }, reports };
}
