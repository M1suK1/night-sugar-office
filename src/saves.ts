import type { GameState } from './types.ts';
import { loadState } from './game.ts';
import { kvDelete, kvGet, kvSet } from './store.ts';

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
export const SLOT_BYTES_LIMIT = 32_000_000;

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

/** 写入槽位：先量体积再落盘，失败时把原因说明白。 */
export async function writeSlot(id: SaveSlotId, state: GameState): Promise<{ ok: boolean; message: string; summary?: SaveSlotSummary }> {
  const payload: SlotPayload = { schema: 1, savedAt: Date.now(), state };
  let bytes = 0;
  try {
    bytes = JSON.stringify(payload).length;
  } catch {
    return { ok: false, message: '这一局的状态没法序列化，存档位没有写入。' };
  }
  if (bytes > SLOT_BYTES_LIMIT) {
    return { ok: false, message: `这一局有 ${Math.round(bytes / 1000)}KB，超过单个存档位的上限；请先导出存档再清理历史记录。` };
  }
  try {
    await kvSet(slotKey(id), payload);
  } catch {
    return { ok: false, message: '浏览器没能写入这个存档位（可能是空间不足或隐私模式）。可以先删掉别的槽位再试。' };
  }
  return { ok: true, message: `已存入存档位 ${id}。`, summary: (await slotSummary(id)) ?? undefined };
}

export async function readSlot(id: SaveSlotId): Promise<GameState | null> {
  try {
    return decode(await kvGet<unknown>(slotKey(id)))?.state ?? null;
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
