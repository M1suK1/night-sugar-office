import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronRight, LoaderCircle, MessageCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import type { CharacterEvent, Expression, Girl, StoryLine } from '../types';
import { GirlPortrait } from './GirlPortrait';

const expressionLabel: Record<Expression, string> = {
  calm: '平静', smile: '微笑', surprise: '惊讶', sad: '难过', angry: '生气', shy: '害羞',
};

export interface EventDialogProps {
  event: CharacterEvent;
  girl?: Girl;
  state: { girls: Girl[]; candidates: Girl[] };
  busy?: boolean;
  onAdvance: (eventId: string) => void;
  onChoose: (eventId: string, choiceId: string) => void;
  onTurn: (eventId: string, action: string) => Promise<boolean>;
  onRewrite: (eventId: string, turnId: string) => Promise<boolean>;
  onEnd: (eventId: string) => void;
  onClose: () => void;
}

export function EventDialog({ event, girl, state, busy = false, onAdvance, onChoose, onTurn, onRewrite, onEnd, onClose }: EventDialogProps) {
  if (event.mode === 'session') {
    return <StorySession event={event} girl={girl} state={state} busy={busy} onTurn={onTurn} onRewrite={onRewrite} onEnd={onEnd} onClose={onClose} onAdvance={onAdvance} onChoose={onChoose} />;
  }
  return <SceneEvent event={event} girl={girl} onAdvance={onAdvance} onChoose={onChoose} onClose={onClose} />;
}

function SceneEvent({ event, girl, onAdvance, onChoose, onClose }: Pick<EventDialogProps, 'event' | 'girl' | 'onAdvance' | 'onChoose' | 'onClose'>) {
  const scene = event.scenes[Math.min(event.stage, event.scenes.length - 1)];
  const [revealed, setRevealed] = useState(1);
  useEffect(() => { setRevealed(1); }, [event.id, event.stage]);

  if (!scene) return null;
  const allShown = revealed >= scene.lines.length;
  const last = event.stage >= event.scenes.length - 1;

  return (
    <div className="event-modal">
      <button id="event-close" type="button" className="event-close" aria-label="关闭事件" onClick={onClose}><X size={15} /></button>
      <div className="event-head">
        <span className="modal-eyebrow"><Sparkles size={13} />角色事件 · 第 {event.stage + 1} / {event.scenes.length} 场</span>
        <h2>{scene.title}</h2>
        <p className="event-title">{event.title} · {event.hook}</p>
      </div>
      <div className="event-body">
        {girl && <div className="event-figure"><GirlPortrait girl={girl} variant="full" /></div>}
        <div className="event-script" role="log">
          <p className="event-narration">{scene.narration}</p>
          {scene.lines.slice(0, revealed).map((line, index) => (
            <p key={index} className={`event-line ${line.tone ?? ''}`}>
              <b>{line.speaker}</b>
              <span>{line.text}</span>
            </p>
          ))}
        </div>
      </div>
      <footer className="event-actions">
        {!allShown ? (
          <button id="event-next-line" type="button" className="btn primary" onClick={() => setRevealed(value => value + 1)}><MessageCircle size={14} />继续<ChevronRight size={14} /></button>
        ) : last && scene.choices?.length ? (
          <div className="event-choices">
            {scene.choices.map(choice => (
              <button key={choice.id} id={`event-choice-${choice.id}`} type="button" className="btn" onClick={() => onChoose(event.id, choice.id)}>{choice.label}<ArrowRight size={13} /></button>
            ))}
          </div>
        ) : last ? (
          <button id="event-finish" type="button" className="btn primary" onClick={onClose}>把这一幕收进记忆</button>
        ) : (
          <button id="event-advance" type="button" className="btn primary" onClick={() => onAdvance(event.id)}>下一场<ArrowRight size={14} /></button>
        )}
      </footer>
    </div>
  );
}

