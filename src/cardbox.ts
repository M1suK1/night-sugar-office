/**
 * 卡库是玩家的文件柜：不进存档，重置进度也不该把卡扔掉。
 *
 * v36 之前整库存在一个 kv 键里（每条带 `raw` 全文）。60 张带 2–3MB 立绘的卡 = 一条
 * 一百多 MB 的记录，`loadCardBox()` 一次反序列化就能把标签页顶到 OOM。现在拆成：
 *
 *   `night-sugar:cardbox:v2`        索引：每张卡的名字、等级、属性、出身等元数据，几百字节
 *   `night-sugar:cardbox:card:<hash>` 单张卡的原始 JSON 文本，只在真正要用时才读
 *
 * 迁移：读到旧的 `night-sugar:cardbox:v1` 就逐张拆开写入新结构，然后删掉旧键。
 * 迁移时用 `pop()` 逐个取，让已经处理过的长文本可以尽早被回收。
 */
import type { GirlCard, GirlFaction, PortraitSpec, StatKey } from './types.ts';
import { CARD_FILE_BYTES_MAX, formatBytes } from './fileLimits.ts';
import { girlCardHash, parseGirlCard } from './cards.ts';
import { kvDelete, kvGet, kvSet } from './store.ts';

export const CARD_BOX_KEY = 'night-sugar:cardbox:v1';
export const CARD_BOX_INDEX_KEY = 'night-sugar:cardbox:v2';
export const CARD_RAW_PREFIX = 'night-sugar:cardbox:card:';
export const CARD_BOX_LIMIT = 60;
/**
 * 单张卡的兜底上限。
 *
 * 这里只拦「明显不是契约卡」的文件：带立绘的卡通常在 1–3 MB（立绘是 base64），
 * 256KB 那种老阈值会把正常的卡全挡在门外。真正的容量约束是 IndexedDB 配额，
 * 由 `saveCardBox` 的返回值兜底，写不进去就回滚并报出来。
 */
export const CARD_BOX_MAX_BYTES = CARD_FILE_BYTES_MAX;

/** 卡库索引条目：除了立绘原文，进编成/市场需要的东西都在这里。 */
export interface CardBoxEntry {
  hash: string;
  name: string;
  level: number;
  element: string;
  factionTag: GirlFaction;
  color: string;
  title: string;
  codename?: string;
  quote: string;
  stats: Record<StatKey, number>;
  skillIds: string[];
  portraitSpec?: PortraitSpec;
  fileName: string;
  addedAt: number;
  /** 原始文本的字节数，用来在界面上显示「这张卡多大」。 */
  bytes: number;
  /** 只在刚导入/迁移时短暂存在；`loadCardBox()` 永远不返回它。 */
  raw?: string;
}

const TAG_LABEL: Record<GirlFaction, string> = {
  association: '星灯协会',
  government: '市役所',
  witch: '月蚀庭',
  none: '无所属',
};

const DEFAULT_COLOR = '#8fd3c7';

export function cardBoxTagLabel(tag: GirlFaction): string {
  return TAG_LABEL[tag] ?? TAG_LABEL.none;
}

export function cardBoxByteSize(text: string): number {
  if (typeof TextEncoder === 'undefined') return text.length * 2;
  return new TextEncoder().encode(text).length;
}

/** 给人看的大小：1023B / 24KB / 3.4MB。 */
export function formatByteSize(bytes: number): string {
  return formatBytes(bytes);
}

function statsOf(raw: unknown): Record<StatKey, number> {
  const source = (raw ?? {}) as Record<string, unknown>;
  const pick = (key: StatKey) => (Number.isFinite(source[key]) ? Math.round(source[key] as number) : 50);
  return { magic: pick('magic'), insight: pick('insight'), agility: pick('agility'), empathy: pick('empathy') };
}

function entryOf(card: GirlCard, fileName: string, raw: string): CardBoxEntry {
  const girl = card.girl;
  const entry: CardBoxEntry = {
    hash: girlCardHash(card),
    name: girl.name,
    level: girl.level,
    element: girl.element,
    factionTag: girl.factionTag ?? 'none',
    color: girl.color || DEFAULT_COLOR,
    title: girl.title || '外来者',
    codename: girl.codename,
    quote: girl.quote || '她只对自己的名字负责。',
    stats: { ...girl.stats },
    skillIds: [...girl.skillIds],
    portraitSpec: girl.portraitSpec,
    fileName,
    addedAt: Date.now(),
    bytes: cardBoxByteSize(raw),
  };
  return entry;
}

function metaOf(entry: CardBoxEntry): CardBoxEntry {
  const { raw: _raw, ...meta } = entry;
  return meta as CardBoxEntry;
}

function normalizeCardBox(parsed: unknown): CardBoxEntry[] {
  if (!Array.isArray(parsed)) return [];
  try {
    return parsed.filter((row): row is CardBoxEntry => {
      if (!row || typeof row !== 'object') return false;
      const entry = row as Partial<CardBoxEntry>;
      return typeof entry.hash === 'string' && typeof entry.name === 'string';
    }).map(row => {
      // 旧结构里可能带着 raw：索引里绝不留它，连键都不能有。
      const { raw: _raw, ...meta } = row as CardBoxEntry;
      return {
        ...meta,
        level: Number.isFinite(row.level) ? row.level : 1,
        element: typeof row.element === 'string' ? row.element : '星光系',
        factionTag: (row.factionTag === 'association' || row.factionTag === 'government' || row.factionTag === 'witch') ? row.factionTag : 'none',
        color: typeof row.color === 'string' && row.color ? row.color : DEFAULT_COLOR,
        title: typeof row.title === 'string' && row.title ? row.title : '外来者',
        quote: typeof row.quote === 'string' && row.quote ? row.quote : '她只对自己的名字负责。',
        stats: statsOf(row.stats),
        skillIds: Array.isArray(row.skillIds) ? row.skillIds.filter((id): id is string => typeof id === 'string').slice(0, 8) : [],
        fileName: typeof row.fileName === 'string' ? row.fileName : `${row.name}.json`,
        addedAt: Number.isFinite(row.addedAt) ? row.addedAt : 0,
        bytes: Number.isFinite(row.bytes) ? row.bytes : 0,
      };
    });
  } catch {
    return [];
  }
}

