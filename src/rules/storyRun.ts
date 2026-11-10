import { CONTRACT_DAYS } from '../contracts.ts';
import { hydrate } from '../rules/candidate.ts';
import { registerItem } from '../content/items.ts';
import { MAX_ENEMIES, ROUND_MINUTES } from '../combat.ts';
import { districtPin } from '../rules/missions.ts';
import { applyPct, districtAt, districts } from '../districts.ts';
import { isBackdropId } from '../vn/backdrops.ts';
import { endingLabel, ensureGraph, graphBeats } from '../storygraph.ts';
import { absoluteMinutes, deadlineFor } from '../shift.ts';
import { buildNodeIncident, stampIncident } from './storyIncidents.ts';
import { addEvent, applyStoryEffect } from '../rules/storyCore.ts';
import { storyCastAfterMission } from './storyChoice.ts';
import { archive, dateLabel, findGirl, hashText } from '../rules/core.ts';
import { pickEquipmentOfTier, pickMissionTemplate } from '../nightPick.ts';
import { pickCandidateSkills } from '../skills.ts';
import type { CharacterEvent, GameState, Girl, Mission, Opinion, StoryBeat, StoryPlan, Storyline } from '../types.ts';
// v35 从 src/game.ts 拆出：故事蓝图的推进与故事委托（两者互相调用，合成一个模块）。

// v35 从 src/game.ts 拆出：故事蓝图的节点推进。

export function storyChoices(beat: number, girl: Girl): Storyline['beats'][number]['choices'] {
  const warm = { id: 'warm', label: '先听她说完', intent: '把这一晚留给她', effect: { bond: 4, corruption: -2 } };
  const push = { id: 'push', label: '追问下去', intent: '把话挑明', effect: { bond: -2, corruption: 3 } };
  const work = { id: 'work', label: '先去处理街上的事', intent: '把委托放在前面', effect: { gold: 320, bond: -3, reputation: 1 } };
  if (beat % 2 === 0) return [warm, push, work];
  const promise = { id: 'promise', label: '答应她一个具体的未来', intent: '给出可以兑现的承诺', effect: { bond: 6, corruption: -3, trigger: { kind: 'dialogue', topic: '夜里的约定', prompt: `和${girl.name}聊聊今晚答应她的那件事。` } } };
  return [promise, warm, work];
}

export function storyGraphNode(story: Storyline, id: string) {
  return story.graph?.nodes.find(node => node.id === id);
}

export function storyGraphEdge(story: Storyline, nodeId: string, port = 'out') {
  return story.graph?.edges.find(edge => edge.from === nodeId && (
    port === 'out' || edge.fromPort === port || (port === 'success' && edge.fromPort === 'out')
  ));
}

export function startStoryGraph(state: GameState, story: Storyline): void {
  if (!story.graph) return;
  story.run = { cursor: story.graph.entry, visited: [], steps: 0 };
  advanceStoryGraph(state, story);
}

