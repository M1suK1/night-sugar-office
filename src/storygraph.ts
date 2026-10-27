import type {
  FactionId, IncidentEffect, Opinion, StatKey, StoryBeat, StoryEdge, StoryEffect, StoryGraph,
  StoryNode, StoryNodeData, StoryNodeKind, StoryPlan, StoryMissionSpec,
} from './types.ts';
import type { DistrictId } from './districts.ts';

export const GRAPH_MAX_NODES = 80;
export const GRAPH_MAX_EDGES = 160;

export const NODE_LABELS: Record<StoryNodeKind, string> = {
  start: '开始', scene: '场景', choice: '选择', mission: '阶段委托',
  incident: '强制弹窗', opinion: '议会提案', event: '角色事件',
  reward: '奖励', wait: '等待', end: '结束',
};

export const NODE_ACCENT: Record<StoryNodeKind, string> = {
  start: '#8fd3c7', scene: '#c9b6d8', choice: '#f3aec9', mission: '#e0a15f',
  incident: '#e08a8a', opinion: '#9fb7e8', event: '#d8a0d0',
  reward: '#e8cf8a', wait: '#9aa4b2', end: '#8fd3c7',
};

export interface GraphIssue { level: 'error' | 'warning'; message: string; nodeId?: string }

export function nodeIdFactory(): () => string {
  let n = 0;
  return () => `n${++n}`;
}

export function edgeIdFactory(): () => string {
  let n = 0;
  return () => `e${++n}`;
}

export function blankGraph(): StoryGraph {
  return {
    version: 1,
    nodes: [{ id: 'n1', kind: 'start', x: 60, y: 160, title: '开始', data: { kind: 'start' } }],
    entry: 'n1',
  } as StoryGraph;
}

export function makeNode(kind: StoryNodeKind, x: number, y: number, id: string): StoryNode {
  const data: StoryNodeData = (() => {
    switch (kind) {
      case 'start': return { kind };
      case 'end': return { kind, summary: '' };
      case 'scene': return { kind, narration: '', lines: [] };
      case 'choice': return { kind, prompt: '', options: [
        { id: 'a', label: '选项 A', intent: '', effect: { bond: 2 } },
        { id: 'b', label: '选项 B', intent: '', effect: { bond: 1, corruption: 1 } },
      ] };
      case 'mission': return { kind, spec: { title: '', goal: '', category: '故事委托', difficulty: '常规', duration: 90 } };
      case 'incident': return { kind, spec: { kind: 'faction', title: '', body: '', options: [
        { label: '答应', hint: '', effect: { reputation: 2 } },
        { label: '拒绝', hint: '', effect: { reputation: -3 } },
      ] } };
      case 'opinion': return { kind, spec: { topic: '私人心愿', title: '', text: '', request: '', options: [
        { id: 'accept', label: '批准', effect: '' },
        { id: 'defer', label: '暂缓', effect: '' },
        { id: 'reject', label: '驳回', effect: '' },
      ] } };
      case 'event': return { kind, title: '', hook: '' };
      case 'reward': return { kind, effect: {} };
      case 'wait': return { kind, days: 0, minutes: 60 };
      default: return { kind: 'scene', narration: '', lines: [] };
    }
  })();
  return { id, kind, x, y, title: NODE_LABELS[kind], data };
}

