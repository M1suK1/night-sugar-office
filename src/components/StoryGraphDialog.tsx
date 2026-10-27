import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, AlignLeft, ArrowRight, Check, ClipboardPaste, Clock3, Copy, CopyPlus, Flag, Gift, GitBranch, MessageSquare, Play, Plus, Sparkles, Target, Trash2, X, type LucideIcon } from 'lucide-react';
import type { Girl, StoryEffect, StoryGraph, StoryNode, StoryNodeKind } from '../types.ts';
import { NODE_LABELS, compileBeatsToGraph, makeNode, validateGraph } from '../storygraph.ts';
import { storyPlanTemplate } from '../storyplan.ts';

const NODE_W = 190;
const NODE_H = 74;
const PALETTE: StoryNodeKind[] = ['scene', 'choice', 'mission', 'incident', 'opinion', 'event', 'reward', 'wait', 'end'];
const NODE_COLOR: Record<StoryNodeKind, string> = {
  start: '#7fc8c0', scene: '#c9b6d8', choice: '#f3aec9', mission: '#e8c08a',
  incident: '#e28f8f', opinion: '#a8c8e8', event: '#d8a8c8', reward: '#e8d88a', wait: '#9aa8b8', end: '#8fb89a',
};

const NODE_ICON: Record<StoryNodeKind, LucideIcon> = {
  start: Play, scene: AlignLeft, choice: GitBranch, mission: Target, incident: AlertTriangle,
  opinion: MessageSquare, event: Sparkles, reward: Gift, wait: Clock3, end: Flag,
};

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  if (dx >= 24) {
    const mid = Math.max(18, Math.min(140, dx * 0.55));
    return `M${x1} ${y1} C${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`;
  }
  // 目标在左侧（回环）或几乎重叠：用一条二次曲线从上方跨过去，避免打结。
  const lift = Math.min(150, 64 + Math.abs(dx) * 0.12 + Math.abs(y2 - y1) * 0.1);
  const midX = (x1 + x2) / 2;
  const apex = Math.min(y1, y2) - lift;
  return `M${x1} ${y1} Q${midX} ${apex}, ${x2} ${y2}`;
}

function portsOf(node: StoryNode): string[] {
  if (node.kind === 'choice' && node.data.kind === 'choice') return node.data.options.map(option => option.id);
  return node.kind === 'end' ? [] : ['out'];
}

function portY(node: StoryNode, port: string): number {
  const ports = portsOf(node);
  const index = Math.max(0, ports.indexOf(port));
  return node.y + 26 + index * 18;
}

