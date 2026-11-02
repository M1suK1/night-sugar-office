import { registerItem } from '../content/items.ts';
import { annotateMission } from '../rules/missions.ts';
import { missionKeyTaken, trimMissionPools } from '../rules/pools.ts';
import { canAcceptGeneratedContent, validBattleNote, validGeneratedItem } from '../rules/validate.ts';
import { monsters } from '../content/monsters.ts';
import { normalizeMarketWindow } from '../rules/market.ts';
import { applyResignationChoice } from '../resignations.ts';
import { districts } from '../districts.ts';
import { frontLabel } from '../fronts.ts';
import { factionName } from '../territories.ts';
import { applyIncidentEffect, girlInFront } from '../rules/incidentOps.ts';
import { mergeIncidentPool } from '../incidents.ts';
import { resolveStoryWait } from '../rules/storyRun.ts';
import { advance } from '../rules/time.ts';
import { applyOpinionChanges, trimOpinions } from '../rules/opinion.ts';
import { previewOpinionOption, resolveOpinionOptions } from '../opinions.ts';
import { archive, clone, dateLabel, findGirl } from '../rules/core.ts';
import type { ActionResult, GameAction, GameState, Incident, Mission } from '../types.ts';
// v35 从 src/game.ts 拆出：动作处理器。

/** decideOpinion 的动作处理器（v35 从 act 拆出）。 */
export function applyDecideOpinion(state: GameState, action: Extract<GameAction, { type: 'decideOpinion' }>): ActionResult {
      const next = clone(state); let opinion = next.opinions.find(o => o.id === action.opinionId);
      if (!opinion || opinion.status !== 'pending') return { state, ok: false, message: '这项议题已经处理过了。' };
      const option = resolveOpinionOptions(next, opinion).find(entry => entry.id === action.decision);
      if (!option) return { state, ok: false, message: '找不到这个选项。' };
      const preview = previewOpinionOption(next, opinion, option);
      if (!preview.ok) return { state, ok: false, message: `资源不足：${preview.missing.join('；')}` };
      const decision = action.decision;
      opinion.status = decision === 'accept' ? 'accepted' : decision === 'reject' ? 'rejected' : 'deferred';
      if (decision === 'defer') opinion.revisitDay = next.day + 1;
      const applied = applyOpinionChanges(next, opinion, option);
      let working = next;
      if (preview.minutes > 0) {
        const moved = advance(next, preview.minutes);
        if (!moved.ok) return { state, ok: false, message: moved.message };
        working = moved.state;
      }
      opinion = working.opinions.find(o => o.id === action.opinionId);
      const verb = decision === 'accept' ? '批准' : decision === 'reject' ? '驳回' : '暂缓';
      const detail = applied.tags.length ? ` ${applied.tags.join('，')}。` : '';
      const revisit = decision === 'defer' ? ` 下个议事日（第 ${next.day + 1} 日）重新提出。` : '';
      working.logs.unshift({ id: `log-decide-${opinion?.id ?? action.opinionId}`, time: dateLabel(working.day, working.minutes), kind: 'council', text: `${verb}议题「${opinion?.title ?? ''}」。${detail}${revisit}`, delta: applied.gold });
      if (opinion?.storylineId && decision !== 'defer') resolveStoryWait(working, opinion.storylineId, 'opinion', opinion.id, 'success', decision);
      return { state: working, ok: true, message: `已处理「${opinion?.title ?? ''}」。` };
}

/** mergeIncidentPool 的动作处理器（v35 从 act 拆出）。 */
export function applyMergeIncidentPool(state: GameState, action: Extract<GameAction, { type: 'mergeIncidentPool' }>): ActionResult {
      const merged = clone(state);
      const added = mergeIncidentPool(merged, action.entries, { day: merged.day, minutes: merged.minutes });
      if (added <= 0) return { state, ok: false, message: '这批事件没有能用的。' };
      merged.logs.unshift({ id: `log-incident-pool-${merged.day}-${merged.incidentSeq}`, time: dateLabel(merged.day, merged.minutes), kind: 'incident', text: `夜里又攒下 ${added} 件还没摆上桌的事。` });
      return { state: merged, ok: true, message: `桌上多出 ${added} 件还没轮到的事。` };
}

