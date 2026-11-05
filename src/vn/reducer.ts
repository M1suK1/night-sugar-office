/**
 * 舞台状态机（v93）：纯函数，好测也好复用。
 *
 * 规则：
 *  - `advance`：正在打字 → 先把当前句打完；已经打完 → 前进一条。
 *    遇到 `choice` 就停在那一拍，等 `choose`。
 *  - `choose`：同一拍只接受一次（`chosenId` 锁死），之后继续前进，
 *    这样「点击」与「继续」不会把同一幕剧情结算两遍。
 *  - `skipSeen`：只跳过已经看过的 say；没看过的停住。
 */
import type { VnBeat } from './types.ts';

export interface VnState {
  beats: VnBeat[];
  /** 当前停在第几条。 */
  index: number;
  /** 当前这句是否还在打字。 */
  typing: boolean;
  /** 这一拍的选择已经做过。 */
  chosenId?: string;
  done: boolean;
}

export type VnAction =
  | { type: 'advance' }
  | { type: 'typed' }
  | { type: 'choose'; id: string }
  | { type: 'skipSeen'; seen: readonly string[] };

export const vnInitial = (beats: VnBeat[]): VnState => ({
  beats,
  index: 0,
  typing: beats[0]?.kind === 'say' && Boolean(beats[0].text),
  done: beats.length === 0,
});

export const vnBeatKey = (beat: VnBeat, index: number): string => {
  if (beat.kind === 'say') return `${index}:say:${beat.speakerId}:${beat.text.slice(0, 24)}`;
  if (beat.kind === 'choice') return `${index}:choice`;
  if (beat.kind === 'bg') return `${index}:bg:${beat.backdrop.id}`;
  return `${index}:end`;
};

function step(state: VnState, from: number): VnState {
  const nextIndex = from + 1;
  const next = state.beats[nextIndex];
  if (!next) return { ...state, index: Math.max(0, state.beats.length - 1), typing: false, done: true };
  return { ...state, index: nextIndex, typing: next.kind === 'say' && Boolean(next.text), chosenId: undefined, done: next.kind === 'end' };
}

export function vnReducer(state: VnState, action: VnAction): VnState {
  switch (action.type) {
    case 'typed':
      return state.typing ? { ...state, typing: false } : state;
    case 'advance': {
      const beat = state.beats[state.index];
      if (!beat || state.done) return state;
      if (state.typing) return { ...state, typing: false };
      // 选项拍必须用 choose 推进，避免误触把剧情跳过去。
      if (beat.kind === 'choice') return state;
      if (beat.kind === 'end') return { ...state, done: true };
      return step(state, state.index);
    }
    case 'choose': {
      const beat = state.beats[state.index];
      if (!beat || beat.kind !== 'choice') return state;
      if (state.chosenId) return state;
      // 记住选了什么（同一拍只算一次），但推进到下一拍时由 step 清掉。
      const next = step(state, state.index);
      return { ...next, chosenId: action.id };
    }
    case 'skipSeen': {
      let current = state;
      for (let guard = 0; guard < state.beats.length; guard += 1) {
        const beat = current.beats[current.index];
        if (!beat || beat.kind === 'choice' || beat.kind === 'end') break;
        if (beat.kind === 'say' && !action.seen.includes(vnBeatKey(beat, current.index))) break;
        if (beat.kind === 'bg') { current = step(current, current.index); continue; }
        current = step(current, current.index);
      }
      return current;
    }
    default:
      return state;
  }
}

/** 当前这一拍是不是「等玩家选」。 */
export const vnAwaitingChoice = (state: VnState): boolean => state.beats[state.index]?.kind === 'choice';
