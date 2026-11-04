import type { Girl, StoryBeat, StoryGraph, StoryPlan } from './types.ts';
import { compileBeatsToGraph, layoutStoryGraph, sanitizeGraph, validateGraph } from './storygraph.ts';

const clampText = (value: unknown, limit: number, fallback = '') =>
  typeof value === 'string' ? value.trim().slice(0, limit) : fallback;

const num = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : undefined;

export const STORY_PLAN_BEATS = 4;
/** 每位契约少女最多三段故事，前一段讲完才开下一段。 */
export const STORY_SLOT_MAX = 3;

export function storyPlanTemplate(title = '', premise = ''): StoryPlan {
  return {
    title,
    premise,
    tone: '',
    beats: Array.from({ length: STORY_PLAN_BEATS }, (_, index) => ({
      id: `plan-${index + 1}`,
      index,
      title: '',
      summary: '',
      scene: '',
      hook: '',
      choices: [
        { id: 'c1', label: '接住这句话', intent: '顺着她的情绪往下说', effect: { bond: 3 } },
        { id: 'c2', label: '先不追问', intent: '把话题留到明天', effect: { bond: 1, corruption: 1 } },
      ],
      status: index === 0 ? 'open' : 'locked',
    })) as StoryBeat[],
  };
}

/**
 * 第 `slot` 段用的蓝图。
 *
 * 三段各一张图：`storyPlans[slot-1]`。旧档与旧卡只有 `storyPlan`，它算第 1 段，
 * 所以第 2/3 段在读之前必须先让叙事者另写一张——不能拿同一张图重跑。
 */
export function planForSlot(
  girl: { storyPlan?: StoryPlan; storyPlans?: (StoryPlan | null)[] },
  slot: number,
): StoryPlan | undefined {
  const index = Math.max(1, Math.min(STORY_SLOT_MAX, Math.round(slot))) - 1;
  const stored = girl.storyPlans?.[index];
  if (stored) return stored;
  return index === 0 ? girl.storyPlan : undefined;
}

/** 写入第 `slot` 段的蓝图；第 1 段同时更新 `storyPlan`，旧代码与旧卡继续能读。 */
export function setPlanForSlot(
  girl: { storyPlan?: StoryPlan; storyPlans?: (StoryPlan | null)[] },
  slot: number,
  next: StoryPlan | null,
): void {
  const index = Math.max(1, Math.min(STORY_SLOT_MAX, Math.round(slot))) - 1;
  const list = Array.isArray(girl.storyPlans) ? [...girl.storyPlans] : [];
  while (list.length < STORY_SLOT_MAX) list.push(null);
  list[index] = next;
  girl.storyPlans = list;
  if (index === 0) girl.storyPlan = next ?? undefined;
}

/**
 * 上一段留下的东西：结局、前提、走过的几幕。
 *
 * 第 2/3 段的蓝图要接着它写——结局里死掉的人不能复活、许下的承诺不能当没发生。
 * 没有上一段（第 1 段）时返回空串。
 */
export function priorSegmentBrief(
  state: { storylines: { girlId: string; status: string; slot?: number; title: string; premise: string; ending?: string; beats?: { title: string }[] }[] },
  girlId: string,
  slot: number,
): string {
  if (slot <= 1) return '';
  const finished = state.storylines
    .filter(story => story.girlId === girlId && story.status === 'done')
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
  const last = finished[finished.length - 1];
  if (!last) return '';
  const beats = (last.beats ?? []).map(beat => beat.title).filter(Boolean).slice(-6);
  return [
    `【第 ${slot} 段 · 必须承接第 ${last.slot ?? finished.length} 段】`,
    `上一段《${last.title}》的结局：${last.ending || '已收束（没有写出结局名）'}`,
    last.premise ? `上一段的前提：${last.premise.slice(0, 240)}` : '',
    beats.length ? `上一段走过的地方：${beats.join('、')}` : '',
    '要求：这一段从那个结局之后开始写；已经发生过的事不能复位（死掉的人不会回来、断掉的关系不会自动修复、当众许下的承诺要算数）。',
    '不要重演上一段用过的事件、委托与场景，换新的地点、新的对手与新的代价；也不要再写一次同样的结局。',
  ].filter(Boolean).join('\n');
}