/** addIncident 的动作处理器（v35 从 act 拆出）。 */
export function applyAddIncident(state: GameState, action: Extract<GameAction, { type: 'addIncident' }>): ActionResult {
      const next = clone(state);
      if (next.incidents.some(incident => incident.id === action.incident.id)) return { state, ok: false, message: '这条事件已经在队列里了。' };
      if (next.incidents.filter(incident => incident.status === 'pending').length >= 5) return { state, ok: false, message: '待处理事件太多，先清掉手上的再说。' };
      const incident: Incident = { ...action.incident, day: next.day, status: 'pending' };
      if (!incident.options?.length) return { state, ok: false, message: '事件没有可选的应对方式。' };
      next.incidents.unshift(incident);
      next.logs.unshift({ id: `log-incident-new-${incident.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `必须现在决定：${incident.title}。` });
      return { state: next, ok: true, message: '一件必须立刻决定的事摆在了桌上。' };
}

/** joinFront 的动作处理器（v35 从 act 拆出）。 */
export function applyJoinFront(state: GameState, action: Extract<GameAction, { type: 'joinFront' }>): ActionResult {
      const next = clone(state);
      next.fronts = next.fronts ?? [];
      const front = next.fronts.find(item => item.id === action.frontId);
      if (!front) return { state, ok: false, message: '这条战线已经结束了。' };
      if (front.status !== 'open') return { state, ok: false, message: '这条战线已经有人站过去了。' };
      const squad: string[] = [];
      for (const id of action.girlIds) {
        const girl = findGirl(next, id);
        if (!girl) return { state, ok: false, message: '名单里有找不到的人。' };
        if (girl.dead || girl.retired) return { state, ok: false, message: `${girl.name}已经不在名册上了。` };
        if (girl.status === 'mission' || girl.status === 'resting') return { state, ok: false, message: `${girl.name}现在走不开。` };
        if (girl.hp <= 0) return { state, ok: false, message: `${girl.name}伤得太重，上不了街。` };
        if (girlInFront(next, girl.id)) return { state, ok: false, message: `${girl.name}已经在另一条战线上了。` };
        squad.push(girl.id);
      }
      if (!squad.length) return { state, ok: false, message: '至少要带一个人过去。' };
      front.side = action.side;
      front.squad = squad;
      front.status = 'joined';
      const backed = action.side === 'attacker' ? front.attacker : front.defender;
      next.logs.unshift({
        id: `log-front-join-${front.id}`, time: dateLabel(next.day, next.minutes), kind: 'battle',
        text: `我们站到了${factionName[backed]}这边：${frontLabel(front)}。${squad.length} 个人过去了。`,
      });
      return { state: next, ok: true, message: `已经把人派到${districts[front.district].name}。` };
}

/** resolveIncident 的动作处理器（v35 从 act 拆出）。 */
export function applyResolveIncident(state: GameState, action: Extract<GameAction, { type: 'resolveIncident' }>): ActionResult {
      const next = clone(state); const incident = next.incidents.find(item => item.id === action.incidentId);
      if (!incident || incident.status !== 'pending') return { state, ok: false, message: '这件事已经处理过了。' };
      const option = action.optionId ? incident.options.find(item => item.id === action.optionId) : undefined;
      if (!option && incident.options.length > 0) return { state, ok: false, message: '没有这个选项。' };
      if (option) incident.choiceId = option.id;
      incident.status = 'resolved';
      incident.resolvedAt = dateLabel(next.day, next.minutes);
      applyIncidentEffect(next, incident, option?.effect ?? incident.scene?.effect ?? {});
      if (incident.templateId?.startsWith('resign-')) applyResignationChoice(next, incident);
      if (incident.storylineId) resolveStoryWait(next, incident.storylineId, 'incident', incident.id, 'success', option?.id);
      return { state: next, ok: true, message: option ? `已决定：${option.label}。` : `「${incident.title}」看过了。` };
}

/** setPoolLimit 的动作处理器（v35 从 act 拆出）。 */
export function applySetPoolLimit(state: GameState, action: Extract<GameAction, { type: 'setPoolLimit' }>): ActionResult {
      const next = clone(state);
      const value = Math.max(1, Math.min(40, Math.round(action.value)));
      next.poolLimits[action.pool] = value;
      return { state: next, ok: true, message: `${action.pool === 'missions' ? '事件池' : action.pool === 'monsters' ? '魔物池' : '市场池'}上限已设为 ${value}。` };
}

/** deleteMission 的动作处理器（v35 从 act 拆出）。 */
export function applyDeleteMission(state: GameState, action: Extract<GameAction, { type: 'deleteMission' }>): ActionResult {
      const target = state.missions.find(m => m.id === action.missionId);
      if (!target) return { state, ok: false, message: '没有找到这条事件。' };
      if (target.status === 'active') return { state, ok: false, message: '委托进行中，不能从事件池移除。' };
      if (target.storylineId) return { state, ok: false, message: '故事委托会跟着剧情走，不能从池里删掉。' };
      const next = clone(state);
      next.missions = next.missions.filter(m => m.id !== action.missionId);
      next.logs.unshift({ id: `log-pool-${action.missionId}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `从事件池移除了「${target.title}」。` });
      return { state: next, ok: true, message: '事件已从池中移除。' };
}