export function advanceStoryGraph(state: GameState, story: Storyline): void {
  if (!story.graph || !story.run || story.status !== 'active') return;
  const girl = state.girls.find(item => item.id === story.girlId);
  if (!girl) { story.status = 'abandoned'; return; }
  for (let guard = 0; guard < 64; guard += 1) {
    const run = story.run;
    if (!run) return;
    const node = storyGraphNode(story, run.cursor);
    if (!node) { story.status = 'abandoned'; return; }
    run.visited.push(node.id);
    run.steps += 1;
    if (run.steps > 512) { run.stalled = true; return; }
    const step = (port = 'out') => {
      const edge = storyGraphEdge(story, node.id, port);
      if (!edge) { story.status = 'abandoned'; return false; }
      run.cursor = edge.to;
      return true;
    };

    if (node.kind === 'start') { if (!step()) return; continue; }
    if (node.kind === 'reward') {
      if (node.data.kind === 'reward') {
        applyStoryEffect(state, girl, node.data.effect ?? {}, '剧情「' + story.title + '」');
        // v46：装备只按阶级抽一件成品，不再由蓝图指定具体物品。
        const tier = node.data.equipmentTier;
        if (tier) {
          const item = pickEquipmentOfTier({ tier, seed: `${story.id}:${node.id}` });
          if (item) {
            state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
            state.logs.unshift({
              id: 'log-graph-reward-' + story.id + '-' + node.id,
              time: dateLabel(state.day, state.minutes),
              kind: 'story',
              text: `「${story.title}」的奖励发下了一件${tier} 阶装备：${item.name}。已放进事务所背包。`,
            });
          }
        }
        const trait = node.data.trait;
        if (trait?.name && !girl.traits.some(item => item.name === trait.name)) {
          girl.traits.push({ id: 'trait-' + hashText(trait.name), name: trait.name, polarity: 'neutral', tags: ['剧情'], description: trait.description });
        }
      }
      if (!step()) return;
      continue;
    }
    if (node.kind === 'choice') {
      run.waiting = { kind: 'choice', ref: node.id };
      return;
    }
    if (node.kind === 'mission') {
      if (node.data.kind !== 'mission') return;
      const beat: StoryBeat = {
        id: node.id, index: story.beats.length, title: node.title, summary: '', scene: '', hook: '',
        choices: [], status: 'open', mission: node.data.spec,
      };
      story.beats.push(beat);
      const mission = storyMissionForBeat(state, story, beat);
      state.missions.unshift(mission);
      beat.missionId = mission.id;
      run.waiting = { kind: 'mission', ref: mission.id };
      return;
    }
    if (node.kind === 'incident') {
      if (node.data.kind !== 'incident') return;
      const spec = node.data.spec;
      const built = buildNodeIncident(state, story.id, node.id, node.title, spec);
      const { incident: ready, immediate } = stampIncident(state, built, {
        trigger: spec.trigger, ttlMinutes: spec.ttlMinutes, blocking: spec.blocking, storyNodeId: node.id,
      });
      run.waiting = { kind: 'incident', ref: ready.id };
      if (immediate) state.incidents.unshift(ready);
      else state.incidentPool.push(ready);
      return;
    }
    if (node.kind === 'opinion') {
      if (node.data.kind !== 'opinion') return;
      const spec = node.data.spec;
      const faction = spec.options.find(option => option.shift)?.shift?.faction;
      // v46：蓝图只写批准 / 驳回两个分支；「暂缓」由程序固定补在中间，界面仍是三个按钮。
      const decided: Opinion['options'] = spec.options
        .filter(option => option.id === 'accept' || option.id === 'reject')
        .map(option => ({ id: option.id, label: option.label, effect: option.effect, shift: option.shift }));
      if (!decided.some(option => option.id === 'defer')) {
        decided.splice(Math.min(1, decided.length), 0, { id: 'defer', label: '暂缓', effect: '把这条议题推到下个议事日再谈。' });
      }
      const opinion: Opinion = {
        id: 'op-' + story.id + '-' + node.id, day: state.day, authorId: girl.id, topic: spec.topic,
        title: spec.title || node.title, text: spec.text, request: spec.request, status: 'pending', faction,
        options: decided.map((option) => ({ id: option.id, label: option.label, effect: option.effect, shift: option.shift, changes: [], outcomes: [] })),
        storylineId: story.id,
        storyNodeId: node.id,
      };
      state.opinions.unshift(opinion);
      run.waiting = { kind: 'opinion', ref: opinion.id };
      return;
    }
    if (node.kind === 'event') {
      const event = addEvent(state, girl, node.data.kind === 'event' ? node.data.title || node.title : node.title, node.data.kind === 'event' ? node.data.hook : '', 'story', story.id);
      event.storyNodeId = node.id;
      if (node.data.kind === 'event') {
        // 蓝图事件改成你一句我一句：先记下在场的人与开场白，进游戏后再补成会话。
        event.mode = 'session';
        event.cast = (node.data.cast?.length ? node.data.cast : [girl.id]).slice(0, 3);
        event.opening = node.data.opening?.slice(0, 600);
        if (isBackdropId(node.data.backdrop)) event.backdrop = node.data.backdrop;
        event.turns = [];
        event.sessionDone = false;
      }
      run.waiting = { kind: 'event', ref: event.id };
      return;
    }
    if (node.kind === 'wait') {
      const days = node.data.kind === 'wait' ? node.data.days ?? 0 : 0;
      const minutes = node.data.kind === 'wait' ? node.data.minutes ?? 0 : 0;
      if (days * 1440 + minutes <= 0) { if (!step()) return; continue; }
      run.waiting = { kind: 'wait', ref: node.id, until: absoluteMinutes(state.day, state.minutes) + days * 1440 + minutes };
      return;
    }
    if (node.kind === 'end') {
      story.status = 'done';
      story.run = undefined;
      const ending = endingLabel(node);
      story.ending = ending || undefined;
      story.endingSummary = node.data.kind === 'end' && node.data.summary?.trim() ? node.data.summary.trim() : undefined;
      archive(state, '关系', girl.name + '的故事', node.data.kind === 'end' ? node.data.summary || story.premise : story.premise);
      state.logs.unshift({
        id: 'log-graph-end-' + story.id,
        time: dateLabel(state.day, state.minutes),
        kind: 'story',
        text: ending ? '「' + story.title + '」走到结局：' + ending + '。' : '「' + story.title + '」收束了。',
      });
      return;
    }
    return;
  }
}

