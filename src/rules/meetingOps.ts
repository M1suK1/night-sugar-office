/**
 * 事务所会议（v168）。
 *
 * 不新造一套场景系统：会议就是一段带账面的交互剧情。
 * 确认开会时立刻做三件事——扣钱、推进一小时、给参会者降疲劳；剧情本身交给
 * 已有的 `CharacterEvent`（mode: 'session'），开场仍然是玩家先写。
 */
import { loadBalance } from '../balance.ts';
import type { BalanceRules } from '../balance.ts';
import { dateLabel } from './core.ts';
import { advance } from './time.ts';
import type { ActionResult, GameAction, GameState, MeetingPlan } from '../types.ts';
import { meetingPlaceOf } from '../content/meetingPlaces.ts';

/** 一场会议的费用：场地 + 人数 × 单价。 */
export function meetingCostOf(rules: BalanceRules, attendees: number): number {
  const people = Math.max(0, Math.round(attendees));
  return Math.max(0, Math.round(rules.meetingBaseCost + people * rules.meetingPerAttendee));
}

export interface MeetingDraft {
  minAttendees: number;
  maxAttendees: number;
  /** 现在能参会的人（空闲、在册、没退役）。 */
  available: { id: string; name: string; fatigue: number; busy: boolean; reason: string }[];
  /** 召开这场会议要花多少。 */
  costFor: (attendees: number) => number;
}

/** 方案弹窗要用的现场：谁能来、最少/最多几人、费用怎么算。 */
export function meetingDraftOf(state: GameState): MeetingDraft {
  const rules = loadBalance();
  const available = (state.girls ?? []).filter(girl => !girl.dead && !girl.retired && !girl.left).map(girl => {
    const busy = girl.status !== 'idle' || Boolean(girl.loan);
    const reason = busy
      ? girl.loan ? '借调中' : girl.status === 'expedition' ? '出勤中' : girl.status === 'healing' ? '治疗中' : '不在事务所'
      : '';
    return { id: girl.id, name: girl.name, fatigue: girl.fatigue, busy, reason };
  });
  return {
    minAttendees: Math.max(1, Math.round(rules.meetingMinAttendees)),
    maxAttendees: Math.max(2, Math.round(rules.meetingMaxAttendees)),
    available,
    costFor: attendees => meetingCostOf(rules, attendees),
  };
}

function bad(state: GameState, message: string): ActionResult {
  return { state, ok: false, message };
}

/** startMeeting：扣钱 → 推进一小时 → 参会者降疲劳 → 建一段会议剧情。 */
export function applyStartMeeting(state: GameState, action: Extract<GameAction, { type: 'startMeeting' }>): ActionResult {
  const rules = loadBalance();
  const plan = action.plan;
  const title = (plan.title ?? '').trim().slice(0, 24) || '例会';
  const attendees = [...new Set((plan.attendeeIds ?? []).filter(Boolean))];
  const min = Math.max(1, Math.round(rules.meetingMinAttendees));
  const max = Math.max(min, Math.round(rules.meetingMaxAttendees));
  if (attendees.length < min) return bad(state, `至少要 ${min} 个人才开得成会。`);
  if (attendees.length > max) return bad(state, `一场会议最多 ${max} 个人。`);

  const people = attendees.map(id => state.girls.find(girl => girl.id === id));
  if (people.some(girl => !girl)) return bad(state, '名单里有不认识的人，检查一下参会者。');
  const busy = people.filter(girl => girl!.status !== 'idle' || girl!.loan);
  if (busy.length) return bad(state, `${busy.map(girl => girl!.name).join('、')}现在不在事务所里，来不了。`);

  const place = meetingPlaceOf(state, plan.placeId) ?? { id: 'lounge', name: '会客厅', note: '' };
  const fee = meetingCostOf(rules, attendees.length);
  if (state.gold < fee) return bad(state, `这一场要 ${fee} 星砂，手头只有 ${state.gold}。`);

  const at = dateLabel(state.day, state.minutes);
  let next: GameState = {
    ...state,
    gold: state.gold - fee,
    girls: state.girls.map(girl => attendees.includes(girl.id)
      ? { ...girl, fatigue: Math.max(0, girl.fatigue - Math.max(0, Math.round(rules.meetingFatigueRelief))) }
      : girl),
  };

  // 开会要花掉这一小时：走原来的 advance，班次/波次/截止都按正常规则走。
  const advanced = advance(next, Math.max(15, Math.round(rules.meetingMinutes)));
  if (advanced.ok) next = advanced.state;

  const eventId = `meeting-${state.day}-${Date.now().toString(36)}`;
  const meeting: MeetingPlan = {
    title,
    placeId: place.id,
    placeName: place.name,
    attendeeIds: attendees,
    buys: (plan.buys ?? '').trim().slice(0, 120),
    fee,
    day: next.day,
    at,
  };
  next = {
    ...next,
    events: [{
      id: eventId,
      girlId: attendees[0]!,
      title,
      hook: `${place.name}的灯亮着，人都到了。`,
      scenes: [],
      mode: 'session',
      cast: attendees,
      stage: 1,
      status: 'active',
      day: next.day,
      source: 'template',
      badge: true,
      // 会议不是"约谈"：引子只给界面看，开场由玩家先写。
      hookInPrompt: false,
      meeting,
    }, ...next.events],
    logs: [{
      id: `log-meeting-${eventId}`,
      time: dateLabel(next.day, next.minutes),
      kind: 'council',
      text: `${place.name}里开了一场会：「${title}」，${attendees.length} 人参加，花了 ${fee} 星砂${meeting.buys ? `，买了 ${meeting.buys}` : ''}。`,
      delta: -fee,
    }, ...next.logs],
  };
  return { state: next, ok: true, message: `${title}开始了：${attendees.length} 人，花了 ${fee} 星砂。` };
}
