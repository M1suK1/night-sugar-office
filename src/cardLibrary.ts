/**
 * 本地卡库作为「角色来源」。
 *
 * 以前开局名册、市场补货、编成池各走各的路：名册是内置的 6 位少女（`content/seed-pack.ts`），
 * 候选池是现场合成的角色，卡库只是玩家手动去挑的加菜。这一层把「从哪来人」收成一处：
 * 本地跑（`npm run dev` / `start.cmd`）时优先读 `data/cards/`，读不到才回退内置角色。
 *
 * 两条取卡通道，按顺序试：
 *  1. `/api/cards`——本地跑（npm run dev / start.cmd）才有，能读磁盘上的全部卡；
 *  2. `/cards/index.json`——构建时把 ≤4MB 的小卡复制成静态资源，静态托管（Cloudflare Pages）
 *     也能有开局名册；大卡不进产物，留给玩家自己拖进来。
 *
 * 约定：
 *  - 扫描只拿元数据（名字与字节数），大卡（带立绘，10–21MB）等真要用了再单张读；
 *  - 小卡优先：先读体积小的，避免为 6 个人一次拉上百 MB；
 *  - 开局入册的角色统一压到 1 级，避免从卡里带进一个 20 级的大佬；
 *  - 任何一步失败都只返回原因，不抛异常——调用方负责回退。
 */
import { parseGirlCard } from './cards.ts';
import { MAX_LEVEL, baseStatsAt, growthFor } from './progression.ts';
import type { GirlCard } from './types.ts';

/** 开局从卡库取几位。与内置名册同样的 6 人，宿舍也是 6 个床位。 */
export const LIBRARY_START_ROSTER = 6;

/** 卡库里的一张卡：扫描只回名字与大小，`text` 只有小卡才带。 */
export interface LibraryFile {
  name: string;
  bytes: number;
  text?: string;
}

/** 卡库来源：本地接口能读全量；静态卡库只有构建时复制进去的小卡。 */
export type LibraryKind = 'local' | 'static';

export interface LibraryScan {
  ok: boolean;
  kind: LibraryKind;
  dir: string;
  files: LibraryFile[];
  /** 没读成的原因，给界面显示。 */
  reason?: string;
  /** 静态卡库的说明（体积上限之类），界面上照着写出来。 */
  note?: string;
}

/** 静态卡库的挂载点，与 scripts/static-cards.mjs 保持一致。 */
export const STATIC_CARD_BASE = '/cards';
export const STATIC_CARD_INDEX = '/cards/index.json';

async function scanLocal(dir: string): Promise<LibraryScan> {
  try {
    const response = await fetch(`/api/cards${dir ? `?dir=${encodeURIComponent(dir)}` : ''}`);
    const raw = await response.text();
    const data = JSON.parse(raw) as { ok?: boolean; dir?: string; files?: LibraryFile[]; message?: string };
    if (!data?.ok || !Array.isArray(data.files)) {
      return { ok: false, kind: 'local', dir, files: [], reason: data?.message ?? '本地卡库读不出来。' };
    }
    return { ok: true, kind: 'local', dir: typeof data.dir === 'string' ? data.dir : dir, files: data.files.filter(file => file && typeof file.name === 'string') };
  } catch {
    return { ok: false, kind: 'local', dir, files: [], reason: '连不上本地卡库接口。' };
  }
}

/** 构建产物里的静态清单：CF Pages 这类纯静态托管靠它开局。 */
async function scanStatic(): Promise<LibraryScan> {
  try {
    const response = await fetch(STATIC_CARD_INDEX);
    if (!response.ok) return { ok: false, kind: 'static', dir: STATIC_CARD_BASE, files: [], reason: '这份部署里没有静态卡库。' };
    const data = JSON.parse(await response.text()) as { ok?: boolean; dir?: string; files?: LibraryFile[]; note?: string; message?: string };
    if (!data?.ok || !Array.isArray(data.files)) {
      return { ok: false, kind: 'static', dir: STATIC_CARD_BASE, files: [], reason: data?.message ?? '静态卡库清单读不出来。' };
    }
    return {
      ok: true,
      kind: 'static',
      dir: typeof data.dir === 'string' ? data.dir : STATIC_CARD_BASE,
      files: data.files.filter(file => file && typeof file.name === 'string'),
      note: typeof data.note === 'string' ? data.note : undefined,
    };
  } catch {
    return { ok: false, kind: 'static', dir: STATIC_CARD_BASE, files: [], reason: '这份部署里没有静态卡库。' };
  }
}

/**
 * 扫卡库：先试本地接口，再试构建时复制的静态清单。
 *
 * 两条都拿不到才算失败——调用方据此回退内置名册，并把 `reason` 原样显示给玩家。
 */
export async function scanLibrary(dir = ''): Promise<LibraryScan> {
  const local = await scanLocal(dir);
  if (local.ok && local.files.length) return local;
  const stat = await scanStatic();
  if (stat.ok && stat.files.length) return stat;
  return {
    ok: false,
    kind: dir ? 'local' : 'static',
    dir: dir || STATIC_CARD_BASE,
    files: [],
    reason: local.files.length === 0 && local.ok
      ? stat.reason ?? '卡库里没有可用的卡。'
      : local.reason ?? stat.reason ?? '卡库里没有可用的卡。',
  };
}