export function resolveStoryWait(state: GameState, storylineId: string, kind: 'mission' | 'incident' | 'opinion' | 'event' | 'choice' | 'wait', ref: string, result: 'success' | 'failure' = 'success', chosenPort?: string): void {
  const story = state.storylines.find(item => item.id === storylineId && item.status === 'active');
  if (!story?.run || !story.graph) return;
  if (story.run.waiting?.kind !== kind || story.run.waiting.ref !== ref) return;
  let fromNode = ref;
  if (kind === 'mission') fromNode = story.beats.find(beat => beat.missionId === ref)?.id ?? ref;
  if (kind === 'event') fromNode = state.events.find(event => event.id === ref)?.storyNodeId ?? ref;
  if (kind === 'incident') fromNode = state.incidents.find(item => item.id === ref)?.storyNodeId ?? ref;
  if (kind === 'opinion') fromNode = state.opinions.find(item => item.id === ref)?.storyNodeId ?? ref;
  // v46：提案走 accept / reject，带选项的弹窗走 o1–o3，其余一律走 out。
  const port = chosenPort ?? (kind === 'mission' ? (result === 'failure' ? 'failure' : 'success') : 'out');
  const edge = storyGraphEdge(story, fromNode, port);
  story.run.waiting = undefined;
  if (!edge) {
    story.status = 'done';
    story.run = undefined;
    const girl = state.girls.find(item => item.id === story.girlId);
    state.logs.unshift({
      id: `log-graph-stop-${story.id}-${Date.now()}`,
      time: dateLabel(state.day, state.minutes),
      kind: 'story',
      text: result === 'failure'
        ? `「${story.title}」没能继续下去，${girl?.name ?? '她'}的故事在这里收束。`
        : `「${story.title}」没有接续的节点，故事在这里收束。`,
    });
    return;
  }
  story.run.cursor = edge.to;
  advanceStoryGraph(state, story);
}

// v35 从 src/game.ts 拆出：故事委托与角色事件的前置。

export const storyRank: Record<string, number> = { 简单: 1, 常规: 2, 棘手: 3, 危险: 4 };

/** 把一幕的委托目标落成地图上的特殊委托。奖励与目标由难度在本地计算，不交给模型。 */

