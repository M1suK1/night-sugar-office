import type { CharacterEvent, Expression, StoryTurn } from './types.ts';

/**
 * 交互剧情是否该由界面自动开场（v186）。
 *
 * 两条入口：
 * - 玩家已经写下开场（playerSeed 有值，空串也算「按引子开始」）；
 * - 蓝图节点自带开场白（opening 非空）——没有玩家 seed 也直接按它开演。
 *
 * 约谈 / 会议没有开场白，仍停在「等玩家先写」那一步。
 */
export function shouldAutoOpenStory(event: CharacterEvent): boolean {
  if (event.status !== 'active') return false;
  if (event.mode !== 'session') return false;
  if ((event.turns?.length ?? 0) > 0) return false;
  return event.playerSeed !== undefined || Boolean(event.opening?.trim());
}

/**
 * 读到哪一轮，场上就该是谁的哪张脸（v190）。
 *
 * 原文视图以前只取「整段最后一句」的表情，于是一打开回看，所有人就顶着结局的表情；
 * 舞台视图按节拍算，没有这个问题。这里按阅读位置取：从当前轮往回找最后一句非玩家台词，
 * 找不到就交给默认表情，不猜。
 */
export function expressionAtTurn(turns: readonly StoryTurn[], turnId?: string): { id: string; expression: Expression } | null {
  const at = turnId ? turns.findIndex(turn => turn.id === turnId) : -1;
  for (let index = at < 0 ? turns.length - 1 : at; index >= 0; index -= 1) {
    const lines = turns[index]?.lines ?? [];
    const line = lines[lines.length - 1];
    if (line && line.speakerId !== 'player') return { id: line.speakerId, expression: line.expression };
  }
  return null;
}