export function hasStoryGraph(plan?: StoryPlan | null): plan is StoryPlan & { graph: StoryGraph } {
  return Boolean(plan?.graph && Array.isArray(plan.graph.nodes) && plan.graph.nodes.length > 0);
}

export function playableStoryPlan(plan?: StoryPlan | null): boolean {
  if (!plan) return false;
  if (hasStoryGraph(plan)) {
    return plan.graph.nodes.some(node => node.kind === 'start') && plan.graph.nodes.some(node => node.kind === 'end');
  }
  return Array.isArray(plan.beats) && plan.beats.length > 0;
}

/** 没有 API 密钥或两次生成都失败时的本地兜底：四幕模板编译成可编辑蓝图。 */
export function fallbackStoryPlan(girl: Girl): StoryPlan {
  const plan = storyPlanTemplate(`${girl.name}的故事`, `${girl.name}把还没说完的那段过去留在了今晚。`);
  return { ...plan, graph: layoutStoryGraph(compileBeatsToGraph(plan)) };
}

export function sanitizeStoryPlan(raw: unknown): StoryPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<StoryPlan>;
  const graph = value.graph ? sanitizeGraph(value.graph) ?? undefined : undefined;
  const rawBeats = Array.isArray(value.beats) ? value.beats : [];
  if (!rawBeats.length && !graph) return null;
  const title = clampText(value.title, 40);
  if (!title) return null;
  const beats = rawBeats.slice(0, 6).map((beat, index) => {
    const source = (beat ?? {}) as Partial<StoryBeat>;
    const choices = Array.isArray(source.choices) ? source.choices.slice(0, 3).map((choice, at) => {
      const item = (choice ?? {}) as unknown as Record<string, unknown>;
      const effect = (item.effect ?? {}) as Record<string, unknown>;
      const nextEffect: Record<string, number> = {};
      const bond = num(effect.bond, -12, 12);
      const corruption = num(effect.corruption, -10, 10);
      const gold = num(effect.gold, -3000, 3000);
      const reputation = num(effect.reputation, -10, 10);
      if (bond !== undefined) nextEffect.bond = bond;
      if (corruption !== undefined) nextEffect.corruption = corruption;
      if (gold !== undefined) nextEffect.gold = gold;
      if (reputation !== undefined) nextEffect.reputation = reputation;
      return {
        id: clampText(item.id, 24, `c${at + 1}`) || `c${at + 1}`,
        label: clampText(item.label, 40, `选择 ${at + 1}`),
        intent: clampText(item.intent, 120),
        effect: Object.keys(nextEffect).length ? nextEffect : undefined,
      };
    }) : [];
    return {
      id: `plan-${index + 1}`,
      index,
      title: clampText(source.title, 30, `第 ${index + 1} 幕`),
      summary: clampText(source.summary, 160),
      scene: clampText(source.scene, 700),
      hook: clampText(source.hook, 160),
      choices,
      status: (index === 0 ? 'open' : 'locked') as StoryBeat['status'],
      mission: source.mission,
      resolvedChoiceId: undefined,
      missionId: undefined,
      eventId: undefined,
    } as StoryBeat;
  });
  return {
    graph,
    title,
    premise: clampText(value.premise, 400),
    tone: clampText(value.tone, 40),
    beats,
  };
}

export function storyPlanIssues(plan: StoryPlan | null): string[] {
  if (!plan) return ['还没有剧本。'];
  const issues: string[] = [];
  if (!plan.title.trim()) issues.push('先给这条故事线起个标题。');
  if (hasStoryGraph(plan)) {
    return [...issues, ...validateGraph(plan.graph).filter(issue => issue.level === 'error').map(issue => issue.message)];
  }
  plan.beats.forEach((beat, index) => {
    if (!beat.title?.trim()) issues.push(`第 ${index + 1} 幕缺少标题。`);
    if (!(beat.hook ?? '').trim()) issues.push(`第 ${index + 1} 幕缺少事件钩子。`);
    if (!(beat.choices ?? []).length) issues.push(`第 ${index + 1} 幕至少要有一个选项。`);
  });
  return issues;
}
