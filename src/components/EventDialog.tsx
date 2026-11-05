import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, ChevronRight, LoaderCircle, MessageCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import type { CharacterEvent, Expression, Girl, StoryLine } from '../types';
import { GirlPortrait } from './GirlPortrait';
import { VnReader } from '../vn/VnReader';
import { beatsFromPassage, beatsFromTurns } from '../vn/beats';
import { interleaveTurn } from '../storyLines';
import { scrollTopForNewTurn } from '../storyScroll';

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
  /** 蓝图正卡在选项上时，这一段能走的分支（文案只来自蓝图，不由模型编）。 */
  branch?: { storylineId: string; options: { id: string; label: string }[] };
  onBranch?: (port: string) => void;
  onClose: () => void;
  /** 已经结束的剧情：只回看，不接任何输入。 */
  readOnly?: boolean;
  /** 视觉小说模式（v93 全局开关）。 */
  vnStory?: boolean;
}

export function EventDialog({ event, girl, state, busy = false, onAdvance, onChoose, onTurn, onRewrite, onEnd, branch, onBranch, onClose, readOnly = false, vnStory = false }: EventDialogProps) {
  // 舞台里点「原文」只切当前弹窗，不改全局开关。
  const [textMode, setTextMode] = useState(false);
  const stage = Boolean(vnStory) && !textMode && !readOnly;
  const shared = { stage, onText: () => setTextMode(true) } as const;
  if (event.mode === 'session') {
    return <StorySession event={event} girl={girl} state={state} busy={busy} onTurn={onTurn} onRewrite={onRewrite} onEnd={onEnd} branch={branch} onBranch={onBranch} onClose={onClose} readOnly={readOnly} onAdvance={onAdvance} onChoose={onChoose} {...shared} />;
  }
  return <SceneEvent event={event} girl={girl} onAdvance={onAdvance} onChoose={onChoose} onClose={onClose} {...shared} />;
}

