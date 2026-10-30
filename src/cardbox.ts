import type { GirlCard, GirlFaction } from './types.ts';
import { girlCardHash, parseGirlCard } from './cards.ts';
import { kvGet, kvSet } from './store.ts';

/** 卡库是玩家的文件柜：不进存档，重置进度也不该把卡扔掉。 */
export const CARD_BOX_KEY = 'night-sugar:cardbox:v1';
export const CARD_BOX_LIMIT = 60;
/**
 * 单张卡的兜底上限。
 *
 * 这里只拦「明显不是契约卡」的文件：带立绘的卡通常在 1–3 MB（立绘是 base64），
 * 256KB 那种老阈值会把正常的卡全挡在门外。真正的容量约束是 localStorage 配额，
 * 由 `saveCardBox` 的返回值兜底，写不进去就回滚并报出来。
 */
export const CARD_BOX_MAX_BYTES = 24 * 1024 * 1024;

export interface CardBoxEntry {
  hash: string;
  name: string;
  level: number;
  element: string;
  factionTag: GirlFaction;
  fileName: string;
  addedAt: number;
  raw: string;
}

const TAG_LABEL: Record<GirlFaction, string> = {
  association: '星灯协会',
  government: '市役所',
  witch: '月蚀庭',
  none: '无所属',
};

export function cardBoxTagLabel(tag: GirlFaction): string {
  return TAG_LABEL[tag] ?? TAG_LABEL.none;
}

export function cardBoxByteSize(text: string): number {
  if (typeof TextEncoder === 'undefined') return text.length * 2;
  return new TextEncoder().encode(text).length;
}

/** 给人看的大小：1023B / 24KB / 3.4MB。 */
export function formatByteSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}

function entryOf(card: GirlCard, fileName: string, raw: string): CardBoxEntry {
  return {
    hash: girlCardHash(card),
    name: card.girl.name,
    level: card.girl.level,
    element: card.girl.element,
    factionTag: card.girl.factionTag ?? 'none',
    fileName,
    addedAt: Date.now(),
    raw,
  };
}

function normalizeCardBox(parsed: unknown): CardBoxEntry[] {
  if (!Array.isArray(parsed)) return [];
  try {
    return parsed.filter((row): row is CardBoxEntry => {
      if (!row || typeof row !== 'object') return false;
      const entry = row as Partial<CardBoxEntry>;
      return typeof entry.hash === 'string' && typeof entry.raw === 'string' && typeof entry.name === 'string';
    }).map(row => ({
      ...row,
      level: Number.isFinite(row.level) ? row.level : 1,
      element: typeof row.element === 'string' ? row.element : '星光系',
      factionTag: (row.factionTag === 'association' || row.factionTag === 'government' || row.factionTag === 'witch') ? row.factionTag : 'none',
      fileName: typeof row.fileName === 'string' ? row.fileName : `${row.name}.json`,
      addedAt: Number.isFinite(row.addedAt) ? row.addedAt : 0,
    }));
  } catch {
    return [];
  }
}

/** 读坏了就当空库——卡库丢了比整个游戏打不开好。 */
export async function loadCardBox(): Promise<CardBoxEntry[]> {
  try {
    return normalizeCardBox(await kvGet<unknown>(CARD_BOX_KEY));
  } catch {
    return [];
  }
}

/** 写不进去（空间不足 / 隐私模式）时返回 `false`，由调用方回滚并提示。 */
export async function saveCardBox(entries: CardBoxEntry[]): Promise<boolean> {
  try {
    await kvSet(CARD_BOX_KEY, entries.slice(0, CARD_BOX_LIMIT));
    return true;
  } catch {
    return false;
  }
}

/**
 * 批量收卡：坏卡只记一条失败，不牵连同批的其它卡；同 hash 只提示重复，不覆盖已有的文件名。
 */
export async function cardboxAdd(
  inputs: { name: string; text: string }[],
  existing: CardBoxEntry[],
): Promise<{
  entries: CardBoxEntry[];
  added: CardBoxEntry[];
  duplicates: string[];
  failed: { name: string; message: string }[];
}> {
  const entries = [...existing];
  const added: CardBoxEntry[] = [];
  const duplicates: string[] = [];
  const failed: { name: string; message: string }[] = [];
  const seen = new Set(entries.map(entry => entry.hash));

  for (const input of inputs) {
    const size = cardBoxByteSize(input.text);
    if (size > CARD_BOX_MAX_BYTES) {
      failed.push({ name: input.name, message: `文件 ${formatByteSize(size)}，超过 ${formatByteSize(CARD_BOX_MAX_BYTES)}，可能不是契约卡` });
      continue;
    }
    const parsed = parseGirlCard(input.text);
    if (!parsed.ok) {
      failed.push({ name: input.name, message: parsed.message });
      continue;
    }
    const hash = girlCardHash(parsed.card);
    if (seen.has(hash)) {
      duplicates.push(parsed.card.girl.name);
      continue;
    }
    if (entries.length >= CARD_BOX_LIMIT) {
      failed.push({ name: input.name, message: `库里有 ${CARD_BOX_LIMIT} 张了，先删几张再来` });
      continue;
    }
    seen.add(hash);
    const entry = entryOf(parsed.card, input.name, input.text);
    entries.push(entry);
    added.push(entry);
  }

  if (added.length && !(await saveCardBox(entries))) {
    // 配额放不下：整批回滚，别让界面显示「已导入」而刷新后全没。
    const kept = entries.filter(entry => !added.some(row => row.hash === entry.hash));
    await saveCardBox(kept);
    for (const entry of added) {
      failed.push({
        name: entry.fileName,
        message: `卡库放不下这张卡（约 ${formatByteSize(cardBoxByteSize(entry.raw))}）：先删几张旧卡，或直接用「导入角色卡」把它编进名册`,
      });
    }
    return { entries: kept, added: [], duplicates, failed };
  }
  return { entries, added, duplicates, failed };
}

export async function cardboxRemove(hashes: string[], entries: CardBoxEntry[]): Promise<CardBoxEntry[]> {
  const drop = new Set(hashes);
  const kept = entries.filter(entry => !drop.has(entry.hash));
  await saveCardBox(kept);
  return kept;
}

export function cardboxFilter(entries: CardBoxEntry[], query: string): CardBoxEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter(entry => [entry.name, entry.fileName, entry.element, cardBoxTagLabel(entry.factionTag)]
    .some(value => value.toLowerCase().includes(needle)));
}

/** 把库里的原始文本重新解析成名册能吃的卡；库里存的是原文，不存解析结果。 */
export function cardboxCards(entries: CardBoxEntry[], hashes: string[]): GirlCard[] {
  const want = new Set(hashes);
  const cards: GirlCard[] = [];
  for (const entry of entries) {
    if (!want.has(entry.hash)) continue;
    const parsed = parseGirlCard(entry.raw);
    if (parsed.ok) cards.push(parsed.card);
  }
  return cards;
}

/** 库里已有的 hash，用来在名册侧判断「这张卡已经在册」。 */
export function cardboxReport(added: number, duplicates: number, failed: number): string {
  const parts = [`已导入 ${added} 张`];
  if (duplicates) parts.push(`跳过重复 ${duplicates} 张`);
  if (failed) parts.push(`${failed} 张读取失败`);
  return `${parts.join('，')}。`;
}
