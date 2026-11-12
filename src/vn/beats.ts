/**
 * 把现有数据折成舞台节拍（v93 / v99 交织）。
 *
 * 模型给的 JSON 里，旁白是一整块 `narration`，角色对话挂在最后的 `lines`。
 * 如果按「先把旁白全演完、再演对话」来放，读起来就是「先听完一篇小说，再看几句对白」，
 * 完全不是原文的样子。所以这里和正文视图用同一套 `interleaveTurn`：
 * 台词按 `after`（第几段旁白之后）插回旁白之间，没写 `after` 就均匀铺开。
 */
import type { Expression } from '../types.ts';
import { placeLines, segmentsFromPositions } from '../storyLines.ts';
import { humanizeMarkers } from '../storyInline.ts';
import type { StorySegment } from '../storyLines.ts';
import { backdropForElement } from './backdrops.ts';
import type { VnBeat, VnBackdrop } from './types.ts';

export interface PassageLine {
  speaker: string;
  tone?: string;
  text: string;
  /** 插在第几段旁白之后（0 = 最前面）；缺省按位置均匀铺开。 */
  after?: number;
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
  /** 这一场在整段故事里的序号：舞台按它判断谁该进场、谁该退场。 */
  segment?: number;
}

const tidy = (text: string): string => text.replace(/\r\n/g, '\n').trim();

/** 旁白按空行拆段；段内换行压成空格（一行一句，舞台更好读）。 */
/**
 * 旁白拆段（v111）。
 *
 * 契约里写的是「按 narration 里的换行分段、从 0 数」——所以这里**按换行切**，
 * 和原文视图（`turn.text.split(/\n+/)`）保持同一套分段。以前这里按空行切，
 * 两个视图对同一个 after 的理解就不一样：原文插对了，舞台却插到别处。
 */
function paragraphsOf(text: string): string[] {
  return tidy(text ?? '')
    .split(/\n+/)
    .map(paragraph => tidy(paragraph))
    .filter(Boolean);
}

/** 按句号等断句，保留标点。 */
function splitSentences(text: string): string[] {
  const parts = text.match(/[^。！？!?…；;]+[。！？!?…；;]*/g) ?? [text];
  return parts.map(part => part.trim()).filter(Boolean);
}

/**
 * 旁白块不够分时，把最长的那段按句子再拆一次。
 *
 * 模型给的 JSON 常常是「一整段旁白 + 末尾几句台词」，只有一段旁白就没有地方插台词，
 * 结果又变成「旁白全念完才轮到人说话」。这里按句子把旁白摊成至少 `wanted` 块，
 * 台词才有位置插进去。
 */
function chunkParagraphs(paragraphs: string[], wanted: number): string[] {
  let list = [...paragraphs];
  for (let guard = 0; list.length < wanted && guard < 16; guard += 1) {
    // 从最长的一段试起：能按句子拆开的那段才拆，拆不开就换下一段。
    const order = list.map((_, index) => index).sort((a, b) => list[b]!.length - list[a]!.length);
    let split = false;
    for (const at of order) {
      const sentences = splitSentences(list[at]!);
      if (sentences.length < 2) continue;
      const half = Math.ceil(sentences.length / 2);
      list = [
        ...list.slice(0, at),
        sentences.slice(0, half).join(''),
        sentences.slice(half).join(''),
        ...list.slice(at + 1),
      ];
      split = true;
      break;
    }
    if (!split) break;
  }
  return list;
}

/**
 * 把旁白与台词交织起来。
 *
 * `after` 是按「原始旁白段」数的，摊成更细的块之后要按比例换算，
 * 否则模型写 after=1 的台词会跑偏。
 */
function interleave<T extends { after?: number }>(paragraphs: string[], lines: readonly T[]): { chunks: string[]; lines: readonly T[]; segments: StorySegment[] } {
  const chunks = chunkParagraphs(paragraphs, lines.length + 1);
  // 落点统一交给 placeLines：after 只当意图，写得没区分度就均匀铺开。
  const positions = placeLines(lines.map(line => line.after), Math.max(1, paragraphs.length), chunks.length);
  return { chunks, lines, segments: segmentsFromPositions(chunks.length, positions) };
}

/**
 * 一段旁白 + 台词按 after 交织后的顺序（v111）。
 *
 * 原文视图与舞台都走这一个函数，两个视图再也不会各算一套。
 */
export function arrangeStoryText<T extends { after?: number; text?: string }>(text: string, lines: readonly T[]): { chunks: string[]; lines: readonly T[]; segments: StorySegment[] } {
  return interleave(paragraphsOf(text), lines);
}