function SceneEvent({ event, girl, onAdvance, onChoose, onClose, stage, onText }: Pick<EventDialogProps, 'event' | 'girl' | 'onAdvance' | 'onChoose' | 'onClose'> & { stage?: boolean; onText?: () => void }) {
  const scene = event.scenes[Math.min(event.stage, event.scenes.length - 1)];
  const [revealed, setRevealed] = useState(1);
  useEffect(() => { setRevealed(1); }, [event.id, event.stage]);

  const stageBeats = useMemo(
      () => beatsFromPassage(
        { id: `${event.id}-${event.stage}`, title: scene?.title ?? '', narration: scene?.narration ?? '', lines: (scene?.lines ?? []).map(line => ({ speaker: line.speaker, text: line.text })), choices: scene?.choices ?? [], scene: 'room:lounge' },
    { speakerId: girl?.id, speakerName: girl?.name, expression: girl?.expression ?? 'calm', element: girl?.element },
  ), [event.id, event.stage, scene, girl?.id, girl?.name, girl?.expression, girl?.element]);
  if (!scene) return null;
  if (stage) {
    return (
      <div className="event-modal event-modal-stage">
        <VnReader
          beats={stageBeats}
          resetKey={`${event.id}-${event.stage}`}
          title={scene.title}
          cast={girl ? [{ id: girl.id, name: girl.name, girl }] : []}
          onText={onText}
          onClose={onClose}
          onChoose={choiceId => onChoose(event.id, choiceId)}
        />
      </div>
    );
  }
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
function StorySession({ event, girl, state, busy, onTurn, onRewrite, onEnd, branch, onBranch, onClose, readOnly = false, stage = false, onText }: EventDialogProps & { stage?: boolean; onText?: () => void }) {
  const pending = event.pendingChoice ? branch : undefined;
  const turns = event.turns ?? [];
  const [draft, setDraft] = useState('');
  const [preview, setPreview] = useState<{ id: string; expression: Expression } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  /** 每一轮的 DOM 位置：新内容出现时停在它的开头，而不是滚到结尾。 */
  const turnNodes = useRef(new Map<string, HTMLElement>());
  const scrolledTurn = useRef('');
  const pool = useMemo(() => [...state.girls, ...state.candidates], [state.girls, state.candidates]);
  const cast = useMemo(() => {
    const ids = event.cast?.length ? event.cast : girl ? [girl.id] : [];
    return ids.flatMap(id => {
      const found = pool.find(item => item.id === id);
      return found ? [found] : [];
    });
  }, [event.cast, girl, pool]);
  // 交互剧情的节拍：只随轮次变化，避免每次渲染都让舞台回到开头。
  const stageBeats = useMemo(
    () => beatsFromTurns(turns, { playerName: '所长', scene: { id: 'room:lounge' } }),
    [turns],
  );
  const latest = useMemo(() => {
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const line = turns[index]?.lines?.[turns[index]!.lines!.length - 1];
      if (line && line.speakerId !== 'player') return { id: line.speakerId, expression: line.expression };
    }
    return null;
  }, [turns]);
  useEffect(() => {
    const box = end.current;
    if (!box) return;
    const newest = turns.at(-1);
    // 已经定位过这一轮就别再动：否则模型回来的第二次渲染会把人又甩下去。
    if (!newest) return;
    const node = turnNodes.current.get(newest.id);
    if (!node) {
      if (newest.id === scrolledTurn.current) return;
      scrolledTurn.current = newest.id;
      box.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    // 停在这一轮的第一个字上：直接滚到底会先把结局摊在眼前，把剧情剧透掉。
    const top = scrollTopForNewTurn({
      turnId: newest.id,
      lastScrolledId: scrolledTurn.current,
      boxTop: box.getBoundingClientRect().top,
      nodeTop: node.getBoundingClientRect().top,
      scrollTop: box.scrollTop,
    });
    if (top === null) return;
    scrolledTurn.current = newest.id;
    box.scrollTo({ top, behavior: 'smooth' });
  }, [turns.length, turns.at(-1)?.id]);
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

  const vnSideOptions = useMemo(() => {
    if (event.pendingChoice && pending?.options?.length) {
      return {
        lead: '她停在门口，等你拿主意：',
        items: pending.options.map(option => ({
          id: option.id,
          label: option.label,
          onClick: () => onBranch?.(option.id),
          disabled: loading,
          isBranch: true,
        })),
      };
    }
    if (options.length > 0 && !event.pendingChoice) {
      return {
        lead: '行动建议：',
        items: options.map((option, index) => ({
          id: `opt-${index}`,
          label: option,
          onClick: () => void submit(option),
          disabled: loading,
        })),
      };
    }
    return undefined;
  }, [event.pendingChoice, pending, options, loading]);

  const vnComposerSlot = !readOnly && !event.pendingChoice ? (
    <div className="vn-session-input">
      <label className="sr-only" htmlFor="story-action-vn">写下你的行动</label>
      <textarea
        id="story-action-vn"
        rows={1}
        maxLength={300}
        value={draft}
        disabled={loading}
        placeholder={loading ? '她正在回应……' : '写下你要做的事，或说的话…… (Ctrl+Enter 发送)'}
        onChange={input => setDraft(input.target.value)}
        onKeyDown={input => {
          if ((input.ctrlKey || input.metaKey) && input.key === 'Enter') {
            input.preventDefault();
            void submit(draft);
          }
        }}
      />
      <button id="story-submit-vn" type="button" className="btn primary" disabled={!draft.trim() || loading} onClick={() => void submit(draft)}>
        行动
      </button>
      {confirmEnd ? (
        <span className="session-end-confirm">
          <button id="story-end-confirm-vn" type="button" className="btn danger" disabled={busy} onClick={() => { setConfirmEnd(false); onEnd(event.id); }}>
            {busy ? '正在收尾…' : '确认结束'}
          </button>
          <button id="story-end-cancel-vn" type="button" className="btn" disabled={busy} onClick={() => setConfirmEnd(false)}>
            再聊一会
          </button>
        </span>
      ) : (
        <button id="story-end-vn" type="button" className="btn" onClick={() => setConfirmEnd(true)}>
          {branch && !event.pendingChoice ? '导向结局' : '结束事件'}
        </button>
      )}
    </div>
  ) : readOnly ? (
    <div className="vn-session-readonly">
      <span>这段剧情已经结束。{event.turns?.some(turn => turn.id.startsWith('turn-end-')) ? '结局在最后一段。' : ''}</span>
      <button id="story-close-vn" type="button" className="btn primary" onClick={onClose}>把这一段收进记忆</button>
    </div>
  ) : null;

  const composerContent = (
    <>
      {readOnly && (
        <div className="session-readonly" id="session-readonly">
          <span>这段剧情已经结束。你现在只是在回看{event.turns?.some(turn => turn.id.startsWith('turn-end-')) ? '，结局在最后一段' : ''}。</span>
          <button id="story-close" type="button" className="btn" onClick={onClose}>把这一段收进记忆</button>
        </div>
      )}
      {!readOnly && (
        <footer className="event-composer">
          {event.pendingChoice && (
            <div className="session-options branch-options" id="session-branch">
              <p className="session-lead">她停在门口，等你拿主意。选完这段剧情就结束。</p>
              {(pending?.options ?? []).map(option => (
                <button key={option.id} id={`story-branch-${option.id}`} type="button" disabled={loading} onClick={() => onBranch?.(option.id)}>
                  {option.label}
                </button>
              ))}
            </div>
          )}
          {options.length > 0 && !event.pendingChoice && (
            <div className="session-options">
              <p className="session-lead" id="session-lead">她没有再往下说。轮到你决定。</p>
              {options.map((option, index) => (
                <button key={`${option}-${index}`} type="button" id={`story-option-${index}`} disabled={loading} onClick={() => void submit(option)}>
                  {option}
                </button>
              ))}
            </div>
          )}
          {!event.pendingChoice && (
            <div className="session-input">
              <label className="sr-only" htmlFor="story-action">写下你的行动</label>
              <textarea
                id="story-action"
                rows={2}
                maxLength={300}
                value={draft}
                disabled={loading}
                placeholder={loading ? '她正在回应……' : '写下你要做的事，或说的话……'}
                onChange={input => setDraft(input.target.value)}
                onKeyDown={input => {
                  if ((input.ctrlKey || input.metaKey) && input.key === 'Enter') {
                    input.preventDefault();
                    void submit(draft);
                  }
                }}
              />
              <button id="story-submit" type="button" className="btn primary" disabled={!draft.trim() || loading} onClick={() => void submit(draft)}>
                行动
              </button>
              {confirmEnd ? (
                <span className="session-end-confirm">
                  <button id="story-end-confirm" type="button" className="btn danger" disabled={busy} onClick={() => { setConfirmEnd(false); onEnd(event.id); }}>
                    {busy ? '正在收尾…' : '确认结束'}
                  </button>
                  <button id="story-end-cancel" type="button" className="btn" disabled={busy} onClick={() => setConfirmEnd(false)}>
                    再聊一会
                  </button>
                </span>
              ) : (
                <button id="story-end" type="button" className="btn" onClick={() => setConfirmEnd(true)}>
                  {branch && !event.pendingChoice ? '导向结局' : '结束事件'}
                </button>
              )}
            </div>
          )}
        </footer>
      )}
    </>
  );

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

        {stage ? (
          <div className="event-stage-wrap">
            <VnReader
              beats={stageBeats}
              resetKey={event.id}
              title={event.title}
              cast={cast.map(person => ({ id: person.id, name: person.name, girl: person }))}
              sideOptions={vnSideOptions}
              composer={vnComposerSlot}
              onText={onText}
              onClose={onClose}
            />
          </div>
        ) : (
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
                  <div key={turn.id} ref={node => { if (node) turnNodes.current.set(turn.id, node); else turnNodes.current.delete(turn.id); }} className="battle-note-line right player-turn">
                    <span className="battle-note-speaker">所长</span>
                    <span className="battle-note-bubble">{turn.text}</span>
                  </div>
                ) : (
                  <section key={turn.id} ref={node => { if (node) turnNodes.current.set(turn.id, node); else turnNodes.current.delete(turn.id); }} className="story-narrator-turn">
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

              {composerContent}
            </main>

            <aside className="battle-note-side right" aria-label="所长">
              <span className="battle-note-side-label">所长</span>
              <figure className="battle-note-portrait player" aria-label="所长（玩家）">
                <div className="battle-note-portrait-art event-player-art"><span>所长</span></div>
                <figcaption><b>所长</b><small>你</small></figcaption>
              </figure>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
