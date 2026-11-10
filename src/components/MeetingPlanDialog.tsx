import { useMemo, useState } from 'react';
import { CalendarClock, Coins, Heart, MapPin, Sparkles, Users } from 'lucide-react';
import type { GameState } from '../types';
import { loadBalance } from '../balance';
import { meetingDraftOf, weddingCandidatesOf } from '../rules/meetingOps';
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
  onStart: (plan: { title: string; placeId: string; placeName: string; attendeeIds: string[]; buys: string; kind?: 'meeting' | 'wedding'; partnerId?: string }) => void;
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
  const [mode, setMode] = useState<'meeting' | 'wedding'>('meeting');
  const [partnerId, setPartnerId] = useState('');
  const weddings = useMemo(() => weddingCandidatesOf(state), [state]);
  const weddable = weddings.filter(person => !person.busy);
  const bride = weddings.find(person => person.id === partnerId);
  const place = places.find(item => item.id === placeId) ?? places[0];
  const cost = draft.costFor(picked.length);
  const short = Math.max(0, cost - state.gold);
  const tooFew = picked.length < draft.minAttendees;
  const tooMany = picked.length > draft.maxAttendees;
  const brideMissing = mode === 'wedding' && (!partnerId || !picked.includes(partnerId));
  const canStart = !tooFew && !tooMany && short === 0 && !brideMissing;

  const toggle = (id: string) => {
    if (mode === 'wedding' && id === partnerId) return;
    setPicked(list => list.includes(id) ? list.filter(item => item !== id) : [...list, id]);
  };

  const pickBride = (id: string) => {
    const person = weddings.find(item => item.id === id);
    if (!person || person.busy) return;
    setPartnerId(id);
    setTitle(`与${person.name}的婚礼`);
    setPicked(prev => {
      const others = prev.filter(item => item !== id);
      const missing = Math.max(0, draft.minAttendees - 1 - others.length);
      const fillers = draft.available
        .filter(item => !item.busy && item.id !== id && !others.includes(item.id))
        .slice(0, missing)
        .map(item => item.id);
      return [id, ...others, ...fillers].slice(0, draft.maxAttendees);
    });
  };

  const switchMode = (next: 'meeting' | 'wedding') => {
    setMode(next);
    if (next === 'meeting') {
      setPartnerId('');
      if (title.startsWith('与')) setTitle(`第 ${state.day} 日的例会`);
      return;
    }
    const first = weddable[0];
    if (first) pickBride(first.id);
  };

  return (
    <div className="standard-modal meeting-plan" id="meeting-plan-dialog" role="dialog" aria-modal="true" aria-label="会议方案">
      <div className="modal-eyebrow"><Sparkles size={14} />议会 · 组织一场会议</div>
      <h2>这一场，要谈什么？</h2>
      <p className="meeting-lead">{mode === 'wedding'
        ? '把新娘、地方和人定下来，婚礼就开始了。同样占用一小时，费用与开会一致。'
        : '人、地方、钱都定下来，会议才开得成。开会要占用一小时，参会的人会稍微缓过来一点。'}</p>

      {weddings.length > 0 && (
        <div className="meeting-modes" role="tablist" aria-label="会议类型">
          <button id="meeting-mode-meeting" type="button" role="tab" aria-selected={mode === 'meeting'} className={`vn-chip${mode === 'meeting' ? ' picked' : ''}`} onClick={() => switchMode('meeting')}>例会</button>
          <button id="meeting-mode-wedding" type="button" role="tab" aria-selected={mode === 'wedding'} className={`vn-chip${mode === 'wedding' ? ' picked' : ''}`} disabled={!weddable.length} title={weddable.length ? '为已誓约的人办婚礼' : '已誓约的人现在都不在事务所'} onClick={() => switchMode('wedding')}>婚礼</button>
        </div>
      )}

      <label className="meeting-field">
        <span>{mode === 'wedding' ? '婚礼标题' : '会议标题'}</span>
        <input id="meeting-title" value={title} maxLength={24} onChange={event => setTitle(event.target.value)} placeholder={mode === 'wedding' ? '例如：与她的婚礼' : '例如：本周排班 / 辖区划分 / 关于空月'} />
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

      {mode === 'wedding' && (
        <section className="meeting-block" aria-label="新娘">
          <h3><Heart size={13} />新娘 <small>已誓约</small></h3>
          <div className="meeting-chips">
            {weddings.map(person => (
              <button
                key={person.id}
                id={`meeting-bride-${person.id}`}
                type="button"
                className={`vn-chip${partnerId === person.id ? ' picked' : ''}`}
                disabled={person.busy}
                title={person.busy ? person.reason : `疲劳 ${person.fatigue}`}
                onClick={() => pickBride(person.id)}
              >
                {person.name}{person.busy ? ` · ${person.reason}` : ''}
              </button>
            ))}
          </div>
          {!weddable.length && <p className="meeting-note">已誓约的人现在都不在事务所，等她们空闲下来再办。</p>}
        </section>
      )}

      <section className="meeting-block" aria-label="参会者">
        <h3><Users size={13} />参会者 <small>{picked.length} / {draft.maxAttendees} 人 · 至少 {draft.minAttendees} 人</small></h3>
        <div className="meeting-people">
          {draft.available.map(person => {
            const locked = mode === 'wedding' && person.id === partnerId;
            return (
              <button
                key={person.id}
                id={`meeting-attendee-${person.id}`}
                type="button"
                className={`meeting-person${picked.includes(person.id) ? ' picked' : ''}${person.busy ? ' busy' : ''}${locked ? ' locked' : ''}`}
                disabled={person.busy || locked}
                title={locked ? '新娘必须在场' : person.busy ? person.reason : `疲劳 ${person.fatigue}`}
                onClick={() => toggle(person.id)}
              >
                <b>{person.name}{locked ? ' · 新娘' : ''}</b>
                <small>{locked ? '已锁定' : person.busy ? person.reason : `疲劳 ${person.fatigue}`}</small>
              </button>
            );
          })}
          {!draft.available.length && <p className="meeting-note">事务所里现在没有人能来开会。</p>}
        </div>
      </section>

      <label className="meeting-field">
        <span>{mode === 'wedding' ? '婚礼上买了什么' : '经费买了什么'} <small>（写什么都行，只是这一段剧情的设定）</small></span>
        <textarea id="meeting-buys" rows={2} maxLength={120} value={buys} onChange={event => setBuys(event.target.value)} placeholder={mode === 'wedding' ? '捧花、喜糖、一条新桌布……（留空就是什么也没买）' : '两盒草莓大福、一壶热可可、一沓便签……（留空就是什么也没买）'} />
      </label>

      <div className="meeting-settle" id="meeting-settle">
        <span><Coins size={13} />场地 {rules.meetingBaseCost} + {picked.length} 人 × {rules.meetingPerAttendee} = <b>{cost.toLocaleString('zh-CN')}</b> 星砂</span>
        <span><CalendarClock size={13} />会后 {rules.meetingMinutes} 分钟 · 每人疲劳 −{rules.meetingFatigueRelief}</span>
        {mode === 'wedding' && <span><Heart size={13} />誓约戒指已在缔结时买过，不再单收</span>}
        {brideMissing && <span className="meeting-short">先选一位新娘</span>}
        {short > 0 && <span className="meeting-short">还差 {short.toLocaleString('zh-CN')} 星砂</span>}
        {tooFew && <span className="meeting-short">至少 {draft.minAttendees} 人</span>}
        {tooMany && <span className="meeting-short">最多 {draft.maxAttendees} 人</span>}
      </div>

      <div className="meeting-actions">
        <button id="meeting-cancel" type="button" className="btn" onClick={onClose}>{mode === 'wedding' ? '先不办' : '先不开'}</button>
        <button
          id="meeting-start"
          type="button"
          className="btn primary"
          disabled={!canStart}
          onClick={() => onStart({
            title: title.trim() || (mode === 'wedding' && bride ? `与${bride.name}的婚礼` : `第 ${state.day} 日的例会`),
            placeId, placeName: place?.name ?? '会客厅', attendeeIds: picked, buys: buys.trim(),
            kind: mode, partnerId: mode === 'wedding' ? partnerId : undefined,
          })}
        >
          {mode === 'wedding' ? '举行婚礼' : '开会'} · {clockLabel(state.minutes)}
        </button>
      </div>
    </div>
  );
}