export function beatsFromPassage(passage: PassageLike, options: PassageBeatOptions = {}): VnBeat[] {
  const segmentIndex = options.segment ?? 0;
  const beats: VnBeat[] = [];
  const backdrop: VnBackdrop = passage.scene
    ? { id: passage.scene }
    : options.scene
      ? { id: options.scene }
      : backdropForElement(options.element);
  beats.push({ kind: 'bg', backdrop });

  const rawParagraphs = paragraphsOf(humanizeMarkers(passage.narration ?? ''));
  // 空台词先丢掉，否则 after 的下标会和台词对不上。
  const rawLines = (passage.lines ?? []).filter(line => tidy(line.text ?? ''));
  const { chunks: paragraphs, lines, segments } = interleave(rawParagraphs, rawLines);

  for (const segment of segments) {
    if (segment.kind === 'narration') {
      beats.push({ kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: paragraphs[segment.index]!, thought: true, segment: segmentIndex });
      continue;
    }
    const line = lines[segment.index]!;
    const fromNarrator = !line.speaker || line.speaker === '旁白';
    beats.push({
      kind: 'say',
      speakerId: fromNarrator ? NARRATOR_ID : options.speakerId ?? line.speaker,
      name: fromNarrator ? '旁白' : line.speaker,
      text: tidy(line.text),
      expression: fromNarrator ? undefined : options.expression,
      thought: fromNarrator,
      segment: segmentIndex,
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
  lines?: { speakerId: string; speakerName: string; expression?: Expression; text: string; after?: number }[];
}

/**
 * 把「你一句我一句」的剧情折成舞台节拍（v93 / v99 交织）。
 *
 * 每一轮里，旁白与那一轮的台词同样按 `after` 交织，而不是旁白说完才轮到人说话。
 * 玩家的输入对舞台来说是「所长」的一句台词。
 */
export function beatsFromTurns(turns: readonly TurnLike[], options: { playerName?: string; scene?: VnBackdrop } = {}): VnBeat[] {
  const beats: VnBeat[] = [{ kind: 'bg', backdrop: options.scene ?? { id: 'night' } }];
  turns.forEach((turn, turnIndex) => {
    const paragraphs = paragraphsOf(humanizeMarkers(turn.text ?? ''));
    const lines = (turn.lines ?? []).filter(line => tidy(line.text ?? ''));
    const isPlayer = turn.role === 'player';

    // 玩家只写了自己做了什么，没有旁白与台词的分层，直接按段说完。
    if (isPlayer || lines.length === 0) {
      for (const paragraph of paragraphs) {
        beats.push({
          kind: 'say',
          speakerId: isPlayer ? 'player' : NARRATOR_ID,
          name: isPlayer ? options.playerName ?? '所长' : '旁白',
          text: paragraph,
          thought: !isPlayer,
          segment: turnIndex,
        });
      }
      return;
    }

    const inter = interleave(paragraphs, lines);
    for (const segment of inter.segments) {
      if (segment.kind === 'narration') {
        beats.push({ kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: inter.chunks[segment.index]!, thought: true, segment: turnIndex });
        continue;
      }
      const line = inter.lines[segment.index]!;
      const body = tidy(line.text);
      if (!body) continue;
      const fromNarrator = !line.speakerId || line.speakerId === NARRATOR_ID;
      beats.push({
        kind: 'say',
        speakerId: fromNarrator ? NARRATOR_ID : line.speakerId,
        name: fromNarrator ? '旁白' : line.speakerName || '她',
        text: body,
        expression: fromNarrator ? undefined : line.expression,
        thought: fromNarrator,
        segment: turnIndex,
      });
    }
  });
  beats.push({ kind: 'end' });
  return beats;
}

/** 战斗札记里的一位说话人（由外层按 actor 表折好）。 */
export interface NoteSpeaker {
  key: string;
  id: string;
  name: string;
}

export interface NoteLineLike {
  speakerSide: 'ally' | 'enemy';
  speakerId: string;
  expression?: Expression;
  text: string;
  mode?: 'speech' | 'thought';
  /** 插在第几段旁白之后；缺省按位置均匀铺开。 */
  after?: number;
}

export interface NoteSceneLike {
  id: string;
  title: string;
  narration: string;
  lines: NoteLineLike[];
}

/**
 * 战斗札记折成舞台节拍（v95 / v99 交织）。
 *
 * 每一场先给一张标题卡，然后旁白与台词按 `after` 交织，
 * 而不是「旁白念完再听大家的台词」。
 * 说话人解析失败（旧札记里没有这个人）时按旁白处理，不会出现空立绘。
 */
export function beatsFromBattleNote(scenes: readonly NoteSceneLike[], speakers: readonly NoteSpeaker[], options: { scene?: VnBackdrop } = {}): VnBeat[] {
  const byKey = new Map(speakers.map(speaker => [speaker.key, speaker]));
  const beats: VnBeat[] = [{ kind: 'bg', backdrop: options.scene ?? { id: 'night' } }];
  scenes.forEach((scene, sceneIndex) => {
    if (scene.title?.trim()) beats.push({ kind: 'scene', title: scene.title.trim() });
    const inter = interleave(paragraphsOf(scene.narration ?? ''), (scene.lines ?? []).filter(line => tidy(line.text ?? '')));
    for (const segment of inter.segments) {
      if (segment.kind === 'narration') {
        beats.push({ kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text: inter.chunks[segment.index]!, thought: true, segment: sceneIndex });
        continue;
      }
      const line = inter.lines[segment.index]!;
      const text = tidy(line.text);
      if (!text) continue;
      const speaker = byKey.get(`${line.speakerSide}:${line.speakerId}`);
      if (!speaker) {
        beats.push({ kind: 'say', speakerId: NARRATOR_ID, name: '旁白', text, thought: true, segment: sceneIndex });
        continue;
      }
      beats.push({
        kind: 'say', speakerId: speaker.id, name: speaker.name, text,
        expression: line.expression, thought: line.mode === 'thought', segment: sceneIndex,
      });
    }
  });
  beats.push({ kind: 'end' });
  return beats;
}