export function planToStoryline(girl: Girl, plan: StoryPlan, day: number, minutes: number): Storyline {
  const graph = plan.graph ?? ensureGraph(plan);
  const beats = plan.beats.length ? plan.beats.map((beat, index) => ({
    ...beat,
    id: `plan-${index + 1}`,
    index,
    choices: beat.choices.map((choice, at) => ({ ...choice, id: `c${at + 1}` })),
    status: (index === 0 ? 'open' : 'locked') as StoryBeat['status'],
    missionId: undefined,
    eventId: undefined,
    resolvedChoiceId: undefined,
    resolvedAt: undefined,
  })) : graphBeats(graph);
  return {
    id: `story-manual-${girl.id}-${day}-${minutes}`,
    girlId: girl.id, title: plan.title.slice(0, 40), premise: plan.premise.slice(0, 400), tone: plan.tone.slice(0, 40),
    beats, stage: 0, status: 'active', createdAt: new Date().toISOString(), day, source: 'manual',
    graph,
  };
}

export function storyMissionForBeat(state: GameState, story: Storyline, beat: StoryBeat): Mission {
  const spec = beat.mission;
  const storyCastIds = storyCastAfterMission(story, beat.id, state);
  const rank = storyRank[spec?.difficulty ?? '常规'] ?? 2;
  // v47：只写了 work 的阶段委托，从真实委托模板里抽一条：数值与敌人组合都照搬，描述用模型写的 goal。
  const picked = spec?.work && !spec.monsters?.length
    ? pickMissionTemplate({
      state,
      work: spec.work,
      difficulty: STORY_TO_NIGHT_DIFFICULTY[spec.difficulty] ?? '中危',
      seed: `${story.id}:${beat.id}`,
    })
    : undefined;
  const district = spec?.district ?? districtAt(20 + (hashText(`${story.id}:${beat.id}`) % 58), 25 + (hashText(beat.id) % 50));
  const region = districts[district];
  const duration = Math.max(60, Math.min(180, Math.round(spec?.duration ?? picked?.duration ?? 90)));
  const pin = districtPin(district, `${story.id}:${beat.id}`);
  const now = absoluteMinutes(state.day, state.minutes);
  const target = applyPct(spec?.target ?? picked?.target ?? 45 + rank * 7, region.effect.targetPct);
  const reward = applyPct(260 + rank * 120, region.effect.rewardPct);
  const companionId = spec?.companion ? ensureStoryCompanion(state, story, beat) : undefined;
  const monsters = spec?.monsters ?? [];
  if (monsters.length) {
    state.customMonsters ??= [];
    for (const monster of monsters) if (!state.customMonsters.some(item => item.id === monster.id)) state.customMonsters.push(monster);
  }
  const work: Mission['work'] = monsters.length ? 'combat' : (picked?.work ?? 'investigation');
  const enemyIds = monsters.length
    ? monsters.map(monster => monster.id).slice(0, MAX_ENEMIES)
    : picked?.work === 'combat' ? picked.enemyIds.slice(0, MAX_ENEMIES) : [];
  return {
    id: `sm-${story.id}-${beat.id}`,
    title: (spec?.title ?? beat.title).slice(0, 40),
    category: `${region.name} · ${picked?.category ?? '故事委托'}`,
    description: (spec?.goal || beat.summary || beat.hook).slice(0, 240),
    x: pin.x, y: pin.y,
    difficulty: spec?.difficulty ?? '常规',
    duration,
    reward,
    requirement: spec?.requirement ?? picked?.requirement ?? 'insight',
    target,
    color: `rgb(${region.tint})`,
    status: 'open',
    squad: [],
    work,
    enemyIds: enemyIds.length ? enemyIds : undefined,
    rounds: work === 'combat' ? Math.max(2, Math.ceil(duration / ROUND_MINUTES)) : undefined,
    attempts: 0,
    recommendedLevel: picked?.recommendedLevel ?? 3,
    district,
    window: 'long',
    longDays: 2,
    spawnedAt: now,
    deadlineAt: deadlineFor('long', state.day, now, 2),
    generated: false,
    sourcePack: 'story',
    storylineId: story.id,
    storyBeatId: beat.id,
    storyGoal: (spec?.goal ?? `完成「${beat.title}」：${beat.hook}`).slice(0, 200),
    requiredGirlId: companionId ?? spec?.requiredGirlId,
    storyCastIds,
    rewardEquipmentId: spec?.rewardEquipment ? registerItem({ ...spec.rewardEquipment, id: spec.rewardEquipment.id || `relic-${hashText(`${story.id}:${beat.id}`).toString(16)}` }).id : undefined,
  };
}

