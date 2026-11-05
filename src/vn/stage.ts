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

/** 从「上一段在场的人」推到「这一段该在场的人」；没变化就返回 null（不惊动渲染）。 */
export function stageAfter(current: readonly string[], wanted: readonly string[]): StageTransition | null {
  const same = current.length === wanted.length && wanted.every((id, at) => id === current[at]);
  if (same) return null;
  return {
    ids: [...wanted],
    entering: wanted.filter(id => !current.includes(id)),
    leaving: current.filter(id => !wanted.includes(id)),
  };
}
