import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/game.ts';

/**
 * v35 拆分护栏：game.ts 的运行时导出名一个都不能少、不能多。
 * 新增/删除导出时请同步改这份快照，并在提交信息里说明原因。
 */
const EXPECTED = [
  'DRUG_STABILITY_COST', 'DRUG_STOCK_MAX', 'MAX_DUEL_SIDE', 'SAVE_KEY', 'STORY_SESSION_TURNS', 'WARDROBE_LIMIT', 'act',
  'advanceStoryGraph', 'annotateMission', 'applyIncidentEffect', 'applyStoryEffect',
  'buildCost', 'buildTemplateArc', 'buildTemplateStoryline', 'canAcceptGeneratedContent',
  'capacity', 'chance', 'clinicCost', 'clinicLevel', 'clinicQuote', 'clock', 'completeStoryMission', 'createBlankState',
  'createInitialFromPack', 'createInitialState', 'customOutfitFor', 'dateLabel',
  'deployIncidentCard', 'deployMissionTemplate', 'districtPin', 'drugDaysLeft', 'duelOpponents', 'eliteChance',
  'ensureMissionPools', 'ensureMonsterPool', 'factionStanding', 'finishStoryEvent',
  'fireStoryTrigger', 'grantExpWithNotice', 'importState', 'inWithdrawal', 'interceptionFor', 'interceptionSquadSize',
  'itemPrice', 'loadState', 'makeFactionStock', 'makeMarketStock', 'makeRuleIncident',
  'marketPool', 'marketSlots', 'marketUpgrade', 'marketWindow', 'missionDeadlineLabel',
  'missionKey', 'missionKeyTaken', 'missionTemplates', 'missionVisibleOnMap', 'opinionLimit',
  'pickPoolIncidentCard', 'planToStoryline', 'previewFactionTask', 'pushNotice',
  'relationshipStage', 'resolveStoryWait', 'rollEnemies', 'seatedGirls', 'seatsTaken',
  'shiftTerritory', 'spawnStoryBeat', 'squadChance', 'squadLimit', 'squadLimitFor', 'stageHints', 'stageLabels',
  'startStoryGraph', 'statLabels', 'statusLabels', 'storyMissionForBeat', 'syncShift',
  'treatmentFor', 'trimMissionPools', 'trimOpinions', 'validBattleNote', 'witchOutfitFor',
  'workDescriptions', 'workLabels',
].sort();

test('v35 game.ts 的对外导出名保持不变', () => {
  assert.deepEqual(Object.keys(game).sort(), EXPECTED);
});
