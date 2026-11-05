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

/**
 * 节拍表被重建（交互剧情每回一轮都会整张重算）后，把状态接回正确的一拍。
 *
 * 关键：旧表最后是 `end`，`done` 会被置成 true；新台词追加进新表后，
 * 如果还带着 `done`，`advance` 就会一直早退 —— 新来的旁白与台词一句都演不出来。
 * 所以「原来停在收束那一拍」时要把指针退回旧表的收束位（新表里正好是第一条新节拍）。
 */
export function vnRebase(state: VnState, beats: VnBeat[], prevLen: number): VnState {
  // 同一张表就不用动，免得每次渲染都换一个状态对象把 React 转成死循环。
  if (state.beats === beats) return state;
  let index = Math.min(state.index, Math.max(0, beats.length - 1));
  const grew = beats.length > prevLen;
  const restart = grew && (state.done || beats[index]?.kind === 'end');
  if (restart) {
    index = Math.max(0, Math.min(prevLen - 1, beats.length - 1));
  }
  // 「接回新的一句」即使位置没动也要重新打字，不能把一整段新旁白一次糊出来。
  const moved = restart || index !== state.index;
  const beat = beats[index];
  return {
    ...state,
    beats,
    index,
    typing: moved ? beat?.kind === 'say' && Boolean(beat.text) : state.typing,
    chosenId: moved ? undefined : state.chosenId,
    done: beat?.kind === 'end',
  };
}
