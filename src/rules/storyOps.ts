import { nextChoiceAfterEvent, pendingChoiceOf } from './storyChoice.ts';
import { applyStoryEffect } from '../rules/storyCore.ts';
import { buildTemplateStoryline, finishStoryEvent } from '../rules/storyEvent.ts';
import { advanceStoryGraph, planToStoryline, spawnStoryBeat, startStoryGraph } from '../rules/storyRun.ts';
import { ensureGraph, validateGraph } from '../storygraph.ts';
import { isBackdropId } from '../vn/backdrops.ts';
import { STORY_SLOT_MAX, planForSlot, playableStoryPlan, sanitizeStoryPlan, setPlanForSlot } from '../storyplan.ts';
import { archive, clone, dateLabel, findGirl } from '../rules/core.ts';
import { settleMeeting } from './meetingSettle.ts';
import type { ActionResult, GameAction, GameState } from '../types.ts';
// v35 从 src/game.ts 拆出：动作处理器。

/** startStoryline 的动作处理器（v35 从 act 拆出）。 */
export function applyStartStoryline(state: GameState, action: Extract<GameAction, { type: 'startStoryline' }>): ActionResult {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.retired || girl.dead) return { state, ok: false, message: '她已经不在名册上了。' };
      if (next.storylines.some(story => story.girlId === girl.id && story.status === 'active')) return { state, ok: false, message: `${girl.name}还有一条没走完的故事线。` };
      const finished = next.storylines.filter(story => story.girlId === girl.id && story.status === 'done');
      const slot = finished.length + 1;
      if (slot > STORY_SLOT_MAX) return { state, ok: false, message: `${girl.name}的三段故事都讲完了，剩下的日子该往前走了。` };
      if (girl.bond < 20) return { state, ok: false, message: `${girl.name}还没有到愿意讲过去的程度（羁绊 20）。` };
      // 三段各一张图：第 2/3 段没写过就先让叙事者写一张，不能拿第 1 段的图重跑。
      const plan = planForSlot(girl, slot);
      // 第 1 段没蓝图时仍用本地模板兜底（旧行为）；第 2/3 段必须有自己那张图，
      // 否则就只能拿上一段的图重跑，那正是要修掉的事。
      if (!plan && slot > 1) return { state, ok: false, message: `第 ${slot} 段还没有故事蓝图，先让叙事者按上一段的结局写一张。` };
      if (plan && !playableStoryPlan(plan)) return { state, ok: false, message: '这张蓝图还没有开始或结束节点，先补完再开场。' };
      if (plan) {
        const blockers = validateGraph(ensureGraph(plan)).filter(issue => issue.level === 'error');
        if (blockers.length) return { state, ok: false, message: `蓝图还有 ${blockers.length} 处要修：${blockers[0].message}` };
      }
      const storyline = plan
        ? planToStoryline(girl, plan, next.day, next.minutes)
        : buildTemplateStoryline(next, girl, action.direction);
      storyline.slot = slot;
      if (finished.length) storyline.requires = finished[finished.length - 1].id;
      next.storylines.unshift(storyline);
      if (storyline.graph) startStoryGraph(next, storyline);
      else spawnStoryBeat(next, storyline);
      next.logs.unshift({ id: `log-story-start-${storyline.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}的故事「${storyline.title}」开始了。` });
      archive(next, '关系', `${girl.name}的故事`, storyline.premise);
      return { state: next, ok: true, message: `「${storyline.title}」已开启，去详情页走第一幕。` };
}

/** setStoryPlan 的动作处理器（v35 从 act 拆出）。 */
export function applySetStoryPlan(state: GameState, action: Extract<GameAction, { type: 'setStoryPlan' }>): ActionResult {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      const slot = Math.max(1, Math.min(STORY_SLOT_MAX, Math.round(action.slot ?? 1)));
      if (!action.plan) {
        setPlanForSlot(girl, slot, null);
        return { state: next, ok: true, message: `已移除第 ${slot} 段的故事蓝图。` };
      }
      const plan = sanitizeStoryPlan(action.plan);
      if (!plan) return { state: next, ok: false, message: '剧本至少要有一幕，或者一张带开始与结束节点的蓝图。' };
      setPlanForSlot(girl, slot, plan);
      return {
        state: next, ok: true,
        message: plan.graph
          ? `第 ${slot} 段「${plan.title}」的蓝图已保存到${girl.name}的卡片里（${plan.graph.nodes.length} 个节点）。`
          : `第 ${slot} 段「${plan.title}」已保存到${girl.name}的卡片里。`,
      };
}

