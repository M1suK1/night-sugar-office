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
      case 'end': return { kind, summary: '', ending: '' };
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

  // 本地模板也给两个结局：她留下来，或者把钥匙放下。
  const forkId = nextNode();
  nodes.push({
    id: forkId, kind: 'choice', x: column * 250, y: 120, title: '最后的选择',
    data: {
      kind: 'choice',
      prompt: '到这里，故事该收尾了。',
      options: [{ id: 'stay', label: '让她留下来' }, { id: 'leave', label: '放她走' }],
    },
  });
  link(previous, forkId);
  const stayId = nextNode();
  nodes.push({
    id: stayId, kind: 'end', x: (column + 1) * 250, y: 40, title: '留下',
    data: { kind: 'end', summary: plan.premise, ending: '留下' },
  });
  link(forkId, stayId, 'stay');
  const leaveId = nextNode();
  nodes.push({
    id: leaveId, kind: 'end', x: (column + 1) * 250, y: 200, title: '离开',
    data: { kind: 'end', summary: `${plan.premise}（她把钥匙留在桌上。）`, ending: '离开' },
  });
  link(forkId, leaveId, 'leave');

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
    case 'end': return { kind, summary: str(value.summary, 300), ending: str(value.ending, 24) };
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
          cardId: typeof spec.cardId === 'string' && spec.cardId.startsWith('custom-incident-') ? spec.cardId.slice(0, 80) : undefined,
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

export interface StoryGraphDraftNode {
  id?: string;
  kind: StoryNodeKind;
  title?: string;
  note?: string;
  data?: unknown;
}

export interface StoryGraphDraftEdge {
  from?: string;
  fromPort?: string;
  to?: string;
}

export interface StoryGraphDraft {
  nodes: StoryGraphDraftNode[];
  edges: StoryGraphDraftEdge[];
  entry?: string;
}

/**
 * 把模型给出的语义节点/连线落成可编辑的图。
 * 模型不负责 id、坐标和边 id：这里统一补全，并让同一条连线只保留一次。
 */
