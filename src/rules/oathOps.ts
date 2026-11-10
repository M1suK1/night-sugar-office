/**
 * 誓约（v231）：羁绊满 100 后，花 1000 星砂买一枚戒指，与所长缔结誓约。
 *
 * 誓约本身不占时间；婚礼走议会厅的会议系统（见 meetingOps），费用与时长同会议。
 */
import { book, clone, dateLabel, findGirl } from './core.ts';
import type { ActionResult, GameAction, GameState, Girl } from '../types.ts';

/** 戒指价格：缔结誓约的一次性开销。 */
export const OATH_RING_COST = 1000;
/** 缔结誓约需要的羁绊。 */
export const OATH_BOND = 100;

/** 当前能不能誓约；能就返回 undefined，不能返回一句给玩家看的原因。 */
export function oathBlockedReason(state: GameState, girl: Girl): string | undefined {
  if (girl.dead || girl.left) return '她已经不在事务所了。';
  if (girl.retired) return '她已转任文职，不再缔结誓约。';
  if (girl.oath) return `你们已经在第 ${girl.oath.day} 日缔结了誓约。`;
  if (girl.bond < OATH_BOND) return `羁绊还差 ${OATH_BOND - girl.bond} 点。`;
  if (state.gold < OATH_RING_COST) return `买戒指需要 ${OATH_RING_COST} 星砂，手头只有 ${state.gold}。`;
  return undefined;
}

/** 缔结誓约：扣戒指钱，记下日期，写日志。 */
export function applyOath(state: GameState, action: Extract<GameAction, { type: 'oath' }>): ActionResult {
  const next = clone(state);
  const girl = findGirl(next, action.girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  const blocked = oathBlockedReason(next, girl);
  if (blocked) return { state, ok: false, message: blocked };

  const at = dateLabel(next.day, next.minutes);
  next.gold -= OATH_RING_COST;
  book(next, next.day, -OATH_RING_COST);
  girl.oath = { day: next.day, at };
  next.logs.unshift({
    id: `log-oath-${girl.id}-${Date.now()}`,
    time: at,
    kind: 'relationship',
    text: `${girl.name}与所长交换了戒指，缔结誓约（-${OATH_RING_COST} 星砂）。`,
    delta: -OATH_RING_COST,
  });
  return { state: next, ok: true, message: `你与${girl.name}缔结了誓约。可以在议会厅的「组织会议」里举办婚礼。` };
}
