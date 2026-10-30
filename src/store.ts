/**
 * 本地大对象存储：IndexedDB 的两张表（`kv` 放小对象，`assets` 放立绘的原始字节）。
 *
 * 为什么搬出 localStorage：它按 origin 给约 5MB（UTF-16，约 250 万字符）配额，卡库、当前进度、
 * 三个存档位、世界书、预设全挤在一起。而一张 1024×1024 的 PNG 立绘就有 1–2MB，几十张就把配额吃光。
 *
 * 没有 IndexedDB 时（node 测试、部分隐私模式）退化为进程内 Map，接口形状完全一致，
 * 所以状态测试不需要装假 IDB。
 */

import type { AssetId, CropBox } from './types.ts';

export const DB_NAME = 'night-sugar';
export const DB_VERSION = 1;
export const KV_STORE = 'kv';
export const ASSETS_STORE = 'assets';
/** 孤儿立绘的宽限期：刚导入、还没落盘引用的图不能被扫掉。 */
export const ASSET_GRACE_MS = 24 * 60 * 60 * 1000;

export interface AssetMeta {
  mime: string;
  bytes: number;
  width?: number;
  height?: number;
  crop?: CropBox;
  addedAt: number;
  /** 来源标记：migration / upload / card。 */
  source?: string;
}

export interface StoredAsset {
  blob: Blob;
  meta: AssetMeta;
}

type Row = Record<string, unknown>;

interface Backend {
  get(store: string, key: string): Promise<Row | undefined>;
  put(store: string, key: string, row: Row): Promise<void>;
  delete(store: string, key: string): Promise<boolean>;
  keys(store: string): Promise<string[]>;
}

/* ------------------------------ 内存后端 ------------------------------ */

const memory = new Map<string, Map<string, Row>>();

function bucket(store: string): Map<string, Row> {
  let found = memory.get(store);
  if (!found) {
    found = new Map<string, Row>();
    memory.set(store, found);
  }
  return found;
}

const memoryBackend: Backend = {
  async get(store, key) {
    return bucket(store).get(key);
  },
  async put(store, key, row) {
    bucket(store).set(key, row);
  },
  async delete(store, key) {
    return bucket(store).delete(key);
  },
  async keys(store) {
    return [...bucket(store).keys()];
  },
};

/* ---------------------------- IndexedDB 后端 ---------------------------- */

let dbPromise: Promise<IDBDatabase> | undefined;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE, { keyPath: 'key' });
        if (!db.objectStoreNames.contains(ASSETS_STORE)) db.createObjectStore(ASSETS_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 打不开。'));
    });
    // 打开失败就别把失败的 promise 一直缓存着，下一轮还能重试。
    dbPromise.catch(() => { dbPromise = undefined; });
  }
  return dbPromise;
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败。'));
  });
}

const idbBackend: Backend = {
  async get(store, key) {
    const db = await openDb();
    const tx = db.transaction(store, 'readonly');
    const row = await settle(tx.objectStore(store).get(key) as IDBRequest<Row | undefined>);
    return row ?? undefined;
  },
  async put(store, _key, row) {
    const db = await openDb();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(row);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('写入失败。'));
      tx.onabort = () => reject(tx.error ?? new Error('写入被中断。'));
    });
  },
  async delete(store, key) {
    const db = await openDb();
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('删除失败。'));
      tx.onabort = () => reject(tx.error ?? new Error('删除被中断。'));
    });
    return true;
  },
  async keys(store) {
    const db = await openDb();
    const tx = db.transaction(store, 'readonly');
    const keys = await settle(tx.objectStore(store).getAllKeys() as IDBRequest<IDBValidKey[]>);
    return keys.map(key => String(key));
  },
};

export function storeAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function backend(): Backend {
  return storeAvailable() ? idbBackend : memoryBackend;
}

/* -------------------------------- kv -------------------------------- */

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await backend().get(KV_STORE, key);
  return row ? (row.value as T) : undefined;
}

/** 测试用故障开关：模拟写不进去（真实环境里是配额或隐私模式）。 */
let kvWriteFault = false;

export function __setKvWriteFaultForTests(fault: boolean): void {
  kvWriteFault = fault;
}

/** 测试用：清空内存后端，让每个用例都从空库开始。 */
export function __resetKvForTests(): void {
  memory.clear();
  kvWriteFault = false;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  if (kvWriteFault) throw new Error('QuotaExceededError');
  await backend().put(KV_STORE, key, { key, value });
}

export async function kvDelete(key: string): Promise<boolean> {
  return backend().delete(KV_STORE, key);
}

export async function kvKeys(prefix = ''): Promise<string[]> {
  const keys = await backend().keys(KV_STORE);
  return prefix ? keys.filter(key => key.startsWith(prefix)) : keys;
}

