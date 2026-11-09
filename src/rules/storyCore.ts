import { commissionPool, districtPin } from '../rules/missions.ts';
import { applyPct, districtAt, districts } from '../districts.ts';
import { incidentId } from '../rules/incidentOps.ts';
import { makeOpinion } from '../rules/opinion.ts';
import { absoluteMinutes, deadlineFor } from '../shift.ts';
import { getSkill } from '../content/skills.ts';
import { genderOf } from '../rules/candidate.ts';
import { addCorruption } from '../rules/conditions.ts';
import { book, clamp100, clone, dateLabel, hashText, shiftTerritory } from '../rules/core.ts';
import type { CharacterEvent, GameState, Girl, StatKey, StoryEffect, StoryTrigger } from '../types.ts';
// v35 从 src/game.ts 拆出：故事线与事件共享的底层写入。

/** 故事线效果落地：资源、羁绊、侵蚀、特性，以及它触发的其他内容。 */
export function applyStoryEffect(state: GameState, girl: Girl, effect: StoryEffect, source: string): void {
  if (effect.gold) {
    state.gold = Math.max(0, state.gold + effect.gold);
    book(state, state.day, effect.gold);
  }
  if (effect.reputation) state.reputation = clamp100(state.reputation + effect.reputation);
  if (effect.bond) girl.bond = clamp100(girl.bond + effect.bond);
  if (effect.corruption) {
    if (effect.corruption > 0) addCorruption(state, girl, effect.corruption);
    else girl.corruption = clamp100(girl.corruption + effect.corruption);
  }
  if (effect.trait) {
    girl.traits.push({ id: `story-trait-${hashText(effect.trait.name).toString(16)}`, name: effect.trait.name.slice(0, 16), polarity: 'positive', tags: ['故事线'], description: effect.trait.description.slice(0, 120), gainedAt: dateLabel(state.day, state.minutes) });
  }
  if (effect.skill) {
    const skill = getSkill(effect.skill.id);
    if (!girl.skills.includes(skill.id)) {
      girl.skills.push(skill.id);
      state.logs.unshift({ id: `log-story-skill-${girl.id}-${skill.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}在故事里学会了「${skill.name}」。` });
    }
  }
  if (effect.growth) {
    for (const key of Object.keys(effect.growth) as StatKey[]) {
      const amount = effect.growth[key] ?? 0;
      if (!amount) continue;
      girl.stats[key] = Math.max(20, Math.min(99, girl.stats[key] + amount));
    }
  }
  if (effect.buff?.name) {
    const buff = effect.buff;
    girl.conditions.push({
      id: `cond-story-${girl.id}-${hashText(buff.name).toString(16)}-${state.day}-${state.minutes}`,
      name: buff.name.slice(0, 16),
      kind: 'buff',
      source,
      description: (buff.description ?? '故事带来的临时状态。').slice(0, 120),
      remaining: Math.max(1, buff.days ?? 3),
      removable: true,
      stat: buff.stat,
      amount: buff.amount,
    });
  }
  if (effect.trigger) fireStoryTrigger(state, girl, effect.trigger, source);
}

