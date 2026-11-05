import type { GameState } from './types.ts';
import { slimStateForSave } from './saveSlim.ts';
import { describeStateSize } from './saveSize.ts';
import { loadState } from './game.ts';
import { kvDelete, kvGet, kvSet } from './store.ts';
import { extractStatePortraits, hydrateStatePortraits, type PortraitStore } from './portraitAssets.ts';

/**
 * 手动存档位。自动存档是 `save/current`（当前进度），这里只放玩家自己按下的三个槽。
 * 槽位内容与「导出存档」同构：`{ schema, savedAt, state }`，把 `state` 单独拿出来也能导入。
 *
 * v22 起存进 IndexedDB，不再和 localStorage 的 5MB 抢地方。
 */
export const SAVE_SLOT_IDS = [1, 2, 3] as const;
export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];

export const SLOT_PREFIX = 'save/slot/';

/** 单槽体积上限（按 JSON 字符数估）：存进 IndexedDB 后不再受 5MB 配额限制，这里只防手滑写入超大对象。 */
/** 单槽上限。旧值 32MB 会把「带差分的中期存档」直接拦在门外；IDB 配额远大于此。 */
export const SLOT_BYTES_LIMIT = 96_000_000;

export type SaveSlotSummary = {
  id: SaveSlotId;
  savedAt: number;
  day: number;
  gold: number;
  girls: number;
  members: number;
  blank: boolean;
  startersPicked: boolean;
  /** 槽位里羁绊最高的那位契约者，用来一眼认出这是哪一局。 */
  headline: string;
  bytes: number;
};

export function slotKey(id: SaveSlotId): string {
  return `${SLOT_PREFIX}${id}`;
}

type SlotPayload = { schema: 1; savedAt: number; state: unknown };

function decode(value: unknown): { state: GameState; savedAt: number; bytes: number } | null {
  if (!value || typeof value !== 'object') return null;
  try {
    const parsed = value as SlotPayload | GameState;
    const wrapped = Boolean(parsed && typeof parsed === 'object' && (parsed as SlotPayload).schema === 1 && 'state' in (parsed as SlotPayload));
    const payload = wrapped ? (parsed as SlotPayload) : { schema: 1 as const, savedAt: 0, state: parsed };
    const state = loadState(JSON.stringify(payload.state));
    if (!state) return null;
    const bytes = JSON.stringify(payload).length;
    return { state, savedAt: Number(payload.savedAt) || 0, bytes };
  } catch {
    return null;
  }
}

export async function slotSummary(id: SaveSlotId): Promise<SaveSlotSummary | null> {
  let value: unknown;
  try {
    value = await kvGet<unknown>(slotKey(id));
  } catch {
    return null;
  }
  const decoded = decode(value);
  if (!decoded) return null;
  const { state, savedAt, bytes } = decoded;
  const alive = state.girls.filter(girl => !girl.left && !girl.retired);
  const oldest = alive.slice().sort((a, b) => b.bond - a.bond)[0];
  return {
    id,
    savedAt,
    day: state.day,
    gold: state.gold,
    girls: state.girls.length,
    members: alive.length,
    blank: Boolean(state.blank),
    startersPicked: Boolean(state.startersPicked),
    headline: oldest?.name ?? '还没有契约者',
    bytes,
  };
}

export async function slotSummaries(): Promise<(SaveSlotSummary | null)[]> {
  return Promise.all(SAVE_SLOT_IDS.map(id => slotSummary(id)));
}

/**
 * 写入槽位：先量体积再落盘，失败时把原因说明白。
 *
 * v120：落盘前先把立绘搬进资产库（与自动存档同一条管线）。
 * 以前槽位直接存内联 data URL，一个人几套表情差分就上兆，三个槽位加起来能到几十上百 MB；
 * 现在槽位里只留 `portraitAsset` 引用，读档时再取回来。
 */
export async function writeSlot(id: SaveSlotId, state: GameState, store?: PortraitStore): Promise<{ ok: boolean; message: string; summary?: SaveSlotSummary }> {
  const extracted = await extractStatePortraits(state, store).catch(() => ({ state, extracted: 0 }));
  const flatState = extracted.state;
  let slimNote = extracted.extracted > 0 ? `立绘已转成资产引用（${extracted.extracted} 张）。` : '';
  let payload: SlotPayload = { schema: 1, savedAt: Date.now(), state: flatState };
  let bytes = 0;
  try {
    bytes = JSON.stringify(payload).length;
  } catch {
    return { ok: false, message: '这一局的状态没法序列化，存档位没有写入。' };
  }
  // 仍然偏大时再瘦身一次（表情差分的 data URL 是主要负担），省下的字节写进提示里。
  if (bytes > SLOT_BYTES_LIMIT * 0.8) {
    const slim = await slimStateForSave(flatState);
    if (slim.saved > 0) {
      payload = { schema: 1, savedAt: Date.now(), state: slim.state };
      bytes = JSON.stringify(payload).length;
      slimNote += `保存前把表情差分压小，省下 ${Math.round(slim.saved / 1000)}KB。`;
    }
  }
  if (bytes > SLOT_BYTES_LIMIT) {
    // 说清楚是什么撑爆的：多半是表情差分（内联 data URL），不是剧情文字。
    const detail = describeStateSize(flatState);
    return { ok: false, message: `这一局有 ${Math.round(bytes / 1000)}KB，超过单个存档位的上限 ${Math.round(SLOT_BYTES_LIMIT / 1000)}KB。最大的几块：${detail}。可以先导出存档，再删掉几套表情差分或衣柜，或者先清掉旧战报与旧日志。` };
  }
  try {
    await kvSet(slotKey(id), payload);
  } catch {
    return { ok: false, message: '浏览器没能写入这个存档位（可能是空间不足或隐私模式）。可以先删掉别的槽位再试。' };
  }
  return { ok: true, message: `已存入存档位 ${id}。${slimNote}`, summary: (await slotSummary(id)) ?? undefined };
}

export async function readSlot(id: SaveSlotId, store?: PortraitStore): Promise<GameState | null> {
  try {
    const decoded = decode(await kvGet<unknown>(slotKey(id)));
    if (!decoded) return null;
    // 槽位里只留了资产引用，这里把图取回来；资产丢了也只是少一张立绘，不影响进度。
    return await hydrateStatePortraits(decoded.state, store).catch(() => decoded.state);
  } catch {
    return null;
  }
}

export async function clearSlot(id: SaveSlotId): Promise<boolean> {
  try {
    return await kvDelete(slotKey(id));
  } catch {
    return false;
  }
}

export async function slotsUsedBytes(): Promise<number> {
  const summaries = await slotSummaries();
  return summaries.reduce((sum, summary) => sum + (summary?.bytes ?? 0), 0);
}

export function formatSlotTime(savedAt: number): string {
  if (!savedAt) return '没有时间戳';
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return '没有时间戳';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function slotLabel(summary: SaveSlotSummary | null): string {
  if (!summary) return '空存档位';
  return `第 ${summary.day} 日 · ${summary.gold.toLocaleString()} 星砂 · ${summary.members} 位契约者`;
}
