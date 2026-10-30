import type { FactionId, GameState } from './types.ts';
import { factionInfo } from './content/items.ts';
import { incidentPending } from './incidents.ts';
import { hottestPair, hostilityTier, pairMembers } from './hostility.ts';
import { factionName } from './territories.ts';

export type TaskKind = 'war' | 'incident' | 'council' | 'faction' | 'mission' | 'storyline' | 'contract';

export interface TaskEntry {
  id: string;
  kind: TaskKind;
  title: string;
  hint: string;
  urgent: boolean;
  dueAt?: number;
  target: { modal: 'faction' | 'girl' | 'mission' | 'incident' | 'council' | 'base'; id?: string };
}

/** 面板上一次最多摊开几条，其余折成一句「还有 N 件事」。 */
export const TASK_VISIBLE = 6;

const KIND_ORDER: TaskKind[] = ['war', 'incident', 'council', 'faction', 'mission', 'storyline', 'contract'];

const minutes = (state: GameState) => state.day * 1440 + state.minutes;

function remainingLabel(target: number, now: number): string {
  const left = Math.round(target - now);
  if (left <= 0) return '已经到期';
  if (left < 60) return `剩余 ${left} 分`;
  const hours = Math.floor(left / 60);
  const rest = left % 60;
  return rest ? `剩余 ${hours} 小时 ${rest} 分` : `剩余 ${hours} 小时`;
}

/** 首页左上角那张清单：只收「今晚不做就会变糟」的事。 */
export function taskInbox(state: GameState): TaskEntry[] {
  const now = minutes(state);
  const entries: TaskEntry[] = [];

  const war = hottestPair(state);
  if (war) {
    const [a, b] = pairMembers(war.pair);
    const tier = hostilityTier(war.track.value);
    entries.push({
      id: `task-war-${war.pair}`,
      kind: 'war',
      title: `${factionName[a]} 与 ${factionName[b]}`,
      hint: `${tier === 'brink' ? '临战' : tier === 'standoff' ? '对峙' : '摩擦'} ${war.track.value}/100 · ${war.track.reason}`,
      urgent: tier === 'standoff' || tier === 'brink',
      target: { modal: 'faction', id: a },
    });
  }

  const scenes = incidentPending(state);
  scenes.slice(0, 3).forEach(incident => {
    entries.push({
      id: `task-incident-${incident.id}`,
      kind: 'incident',
      title: incident.title,
      hint: `${incident.source === 'llm' ? '叙事者拟稿' : incident.source === 'custom' ? '工坊投放' : '事务规则'} · 点开处理`,
      urgent: true,
      target: { modal: 'incident', id: incident.id },
    });
  });

  for (const opinion of state.opinions) {
    if (opinion.status !== 'pending') continue;
    entries.push({
      id: `task-opinion-${opinion.id}`,
      kind: 'council',
      title: `议会在等：${opinion.title}`,
      hint: `${opinion.topic} · ${opinion.request}`,
      urgent: false,
      target: { modal: 'council' },
    });
  }

  for (const faction of Object.keys(state.factions) as FactionId[]) {
    const taskId = state.factions[faction].envoyTaskId;
    if (!taskId) continue;
    const mission = state.missions.find(item => item.id === taskId);
    if (!mission || (mission.status !== 'active' && mission.status !== 'open')) continue;
    entries.push({
      id: `task-faction-${faction}`,
      kind: 'faction',
      title: `${factionInfo[faction].name}：${mission.title}`,
      hint: mission.status === 'active' ? '已经在跑' : `${factionInfo[faction].envoy} 还在等回话`,
      urgent: Boolean(mission.deadlineAt && mission.deadlineAt - now < 60),
      dueAt: mission.deadlineAt,
      target: { modal: 'mission', id: mission.id },
    });
  }

  for (const mission of state.missions) {
    if (mission.status !== 'open') continue;
    const forced = Boolean(mission.requiredGirlId || mission.storylineId);
    const closing = Boolean(mission.deadlineAt && mission.deadlineAt - now < 60);
    if (!forced && !closing) continue;
    entries.push({
      id: `task-mission-${mission.id}`,
      kind: 'mission',
      title: mission.title,
      hint: mission.storylineId ? '故事线的一环' : mission.requiredGirlId ? '指定同行者，别的人补不上' : remainingLabel(mission.deadlineAt ?? now, now),
      urgent: closing,
      dueAt: mission.deadlineAt,
      target: { modal: 'mission', id: mission.id },
    });
  }

  for (const story of state.storylines) {
    if (story.status !== 'active') continue;
    const girl = state.girls.find(item => item.id === story.girlId);
    if (!girl || girl.dead) continue;
    const beat = story.beats[story.stage];
    entries.push({
      id: `task-story-${story.id}`,
      kind: 'storyline',
      title: `${girl.name} · 第${story.stage + 1}幕：${beat?.title ?? story.title}`,
      hint: beat?.hook || beat?.summary || story.premise,
      urgent: false,
      target: { modal: 'girl', id: girl.id },
    });
  }

  for (const girl of state.girls) {
    if (girl.dead || girl.retired) continue;
    if (girl.pensionMissed < 3) continue;
    entries.push({
      id: `task-contract-${girl.id}`,
      kind: 'contract',
      title: `${girl.name} 的契约款欠了 ${girl.pensionMissed} 天`,
      hint: '再拖下去她会开始收拾东西',
      urgent: girl.pensionMissed >= 5,
      target: { modal: 'girl', id: girl.id },
    });
  }

  return entries.sort((left, right) => {
    if (left.urgent !== right.urgent) return left.urgent ? -1 : 1;
    const leftDue = left.dueAt ?? Number.POSITIVE_INFINITY;
    const rightDue = right.dueAt ?? Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind);
  });
}
