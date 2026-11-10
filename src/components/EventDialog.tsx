import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, Check, ChevronRight, LoaderCircle, MessageCircle, Pencil, RefreshCw, Sparkles, Trash2, X } from 'lucide-react';
import type { CharacterEvent, Expression, Girl, Outfit, PortraitSpec, StoryLine } from '../types';
import { GirlPortrait } from './GirlPortrait';
import { SideCast } from './SideCast';
import { VnReader } from '../vn/VnReader';
import { VnModeRow, VnModeToggle } from '../vn/VnModeToggle';
import { arrangeStoryText, beatsFromPassage, beatsFromTurns } from '../vn/beats';
import { eventClockLabel, expressionAtTurn } from '../storySession';
import { storyBackdropOf } from '../vn/backdrops';
import { scrollTopForNewTurn } from '../storyScroll';

/** 空数组也要稳定引用：否则每次渲染都会重建节拍表。 */
const NO_TURNS: NonNullable<CharacterEvent['turns']> = [];

/** 剧情里可出场的人：名册少女、候选，也包括势力名册里的首领与随从（v160）。 */
export type StoryCastPerson = {
  id: string; name: string; color?: string; portrait?: string; codename?: string;
  expression?: Expression; portraitSpec?: PortraitSpec; wardrobe?: Outfit[];
  outfitId?: string; witch?: boolean; witchForm?: Outfit;
};

export interface EventDialogProps {
  event: CharacterEvent;
  girl?: Girl;
  state: { girls: Girl[]; candidates: Girl[] };
  /** 额外的在场人选（势力首领/随从）；缺省只用名册与候选。 */
  castPool?: StoryCastPerson[];
  busy?: boolean;
  onAdvance: (eventId: string) => void;
  onChoose: (eventId: string, choiceId: string) => void;
  onTurn: (eventId: string, action: string) => Promise<boolean>;
  onRewrite: (eventId: string, turnId: string) => Promise<boolean>;
  /** 手动改写某一轮的文本（v104）。 */
  onEditTurn: (eventId: string, turnId: string, text: string) => void;
  /** 删掉自己说的那一轮。 */
  onDeleteTurn: (eventId: string, turnId: string) => void;
  /** v188：`lead` 是所长停在输入框里、还没发出去的那一句，收尾时当作引子。 */
  onEnd: (eventId: string, lead?: string) => void;
  /** v123：玩家写下的开场（空串 = 按引子开始）。同一个入口也用于重写开场。 */
  onSeed?: (eventId: string, seed: string) => void;
  /** 蓝图正卡在选项上时，这一段能走的分支（文案只来自蓝图，不由模型编）。 */
  branch?: { storylineId: string; options: { id: string; label: string }[] };
  onBranch?: (port: string) => void;
  onClose: () => void;
  /** 已经结束的剧情：只回看，不接任何输入。 */
  readOnly?: boolean;
  /** 视觉小说模式（v93 全局开关）：只决定默认打开舞台，不再决定能不能切。 */
  vnStory?: boolean;
  /** v177：把这一段收进「已保存的剧情」（手动，不再自动存）。 */
  onArchive?: (eventId: string) => void;
}

export function EventDialog({ event, girl, state, castPool, busy = false, onAdvance, onChoose, onTurn, onRewrite, onEditTurn, onDeleteTurn, onEnd, branch, onBranch, onClose, readOnly = false, vnStory = false, onArchive }: EventDialogProps) {
  // v176：演出场景随时可以切。设置里的「视觉小说」只决定提示词怎么写，
  // 不再决定玩家能不能用舞台 —— 以前关了开关，连「演出」按钮都不给。
  const [stageMode, setStageMode] = useState(Boolean(vnStory));
  const stage = stageMode;
  const canStage = !stageMode;
  const shared = { stage, onText: () => setStageMode(false), onStage: canStage ? () => setStageMode(true) : undefined } as const;
  if (event.mode === 'session') {
    return <StorySession event={event} girl={girl} state={state} castPool={castPool} busy={busy} onTurn={onTurn} onRewrite={onRewrite} onEditTurn={onEditTurn} onDeleteTurn={onDeleteTurn} onEnd={onEnd} onArchive={onArchive} branch={branch} onBranch={onBranch} onClose={onClose} readOnly={readOnly} onAdvance={onAdvance} onChoose={onChoose} {...shared} />;
  }
  return <SceneEvent event={event} girl={girl} onAdvance={onAdvance} onChoose={onChoose} onClose={onClose} {...shared} />;
}