/** 交互剧情：旁白 + 台词气泡 + 立绘表情；玩家用灰框、只显示名字。 */
function StorySession({ event, girl, state, busy, onTurn, onRewrite, onEnd, onClose }: EventDialogProps) {
  const turns = event.turns ?? [];
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState<{ id: string; expression: Expression } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const pool = useMemo(() => [...state.girls, ...state.candidates], [state.girls, state.candidates]);
  const cast = useMemo(() => {
    const ids = event.cast?.length ? event.cast : girl ? [girl.id] : [];
    return ids.flatMap(id => {
      const found = pool.find(item => item.id === id);
      return found ? [found] : [];
    });
  }, [event.cast, girl, pool]);
  const latest = useMemo(() => {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const line = turns[index]?.lines?.[turns[index]!.lines!.length - 1];
      if (line && line.speakerId !== 'player') return { id: line.speakerId, expression: line.expression };
    }
    return null;
  }, [turns]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [turns.length, busy]);
  const loading = busy || sending;
  const rounds = turns.filter(turn => turn.role === 'player').length;
  const lastNarrator = [...turns].reverse().find(turn => turn.role === 'narrator');
  const options = (lastNarrator?.options ?? []).slice(0, 3);

  const submit = async (value: string) => {
    const text = value.trim();
    if (!text || loading) return;
    setSending(true);
    setDraft('');
    await onTurn(event.id, text);
    setSending(false);
  };

  const lineClass = (line: StoryLine) => {
    const active = preview ? preview.id === line.speakerId && line.speakerId !== 'player' : false;
    return `story-line ${line.speakerId === 'player' ? 'player' : 'girl'} ${line.mode === 'thought' ? 'thought' : ''} ${active ? 'active' : ''}`;
  };

  return (
    <div className="event-modal story-session">
      <button id="event-close" type="button" className="event-close" aria-label="关闭事件" onClick={onClose}><X size={15} /></button>
      <header className="session-head">
        <span className="modal-eyebrow"><Sparkles size={13} />角色剧情 · 已走 {rounds} 轮</span>
        <h2>{event.title}</h2>
        <p className="event-title">{event.hook}</p>
      </header>
      <div className="session-body">
        <aside className="session-cast" aria-label="在场角色">
          {cast.map(person => {
            const shown = preview && preview.id === person.id ? preview.expression : latest && latest.id === person.id ? latest.expression : person.expression ?? 'calm';
            return <figure key={person.id} className="story-portrait" style={{ ['--note-color' as string]: person.color }}>
              <div className="story-portrait-art"><GirlPortrait girl={{ ...person, expression: shown }} variant="full" /></div>
              <figcaption><b>{person.name}</b><small>{expressionLabel[shown]}</small></figcaption>
            </figure>;
          })}
          <figure className="story-portrait player" aria-label="所长（玩家）">
            <div className="story-portrait-art"><span>所长</span></div>
            <figcaption><b>所长</b><small>你</small></figcaption>
          </figure>
        </aside>
        <div className="session-stream" role="log" aria-live="polite">
          {turns.length === 0 && <div className="session-loading"><LoaderCircle size={18} className="spin" />叙事者正在写开场白</div>}
          {turns.map((turn, turnIndex) => turn.role === 'player' ? (
            <div key={turn.id} className="story-player-turn"><small>所长</small><p>{turn.text}</p></div>
          ) : (
            <section key={turn.id} className="story-narrator-turn">
              {turn.text.split(/\n+/).filter(Boolean).map((paragraph, index) => <p key={index} className="story-narration">{paragraph}</p>)}
              {(turn.lines ?? []).length > 0 && <div className="story-lines">
                {(turn.lines ?? []).map((line, index) => (
                  <div key={`${turn.id}-${index}`} className={lineClass(line)}
                    style={{ ['--note-color' as string]: line.speakerId === 'player' ? '#9a939f' : cast.find(person => person.id === line.speakerId)?.color ?? '#f3aec9' }}
                    onMouseEnter={() => line.speakerId !== 'player' && setPreview({ id: line.speakerId, expression: line.expression })}
                    onMouseLeave={() => setPreview(null)}>
                    <b>{line.speakerId === 'player' ? '所长' : line.speakerName}{line.mode === 'thought' ? ' · 心声' : ''}</b>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>}
              {turnIndex > 0 && <button type="button" className="story-rewrite" id={`story-rewrite-${turn.id}`} disabled={loading} onClick={() => void onRewrite(event.id, turn.id)}><RefreshCw size={12} />重写这一段</button>}
            </section>
          ))}
          {loading && turns.length > 0 && <div className="session-loading"><LoaderCircle size={16} className="spin" />她在等你说完</div>}
          <div ref={end} />
        </div>
      </div>
      <footer className="session-foot">
        {options.length > 0 && <div className="session-options">{options.map((option, index) => <button key={`${option}-${index}`} type="button" id={`story-option-${index}`} disabled={loading} onClick={() => void submit(option)}>{option}</button>)}</div>}
        <div className="session-input">
          <label className="sr-only" htmlFor="story-action">写下你的行动</label>
          <textarea id="story-action" rows={2} maxLength={300} value={draft} disabled={loading} placeholder={loading ? '她正在回应……' : '写下你要做的事，或说的话……'} onChange={input => setDraft(input.target.value)} onKeyDown={input => { if ((input.ctrlKey || input.metaKey) && input.key === 'Enter') { input.preventDefault(); void submit(draft); } }} />
          <button id="story-submit" type="button" className="btn primary" disabled={!draft.trim() || loading} onClick={() => void submit(draft)}>行动</button>
          {confirmEnd ? <span className="session-end-confirm">
            <button id="story-end-confirm" type="button" className="btn danger" onClick={() => onEnd(event.id)}>确认结束</button>
            <button id="story-end-cancel" type="button" className="btn" onClick={() => setConfirmEnd(false)}>再聊一会</button>
          </span> : <button id="story-end" type="button" className="btn" onClick={() => setConfirmEnd(true)}>结束事件</button>}
        </div>
      </footer>
    </div>
  );
}
