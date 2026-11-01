/**
 * 只读的卡库扫描接口：给本地开发/预览服务加一个「读某个目录里的 JSON」的入口。
 *
 * 纯静态部署时这个接口不存在，前端会自动退回「选择文件夹」。
 * 约束：只读、只看 .json、深度 ≤ 3、最多 60 个文件、单个 ≤ 24MB（与卡库上限一致）、
 * 跳过依赖与构建目录。带立绘的卡动辄 10MB+，所以扫描只把 ≤ 256KB 的卡连内容一起带回来，
 * 更大的卡只报名字与大小，由前端按需再取一次（`?dir=&name=`）。
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const MAX_FILES = 60;
/** 单张卡的硬上限，和前端 `CARD_BOX_MAX_BYTES` 保持一致。 */
export const MAX_BYTES = 24 * 1024 * 1024;
/** 扫描时顺手带回内容的阈值：超过这个大小的卡改成单独读。 */
const INLINE_BYTES = 256 * 1024;
const MAX_DEPTH = 3;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'dist-ssr', '.tmp', 'coverage']);

const sizeLabel = bytes => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;

function expandDir(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';
  if (raw === '~') return os.homedir();
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(os.homedir(), raw.slice(2));
  return path.resolve(raw);
}

async function walk(dir, depth, files, skipped) {
  if (files.length >= MAX_FILES) return;
  let items;
  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    skipped.push({ name: dir, reason: '这个目录打不开' });
    return;
  }
  items.sort((a, b) => a.name.localeCompare(b.name));
  for (const item of items) {
    if (files.length >= MAX_FILES) return;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (depth >= MAX_DEPTH || SKIP_DIRS.has(item.name) || item.name.startsWith('.')) continue;
      await walk(full, depth + 1, files, skipped);
      continue;
    }
    if (!item.isFile() || !item.name.toLowerCase().endsWith('.json')) continue;
    try {
      const stat = await fs.stat(full);
      if (stat.size > MAX_BYTES) { skipped.push({ name: item.name, reason: `文件 ${sizeLabel(stat.size)}，超过 ${sizeLabel(MAX_BYTES)}，可能不是契约卡` }); continue; }
      // 小卡直接带回内容；大卡（带立绘的）只报大小，前端按需再来取。
      const entry = { name: item.name, bytes: stat.size };
      if (stat.size <= INLINE_BYTES) entry.text = await fs.readFile(full, 'utf8');
      files.push(entry);
    } catch {
      skipped.push({ name: item.name, reason: '这个文件读不出来' });
    }
  }
}

export async function scanCardDir(input) {
  const dir = expandDir(input);
  if (!dir) return { ok: false, status: 400, message: '先填一个目录，例如 G:\\cards 或 ~/cards。' };
  let stat;
  try {
    stat = await fs.stat(dir);
  } catch {
    return { ok: false, status: 404, message: `找不到这个目录：${dir}` };
  }
  if (!stat.isDirectory()) return { ok: false, status: 400, message: `这不是一个目录：${dir}` };
  const files = [];
  const skipped = [];
  await walk(dir, 0, files, skipped);
  if (!files.length && !skipped.length) return { ok: false, status: 200, message: `这个目录里没有 .json 文件：${dir}` };
  return { ok: true, status: 200, dir, files, skipped };
}

/**
 * 单张卡的按需读取：扫描时没带内容的大卡由前端用 `?dir=&name=` 再取一次。
 * `name` 只接受最后一段文件名，避免顺着 `..` 读到目录外面。
 */
export async function readCardFile(input, name) {
  const dir = expandDir(input);
  const file = String(name ?? '').trim();
  if (!dir) return { ok: false, status: 400, message: '先填一个目录，例如 G:\\cards 或 ~/cards。' };
  if (!file || !file.toLowerCase().endsWith('.json') || /[\\/]/.test(file) || path.basename(file) !== file) {
    return { ok: false, status: 400, message: '只能读这个目录里的 .json 文件。' };
  }
  try {
    const full = path.join(dir, file);
    const stat = await fs.stat(full);
    if (!stat.isFile()) throw new Error('不是文件');
    if (stat.size > MAX_BYTES) return { ok: false, status: 413, message: `文件 ${sizeLabel(stat.size)}，超过 ${sizeLabel(MAX_BYTES)}，可能不是契约卡` };
    return { ok: true, status: 200, name: file, bytes: stat.size, text: await fs.readFile(full, 'utf8') };
  } catch {
    return { ok: false, status: 404, message: `读不到这个文件：${file}` };
  }
}

/** connect / node:http 通用处理函数：vite 的 dev 中间件和 scripts/serve.mjs 都挂它。 */
export async function handleCardsApi(req, res) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  let result;
  try {
    const dir = url.searchParams.get('dir');
    const name = url.searchParams.get('name');
    result = name ? await readCardFile(dir, name) : await scanCardDir(dir);
  } catch (error) {
    result = { ok: false, status: 500, message: error instanceof Error ? error.message : '扫描失败' };
  }
  res.writeHead(result.status ?? 200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(result));
}

/** Vite 插件：只在开发服务器上挂接口，构建产物里不带任何服务端代码。 */
export function cardsApiPlugin() {
  return {
    name: 'night-sugar:cards-api',
    configureServer(server) {
      server.middlewares.use('/api/cards', (req, res) => { void handleCardsApi(req, res); });
    },
  };
}
