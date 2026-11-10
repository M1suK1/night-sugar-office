import type { Storyline } from './types.ts';

/** 一条故事的结局通知：弹窗只用这几个字段。 */
export interface EndingNotice {
  id: string;
  title: string;
  ending: string;
  girlId: string;
  premise: string;
  /** 结束节点写的结局描述；旧故事线没有就留空。 */
  summary?: string;
  day: number;
}

/** 记下每条故事线此刻的状态，下一次比对用。 */
export function storylineStatuses(stories: readonly Storyline[]): Map<string, Storyline['status']> {
  return new Map(stories.map(story => [story.id, story.status]));
}

/**
 * 这一次状态变化里刚走到结局的故事线（v193）。
 *
 * 只认「上一帧还活着（active）、这一帧 done 且有结局名」：
 * 读档时本来就结束的故事、走到死路被迫收束的（没有 ending）都不弹。
 */
export function newlyFinishedStories(
  before: ReadonlyMap<string, Storyline['status']>,
  stories: readonly Storyline[],
): EndingNotice[] {
  return stories.flatMap(story => {
    const ending = story.ending?.trim();
    if (story.status !== 'done' || !ending) return [];
    if (before.get(story.id) !== 'active') return [];
    const summary = story.endingSummary?.trim() || undefined;
    return [{
      id: story.id, title: story.title, ending, girlId: story.girlId, premise: story.premise,
      ...(summary ? { summary } : {}), day: story.day,
    }];
  });
}
