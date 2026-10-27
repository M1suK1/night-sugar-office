import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clock3, Coins, Heart, Moon, ShieldCheck, X } from 'lucide-react';
import type { GameState, Opinion } from '../types';
import { factionInfo } from '../content/items';
import { opinionOptionTags, previewOpinionOption, resolveOpinionOptions } from '../opinions';
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

function CouncilBackdrop() {
  return (
    <svg className="council-backdrop" viewBox="0 0 900 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="council-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#211a26" />
          <stop offset="1" stopColor="#120f16" />
        </linearGradient>
        <linearGradient id="council-window" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b3a5c" />
          <stop offset="1" stopColor="#101827" />
        </linearGradient>
        <radialGradient id="council-lamp" cx="0.5" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffd6e6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd6e6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="900" height="420" fill="url(#council-wall)" />
      <g opacity="0.5" stroke="#ffffff" strokeWidth="0.6">
        {Array.from({ length: 12 }, (_, index) => <line key={index} x1={index * 80} y1="0" x2={index * 80 - 40} y2="300" opacity="0.08" />)}
      </g>
      <rect x="620" y="42" width="190" height="150" rx="6" fill="url(#council-window)" stroke="#4a3a55" strokeWidth="2" />
      <line x1="715" y1="42" x2="715" y2="192" stroke="#4a3a55" strokeWidth="2" />
      <line x1="620" y1="117" x2="810" y2="117" stroke="#4a3a55" strokeWidth="2" />
      <circle cx="676" cy="86" r="17" fill="#f6e7d8" opacity="0.85" />
      <circle cx="82" cy="150" r="46" fill="url(#council-lamp)" />
      <path d="M82 34v58" stroke="#6d5a48" strokeWidth="2" />
      <path d="M52 92h60l-14 26H66z" fill="#f3d8c2" opacity="0.9" />
      <rect x="120" y="268" width="470" height="74" rx="16" fill="#2b2231" />
      <rect x="120" y="250" width="470" height="30" rx="12" fill="#392d40" />
      <rect x="150" y="342" width="14" height="30" fill="#1d1822" />
      <rect x="546" y="342" width="14" height="30" fill="#1d1822" />
      <ellipse cx="430" cy="396" rx="300" ry="26" fill="#0d0b10" opacity="0.7" />
      <rect x="672" y="300" width="56" height="44" rx="7" fill="#33283a" />
      <path d="M700 300c-4-26-18-40-34-46 20-2 32 10 34 26 4-20 16-30 34-28-14 10-22 26-24 48z" fill="#3f5a4a" opacity="0.9" />
      <path d="M700 300c-2-22-10-34-22-42 12 8 18 22 20 42z" fill="#4d6b58" opacity="0.8" />
    </svg>
  );
}

export function CouncilView({ state, onDecide, onGirl }: Props) {
  const pending = state.opinions.filter(opinion => opinion.status === 'pending');
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'entering' | 'idle' | 'leaving'>('entering');
  const current = pending[Math.min(index, Math.max(0, pending.length - 1))];
  const speaker = current ? state.girls.find(girl => girl.id === current.authorId) ?? state.memorial.find(entry => entry.girl.id === current.authorId)?.girl : undefined;
  const assistant = state.girls.find(girl => girl.id === state.assistantId) ?? state.girls.find(girl => !girl.retired);
  const next = pending[index + 1];
  const options = current ? resolveOpinionOptions(state, current) : [];

  useEffect(() => {
    setPhase('entering');
    const timer = window.setTimeout(() => setPhase('idle'), 260);
    return () => window.clearTimeout(timer);
  }, [current?.id]);

  useEffect(() => {
    if (index >= pending.length) setIndex(0);
  }, [pending.length, index]);

  const decide = (optionId: 'accept' | 'defer' | 'reject') => {
    if (!current) return;
    const option = options.find(entry => entry.id === optionId);
    if (!option || !previewOpinionOption(state, current, option).ok) return;
    setPhase('leaving');
    onDecide(current.id, optionId);
    window.setTimeout(() => {
      setIndex(value => Math.min(value + 1, Math.max(0, pending.length - 1)));
      setPhase('entering');
    }, 320);
  };

  useEffect(() => {
    if (!current) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const at = Number(event.key) - 1;
      if (at < 0 || at > 2) return;
      const option = options[at];
      if (!option || !previewOpinionOption(state, current, option).ok) return;
      event.preventDefault();
      decide(option.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, options, state]);

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
          {speaker ? (
            <button id="council-speaker-card" type="button" className="council-speaker-card" onClick={() => onGirl(speaker.id)}>
              <GirlPortrait girl={speaker} variant="avatar" />
              <span>
                <b>{speaker.name}</b>
                <small>{speaker.codename} · {speaker.title}</small>
                <em><Heart size={11} /> {speaker.bond}/100 · 侵蚀 {speaker.corruption}</em>
              </span>
            </button>
          ) : <p className="muted">今晚没有需要当面谈的事。</p>}
          <ul className="council-effort">
            {speaker && speaker.traits.slice(0, 3).map(trait => <li key={trait.id}><span className={`polarity ${trait.polarity}`}>{trait.name}</span>{trait.description}</li>)}
          </ul>
          <p className="council-hint">决议会改变辖区归属、预算或她们的状态。按 1 / 2 / 3 也可以直接选择；资源不足的选项会锁定。</p>
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
                {speaker ? <GirlPortrait girl={{ ...speaker, expression: 'calm' }} variant="full" bare /> : <div className="council-figure-empty" />}
              </div>
              <div className="council-options">
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
            </>
          ) : (
            <div className="council-empty">
              <h2>今晚的议题都处理完了。</h2>
              <p>会客厅的灯还亮着。下一件事要等明晚。</p>
            </div>
          )}
        </div>

        <aside className="council-assistant" aria-label="助手">
          <p className="council-kicker">助手席</p>
          {assistant ? (
            <>
              <button id="council-assistant" type="button" className="council-assistant-figure" onClick={() => onGirl(assistant.id)}>
                <GirlPortrait girl={assistant} variant="full" />
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