/** deleteCandidate 的动作处理器（v35 从 act 拆出）。 */
export function applyDeleteCandidate(state: GameState, action: Extract<GameAction, { type: 'deleteCandidate' }>): ActionResult {
      const target = state.candidates.find(g => g.id === action.girlId);
      if (!target) return { state, ok: false, message: '没有找到这位候选者。' };
      const next = clone(state);
      next.candidates = next.candidates.filter(g => g.id !== action.girlId);
      normalizeMarketWindow(next);
      return { state: next, ok: true, message: `${target.name} 的候选档案已移除。` };
}

/** deleteMonster 的动作处理器（v35 从 act 拆出）。 */
export function applyDeleteMonster(state: GameState, action: Extract<GameAction, { type: 'deleteMonster' }>): ActionResult {
      const target = monsters.find(m => m.id === action.monsterId);
      if (!target) return { state, ok: false, message: '没有找到这只魔物。' };
      if ((state.removedMonsters ?? []).includes(action.monsterId)) return { state, ok: false, message: '这只魔物已经离开魔物池。' };
      const next = clone(state);
      next.removedMonsters = [...(next.removedMonsters ?? []), action.monsterId];
      next.customMonsters = (next.customMonsters ?? []).filter(m => m.id !== action.monsterId);
      const affected = next.missions.filter(m => m.enemyIds?.includes(action.monsterId));
      next.missions = next.missions.filter(m => !m.enemyIds?.includes(action.monsterId) || m.status === 'active');
      for (const m of affected) if (m.status !== 'active') next.logs.unshift({ id: `log-pool-${m.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'battle', text: `「${m.title}」因魔物被移出池而消散。` });
      return { state: next, ok: true, message: `${target.name} 已从魔物池移除。` };
}

/** addGeneratedContent 的动作处理器（v35 从 act 拆出）。 */
export function applyAddGeneratedContent(state: GameState, action: Extract<GameAction, { type: 'addGeneratedContent' }>): ActionResult {
      const gate = canAcceptGeneratedContent(state);
      if (!gate.ok) return { state, ok: false, message: gate.message };
      if (state.missions.some(m => m.id === action.mission.id) || missionKeyTaken(state, action.mission)) return { state, ok: false, message: '生成内容与现有委托重复。' };
      if (action.girl && state.candidates.some(g => g.id === action.girl!.id)) return { state, ok: false, message: '生成内容与现有条目重复。' };
      if (action.envoyMission && (state.missions.some(m => m.id === action.envoyMission!.id) || missionKeyTaken(state, action.envoyMission))) return { state, ok: false, message: '使者委托与现有事件重复。' };
      if (action.items?.length && action.items.some(item => state.generatedItems.some(existing => existing.id === item.id))) return { state, ok: false, message: '生成装备与现有条目重复。' };
      const next = clone(state);
      const annotate = (m: Mission): Mission => annotateMission(next, m);
      if (action.girl) next.candidates.push(action.girl);
      next.missions.push(annotate({ ...action.mission, generated: true, sourcePack: 'llm' }));
      if (action.envoyMission) {
        next.missions.push(annotate({ ...action.envoyMission, generated: true, sourcePack: 'llm' }));
        if (action.envoyMission.faction) next.factions[action.envoyMission.faction].envoyTaskId = action.envoyMission.id;
      }
      trimMissionPools(next);
      if (action.items?.length) {
        const fresh = action.items.filter(item => validGeneratedItem(item) && !next.generatedItems.some(existing => existing.id === item.id)).slice(0, 2);
        for (const item of fresh) registerItem(item);
        next.generatedItems.push(...fresh);
      }
      const opinions = action.opinions?.length ? action.opinions : action.opinion ? [action.opinion] : [];
      if (opinions.length) {
        next.opinions = [...opinions, ...next.opinions];
        trimOpinions(next);
      }
      if (action.girl) archive(next, '少女', action.girl.name, `${action.girl.title} · ${action.girl.element} · ${action.girl.archetype}`);
      archive(next, '事件', action.mission.title, action.mission.description);
      for (const opinion of opinions) archive(next, '议程', opinion.title, opinion.text);
      if (action.envoyMission) archive(next, '代表', action.envoyMission.title, action.envoyMission.description);
      for (const item of (action.items ?? []).slice(0, 2)) archive(next, '登记', item.name, item.description);
      next.logs.unshift({ id: `log-gen-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `叙事者提交了新的夜班提案：「${action.mission.title}」。${opinions.length ? `会客厅多了 ${opinions.length} 份议题` : ''}${action.items?.length ? `${opinions.length ? '，' : ''}仓库登记了 ${action.items.length} 件新装备` : ''}。` });
      return { state: next, ok: true, message: `新的委托已出现在地图上${opinions.length ? `，会客厅收到 ${opinions.length} 份议题` : ''}。候选者改由契约卡库补充。` };
}

