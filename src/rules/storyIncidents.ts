/**
 * 故事线里的弹窗投放。
 *
 * 两种载体：蓝图上的 `incident` 节点，以及 `mission.followUpIncident`（委托结算后紧接的那张卡）。
 * 两者都要认 trigger / ttlMinutes / blocking——immediate 立刻上桌，dayStart / wave 先进待用池。
 * 从 storyRun 里拆出来，是因为它已经顶到 450 行上限。
 */
import type { GameState, Incident, StoryIncidentSpec } from '../types.ts';
import { customIncidentCards } from '../content/library.ts';
import { deployIncidentCard } from './encounters.ts';

/** 当夜绝对分钟，给超时用。 */
export function storyNowAbs(state: GameState): number {
  return state.day * 1440 + state.minutes;
}

export interface StoryIncidentDeploy {
  incident: Incident;
  immediate: boolean;
}

/** 把蓝图节点/追加卡统一挂上触发时机、存活时长与「拦不拦打烊」。 */
export function stampIncident(state: GameState, incident: Incident, options: { trigger?: 'immediate' | 'dayStart' | 'wave'; ttlMinutes?: number; blocking?: boolean; wave?: number; storyNodeId?: string }): StoryIncidentDeploy {
  const trigger = options.trigger ?? 'immediate';
  const ttl = Math.max(30, Math.min(480, options.ttlMinutes ?? 240));
  const block = options.blocking ?? true;
  return {
    immediate: trigger === 'immediate',
    incident: {
      ...incident,
      ttlMinutes: ttl,
      blocking: block,
      expiresAt: storyNowAbs(state) + ttl,
      ...(options.storyNodeId ? { storyNodeId: options.storyNodeId } : {}),
      ...(trigger === 'dayStart' ? { trigger: { kind: 'dayStart' as const } } : {}),
      ...(trigger === 'wave' ? { trigger: { kind: 'wave' as const, wave: Math.min(2, Math.max(0, options.wave ?? state.shift.wave)) } } : {}),
    },
  };
}

/** 蓝图 incident 节点：可能来自工坊的弹窗卡，也可能是节点上手填的内容。 */
export function buildNodeIncident(state: GameState, storyId: string, nodeId: string, title: string, spec: StoryIncidentSpec): Incident {
  const card = spec.cardId ? customIncidentCards().find(entry => entry.id === spec.cardId) : undefined;
  if (card) return { ...deployIncidentCard(state, card), id: `inc-${storyId}-${nodeId}`, storylineId: storyId };
  return {
    id: `inc-${storyId}-${nodeId}`, day: state.day, kind: spec.kind, source: 'rule',
    title: spec.title || title, body: spec.body,
    faction: spec.faction, district: spec.district,
    options: spec.options.map((option, index) => ({ id: `o${index + 1}`, label: option.label, hint: option.hint, effect: option.effect })),
    status: 'pending', storylineId: storyId,
  };
}
