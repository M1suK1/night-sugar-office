import type { StoryBeat, StoryPlan } from './types.ts';
import { sanitizeGraph } from './storygraph.ts';

const clampText = (value: unknown, limit: number, fallback = '') =>
  typeof value === 'string' ? value.trim().slice(0, limit) : fallback;

const num = (value: unknown, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : undefined;

export const STORY_PLAN_BEATS = 4;

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

export function sanitizeStoryPlan(raw: unknown): StoryPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<StoryPlan>;
  if (!Array.isArray(value.beats) || value.beats.length === 0) return null;
  const title = clampText(value.title, 40);
  if (!title) return null;
  const beats = value.beats.slice(0, 6).map((beat, index) => {
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
    graph: value.graph ? sanitizeGraph(value.graph) ?? undefined : undefined,
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
  plan.beats.forEach((beat, index) => {
    if (!beat.title?.trim()) issues.push(`第 ${index + 1} 幕缺少标题。`);
    if (!(beat.hook ?? '').trim()) issues.push(`第 ${index + 1} 幕缺少事件钩子。`);
    if (!(beat.choices ?? []).length) issues.push(`第 ${index + 1} 幕至少要有一个选项。`);
  });
  return issues;
}