export function buildGraphFromDraft(draft: StoryGraphDraft): StoryGraph {
  if (!draft || !Array.isArray(draft.nodes) || draft.nodes.length === 0) throw new Error('蓝图没有节点。');
  if (draft.nodes.length > GRAPH_MAX_NODES) throw new Error(`蓝图节点超过上限 ${GRAPH_MAX_NODES} 个。`);
  const kinds = Object.keys(NODE_LABELS) as StoryNodeKind[];
  const usedIds = new Set<string>();
  const idMap = new Map<string, string>();
  const nodes: StoryNode[] = [];
  const startIds: string[] = [];

  draft.nodes.forEach((raw, index) => {
    if (!raw || !kinds.includes(raw.kind)) throw new Error(`第 ${index + 1} 个节点的种类无效。`);
    const original = typeof raw.id === 'string' ? raw.id.trim() : '';
    let base = original.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12);
    if (!base) base = `n${index + 1}`;
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base.slice(0, 10)}${suffix}`.slice(0, 12);
      suffix += 1;
    }
    usedIds.add(id);
    if (original && !idMap.has(original)) idMap.set(original, id);
    if (raw.kind === 'start') startIds.push(id);
    nodes.push({
      id,
      kind: raw.kind,
      x: 0,
      y: 0,
      title: typeof raw.title === 'string' ? raw.title : '',
      note: typeof raw.note === 'string' ? raw.note : undefined,
      data: sanitizeData(raw.kind, raw.data),
    });
  });
  if (startIds.length !== 1) throw new Error('蓝图需要且只能有一个「开始」节点。');

  const resolve = (id: string | undefined): string | undefined => {
    if (!id) return undefined;
    return idMap.get(id) ?? (usedIds.has(id) ? id : undefined);
  };
  const seenEdges = new Set<string>();
  const edges: StoryEdge[] = [];
  for (const raw of Array.isArray(draft.edges) ? draft.edges : []) {
    const from = resolve(raw?.from);
    const to = resolve(raw?.to);
    if (!from || !to) continue;
    const fromPort = typeof raw.fromPort === 'string' && raw.fromPort.trim() ? raw.fromPort.trim().slice(0, 12) : 'out';
    const key = `${from}|${fromPort}|${to}`;
    if (seenEdges.has(key)) continue;
    seenEdges.add(key);
    edges.push({ id: `e${edges.length + 1}`, from, fromPort, to });
  }

  const graph = sanitizeGraph({ version: 1, nodes, edges, entry: startIds[0] });
  if (!graph) throw new Error('蓝图结构无法清洗，请检查节点与连线。');
  return layoutStoryGraph(graph);
}

/** 纯函数布局：按入口 BFS 分列，同列每 6 个节点折到下一排。 */
export function layoutStoryGraph(graph: StoryGraph): StoryGraph {
  if (!graph.nodes.length) return graph;
  const entry = graph.nodes.some(node => node.id === graph.entry) ? graph.entry : graph.nodes[0].id;
  const level = new Map<string, number>();
  level.set(entry, 0);
  const queue = [entry];
  while (queue.length) {
    const id = queue.shift() as string;
    const nextLevel = (level.get(id) ?? 0) + 1;
    for (const edge of graph.edges.filter(item => item.from === id)) {
      if (level.has(edge.to)) continue;
      level.set(edge.to, nextLevel);
      queue.push(edge.to);
    }
  }
  const maxLevel = Math.max(0, ...Array.from(level.values()));
  const orphanLevel = maxLevel + 1;
  const groups = new Map<number, string[]>();
  for (const node of graph.nodes) {
    const depth = level.get(node.id) ?? orphanLevel;
    const group = groups.get(depth) ?? [];
    group.push(node.id);
    groups.set(depth, group);
  }
  return {
    ...graph,
    nodes: graph.nodes.map(node => {
      const depth = level.get(node.id) ?? orphanLevel;
      const index = groups.get(depth)?.indexOf(node.id) ?? 0;
      return {
        ...node,
        x: 60 + depth * 232 + Math.floor(index / 6) * 214,
        y: 76 + (index % 6) * 122,
      };
    }),
  };
}

/** LLM 生成契约：比手动编辑更严格，结构不合格就不落盘。 */
export function blueprintIssues(graph: StoryGraph): GraphIssue[] {
  const issues: GraphIssue[] = validateGraph(graph).map(issue => {
    const promote = issue.level === 'warning' && (
      (issue.message.startsWith('有 ') && issue.message.includes('无法到达'))
      || issue.message.includes('没有「失败」出口')
    );
    return { ...issue, level: promote ? 'error' : issue.level };
  });
  const ids = new Set(graph.nodes.map(node => node.id));
  const starts = graph.nodes.filter(node => node.kind === 'start');
  const ends = graph.nodes.filter(node => node.kind === 'end');
  const choices = graph.nodes.filter(node => node.kind === 'choice');
  const missions = graph.nodes.filter(node => node.kind === 'mission');
  const scenes = graph.nodes.filter(node => node.kind === 'scene');
  if (graph.nodes.length < 8) issues.push({ level: 'error', message: '蓝图至少需要 8 个节点。' });
  if (graph.nodes.length > 16) issues.push({ level: 'error', message: '蓝图最多 16 个节点，请把支线收束。' });
  if (graph.edges.length > graph.nodes.length + 8) issues.push({ level: 'error', message: '蓝图连线过多，可能出现了重复分支。' });
  if (starts.length !== 1) issues.push({ level: 'error', message: '蓝图需要且只能有一个开始节点。' });
  if (ends.length < 2 || ends.length > 3) issues.push({ level: 'error', message: '故事线至少要通向两个不同的结局（2–3 个结束节点）。' });
  const labels = ends.map(endingLabel);
  if (ends.length >= 2 && new Set(labels).size < 2) {
    issues.push({ level: 'error', message: '两个结局用了同一个标签，等于只有一个结局；请在结束节点上写不同的 ending。' });
  }
  if (choices.length < 1 || choices.length > 2) issues.push({ level: 'error', message: '蓝图需要 1–2 个选择节点。' });
  if (missions.length < 1 || missions.length > 2) issues.push({ level: 'error', message: '蓝图需要 1–2 个阶段委托。' });
  if (!scenes.length) issues.push({ level: 'error', message: '蓝图至少需要一个场景节点。' });
  for (const node of graph.nodes) {
    if (node.kind === 'incident' || node.kind === 'opinion') {
      issues.push({ level: 'error', message: `生成蓝图不能包含「${NODE_LABELS[node.kind]}」节点，请改用手动编辑。`, nodeId: node.id });
    }
  }

  const start = starts[0];
  if (start) {
    if (graph.edges.some(edge => edge.to === start.id)) issues.push({ level: 'error', message: '开始节点不能有入线。', nodeId: start.id });
    const startOut = graph.edges.filter(edge => edge.from === start.id);
    if (startOut.length !== 1 || startOut[0].fromPort !== 'out') {
      issues.push({ level: 'error', message: '开始节点必须只有一条默认出口。', nodeId: start.id });
    }
  }
  if (start) {
    const reachable = new Set([start.id]);
    const queue = [start.id];
    while (queue.length) {
      const current = queue.shift()!;
      for (const edge of graph.edges.filter(item => item.from === current)) {
        if (!ids.has(edge.to) || reachable.has(edge.to)) continue;
        reachable.add(edge.to);
        queue.push(edge.to);
      }
    }
    for (const end of ends) {
      if (!reachable.has(end.id)) issues.push({ level: 'error', message: `结束节点「${end.title}」从开始节点不可达。`, nodeId: end.id });
    }
  }
  for (const end of ends) {
    if (graph.edges.some(edge => edge.from === end.id)) issues.push({ level: 'error', message: `结束节点「${end.title}」不能再有出口。`, nodeId: end.id });
  }

  for (const node of choices) {
    if (node.data.kind !== 'choice') continue;
    const options = node.data.options;
    if (options.length < 2 || options.length > 4) issues.push({ level: 'error', message: `选择节点「${node.title}」需要 2–4 个选项。`, nodeId: node.id });
    const known = new Set(options.map(option => option.id));
    for (const option of options) {
      const hits = graph.edges.filter(edge => edge.from === node.id && edge.fromPort === option.id);
      if (hits.length !== 1) issues.push({ level: 'error', message: `选择节点「${node.title}」的选项「${option.label}」必须且只能连一条线。`, nodeId: node.id });
    }
    for (const edge of graph.edges.filter(item => item.from === node.id)) {
      if (!known.has(edge.fromPort)) issues.push({ level: 'error', message: `选择节点「${node.title}」有无法识别的出口「${edge.fromPort}」。`, nodeId: node.id });
    }
  }
  for (const node of missions) {
    const success = graph.edges.filter(edge => edge.from === node.id && edge.fromPort === 'success');
    const failure = graph.edges.filter(edge => edge.from === node.id && edge.fromPort === 'failure');
    if (success.length !== 1) issues.push({ level: 'error', message: `阶段委托「${node.title}」必须有且只有一条成功线。`, nodeId: node.id });
    if (failure.length !== 1) issues.push({ level: 'error', message: `阶段委托「${node.title}」必须有且只有一条失败线。`, nodeId: node.id });
    for (const edge of graph.edges.filter(item => item.from === node.id)) {
      if (edge.fromPort !== 'success' && edge.fromPort !== 'failure') issues.push({ level: 'error', message: `阶段委托「${node.title}」的出口只能是成功或失败。`, nodeId: node.id });
    }
  }

  // 有向无环：生成蓝图不允许回环。
  const colors = new Map<string, 1 | 2>();
  const cycles = new Set<string>();
  const visit = (id: string) => {
    colors.set(id, 1);
    for (const edge of graph.edges.filter(item => item.from === id)) {
      if (!ids.has(edge.to)) continue;
      const state = colors.get(edge.to);
      if (state === 1) {
        const from = nodeById(graph, id)?.title ?? id;
        const to = nodeById(graph, edge.to)?.title ?? edge.to;
        cycles.add(`「${from}」到「${to}」形成了环，蓝图必须是一条向前的故事。`);
      } else if (!state) {
        visit(edge.to);
      }
    }
    colors.set(id, 2);
  };
  for (const node of graph.nodes) if (!colors.get(node.id)) visit(node.id);
  cycles.forEach(message => issues.push({ level: 'error', message }));

  // 每个节点都必须能走到某个结束节点。
  const reachesEnd = new Set(ends.map(node => node.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (reachesEnd.has(edge.to) && !reachesEnd.has(edge.from)) { reachesEnd.add(edge.from); changed = true; }
    }
  }
  for (const node of graph.nodes) {
    if (!reachesEnd.has(node.id)) issues.push({ level: 'error', message: `节点「${node.title}」没有任何路径通往结束。`, nodeId: node.id });
  }
  return issues;
}

/** 结束节点的结局标签：优先用 ending，没写就退回节点标题。 */
export function endingLabel(node: StoryNode): string {
  if (node.data.kind !== 'end') return '';
  return (node.data.ending || node.title || '').trim();
}

/** 蓝图里所有结局标签（未去重），给校验与展示用。 */
export function graphEndings(graph: StoryGraph): string[] {
  return graph.nodes.filter(node => node.kind === 'end').map(endingLabel);
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
