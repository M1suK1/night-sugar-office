import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, FastForward, Square } from 'lucide-react';
import { GirlPortrait } from '../components/GirlPortrait';
import { resolveBackdrop } from './backdrops';
import { vnAwaitingChoice, vnBeatKey, vnInitial, vnRebase, vnReducer } from './reducer';
import type { VnBeat, VnCastMember } from './types';
import './vn.css';

const CHAR_MS = 28;
const PAUSE_MS = 900;

export interface VnSideOptionItem {
  id: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isBranch?: boolean;
}

export interface VnSideOptions {
  lead?: string;
  items: VnSideOptionItem[];
}

/**
 * 视觉小说阅读器（v98）。
 *
 * 布局特性：
 *  - 舞台背景（有图出图，无图出优雅渐变）
 *  - 人物立绘无背景并贴底站立，放大至撑满舞台大部分高度
 *  - 对话框底部与界面底部齐平，半透明磨砂质感，盖在立绘上能隐约看到立绘下半身
 *  - 发言人专属头像框 + 台词文字跟随角色代表色
 *  - 选项置于界面右侧，且在读到结尾时浮现
 *  - 玩家发言输入栏并入界面底端（位于对话框下方贴底，同样半透明盖在立绘上）
 */
export function VnReader({ beats, cast, onChoose, onClose, onText, title, resetKey, sideOptions, composer }: {
  beats: VnBeat[];
  cast: VnCastMember[];
  onChoose?: (choiceId: string) => void;
  onClose?: () => void;
  /** 切回原文视图（由外层弹窗提供）。 */
  onText?: () => void;
  title?: string;
  /** 换一段演出（不同 event / passage）时用它重置；只追加台词不会打断进度。 */
  resetKey?: string;
  /** 界面右侧选项列（交互剧情的行动建议或分支），在读到结尾时浮现 */
  sideOptions?: VnSideOptions;
  /** 并入界面最底部的输入框操作栏（半透明贴底盖在立绘上） */
  composer?: React.ReactNode;
}) {
  const [state, setState] = useState(() => vnInitial(beats));
  const [auto, setAuto] = useState(false);
  const [fast, setFast] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const keyRef = useRef(resetKey);
  const lengthRef = useRef(beats.length);

  // 换演出（resetKey 变了）→ 从头演；只是追加了新台词 → 接着演，并从「收束」那拍退回新的一句。
  useEffect(() => {
    const prevKey = keyRef.current;
    const prevLen = lengthRef.current;
    keyRef.current = resetKey;
    lengthRef.current = beats.length;
    const reset = prevKey !== resetKey || beats.length < prevLen;
    setState(current => (reset ? vnInitial(beats) : vnRebase(current, beats, prevLen)));
  }, [beats, resetKey]);

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
    // 长旁白按长度等比加速：整段最多约 5 秒打完，不让一整段旁白看得人发困。
    const stride = Math.max(1, Math.ceil(typedText.length / 180));
    timer.current = window.setInterval(() => {
      cursor = Math.min(typedText.length, cursor + stride);
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

  // 长旁白超出框高时，点一下先在框里往下滚，滚到底才前进 —— 否则读不完就被跳走了。
  const boxRef = useRef<HTMLButtonElement | null>(null);
  const advanceOrScroll = useCallback(() => {
    const node = boxRef.current?.querySelector('.vn-box-content') as HTMLElement | null;
    if (node && node.scrollHeight > node.clientHeight + 4 && node.scrollTop + node.clientHeight < node.scrollHeight - 4) {
      node.scrollBy({ top: Math.max(48, node.clientHeight * 0.8), behavior: 'smooth' });
      return;
    }
    advance();
  }, [advance]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') {
        // 如果输入框有焦点，不要拦截 Enter
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) return;
        event.preventDefault();
        advance();
        return;
      }
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

  const isSay = beat?.kind === 'say';
  const isNarrator = isSay && (beat.speakerId === 'narrator' || !beat.speakerId);
  const speaker = isSay && !isNarrator ? cast.find(member => member.id === beat.speakerId) : undefined;
  const focus = speaker ?? cast[0];
  const speakerColor = speaker?.girl.color || focus?.girl.color || '#f3aec9';

  // 是否读到结尾（用于控制右侧建议选项浮现）
  const isAtEnd = state.done || state.index >= state.beats.length - 1;

  return (
    <section className="vn-stage" aria-label={title ?? '剧情演出'} style={{ backgroundImage: backdrop.gradient }}>
      {backdrop.image && <img className="vn-backdrop-art" src={backdrop.image} alt="" />}
      <div className="vn-vignette" aria-hidden="true" />
      <div className="vn-cast" aria-hidden="true">
        {focus && (
          <div className={`vn-actor ${isNarrator ? 'dimmed' : 'active'}`}>
            <GirlPortrait
              girl={{
                ...focus.girl,
                expression: isSay && beat.expression ? beat.expression : focus.girl.expression ?? 'calm',
              }}
              variant="full"
              bare
            />
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
        {/* 1. 建议选项：放在界面右侧，读到结尾再显示 */}
        {isAtEnd && sideOptions && sideOptions.items.length > 0 && (
          <aside className="vn-side-options" role="group" aria-label="行动与分支选项">
            {sideOptions.lead && <p className="vn-side-lead">{sideOptions.lead}</p>}
            <div className="vn-side-list">
              {sideOptions.items.map((opt, i) => (
                <button
                  key={opt.id || i}
                  type="button"
                  className={`vn-side-item ${opt.isBranch ? 'branch' : ''}`}
                  disabled={opt.disabled}
                  onClick={opt.onClick}
                >
                  <span className="vn-side-num">{i + 1}</span>
                  <span className="vn-side-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </aside>
        )}

        <div className="vn-bottom-dock">
          {beat?.kind === 'scene' ? (
            <button className="vn-box vn-scene-card" type="button" onClick={advance}>
              <span className="vn-name">换场</span>
              <span className="vn-text">{beat.title}</span>
              <span className="vn-next ready" aria-hidden="true">▼</span>
            </button>
          ) : beat?.kind === 'choice' ? (
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
            <button ref={boxRef} className={`vn-box ${isNarrator ? 'narration' : ''} ${composer ? 'has-composer' : ''}`} type="button" onClick={advanceOrScroll} aria-live="polite">
              <div className="vn-box-inner">
                {speaker && (
                  <div className="vn-box-avatar" style={{ '--speaker-color': speakerColor } as React.CSSProperties}>
                    <GirlPortrait
                      girl={{
                        ...speaker.girl,
                        expression: isSay && beat.expression ? beat.expression : speaker.girl.expression ?? 'calm',
                      }}
                      variant="avatar"
                      bare
                    />
                  </div>
                )}
                <div className="vn-box-content">
                  {/* 旁白不挂名牌：左上角只留给真正开口的人。 */}
                  {!isNarrator && (
                    <div className="vn-box-meta">
                      <span
                        className="vn-name"
                        style={{ color: speakerColor, borderColor: `${speakerColor}55` }}
                      >
                        {isSay ? beat.name : ''}
                      </span>
                    </div>
                  )}
                  <span
                    className={`vn-text ${isNarrator ? 'thought' : ''}`}
                    style={!isNarrator && speakerColor ? { color: speakerColor } : undefined}
                  >
                    {state.typing ? shown : typedText || '……'}
                  </span>
                  {beat?.kind === 'say' && beat.action && <span className="vn-action">{beat.action}</span>}
                </div>
              </div>
              <span className={`vn-next ${state.typing ? '' : 'ready'}`} aria-hidden="true">▼</span>
            </button>
          )}

          {/* 2. 玩家发言输入框并入界面，紧贴对话框下方，底部齐平，半透明盖在立绘上 */}
          {composer && (
            <div className="vn-composer-bar">
              {composer}
            </div>
          )}
        </div>
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