// ---------------------------------------------------------------- 角色事件
export function addEvent(state: GameState, girl: Girl, title: string, hook: string, source: string, storylineId?: string): CharacterEvent {
  const event: CharacterEvent = {
    id: `evt-${girl.id}-${state.day}-${state.events.length}`,
    girlId: girl.id,
    storylineId,
    title: title.slice(0, 40),
    hook: hook.slice(0, 240),
    scenes: [
      { id: 'scene-1', title: '开场', narration: `${genderOf(girl)}在会客厅等你，桌上的茶已经凉了一半。`, lines: [{ speaker: girl.name, tone: '低声', text: hook.slice(0, 160) }] },
      {
        id: 'scene-2', title: '抉择', narration: '她把选择留给你，自己只是看着窗外。',
        lines: [{ speaker: girl.name, tone: '平静', text: '你打算怎么做？我听你的。' }],
        choices: [
          { id: 'stay', label: '留下，把这一晚给她', intent: '陪伴', effect: { bond: 6, corruption: -3 } },
          { id: 'ask', label: '先问清楚她想要什么', intent: '把决定权还给她', effect: { bond: 3, corruption: 1 } },
          { id: 'leave', label: '让她先休息，明晚再谈', intent: '保持距离', effect: { bond: -2, gold: 200 } },
        ],
      },
    ],
    stage: 0,
    status: 'active',
    day: state.day,
    minutes: state.minutes,
    source: source === 'llm' ? 'llm' : 'template',
    badge: true,
  };
  state.events.unshift(event);
  girl.eventBadge = '新';
  state.logs.unshift({ id: `log-event-${event.id}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}有一段只会在今晚发生的事：${event.title}。` });
  return event;
}

/** 故事线的高潮会向事务所抛出真实的内容：委托、议题、事件、对话或辖区变动。 */
export function fireStoryTrigger(state: GameState, girl: Girl, trigger: StoryTrigger, source: string): void {
  const now = absoluteMinutes(state.day, state.minutes);
  if (trigger.kind === 'territory') {
    shiftTerritory(state, trigger.district, trigger.faction, source);
    return;
  }
  if (trigger.kind === 'dialogue') {
    girl.pendingTalk = { topic: trigger.topic.slice(0, 24), prompt: trigger.prompt.slice(0, 240), day: state.day };
    state.logs.unshift({ id: `log-story-talk-${girl.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}在会客厅等你，说有话要谈。` });
    return;
  }
  if (trigger.kind === 'opinion') {
    const opinion = makeOpinion(state, girl, trigger.topic, trigger.title.slice(0, 40), trigger.text.slice(0, 240), trigger.request.slice(0, 80), { faction: trigger.shift?.faction, district: trigger.shift?.district });
    if (trigger.shift) opinion.options[0].shift = trigger.shift;
    state.opinions.unshift(opinion);
    return;
  }
  if (trigger.kind === 'incident') {
    state.incidents.unshift({
      id: incidentId(state, 'story'), day: state.day, kind: trigger.incidentKind, source: 'rule',
      title: trigger.title.slice(0, 40), body: trigger.body.slice(0, 320), girlId: girl.id,
      options: trigger.options, status: 'pending',
    });
    return;
  }
  if (trigger.kind === 'event') {
    addEvent(state, girl, trigger.title, trigger.hook, source);
    return;
  }
  const district = trigger.district ?? districtAt(20 + (hashText(girl.id) % 60), 25 + (hashText(trigger.title) % 50));
  const pool = commissionPool();
  const template = pool[hashText(`${girl.id}:${trigger.title}`) % pool.length];
  const pin = districtPin(district, `${girl.id}:${state.day}`);
  const spawnAt = now;
  state.missions.unshift({
    ...clone(template),
    id: `s-${state.day}-${state.minutes}-${girl.id}`,
    title: trigger.title.slice(0, 40),
    category: `${districts[district].name} · 故事线`,
    description: trigger.description.slice(0, 240),
    district,
    window: 'long',
    longDays: 2,
    wave: state.shift.wave,
    spawnedAt: spawnAt,
    deadlineAt: deadlineFor('long', state.day, spawnAt, 2),
    x: pin.x,
    y: pin.y,
    status: 'open',
    storylineId: state.storylines.find(story => story.girlId === girl.id && story.status === 'active')?.id,
    squad: [],
    attempts: 0,
    generated: false,
    sourcePack: 'story',
    duration: trigger.duration ?? template.duration,
    target: applyPct(template.target, districts[district].effect.targetPct),
    reward: applyPct(template.reward, districts[district].effect.rewardPct),
  });
  state.logs.unshift({ id: `log-story-mission-${girl.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `${girl.name}的故事把一份委托带上了地图：${trigger.title}。` });
}
