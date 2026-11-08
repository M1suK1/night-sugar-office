import { loadBalance } from '../balance.ts';
import type { GameState, Girl } from '../types.ts';
import { dateLabel } from './core.ts';

/**
 * 魔女出勤的关系代价（v200）。
 *
 * 她的魔女形态本身就在队伍里投下阴影：每个非魔女队员对她的同伴关系各扣一次。
 * 关系夹在 0–100；数值面板把 `witchSquadRelation` 调成 0 就等于关掉这条规则。
 */
export function applyWitchSquadRelation(state: GameState, squad: readonly Girl[]): void {
  const witches = squad.filter(girl => girl.witch && !girl.dead);
  if (!witches.length) return;
  const amount = Math.abs(Math.round(loadBalance().witchSquadRelation));
  if (!amount) return;
  let touched = 0;
  for (const girl of squad) {
    if (girl.witch || girl.dead) continue;
    for (const witch of witches) {
      const current = girl.relationships[witch.id] ?? 40;
      const next = Math.max(0, Math.min(100, current - amount));
      if (next === current) continue;
      girl.relationships[witch.id] = next;
      touched += 1;
    }
  }
  if (!touched) return;
  state.logs.unshift({
    id: `log-witch-squad-${state.day}-${state.minutes}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'relationship',
    text: `${witches.map(witch => witch.name).join('、')}以魔女形态出勤，队伍里没人敢靠得太近：同伴关系 −${amount}。`,
  });
}
