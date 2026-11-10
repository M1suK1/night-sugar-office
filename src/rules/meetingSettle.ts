/**
 * 会议结算（v168）：参会者两两涨关系，并留一条会议记录。
 *
 * 放在这里而不是 `meetingOps`，是因为它由「结束事件」触发，和剧情收尾是同一件事；
 * `meetingOps` 只负责开会那一刻（扣钱 / 推进时间 / 降疲劳 / 建事件）。
 */
import { loadBalance } from '../balance.ts';
import { dateLabel } from './core.ts';
import type { CharacterEvent, GameState, MeetingRecord } from '../types.ts';

export const MEETING_RECORD_MAX = 30;

/** 结算一场会议：关系两两 +N，写一条会议记录，写日志。 */
export function settleMeeting(state: GameState, event: CharacterEvent, summary: string): MeetingRecord | undefined {
  const plan = event.meeting;
  if (!plan) return undefined;
  const rules = loadBalance();
  const gain = Math.max(0, Math.round(rules.meetingRelationBase));
  const ids = plan.attendeeIds.filter(id => state.girls.some(girl => girl.id === id));
  if (!ids.length) return undefined;
  const kind = plan.kind === 'wedding' ? 'wedding' : 'meeting';
  const partner = kind === 'wedding' && plan.partnerId
    ? state.girls.find(girl => girl.id === plan.partnerId)
    : undefined;
  // 婚礼只在剧情正常收尾时落账：中途关掉不算，可以重新办。
  if (partner?.oath && !partner.wedding) {
    partner.wedding = { day: plan.day, at: plan.at || dateLabel(state.day, state.minutes), eventId: event.id, placeName: plan.placeName };
  }

  for (const girl of state.girls) {
    if (!ids.includes(girl.id)) continue;
    for (const peer of ids) {
      if (peer === girl.id) continue;
      const current = girl.relationships[peer] ?? 40;
      girl.relationships[peer] = Math.max(0, Math.min(100, current + gain));
    }
  }

  const record: MeetingRecord = {
    id: `meeting-record-${event.id}`,
    eventId: event.id,
    kind,
    partnerId: kind === 'wedding' ? plan.partnerId : undefined,
    partnerName: kind === 'wedding' ? partner?.name : undefined,
    day: plan.day,
    at: plan.at || dateLabel(state.day, state.minutes),
    title: plan.title,
    placeName: plan.placeName,
    attendees: ids.map(id => ({ id, name: state.girls.find(girl => girl.id === id)?.name ?? id })),
    buys: plan.buys,
    fee: plan.fee,
    summary: (summary || '').slice(0, 600) || (kind === 'wedding'
      ? `${plan.title}：${partner?.name ?? '她'}与所长在${plan.placeName}举行了婚礼。`
      : `${plan.title}：${ids.length} 人在${plan.placeName}坐了一小时。`),
    relationshipGain: gain,
  };
  state.meetings = [record, ...(state.meetings ?? [])].slice(0, MEETING_RECORD_MAX);
  state.logs.unshift({
    id: `log-meeting-done-${event.id}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'council',
    text: kind === 'wedding' && partner
      ? `${partner.name}与所长的婚礼结束：${record.attendees.map(person => person.name).join('、')}之间关系 +${gain}。`
      : `「${plan.title}」散会：${record.attendees.map(person => person.name).join('、')}之间关系 +${gain}。`,
  });
  return record;
}

/** 读档时洗一遍会议记录：坏条目丢掉，字段补齐。 */
export function sanitizeMeetingRecords(raw: unknown): MeetingRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MEETING_RECORD_MAX).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    const title = typeof value.title === 'string' ? value.title.slice(0, 40) : "";
    const eventId = typeof value.eventId === 'string' ? value.eventId : "";
    if (!title && !eventId) return [];
    const attendees = Array.isArray(value.attendees)
      ? value.attendees.flatMap(entry => {
        if (!entry || typeof entry !== 'object') return [];
        const person = entry as Record<string, unknown>;
        const id = typeof person.id === 'string' ? person.id : '';
        const name = typeof person.name === 'string' ? person.name : '';
        return id && name ? [{ id, name }] : [];
      })
      : [];
    return [{
      id: typeof value.id === 'string' && value.id ? value.id : `meeting-record-${index}`,
      eventId,
      kind: value.kind === 'wedding' ? 'wedding' : 'meeting',
      partnerId: typeof value.partnerId === 'string' && value.partnerId ? value.partnerId : undefined,
      partnerName: typeof value.partnerName === 'string' && value.partnerName ? value.partnerName.slice(0, 40) : undefined,
      day: Number.isFinite(Number(value.day)) ? Math.max(0, Math.round(Number(value.day))) : 0,
      at: typeof value.at === 'string' ? value.at.slice(0, 32) : '',
      title: title || '一场会议',
      placeName: typeof value.placeName === 'string' ? value.placeName.slice(0, 24) : '会客厅',
      attendees,
      buys: typeof value.buys === 'string' ? value.buys.slice(0, 120) : '',
      fee: Number.isFinite(Number(value.fee)) ? Math.max(0, Math.round(Number(value.fee))) : 0,
      summary: typeof value.summary === 'string' ? value.summary.slice(0, 600) : '',
      relationshipGain: Number.isFinite(Number(value.relationshipGain)) ? Math.max(0, Math.round(Number(value.relationshipGain))) : 0,
    }];
  });
}