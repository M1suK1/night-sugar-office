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