/** 把旧的四幕结构编成一条线性图：场景 → 选择/委托 → 奖励/事件 → 下一幕。 */
export function compileBeatsToGraph(plan: StoryPlan): StoryGraph {
  const nextNode = nodeIdFactory();
  const nextEdge = edgeIdFactory();
  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  const startId = nextNode();
  nodes.push({ id: startId, kind: 'start', x: 40, y: 60, title: '开始', data: { kind: 'start' } });

  let previous = startId;
  let column = 1;
  const link = (from: string, to: string, port = 'out') => {
    edges.push({ id: nextEdge(), from, fromPort: port, to });
  };

  plan.beats.forEach((beat, index) => {
    const sceneId = nextNode();
    nodes.push({
      id: sceneId, kind: 'scene', x: column * 250, y: 60,
      title: beat.title || `第 ${index + 1} 幕`,
      data: {
        kind: 'scene',
        narration: [beat.scene, beat.summary].filter(Boolean).join('\n\n'),
        lines: beat.hook ? [{ speaker: '旁白', text: beat.hook }] : [],
      },
    });
    link(previous, sceneId);
    column += 1;

    if (beat.mission) {
      const missionId = nextNode();
      nodes.push({
        id: missionId, kind: 'mission', x: column * 250, y: 60 + index * 12,
        title: beat.mission.title || '阶段委托',
        data: { kind: 'mission', spec: beat.mission },
      });
      link(sceneId, missionId);
      column += 1;

      const eventId = nextNode();
      nodes.push({
        id: eventId, kind: 'event', x: column * 250, y: 60 + index * 12,
        title: beat.title || '角色事件',
        data: { kind: 'event', title: beat.title || '这一幕之后', hook: beat.hook || '' },
      });
      link(missionId, eventId, 'success');
      previous = eventId;
      column += 1;
      return;
    }

    if (beat.choices.length) {
      const choiceId = nextNode();
      nodes.push({
        id: choiceId, kind: 'choice', x: column * 250, y: 60 + index * 12,
        title: '选择',
        data: { kind: 'choice', prompt: beat.hook, options: beat.choices.map((choice, at) => ({ id: `c${at + 1}`, label: choice.label, intent: choice.intent, effect: choice.effect })) },
      });
      link(sceneId, choiceId);
      column += 1;

      const joins: string[] = [];
      beat.choices.forEach((choice, at) => {
        const rewardId = nextNode();
        nodes.push({
          id: rewardId, kind: 'reward', x: column * 250, y: 40 + at * 120,
          title: choice.label || `选项 ${at + 1}`,
          data: { kind: 'reward', effect: choice.effect ?? {} },
        });
        link(choiceId, rewardId, `c${at + 1}`);
        joins.push(rewardId);
      });
      // 多个分支汇到下一幕的场景节点；这里先用一个占位 wait 节点合并，保持单出口。
      const joinId = nextNode();
      nodes.push({ id: joinId, kind: 'wait', x: column * 250 + 240, y: 80, title: '继续', data: { kind: 'wait', days: 0, minutes: 0 } });
      joins.forEach(reward => link(reward, joinId));
      previous = joinId;
      column += 2;
      return;
    }

    previous = sceneId;
  });

  const endId = nextNode();
  nodes.push({
    id: endId, kind: 'end', x: column * 250, y: 120, title: '结束',
    data: { kind: 'end', summary: plan.premise },
  });
  link(previous, endId);

  return { version: 1, nodes, edges, entry: startId };
}

const STAT_KEYS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];

const clampInt = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;

const str = (value: unknown, limit: number, fallback = '') =>
  typeof value === 'string' ? value.slice(0, limit) : fallback;

