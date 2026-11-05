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
 * 约束：只写 JSON、只写这两个目录、单文件 ≤ 24MB、文件名只保留最后一段。
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCardFile, scanCardDir } from './cards-api.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const DATA_DIR = join(ROOT, 'data');
export const SAVES_DIR = join(DATA_DIR, 'saves');
export const CARDS_DIR = join(DATA_DIR, 'cards');
/** 叙事引擎的请求/响应日志：按天一个 jsonl，方便直接 grep。 */
export const LOGS_DIR = join(DATA_DIR, 'llm-logs');
/**
 * 存档本体（v119）：每个 key 一个文件，index.json 只记 key → 文件名。
 *
 * 以前整张 kv 表写进一个 store.json：卡库里 30 多张带立绘的卡就有 250MB，
 * 每次读写都要把 250MB 全量过一遍 JSON——浏览器那边直接读不动，表现就是「重开读不到存档」。
 * 现在按 key 分片：读哪条取哪条，写哪条只动那一个文件。
 */
export const KV_DIR = join(DATA_DIR, 'kv');
export const KV_OBJECTS = join(KV_DIR, 'objects');
export const KV_INDEX = join(KV_DIR, 'index.json');
/** 旧版单文件存档：启动时自动拆成分片并改名备份。 */
export const KV_LEGACY = join(KV_DIR, 'store.json');

const MAX_BYTES = 24 * 1024 * 1024;
const KINDS = new Map([['save', SAVES_DIR], ['card', CARDS_DIR]]);

/* --------------------------- 存档分片存储 --------------------------- */
let kvIndexCache = null;

function kvFileName(key) {
  return `${crypto.createHash('sha1').update(key).digest('hex')}.json`;
}

async function readKvIndex() {
  if (kvIndexCache) return kvIndexCache;
  try {
    const parsed = JSON.parse(await fs.readFile(KV_INDEX, 'utf8'));
    kvIndexCache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    kvIndexCache = {};
  }
  await migrateLegacyKv();
  return kvIndexCache;
}