/** 蓝图用「简单 / 常规 / 棘手 / 危险」，委托模板用「低危 / 中危 / 高危 / 绝望」。 */
const STORY_TO_NIGHT_DIFFICULTY: Record<string, string> = {
  简单: '低危', 常规: '中危', 棘手: '高危', 危险: '绝望',
};

/** 为故事线当前这一幕发出委托；已经发过则不重复。 */

/** 为故事线当前这一幕发出委托；已经发过则不重复。 */
export function ensureStoryCompanion(state: GameState, story: Storyline, beat: StoryBeat): string {
  const spec = beat.mission;
  if (!spec?.companion) return '';
  const id = `sg-${hashText(`${story.id}:${beat.id}`).toString(16).padStart(8, '0')}`;
  const known = state.girls.find(girl => girl.id === id) ?? state.candidates.find(girl => girl.id === id);
  if (known) return known.id;
  const c = spec.companion;
  const stats = { magic: 58, insight: 58, agility: 58, empathy: 58 };
  const baseMaxHp = Math.round(96 + stats.empathy * 0.3) + 6;
  state.candidates.unshift(hydrate({
    id, name: c.name.slice(0, 12), codename: c.codename.slice(0, 10) || '羁绊协奏', title: '被故事带进事务所的少女',
    element: c.element, color: c.color ?? '#e6a8c8', portrait: '', level: 6,
    hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 0, maxSpirit: 0,
    fatigue: 0, bond: 12, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '', skills: pickCandidateSkills(hashText(`${id}:skills`), c.element), description: c.appearance.slice(0, 160),
    cost: 2400, scars: [], relationships: {}, archetype: c.archetype, quote: c.quote ?? '……我跟着她来的。',
    goal: '弄清自己为什么会出现在这条故事里。', goalKind: '成长', traits: [], conditions: [],
    contractEndDay: 24, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
    appearance: c.appearance.slice(0, 200), personality: c.personality.slice(0, 160),
    outfitDescription: c.outfitDescription.slice(0, 160),
    wardrobe: [], outfitId: 'uniform', expression: 'calm', corruption: 0, equipment: {},
    candidateUntilDay: state.day + 6,
  }));
  return id;
}

