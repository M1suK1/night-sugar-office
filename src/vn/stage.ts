/**
 * 舞台换人（v101）：谁在这一段里开口，谁就站在台上。
 *
 * 规则（来自需求）：
 *  - 剧情开场舞台是空的，第一段有人说话才有人登场；
 *  - 下一段出现了新的人 → 她从右侧滑进来，其他人重新均分舞台；
 *  - 上一段在场、这一段不再开口的人 → 在这一段开头淡出，剩下的重新均分。
 *
 * 纯函数，方便直接测「谁进谁出」。
 */
import type { Expression } from '../types.ts';
import type { VnBeat } from './types.ts';

/** 舞台档位：1–6 各占一档，7 人以上合成 "many"。CSS 按 data-count 取高度。 */
export type CastBucket = 1 | 2 | 3 | 4 | 5 | 6 | 'many';

/**
 * 舞台上有几个人该用哪一档高度（v151）。
 *
 * 六人编队与 3v3 对战都会一次站满六个人，旧版把人数截到 5，
 * 第六个人掉回默认高度、和邻居叠在一起。7 人以上（目前不会出现）统一降一档，保证不崩。
 */
export function castBucket(count: number): CastBucket {
  if (count >= 7) return 'many';
  if (count <= 1) return 1;
  return Math.min(6, Math.floor(count)) as 2 | 3 | 4 | 5 | 6;
}

/** 舞台上的一排：前排贴底，后排抬高一层。 */
export interface StageRows {
  front: string[];
  back: string[];
}

/**
 * 六人起把舞台分成两排（v152）：前 3 人前排，其余后排。
 *
 * 三人及以下仍是一排——原来的单排已经排得开，不需要把谁赶到后面去。
 */
export function stageRows(ids: readonly string[]): StageRows {
  if (ids.length < 4) return { front: [...ids], back: [] };
  return { front: ids.slice(0, 3), back: ids.slice(3) };
}

/**
 * 后排的人开口 → 与同列前排互换（v152）。
 *
 * 换位只发生在「说话的人站在后排」时；前排的人说话保持原位。
 * 返回同一引用表示没有变化，组件据此跳过重渲染。
 */
export function swapSpeaker(rows: StageRows, speakerId: string): StageRows {
  const backIndex = rows.back.indexOf(speakerId);
  if (backIndex < 0) return rows;
  const frontIndex = backIndex % Math.max(1, rows.front.length);
  if (!rows.front[frontIndex]) return rows;
  const front = [...rows.front];
  const back = [...rows.back];
  const stepping = back[backIndex]!;
  back[backIndex] = front[frontIndex]!;
  front[frontIndex] = stepping;
  return { front, back };
}

/** 舞台上一个人的横向落位（百分比，相对舞台宽度）。 */
export interface StageSlot {
  id: string;
  row: 'front' | 'back';
  /** 左边界百分比。 */
  left: number;
  /** 宽度百分比。 */
  width: number;
  /** 底边距百分比：后排抬高一层。 */
  bottom: number;
}

/** 后排抬高的底边位置（%），与 `.vn-cast.two-row .vn-actor[data-row="back"]` 的高度配套。 */
export const BACK_ROW_BOTTOM = 26;

/**
 * 两排舞台的落位（v234）。
 *
 * 旧算法把前后排放在**同一列**上：后排整张立绘正好压在前排背后，只剩头顶一条缝，
 * 六人同台时看着像只站了四个人，而且前后排完全没有交错。
 *
 * 现在改成「交错槽位」：把前后排的人按 F1 B1 F2 B2 … 的顺序排进同一串槽位，
 * 每人占一个等宽槽位，后排自然落进前排两人的缝里，谁的脸都不会被完全挡住。
 */
