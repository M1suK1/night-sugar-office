// v35 从 src/game.ts 拆出：动作调度器。每个 case 只做一次委托。
import { applyDebugContractCard, applyDebugGirl, applyDebugRemoveGirl } from './debugOps.ts';
import {
  applyAddCharacterEvent, applyAddStoryline, applyAdvanceEvent, applyAdvanceStoryline,
  applyAppendStoryTurn, applyBeginStoryEvent, applyChooseStoryPassage, applyChooseStoryPort,
  applyDecideStoryChoice, applyChooseStoryOption, applyFinishStorySession, applyReplaceStoryTurn, applyResolveEvent,
  applySetStoryPlan, applyStartCharacterEvent, applyStartStorySession, applyStartStoryline,
} from './storyOps.ts';
import {
  applyAcceptFactionTask, applyAdvancedRecruit, applyBorrowStability, applyCreateGirl, applyImportCard,
  applyImportCards, applyRefillMarket, applyUpgradeMarket,
} from './cardOps.ts';
import {
  applyBuyItem, applyEquipItem, applyUnequipItem, applyUseItem,
} from './itemOps.ts';
import {
  applyAllocateStat, applyAllocateStats, applyBuild, applyChangeOutfit, applyClearWitchForm, applySuppressWitch,
  applyDeleteVariant, applyImportWardrobe, applyRemoveOutfit, applyRenameOutfit,
  applySetExpression, applySetLevelUpMode, applySetOutfitDescription, applySetPersonality, applySetPortrait, applySetProfileText,
  applySetVariant, applySetVariants, applySetWitchForm,
} from './growthOps.ts';
import {
  applyAddGeneratedContent, applyAddIncident, applyDecideOpinion, applyDeleteBattleNote,
  applyDeleteCandidate, applyDeleteMission, applyDeleteMonster, applyJoinFront,
  applyMergeIncidentPool, applyResolveIncident, applySaveBattleNote, applySetPoolLimit,
} from './factionOps.ts';
import { applyAssignFactionRoster } from './rosterOps.ts';
import {
  applyClinic, applyHire, applyHireLeader, applyOpeningFill,
  applyRecallExpedition, applyRehire, applyRenewContract, applyRetire,
  applySeenPrologue, applySetAssistant, applySetOfficeProfile, applySetStarters,
  applyStartExpedition,
} from './rosterOps.ts';
import {
  applyAddWhisper, applyDropWhisper, applyMarkWhispersRead, applySetCityNews, care,
  dispatch, talk,
} from './dailyOps.ts';
import {
  advance, endNight,
} from './time.ts';
import {
  createBlankState, createInitialState,
} from './state.ts';
import type { ActionResult, GameAction, GameState } from '../types.ts';

