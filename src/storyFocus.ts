/**
 * 一段剧情的「主角」是谁。
 *
 * 宏 \`{{heroine}}\` / \`{{history.*}}\` 都靠 \`MacroContext.focus\` 取人；漏传这个参数，
 * 提示词里就会出现「（本任务没有指定主角）」——角色剧情这一条链路就漏了。
 * 这里把「从 event 推主角」收敛成一个函数，三个生成器共用同一套判定。
 */
import type { CharacterEvent, GameState, Girl } from './types.ts';

export function focusGirlOf(state: GameState, event: CharacterEvent): Girl | undefined {
  const pool = [...(state.girls ?? []), ...(state.candidates ?? [])];
  const byOwner = event.girlId ? pool.find(girl => girl.id === event.girlId) : undefined;
  if (byOwner) return byOwner;
  const castId = (event.cast ?? []).find(id => id !== 'player');
  if (castId) {
    const byCast = pool.find(girl => girl.id === castId);
    if (byCast) return byCast;
  }
  return pool.find(girl => !girl.dead && !girl.retired);
}
