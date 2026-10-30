import type { GirlCard, GirlFaction } from './types.ts';
import { girlCardHash, parseGirlCard } from './cards.ts';

/** 卡库是玩家的文件柜：不进存档，重置进度也不该把卡扔掉。 */
export const CARD_BOX_KEY = 'night-sugar:cardbox:v1';
export const CARD_BOX_LIMIT = 60;
export const CARD_BOX_MAX_BYTES = 256 * 1024;

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
  return text.length * 2;
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

/** 读坏了就当空库——卡库丢了比整个游戏打不开好。 */
export function loadCardBox(): CardBoxEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(CARD_BOX_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
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

export function saveCardBox(entries: CardBoxEntry[]): void {
  try {
    globalThis.localStorage?.setItem(CARD_BOX_KEY, JSON.stringify(entries.slice(0, CARD_BOX_LIMIT)));
  } catch {
    /* 配额满了就静默失败：卡还在内存里，至少这次能导入 */
  }
}

/**
 * 批量收卡：坏卡只记一条失败，不牵连同批的其它卡；同 hash 只提示重复，不覆盖已有的文件名。
 */
export function cardboxAdd(
  inputs: { name: string; text: string }[],
  existing: CardBoxEntry[] = loadCardBox(),
): {
  entries: CardBoxEntry[];
  added: CardBoxEntry[];
  duplicates: string[];
  failed: { name: string; message: string }[];
} {
  const entries = [...existing];
  const added: CardBoxEntry[] = [];
  const duplicates: string[] = [];
  const failed: { name: string; message: string }[] = [];
  const seen = new Set(entries.map(entry => entry.hash));

  for (const input of inputs) {
    if (cardBoxByteSize(input.text) > CARD_BOX_MAX_BYTES) {
      failed.push({ name: input.name, message: '文件超过 256KB，可能不是契约卡' });
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

  if (added.length) saveCardBox(entries);
  return { entries, added, duplicates, failed };
}

export function cardboxRemove(hashes: string[], entries: CardBoxEntry[] = loadCardBox()): CardBoxEntry[] {
  const drop = new Set(hashes);
  const kept = entries.filter(entry => !drop.has(entry.hash));
  saveCardBox(kept);
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