export function act(state: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'reset': {
      const next = action.mode === 'blank' ? createBlankState() : createInitialState(undefined, undefined, { roster: action.roster ?? 'seed' });
      return { state: next, ok: true, message: action.mode === 'blank' ? '空白档案已建立：只有会客厅与启动资金。' : action.roster === 'empty' ? '进度已重置，名册留空等卡库补人。' : '进度已重置。' };
    }
    case 'advance': return advance(state, action.minutes);
    case 'dispatch': return dispatch(state, action.girlIds, action.missionId);
    case 'care': return care(state, action.girlId, action.mode);
    case 'talk': return talk(state, action.girlId, action.text, action.remote, action.reply);
    case 'markWhispersRead': return applyMarkWhispersRead(state, action);
    case 'addWhisper': return applyAddWhisper(state, action);
    case 'dropWhisper': return applyDropWhisper(state, action);
    case 'renewContract': return applyRenewContract(state, action);
    case 'rehire': return applyRehire(state, action);
    case 'setAssistant': return applySetAssistant(state, action);
    case 'seenPrologue': return applySeenPrologue(state, action);
    case 'openingFill': return applyOpeningFill(state, action);
    case 'setStarters': return applySetStarters(state, action);
    case 'hireLeader': return applyHireLeader(state, action);
    case 'setOfficeProfile': return applySetOfficeProfile(state, action);
    case 'decideOpinion': return applyDecideOpinion(state, action);
    case 'startExpedition': return applyStartExpedition(state, action);
    case 'recallExpedition': return applyRecallExpedition(state, action);
    case 'clinic': return applyClinic(state, action);
    case 'hire': return applyHire(state, action);
    case 'build': return applyBuild(state, action);
    case 'retire': return applyRetire(state, action);
    case 'changeOutfit': return applyChangeOutfit(state, action);
    case 'setExpression': return applySetExpression(state, action);
    case 'setProfileText': return applySetProfileText(state, action);
    case 'setPortrait': return applySetPortrait(state, action);
    case 'setPersonality': return applySetPersonality(state, action);
    case 'allocateStat': return applyAllocateStat(state, action);
    case 'allocateStats': return applyAllocateStats(state, action);
    case 'setLevelUpMode': return applySetLevelUpMode(state, action);
    case 'endNight': return endNight(state);
    case 'importWardrobe': return applyImportWardrobe(state, action);
    case 'removeOutfit': return applyRemoveOutfit(state, action);
    case 'renameOutfit': return applyRenameOutfit(state, action);
    case 'buyItem': return applyBuyItem(state, action);
    case 'equipItem': return applyEquipItem(state, action);
    case 'unequipItem': return applyUnequipItem(state, action);
    case 'useItem': return applyUseItem(state, action);
    case 'acceptFactionTask': return applyAcceptFactionTask(state, action);
    case 'borrowStability': return applyBorrowStability(state, action);
    case 'assignFactionRoster': return applyAssignFactionRoster(state, action);
    case 'debugGirl': return applyDebugGirl(state, action);
    case 'debugContractCard': return applyDebugContractCard(state, action);
    case 'debugRemoveGirl': return applyDebugRemoveGirl(state, action);
    case 'upgradeMarket': return applyUpgradeMarket(state, action);
    case 'advancedRecruit': return applyAdvancedRecruit(state, action);
    case 'importCard': return applyImportCard(state, action);
    case 'importCards': return applyImportCards(state, action);
    case 'refillMarket': return applyRefillMarket(state, action);
    case 'createGirl': return applyCreateGirl(state, action);
    case 'setVariant': return applySetVariant(state, action);
    case 'setVariants': return applySetVariants(state, action);
    case 'deleteVariant': return applyDeleteVariant(state, action);
    case 'setOutfitDescription': return applySetOutfitDescription(state, action);
    case 'setWitchForm': return applySetWitchForm(state, action);
    case 'clearWitchForm': return applyClearWitchForm(state, action);
    case 'suppressWitch': return applySuppressWitch(state, action);
    case 'mergeIncidentPool': return applyMergeIncidentPool(state, action);
    case 'addIncident': return applyAddIncident(state, action);
    case 'joinFront': return applyJoinFront(state, action);
    case 'resolveIncident': return applyResolveIncident(state, action);
    case 'startStoryline': return applyStartStoryline(state, action);
    case 'setStoryPlan': return applySetStoryPlan(state, action);
    case 'addStoryline': return applyAddStoryline(state, action);
    case 'decideStoryChoice': return applyDecideStoryChoice(state, action);
    case 'advanceStoryline': return applyAdvanceStoryline(state, action);
    case 'addCharacterEvent': return applyAddCharacterEvent(state, action);
    case 'startCharacterEvent': return applyStartCharacterEvent(state, action);
    case 'advanceEvent': return applyAdvanceEvent(state, action);
    case 'beginStoryEvent': return applyBeginStoryEvent(state, action);
    case 'startStorySession': return applyStartStorySession(state, action);
    case 'appendStoryTurn': return applyAppendStoryTurn(state, action);
    case 'replaceStoryTurn': return applyReplaceStoryTurn(state, action);
    case 'finishStorySession': return applyFinishStorySession(state, action);
    case 'chooseStoryOption': return applyChooseStoryOption(state, action);
    case 'chooseStoryPort': return applyChooseStoryPort(state, action);
    case 'chooseStoryPassage': return applyChooseStoryPassage(state, action);
    case 'resolveEvent': return applyResolveEvent(state, action);
    case 'setPoolLimit': return applySetPoolLimit(state, action);
    case 'setCityNews': return applySetCityNews(state, action);
    case 'deleteMission': return applyDeleteMission(state, action);
    case 'deleteCandidate': return applyDeleteCandidate(state, action);
    case 'deleteMonster': return applyDeleteMonster(state, action);
    case 'addGeneratedContent': return applyAddGeneratedContent(state, action);
    case 'saveBattleNote': return applySaveBattleNote(state, action);
    case 'deleteBattleNote': return applyDeleteBattleNote(state, action);
    default: return { state, ok: false, message: '未知操作。' };
  }
}