function sanitizeData(kind: StoryNodeKind, raw: unknown): StoryNodeData {
  const value = (raw ?? {}) as Record<string, unknown>;
  switch (kind) {
    case 'start': return { kind };
    case 'end': return { kind, summary: str(value.summary, 300) };
    case 'scene': {
      const lines = Array.isArray(value.lines) ? value.lines.slice(0, 8).map((line) => {
        const item = (line ?? {}) as Record<string, unknown>;
        return { speaker: str(item.speaker, 20, '旁白'), tone: str(item.tone, 12) || undefined, text: str(item.text, 300) };
      }) : [];
      return { kind, narration: str(value.narration, 2400), lines };
    }
    case 'choice': {
      const options = Array.isArray(value.options) ? value.options.slice(0, 4).map((option, index) => {
        const item = (option ?? {}) as Record<string, unknown>;
        return { id: str(item.id, 8, `c${index + 1}`) || `c${index + 1}`, label: str(item.label, 40, `选项 ${index + 1}`), intent: str(item.intent, 120), effect: sanitizeEffect(item.effect) };
      }) : [];
      return { kind, prompt: str(value.prompt, 240), options };
    }
    case 'mission': {
      const spec = (value.spec ?? {}) as Partial<StoryMissionSpec>;
      return {
        kind,
        spec: {
          title: str(spec.title, 30), goal: str(spec.goal, 160), category: str(spec.category, 30, '故事委托'),
          difficulty: str(spec.difficulty, 8, '常规'), duration: clampInt(spec.duration, 30, 180, 90),
          district: spec.district as DistrictId | undefined, requirement: spec.requirement,
          requiredGirlId: spec.requiredGirlId, companion: spec.companion, monsters: spec.monsters,
          rewardEquipment: spec.rewardEquipment, followUpIncident: spec.followUpIncident, followUpEvent: spec.followUpEvent,
        },
      };
    }
    case 'incident': {
      const spec = (value.spec ?? {}) as Record<string, unknown>;
      const incidentKind = ['faction', 'environment', 'girl'].includes(String(spec.kind)) ? spec.kind as StoryIncidentSpecKind : 'faction';
      const options = Array.isArray(spec.options) ? spec.options.slice(0, 3).map((option) => {
        const item = (option ?? {}) as Record<string, unknown>;
        return { label: str(item.label, 30, '回应'), hint: str(item.hint, 80), effect: (item.effect ?? {}) as IncidentEffect };
      }) : [];
      return {
        kind,
        spec: {
          kind: incidentKind, title: str(spec.title, 30), body: str(spec.body, 400),
          faction: spec.faction as FactionId | undefined, district: spec.district as DistrictId | undefined,
          options,
        },
      };
    }
    case 'opinion': {
      const spec = (value.spec ?? {}) as Record<string, unknown>;
      const topics: Opinion['topic'][] = ['经费', '排班', '设施', '同伴', '城市', '私人心愿'];
      const topic = topics.includes(spec.topic as Opinion['topic']) ? spec.topic as Opinion['topic'] : '私人心愿';
      const options = Array.isArray(spec.options) ? spec.options.slice(0, 3).map((option, index) => {
        const item = (option ?? {}) as Record<string, unknown>;
        const ids = ['accept', 'defer', 'reject'] as const;
        return { id: ids.includes(item.id as never) ? item.id as typeof ids[number] : ids[index] ?? 'defer', label: str(item.label, 20, '选项'), effect: str(item.effect, 120), shift: item.shift as { district: DistrictId; faction: FactionId } | undefined };
      }) : [];
      return { kind, spec: { topic, title: str(spec.title, 30), text: str(spec.text, 300), request: str(spec.request, 120), options } };
    }
    case 'event': return { kind, title: str(value.title, 30), hook: str(value.hook, 160) };
    case 'reward': return { kind, effect: sanitizeEffect(value.effect) ?? {}, equipmentId: str(value.equipmentId, 60) || undefined, trait: value.trait as { name: string; description: string } | undefined };
    case 'wait': return { kind, days: clampInt(value.days, 0, 14, 0), minutes: clampInt(value.minutes, 0, 1440, 60) };
    default: return { kind: 'start' };
  }
}

type StoryIncidentSpecKind = 'faction' | 'environment' | 'girl';

