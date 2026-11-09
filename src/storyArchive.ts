/**
 * 剧情存档（v176）。
 *
 * 把演完的长剧情单独存一份到本地：不依赖当前存档，开局界面就能翻出来重看。
 * 存的是「可读的副本」：摘要、参与的人、逐轮的旁白与台词；立绘只留引用信息，
 * 免得 60 MB 的 data URL 又被复制一遍。
 */
import { kvDelete, kvGet, kvSet } from './store.ts';
import type { CharacterEvent, Expression, GameState, StoryLine, StoryTurn } from './types.ts';

export const STORY_ARCHIVE_KEY = 'stories/archive';
export const STORY_ARCHIVE_MAX = 60;

export interface ArchivedStoryTurn {
  role: 'player' | 'narrator';
  text: string;
  lines: {
    speakerName: string;
    text: string;
    mode?: 'speech' | 'thought';
    /** v177：回看时按 id 取立绘；老副本没有这一项，就看名字对不对得上。 */
    speakerId?: string;
    expression?: string;
  }[];
  options?: string[];
}

export interface ArchivedStory {
  id: string;
  eventId: string;
  title: string;
  day: number;
  /** 这段剧情开始的时刻；旧副本没有，只显示第几日。 */
  minutes?: number;
  savedAt: number;
  /** 主角（回看时用来取卡面立绘）。 */
  lead?: { id: string; name: string; cardId?: string };
  participants: { id: string; name: string }[];
  summary: string;
  /** v191：这一段当时用的背景；老副本没有这一项，回看时按辖区规则兜底。 */
  backdrop?: string;
  turns: ArchivedStoryTurn[];
}

function speakerNames(event: CharacterEvent, state?: GameState): Map<string, string> {
  const names = new Map<string, string>();
  for (const girl of [...(state?.girls ?? []), ...(state?.candidates ?? [])]) names.set(girl.id, girl.name);
  for (const id of event.cast ?? []) if (!names.has(id)) names.set(id, id);
  return names;
}

function compactLines(lines: StoryLine[] | undefined, names: Map<string, string>): ArchivedStoryTurn['lines'] {
  return (lines ?? []).map(line => ({
    speakerId: line.speakerId,
    speakerName: line.speakerId === 'player' ? '所长' : (names.get(line.speakerId) ?? line.speakerName),
    text: line.text,
    mode: line.mode,
    expression: line.expression,
  }));
}

/**
 * 把一份副本还原成可以「观看」的事件（v177）。
 *
 * 回看走的是同一套界面：原文与视觉小说两种模式都能用，立绘按在场的 id 取。
 */
export function replayEventOf(story: ArchivedStory): CharacterEvent {
  // 老副本没存表情：同一个人沿用她上一句的表情，至少不会整段定在同一张脸上。
  const lastExpression = new Map<string, Expression>();
  const turns: StoryTurn[] = story.turns.map((turn, index) => ({
    id: `${story.eventId}-t${index}`,
    role: turn.role,
    text: turn.text,
    lines: turn.lines.map((line, at) => {
      const speakerId = line.speakerId ?? line.speakerName;
      const stored = line.expression as Expression | undefined;
      const expression = stored ?? lastExpression.get(speakerId) ?? 'calm';
      lastExpression.set(speakerId, expression);
      return {
        speakerId,
        speakerName: line.speakerName,
        expression,
        text: line.text,
        mode: line.mode,
        after: at,
      };
    }),
    options: turn.options?.length ? [...turn.options] : undefined,
  }));
  return {
    id: story.eventId,
    girlId: story.lead?.id ?? '',
    title: story.title,
    hook: '',
    scenes: [],
    stage: 0,
    status: 'done',
    day: story.day,
    minutes: story.minutes,
    source: 'llm',
    badge: false,
    mode: 'session',
    turns,
    cast: story.participants.map(person => person.id),
    backdrop: story.backdrop,
    summary: story.summary,
    sessionDone: true,
  };
}

/** 把一段演完的剧情压成可读副本。 */
export function archiveStoryRecord(event: CharacterEvent, state?: GameState): ArchivedStory {
  const names = speakerNames(event, state);
  const leadGirl = state ? [...state.girls, ...state.candidates].find(girl => girl.id === event.girlId) : undefined;
  const participants = [...new Set([
    ...(event.cast ?? []),
    ...(event.meeting?.attendeeIds ?? []),
    ...(event.girlId ? [event.girlId] : []),
  ])]
    .filter(id => id && id !== 'player')
    .map(id => ({
      id,
      name: names.get(id)
        ?? state?.customFactionLeaders?.find(person => person.id === id)?.name
        ?? state?.customFactionGirls?.find(person => person.id === id)?.name
        ?? id,
    }));
  return {
    id: `story-${event.id}`,
    eventId: event.id,
    title: event.title,
    day: event.day,
    minutes: event.minutes,
    savedAt: Date.now(),
    lead: event.girlId ? { id: event.girlId, name: names.get(event.girlId) ?? leadGirl?.name ?? event.girlId, cardId: leadGirl?.cardId } : undefined,
    participants,
    summary: (event.summary ?? '').trim(),
    backdrop: event.backdrop,
    turns: (event.turns ?? []).map(turn => ({
      role: turn.role,
      text: turn.text,
      lines: compactLines(turn.lines, names),
      options: turn.options?.length ? [...turn.options] : undefined,
    })),
  };
}

export async function loadStoryArchive(): Promise<ArchivedStory[]> {
  try {
    const raw = await kvGet<unknown>(STORY_ARCHIVE_KEY);
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is ArchivedStory => Boolean(item && typeof item === 'object' && typeof (item as ArchivedStory).id === 'string'));
  } catch {
    return [];
  }
}

/** 存一段剧情：同 id 覆盖，最多留 STORY_ARCHIVE_MAX 段。 */
export async function saveStoryToArchive(event: CharacterEvent, state?: GameState): Promise<boolean> {
  try {
    const list = await loadStoryArchive();
    const record = archiveStoryRecord(event, state);
    const next = [record, ...list.filter(item => item.id !== record.id)].slice(0, STORY_ARCHIVE_MAX);
    await kvSet(STORY_ARCHIVE_KEY, next);
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoryFromArchive(id: string): Promise<boolean> {
  try {
    const list = await loadStoryArchive();
    await kvSet(STORY_ARCHIVE_KEY, list.filter(item => item.id !== id));
    return true;
  } catch {
    return false;
  }
}

export async function clearStoryArchive(): Promise<boolean> {
  try {
    await kvDelete(STORY_ARCHIVE_KEY);
    return true;
  } catch {
    return false;
  }
}