/** 读一张卡的内容：小卡在扫描时就带着 `text`，大卡再按名字取一次。 */
export async function readLibraryFile(
  file: LibraryFile,
  source: { dir?: string; kind?: LibraryKind } = {},
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  if (typeof file.text === 'string' && file.text) return { ok: true, text: file.text };
  if (source.kind === 'static') {
    try {
      const response = await fetch(`${STATIC_CARD_BASE}/${encodeURIComponent(file.name)}`);
      if (!response.ok) return { ok: false, message: '这张卡不在这份静态卡库里。' };
      return { ok: true, text: await response.text() };
    } catch {
      return { ok: false, message: '这张卡读不出来。' };
    }
  }
  const dir = source.dir ?? '';
  try {
    const query = `${dir ? `dir=${encodeURIComponent(dir)}&` : ''}name=${encodeURIComponent(file.name)}`;
    const response = await fetch(`/api/cards?${query}`);
    const data = JSON.parse(await response.text()) as { ok?: boolean; text?: string; message?: string };
    if (data?.ok && typeof data.text === 'string') return { ok: true, text: data.text };
    return { ok: false, message: data?.message ?? '这张卡读不出来。' };
  } catch {
    return { ok: false, message: '连不上本地卡库接口。' };
  }
}

/**
 * 挑几张卡：先按体积从小到大取一批候选，再在这批里随机打散。
 *
 * 全随机会让开局有时读到 20MB 的卡；纯按体积最小又每次都同样几个人。
 * 折中：在小卡里随机，既省内存也不重复。
 */
export function pickLibraryFiles(files: LibraryFile[], count: number, exclude: Set<string> = new Set(), random = Math.random): LibraryFile[] {
  const pool = files.filter(file => file && typeof file.name === 'string' && !exclude.has(file.name));
  if (count <= 0 || !pool.length) return [];
  const bySize = [...pool].sort((a, b) => a.bytes - b.bytes);
  // 候选池取目标数的三倍（至少 count 张），给随机留出余地，又不至于挑到大卡。
  const shortlist = bySize.slice(0, Math.max(count, Math.min(bySize.length, count * 3)));
  for (let index = shortlist.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [shortlist[index], shortlist[swap]] = [shortlist[swap]!, shortlist[index]!];
  }
  return shortlist.slice(0, Math.min(count, shortlist.length));
}

/**
 * 压到 1 级：卡是导出时的快照，等级可能是 20。
 * 四维回到 1 级基准（按职阶的主/副属性反推），经验清零。
 *
 * 只改卡面字段：血量这类派生物在导入时由 hydrate 重算，这里不硬塞。
 */
export function normalizeOpeningLevel(girl: GirlCard['girl']): GirlCard['girl'] {
  return normalizeToLevel(girl, 1);
}

/**
 * 把一张卡的等级与四维归一到指定等级（高级招聘用）。
 *
 * 成长口径跟升级一致：主属性每级 +2、副属性每级 +1，其余不动。卡里原本的等级只用来
 * 反推基准，所以同一张卡落到 1 级和落到 4 级，属性差正好是三级成长。
 */
export function normalizeToLevel(girl: GirlCard['girl'], level: number): GirlCard['girl'] {
  const target = Math.max(1, Math.min(MAX_LEVEL, Math.round(level)));
  const base = baseStatsAt(girl.stats, girl.level, girl.archetype);
  const [main, secondary] = growthFor(girl.archetype);
  const stats = { ...base };
  stats[main] = base[main] + (target - 1) * 2;
  stats[secondary] = base[secondary] + (target - 1);
  return { ...girl, level: target, stats };
}

export interface LibraryCardsResult {
  ok: boolean;
  cards: GirlCard[];
  /** 读失败/解析失败的文件名，给提示用。 */
  failed: string[];
  reason?: string;
}

/** 从卡库取 `count` 张卡，全部压到 1 级。 */
export async function readLibraryCards(count: number, options: { dir?: string; exclude?: Set<string>; random?: () => number } = {}): Promise<LibraryCardsResult> {
  const scan = await scanLibrary(options.dir ?? '');
  if (!scan.ok || !scan.files.length) return { ok: false, cards: [], failed: [], reason: scan.reason ?? '卡库里没有可用的卡。' };
  const picked = pickLibraryFiles(scan.files, count, options.exclude ?? new Set(), options.random);
  const cards: GirlCard[] = [];
  const failed: string[] = [];
  for (const file of picked) {
    const text = await readLibraryFile(file, { dir: scan.dir, kind: scan.kind });
    if (!text.ok) { failed.push(file.name); continue; }
    const parsed = parseGirlCard(text.text);
    if (!parsed.ok) { failed.push(file.name); continue; }
    cards.push({ ...parsed.card, girl: normalizeOpeningLevel(parsed.card.girl) });
  }
  if (!cards.length) return { ok: false, cards: [], failed, reason: '卡库里的卡都读不出来。' };
  return { ok: true, cards, failed };
}
