/**
 * 魔女化对峙（v240）。
 *
 * 她第一次跨过魔女线时，立刻开一段只有她和所长的剧情：她把人堵在门口，按这些日子
 * 攒下的事一条条算账。事件本身只占一行数据，正文由 `generateWitchConfrontation` 写；
 * 写不出来时用这里的模板兜底，保证弹窗一定会出现。
 */
import type { CharacterEvent, Girl, GameState, StoryLine } from '../types.ts';
import { dateLabel } from './core.ts';

/** 还没有开场白的魔女对峙：按创建顺序排队，先来的先弹。 */
export function nextWitchEvent(state: GameState): CharacterEvent | undefined {
  return [...(state.events ?? [])]
    .reverse()
    .find(event => event.witch && event.status === 'active' && !event.opening?.trim() && !(event.turns?.length ?? 0));
}

/** 这个角色是否已经有一段还没走完的魔女对峙。 */
export function hasWitchEvent(state: GameState, girlId: string): boolean {
  return (state.events ?? []).some(event => event.witch && event.girlId === girlId && event.status === 'active');
}

/**
 * 在她跨过魔女线的那一刻排一段对峙。
 *
 * 同一个角色同时只留一段；用抑制剂压回去之后再次魔女化，会排新的一段。
 * 只由 `addCorruption` 调用——手动切换魔女形态不弹（玩家的决定，不是剧情事件）。
 */
export function spawnWitchConfrontation(state: GameState, girl: Girl): CharacterEvent | undefined {
  if (!girl.witch || girl.dead || girl.retired) return undefined;
  if (hasWitchEvent(state, girl.id)) return undefined;
  const event: CharacterEvent = {
    id: `witch-${girl.id}-${state.day}-${state.minutes}-${state.events?.length ?? 0}`,
    girlId: girl.id,
    title: `魔女化 · ${girl.name}`,
    hook: '她把唯一的出口堵住了，这次没打算让你先开口。',
    scenes: [],
    stage: 0,
    status: 'active',
    day: state.day,
    minutes: state.minutes,
    source: 'template',
    badge: true,
    mode: 'session',
    cast: [girl.id],
    opening: '',
    turns: [],
    sessionDone: false,
    witch: true,
  };
  state.events = [event, ...(state.events ?? [])];
  girl.eventBadge = '新';
  state.logs.unshift({
    id: `log-witch-confront-${event.id}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'story',
    text: `${girl.name}以魔女之身堵住了门口：${event.title}。`,
  });
  return event;
}

/** 模型没写成时的兜底开场：仍然是她堵住你、仍然按她的经历算账。 */
export function witchFallbackOpening(girl: Girl): { narration: string; lines: StoryLine[]; options: string[] } {
  const scars = girl.scars?.length ?? 0;
  const lines: StoryLine[] = [
    { speakerId: girl.id, speakerName: girl.name, expression: 'angry', text: '我不是来听你解释的。' },
    ...(girl.oath ? [{ speakerId: girl.id, speakerName: girl.name, expression: 'sad' as const, text: '你答应过我的事，到现在还算不算数？' }] : []),
    ...(scars > 0 ? [{ speakerId: girl.id, speakerName: girl.name, expression: 'calm' as const, text: `你数过我身上这几道疤吗？每一道都是你把我送出去的那一晚留下的。` }] : []),
    { speakerId: girl.id, speakerName: girl.name, expression: 'smile', text: '今晚不说清楚，谁都别想走。' },
  ];
  return {
    narration: '事务所的灯还亮着。她站在唯一的门口，影子比平时长出一截，把走廊挡得严严实实。她没有坐下，也没有看你手里的东西，只是等你抬头。',
    lines,
    options: ['你先让她把话说完', '你问她想要什么', '你往前走一步，叫她的名字'],
  };
}
