import type { CharacterEvent } from './types.ts';

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