/** 旧版整包卡库 → 新结构；顺手删掉旧键。逐张 pop 是为了尽早释放长字符串。 */
async function migrateLegacy(): Promise<CardBoxEntry[]> {
  const legacy = await kvGet<unknown>(CARD_BOX_KEY).catch(() => undefined);
  if (!Array.isArray(legacy) || !legacy.length) {
    if (legacy !== undefined) await kvDelete(CARD_BOX_KEY).catch(() => false);
    return [];
  }
  const entries: CardBoxEntry[] = [];
  while (legacy.length) {
    const row = legacy.pop() as (Partial<CardBoxEntry> & { raw?: string }) | undefined;
    if (!row || typeof row.raw !== 'string' || !row.raw) continue;
    const parsed = parseGirlCard(row.raw);
    if (!parsed.ok) continue;
    const entry = entryOf(parsed.card, typeof row.fileName === 'string' && row.fileName ? row.fileName : `${parsed.card.girl.name}.json`, row.raw);
    if (typeof row.addedAt === 'number') entry.addedAt = row.addedAt;
    await kvSet(CARD_RAW_PREFIX + entry.hash, row.raw);
    entries.push(entry);
  }
  entries.sort((a, b) => a.addedAt - b.addedAt);
  const kept = entries.slice(-CARD_BOX_LIMIT).map(metaOf);
  await kvSet(CARD_BOX_INDEX_KEY, kept);
  await kvDelete(CARD_BOX_KEY).catch(() => false);
  return kept;
}

/** 只读索引：几百字节，随便读。卡面原文要按 hash 单独取。 */
export async function loadCardBox(): Promise<CardBoxEntry[]> {
  try {
    const stored = await kvGet<unknown>(CARD_BOX_INDEX_KEY);
    if (Array.isArray(stored)) return normalizeCardBox(stored);
    return await migrateLegacy();
  } catch {
    return [];
  }
}

/** 写不进去（空间不足 / 隐私模式）时返回 `false`，由调用方回滚并提示。 */
export async function saveCardBox(entries: CardBoxEntry[]): Promise<boolean> {
  try {
    const kept = entries.slice(0, CARD_BOX_LIMIT);
    await kvSet(CARD_BOX_INDEX_KEY, kept.map(metaOf));
    for (const entry of kept) if (entry.raw) await kvSet(CARD_RAW_PREFIX + entry.hash, entry.raw);
    return true;
  } catch {
    return false;
  }
}

/** 单张卡的原始文本；不存在或读坏了都返回 `undefined`。 */
export async function readCardRaw(hash: string): Promise<string | undefined> {
  try {
    const raw = await kvGet<unknown>(CARD_RAW_PREFIX + hash);
    return typeof raw === 'string' ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 批量取卡：只给真正要用的 hash，调用方自己控制数量。
 * 开局/补货一次最多 `OPENING_CARDS` 张，不会把 60 张卡全读进来。
 */
export async function cardboxCards(hashes: string[]): Promise<GirlCard[]> {
  const cards: GirlCard[] = [];
  for (const hash of hashes) {
    const raw = await readCardRaw(hash);
    if (!raw) continue;
    const parsed = parseGirlCard(raw);
    if (parsed.ok) cards.push(parsed.card);
  }
  return cards;
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
    const entry = { ...entryOf(parsed.card, input.name, input.text), raw: input.text };
    entries.push(entry);
    added.push(entry);
  }

  if (added.length && !(await saveCardBox(entries))) {
    // 配额放不下：整批回滚，别让界面显示「已导入」而刷新后全没。
    const kept = entries.filter(entry => !added.some(row => row.hash === entry.hash));
    await saveCardBox(kept);
    for (const entry of added) await kvDelete(CARD_RAW_PREFIX + entry.hash).catch(() => false);
    for (const entry of added) {
      failed.push({
        name: entry.fileName,
        message: `卡库放不下这张卡（约 ${formatByteSize(entry.bytes)}）：先删几张旧卡，或直接用「导入角色卡」把它编进名册`,
      });
    }
    return { entries: kept, added: [], duplicates, failed };
  }
  return { entries: entries.map(metaOf), added: added.map(metaOf), duplicates, failed };
}

export async function cardboxRemove(hashes: string[], entries: CardBoxEntry[]): Promise<CardBoxEntry[]> {
  const drop = new Set(hashes);
  const kept = entries.filter(entry => !drop.has(entry.hash));
  await saveCardBox(kept);
  for (const hash of drop) await kvDelete(CARD_RAW_PREFIX + hash).catch(() => false);
  return kept;
}

export function cardboxFilter(entries: CardBoxEntry[], query: string): CardBoxEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter(entry => [entry.name, entry.fileName, entry.element, cardBoxTagLabel(entry.factionTag)]
    .some(value => value.toLowerCase().includes(needle)));
}

export function cardboxReport(added: number, duplicates: number, failed: number): string {
  const parts = [`已导入 ${added} 张`];
  if (duplicates) parts.push(`跳过重复 ${duplicates} 张`);
  if (failed) parts.push(`${failed} 张读取失败`);
  return `${parts.join('，')}。`;
}