/* ------------------------------- assets ------------------------------- */

function base64FromBytes(bytes: Uint8Array): string {
  const bufferCtor = (globalThis as { Buffer?: { from(input: Uint8Array): { toString(encode: string): string } } }).Buffer;
  if (bufferCtor) return bufferCtor.from(bytes).toString('base64');
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function hashBytes(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest('SHA-256', bytes as unknown as BufferSource);
    return [...new Uint8Array(digest).slice(0, 16)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }
  // 没有 SubtleCrypto 时退化成两个 FNV：只用来给同一张图去重，不承担安全职责。
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < bytes.length; i += 1) {
    a = Math.imul(a ^ bytes[i], 16777619) >>> 0;
    b = Math.imul(b + bytes[i], 2654435761) >>> 0;
  }
  return `fnv${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/** 存入原始字节，返回内容哈希当键：同一张图重复导入只会占一份。 */
export async function assetPut(blob: Blob, meta: Partial<AssetMeta> = {}): Promise<AssetId> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const id = await hashBytes(bytes);
  const full: AssetMeta = {
    mime: blob.type || 'image/png',
    bytes: bytes.byteLength,
    addedAt: Date.now(),
    ...meta,
  };
  await backend().put(ASSETS_STORE, id, { key: id, blob, meta: full });
  return id;
}

export async function assetGet(id: AssetId): Promise<StoredAsset | undefined> {
  const row = await backend().get(ASSETS_STORE, id);
  if (!row) return undefined;
  return { blob: row.blob as Blob, meta: row.meta as AssetMeta };
}

export async function assetDelete(id: AssetId): Promise<boolean> {
  urls.delete(id);
  return backend().delete(ASSETS_STORE, id);
}

export async function assetKeys(): Promise<AssetId[]> {
  return backend().keys(ASSETS_STORE);
}

export async function assetBytes(): Promise<number> {
  const ids = await assetKeys();
  let total = 0;
  for (const id of ids) {
    const asset = await assetGet(id);
    total += asset?.meta.bytes ?? 0;
  }
  return total;
}

/**
 * 回收没人引用的立绘。
 *
 * `keep` 是「当前进度 + 三个存档位」引用集合的并集。宽限期内的新图跳过——刚导入还没落盘时
 * 引用集合里当然没有它。
 */
export async function assetSweep(keep: Set<AssetId>, now = Date.now()): Promise<number> {
  let removed = 0;
  for (const id of await assetKeys()) {
    if (keep.has(id)) continue;
    const asset = await assetGet(id);
    if (!asset) continue;
    if (now - (asset.meta.addedAt ?? 0) < ASSET_GRACE_MS) continue;
    await assetDelete(id);
    removed += 1;
  }
  return removed;
}

/* --------------------------- object URL 缓存 --------------------------- */

const urls = new Map<AssetId, { url: string; refs: number }>();

/** 取一个可渲染的 object URL；用完必须 `assetRelease`，引用归零才会 revoke。 */
export async function assetUrl(id: AssetId): Promise<string | undefined> {
  const hit = urls.get(id);
  if (hit) {
    hit.refs += 1;
    return hit.url;
  }
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return undefined;
  const asset = await assetGet(id);
  if (!asset) return undefined;
  const url = URL.createObjectURL(asset.blob);
  urls.set(id, { url, refs: 1 });
  return url;
}

export function assetRelease(id: AssetId): void {
  const hit = urls.get(id);
  if (!hit) return;
  hit.refs -= 1;
  if (hit.refs > 0) return;
  urls.delete(id);
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(hit.url);
}

/* --------------------------- dataURL 与字节 --------------------------- */

export function dataUrlToBlob(dataUrl: string): Blob | undefined {
  const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(dataUrl);
  if (!match) return undefined;
  const [, mime, base64, payload] = match;
  if (base64) {
    try {
      const bufferCtor = (globalThis as { Buffer?: { from(input: string, encode: string): Uint8Array } }).Buffer;
      const bytes = bufferCtor
        ? new Uint8Array(bufferCtor.from(payload, 'base64'))
        : Uint8Array.from(atob(payload), char => char.charCodeAt(0));
      return new Blob([bytes as unknown as BlobPart], { type: mime });
    } catch {
      return undefined;
    }
  }
  try {
    return new Blob([decodeURIComponent(payload) as unknown as BlobPart], { type: mime });
  } catch {
    return undefined;
  }
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || 'image/png'};base64,${base64FromBytes(bytes)}`;
}

/* ------------------------------ 测试辅助 ------------------------------ */

/** 只给测试用：清空内存后端与 object URL 缓存。 */
export function resetStoreForTests(): void {
  memory.clear();
  urls.clear();
  dbPromise = undefined;
}