function SceneEvent({ event, girl, onAdvance, onChoose, onClose, stage, onText, onStage }: Pick<EventDialogProps, 'event' | 'girl' | 'onAdvance' | 'onChoose' | 'onClose'> & { stage?: boolean; onText?: () => void; onStage?: () => void }) {
  const scene = event.scenes[Math.min(event.stage, event.scenes.length - 1)];
  const [revealed, setRevealed] = useState(1);
  useEffect(() => { setRevealed(1); }, [event.id, event.stage]);

  const stageBeats = useMemo(
      () => beatsFromPassage(
        { id: `${event.id}-${event.stage}`, title: scene?.title ?? '', narration: scene?.narration ?? '', lines: (scene?.lines ?? []).map(line => ({ speaker: line.speaker, text: line.text })), choices: scene?.choices ?? [], scene: 'room:lounge' },
    { speakerId: girl?.id, speakerName: girl?.name, expression: girl?.expression ?? 'calm', element: girl?.element, segment: event.stage },
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
        <span className="modal-eyebrow"><Sparkles size={13} />角色事件 · {eventClockLabel(event)} · 第 {event.stage + 1} / {event.scenes.length} 场</span>
        <h2>{scene.title}</h2>
        <p className="event-title">{event.title} · {event.hook}</p>
      </div>
      {onStage && (
        <VnModeRow><VnModeToggle id="event-vn-enter" onSwitch={onStage} /></VnModeRow>
      )}
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
function StorySession({ event, girl, state, castPool, busy, onTurn, onRewrite, onEditTurn, onDeleteTurn, onEnd, onSeed, onArchive, branch, onBranch, onClose, readOnly = false, stage = false, onText, onStage }: EventDialogProps & { stage?: boolean; onText?: () => void; onStage?: () => void }) {
  const pending = event.pendingChoice ? branch : undefined;
  const turns = event.turns ?? NO_TURNS;
  const [draft, setDraft] = useState('');
  // v104：正在手改的那一轮（id + 草稿），一次只改一条。
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [preview, setPreview] = useState<{ id: string; expression: Expression } | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [sending, setSending] = useState(false);
  // v123：开场由玩家先写一段，叙事者再据此起笔。
  const [seedDraft, setSeedDraft] = useState(event.playerSeed ?? '');
  const [rewriting, setRewriting] = useState(false);
  const sessionActive = event.mode === 'session' && event.status === 'active' && !readOnly;
  const empty = !(event.turns?.length) && !event.opening?.trim();
  const waitingSeed = sessionActive && empty && event.playerSeed === undefined;
  const writingOpening = sessionActive && empty && event.playerSeed !== undefined;
  const rewriteOpen = rewriting && sessionActive && !readOnly;
  // 换了一段事件、或者开场被重写过：草稿要跟着事件走，别把上一段的文字带进来。
  useEffect(() => {
    setSeedDraft(event.playerSeed ?? '');
    setRewriting(false);
  }, [event.id, event.playerSeed]);
  const end = useRef<HTMLDivElement>(null);
  /** 每一轮的 DOM 位置：新内容出现时停在它的开头，而不是滚到结尾。 */
  const turnNodes = useRef(new Map<string, HTMLElement>());
  /** 阅读线：容器顶端往下 110px 以上的最后一轮，就是「正在读」的那一轮。 */
  const readingFrame = useRef(0);
  const measureReading = () => {
    const box = end.current;
    if (!box) return;
    const lineY = box.getBoundingClientRect().top + 110;
    let current = '';
    for (const turn of turns) {
      const node = turnNodes.current.get(turn.id);
      if (!node) continue;
      if (node.getBoundingClientRect().top <= lineY) current = turn.id;
      else break;
    }
    setReadingId(current || turns[0]?.id || '');
  };
  const syncReading = () => {
    if (readingFrame.current) return;
    readingFrame.current = requestAnimationFrame(() => { readingFrame.current = 0; measureReading(); });
  };
  useEffect(() => () => { if (readingFrame.current) cancelAnimationFrame(readingFrame.current); }, []);
  const scrolledTurn = useRef('');
  const pool = useMemo(() => (castPool?.length ? castPool : [...state.girls, ...state.candidates]) as Girl[], [castPool, state.girls, state.candidates]);
  const cast = useMemo(() => {
    const ids = event.cast?.length ? event.cast : girl ? [girl.id] : [];
    return ids.flatMap(id => {
      const found = pool.find(item => item.id === id);
      return found ? [found] : [];
    });
  }, [event.cast, girl, pool]);
  // 交互剧情的节拍：只随轮次变化，避免每次渲染都让舞台回到开头。
  const stageBeats = useMemo(
    () => beatsFromTurns(turns, { playerName: '所长', scene: storyBackdropOf(event) }),
    [turns],
  );
  // v190：原文视图按「读到哪一轮」取表情；以前取整段最后一句，一打开回看就是结局的脸。
  const [readingId, setReadingId] = useState('');
  const latest = useMemo(() => expressionAtTurn(turns, readingId), [turns, readingId]);
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
  // 打开回看 / 新的一轮落地时重算一次：不用等玩家滚动，第一屏就该是这一段的表情。
  useEffect(() => { syncReading(); }, [turns.length, readOnly]);
  const loading = busy || sending;
  const rounds = turns.filter(turn => turn.role === 'player').length;
  const lastNarrator = [...turns].reverse().find(turn => turn.role === 'narrator');
  const options = (lastNarrator?.options ?? []).slice(0, 3);
  const colorOf = (speakerId: string) => speakerId === 'player' ? '#9a939f' : cast.find(person => person.id === speakerId)?.color ?? '#f3aec9';
  const expressionFor = (person: Girl) => preview?.id === person.id ? preview.expression : latest?.id === person.id ? latest.expression : person.expression ?? 'calm';
  // v172：立绘栏要的数据（与战斗札记共用 SideCast）。
  const castGirls = useMemo(() => new Map(cast.map(person => [person.id, person])), [cast]);
  // v234：会议最多 6 人。超过 3 人时左右各站一半，右侧不再固定给「所长」，
  // 否则第 4–6 个人永远轮不上场。
  const castSplit = cast.length > 3 ? Math.ceil(cast.length / 2) : cast.length;
  const leftCast = cast.slice(0, castSplit);
  const rightCast = cast.slice(castSplit);
  const sideOfCast = (id: string) => rightCast.some(person => person.id === id) ? 'right' : 'left';
  const hoveredCastKey = preview ? `${sideOfCast(preview.id)}:${preview.id}` : '';
  const litCastKeys = useMemo(() => [
    ...leftCast.map(person => `left:${person.id}`),
    ...rightCast.map(person => `right:${person.id}`),
  ], [leftCast, rightCast]);
  const castFigureOf = (person: Girl) => ({
    uid: person.id,
    side: 'ally' as const,
    girlId: person.id,
    name: person.name,
    codename: person.codename,
    portrait: person.portrait ?? '',
    portraitAsset: (person as { portraitAsset?: string }).portraitAsset,
    color: person.color ?? '#f3aec9',
    expression: expressionFor(person),
    monster: undefined,
    portraitSpec: person.portraitSpec,
  });
  const stageActiveLine = preview
    ? { speakerId: preview.id, speakerSide: 'ally' as const, expression: preview.expression }
    : latest
      ? { speakerId: latest.id, speakerSide: 'ally' as const, expression: latest.expression }
      : null;

  const submit = async (value: string) => {
    const text = value.trim();
    if (!text || loading) return;
    setSending(true);
    setDraft('');
    await onTurn(event.id, text);
    setSending(false);
  };

  const vnSideOptions = useMemo(() => {
    // 已经结束的剧情只看不写：右侧不要再摆「行动建议」。
    if (readOnly) return undefined;
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
  }, [event.pendingChoice, pending, options, loading, readOnly]);

  // 舞台上的「重写」：对准最近一轮叙事者的回复（开场白与第一轮不重写）。
  const rewriteTarget = useMemo(() => {
    for (let at = turns.length - 1; at > 0; at -= 1) {
      if (turns[at]?.role === 'narrator') return turns[at];
    }
    return undefined;
  }, [turns]);

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
      {/* 这一轮写得短/不满意时，玩家自己决定要不要重来（不再由字数判死） */}
      {rewriteTarget && (
        <button id="story-rewrite-vn" type="button" className="btn" disabled={loading} title="让叙事者把这一轮重写一遍" onClick={() => void onRewrite(event.id, rewriteTarget.id)}>
          <RefreshCw size={12} />重写
        </button>
      )}
      {confirmEnd ? (
        <span className="session-end-confirm">
          <button id="story-end-confirm-vn" type="button" className="btn danger" disabled={busy} onClick={() => { setConfirmEnd(false); onEnd(event.id, draft.trim()); }}>
            {busy ? '正在收尾…' : '确认结束'}
          </button>
          <button id="story-end-cancel-vn" type="button" className="btn" disabled={busy} onClick={() => setConfirmEnd(false)}>
            再聊一会
          </button>
        </span>
      ) : (
        <button id="story-end-vn" type="button" className="btn" onClick={() => setConfirmEnd(true)}>
          {branch && !event.pendingChoice ? '导向结局' : event.meeting ? '结束会议' : '结束事件'}
        </button>
      )}
    </div>
  ) : readOnly ? (
    <div className="vn-session-readonly">
      <span>这段剧情已经结束。{event.turns?.some(turn => turn.id.startsWith('turn-end-')) ? '结局在最后一段。' : ''}</span>
      <button id="story-close-vn" type="button" className="btn primary" onClick={() => { onArchive?.(event.id); onClose(); }}>把这一段收进记忆</button>
    </div>
  ) : null;

  const composerContent = (
    <>
      {readOnly && (
        <div className="session-readonly" id="session-readonly">
          <span>这段剧情已经结束。你现在只是在回看{event.turns?.some(turn => turn.id.startsWith('turn-end-')) ? '，结局在最后一段' : ''}。</span>
          <button id="story-close" type="button" className="btn" onClick={() => { onArchive?.(event.id); onClose(); }}>把这一段收进记忆</button>
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
                  <button id="story-end-confirm" type="button" className="btn danger" disabled={busy} onClick={() => { setConfirmEnd(false); onEnd(event.id, draft.trim()); }}>
                    {busy ? '正在收尾…' : '确认结束'}
                  </button>
                  <button id="story-end-cancel" type="button" className="btn" disabled={busy} onClick={() => setConfirmEnd(false)}>
                    再聊一会
                  </button>
                </span>
              ) : (
                <button id="story-end" type="button" className="btn" onClick={() => setConfirmEnd(true)}>
                  {branch && !event.pendingChoice ? '导向结局' : event.meeting ? '结束会议' : '结束事件'}
                </button>
              )}
            </div>
          )}
        </footer>
      )}
    </>
  );

  // ── 开场：玩家先写一段，叙事者据此起笔（v123）─────────────────────────────
  if ((waitingSeed || writingOpening || rewriteOpen) && onSeed) {
    const busyNow = Boolean(busy || sending) && !rewriteOpen;
    const clearedRounds = turns.filter(turn => turn.role === 'player').length;
    return (
      <div className="battle-note-overlay event-overlay" role="dialog" aria-modal="true" aria-label="开场">
        <div className="battle-note-shell">
          <header className="battle-note-head">
            <div className="battle-note-head-copy">
              <span className="modal-eyebrow"><Sparkles size={13} />{rewriteOpen ? '重写开场' : `开场 · ${eventClockLabel(event)}`}</span>
              <h2>{event.title}</h2>
              <p>{event.hook}</p>
            </div>
            <div className="battle-note-head-meta">
              <button id="event-close" type="button" className="icon-btn" aria-label="关闭事件" onClick={onClose}><X size={18} /></button>
            </div>
          </header>
          <section className="story-opening" id="story-opening">
            <h3 className="story-opening-title">{busyNow ? '她在等你把话说完……' : rewriteOpen ? '把这一面重新说一遍' : event.meeting ? '说说这一场要谈什么' : '提出你的邀约请求'}</h3>
            <p className="story-opening-note">
              {rewriteOpen
                ? `重写会清掉这一段已有的 ${clearedRounds} 轮对话，回到开场之前。`
                : event.playerSeed !== undefined && !busyNow
                  ? '上一次开场没有写出来。改一改再试一次，或者按引子开始。'
                  : '写下你想怎么见这一面：递帖、登门、或者要她的人带路。她不会先开口——先给出你的邀约。不写也行，那就按引子开始。'}
            </p>
            <div className="story-opening-input">
              <span className={`story-opening-beam${seedDraft.trim() ? ' lit' : ''}`} aria-hidden="true" />
              <label className="sr-only" htmlFor="story-opening-seed">你想怎么开始这一夜</label>
              <textarea
                id="story-opening-seed"
                rows={5}
                maxLength={300}
                value={seedDraft}
                disabled={busyNow}
                placeholder={event.hook}
                onChange={input => setSeedDraft(input.target.value)}
              />
              <span className="story-opening-count">{seedDraft.length}/300</span>
            </div>
            <div className="story-opening-actions">
              <button id="story-opening-cancel" type="button" className="btn" onClick={() => { if (rewriteOpen) { setRewriting(false); setSeedDraft(event.playerSeed ?? ''); } else onClose(); }}>
                {rewriteOpen ? '不改了' : '先不进去'}
              </button>
              {!rewriteOpen && (
                <button id="story-opening-default" type="button" className="btn" disabled={busyNow} onClick={() => onSeed(event.id, '')}>
                  按引子开始
                </button>
              )}
              <button id="story-opening-start" type="button" className="btn primary" disabled={busyNow || !seedDraft.trim()} onClick={() => { setRewriting(false); onSeed(event.id, seedDraft); }}>
                {rewriteOpen ? '清空并重写' : event.playerSeed !== undefined ? '重试开场' : '开始这一夜'}
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="battle-note-overlay event-overlay" role="dialog" aria-modal="true" aria-label="角色事件">
      <div className="battle-note-shell">
        <header className="battle-note-head">
          <div className="battle-note-head-copy">
            <span className="modal-eyebrow"><Sparkles size={13} />{event.meeting ? `事务所会议 · ${eventClockLabel(event)} · ${event.meeting.placeName} · ${event.meeting.fee} 星砂` : event.witch ? `魔女化 · ${eventClockLabel(event)} · 已走 ${rounds} 轮` : `角色剧情 · ${eventClockLabel(event)} · 已走 ${rounds} 轮`}</span>
            <h2>{event.title}</h2>
            <p>{event.hook}</p>
            {event.meeting && (
              <p className="event-meeting-line" id="event-meeting-line">
                {event.meeting.attendeeIds.length} 人参会{event.meeting.buys ? ` · 买了 ${event.meeting.buys}` : ' · 什么也没买'}
              </p>
            )}
          </div>
          <div className="battle-note-head-meta">
            <span className="battle-note-source llm">交互剧情</span>
            {onSeed && !readOnly && event.status === 'active' && (
              <button id="story-opening-rewrite" type="button" className="vn-chip" onClick={() => { setSeedDraft(event.playerSeed ?? ''); setRewriting(true); }}>重写开场</button>
            )}
            {onStage && <VnModeToggle id="session-vn-enter" onSwitch={onStage} />}
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
              startAtEnd={readOnly}
              onText={onText}
              onClose={onClose}
            />
          </div>
        ) : (
          <div className={`battle-note-stage ${cast.length ? 'has-left' : ''} has-right`}>
            {/* v172：与战斗札记共用同一个立绘栏 —— 三人走前后三格并轮转换人，
                更多人也只显示焦点所在的三格，不会把立绘压成细条。 */}
            <SideCast
              side="left"
              list={leftCast.map(castFigureOf)}
              // v173：悬停某句台词时，那个人先亮起来并换成那句的表情；没有悬停就跟着最近一句说话的人。
              activeLine={stageActiveLine}
              girlsById={castGirls}
              hoverKey={hoveredCastKey}
              litKeys={litCastKeys}
              resetKey={event.id}
              hideLabel={rightCast.length > 0}
            />

            <main className="battle-note-center event-center">
              <div ref={end} className="battle-note-body" role="log" aria-live="polite" onScroll={syncReading}>
                {turns.length === 0 && (
                  <div className="battle-note-loading" role="status">
                    {loading ? <LoaderCircle size={22} className="spin" /> : null}
                    <b>{loading ? '她正在想怎么接你的话……' : '提出你的邀约请求'}</b>
                    <span>{loading ? '这一段写出来就会接在下面。' : '在「原文」或台上先写一句你想怎么开始这一面。'}</span>
                  </div>
                )}
                {turns.map((turn, turnIndex) => turn.role === 'player' ? (
                  <div key={turn.id} ref={node => { if (node) turnNodes.current.set(turn.id, node); else turnNodes.current.delete(turn.id); }} className="battle-note-line right player-turn">
                    <span className="battle-note-speaker">所长</span>
                    {editing?.id === turn.id ? (
                      <div className="story-turn-editor">
                        <textarea
                          id={`story-edit-input-${turn.id}`}
                          rows={3}
                          maxLength={3000}
                          value={editing.text}
                          onChange={input => setEditing({ id: turn.id, text: input.target.value })}
                        />
                        <div className="story-turn-tools">
                          <button id={`story-edit-save-${turn.id}`} type="button" className="story-rewrite" onClick={() => { onEditTurn(event.id, turn.id, editing.text); setEditing(null); }}><Check size={12} />保存</button>
                          <button id={`story-edit-cancel-${turn.id}`} type="button" className="story-rewrite" onClick={() => setEditing(null)}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className="battle-note-bubble">{turn.text}</span>
                        <div className="story-turn-tools">
                          <button id={`story-edit-${turn.id}`} type="button" className="story-rewrite" onClick={() => setEditing({ id: turn.id, text: turn.text })}><Pencil size={12} />改这句</button>
                          <button id={`story-delete-${turn.id}`} type="button" className="story-rewrite danger" onClick={() => onDeleteTurn(event.id, turn.id)}><Trash2 size={12} />删掉这一句</button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <section key={turn.id} ref={node => { if (node) turnNodes.current.set(turn.id, node); else turnNodes.current.delete(turn.id); }} className="story-narrator-turn">
                    {editing?.id === turn.id ? (
                      <div className="story-turn-editor">
                        <textarea
                          id={`story-edit-input-${turn.id}`}
                          rows={8}
                          maxLength={6000}
                          value={editing.text}
                          onChange={input => setEditing({ id: turn.id, text: input.target.value })}
                        />
                        <p className="story-turn-hint">这一段是旁白正文；台词由模型单独写，想大改可以点「重写这一段」。</p>
                        <div className="story-turn-tools">
                          <button id={`story-edit-save-${turn.id}`} type="button" className="story-rewrite" onClick={() => { onEditTurn(event.id, turn.id, editing.text); setEditing(null); }}><Check size={12} />保存</button>
                          <button id={`story-edit-cancel-${turn.id}`} type="button" className="story-rewrite" onClick={() => setEditing(null)}>取消</button>
                        </div>
                      </div>
                    ) : (() => {
                      // v111：和舞台走同一个 arrangeStoryText，两边的插入位置不会再各算一套。
                      const arranged = arrangeStoryText(turn.text, turn.lines ?? []);
                      const turnLines = arranged.lines;
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
                      return arranged.segments.map(segment => segment.kind === 'narration'
                        ? <p key={`p-${segment.index}`} className="battle-note-narration">{arranged.chunks[segment.index]}</p>
                        : renderLine(turnLines[segment.index]!, segment.index));
                    })()}
                    {editing?.id !== turn.id && <div className="story-turn-tools">
                      <button type="button" className="story-rewrite" id={`story-edit-${turn.id}`} onClick={() => setEditing({ id: turn.id, text: turn.text })}><Pencil size={12} />改旁白</button>
                      {turnIndex > 0 && <button type="button" className="story-rewrite" id={`story-rewrite-${turn.id}`} disabled={loading} onClick={() => void onRewrite(event.id, turn.id)}><RefreshCw size={12} />重写这一段</button>}
                    </div>}
                  </section>
                ))}
                {loading && turns.length > 0 && <div className="battle-note-loading" role="status"><LoaderCircle size={18} className="spin" /><b>她在等你说完</b></div>}
              </div>

              {composerContent}
            </main>

            {rightCast.length > 0 ? (
              <SideCast
                side="right"
                list={rightCast.map(castFigureOf)}
                activeLine={stageActiveLine}
                girlsById={castGirls}
                hoverKey={hoveredCastKey}
                litKeys={litCastKeys}
                resetKey={event.id}
                hideLabel
              />
            ) : (
              <aside className="battle-note-side right" aria-label="所长">
                <span className="battle-note-side-label">所长</span>
                <figure className="battle-note-portrait player" aria-label="所长（玩家）">
                  <div className="battle-note-portrait-art event-player-art"><span>所长</span></div>
                  <figcaption><b>所长</b><small>你</small></figcaption>
                </figure>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