/** addStoryline 的动作处理器（v35 从 act 拆出）。 */
export function applyAddStoryline(state: GameState, action: Extract<GameAction, { type: 'addStoryline' }>): ActionResult {
      const next = clone(state); const incoming = action.storyline;
      const girl = findGirl(next, incoming.girlId);
      if (!girl) return { state, ok: false, message: '找不到这条故事线的主角。' };
      if (!incoming.beats?.length) return { state, ok: false, message: '故事线没有可用的一幕。' };
      next.storylines = next.storylines.filter(story => !(story.girlId === girl.id && story.status === 'active' && story.source === 'template'));
      next.storylines.unshift({ ...incoming, source: 'llm', status: 'active', stage: 0 });
      spawnStoryBeat(next, next.storylines[0]);
      next.logs.unshift({ id: `log-story-llm-${incoming.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `叙事者写完了「${incoming.title}」的 ${incoming.beats.length} 幕。` });
      return { state: next, ok: true, message: `故事线「${incoming.title}」已就位。` };
}

/** decideStoryChoice 的动作处理器（v35 从 act 拆出）。 */
export function applyDecideStoryChoice(state: GameState, action: Extract<GameAction, { type: 'decideStoryChoice' }>): ActionResult {
      const next = clone(state); const story = next.storylines.find(item => item.id === action.storylineId);
      if (!story || story.status !== 'active') return { state, ok: false, message: '这条故事线已经结束了。' };
      const beat = story.beats.find(item => item.id === action.beatId);
      if (!beat) return { state, ok: false, message: '找不到这一幕。' };
      if (beat.mission) return { state, ok: false, message: '这一幕要先完成她给出的委托。' };
      if (beat.resolvedChoiceId) return { state, ok: false, message: '这一幕已经做过了选择。' };
      const choice = beat.choices.find(item => item.id === action.choiceId);
      if (!choice) return { state, ok: false, message: '没有这个选项。' };
      const girl = findGirl(next, story.girlId);
      if (girl) applyStoryEffect(next, girl, choice.effect, `故事线「${story.title}」`);
      beat.resolvedChoiceId = choice.id;
      beat.resolvedAt = dateLabel(next.day, next.minutes);
      story.stage = Math.min(story.beats.length, story.stage + 1);
      if (story.stage >= story.beats.length && girl) {
        story.status = 'done';
        girl.bond = Math.min(100, girl.bond + 5);
        archive(next, '关系', `${story.title}（完）`, `${girl.name}的故事走到第四幕，选择由你做出。`);
      }
      next.logs.unshift({ id: `log-story-choice-${story.id}-${beat.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${story.title}」${beat.title}：${choice.label}。` });
      return { state: next, ok: true, message: story.status === 'done' ? '这条故事线已经走完。' : '选择已记下，继续下一幕。' };
}

/** advanceStoryline 的动作处理器（v35 从 act 拆出）。 */
export function applyAdvanceStoryline(state: GameState, action: Extract<GameAction, { type: 'advanceStoryline' }>): ActionResult {
      const next = clone(state); const story = next.storylines.find(item => item.id === action.storylineId);
      if (!story || story.status !== 'active') return { state, ok: false, message: '这条故事线已经结束了。' };
      story.stage = Math.min(story.beats.length, story.stage + 1);
      if (story.stage >= story.beats.length) story.status = 'done';
      return { state: next, ok: true, message: '故事线向后推进了一幕。' };
}

/** addCharacterEvent 的动作处理器（v35 从 act 拆出）。 */
export function applyAddCharacterEvent(state: GameState, action: Extract<GameAction, { type: 'addCharacterEvent' }>): ActionResult {
      const next = clone(state); const incoming = action.event;
      const girl = findGirl(next, incoming.girlId);
      if (!girl) return { state, ok: false, message: '找不到事件的主角。' };
      if (next.events.some(event => event.id === incoming.id)) return { state, ok: false, message: '这个事件已经存在。' };
      next.events.unshift({ ...incoming, stage: 0, status: 'active', badge: true });
      girl.eventBadge = '新';
      next.logs.unshift({ id: `log-event-new-${incoming.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}有了一段新的私人事件：${incoming.title}。` });
      return { state: next, ok: true, message: `${girl.name}的头像上多了一个角标。` };
}

/** startCharacterEvent 的动作处理器（v35 从 act 拆出）。 */
export function applyStartCharacterEvent(state: GameState, action: Extract<GameAction, { type: 'startCharacterEvent' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段事件。' };
      if (event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      event.status = 'active';
      event.stage = 0;
      const girl = findGirl(next, event.girlId);
      if (girl) girl.eventBadge = '!';
      return { state: next, ok: true, message: '事件开始。' };
}

/** advanceEvent 的动作处理器（v35 从 act 拆出）。 */
export function applyAdvanceEvent(state: GameState, action: Extract<GameAction, { type: 'advanceEvent' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      if (event.stage >= event.scenes.length - 1) {
        event.status = 'done'; event.badge = false;
        const girl = findGirl(next, event.girlId);
        if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 4); }
        archive(next, '关系', event.title, `${findGirl(next, event.girlId)?.name ?? '她'}的私人事件告一段落。`);
        finishStoryEvent(next, event);
        return { state: next, ok: true, message: '事件收束。' };
      }
      event.stage += 1;
      return { state: next, ok: true, message: '进入下一场。' };
}

/** beginStoryEvent 的动作处理器（v35 从 act 拆出）。 */
export function applyBeginStoryEvent(state: GameState, action: Extract<GameAction, { type: 'beginStoryEvent' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      if (!action.passages.length) return { state, ok: false, message: '这段剧情还没有内容。' };
      event.mode = 'story';
      event.passages = action.passages;
      if (isBackdropId(action.backdrop)) event.backdrop = action.backdrop;
      event.passageIndex = 0;
      event.chosen = [];
      event.summary = action.summary;
      event.pending = false;
      event.badge = false;
      return { state: next, ok: true, message: '剧情开幕。' };
}

/** startStorySession 的动作处理器（v35 从 act 拆出）。 */
export function applyStartStorySession(state: GameState, action: Extract<GameAction, { type: 'startStorySession' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段剧情。' };
      if (event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      // 会议最多 6 人；普通剧情仍按 5 人。
      const cast = (action.cast?.length ? action.cast : event.cast?.length ? event.cast : [event.girlId]).slice(0, event.meeting ? 6 : 5);
      const opening = (action.opening ?? event.opening ?? event.hook ?? '').trim().slice(0, 1500) || event.hook;
      event.mode = 'session';
      event.cast = cast;
      event.opening = opening;
      if (isBackdropId(action.backdrop)) event.backdrop = action.backdrop;
      event.sessionDone = false;
      event.status = 'active';
      event.badge = false;
      // v169：玩家先开口。他写的那段是这一段的第一句，叙事者的开场白接在后面，
      // 这样"谁先说话"就不再取决于模型自觉。
      const seed = (action.seed ?? '').trim().slice(0, 300);
      const at = Date.now();
      event.turns = [
        ...(seed ? [{ id: `turn-${at.toString(36)}-p`, role: 'player' as const, text: seed, lines: [{ speakerId: 'player', speakerName: '所长', expression: 'calm' as const, text: seed, mode: 'speech' as const }], at }] : []),
        { id: `turn-${at.toString(36)}`, role: 'narrator' as const, text: opening, lines: action.lines ?? [], inline: action.inline, options: (action.options ?? []).slice(0, 3), at, reasoning: action.reasoning },
      ];
      const girl = findGirl(next, event.girlId);
      if (girl) girl.eventBadge = '!';
      return { state: next, ok: true, message: '剧情开始。' };
}

/**
 * seedStorySession（v123）：玩家先写下这一夜怎么开始。
 *
 * 写入 `playerSeed` 之后 App 才会去请叙事者写开场白；同一个动作也承担「重写开场」——
 * 把已有的 opening 与对白一起清掉，回到等玩家开口的那一步。
 */
export function applySeedStorySession(state: GameState, action: Extract<GameAction, { type: 'seedStorySession' }>): ActionResult {
  const next = clone(state);
  const event = next.events.find(item => item.id === action.eventId);
  if (!event) return { state, ok: false, message: '找不到这段剧情。' };
  if (event.mode && event.mode !== 'session') return { state, ok: false, message: '这一段不是交互剧情，没有开场要写。' };
  if (event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
  event.playerSeed = action.seed.trim().slice(0, 300);
  event.mode = 'session';
  event.opening = undefined;
  event.turns = undefined;
  event.sessionDone = false;
  return { state: next, ok: true, message: event.playerSeed ? '开场记下了。' : '按引子开场。' };
}

/** appendStoryTurn 的动作处理器（v35 从 act 拆出）。 */
export function applyAppendStoryTurn(state: GameState, action: Extract<GameAction, { type: 'appendStoryTurn' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      if (event.mode !== 'session') return { state, ok: false, message: '这段剧情不是交互模式。' };
      // v109：不再限轮次。一段能聊多长由玩家决定；收尾时会把整段压成摘要，
      // 之后只引用那份摘要，所以不需要靠数字上限兜底。
      event.turns = [...(event.turns ?? []), action.turn];
      return { state: next, ok: true, message: '' };
}

/** replaceStoryTurn 的动作处理器（v35 从 act 拆出）。 */
export function applyReplaceStoryTurn(state: GameState, action: Extract<GameAction, { type: 'replaceStoryTurn' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      const index = (event.turns ?? []).findIndex(turn => turn.id === action.turnId);
      if (index < 0) return { state, ok: false, message: '找不到要重写的那一段。' };
      if (event.turns?.[index]?.role !== 'narrator') return { state, ok: false, message: '只能重写旁白那一段。' };
      const previous = event.turns[index];
      const turns = [...event.turns];
      turns[index] = { ...action.turn, id: previous.id, rewrites: (previous.rewrites ?? 0) + 1 };
      event.turns = turns;
      return { state: next, ok: true, message: '这一段已经重写。' };
}

export { applyEditStoryTurn } from './storyEdit.ts';
/** deleteStoryTurn 的动作处理器（v104）：只允许删玩家自己说的话。 */
export function applyDeleteStoryTurn(state: GameState, action: Extract<GameAction, { type: 'deleteStoryTurn' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段剧情。' };
      const index = (event.turns ?? []).findIndex(turn => turn.id === action.turnId);
      if (index < 0) return { state, ok: false, message: '找不到要删的那一句。' };
      if (event.turns![index]!.role !== 'player') return { state, ok: false, message: '只能删自己说的话。' };
      event.turns = event.turns!.filter((_, at) => at !== index);
      return { state: next, ok: true, message: '这一句已经删掉。' };
}

/** finishStorySession 的动作处理器（v35 从 act 拆出）。 */
export function applyFinishStorySession(state: GameState, action: Extract<GameAction, { type: 'finishStorySession' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event) return { state, ok: false, message: '找不到这段剧情。' };
      if (event.status === 'done') return { state, ok: false, message: '这段事件已经结束了。' };
      // v205：收尾时若带了自动分支，先校验它确实是紧接着的 choice 的一个合法出口。
      const port = action.port?.trim();
      if (port) {
        const story = event.storylineId ? next.storylines.find(item => item.id === event.storylineId && item.status === 'active') : undefined;
        const upcoming = nextChoiceAfterEvent(story, event);
        if (!upcoming?.options.some(option => option.id === port)) return { state, ok: false, message: '这个分支走不通。' };
      }
      // v189：点结束时还留在输入框里的那一句，作为玩家最后一轮记下来。
      // 它没有真的发出去，所以只入档、不计入轮数，也不参与羁绊结算。
      const lead = (action.lead ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
      const rounds = (event.turns ?? []).filter(turn => turn.role === 'player').length;
      if (lead) {
        event.turns = [...(event.turns ?? []), {
          id: `turn-say-${Date.now().toString(36)}`,
          role: 'player' as const,
          text: lead,
          at: Date.now(),
        }];
      }
      // 蓝图正卡在选项上：这一下不该收尾，而是把剧情引到门口、把选项摆出来。
      const branch = port ? undefined : pendingChoiceOf(next, event.girlId);
      if (branch && !event.pendingChoice) {
        const labels = branch.options.map(option => `「${option.label}」`).join('　');
        event.turns = [...(event.turns ?? []), {
          id: `turn-lead-${Date.now().toString(36)}`,
          role: 'narrator' as const,
          text: `话说到这里就断了。${branch.title}这件事还悬在你们之间——${labels}，哪一条都还来得及，但只能选一条。`,
          lines: [], options: [], at: Date.now(),
        }];
        event.pendingChoice = { storylineId: branch.storylineId, nodeId: branch.nodeId };
        next.logs.unshift({ id: `log-story-lead-${event.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${event.title}」走到岔路口，等所长拿主意。` });
        return { state: next, ok: true, message: '剧情引到了岔路口，选一条吧。' };
      }
      event.pendingChoice = undefined;
      // 叙事者写好的结局接在最后：玩家点「结束事件」时不会当场关掉界面，
      // 而是先看到这一段走到哪里为止。
      if (action.ending && action.ending.narration.trim()) {
        event.turns = [...(event.turns ?? []), {
          id: `turn-end-${Date.now().toString(36)}`,
          role: 'narrator' as const,
          text: action.ending.narration.trim(),
          lines: action.ending.lines ?? [],
          inline: action.ending.inline,
          options: [],
          at: Date.now(),
        }];
      }
      event.status = 'done'; event.badge = false; event.sessionDone = true;
      // v109：整段剧情压成一段摘要存下来。原文（event.turns）照旧留在本地存档里，
      // 之后的提示词只引用这条摘要，正文留给玩家从角色详情里回看。
      const summary = action.summary?.trim();
      if (summary) event.summary = summary.slice(0, 800);
      const girl = findGirl(next, event.girlId);
      const gain = Math.min(4, Math.max(0, Math.round(rounds * 0.8)));
      if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + gain); }
      next.logs.unshift({ id: `log-story-session-${event.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl?.name ?? '她'}的剧情「${event.title}」结束，走了 ${rounds} 轮${gain ? `，羁绊 +${gain}` : ''}。` });
      archive(next, '关系', event.title, `${girl?.name ?? '她'}的这段剧情收束了。`);
      // v168：会议结束时结算参会者之间的关系，并留一条会议记录（事件被裁剪后摘要仍在）。
      if (event.meeting) settleMeeting(next, event, action.summary?.trim() || event.summary || '');
      finishStoryEvent(next, event);
      // v205：事件已经收尾并推进到 choice，直接替玩家走掉叙事者选定的那条边。
      if (port && event.storylineId) {
        const taken = takeStoryPort(next, event.storylineId, port);
        if (!taken.ok) next.logs.unshift({ id: `log-port-fallback-${event.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: '自动分支没有接上，改由档案页选择。' });
      }
      return { state: next, ok: true, message: gain ? `事件结束，羁绊 +${gain}。` : '事件结束。' };
}

/** 把蓝图停在 choice 的状态往前推一格；收尾自动选边与手动选边共用。 */
function takeStoryPort(next: GameState, storylineId: string, port: string): { ok: boolean; message: string } {
      const story = next.storylines.find(item => item.id === storylineId && item.status === 'active');
      if (!story?.graph || !story.run) return { ok: false, message: '这条故事线没有可以选择的岔路。' };
      const node = story.graph.nodes.find(item => item.id === story.run?.waiting?.ref);
      if (!node || node.kind !== 'choice' || node.data.kind !== 'choice') return { ok: false, message: '现在没有在等你的选择。' };
      const edge = story.graph.edges.find(item => item.from === node.id && item.fromPort === port);
      const option = node.data.options.find(item => item.id === port);
      if (!edge || !option) return { ok: false, message: '这个选项走不通。' };
      const girl = findGirl(next, story.girlId);
      if (girl && option.effect) applyStoryEffect(next, girl, option.effect, '剧情「' + story.title + '」');
      story.run.waiting = undefined;
      story.run.cursor = edge.to;
      advanceStoryGraph(next, story);
      next.logs.unshift({ id: 'log-port-' + story.id + '-' + port, time: dateLabel(next.day, next.minutes), kind: 'story', text: '你选了：' + option.label.slice(0, 60) + '。' });
      return { ok: true, message: '剧情继续。' };
}

/** chooseStoryPort 的动作处理器（v35 从 act 拆出）。 */
export function applyChooseStoryPort(state: GameState, action: Extract<GameAction, { type: 'chooseStoryPort' }>): ActionResult {
      const next = clone(state);
      const taken = takeStoryPort(next, action.storylineId, action.port);
      if (!taken.ok) return { state, ok: false, message: taken.message };
      return { state: next, ok: true, message: taken.message };
}

/** chooseStoryPassage 的动作处理器（v35 从 act 拆出）。 */
export function applyChooseStoryPassage(state: GameState, action: Extract<GameAction, { type: 'chooseStoryPassage' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active' || event.mode !== 'story') return { state, ok: false, message: '这段剧情已经结束了。' };
      const index = event.passageIndex ?? 0;
      const passage = event.passages?.[index];
      const choice = passage?.choices.find(item => item.id === action.choiceId);
      if (!passage || !choice) return { state, ok: false, message: '这一段没有需要做出的选择。' };
      const girl = findGirl(next, event.girlId);
      if (girl && choice.effect) applyStoryEffect(next, girl, choice.effect, `剧情「${event.title}」`);
      event.chosen = [...(event.chosen ?? []), choice.id];
      next.logs.unshift({ id: `log-passage-${event.id}-${index}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${event.title}」：${choice.label}。` });
      const after = index + 1;
      if (after >= (event.passages?.length ?? 0)) {
        event.status = 'done';
        event.badge = false;
        if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 5); }
        archive(next, '关系', event.title, event.summary ?? `${girl?.name ?? '她'}的这段剧情收束了。`);
        finishStoryEvent(next, event);
        return { state: next, ok: true, message: '这段剧情收束了。' };
      }
      event.passageIndex = after;
      if (girl) girl.eventBadge = undefined;
      return { state: next, ok: true, message: '继续。' };
}

/** resolveEvent 的动作处理器（v35 从 act 拆出）。 */
export function applyResolveEvent(state: GameState, action: Extract<GameAction, { type: 'resolveEvent' }>): ActionResult {
      const next = clone(state); const event = next.events.find(item => item.id === action.eventId);
      if (!event || event.status !== 'active') return { state, ok: false, message: '这段事件已经结束了。' };
      const scene = event.scenes[event.stage];
      const choice = scene?.choices?.find(item => item.id === action.choiceId);
      if (!choice) return { state: next, ok: true, message: '这一幕没有需要做出的选择。' };
      const girl = findGirl(next, event.girlId);
      if (girl) applyStoryEffect(next, girl, choice.effect, `事件「${event.title}」`);
      event.status = 'done'; event.badge = false;
      if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + 2); }
      next.logs.unshift({ id: `log-event-choice-${event.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `「${event.title}」：${choice.label}。` });
      finishStoryEvent(next, event);
      return { state: next, ok: true, message: '事件结束。' };
}


/** chooseStoryOption 的动作处理器：先把蓝图往前推一格，再把这段剧情收尾。 */
export function applyChooseStoryOption(state: GameState, action: Extract<GameAction, { type: 'chooseStoryOption' }>): ActionResult {
  const event = state.events.find(item => item.id === action.eventId);
  if (!event) return { state, ok: false, message: '找不到这段剧情。' };
  if (!event.pendingChoice) return { state, ok: false, message: '这段剧情没有在等选择。' };
  const chosen = applyChooseStoryPort(state, { type: 'chooseStoryPort', storylineId: action.storylineId, port: action.port });
  if (!chosen.ok) return chosen;
  const next = clone(chosen.state);
  const target = next.events.find(item => item.id === action.eventId);
  if (!target) return { state, ok: false, message: '找不到这段剧情。' };
  target.pendingChoice = undefined;
  target.status = 'done'; target.badge = false; target.sessionDone = true;
  const girl = findGirl(next, target.girlId);
  const rounds = (target.turns ?? []).filter(turn => turn.role === 'player').length;
  const gain = Math.min(4, Math.max(0, Math.round(rounds * 0.8)));
  if (girl) { girl.eventBadge = undefined; girl.bond = Math.min(100, girl.bond + gain); }
  next.logs.unshift({ id: `log-story-branch-${target.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl?.name ?? '她'}的剧情「${target.title}」选定了走向${gain ? `，羁绊 +${gain}` : ''}。` });
  archive(next, '关系', target.title, `${girl?.name ?? '她'}的这段剧情选定了走向。`);
  return { state: next, ok: true, message: '这一段落定，故事往下走了。' };
}