export function StoryGraphDialog({ girl, onSave, onClose }: { girl: Girl; onSave: (graph: StoryGraph) => void; onClose: () => void }) {
  const initial = useMemo(() => {
    if (girl.storyPlan?.graph) return structuredClone(girl.storyPlan.graph);
    if (girl.storyPlan?.beats?.length) return compileBeatsToGraph(girl.storyPlan);
    return compileBeatsToGraph(storyPlanTemplate('新的故事', '一句话写下这个故事的开头。'));
  }, [girl]);
  const [graph, setGraph] = useState<StoryGraph>(initial);
  const initialId = initial.nodes.find(node => node.kind === 'start')?.id ?? null;
  const [selected, setSelected] = useState<string | null>(initialId);
  const [selection, setSelection] = useState<string[]>(initialId ? [initialId] : []);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const [linkFrom, setLinkFrom] = useState<{ nodeId: string; port: string } | null>(null);
  const [clipboard, setClipboard] = useState<StoryNode | null>(null);
  const [linking, setLinking] = useState<{ nodeId: string; port: string; x: number; y: number; moved: boolean } | null>(null);
  const [hoverNode, setHoverNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [dry, setDry] = useState<{ id: string; title: string; kind: string }[] | null>(null);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [beatsOpen, setBeatsOpen] = useState(false);
  const drag = useRef<{ ids: string[]; origins: Record<string, { x: number; y: number }>; cx: number; cy: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);

  const node = graph.nodes.find(item => item.id === selected) ?? null;
  const issues = validateGraph(graph);
  const errors = issues.filter(issue => issue.level === 'error');
  const warnings = issues.filter(issue => issue.level === 'warning');

  const patchNode = (id: string, patch: Partial<StoryNode>) => {
    setGraph(current => ({ ...current, nodes: current.nodes.map(item => (item.id === id ? { ...item, ...patch } : item)) }));
  };
  const patchSpec = (patch: Record<string, unknown>) => {
    const current = node;
    if (!current) return;
    if (current.data.kind === 'mission' || current.data.kind === 'incident' || current.data.kind === 'opinion') {
      patchNode(current.id, { data: { ...current.data, spec: { ...current.data.spec, ...patch } } as unknown as StoryNode['data'] });
    }
  };
  const patchScene = (narration: string) => { const c = node; if (c?.data.kind === 'scene') patchNode(c.id, { data: { ...c.data, narration } }); };
  const patchEvent = (patch: { title?: string; hook?: string }) => { const c = node; if (c?.data.kind === 'event') patchNode(c.id, { data: { ...c.data, ...patch } }); };
  const patchReward = (effect: { gold?: number; bond?: number; corruption?: number }) => { const c = node; if (c?.data.kind === 'reward') patchNode(c.id, { data: { ...c.data, effect: { ...c.data.effect, ...effect } } }); };
  const patchWait = (patch: { days?: number; minutes?: number }) => { const c = node; if (c?.data.kind === 'wait') patchNode(c.id, { data: { ...c.data, ...patch } }); };
  const patchEnd = (summary: string) => { const c = node; if (c?.data.kind === 'end') patchNode(c.id, { data: { ...c.data, summary } }); };
  const patchOptions = (options: { id: string; label: string; intent?: string; effect?: StoryEffect }[]) => { const c = node; if (c?.data.kind === 'choice') patchNode(c.id, { data: { ...c.data, options } }); };
  const addNode = (kind: StoryNodeKind) => {
    const created: StoryNode = {
      ...makeNode(kind, Math.max(...graph.nodes.map(node => node.x), 0) + 260, 220, `n${Date.now().toString(36)}${graph.nodes.length}`),
      title: NODE_LABELS[kind],
    };
    setGraph(current => ({ ...current, nodes: [...current.nodes, created] }));
    setSelected(created.id);
    window.setTimeout(() => document.getElementById(`story-graph-node-${created.id}`)?.scrollIntoView({ block: 'nearest', inline: 'center' }), 60);
  };
  const removeSelected = () => {
    const doomed = new Set(selection.filter(id => graph.nodes.find(item => item.id === id)?.kind !== 'start'));
    if (!doomed.size) return;
    setGraph(current => ({
      ...current,
      nodes: current.nodes.filter(item => !doomed.has(item.id)),
      edges: current.edges.filter(edge => !doomed.has(edge.from) && !doomed.has(edge.to)),
    }));
    setSelection([]);
    setSelected(null);
  };
  const freshId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const addCopy = (source: StoryNode) => {
    const created: StoryNode = { ...structuredClone(source), id: freshId(), x: source.x + 64, y: source.y + 84, title: source.title };
    setGraph(current => ({ ...current, nodes: [...current.nodes, created] }));
    setSelected(created.id);
    window.setTimeout(() => document.getElementById(`story-graph-node-${created.id}`)?.scrollIntoView({ block: 'nearest', inline: 'center' }), 60);
  };
  const copyNode = () => { if (node) setClipboard(structuredClone(node)); };
  const pasteNode = (source: StoryNode | null = clipboard) => { if (source) addCopy(source); };
  const duplicateNode = () => { if (node) addCopy(node); };
  const pointOnCanvas = (clientX: number, clientY: number) => {
    const host = canvas.current;
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    return { x: (clientX - rect.left + host.scrollLeft) / zoom, y: (clientY - rect.top + host.scrollTop) / zoom };
  };
  const beginLink = (event: ReactPointerEvent<HTMLButtonElement>, item: StoryNode, port: string) => {
    event.stopPropagation();
    const point = pointOnCanvas(event.clientX, event.clientY);
    if (!point) return;
    setLinking({ nodeId: item.id, port, x: point.x, y: point.y, moved: false });
    setLinkFrom(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveLink = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!linking) return;
    const point = pointOnCanvas(event.clientX, event.clientY);
    if (!point) return;
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const hovered = (element?.closest('.graph-node') as HTMLElement | null)?.dataset.nodeId ?? null;
    setHoverNode(hovered && hovered !== linking.nodeId ? hovered : null);
    const moved = linking.moved || Math.abs(point.x - linking.x) > 3 || Math.abs(point.y - linking.y) > 3;
    setLinking({ ...linking, x: point.x, y: point.y, moved });
  };
  const endLink = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!linking) return;
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const target = (element?.closest('.graph-node') as HTMLElement | null)?.dataset.nodeId;
    if (target && target !== linking.nodeId) connect(linking.nodeId, linking.port, target);
    else if (!linking.moved) setLinkFrom({ nodeId: linking.nodeId, port: linking.port });
    setLinking(null);
    setHoverNode(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName ?? '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'c') { event.preventDefault(); copyNode(); }
      if (mod && event.key.toLowerCase() === 'v') { event.preventDefault(); pasteNode(); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && node && node.kind !== 'start') { event.preventDefault(); removeSelected(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const connect = (fromNodeId: string, port: string, toNodeId: string) => {
    if (fromNodeId === toNodeId) return;
    setGraph(current => {
      const kept = current.edges.filter(edge => !(edge.from === fromNodeId && edge.fromPort === port));
      return { ...current, edges: [...kept, { id: `e-${Date.now()}-${current.edges.length}`, from: fromNodeId, fromPort: port, to: toNodeId }] };
    });
    setLinkFrom(null);
  };

  const clampZoom = (value: number) => Math.min(1.6, Math.max(0.5, Math.round(value * 10) / 10));
  const autoLayout = () => {
    const depth = new Map<string, number>();
    const start = graph.entry;
    if (!start) return;
    depth.set(start, 0);
    const queue = [start];
    for (let i = 0; i < 80 && queue.length; i += 1) {
      const id = queue.shift() as string;
      const base = depth.get(id) ?? 0;
      for (const edge of graph.edges.filter(item => item.from === id)) {
        if (!graph.nodes.some(item => item.id === edge.to)) continue;
        if (depth.has(edge.to)) continue;
        depth.set(edge.to, base + 1);
        queue.push(edge.to);
      }
    }
    let fallback = Math.max(0, ...Array.from(depth.values())) + 1;
    for (const item of graph.nodes) {
      if (!depth.has(item.id)) { depth.set(item.id, fallback); fallback += 1; }
    }
    const buckets = new Map<number, typeof graph.nodes>();
    for (const item of graph.nodes) {
      const level = depth.get(item.id) ?? 0;
      buckets.set(level, [...(buckets.get(level) ?? []), item]);
    }
    const placed = new Map<string, { x: number; y: number }>();
    for (const [level, items] of Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])) {
      items.forEach((item, index) => {
        placed.set(item.id, { x: 60 + level * 232 + Math.floor(index / 6) * 214, y: 76 + (index % 6) * 122 });
      });
    }
    setGraph(current => ({ ...current, nodes: current.nodes.map(item => ({ ...item, ...(placed.get(item.id) ?? {}) })) }));
    window.setTimeout(() => document.getElementById('story-graph-node-' + graph.entry)?.scrollIntoView({ block: 'nearest', inline: 'start' }), 60);
  };
  const fitView = () => {
    const host = canvas.current;
    if (!host || !graph.nodes.length) return;
    const xs = graph.nodes.map(item => item.x);
    const ys = graph.nodes.map(item => item.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) + NODE_W - minX + 120;
    const spanY = Math.max(...ys) + NODE_H - minY + 120;
    const next = clampZoom(Math.min(1.2, (host.clientWidth - 24) / spanX, (host.clientHeight - 24) / spanY));
    setZoom(next);
    window.requestAnimationFrame(() => {
      host.scrollLeft = Math.max(0, (minX - 30) * next);
      host.scrollTop = Math.max(0, (minY - 30) * next);
    });
  };
  const runDry = () => {
    const steps: { id: string; title: string; kind: string }[] = [];
    let cursor: string | undefined = graph.entry;
    const seen = new Set<string>();
    for (let guard = 0; guard < 40 && cursor; guard += 1) {
      const item = graph.nodes.find(entry => entry.id === cursor);
      if (!item) break;
      steps.push({ id: item.id, title: item.title, kind: item.kind });
      if (item.kind === 'end') break;
      const out = graph.edges.filter(edge => edge.from === item.id);
      if (!out.length) { steps.push({ id: 'stop-' + guard, title: '没有出口，流程停在这里', kind: 'stop' }); break; }
      if (item.kind === 'choice' && item.data.kind === 'choice') {
        const option = item.data.options[0];
        steps.push({ id: 'pick-' + item.id, title: '默认选择：' + (option?.label || '第一个选项'), kind: 'pick' });
      }
      cursor = out[0].to;
      if (seen.has(item.id) && steps.length > 16) { steps.push({ id: 'loop-' + guard, title: '检测到回环，试跑结束', kind: 'stop' }); break; }
      seen.add(item.id);
    }
    setDry(steps);
  };

  return (
    <div className="story-graph-overlay" role="dialog" aria-modal="true" aria-label="故事蓝图">
      <div className="story-graph-modal">
        <header className="story-graph-head">
          <div>
            <small><GitBranch size={12} /> 故事蓝图 · {girl.name}</small>
            <b>{girl.storyPlan?.title ?? '新的故事'}</b>
            <span className="story-graph-hint">拖端口连线 · Ctrl+C/V 复制粘贴 · Delete 删除</span>
          </div>
          <div className="story-graph-actions">
            <button type="button" className="btn ghost" id="story-graph-validate" onClick={() => setIssuesOpen(value => !value)}>
              <Check size={13} /> 校验 {errors.length ? `${errors.length} 项问题` : warnings.length ? `${warnings.length} 条提醒` : '通过'}
            </button>
            <button type="button" className="btn" id="story-graph-save" onClick={() => onSave(graph)}>保存蓝图</button>
            <button type="button" className="btn ghost" id="story-graph-copy" onClick={copyNode} disabled={!node} title="复制节点（Ctrl+C）"><Copy size={13} /> 复制</button>
            <button type="button" className="btn ghost" id="story-graph-paste" onClick={() => pasteNode()} disabled={!clipboard} title="粘贴节点（Ctrl+V）"><ClipboardPaste size={13} /> 粘贴</button>
            <button type="button" className="btn ghost" id="story-graph-duplicate" onClick={duplicateNode} disabled={!node} title="原地复制一份"><CopyPlus size={13} /> 副本</button>
            <button type="button" className="btn ghost" id="story-graph-close" onClick={onClose}><X size={14} /></button>
          </div>
        </header>

        <div className="story-graph-body">
          <aside className="story-graph-palette">
            <small>节点</small>
            {PALETTE.map(kind => (
              <button key={kind} type="button" id={`story-graph-add-${kind}`} className="graph-palette-btn" style={{ '--node-accent': NODE_COLOR[kind] } as React.CSSProperties} onClick={() => addNode(kind)}>
                {(() => { const Icon = NODE_ICON[kind]; return <Icon size={12} style={{ color: NODE_COLOR[kind] }} />; })()} {NODE_LABELS[kind]} <Plus size={11} />
              </button>
            ))}
            <small>入口与出口</small>
            <button type="button" id="story-graph-add-start" className="graph-palette-btn" style={{ '--node-accent': NODE_COLOR.start } as React.CSSProperties} onClick={() => addNode('start')}><i style={{ background: NODE_COLOR.start }} /> 开始 <Plus size={11} /></button>
            <p className="story-graph-tip">按住节点右侧圆点拖到目标节点连线；在空白处拖出框选，Shift+点击加选；拖动任一选中节点可整组移动。Ctrl+C / Ctrl+V 复制粘贴，Delete 删除，Ctrl+滚轮缩放。</p>
          </aside>

          <div className="story-graph-canvas" ref={canvas} onClick={() => { if (linkFrom) setLinkFrom(null); }}
            onPointerDown={event => {
              if ((event.target as HTMLElement).closest('.graph-node, .graph-canvas-tools, .graph-dry')) return;
              const point = pointOnCanvas(event.clientX, event.clientY);
              if (!point) return;
              marqueeStart.current = point;
              setMarquee({ x0: point.x, y0: point.y, x1: point.x, y1: point.y });
              (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              if (!marqueeStart.current) return;
              const point = pointOnCanvas(event.clientX, event.clientY);
              if (!point) return;
              setMarquee({ x0: marqueeStart.current.x, y0: marqueeStart.current.y, x1: point.x, y1: point.y });
            }}
            onPointerUp={() => {
              if (marquee && marqueeStart.current) {
                const left = Math.min(marquee.x0, marquee.x1);
                const right = Math.max(marquee.x0, marquee.x1);
                const top = Math.min(marquee.y0, marquee.y1);
                const bottom = Math.max(marquee.y0, marquee.y1);
                const ids = graph.nodes
                  .filter(item => item.x < right && item.x + NODE_W > left && item.y < bottom && item.y + NODE_H > top)
                  .map(item => item.id);
                setSelection(ids);
                setSelected(ids[0] ?? null);
              }
              marqueeStart.current = null;
              setMarquee(null);
            }}
            onWheel={event => {
            if (!event.ctrlKey) return;
            event.preventDefault();
            setZoom(value => clampZoom(value + (event.deltaY > 0 ? -0.1 : 0.1)));
          }}>
            <div className="graph-canvas-tools" onClick={event => event.stopPropagation()}>
              <button type="button" id="story-graph-zoom-out" onClick={() => setZoom(value => clampZoom(value - 0.1))}>−</button>
              <button type="button" id="story-graph-zoom-reset" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
              <button type="button" id="story-graph-fit" onClick={fitView}>适应</button>
              <button type="button" id="story-graph-zoom-in" onClick={() => setZoom(value => clampZoom(value + 0.1))}>+</button>
              <span />
              <button type="button" id="story-graph-auto-layout" onClick={autoLayout}>自动整理</button>
              <button type="button" id="story-graph-dryrun" onClick={runDry}>试跑</button>
              <button type="button" id="story-graph-beats" onClick={() => setBeatsOpen(value => !value)}>幕概览</button>
            </div>
            <div className="story-graph-world" style={{ width: 1600 * zoom, height: 1000 * zoom }}>
            <div className="story-graph-plane" style={{ width: 1600, height: 1000, transform: `scale(${zoom})` }}>
            <svg className="story-graph-edges" viewBox="0 0 1600 1000" preserveAspectRatio="none">
              <defs>
                <marker id="graph-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                  <path d="M0,0 L9,4.5 L0,9 Z" fill="#f3aec9aa" />
                </marker>
              </defs>
              {graph.edges.map(edge => {
                const from = graph.nodes.find(item => item.id === edge.from);
                const to = graph.nodes.find(item => item.id === edge.to);
                if (!from || !to) return null;
                const x1 = from.x + NODE_W;
                const y1 = portY(from, edge.fromPort);
                const x2 = to.x;
                const y2 = to.y + NODE_H / 2;
                return <path key={edge.id} d={edgePath(x1, y1, x2, y2)} className="graph-edge" markerEnd="url(#graph-arrow)" />;
              })}
              {linking && (() => {
                const from = graph.nodes.find(item => item.id === linking.nodeId);
                if (!from) return null;
                const x1 = from.x + NODE_W;
                const y1 = portY(from, linking.port);
                return <path d={edgePath(x1, y1, linking.x, linking.y)} className="graph-edge linking" />;
              })()}
            </svg>
            {graph.nodes.map(item => (
              <div
                key={item.id}
                id={`story-graph-node-${item.id}`}
                data-node-id={item.id}
                className={`graph-node ${item.kind} ${selection.includes(item.id) ? 'on' : ''} ${item.id === graph.entry ? 'entry' : ''} ${hoverNode === item.id ? 'link-target' : ''}`}
                style={{ left: item.x, top: item.y, width: NODE_W, borderColor: selected === item.id ? NODE_COLOR[item.kind] : undefined, '--node-accent': NODE_COLOR[item.kind] } as React.CSSProperties}
                onClick={event => {
                  event.stopPropagation();
                  if (linkFrom) { connect(linkFrom.nodeId, linkFrom.port, item.id); return; }
                  if (event.shiftKey) {
                    setSelection(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]);
                    setSelected(item.id);
                    return;
                  }
                  setSelection([item.id]);
                  setSelected(item.id);
                }}
                onPointerDown={event => {
                  if ((event.target as HTMLElement).closest('.graph-port')) return;
                  const ids = selection.includes(item.id) ? selection : [item.id];
                  if (!selection.includes(item.id)) { setSelection([item.id]); setSelected(item.id); }
                  const origins: Record<string, { x: number; y: number }> = {};
                  for (const id of ids) {
                    const target = graph.nodes.find(entry => entry.id === id);
                    if (target) origins[id] = { x: target.x, y: target.y };
                  }
                  drag.current = { ids, origins, cx: event.clientX, cy: event.clientY };
                  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                }}
                onPointerMove={event => {
                  const current = drag.current;
                  if (!current || !current.ids.includes(item.id)) return;
                  const dx = (event.clientX - current.cx) / zoom;
                  const dy = (event.clientY - current.cy) / zoom;
                  setGraph(graphNow => ({
                    ...graphNow,
                    nodes: graphNow.nodes.map(entry => {
                      const origin = current.origins[entry.id];
                      if (!origin) return entry;
                      return {
                        ...entry,
                        x: Math.round(Math.max(0, Math.min(1400, origin.x + dx))),
                        y: Math.round(Math.max(0, Math.min(880, origin.y + dy))),
                      };
                    }),
                  }));
                }}
                onPointerUp={() => { drag.current = null; }}
              >
                <header>{(() => { const Icon = NODE_ICON[item.kind]; return <Icon size={11} style={{ color: NODE_COLOR[item.kind] }} />; })()}<span>{NODE_LABELS[item.kind]}</span></header>
                <b>{item.title}</b>
                {(item.data.kind === 'mission' || item.data.kind === 'event') && <em>{item.data.kind === 'mission' ? item.data.spec.title : item.data.hook.slice(0, 24)}</em>}
                {item.data.kind === 'choice' && <em>{item.data.options.length} 个选项</em>}
                {item.kind !== 'start' && (
                  <span className="graph-port in" aria-hidden="true" title="入口：多条连线可以汇入这里" />
                )}
                {portsOf(item).map(port => (
                  <button
                    key={port}
                    type="button"
                    id={`story-graph-port-${item.id}-${port}`}
                    className={`graph-port ${linkFrom?.nodeId === item.id && linkFrom.port === port ? 'active' : ''} ${linking?.nodeId === item.id && linking.port === port ? 'dragging' : ''}`}
                    style={{ top: portY(item, port) - item.y - 6 }}
                    onPointerDown={event => beginLink(event, item, port)}
                    onPointerMove={moveLink}
                    onPointerUp={endLink}
                    title={port === 'out' ? '按住拖到目标节点连线' : `选项 ${port}：拖到目标节点`}
                  />
                ))}
              </div>
            ))}
            </div>
            {marquee && (
              <div className="graph-marquee" style={{
                left: Math.min(marquee.x0, marquee.x1),
                top: Math.min(marquee.y0, marquee.y1),
                width: Math.abs(marquee.x1 - marquee.x0),
                height: Math.abs(marquee.y1 - marquee.y0),
              }} />
            )}
            </div>
            {beatsOpen && (
              <div className="graph-beats" onClick={event => event.stopPropagation()}>
                <header><b>幕概览</b><button type="button" id="story-graph-beats-close" onClick={() => setBeatsOpen(false)}>关闭</button></header>
                <ol>
                  {graph.nodes.filter(item => item.kind === 'scene' || item.kind === 'event').sort((a, b) => a.x - b.x || a.y - b.y).map((item, index) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => { setSelected(item.id); setSelection([item.id]); setBeatsOpen(false); }}>
                        <i>{String(index + 1).padStart(2, '0')}</i>
                        <span>{item.title}</span>
                        <em>{item.kind === 'scene' ? '场景' : '角色事件'}</em>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {dry && (
              <div className="graph-dry" onClick={event => event.stopPropagation()}>
                <header><b>试跑记录</b><button type="button" id="story-graph-dry-close" onClick={() => setDry(null)}>关闭</button></header>
                <ol>
                  {dry.map((step, index) => (
                    <li key={step.id + '-' + index} className={`graph-dry-step ${step.kind}`}><i>{String(index + 1).padStart(2, '0')}</i><span>{step.title}</span><em>{step.kind}</em></li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <aside className="story-graph-inspector">
            {node ? (
              <>
                <small>{NODE_LABELS[node.kind]} · {node.id}</small>
                <label className="graph-field"><span>标题</span>
                  <input id="story-graph-inspect-title" className="av-input" value={node.title} onChange={event => patchNode(node.id, { title: event.target.value.slice(0, 40) })} />
                </label>
                {node.kind === 'start' && <p className="story-graph-tip">入口节点，运行时从这里开始。</p>}
                {node.kind === 'scene' && node.data.kind === 'scene' && (
                  <label className="graph-field"><span>旁白</span>
                    <textarea id="story-graph-inspect-narration" className="av-input" rows={6} value={node.data.narration} onChange={event => patchScene(event.target.value)} />
                  </label>
                )}
                {node.kind === 'event' && node.data.kind === 'event' && (
                  <>
                    <label className="graph-field"><span>事件标题</span>
                      <input className="av-input" value={node.data.title} onChange={event => patchEvent({ title: event.target.value.slice(0, 30) })} />
                    </label>
                    <label className="graph-field"><span>开场钩子</span>
                      <textarea className="av-input" rows={4} value={node.data.hook} onChange={event => patchEvent({ hook: event.target.value })} />
                    </label>
                  </>
                )}
                {node.kind === 'mission' && node.data.kind === 'mission' && (
                  <>
                    <label className="graph-field"><span>委托标题</span>
                      <input className="av-input" value={node.data.spec.title} onChange={event => patchSpec({ title: event.target.value.slice(0, 30) })} />
                    </label>
                    <label className="graph-field"><span>明确目标</span>
                      <textarea className="av-input" rows={3} value={node.data.spec.goal} onChange={event => patchSpec({ goal: event.target.value })} />
                    </label>
                    <div className="graph-row">
                      <label className="graph-field"><span>难度</span>
                        <select className="av-input" value={node.data.spec.difficulty} onChange={event => patchSpec({ difficulty: event.target.value })}>
                          {['简单', '常规', '棘手', '危险'].map(value => <option key={value}>{value}</option>)}
                        </select>
                      </label>
                      <label className="graph-field"><span>时长</span>
                        <input type="number" className="av-input" value={node.data.spec.duration} onChange={event => patchSpec({ duration: Number(event.target.value) || 90 })} />
                      </label>
                    </div>
                  </>
                )}
                {node.kind === 'incident' && node.data.kind === 'incident' && (
                  <>
                    <label className="graph-field"><span>事件标题</span>
                      <input className="av-input" value={node.data.spec.title} onChange={event => patchSpec({ title: event.target.value.slice(0, 30) })} />
                    </label>
                    <label className="graph-field"><span>正文</span>
                      <textarea className="av-input" rows={5} value={node.data.spec.body} onChange={event => patchSpec({ body: event.target.value })} />
                    </label>
                  </>
                )}
                {node.kind === 'opinion' && node.data.kind === 'opinion' && (
                  <>
                    <label className="graph-field"><span>议题标题</span>
                      <input className="av-input" value={node.data.spec.title} onChange={event => patchSpec({ title: event.target.value.slice(0, 30) })} />
                    </label>
                    <label className="graph-field"><span>议题内容</span>
                      <textarea className="av-input" rows={5} value={node.data.spec.text} onChange={event => patchSpec({ text: event.target.value })} />
                    </label>
                  </>
                )}
                {node.kind === 'reward' && node.data.kind === 'reward' && (
                  <div className="graph-row">
                    <label className="graph-field"><span>星砂</span>
                      <input type="number" className="av-input" value={node.data.effect.gold ?? 0} onChange={event => patchReward({ gold: Number(event.target.value) || 0 })} />
                    </label>
                    <label className="graph-field"><span>羁绊</span>
                      <input type="number" className="av-input" value={node.data.effect.bond ?? 0} onChange={event => patchReward({ bond: Number(event.target.value) || 0 })} />
                    </label>
                    <label className="graph-field"><span>侵蚀</span>
                      <input type="number" className="av-input" value={node.data.effect.corruption ?? 0} onChange={event => patchReward({ corruption: Number(event.target.value) || 0 })} />
                    </label>
                  </div>
                )}
                {node.kind === 'choice' && node.data.kind === 'choice' && (
                  <div className="graph-choices">
                    <small>选项</small>
                    {node.data.options.map((option, index) => (
                      <div key={option.id} className="graph-choice-row">
                        <input className="av-input" value={option.label} onChange={event => {
                          const options = node.data.kind === 'choice' ? node.data.options.map((item, at) => (at === index ? { ...item, label: event.target.value.slice(0, 24) } : item)) : [];
                          patchOptions(options);
                        }} />
                        <button type="button" className="btn ghost" onClick={() => {
                          const options = node.data.kind === 'choice' ? node.data.options.filter((_, at) => at !== index) : [];
                          patchOptions(options);
                          setGraph(current => ({ ...current, edges: current.edges.filter(edge => !(edge.from === node.id && edge.fromPort === option.id)) }));
                        }}><Trash2 size={12} /></button>
                      </div>
                    ))}
                    <button type="button" className="btn ghost" onClick={() => {
                      if (node.data.kind !== 'choice') return;
                      const id = `o${node.data.options.length + 1}`;
                      patchOptions([...node.data.options, { id, label: `选项 ${node.data.options.length + 1}` }]);
                    }}><Plus size={12} /> 加一个选项</button>
                  </div>
                )}
                {node.kind === 'wait' && node.data.kind === 'wait' && (
                  <div className="graph-row">
                    <label className="graph-field"><span>天数</span>
                      <input type="number" className="av-input" value={node.data.days ?? 0} onChange={event => patchWait({ days: Number(event.target.value) || 0 })} />
                    </label>
                    <label className="graph-field"><span>分钟</span>
                      <input type="number" className="av-input" value={node.data.minutes ?? 0} onChange={event => patchWait({ minutes: Number(event.target.value) || 0 })} />
                    </label>
                  </div>
                )}
                {node.kind === 'end' && node.data.kind === 'end' && (
                  <label className="graph-field"><span>收束语</span>
                    <textarea className="av-input" rows={4} value={node.data.summary ?? ''} onChange={event => patchEnd(event.target.value)} />
                  </label>
                )}
                <div className="graph-node-actions">
                  <button type="button" className="btn ghost" onClick={() => { setGraph(current => ({ ...current, entry: node.id })); setSelected(node.id); }} disabled={node.kind !== 'start'}>设为入口</button>
                  <button type="button" className="btn ghost" id="story-graph-delete" onClick={removeSelected} disabled={node.kind === 'start'}><Trash2 size={12} /> 删除节点</button>
                </div>
                <small>出边</small>
                <div className="graph-edges-list">
                  {graph.edges.filter(edge => edge.from === node.id).map(edge => (
                    <div key={edge.id} className="graph-edge-row">
                      <span>{edge.fromPort === 'out' ? '默认' : edge.fromPort}
                        <ArrowRight size={11} />
                        {graph.nodes.find(item => item.id === edge.to)?.title ?? edge.to}
                      </span>
                      <button type="button" className="btn ghost" onClick={() => setGraph(current => ({ ...current, edges: current.edges.filter(item => item.id !== edge.id) }))}><X size={11} /></button>
                    </div>
                  ))}
                  {!graph.edges.some(edge => edge.from === node.id) && node.kind !== 'end' && <p className="story-graph-tip">还没有出边，运行会在这里停住。</p>}
                </div>
              </>
            ) : <p className="story-graph-tip">选一个节点开始编辑。</p>}
          </aside>
        </div>

        {issuesOpen && (
          <footer className="story-graph-issues">
            {issues.length ? issues.map((issue, index) => <p key={index} className={issue.level}>{issue.message}</p>) : <p className="ok">图是通的，可以试跑。</p>}
          </footer>
        )}
      </div>
    </div>
  );
}
