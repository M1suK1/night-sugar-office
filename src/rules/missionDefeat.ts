/**
 * 战斗失败的结算（v167 从 battle.ts 拆出）。
 *
 * 拆出来的原因有两个：`battle.ts` 已经贴到 450 行上限；而且失败代价这一块
 * 现在有一整套自己的规则（违约金、额外好感、当天停单），值得单独放。
 */
import { loadBalance } from '../balance.ts';
import { applyHostility, pairOf } from '../hostility.ts';
import { failurePenaltyFor, failurePenaltyText } from '../missionPenalty.ts';
import type { BattleState, GameState, Mission } from '../types.ts';
import { book, dateLabel, pushNotice } from './core.ts';
import { failStoryMission } from './storyRun.ts';

/** 打输了：赔违约金、掉好感与安定，委托回池（故事线则转向失败分支）。 */
export function settleDefeat(state: GameState, mission: Mission, battle: BattleState, at: { day: number; minutes: number }): void {
  state.reputation = Math.max(0, state.reputation - 3);
  const rules = loadBalance();
  const penalty = failurePenaltyFor(state, mission, rules);
  if (penalty.gold > 0) {
    state.gold = Math.max(0, state.gold - penalty.gold);
    book(state, at.day, -penalty.gold);
  } else {
    book(state, at.day, 0);
  }
  if (mission.envoyKind === 'coop' && mission.envoyFaction) {
    state.factions[mission.envoyFaction].standing = Math.max(0, state.factions[mission.envoyFaction].standing - rules.envoyCoopStandingLoss);
  } else if (mission.envoyKind === 'raid' && mission.envoyFaction) {
    // 打输了：对方没吃亏，但两家的火气照样往上走，城市安定再掉一点。
    const target = mission.envoyTarget;
    const pair = target ? pairOf(mission.envoyFaction, target) : undefined;
    if (pair) applyHostility(state, [{ pair, delta: rules.envoyRaidFailureHostility, reason: '他们查到了是谁动的手' }]);
    state.reputation = Math.max(0, state.reputation - 1);
  } else if (mission.faction) {
    state.factions[mission.faction].standing = Math.max(0, state.factions[mission.faction].standing - 3);
  }
  for (const entry of penalty.standing) {
    state.factions[entry.faction].standing = Math.max(0, state.factions[entry.faction].standing - entry.amount);
    // 拿了他的任务书却没办成：今天不再出单，等到换日。
    state.factions[entry.faction].envoyTaskId = state.factions[entry.faction].envoyTaskId ?? `failed-${entry.faction}-${at.day}`;
  }
  mission.squad = [];
  mission.girlId = undefined;
  if (mission.storylineId) {
    mission.status = 'expired';
    failStoryMission(state, mission, '战斗失败');
  } else {
    mission.status = 'open';
  }
  const penaltyNote = failurePenaltyText(penalty);
  state.logs.unshift({
    id: `log-lose-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle',
    text: `战斗失败：${mission.title}。${penaltyNote}${mission.storylineId ? '故事线因此转向失败分支。' : '全员失去行动能力，委托仍留在事件池中。'}`,
    ...(penalty.gold > 0 ? { delta: -penalty.gold } : {}),
  });
  pushNotice(state, {
    kind: 'mission', day: at.day, minutes: at.minutes, missionId: mission.id,
    title: `委托失败 · ${mission.title}`,
    text: `这一单没办成。${penaltyNote}`,
  });
}