/** saveBattleNote 的动作处理器（v35 从 act 拆出）。 */
export function applySaveBattleNote(state: GameState, action: Extract<GameAction, { type: 'saveBattleNote' }>): ActionResult {
      const note = action.note;
      if (!validBattleNote(note)) return { state, ok: false, message: '这份战斗札记不完整，无法保存。' };
      if (!state.battles.some(battle => battle.id === note.battleId)) return { state, ok: false, message: '找不到对应的战斗记录。' };
      const next = clone(state);
      next.battleNotes = [note, ...(next.battleNotes ?? []).filter(item => item.battleId !== note.battleId)].slice(0, 20);
      return { state: next, ok: true, message: `已保存「${note.title}」。` };
}

/** deleteBattleNote 的动作处理器（v35 从 act 拆出）。 */
export function applyDeleteBattleNote(state: GameState, action: Extract<GameAction, { type: 'deleteBattleNote' }>): ActionResult {
      const next = clone(state);
      const before = (next.battleNotes ?? []).length;
      next.battleNotes = (next.battleNotes ?? []).filter(item => item.battleId !== action.battleId);
      return before === next.battleNotes.length
        ? { state, ok: false, message: '这场战斗还没有札记。' }
        : { state: next, ok: true, message: '已删除这场战斗的札记。' };
}
