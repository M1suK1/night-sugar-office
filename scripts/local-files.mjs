/**
 * 本地文件通道：把「存档」和「契约卡」的默认落点固定在项目文件夹里。
 *
 * 浏览器下载永远落在系统的下载目录，改不了；所以真正的默认路径只能由本地服务来给：
 *   <项目>/data/saves/  ← 导出存档、读取存档
 *   <项目>/data/cards/  ← 导出契约卡、扫描契约卡
 *
 * 只在这三种情况下挂载：npm run dev、npm run preview、node scripts/serve.mjs。
 * 纯静态部署时前端拿不到 /api/paths，会自动退回浏览器下载与「选择文件夹」。
 *
 * 约束：只写 JSON、只写这两个目录、单文件 ≤ 8MB、文件名只保留最后一段。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanCardDir } from './cards-api.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const DATA_DIR = join(ROOT, 'data');
export const SAVES_DIR = join(DATA_DIR, 'saves');
export const CARDS_DIR = join(DATA_DIR, 'cards');

const MAX_BYTES = 8 * 1024 * 1024;
const KINDS = new Map([['save', SAVES_DIR], ['card', CARDS_DIR]]);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function ensure(dir) {
  await fs.mkdir(dir, { recursive: true });
}

/** 只留最后一段文件名，去掉路径分隔与控制字符，补上 .json。 */
export function safeFileName(input) {
  const raw = String(input ?? '').replace(/[\\/]/g, ' ').replace(/[\u0000-\u001f:*?"<>|]/g, ' ').trim();
  const trimmed = raw.slice(-120).trim() || '未命名';
  return trimmed.toLowerCase().endsWith('.json') ? trimmed : `${trimmed}.json`;
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('文件超过 8MB，本地通道不收。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function listFiles(dir) {
  await ensure(dir);
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    try {
      const stat = await fs.stat(join(dir, name));
      if (!stat.isFile()) continue;
      out.push({ name, bytes: stat.size, savedAt: stat.mtimeMs });
    } catch { /* 读不出来就当没有 */ }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * `/api/*` 的唯一入口。Vite 中间件、node:http 都用它。
 * GET  /api/paths                       → 默认目录
 * GET  /api/files?kind=save|card        → 目录里的 JSON 列表
 * GET  /api/files?kind=save&name=a.json → 读一份
 * POST /api/files  {kind,name,text}     → 写一份
 * GET  /api/cards?dir=                  → 扫描契约卡目录（dir 留空则用默认 cards 目录）
 */
export async function handleLocalApi(req, res) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const route = url.pathname.replace(/^\/api/, '') || '/';
  try {
    if (route === '/paths' && req.method === 'GET') {
      await ensure(SAVES_DIR);
      await ensure(CARDS_DIR);
      json(res, 200, { ok: true, root: ROOT, saves: SAVES_DIR, cards: CARDS_DIR });
      return;
    }
    if (route === '/cards' && req.method === 'GET') {
      const asked = url.searchParams.get('dir')?.trim();
      const result = await scanCardDir(asked && asked.length ? asked : CARDS_DIR);
      if (result.ok && !asked) result.defaultDir = CARDS_DIR;
      json(res, result.status ?? 200, result);
      return;
    }
    if (route === '/files') {
      // GET 从查询串取 kind；POST 也可能把它写在请求体里，所以先解析体再定目录。
      let body = null;
      if (req.method === 'POST') {
        try {
          body = JSON.parse(await readBody(req));
        } catch (error) {
          json(res, 400, { ok: false, message: error instanceof Error ? error.message : '请求体不是 JSON。' });
          return;
        }
      }
      const kind = url.searchParams.get('kind') || (typeof body?.kind === 'string' ? body.kind : '');
      const dir = KINDS.get(kind);
      if (!dir) { json(res, 400, { ok: false, message: 'kind 只能是 save 或 card。' }); return; }
      if (req.method === 'GET') {
        const name = url.searchParams.get('name');
        if (!name) { json(res, 200, { ok: true, dir, files: await listFiles(dir) }); return; }
        const file = join(dir, safeFileName(name));
        try {
          const text = await fs.readFile(file, 'utf8');
          json(res, 200, { ok: true, name: path.basename(file), text });
        } catch {
          json(res, 404, { ok: false, message: `读不到这个文件：${path.basename(file)}` });
        }
        return;
      }
      if (req.method === 'POST') {
        const text = typeof body?.text === 'string' ? body.text : '';
        if (!text) { json(res, 400, { ok: false, message: '没有收到文件内容。' }); return; }
        if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) { json(res, 400, { ok: false, message: '文件超过 8MB，本地通道不收。' }); return; }
        try {
          JSON.parse(text);
        } catch {
          json(res, 400, { ok: false, message: '内容不是合法 JSON，没有写入。' });
          return;
        }
        await ensure(dir);
        const file = join(dir, safeFileName(body?.name));
        await fs.writeFile(file, text, 'utf8');
        json(res, 200, { ok: true, name: path.basename(file), path: file, bytes: Buffer.byteLength(text, 'utf8') });
        return;
      }
      json(res, 405, { ok: false, message: '只支持 GET 和 POST。' });
      return;
    }
    json(res, 404, { ok: false, message: '没有这个本地接口。' });
  } catch (error) {
    json(res, 500, { ok: false, message: error instanceof Error ? error.message : '本地接口出错。' });
  }
}

/** Vite 插件：开发服务器与预览服务器都会挂上同一套接口。 */
export function localApiPlugin() {
  const mount = (server) => {
    server.middlewares.use('/api', (req, res) => { void handleLocalApi(req, res); });
  };
  return {
    name: 'night-sugar:local-api',
    configureServer: mount,
    configurePreviewServer: mount,
  };
}
