import { districtAt, districtOfMission } from '../districts.ts';
import { recordMissionRun } from '../missionHistory.ts';
import { investigationExp } from '../progression.ts';
import { applyPollutionRelief, applySettleEnvironment, applyWitchBounty, grantTemplateRewards, maybeQueueWhisper } from '../rules/battle.ts';
import { addCorruption, gainTrait } from '../rules/conditions.ts';
import { book, dateLabel, grantExpWithNotice, hashText, pushNotice, shiftTerritory } from '../rules/core.ts';
import { makeOpinion } from '../rules/opinion.ts';
import { squadChance } from '../rules/roster.ts';
import { completeStoryMission } from '../rules/storyRun.ts';
import type { GameState, Girl, Mission } from '../types.ts';
// v35 从 src/game.ts 拆出：调查委托的结算。

export function settleInvestigation(state: GameState, mission: Mission, squad: Girl[], at: { day: number; minutes: number }): void {
  const success = squadChance(squad, mission) >= 50 && Math.max(...squad.map(g => g.stats[mission.requirement])) + (squad.length - 1) * 4 >= mission.target;
  const region = districtOfMission(mission);
  mission.attempts += 1;
  if (success) {
    state.gold += mission.reward;
    state.reputation = Math.min(100, state.reputation + 1 + (region.effect.reputationFlat ?? 0));
    book(state, at.day, mission.reward);
    state.completed.push(mission.id);
    mission.status = 'done';
    mission.completedDay = at.day;
    completeStoryMission(state, mission);
    grantTemplateRewards(state, mission, at);
    state.logs.unshift({ id: `log-inv-${mission.id}-${mission.attempts}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `调查完成：${mission.title}。${squad.map(g => g.name).join('、')}带回了可以写进档案的答案。${region.name}的环境让这次行动${region.effect.rewardPct && region.effect.rewardPct > 0 ? '额外顺利' : '格外磨人'}。`, delta: mission.reward });
    pushNotice(state, { kind: 'mission', day: at.day, minutes: at.minutes, missionId: mission.id, title: `调查完成 · ${mission.title}`, text: `${squad.map(girl => girl.name).join('、')}带回了答案，报酬 ${mission.reward} 星砂。` });
    for (const girl of squad) {
      grantExpWithNotice(state, girl, investigationExp(mission.recommendedLevel));
      girl.bond = Math.min(100, girl.bond + 1);
      girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 15));
      girl.contractEndDay += mission.attempts % 2 === 0 ? 1 : 0;
      gainTrait(state, girl, mission.title, 0.3);
    }
    const corrupt = mission.environment?.corruptionFlat ?? 0;
    if (corrupt) for (const girl of squad) addCorruption(state, girl, corrupt);
    applySettleEnvironment(state, mission, squad);
    applyPollutionRelief(state, mission, 'win');
    if (mission.faction && mission.district) shiftTerritory(state, mission.district, mission.faction, '阵营委托完成');
    if (mission.faction === 'witch') applyWitchBounty(state);
    if (hashText(`${mission.id}:${state.day}`) % 100 < 22) {
      const author = squad[0];
      if (author) state.opinions.unshift(makeOpinion(state, author, '城市', '关于下一次调查的路线', '她想把糖果街和旧钟楼的线索并在一起看。', '申请一次不消耗星砂的线索整理时间。'));
    }
  } else {
    mission.status = 'open';
    mission.squad = [];
    mission.girlId = undefined;
    book(state, at.day, 0);
    state.logs.unshift({ id: `log-inv-fail-${mission.id}-${mission.attempts}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `调查受阻：${mission.title}。线索不足，委托仍在事件池中。${region.name}的环境让线索更难拼合。` });
    for (const girl of squad) girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 10));
    const lost = mission.environment?.corruptionFlat ?? 0;
    if (lost) for (const girl of squad) addCorruption(state, girl, lost);
    applySettleEnvironment(state, mission, squad);
    applyPollutionRelief(state, mission, 'loss');
  }
  maybeQueueWhisper(state, mission, squad.filter(girl => !girl.dead), success ? 'success' : 'failure');
  recordMissionRun(state, {
    id: `mission:${mission.id}:${at.day}:${at.minutes}:${mission.attempts}`,
    missionId: mission.id, title: mission.title, work: mission.work, category: mission.category,
    district: mission.district ?? districtAt(mission.x, mission.y),
    day: at.day, minutes: at.minutes, girlIds: squad.map(girl => girl.id),
    outcome: success ? 'success' : 'failure', reward: success ? mission.reward : 0,
  });
  for (const girl of squad) {
    girl.status = 'idle'; girl.remaining = 0; girl.missionId = undefined;
  }
  if (success) { mission.squad = []; mission.girlId = undefined; }
}