function sanitizeEffect(raw: unknown): StoryEffect | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  const effect: StoryEffect = {};
  const gold = clampInt(value.gold, -3000, 3000, 0);
  const reputation = clampInt(value.reputation, -10, 10, 0);
  const bond = clampInt(value.bond, -12, 12, 0);
  const corruption = clampInt(value.corruption, -10, 10, 0);
  if (gold) effect.gold = gold;
  if (reputation) effect.reputation = reputation;
  if (bond) effect.bond = bond;
  if (corruption) effect.corruption = corruption;
  if (value.trait && typeof value.trait === 'object') {
    const trait = value.trait as Record<string, unknown>;
    if (str(trait.name, 20)) effect.trait = { name: str(trait.name, 20), description: str(trait.description, 120) };
  }
  if (value.skill && typeof value.skill === 'object') {
    const skill = value.skill as Record<string, unknown>;
    const id = str(skill.id, 40);
    if (id) effect.skill = { id, name: str(skill.name, 30, id) };
  }
  if (value.growth && typeof value.growth === 'object') {
    const growth = value.growth as Record<string, unknown>;
    const next: Partial<Record<StatKey, number>> = {};
    for (const key of STAT_KEYS) {
      const amount = clampInt(growth[key], -5, 5, 0);
      if (amount) next[key] = amount;
    }
    if (Object.keys(next).length) effect.growth = next;
  }
  if (value.buff && typeof value.buff === 'object') {
    const buff = value.buff as Record<string, unknown>;
    const name = str(buff.name, 20);
    if (name) {
      effect.buff = {
        name,
        description: str(buff.description, 120) || undefined,
        stat: STAT_KEYS.includes(buff.stat as StatKey) ? buff.stat as StatKey : undefined,
        amount: clampInt(buff.amount, -10, 10, 0) || undefined,
        days: clampInt(buff.days, 1, 14, 3),
      };
    }
  }
  if (value.trigger && typeof value.trigger === 'object') effect.trigger = value.trigger as StoryEffect['trigger'];
  return effect;
}

export function sanitizeGraph(raw: unknown): StoryGraph | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<StoryGraph>;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;
  if (value.nodes.length === 0 || value.nodes.length > GRAPH_MAX_NODES) return null;
  const seen = new Set<string>();
  const kinds = Object.keys(NODE_LABELS) as StoryNodeKind[];
  const nodes: StoryNode[] = [];
  for (const node of value.nodes) {
    const item = (node ?? {}) as Partial<StoryNode>;
    const id = str(item.id, 12);
    if (!id || seen.has(id)) return null;
    const kind = kinds.includes(item.kind as StoryNodeKind) ? item.kind as StoryNodeKind : null;
    if (!kind) return null;
    seen.add(id);
    nodes.push({
      id, kind, x: clampInt(item.x, 0, 4000, 60), y: clampInt(item.y, 0, 3000, 60),
      title: str(item.title, 40, NODE_LABELS[kind]), note: str(item.note, 200) || undefined,
      data: sanitizeData(kind, item.data),
    });
  }
  const edgeIds = new Set<string>();
  const edges: StoryEdge[] = [];
  for (const edge of value.edges.slice(0, GRAPH_MAX_EDGES)) {
    const item = (edge ?? {}) as Partial<StoryEdge>;
    const id = str(item.id, 12) || `e${edges.length + 1}`;
    if (edgeIds.has(id)) continue;
    if (!item.from || !item.to || !seen.has(item.from) || !seen.has(item.to)) continue;
    edgeIds.add(id);
    edges.push({ id, from: item.from, fromPort: str(item.fromPort, 12, 'out'), to: item.to });
  }
  const entry = str(value.entry, 12) || nodes.find(node => node.kind === 'start')?.id || '';
  if (!seen.has(entry)) return null;
  return { version: 1, nodes, edges, entry };
}

export function nodeById(graph: StoryGraph, id: string): StoryNode | undefined {
  return graph.nodes.find(node => node.id === id);
}

export function outgoing(graph: StoryGraph, nodeId: string, port = 'out'): StoryEdge[] {
  return graph.edges.filter(edge => edge.from === nodeId && (port === 'out' || edge.fromPort === port));
}

export function nextNode(graph: StoryGraph, nodeId: string, port = 'out'): string | undefined {
  return outgoing(graph, nodeId, port)[0]?.to;
}

