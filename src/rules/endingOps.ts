import { loadBalance } from '../balance.ts';
import { archive, clone, dateLabel } from './core.ts';
import type { ActionResult, EndingRecord, GameAction, GameState } from '../types.ts';

/** v206：完成离城结局。只记录，不扣星砂、不锁档。 */
export function applyFinishEnding(state: GameState, action: Extract<GameAction, { type: 'finishEnding' }>): ActionResult {
  if (action.endingId !== 'leave') return { state, ok: false, message: '这个结局还没有开放。' };
  const next = clone(state);
  if ((next.endings ?? []).some(record => record.id === 'leave')) return { state, ok: false, message: '这一局已经收束过了。' };

  const target = Math.max(1, Math.round(loadBalance().endingLeaveGold));
  if (next.gold < target) return { state, ok: false, message: `还差 ${(target - next.gold).toLocaleString('en-US')} 星砂才能离开樱雾市。` };

  const record: EndingRecord = {
    id: 'leave',
    day: next.day,
    at: dateLabel(next.day, next.minutes),
    gold: next.gold,
    reputation: next.reputation,
    girls: next.girls.filter(girl => !girl.dead && !girl.retired && !girl.left).length,
  };
  next.endings = [record, ...(next.endings ?? [])].slice(0, 3);
  archive(next, '事件', '离开樱雾市', `第 ${next.day} 日，事务所关灯，钥匙留在桌上；她带着 ${record.gold.toLocaleString('en-US')} 星砂离开了樱雾市。`);
  next.logs.unshift({
    id: `log-ending-leave-${next.day}-${next.minutes}`,
    time: dateLabel(next.day, next.minutes),
    kind: 'story',
    text: `「离城」已经记下：${record.gold.toLocaleString('en-US')} 星砂，第 ${record.day} 日离开樱雾市。`,
  });
  return { state: next, ok: true, message: '结局已记下：离开樱雾市。' };
}
