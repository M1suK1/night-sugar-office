import type { GameState, Storyline } from '../types.ts';

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
