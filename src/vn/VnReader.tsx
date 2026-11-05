import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FastForward, Square } from 'lucide-react';
import { GirlPortrait } from '../components/GirlPortrait';
import { resolveBackdrop } from './backdrops';
import { vnAwaitingChoice, vnBeatKey, vnInitial, vnReducer } from './reducer';
import type { VnBeat, VnCastMember } from './types';
import './vn.css';

const CHAR_MS = 28;
const PAUSE_MS = 900;

/**
 * 视觉小说阅读器（v93）。
 *
 * 只负责「一句一句演」：背景 → 立绘 → 对话框 → 选项。默认关闭，
 * 由设置里的全局开关决定要不要用它（`StoryPlayerDialog` 里挂载）。
 */
export function VnReader({ beats, cast, onChoose, onClose, onText, title }: {
  beats: VnBeat[];
  cast: VnCastMember[];
  onChoose?: (choiceId: string) => void;
  onClose?: () => void;
  /** 切回原文视图（由外层弹窗提供）。 */
  onText?: () => void;
  title?: string;
}) {
  const [state, setState] = useState(() => vnInitial(beats));
  const [auto, setAuto] = useState(false);
  const [fast, setFast] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => { setState(vnInitial(beats)); }, [beats]);

  // 离开时把这次播过的句子记进 sessionStorage（不进存档）。
  useEffect(() => () => rememberBeats(beats), [beats]);

  const beat = state.beats[state.index];
  const typedText = beat?.kind === 'say' ? beat.text : '';
  const [shown, setShown] = useState('');

  // 打字机：快进 / reduced-motion 时直接整句出现。
  useEffect(() => {
    if (beat?.kind !== 'say' || !state.typing) { setShown(typedText); return; }
    if (fast || (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) {
      setShown(typedText);
      setState(current => vnReducer(current, { type: 'typed' }));
      return;
    }
    let cursor = 0;
    setShown('');
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => {
      cursor += 1;
      setShown(typedText.slice(0, cursor));
      if (cursor >= typedText.length) {
        window.clearInterval(timer.current);
        setState(current => vnReducer(current, { type: 'typed' }));
      }
    }, CHAR_MS);
    return () => window.clearInterval(timer.current);
  }, [beat, typedText, state.typing, fast]);

  // 自动播放：打完停顿再前进。
  useEffect(() => {
    if (!auto || state.typing || vnAwaitingChoice(state) || state.done) return;
    const id = window.setTimeout(() => setState(current => vnReducer(current, { type: 'advance' })), PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [auto, state]);

  const advance = useCallback(() => {
    setState(current => vnReducer(current, { type: 'advance' }));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); advance(); return; }
      if (event.key === 'Escape') { onClose?.(); return; }
      if (/^[1-9]$/.test(event.key) && beat?.kind === 'choice') {
        const option = beat.options[Number(event.key) - 1];
        if (option) choose(option.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const choose = (id: string) => {
    if (state.chosenId) return;
    setState(current => ({ ...vnReducer(current, { type: 'choose', id }) }));
    onChoose?.(id);
  };

  // 背景取「当前及之前最近的一条 bg」。
  const backdrop = useMemo(() => {
    for (let at = state.index; at >= 0; at -= 1) {
      const item = state.beats[at];
      if (item?.kind === 'bg') return resolveBackdrop(item.backdrop.id, item.backdrop.tint);
    }
    return resolveBackdrop('night');
  }, [state.index, state.beats]);

  const speaker = beat?.kind === 'say' ? cast.find(member => member.id === beat.speakerId) : undefined;
  const focus = speaker ?? cast[0];

  return (
    <section className="vn-stage" aria-label={title ?? '剧情演出'} style={{ backgroundImage: backdrop.gradient }}>
      {backdrop.image && <img className="vn-backdrop-art" src={backdrop.image} alt="" />}
      <div className="vn-vignette" aria-hidden="true" />
      <div className="vn-cast" aria-hidden="true">
        {focus && (
          <div className="vn-actor">
            <GirlPortrait girl={{ ...focus.girl, expression: beat?.kind === 'say' ? beat.expression ?? focus.girl.expression ?? 'calm' : focus.girl.expression ?? 'calm' }} variant="full" />
          </div>
        )}
      </div>

      <div className="vn-toolbar">
        <button id="vn-auto" type="button" className={`vn-chip ${auto ? 'on' : ''}`} aria-pressed={auto} onClick={() => setAuto(value => !value)}>{auto ? <Square size={11} /> : <ArrowRight size={11} />}自动</button>
        <button id="vn-fast" type="button" className={`vn-chip ${fast ? 'on' : ''}`} aria-pressed={fast} onClick={() => setFast(value => !value)}><FastForward size={11} />快进</button>
        <button id="vn-skip" type="button" className="vn-chip" title="只在本次会话里记住看过的句子" onClick={() => setState(current => vnReducer(current, { type: 'skipSeen', seen: loadSeenBeats() }))}>跳过已读</button>
        {onText && <button id="vn-text" type="button" className="vn-chip" onClick={onText}>原文</button>}
        {onClose && <button id="vn-close" type="button" className="vn-chip" onClick={onClose}>关闭</button>}
      </div>

      <div className="vn-bottom">
        {beat?.kind === 'choice' ? (
          <div className="vn-choices" role="group" aria-label="选择">
            {beat.prompt && <p className="vn-choice-prompt">{beat.prompt}</p>}
            {beat.options.map((option, at) => (
              <button key={option.id} id={`vn-choice-${option.id}`} type="button" className="vn-choice" onClick={() => choose(option.id)}>
                <em>{at + 1}</em>
                <span>{option.label}</span>
                {option.hint && <small>{option.hint}</small>}
              </button>
            ))}
          </div>
        ) : (
          <button className="vn-box" type="button" onClick={advance} aria-live="polite">
            <span className="vn-name">{beat?.kind === 'say' && beat.speakerId !== 'narrator' ? beat.name : '旁白'}</span>
            <span className={`vn-text ${beat?.kind === 'say' && beat.thought ? 'thought' : ''}`}>{state.typing ? shown : typedText || '……'}</span>
            {beat?.kind === 'say' && beat.action && <span className="vn-action">{beat.action}</span>}
            <span className={`vn-next ${state.typing ? '' : 'ready'}`} aria-hidden="true">▼</span>
          </button>
        )}
      </div>
      <span className="vn-progress" aria-hidden="true">{state.done ? '收束' : `${Math.min(state.index + 1, state.beats.length)} / ${state.beats.length}`}</span>
      {(auto || fast) && <span className="vn-mode-note">{fast ? '快进中' : '自动播放'}</span>}
    </section>
  );
}

/** 已读集合（只在本次会话里记，不进存档）。 */
const SEEN_KEY = 'night-sugar:vn-seen';

export function loadSeenBeats(): string[] {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === 'string').slice(-400) : [];
  } catch {
    return [];
  }
}

export function rememberBeats(beats: readonly VnBeat[]): void {
  try {
    const keys = beats.map((beat, index) => vnBeatKey(beat, index));
    const merged = [...new Set([...loadSeenBeats(), ...keys])].slice(-400);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(merged));
  } catch {
    /* 存不进去就算了 */
  }
}
