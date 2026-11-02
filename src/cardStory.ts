import type { GameState, StoryBeat, StoryChoice, Storyline } from './types.ts';
import { STORY_SLOT_MAX } from './storyplan.ts';

/**
 * 契约卡里的「她的故事」。
 *
 * 导出时把这位少女的故事线（含已走完的段）一并写进卡片，
 * 导入时原样搬回 `state.storylines`，只做三件必须做的事：
 *   1. 重写 id，避免和新存档里已有的故事线撞号；
 *   2. 把 `girlId` 指向导入后新生成的少女 id；
 *   3. 清掉指向旧存档的引用（委托 id、事件 id、跨段 requires），
 *      这几样在新存档里不存在，留着只会让详情页显示「委托已在地图上」却点不开。
 *
 * 三段上限与「同时只能有一条进行中」的约束在这里也一并兜住，
 * 免得一张手工改过的卡把存档带进不该有的状态。
 */

const STATUSES: Storyline['status'][] = ['active', 'done', 'abandoned'];
const SOURCES: Storyline['source'][] = ['llm', 'template', 'manual'];

const text = (value: unknown, max: number): string => typeof value === 'string' ? value.slice(0, max) : '';

function sanitizeBeat(raw: unknown, index: number): StoryBeat | null {
  if (!raw || typeof raw !== 'object') return null;
  const beat = raw as Record<string, unknown>;
  const title = text(beat.title, 60).trim();
  if (!title) return null;
  const choices = Array.isArray(beat.choices)
    ? beat.choices.filter(choice => choice && typeof choice === 'object').map((choice, at) => {
      const item = choice as Record<string, unknown>;
      return {
        id: text(item.id, 24) || `c${at + 1}`,
        label: text(item.label, 60) || '继续',
        intent: text(item.intent, 120),
        hint: typeof item.hint === 'string' ? text(item.hint, 120) : undefined,
        effect: item.effect && typeof item.effect === 'object' ? item.effect as StoryChoice['effect'] : {},
      };
    })
    : [];
  const mission = beat.mission && typeof beat.mission === 'object' ? beat.mission as StoryBeat['mission'] : undefined;
  const status = beat.status === 'open' || beat.status === 'done' ? beat.status : 'locked';
  return {
    id: text(beat.id, 40) || `plan-${index + 1}`,
    index: Number.isFinite(beat.index) ? Math.max(0, Math.round(beat.index as number)) : index,
    title,
    summary: text(beat.summary, 400),
    scene: text(beat.scene, 200),
    hook: text(beat.hook, 200),
    choices,
    mission,
    // 旧存档里的委托与事件不会跟着卡片走，一律清空：需要时由 spawnStoryBeat 重新发布。
    missionId: undefined,
    eventId: undefined,
    resolvedChoiceId: typeof beat.resolvedChoiceId === 'string' ? text(beat.resolvedChoiceId, 24) : undefined,
    resolvedAt: typeof beat.resolvedAt === 'string' ? text(beat.resolvedAt, 40) : undefined,
    status,
  };
}

/** 把卡片里的故事线洗净；坏条目直接丢掉，不会让整张卡导入失败。 */
export function sanitizeCardStorylines(raw: unknown): Storyline[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: Storyline[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const title = text(entry.title, 40).trim();
    if (!title) continue;
    const beats = Array.isArray(entry.beats)
      ? entry.beats.map((beat, index) => sanitizeBeat(beat, index)).filter((beat): beat is StoryBeat => Boolean(beat)).slice(0, 24)
      : [];
    if (!beats.length) continue;
    const status = STATUSES.includes(entry.status as Storyline['status']) ? entry.status as Storyline['status'] : 'active';
    const stage = Number.isFinite(entry.stage) ? Math.max(0, Math.min(beats.length - 1, Math.round(entry.stage as number))) : 0;
    cleaned.push({
      id: text(entry.id, 64) || `card-story-${cleaned.length + 1}`,
      girlId: text(entry.girlId, 64),
      title,
      premise: text(entry.premise, 400),
      tone: text(entry.tone, 40),
      beats,
      stage,
      status,
      createdAt: text(entry.createdAt, 40) || new Date(0).toISOString(),
      day: Number.isFinite(entry.day) ? Math.max(1, Math.round(entry.day as number)) : 1,
      source: SOURCES.includes(entry.source as Storyline['source']) ? entry.source as Storyline['source'] : 'template',
      slot: Number.isFinite(entry.slot) ? Math.max(1, Math.min(STORY_SLOT_MAX, Math.round(entry.slot as number))) : undefined,
      requires: typeof entry.requires === 'string' ? text(entry.requires, 64) : undefined,
      ending: typeof entry.ending === 'string' ? text(entry.ending, 60) : undefined,
      graph: entry.graph && typeof entry.graph === 'object' ? entry.graph as Storyline['graph'] : undefined,
      run: entry.run && typeof entry.run === 'object' ? entry.run as Storyline['run'] : undefined,
    });
  }
  // 同一时间只留一条进行中，再按卡片里的先后顺序取前三段。
  let active = 0;
  const unique = cleaned.filter(story => {
    if (story.status !== 'active') return true;
    active += 1;
    return active <= 1;
  });
  return unique.slice(0, STORY_SLOT_MAX);
}

/** 导出用：把这位少女的故事线深拷贝一份，去掉只属于旧存档的引用。 */
export function cardStorylinesFor(state: Pick<GameState, 'storylines'>, girlId: string): Storyline[] {
  const list = (state.storylines ?? []).filter(story => story.girlId === girlId);
  return list.map(story => ({
    ...story,
    beats: story.beats.map(beat => ({ ...beat, choices: beat.choices.map(choice => ({ ...choice })), missionId: undefined, eventId: undefined })),
    graph: story.graph ? { ...story.graph, nodes: [...story.graph.nodes], edges: [...story.graph.edges] } : undefined,
    run: story.run ? { ...story.run } : undefined,
  }));
}

/**
 * 导入用：用卡片里的故事线替换这位少女原有的记录。
 *
 * 卡片带的是快照，所以按「她就是这样走到第几幕」整份替换；卡片没带故事线时什么都不动，
 * 旧卡（没有 storylines 字段）的行为与以前完全一致。
 */
export function applyCardStorylines(state: GameState, girlId: string, storylines: Storyline[]): number {
  if (!storylines.length) return 0;
  const keeps = (state.storylines ?? []).filter(story => story.girlId !== girlId);
  const stamp = `${girlId}-${state.day}`;
  const remapped: Storyline[] = storylines.map((story, index) => ({
    ...story,
    id: `card-story-${stamp}-${index + 1}`,
    girlId,
    requires: undefined,
    beats: story.beats.map(beat => ({ ...beat, missionId: undefined, eventId: undefined })),
  }));
  // 段号按顺序补齐，旧的 requires 链路改成「上一段」。
  remapped.forEach((story, index) => { story.requires = index > 0 ? remapped[index - 1]!.id : undefined; });
  state.storylines = [...remapped, ...keeps];
  return remapped.length;
}