export function spawnStoryBeat(state: GameState, story: Storyline): Mission | null {
  if (story.status !== 'active') return null;
  if (story.stage >= story.beats.length) { story.status = 'done'; return null; }
  const beat = story.beats[story.stage];
  if (!beat.mission) { beat.status = 'open'; return null; }
  if (beat.missionId) {
    const existing = state.missions.find(item => item.id === beat.missionId);
    if (existing) return existing;
  }
  const mission = storyMissionForBeat(state, story, beat);
  beat.missionId = mission.id;
  beat.status = 'open';
  state.missions.unshift(mission);
  state.logs.unshift({
    id: `log-story-beat-${story.id}-${beat.id}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'story',
    text: `「${story.title}」${beat.title}：她给出了一份特殊委托——${mission.title}。`,
  });
  return mission;
}

/** 故事委托完成：标记这一幕，并生成她单独的剧情事件。 */

/** 故事委托完成：标记这一幕，并生成她单独的剧情事件。 */
export function completeStoryMission(state: GameState, mission: Mission): CharacterEvent | undefined {
  if (!mission.storylineId || !mission.storyBeatId) return undefined;
  const story = state.storylines.find(item => item.id === mission.storylineId);
  if (!story || story.status !== 'active') return undefined;
  const beat = story.beats.find(item => item.id === mission.storyBeatId);
  const girl = findGirl(state, story.girlId);
  if (!beat || !girl) return undefined;
  beat.status = 'done';
  if (story.run) { resolveStoryWait(state, story.id, 'mission', mission.id, 'success'); return undefined; }
  if (beat.eventId && state.events.some(event => event.id === beat.eventId)) return undefined;
  const spec = beat.mission;
  if (spec?.rewardEquipment) {
    const item = registerItem({ ...spec.rewardEquipment, id: mission.rewardEquipmentId ?? spec.rewardEquipment.id });
    state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
    state.logs.unshift({ id: `log-story-relic-${beat.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `委托带回了一件只属于她的东西：${item.name}。已放进事务所背包。` });
  }
  if (spec?.followUpIncident) {
    const followUp = spec.followUpIncident;
    // 追加卡的 trigger 已经在洗白时收敛成 dayStart / wave 或 undefined（＝立刻）。
    const { incident } = stampIncident(state, {
      ...followUp,
      id: `inc-story-${beat.id}-${state.day}`, day: state.day, status: 'pending', source: followUp.source ?? 'rule',
    }, {
      trigger: followUp.trigger?.kind === 'dayStart' ? 'dayStart' : followUp.trigger?.kind === 'wave' ? 'wave' : 'immediate',
      ttlMinutes: followUp.ttlMinutes, blocking: followUp.blocking,
      wave: followUp.trigger?.kind === 'wave' ? followUp.trigger.wave : undefined,
    });
    state.incidents.unshift(incident);
    state.incidents = state.incidents.slice(0, 5);
    state.logs.unshift({ id: `log-story-incident-${beat.id}`, time: dateLabel(state.day, state.minutes), kind: 'incident', text: `${girl.name}的事刚放下，桌上又多了一件必须现在决定的事。` });
  }
  const event = addEvent(state, girl, beat.title, beat.hook, 'story', story.id);
  event.scenes[0].narration = `委托「${mission.title}」结束了。${mission.storyGoal ? `她做到了：${mission.storyGoal}` : ''}回到会客厅时，她还有别的想说的。`;
  if (spec?.followUpEvent && spec.followUpEvent.title) {
    event.scenes.push({
      id: `${event.id}-extra`,
      title: spec.followUpEvent.title.slice(0, 30),
      narration: spec.followUpEvent.hook.slice(0, 400),
      lines: [{ speaker: girl.name, text: spec.followUpEvent.hook.slice(0, 120) }],
      choices: [],
    });
  }
  beat.eventId = event.id;
  event.mode = 'story';
  event.passages = [];
  event.passageIndex = 0;
  event.pending = true;
  state.logs.unshift({ id: `log-story-done-${beat.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `「${story.title}」${beat.title}的委托完成，她的事件已经就绪。` });
  return event;
}

/** 故事委托失败：走「失败」出口；没有失败出口时故事在这里收束。 */

/** 故事委托失败：走「失败」出口；没有失败出口时故事在这里收束。 */
export function failStoryMission(state: GameState, mission: Mission, reason: string): void {
  if (!mission.storylineId || !mission.storyBeatId) return;
  const story = state.storylines.find(item => item.id === mission.storylineId && item.status === 'active');
  if (!story) return;
  const beat = story.beats.find(item => item.id === mission.storyBeatId);
  if (beat) beat.status = 'done';
  state.logs.unshift({
    id: `log-story-fail-${mission.id}-${Date.now()}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'story',
    text: `「${mission.title}」${reason}，故事走向了另一条路。`,
  });
  if (!story.run) { story.status = 'done'; return; }
  resolveStoryWait(state, story.id, 'mission', mission.id, 'failure');
}

/** 剧情事件结束：推进到下一幕，并发出下一份委托。 */
