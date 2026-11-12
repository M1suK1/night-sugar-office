import type { ActionResult, GameAction, GameState } from '../types.ts';
import { clone } from './core.ts';
import { splitInlineStory } from '../storyInline.ts';


/** editStoryTurn 的动作处理器（v104）：玩家手动改写一句，只动文本。 */
export function applyEditStoryTurn(state: GameState, action: Extract<GameAction, { type: 'editStoryTurn' }>): ActionResult {
      const text = action.text.trim();
      if (!text) return { state, ok: false, message: '文本不能是空的，想删就用「删掉这一句」。' };
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段剧情。' };
      const index = (event.turns ?? []).findIndex(turn => turn.id === action.turnId);
      if (index < 0) return { state, ok: false, message: '找不到要改的那一段。' };
      const previous = event.turns![index]!;
      const turns = [...event.turns!];
      const edited = (previous.edited ?? 0) + 1;
      // 玩家那一轮的台词与正文是同一句：改正文的时候把它们一起改掉。
      if (previous.role === 'player') {
        const lines = previous.lines?.map(line => (line.speakerId === 'player' ? { ...line, text } : line));
        turns[index] = { ...previous, text, lines: lines ?? previous.lines, edited };
        event.turns = turns;
        return { state: next, ok: true, message: '已经改成你写的这一段。' };
      }
      // v258：内联台词的轮次改完文本要重新解析；玩家只改旁白（没写标记）时保留原来的台词。
      if (previous.inline) {
        const cast = [
          ...state.girls.map(girl => ({ id: girl.id, name: girl.name })),
          ...state.candidates.map(girl => ({ id: girl.id, name: girl.name })),
          ...(previous.lines ?? []).map(line => ({ id: line.speakerId, name: line.speakerName })),
        ];
        const parsed = splitInlineStory(text, cast);
        turns[index] = parsed.inline
          ? { ...previous, text: parsed.text, lines: parsed.lines, edited }
          : { ...previous, text, edited };
        event.turns = turns;
        return { state: next, ok: true, message: parsed.inline ? '已经改成你写的这一段。' : '旁白已经改好，台词保持原样。' };
      }
      turns[index] = { ...previous, text, lines: previous.lines, edited };
      event.turns = turns;
      return { state: next, ok: true, message: '已经改成你写的这一段。' };
}
