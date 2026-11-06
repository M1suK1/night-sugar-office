import { useMemo, useState } from 'react';
import { CalendarClock, Coins, MapPin, Sparkles, Users } from 'lucide-react';
import type { GameState } from '../types';
import { loadBalance } from '../balance';
import { meetingDraftOf } from '../rules/meetingOps';
import { meetingPlacesOf } from '../content/meetingPlaces';
import { clockLabel } from '../shift';

/**
 * 会议方案（v168）。
 *
 * 四段：标题 / 地点 / 参会者 / 经费买了什么。底部永远显示这一场要花多少、
 * 会后多久、谁会被恢复疲劳 —— 玩家按下「开会」之前就该知道代价。
 */
export function MeetingPlanDialog({ state, onStart, onClose }: {
  state: GameState;
  onStart: (plan: { title: string; placeId: string; placeName: string; attendeeIds: string[]; buys: string }) => void;
  onClose: () => void;
}) {
  const rules = loadBalance();
  const draft = useMemo(() => meetingDraftOf(state), [state]);
  const places = useMemo(() => meetingPlacesOf(state), [state]);
  const [title, setTitle] = useState(`第 ${state.day} 日的例会`);
  const [placeId, setPlaceId] = useState(places[0]?.id ?? 'lounge');
  // v168：助手默认在名单里（她负责推进议程），其余默认带一位空闲的人。
  const [picked, setPicked] = useState<string[]>(() => {
    const free = draft.available.filter(person => !person.busy).map(person => person.id);
    const host = state.assistantId && free.includes(state.assistantId) ? state.assistantId : undefined;
    return host ? [host, ...free.filter(id => id !== host).slice(0, 1)] : free.slice(0, 2);
  });
  const [buys, setBuys] = useState('');
  const place = places.find(item => item.id === placeId) ?? places[0];
  const cost = draft.costFor(picked.length);
  const short = Math.max(0, cost - state.gold);
  const tooFew = picked.length < draft.minAttendees;
  const tooMany = picked.length > draft.maxAttendees;
  const canStart = !tooFew && !tooMany && short === 0;

  const toggle = (id: string) => setPicked(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]);

  return (
    <div className="standard-modal meeting-plan" id="meeting-plan-dialog" role="dialog" aria-modal="true" aria-label="会议方案">
      <div className="modal-eyebrow"><Sparkles size={14} />议会 · 组织一场会议</div>
      <h2>这一场，要谈什么？</h2>
      <p className="meeting-lead">人、地方、钱都定下来，会议才开得成。开会要占用一小时，参会的人会稍微缓过来一点。</p>

      <label className="meeting-field">
        <span>会议标题</span>
        <input id="meeting-title" value={title} maxLength={24} onChange={event => setTitle(event.target.value)} placeholder="例如：本周排班 / 辖区划分 / 关于空月" />
      </label>

      <section className="meeting-block" aria-label="会议地点">
        <h3><MapPin size={13} />地点</h3>
        <div className="meeting-chips">
          {places.map(item => (
            <button key={item.id} id={`meeting-place-${item.id}`} type="button" className={`vn-chip${item.id === placeId ? ' picked' : ''}`} onClick={() => setPlaceId(item.id)} title={item.note}>
              {item.name}
            </button>
          ))}
        </div>
        {place && <p className="meeting-note">{place.note}</p>}
      </section>

      <section className="meeting-block" aria-label="参会者">
        <h3><Users size={13} />参会者 <small>{picked.length} / {draft.maxAttendees} 人 · 至少 {draft.minAttendees} 人</small></h3>
        <div className="meeting-people">
          {draft.available.map(person => (
            <button
              key={person.id}
              id={`meeting-attendee-${person.id}`}
              type="button"
              className={`meeting-person${picked.includes(person.id) ? ' picked' : ''}${person.busy ? ' busy' : ''}`}
              disabled={person.busy}
              title={person.busy ? person.reason : `疲劳 ${person.fatigue}`}
              onClick={() => toggle(person.id)}
            >
              <b>{person.name}</b>
              <small>{person.busy ? person.reason : `疲劳 ${person.fatigue}`}</small>
            </button>
          ))}
          {!draft.available.length && <p className="meeting-note">事务所里现在没有人能来开会。</p>}
        </div>
      </section>

      <label className="meeting-field">
        <span>经费买了什么 <small>（写什么都行，只是这一段剧情的设定）</small></span>
        <textarea id="meeting-buys" rows={2} maxLength={120} value={buys} onChange={event => setBuys(event.target.value)} placeholder="两盒草莓大福、一壶热可可、一沓便签……（留空就是什么也没买）" />
      </label>

      <div className="meeting-settle" id="meeting-settle">
        <span><Coins size={13} />场地 {rules.meetingBaseCost} + {picked.length} 人 × {rules.meetingPerAttendee} = <b>{cost.toLocaleString('zh-CN')}</b> 星砂</span>
        <span><CalendarClock size={13} />会后 {rules.meetingMinutes} 分钟 · 每人疲劳 −{rules.meetingFatigueRelief}</span>
        {short > 0 && <span className="meeting-short">还差 {short.toLocaleString('zh-CN')} 星砂</span>}
        {tooFew && <span className="meeting-short">至少 {draft.minAttendees} 人</span>}
        {tooMany && <span className="meeting-short">最多 {draft.maxAttendees} 人</span>}
      </div>

      <div className="meeting-actions">
        <button id="meeting-cancel" type="button" className="btn" onClick={onClose}>先不开</button>
        <button
          id="meeting-start"
          type="button"
          className="btn primary"
          disabled={!canStart}
          onClick={() => onStart({ title: title.trim() || `第 ${state.day} 日的例会`, placeId, placeName: place?.name ?? '会客厅', attendeeIds: picked, buys: buys.trim() })}
        >
          开会 · {clockLabel(state.minutes)}
        </button>
      </div>
    </div>
  );
}
