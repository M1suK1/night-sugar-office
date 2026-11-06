/**
 * 一段剧情的「主角」是谁。
 *
 * 宏 `{{heroine}}` / `{{history.*}}` 都靠 `MacroContext.focus` 取人；漏传这个参数，
 * 提示词里就会出现「（本任务没有指定主角）」——角色剧情这一条链路就漏了。
 *
 * v121：主角不再只从契约者与候选里找。三方名册里的首领与随从也会站出来说话
 * （「登门拜访首领」这条事件就是这样），所以判定统一走 `storyPersonOf`。
 */
import type { CharacterEvent, GameState, Girl } from './types.ts';
import { storyFocusOf, storyPersonOf, type StoryPerson } from './storySubject.ts';

export function focusGirlOf(state: GameState, event: CharacterEvent): Girl | undefined {
  const person = storyFocusOf(state, event);
  if (person) return person.girl;
  const pool = [...(state.girls ?? []), ...(state.candidates ?? [])];
  return pool.find(girl => !girl.dead && !girl.retired);
}

/** 主角在名册里的位置（「月蚀庭首领」）；契约者与兜底都没有。 */
export function focusRoleOf(state: GameState, event: CharacterEvent): string | undefined {
  return storyFocusOf(state, event)?.role;
}

/** 事件里那个人的完整身份（含名册投影），给需要角色说明的调用方用。 */
export function personOfEvent(state: GameState, event: CharacterEvent): StoryPerson | undefined {
  return storyFocusOf(state, event) ?? storyPersonOf(state, event.girlId);
}
