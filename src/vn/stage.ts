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