export function stageSlots(rows: StageRows): StageSlot[] {
  const front = rows.front;
  const back = rows.back;
  const total = front.length + back.length;
  if (!total) return [];
  if (!back.length) {
    const width = 100 / Math.max(1, front.length);
    return front.map((id, index) => ({ id, row: 'front' as const, left: index * width, width, bottom: 0 }));
  }
  const inset = 2.5;
  const usable = 100 - inset * 2;
  const pitch = usable / total;
  // 单人格宽跟人数走：六人时约 30%，同时不超过「三人并排」那一档，保证立绘大小观感一致。
  const width = Math.min(100 / 3, Math.max(24, pitch * 1.9));
  const order: { id: string; row: 'front' | 'back' }[] = [];
  for (let index = 0; index < Math.max(front.length, back.length); index += 1) {
    const one = front[index];
    if (one) order.push({ id: one, row: 'front' });
    const other = back[index];
    if (other) order.push({ id: other, row: 'back' });
  }
  return order.map((entry, slot) => {
    const center = inset + (slot + 0.5) * pitch;
    const left = Math.min(Math.max(center - width / 2, 0), 100 - width);
    return { id: entry.id, row: entry.row, left, width, bottom: entry.row === 'back' ? BACK_ROW_BOTTOM : 0 };
  });
}

/** 旁白与所长不算「立绘角色」：他们开口不该改变舞台站位。 */
const OFF_STAGE = new Set(['narrator', 'player']);

export interface StageTransition {
  /** 这一段应该在场的人（按第一次开口的顺序）。 */
  ids: string[];
  /** 刚从右侧进场的人。 */
  entering: string[];
  /** 正在淡出的人。 */
  leaving: string[];
}

/** 每一段（一幕 / 一轮 / 一场）里开口过的角色 id。 */
export function speakersBySegment(beats: readonly VnBeat[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const beat of beats) {
    if (beat.kind !== 'say' || beat.segment === undefined) continue;
    if (OFF_STAGE.has(beat.speakerId)) continue;
    const list = map.get(beat.segment) ?? [];
    if (!list.includes(beat.speakerId)) list.push(beat.speakerId);
    map.set(beat.segment, list);
  }
  return map;
}

/**
 * 从「上一段在场的人」推到「这一段该在场的人」。
 *
 * 站位尽量稳定：在场的人保持原有顺序，新人一律追加到最右。
 * 同一批人（人数与成员都没变）时直接返回 null —— 不重排、不重播动画，
 * 免得换一段剧情就把所有人的位置洗一遍。
 */
export function stageAfter(current: readonly string[], wanted: readonly string[]): StageTransition | null {
  const survivors = current.filter(id => wanted.includes(id));
  const newcomers = wanted.filter(id => !current.includes(id));
  if (survivors.length === current.length && newcomers.length === 0) return null;
  return {
    ids: [...survivors, ...newcomers],
    entering: newcomers,
    leaving: current.filter(id => !wanted.includes(id)),
  };
}

/**
 * 舞台上的「谁还亮着」：最近一个真正开口的角色。
 *
 * 旁白与所长发言不换人——上一位角色保持亮着，直到下一个角色开口；
 * 新一段还没人说话时也沿用上一段的最后发言人。
 */
export function lastSpeakerAt(beats: readonly VnBeat[], index: number, castIds: readonly string[]): string {
  for (let at = Math.min(index, beats.length - 1); at >= 0; at -= 1) {
    const item = beats[at];
    if (item?.kind !== 'say') continue;
    if (!item.speakerId || item.speakerId === 'narrator' || item.speakerId === 'player') continue;
    if (castIds.includes(item.speakerId)) return item.speakerId;
  }
  return '';
}

/**
 * 每个人截至当前节拍的最后一次表情。
 *
 * 台词没写表情就沿用上一次的值，不退回演员的默认表情；
 * 换一段演出时 beats 重置，历史自然从新的一段重新算。
 */
export function expressionsAt(beats: readonly VnBeat[], index: number): Map<string, Expression> {
  const map = new Map<string, Expression>();
  for (let at = 0; at <= Math.min(index, beats.length - 1); at += 1) {
    const item = beats[at];
    if (item?.kind !== 'say' || !item.speakerId || !item.expression) continue;
    if (item.speakerId === 'narrator' || item.speakerId === 'player') continue;
    map.set(item.speakerId, item.expression);
  }
  return map;
}
