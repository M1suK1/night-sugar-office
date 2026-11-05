import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clock3, Coins, Heart, Moon, ShieldCheck, X } from 'lucide-react';
import type { GameState, Opinion } from '../types';
import { factionInfo } from '../content/items';
import { opinionOptionTags, opinionSpeakerOf, previewOpinionOption, resolveOpinionDialogue, resolveOpinionOptions } from '../opinions';
import { opinionLimit } from '../game';
import { GirlPortrait } from './GirlPortrait';

type Props = {
  state: GameState;
  onDecide: (opinionId: string, optionId: 'accept' | 'defer' | 'reject') => void;
  onGirl: (id: string) => void;
};

const optionMeta: Record<Opinion['options'][number]['id'], { label: string; icon: typeof Check }> = {
  accept: { label: '批准', icon: Check },
  defer: { label: '暂缓', icon: Clock3 },
  reject: { label: '驳回', icon: X },
};

/**
 * 会客厅（议会厅）背景。
 *
 * 以前是手写 SVG 线稿；现在换成画好的室内图（public/art/council-lounge.jpg），
 * 上面压一层暗罩，保证左右两侧面板的文字还看得清。
 */
function CouncilBackdrop() {
  return (
    <>
      <img className="council-backdrop" src="/art/council-lounge.jpg" alt="" />
      <span className="council-backdrop-shade" aria-hidden="true" />
    </>
  );
}

