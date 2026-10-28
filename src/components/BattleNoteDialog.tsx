import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Feather, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import type { BattleNote, BattleNoteLine, BattleState, Expression } from '../types';
import { battleActors, battleCast, battleOutcomeLabel, totalBattleRounds } from '../battleNote';
import { GirlPortrait } from './GirlPortrait';

const expressionLabel: Record<Expression, string> = {
  calm: '平静', smile: '微笑', surprise: '惊讶', sad: '难过', angry: '生气', shy: '害羞',
};

function lineKey(sceneId: string, index: number): string {
  return `${sceneId}:${index}`;
}

function portraitSubject(actor: ReturnType<typeof battleActors>[number], expression: Expression) {
  return {
    id: actor.girlId ?? actor.uid,
    name: actor.name,
    color: actor.color,
    portrait: actor.portrait,
    codename: actor.codename,
    expression,
    portraitSpec: actor.portraitSpec,
  };
}

export function BattleNoteDialog({ battle, note, busy, error, onGenerate, onRegenerate, onClose }: {
  battle: BattleState;
  note: BattleNote | null;
  busy: boolean;
  error?: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeKey, setActiveKey] = useState('');
  const [sceneIndex, setSceneIndex] = useState(0);
  const cast = useMemo(() => battleCast(battle), [battle]);
  const actors = useMemo(() => battleActors(battle), [battle]);
  const enemies = cast.filter(actor => actor.side === 'enemy');
  const allies = cast.filter(actor => actor.side === 'ally');
  const splitAllies = enemies.length === 0 && allies.length > 1;
  const leftCast = enemies.length ? allies : splitAllies ? allies.filter((_, index) => index % 2 === 0) : allies;
  const rightCast = enemies.length ? enemies : splitAllies ? allies.filter((_, index) => index % 2 === 1) : [];
  const rightKeys = new Set(rightCast.map(actor => `${actor.side}:${actor.girlId}`));
  const actorByKey = new Map(actors.map(actor => [`${actor.side}:${actor.girlId}`, actor]));
  const activeLine = useMemo<BattleNoteLine | null>(() => {
    if (!note) return null;
    for (const scene of note.scenes) {
      for (const [index, line] of scene.lines.entries()) {
        if (lineKey(scene.id, index) === activeKey) return line;
      }
    }
    return null;
  }, [note, activeKey]);

  useEffect(() => {
    setActiveKey(note?.scenes[0]?.lines[0] ? lineKey(note.scenes[0].id, 0) : '');
    setSceneIndex(0);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [battle.id, note?.createdAt]);

  useEffect(() => {
    if (!note || !bodyRef.current) return;
    const root = bodyRef.current;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-note-line]'));
    if (!nodes.length) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveKey(visible.target.getAttribute('data-note-line') ?? '');
    }, { root, threshold: [0.35, 0.55, 0.75] });
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [note?.createdAt, battle.id, note]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { onClose(); return; }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      jumpScene(event.key === 'ArrowLeft' ? -1 : 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const jumpScene = (delta: number) => {
    if (!note) return;
    const next = Math.max(0, Math.min(note.scenes.length - 1, sceneIndex + delta));
    const scene = note.scenes[next];
    const target = sceneRefs.current[scene.id];
    const body = bodyRef.current;
    if (!target || !body) return;
    body.scrollTo({ top: target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - 18, behavior: 'smooth' });
    setSceneIndex(next);
  };

  const handleScroll = () => {
    if (!note || !bodyRef.current) return;
    const body = bodyRef.current.getBoundingClientRect();
    let current = 0;
    note.scenes.forEach((scene, index) => {
      const node = sceneRefs.current[scene.id];
      if (!node) return;
      if (node.getBoundingClientRect().top - body.top < 140) current = index;
    });
    setSceneIndex(previous => previous === current ? previous : current);
  };

  const speakerFor = (line: BattleNoteLine) => actorByKey.get(`${line.speakerSide}:${line.speakerId}`);
  const lineOnRight = (line: BattleNoteLine) => rightKeys.has(`${line.speakerSide}:${line.speakerId}`);
  const activeExpression = (actor: ReturnType<typeof battleActors>[number]): Expression => {
    if (activeLine && activeLine.speakerSide === actor.side && activeLine.speakerId === actor.girlId) return activeLine.expression;
    return actor.expression;
  };

  const renderSide = (list: typeof leftCast, side: 'left' | 'right') => (
    <aside className={`battle-note-side ${side} ${list.length ? '' : 'empty'} ${list.length >= 3 ? 'dense' : ''}`} aria-label={side === 'left' ? '左侧角色' : '右侧角色'}>
      {list.length > 0 && <span className="battle-note-side-label">{list.every(actor => actor.side === 'ally') ? '我方' : list.every(actor => actor.side === 'enemy') ? '敌方' : '战场'}</span>}
      {list.map(actor => {
        const expression = activeExpression(actor);
        const speaking = Boolean(activeLine && activeLine.speakerSide === actor.side && activeLine.speakerId === actor.girlId);
        return (
          <figure key={actor.uid} className={`battle-note-portrait ${speaking ? 'speaking' : ''} ${actor.down ? 'down' : ''}`} style={{ '--note-color': actor.color } as CSSProperties}>
            <div className="battle-note-portrait-art">
              <GirlPortrait girl={portraitSubject(actor, expression)} variant="full" />
              <span className="battle-note-expression">{expressionLabel[expression]}</span>
            </div>
            <figcaption>
              <b>{actor.name}</b>
              <small>{actor.codename ?? (actor.side === 'enemy' ? '敌方' : '契约者')}</small>
              {actor.side === 'enemy' && <em>敌方</em>}
              {actor.down && <em className="down">倒下</em>}
            </figcaption>
          </figure>
        );
      })}
    </aside>
  );

  const scene = note?.scenes[sceneIndex];
  return (
    <div className="battle-note-overlay" role="dialog" aria-modal="true" aria-label="战斗札记">
      <div className="battle-note-shell">
        <header className="battle-note-head">
          <div className="battle-note-head-copy">
            <span className="modal-eyebrow"><BookOpen size={13} />战斗札记 · {battle.missionTitle}</span>
            <h2>{note?.title ?? '把这一战留下来。'}</h2>
            <p>{note?.hook ?? '战斗已经结束。记录还在，但还没有人把它写成可读的札记。'}</p>
          </div>
          <div className="battle-note-head-meta">
            <span className="battle-note-outcome">{battleOutcomeLabel(battle.outcome)}</span>
            <span>{totalBattleRounds(battle)} 回合</span>
            {note && <span className={`battle-note-source ${note.source}`}>{note.source === 'llm' ? '叙事版' : '简报版'}</span>}
            <button id="battle-note-close" type="button" className="icon-btn" aria-label="关闭战斗札记" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {cast.length > 0 && (
          <div className="battle-note-mobile-cast" aria-label="参战角色">
            {cast.map(actor => {
              const expression = activeExpression(actor);
              return (
                <div key={actor.uid} className={`battle-note-mobile-face ${activeLine && activeLine.speakerSide === actor.side && activeLine.speakerId === actor.girlId ? 'active' : ''} ${actor.down ? 'down' : ''}`}>
                  <GirlPortrait girl={portraitSubject(actor, expression)} variant="avatar" />
                  <span>{actor.name}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className={`battle-note-stage ${leftCast.length ? 'has-left' : ''} ${rightCast.length ? 'has-right' : ''} ${leftCast.length || rightCast.length ? '' : 'solo'}`}>
          {renderSide(leftCast, 'left')}
          <main className="battle-note-center">
            {error && note && <div className="battle-note-warning" role="status">{error}</div>}
            <div ref={bodyRef} className="battle-note-body" onScroll={handleScroll}>
              {busy ? (
                <div className="battle-note-loading" role="status">
                  <LoaderCircle size={22} className="spin" />
                  <b>叙事者正在把这一战写下来</b>
                  <span>按回合重排阵型、动作与对话，不改动战斗结果。</span>
                </div>
              ) : note ? (
                <>
                  {note.scenes.map((entry, index) => (
                    <section key={entry.id} ref={node => { sceneRefs.current[entry.id] = node; }} className={`battle-note-scene ${index === sceneIndex ? 'current' : ''}`} data-note-scene={entry.id}>
                      <div className="battle-note-scene-head">
                        <span>SCENE {String(index + 1).padStart(2, '0')}</span>
                        <h3>{entry.title}</h3>
                        <em>回合 {entry.roundFrom}{entry.roundTo > entry.roundFrom ? `–${entry.roundTo}` : ''}</em>
                      </div>
                      {entry.narration.split(/\n+/).filter(Boolean).map((paragraph, at) => <p key={at} className="battle-note-narration">{paragraph}</p>)}
                      <div className="battle-note-lines">
                        {entry.lines.map((line, at) => {
                          const speaker = speakerFor(line);
                          const key = lineKey(entry.id, at);
                          return (
                            <button key={key} id={`battle-note-line-${entry.id}-${at}`} type="button" data-note-line={key} aria-label={speaker ? `${speaker.name}：${line.text}` : line.text} style={{ '--speaker-color': speaker?.color ?? '#f3aec9' } as CSSProperties} className={`battle-note-line ${lineOnRight(line) ? 'right' : 'left'} ${line.mode === 'thought' ? 'thought' : ''} ${activeKey === key ? 'active' : ''}`} onClick={() => setActiveKey(key)}>
                              {speaker && <span className="battle-note-speaker">{speaker.name}{line.mode === 'thought' ? ' · 心声' : ''}</span>}
                              <span className="battle-note-bubble">{line.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                  <footer className="battle-note-summary">
                    <span>收束</span>
                    <p>{note.summary}</p>
                    <small>{note.charCount} 字 · {note.source === 'llm' ? '由叙事者按战斗记录写成' : '由战斗记录据实整理，没有补写台词'}</small>
                  </footer>
                </>
              ) : (
                <div className="battle-note-empty">
                  <Feather size={24} />
                  <h3>这一战还没有札记</h3>
                  <p>让叙事者按回合把战况、挡下攻击的人、退缩的人与最后的收束写成 3–5 场。没有 API 密钥时会生成一份据实简报。</p>
                  {error && <div className="battle-note-error">{error}</div>}
                  <button id="battle-note-generate" type="button" className="btn primary" onClick={onGenerate}><Sparkles size={15} />让叙事者写这一战</button>
                </div>
              )}
            </div>

            <footer className="battle-note-controls">
              <div className="battle-note-scene-nav">
                <button id="battle-note-prev" type="button" className="btn icon-text" disabled={!note || sceneIndex <= 0} onClick={() => jumpScene(-1)}><ArrowLeft size={14} />上一场</button>
                <span>{note ? `${sceneIndex + 1} / ${note.scenes.length}` : '—'}{scene ? ` · ${scene.title}` : ''}</span>
                <button id="battle-note-next" type="button" className="btn icon-text" disabled={!note || sceneIndex >= note.scenes.length - 1} onClick={() => jumpScene(1)}>下一场<ArrowRight size={14} /></button>
              </div>
              <div className="battle-note-control-actions">
                {note && <button id="battle-note-regenerate" type="button" className="btn icon-text" disabled={busy} onClick={onRegenerate}><RefreshCw size={14} />重写</button>}
                {note && <button id="battle-note-close-2" type="button" className="btn primary" onClick={onClose}>收进记录</button>}
              </div>
            </footer>
          </main>
          {renderSide(rightCast, 'right')}
        </div>
      </div>
    </div>
  );
}
