import type { CharacterEvent, GameState, Storyline } from '../types.ts';

/** 蓝图里正在等人的那个 choice 节点。 */
export interface PendingChoice {
  storylineId: string;
  nodeId: string;
  title: string;
  options: { id: string; label: string }[];
}

/** 这位少女的蓝图是否卡在选项上；没有就返回 undefined。 */
export function pendingChoiceOf(state: GameState, girlId: string): PendingChoice | undefined {
  const story = state.storylines.find(item => item.girlId === girlId && item.status === 'active');
  return pendingChoiceIn(story);
}

/** 阶段委托 success/out 后第一个剧情事件的 cast；只穿过 reward 与 0 时长 wait。 */
export function storyCastAfterMission(story: Storyline, nodeId: string, state: GameState): string[] | undefined {
  const graph = story.graph;
  if (!graph) return undefined;
  const first = graph.edges.find(item => item.from === nodeId && item.fromPort === 'success')
    ?? graph.edges.find(item => item.from === nodeId && item.fromPort === 'out');
  let cursor = first?.to;
  for (let guard = 0; guard < 16 && cursor; guard += 1) {
    const node = graph.nodes.find(item => item.id === cursor);
    if (!node) return undefined;
    if (node.kind === 'event') {
      const cast = node.data.kind === 'event' && node.data.cast?.length ? node.data.cast : [story.girlId];
      const known = [...new Set(cast)].filter(id => state.girls.some(girl => girl.id === id && !girl.dead && !girl.retired && !girl.left));
      return known.length ? known.slice(0, 3) : undefined;
    }
    const zeroWait = node.kind === 'wait' && node.data.kind === 'wait'
      && ((node.data.days ?? 0) * 1440 + (node.data.minutes ?? 0)) <= 0;
    if (node.kind !== 'reward' && node.kind !== 'start' && !zeroWait) return undefined;
    cursor = graph.edges.find(item => item.from === node.id && item.fromPort === 'out')?.to;
  }
  return undefined;
}

export function pendingChoiceIn(story: Storyline | undefined): PendingChoice | undefined {
  if (!story?.graph || !story.run) return undefined;
  const waiting = story.run.waiting;
  if (waiting?.kind !== 'choice') return undefined;
  const node = story.graph.nodes.find(item => item.id === waiting.ref);
  if (!node || node.kind !== 'choice' || node.data.kind !== 'choice') return undefined;
  const options = node.data.options.map(option => ({ id: option.id, label: option.label })).slice(0, 4);
  if (!options.length) return undefined;
  return { storylineId: story.id, nodeId: node.id, title: node.title || '这一步', options };
}
/** 这段剧情收尾后蓝图会停在哪个 choice；中间只穿过 reward 与 0 时长 wait。 */
export function nextChoiceAfterEvent(story: Storyline | undefined, event: CharacterEvent): PendingChoice | undefined {
  const graph = story?.graph;
  if (!graph || !event.storyNodeId) return undefined;
  const next = (from: string) => graph.edges.find(edge => edge.from === from && edge.fromPort === 'out')?.to;
  let cursor = next(event.storyNodeId);
  for (let guard = 0; guard < 32 && cursor; guard += 1) {
    const node = graph.nodes.find(item => item.id === cursor);
    if (!node) return undefined;
    if (node.kind === 'choice' && node.data.kind === 'choice') {
      const options = node.data.options.map(option => ({ id: option.id, label: option.label })).slice(0, 4);
      return options.length ? { storylineId: story.id, nodeId: node.id, title: node.title || '这一步', options } : undefined;
    }
    const zeroWait = node.kind === 'wait' && node.data.kind === 'wait'
      && ((node.data.days ?? 0) * 1440 + (node.data.minutes ?? 0)) <= 0;
    if (node.kind !== 'reward' && node.kind !== 'start' && !zeroWait) return undefined;
    cursor = next(node.id);
  }
  return undefined;
}