async function writeKvIndex() {
  await ensure(KV_DIR);
  const tmp = `${KV_INDEX}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(kvIndexCache), 'utf8');
  await fs.rename(tmp, KV_INDEX);
}

/** 旧版 store.json → 每条一个文件；拆完改名成 .bak 留着以备万一。 */
async function migrateLegacyKv() {
  if (!kvIndexCache || Object.keys(kvIndexCache).length) return;
  let legacy = null;
  try {
    legacy = JSON.parse(await fs.readFile(KV_LEGACY, 'utf8'));
  } catch {
    return;
  }
  if (!legacy || typeof legacy !== 'object' || Array.isArray(legacy)) return;
  const keys = Object.keys(legacy);
  if (!keys.length) return;
  await ensure(KV_OBJECTS);
  for (const key of keys) {
    const file = kvFileName(key);
    try {
      await fs.writeFile(join(KV_OBJECTS, file), JSON.stringify(legacy[key]), 'utf8');
      kvIndexCache[key] = { file, bytes: Buffer.byteLength(JSON.stringify(legacy[key])), savedAt: Date.now() };
    } catch { /* 单条写不进去就跳过 */ }
  }
  await writeKvIndex();
  await fs.rename(KV_LEGACY, `${KV_LEGACY}.bak`).catch(() => undefined);
  console.log(`[存档] 旧单文件已拆成 ${Object.keys(kvIndexCache).length} 个分片。`);
}

async function readKvValue(key) {
  const index = await readKvIndex();
  const entry = index[key];
  if (!entry) return undefined;
  try {
    return JSON.parse(await fs.readFile(join(KV_OBJECTS, entry.file), 'utf8'));
  } catch {
    return undefined;
  }
}

async function writeKvValue(key, value) {
  const index = await readKvIndex();
  await ensure(KV_OBJECTS);
  const file = kvFileName(key);
  const text = JSON.stringify(value);
  const tmp = join(KV_OBJECTS, `${file}.tmp`);
  await fs.writeFile(tmp, text, 'utf8');
  await fs.rename(tmp, join(KV_OBJECTS, file));
  index[key] = { file, bytes: Buffer.byteLength(text), savedAt: Date.now() };
  await writeKvIndex();
  return index[key].bytes;
}

async function removeKvValue(key) {
  const index = await readKvIndex();
  const entry = index[key];
  if (!entry) return false;
  delete index[key];
  await fs.rm(join(KV_OBJECTS, entry.file), { force: true }).catch(() => undefined);
  await writeKvIndex();
  return true;
}

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
    if (size > MAX_BYTES) throw new Error('文件超过 24MB，本地通道不收。');
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
    if (route === '/logs' && req.method === 'POST') {
      const body = await readBody(req);
      const parsed = JSON.parse(body || '{}');
      const text = typeof parsed?.text === 'string' ? parsed.text : '';
      if (!text.trim()) { json(res, 400, { ok: false, error: '没有要写的内容。' }); return; }
      await ensure(LOGS_DIR);
      const day = typeof parsed?.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.day)
        ? parsed.day
        : new Date().toISOString().slice(0, 10);
      await fs.appendFile(join(LOGS_DIR, `${day}.jsonl`), text.endsWith('\n') ? text : `${text}\n`, 'utf8');
      json(res, 200, { ok: true, file: join(LOGS_DIR, `${day}.jsonl`) });
      return;
    }
    if (route === '/paths' && req.method === 'GET') {
      await ensure(SAVES_DIR);
      await ensure(CARDS_DIR);
      await ensure(LOGS_DIR);
      await ensure(KV_DIR);
      json(res, 200, { ok: true, root: ROOT, saves: SAVES_DIR, cards: CARDS_DIR, logs: LOGS_DIR, kv: KV_DIR });
      return;
    }
    if (route === '/kv') {
      if (req.method === 'GET') {
        const key = url.searchParams.get('key');
        // 不带 key 只回一份 key 清单；带 key 才取那一条的值。
        if (!key) {
          const index = await readKvIndex();
          const keys = Object.keys(index);
          json(res, 200, { ok: true, keys, bytes: keys.reduce((sum, name) => sum + (index[name]?.bytes ?? 0), 0), dir: KV_DIR });
          return;
        }
        const value = await readKvValue(key);
        if (value === undefined) { json(res, 200, { ok: true, found: false }); return; }
        json(res, 200, { ok: true, found: true, value });
        return;
      }
      if (req.method === 'POST' || req.method === 'PUT') {
        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch (error) {
          json(res, 400, { ok: false, message: error instanceof Error ? error.message : '请求体不是 JSON。' });
          return;
        }
        const key = typeof body?.key === 'string' ? body.key : '';
        if (!key) { json(res, 400, { ok: false, message: '缺少 key。' }); return; }
        try {
          if (body?.remove === true) await removeKvValue(key);
          else await writeKvValue(key, body?.value);
        } catch (error) {
          json(res, 500, { ok: false, message: error instanceof Error ? error.message : '写入失败。' });
          return;
        }
        json(res, 200, { ok: true, dir: KV_DIR });
        return;
      }
      json(res, 405, { ok: false, message: '只支持 GET / POST。' });
      return;
    }
    if (route === '/cards' && req.method === 'GET') {
      const asked = url.searchParams.get('dir')?.trim();
      const name = url.searchParams.get('name')?.trim();
      const target = asked && asked.length ? asked : CARDS_DIR;
      // 带 name 就是按需读单张（大卡扫描时只报名字，前端再逐张来取）。
      const result = name ? await readCardFile(target, name) : await scanCardDir(target);
      if (!name && result.ok && !asked) result.defaultDir = CARDS_DIR;
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
        if (Buffer.byteLength(text, 'utf8') > MAX_BYTES) { json(res, 400, { ok: false, message: '文件超过 24MB，本地通道不收。' }); return; }
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
