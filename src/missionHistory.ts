import type { BattleState, GameState, MissionRun, WorkKind } from './types.ts';

const MAX_RUNS = 120;

function battleOutcome(battle: BattleState): MissionRun['outcome'] {
  return battle.outcome ?? 'draw';
}

/** 旧存档没有 missionRuns 时，至少从战报里把战斗部分补出来。 */
function derivedFromBattles(state: GameState): MissionRun[] {
  return (state.battles ?? []).flatMap(battle => {
    if (!battle.missionId) return [];
    const mission = state.missions.find(entry => entry.id === battle.missionId);
    const girlIds = battle.units
      .filter(unit => unit.side === 'ally' && unit.uid.startsWith('ally-'))
      .map(unit => unit.uid.slice('ally-'.length))
      .filter(Boolean);
    if (!girlIds.length) return [];
    return [{
      id: `battle:${battle.id}`,
      missionId: battle.missionId,
      title: mission?.title ?? battle.missionTitle,
      work: (mission?.work ?? 'combat') as WorkKind,
      category: mission?.category ?? '战斗',
      district: mission?.district,
      day: battle.startedAt.day,
      minutes: battle.startedAt.minutes,
      girlIds,
      outcome: battleOutcome(battle),
      reward: battle.rewards?.gold ?? 0,
      battleId: battle.id,
    }];
  });
}

/** 她参与过的委托，新的在前；记录表为空时回退到战报。 */
export function missionRunsOf(state: GameState, girlId: string): MissionRun[] {
  const recorded = Array.isArray(state.missionRuns) ? state.missionRuns : [];
  const battleIds = new Set(recorded.map(run => run.battleId).filter(Boolean));
  const derived = recorded.length ? derivedFromBattles(state).filter(run => !battleIds.has(run.battleId)) : derivedFromBattles(state);
  return [...recorded, ...derived]
    .filter(run => run.girlIds.includes(girlId))
    .sort((a, b) => b.day * 1440 + b.minutes - (a.day * 1440 + a.minutes));
}

export function recentMissionRuns(state: GameState, girlId: string, limit = 4): MissionRun[] {
  return missionRunsOf(state, girlId).slice(0, Math.max(0, limit));
}

/** 结算时写一条；同一场只写一次，最多保留最近 120 条。 */
export function recordMissionRun(state: GameState, run: MissionRun): void {
  const runs = Array.isArray(state.missionRuns) ? state.missionRuns : [];
  if (runs.some(entry => entry.id === run.id)) return;
  state.missionRuns = [run, ...runs].slice(0, MAX_RUNS);
}