export function CouncilView({ state, onDecide, onGirl }: Props) {
  const limit = opinionLimit(state);
  const allPending = state.opinions.filter(opinion => opinion.status === 'pending');
  const pending = allPending.slice(0, limit);
  const hidden = Math.max(0, allPending.length - pending.length);
  const [index, setIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
  const [phase, setPhase] = useState<'entering' | 'idle' | 'leaving'>('entering');
  // v114：决议之后这条议题会立刻从 pending 里消失；如果马上渲染新的 current，
  // 就会出现「内容已经换了、淡出还没播完」的闪烁。先冻结正在淡出的那条，
  // 等淡出结束再交给下一条。
  const [frozen, setFrozen] = useState<Opinion | null>(null);
  const live = pending[Math.min(index, Math.max(0, pending.length - 1))];
  const current = frozen ?? live;
  const speaker = current ? state.girls.find(girl => girl.id === current.authorId) ?? state.memorial.find(entry => entry.girl.id === current.authorId)?.girl : undefined;
  const assistant = state.girls.find(girl => girl.id === state.assistantId) ?? state.girls.find(girl => !girl.retired);
  const next = pending[index + 1];
  const options = current ? resolveOpinionOptions(state, current) : [];
  const dialogue = current ? resolveOpinionDialogue(state, current) : [];
  const dialogueDone = !current || lineIndex >= dialogue.length;
  const line = dialogueDone ? undefined : dialogue[Math.min(lineIndex, dialogue.length - 1)];
  // 大立绘跟着「这一句是谁说的」走：助手接话时画助手，不能把她的表情贴到提案人脸上。
  const figure = current ? opinionSpeakerOf(state, current, line) : undefined;
  const authorFigure = current ? opinionSpeakerOf(state, current) : undefined;

  useEffect(() => {
    setLineIndex(0);
  }, [current?.id]);

  useEffect(() => {
    setPhase('entering');
    const timer = window.setTimeout(() => setPhase('idle'), 260);
    return () => window.clearTimeout(timer);
  }, [current?.id]);

  useEffect(() => {
    if (index >= pending.length) setIndex(0);
  }, [pending.length, index]);

  const decide = (optionId: 'accept' | 'defer' | 'reject') => {
    if (!current || !dialogueDone || frozen) return;
    const option = options.find(entry => entry.id === optionId);
    if (!option || !previewOpinionOption(state, current, option).ok) return;
    const decided = current;
    // 先冻结这条，让淡出完整播完；pending 变小影响的是 `live`，画面不动。
    setFrozen(decided);
    setPhase('leaving');
    onDecide(decided.id, optionId);
    window.setTimeout(() => {
      // 决议后这条已经从 pending 里移除，索引不动正好指向下一条；
      // 解冻会让 current?.id 变化，从而触发「入场」动画。
      setFrozen(null);
    }, 340);
  };

  const advanceDialogue = () => {
    if (!current || dialogueDone) return;
    setLineIndex(value => Math.min(value + 1, dialogue.length));
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (!dialogueDone) {
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'ArrowRight') {
          event.preventDefault();
          setLineIndex(value => Math.min(value + 1, dialogue.length));
        }
        return;
      }
      const at = Number(event.key) - 1;
      if (at < 0 || at > 2) return;
      const option = options[at];
      if (!option || !previewOpinionOption(state, current, option).ok) return;
      event.preventDefault();
      decide(option.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, options, state, dialogueDone, dialogue.length]);

  return (
    <section className="council-stage" aria-label="议会">
      <CouncilBackdrop />
      <div className="council-stage-inner">
        <aside className="council-side" aria-label="议题相关状态">
          <p className="council-kicker">会客厅 · 第 {state.day} 日</p>
          <div className="council-facts">
            <div><Coins size={13} /><span>星砂</span><b>{state.gold.toLocaleString('zh-CN')}</b></div>
            <div><ShieldCheck size={13} /><span>安定度</span><b>{state.reputation}</b></div>
            <div><Moon size={13} /><span>待决议</span><b>{pending.length}</b></div>
          </div>
          {authorFigure ? (
            <button id="council-speaker-card" type="button" className="council-speaker-card" onClick={() => speaker && onGirl(speaker.id)}>
              <GirlPortrait girl={authorFigure} variant="avatar" />
              <span>
                <b>{authorFigure.name}</b>
                <small>{speaker ? `${speaker.codename} · ${speaker.title}` : current?.authorKind === 'leader' ? '三方代表' : '提出者'}</small>
                {speaker && <em><Heart size={11} /> {speaker.bond}/100 · 侵蚀 {speaker.corruption}</em>}
              </span>
            </button>
          ) : <p className="muted">今晚没有需要当面谈的事。</p>}
          <ul className="council-effort">
            {speaker && speaker.traits.slice(0, 3).map(trait => <li key={trait.id}><span className={`polarity ${trait.polarity}`}>{trait.name}</span>{trait.description}</li>)}
          </ul>
          <p className="council-hint">{hidden > 0 ? `还有 ${hidden} 条议题超出今晚上限，已转入暂缓；升级会客厅可增加席位。` : dialogueDone ? '决议会改变辖区归属、预算或她们的状态。按 1 / 2 / 3 也可以直接选择；资源不足的选项会锁定。' : '先听她把话说完，再作决定。点击「继续」或按空格推进对白。'}</p>
        </aside>

        <div className={`council-speaker ${phase}`}>
          {current ? (
            <>
              <header className="council-topic">
                <div className="council-topic-meta">
                  <span className="council-topic-kind">{current.topic}</span>
                  {current.faction && <span className={`council-topic-faction ${current.faction}`}>{factionInfo[current.faction]?.short ?? current.faction}</span>}
                </div>
                <h2>{current.title}</h2>
                <p>{current.text}</p>
                <small>{current.request}</small>
              </header>
              <div className="council-figure">
                {figure ? <GirlPortrait girl={figure} variant="full" bare /> : <div className="council-figure-empty" />}
              </div>
              <div className={`council-options ${dialogueDone ? 'ready' : 'waiting'}`}>
                {options.map((option, at) => {
                  const meta = optionMeta[option.id];
                  const Icon = meta.icon;
                  const preview = previewOpinionOption(state, current, option);
                  const tags = opinionOptionTags(option, state);
                  return (
                    <button
                      key={option.id}
                      id={`council-option-${option.id}`}
                      type="button"
                      className={`council-option ${option.id} ${preview.ok ? '' : 'unavailable'}`}
                      disabled={!preview.ok}
                      title={preview.ok ? undefined : preview.missing.join('；')}
                      onClick={() => decide(option.id)}
                    >
                      <em>{(at + 1)}</em>
                      <Icon size={15} />
                      <span>
                        <b>{option.label}</b>
                        <small>{option.effect}</small>
                        {tags.length > 0 && <span className="council-option-tags">{tags.map(tag => <i key={tag}>{tag}</i>)}</span>}
                        {!preview.ok && <small className="council-option-missing">还差：{preview.missing.join('；')}</small>}
                      </span>
                      <ArrowRight size={14} />
                    </button>
                  );
                })}
              </div>
              {!dialogueDone && line && (
                <div className="council-dialogue" aria-live="polite" onClick={advanceDialogue}>
                  <div className="council-dialogue-head">
                    <b>{line.speaker}</b>
                    <span>{lineIndex + 1} / {dialogue.length}</span>
                  </div>
                  <p className="council-dialogue-text">{line.text}</p>
                  <div className="council-dialogue-foot">
                    <span>点击对话框或按空格继续</span>
                    <div>
                      <button id="council-dialogue-skip" type="button" onClick={event => { event.stopPropagation(); setLineIndex(dialogue.length); }}>跳过</button>
                      <button id="council-dialogue-next" type="button" className="primary" onClick={event => { event.stopPropagation(); advanceDialogue(); }}>
                        {lineIndex + 1 >= dialogue.length ? '进入决议' : '继续'}
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="council-empty">
              <h2>今晚没有新的议题。</h2>
              <p>叙事者还没有提交，或今晚的议题已经处理完。不会再显示默认提案。</p>
            </div>
          )}
        </div>

        <aside className="council-assistant" aria-label="助手">
          <p className="council-kicker">助手席</p>
          {assistant ? (
            <>
              <button id="council-assistant" type="button" className="council-assistant-figure" onClick={() => onGirl(assistant.id)}>
                <GirlPortrait girl={assistant} variant="bust" />
              </button>
              <b>{assistant.name}</b>
              <p>{current?.assistantNote ?? '她把档案按顺序排好，等你开口。'}</p>
              {next && <small className="council-next">下一位：{state.girls.find(girl => girl.id === next.authorId)?.name ?? '—'}</small>}
            </>
          ) : <p className="muted">助手席还空着。</p>}
        </aside>
      </div>
    </section>
  );
}
