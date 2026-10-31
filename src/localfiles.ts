/**
 * 本地文件通道的前端半边。
 *
 * 只有 `npm run dev` / `npm run preview` / `node scripts/serve.mjs` 起来的站点才有这套接口；
 * 纯静态部署时 `available()` 会一直是 false，调用方退回浏览器下载。
 *
 * 默认落点固定在项目里：`data/saves/` 与 `data/cards/`（见 `scripts/local-files.mjs`）。
 */
export type LocalKind = 'save' | 'card';

export type LocalPaths = { root: string; saves: string; cards: string };
export type LocalFile = { name: string; bytes: number; savedAt: number };

let cached: LocalPaths | null | undefined;

const BASE = '/api';

async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  try { return JSON.parse(text) as T; } catch { return null; }
}

/** 拿一次默认目录并记住；静态部署返回 null。 */
export async function localPaths(force = false): Promise<LocalPaths | null> {
  if (!force && cached !== undefined) return cached;
  try {
    const response = await fetch(`${BASE}/paths`);
    const data = await readJson<{ ok?: boolean } & LocalPaths>(response);
    cached = data?.ok && data.saves && data.cards ? { root: data.root, saves: data.saves, cards: data.cards } : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function dirOf(paths: LocalPaths, kind: LocalKind): string {
  return kind === 'save' ? paths.saves : paths.cards;
}

export async function listLocalFiles(kind: LocalKind): Promise<LocalFile[] | null> {
  try {
    const response = await fetch(`${BASE}/files?kind=${kind}`);
    const data = await readJson<{ ok?: boolean; files?: LocalFile[] }>(response);
    return data?.ok && Array.isArray(data.files) ? data.files : null;
  } catch {
    return null;
  }
}

export async function readLocalFile(kind: LocalKind, name: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE}/files?kind=${kind}&name=${encodeURIComponent(name)}`);
    const data = await readJson<{ ok?: boolean; text?: string }>(response);
    return data?.ok && typeof data.text === 'string' ? data.text : null;
  } catch {
    return null;
  }
}

/**
 * 写一份到项目目录。返回落盘路径；没有本地服务或写入失败时返回 null，
 * 调用方应该退回去用浏览器下载。
 */
export async function writeLocalFile(kind: LocalKind, name: string, text: string): Promise<string | null> {
  try {
    const response = await fetch(`${BASE}/files?kind=${kind}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, name, text }),
    });
    const data = await readJson<{ ok?: boolean; path?: string }>(response);
    return data?.ok && data.path ? data.path : null;
  } catch {
    return null;
  }
}

/** 提示里只显示 `data/saves/xxx.json` 这一段，别把整条盘符糊到界面上。 */
export function shortPath(full: string): string {
  const parts = full.split(/[\\/]/).filter(Boolean);
  return parts.slice(-3).join('/');
}

/** 没有本地服务时的退路：浏览器下载。 */
export function downloadFile(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

