/**
 * 把「小卡」做成静态资源，让 Cloudflare Pages 这类纯静态托管也能有开局名册。
 *
 * 本地跑的时候卡库走 `/api/cards`（读磁盘、能读大卡）；静态部署没有那个接口，
 * 所以这里在构建/开发时把 `data/cards/` 里体积够小的卡复制成 `/cards/*.json`，
 * 再写一份 `/cards/index.json` 当清单。体积大的卡（10–21MB）不进产物——CF Pages 单文件
 * 上限 25MB，构建产物也吃不下，那些留到「玩家自己拖进来」的通道。
 *
 * 上限默认 4MB，和仓库里同步的那批小卡一致；可用 `STATIC_CARDS_MAX_BYTES` 覆盖。
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_MAX_BYTES = Math.round(4 * 1024 * 1024);
const INDEX_NAME = 'index.json';

export const STATIC_CARD_BASE = '/cards';

const maxBytes = () => Number(process.env.STATIC_CARDS_MAX_BYTES) || DEFAULT_MAX_BYTES;

/** 读 `data/cards` 里能发布的卡：只收 .json、不超过上限、跳过清单自己。 */
async function listStaticCards(root) {
  const dir = path.join(root, 'data', 'cards');
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const limit = maxBytes();
  const files = [];
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (!name.toLowerCase().endsWith('.json') || name === INDEX_NAME) continue;
    try {
      const stat = await fs.stat(path.join(dir, name));
      if (!stat.isFile() || stat.size > limit) continue;
      files.push({ name, bytes: stat.size });
    } catch {
      // 读不到就跳过，一张坏卡不该挡住整个构建
    }
  }
  return files;
}

function indexPayload(files) {
  return {
    ok: true,
    kind: 'static',
    dir: STATIC_CARD_BASE,
    note: `静态卡库：只收了单张 ≤ ${Math.round(maxBytes() / 1024 / 1024 * 10) / 10}MB 的卡，大卡请在游戏里自己导入。`,
    files: files.map(file => ({ name: file.name, bytes: file.bytes, text: undefined })),
  };
}

/** 构建时把卡复制进 outDir/cards 并写清单。 */
export async function emitStaticCards(root, outDir) {
  const files = await listStaticCards(root);
  const target = path.join(outDir, 'cards');
  await fs.mkdir(target, { recursive: true });
  for (const file of files) {
    await fs.copyFile(path.join(root, 'data', 'cards', file.name), path.join(target, file.name));
  }
  await fs.writeFile(path.join(target, INDEX_NAME), JSON.stringify(indexPayload(files), null, 1), 'utf8');
  return files.length;
}

/** 开发服务器也提供同一套静态路径，免得「本地能跑、部署后没有」两种行为。 */
function serveStaticCards(root) {
  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const name = decodeURIComponent(url.pathname.replace(/^\/cards\/?/, ''));
    if (!name) { next(); return; }
    if (name === INDEX_NAME) {
      const files = await listStaticCards(root);
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(indexPayload(files)));
      return;
    }
    // 只发清单里出现过的卡：路径里带 ../ 的一律不认。
    const files = await listStaticCards(root);
    if (!files.some(file => file.name === name)) { next(); return; }
    try {
      const text = await fs.readFile(path.join(root, 'data', 'cards', name), 'utf8');
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(text);
    } catch {
      next();
    }
  };
}

export function staticCardsPlugin(root = process.cwd()) {
  let outDir = path.join(root, 'dist');
  return {
    name: 'night-sugar:static-cards',
    configResolved(config) {
      outDir = path.isAbsolute(config.build.outDir) ? config.build.outDir : path.join(root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(`${STATIC_CARD_BASE}`, serveStaticCards(root));
    },
    configurePreviewServer(server) {
      server.middlewares.use(`${STATIC_CARD_BASE}`, serveStaticCards(root));
    },
    async closeBundle() {
      const count = await emitStaticCards(root, outDir);
      this.info?.(`静态卡库：已复制 ${count} 张小卡到 ${path.relative(root, path.join(outDir, 'cards'))}`);
    },
  };
}