export function validateGraph(graph: StoryGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const ids = new Set(graph.nodes.map(node => node.id));
  if (graph.nodes.length > GRAPH_MAX_NODES) issues.push({ level: 'error', message: `节点超过上限 ${GRAPH_MAX_NODES} 个。` });
  if (graph.edges.length > GRAPH_MAX_EDGES) issues.push({ level: 'error', message: `连线超过上限 ${GRAPH_MAX_EDGES} 条。` });
  const starts = graph.nodes.filter(node => node.kind === 'start');
  if (starts.length !== 1) issues.push({ level: 'error', message: '需要且只能有一个「开始」节点。' });
  const entry = nodeById(graph, graph.entry);
  if (!entry || entry.kind !== 'start') issues.push({ level: 'error', message: '入口必须指向「开始」节点。' });
  if (!graph.nodes.some(node => node.kind === 'end')) issues.push({ level: 'error', message: '至少需要一个「结束」节点。' });

  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) issues.push({ level: 'error', message: `连线 ${edge.id} 指向了不存在的节点。` });
  }
  for (const node of graph.nodes) {
    if (node.kind === 'end') continue;
    if (node.kind === 'choice') {
      const ports = new Set(graph.edges.filter(edge => edge.from === node.id).map(edge => edge.fromPort));
      const missing = (node.data.kind === 'choice' ? node.data.options : []).filter(option => !ports.has(option.id));
      if (missing.length) issues.push({ level: 'error', message: `选择节点「${node.title}」有 ${missing.length} 个选项没连线。`, nodeId: node.id });
      if (node.data.kind === 'choice' && node.data.options.length < 2) issues.push({ level: 'warning', message: '选择节点建议至少两个选项。', nodeId: node.id });
    } else if (!outgoing(graph, node.id).length) {
      issues.push({ level: 'error', message: `「${node.title}」没有出口连线。`, nodeId: node.id });
    }
    if (node.data.kind === 'mission' && (!node.data.spec.title || !node.data.spec.goal)) {
      issues.push({ level: 'error', message: '阶段委托缺少标题或目标。', nodeId: node.id });
    }
    if (node.kind === 'mission') {
      const ports = new Set(graph.edges.filter(edge => edge.from === node.id).map(edge => edge.fromPort));
      if (!ports.has('success') && !ports.has('out')) issues.push({ level: 'error', message: `阶段委托「${node.title}」缺少「成功」出口。`, nodeId: node.id });
      if (!ports.has('failure')) issues.push({ level: 'warning', message: `阶段委托「${node.title}」没有「失败」出口，失败时故事会直接收束。`, nodeId: node.id });
    }
    if (node.data.kind === 'incident' && (!node.data.spec.title || !node.data.spec.body)) {
      issues.push({ level: 'error', message: '强制弹窗缺少标题或正文。', nodeId: node.id });
    }
    if (node.data.kind === 'opinion' && (!node.data.spec.title || !node.data.spec.text)) {
      issues.push({ level: 'error', message: '议会提案缺少标题或正文。', nodeId: node.id });
    }
  }

  // 可达性
  if (entry) {
    const reachable = new Set<string>();
    const queue = [entry.id];
    while (queue.length) {
      const current = queue.pop() as string;
      if (reachable.has(current)) continue;
      reachable.add(current);
      graph.edges.filter(edge => edge.from === current).forEach(edge => queue.push(edge.to));
    }
    const orphan = graph.nodes.filter(node => !reachable.has(node.id));
    if (orphan.length) issues.push({ level: 'warning', message: `有 ${orphan.length} 个节点从开始无法到达（${orphan.slice(0, 3).map(node => node.title).join('、')}）。` });
  }
  return issues;
}

export function ensureGraph(plan: StoryPlan | null | undefined): StoryGraph {
  if (!plan) return blankGraph();
  return sanitizeGraph(plan.graph) ?? compileBeatsToGraph(plan);
}

export function graphBeats(graph: StoryGraph): StoryBeat[] {
  // 幕列表视图：把场景节点按 x 排序压平成列表。
  return graph.nodes
    .filter(node => node.kind === 'scene' || node.kind === 'event')
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .map((node, index) => ({
      id: `plan-${index + 1}`,
      index,
      title: node.title,
      summary: '',
      scene: node.data.kind === 'scene' ? node.data.narration : '',
      hook: node.data.kind === 'scene' ? node.data.lines[0]?.text ?? '' : node.data.kind === 'event' ? node.data.hook : '',
      choices: [],
      status: index === 0 ? 'open' : 'locked',
    }));
}
