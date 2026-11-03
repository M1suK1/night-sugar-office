import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, ChevronRight, LoaderCircle, MessageCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import type { CharacterEvent, Expression, Girl, StoryLine } from '../types';
import { GirlPortrait } from './GirlPortrait';
import { DirectorPortrait } from './DirectorPortrait';
import { interleaveTurn } from '../storyLines';

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

/** 交互剧情：直接套用战斗札记的全屏版式——左侧在场角色、右侧所长、中间旁白与台词，底部留行动输入框。 */
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
  useEffect(() => { end.current?.scrollTo?.({ top: end.current.scrollHeight, behavior: 'smooth' }); }, [turns.length, busy]);
  const loading = busy || sending;
  const rounds = turns.filter(turn => turn.role === 'player').length;
  const lastNarrator = [...turns].reverse().find(turn => turn.role === 'narrator');
  const options = (lastNarrator?.options ?? []).slice(0, 3);
  const colorOf = (speakerId: string) => speakerId === 'player' ? '#9a939f' : cast.find(person => person.id === speakerId)?.color ?? '#f3aec9';
  const expressionFor = (person: Girl) => preview?.id === person.id ? preview.expression : latest?.id === person.id ? latest.expression : person.expression ?? 'calm';

  const submit = async (value: string) => {
    const text = value.trim();
    if (!text || loading) return;
    setSending(true);
    setDraft('');
    await onTurn(event.id, text);
    setSending(false);
  };

  return (
    <div className="battle-note-overlay event-overlay" role="dialog" aria-modal="true" aria-label="角色事件">
      <div className="battle-note-shell">
        <header className="battle-note-head">
          <div className="battle-note-head-copy">
            <span className="modal-eyebrow"><Sparkles size={13} />角色剧情 · 已走 {rounds} 轮</span>
            <h2>{event.title}</h2>
            <p>{event.hook}</p>
          </div>
          <div className="battle-note-head-meta">
            <span className="battle-note-source llm">交互剧情</span>
            <button id="event-close" type="button" className="icon-btn" aria-label="关闭事件" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        <div className={`battle-note-stage ${cast.length ? 'has-left' : ''} has-right`}>
          <aside className={`battle-note-side left ${cast.length ? '' : 'empty'} ${cast.length >= 3 ? 'dense' : ''}`} aria-label="在场角色">
            {cast.length > 0 && <span className="battle-note-side-label">在场</span>}
            {cast.map(person => {
              const expression = expressionFor(person);
              const speaking = Boolean(preview && preview.id === person.id) || Boolean(latest && latest.id === person.id);
              return (
                <figure key={person.id} className={`battle-note-portrait ${speaking ? 'speaking' : ''}`} style={{ '--note-color': person.color } as CSSProperties}>
                  <div className="battle-note-portrait-art">
                    <GirlPortrait girl={{ ...person, expression }} variant="full" />
                    <span className="battle-note-expression">{expressionLabel[expression]}</span>
                  </div>
                  <figcaption>
                    <b>{person.name}</b>
                    <small>{person.codename ?? '契约者'}</small>
                  </figcaption>
                </figure>
              );
            })}
          </aside>

          <main className="battle-note-center event-center">
            <div ref={end} className="battle-note-body" role="log" aria-live="polite">
              {turns.length === 0 && <div className="battle-note-loading" role="status"><LoaderCircle size={22} className="spin" /><b>叙事者正在写开场白</b><span>她先开口，你随后决定用什么方式接下去。</span></div>}
              {turns.map((turn, turnIndex) => turn.role === 'player' ? (
                <div key={turn.id} className="battle-note-line right player-turn">
                  <DirectorPortrait className="director-inline" />
                  <span className="battle-note-speaker">所长</span>
                  <span className="battle-note-bubble">{turn.text}</span>
                </div>
              ) : (
                <section key={turn.id} className="story-narrator-turn">
                  {(() => {
                    // 旁白与台词按 after 交织：以前台词全堆在正文之后，读起来像先读小说再看对白。
                    const paragraphs = turn.text.split(/\n+/).filter(Boolean);
                    const turnLines = turn.lines ?? [];
                    const renderLine = (line: StoryLine, index: number) => {
                      const right = line.speakerId === 'player';
                      const active = preview ? preview.id === line.speakerId && !right : false;
                      return (
                        <div key={`${turn.id}-${index}`} className={`battle-note-line ${right ? 'right' : 'left'} ${line.mode === 'thought' ? 'thought' : ''} ${active || right ? 'active' : ''}`}
                          style={{ '--speaker-color': colorOf(line.speakerId) } as CSSProperties}
                          onMouseEnter={() => !right && setPreview({ id: line.speakerId, expression: line.expression })}
                          onMouseLeave={() => setPreview(null)}>
                          {right && <DirectorPortrait className="director-inline" expression={line.expression} />}
                          <span className="battle-note-speaker">{right ? '所长' : line.speakerName}{line.mode === 'thought' ? ' · 心声' : ''}</span>
                          <span className="battle-note-bubble">{line.text}</span>
                        </div>
                      );
                    };
                    return interleaveTurn(paragraphs, turnLines).map(segment => segment.kind === 'narration'
                      ? <p key={`p-${segment.index}`} className="battle-note-narration">{paragraphs[segment.index]}</p>
                      : renderLine(turnLines[segment.index]!, segment.index));
                  })()}
                  {turnIndex > 0 && <button type="button" className="story-rewrite" id={`story-rewrite-${turn.id}`} disabled={loading} onClick={() => void onRewrite(event.id, turn.id)}><RefreshCw size={12} />重写这一段</button>}
                </section>
              ))}
              {loading && turns.length > 0 && <div className="battle-note-loading" role="status"><LoaderCircle size={18} className="spin" /><b>她在等你说完</b></div>}
            </div>

            <footer className="event-composer">
              {options.length > 0 && <div className="session-options"><p className="session-lead" id="session-lead">她没有再往下说。轮到你决定。</p>{options.map((option, index) => <button key={`${option}-${index}`} type="button" id={`story-option-${index}`} disabled={loading} onClick={() => void submit(option)}>{option}</button>)}</div>}
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
          </main>

          <aside className="battle-note-side right" aria-label="所长">
            <span className="battle-note-side-label">所长</span>
            <figure className="battle-note-portrait player" aria-label="所长（玩家）">
              <div className="battle-note-portrait-art event-player-art"><span>所长</span></div>
              <figcaption><b>所长</b><small>你</small></figcaption>
            </figure>
          </aside>
        </div>
      </div>
    </div>
  );
}
