/**
 * 把现有数据折成舞台节拍（v93）。
 *
 * 角色剧情的正文是 `StoryPassage { narration, lines[{speaker,tone,text}], choices[] }`。
 * 规则很简单：旁白按空行拆段 → 每段一条 say（speakerId 固定 `narrator`）；
 * 台词依次 say；选项收尾成一条 choice。空文本直接丢掉，免得舞台空转一屏。
 */
import type { Expression } from '../types.ts';
import { backdropForElement } from './backdrops.ts';
import type { VnBeat, VnBackdrop } from './types.ts';

export interface PassageLine {
  speaker: string;
  tone?: string;
  text: string;
}

export interface PassageLike {
  id: string;
  title?: string;
  narration: string;
  lines: PassageLine[];
  choices: { id: string; label: string; intent?: string }[];
  /** 未来字段：模型可以指定这一段的场景（room:lounge / street / district:candy）。 */
  scene?: string;
}

export const NARRATOR_ID = 'narrator';

export interface PassageBeatOptions {
  /** 这一段实际出场的人：台词里的 speaker 名字 → id / 表情由这里兜住。 */
  speakerId?: string;
  speakerName?: string;
  expression?: Expression;
  element?: string;
  scene?: string;
}

const tidy = (text: string): string => text.replace(/\r\n/g, '\n').trim();

export function beatsFromPassage(passage: PassageLike, options: PassageBeatOptions = {}): VnBeat[] {
  const beats: VnBeat[] = [];
  const backdrop: VnBackdrop = passage.scene
    ? { id: passage.scene }
    : options.scene
      ? { id: options.scene }
      : backdropForElement(options.element);
  beats.push({ kind: 'bg', backdrop });

  for (const paragraph of tidy(passage.narration).split(/\n{2,}/)) {
    const text = tidy(paragraph).replace(/\n/g, ' ');
    if (!text) continue;
    beats.push({ kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text, thought: true });
  }

  for (const line of passage.lines ?? []) {
    const text = tidy(line.text ?? '');
    if (!text) continue;
    const fromNarrator = !line.speaker || line.speaker === '旁白';
    beats.push({
      kind: 'say',
      speakerId: fromNarrator ? NARRATOR_ID : options.speakerId ?? line.speaker,
      name: fromNarrator ? '旁白' : line.speaker,
      text,
      expression: fromNarrator ? undefined : options.expression,
      thought: fromNarrator,
    });
  }

  const options_ = (passage.choices ?? []).filter(choice => tidy(choice.label ?? ''));
  if (options_.length) {
    beats.push({
      kind: 'choice',
      prompt: passage.title,
      options: options_.map(choice => ({ id: choice.id, label: tidy(choice.label), hint: choice.intent?.trim() || undefined })),
    });
  }

  beats.push({ kind: 'end' });
  return beats;
}

/** 交互剧情的一轮：旁白正文，或玩家写下的一句行动。 */
export interface TurnLike {
  id: string;
  role: 'narrator' | 'player';
  text: string;
  lines?: { speakerId: string; speakerName: string; expression?: Expression; text: string }[];
}

/**
 * 把「你一句我一句」的剧情折成舞台节拍（v93）。
 *
 * 玩家的输入对舞台来说是「所长」的一句台词；旁白与台词按现有字段直接搬。
 * 输入框仍在舞台外，舞台只负责把已经发生的这段演出来。
 */
export function beatsFromTurns(turns: readonly TurnLike[], options: { playerName?: string; scene?: VnBackdrop } = {}): VnBeat[] {
  const beats: VnBeat[] = [{ kind: 'bg', backdrop: options.scene ?? { id: 'night' } }];
  for (const turn of turns) {
    const text = tidy(turn.text ?? '');
    if (text) {
      for (const paragraph of text.split(/\n{2,}/)) {
        const line = tidy(paragraph).replace(/\n/g, ' ');
        if (!line) continue;
        beats.push({
          kind: 'say',
          speakerId: turn.role === 'player' ? 'player' : NARRATOR_ID,
          name: turn.role === 'player' ? options.playerName ?? '所长' : '旁白',
          text: line,
          thought: turn.role !== 'player',
        });
      }
    }
    for (const line of turn.lines ?? []) {
      const body = tidy(line.text ?? '');
      if (!body) continue;
      beats.push({
        kind: 'say',
        speakerId: line.speakerId,
        name: line.speakerName || '她',
        text: body,
        expression: line.expression,
      });
    }
  }
  beats.push({ kind: 'end' });
  return beats;
}
