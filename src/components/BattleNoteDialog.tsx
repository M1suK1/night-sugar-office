import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Feather, LoaderCircle, RefreshCw, Sparkles, X } from 'lucide-react';
import type { BattleNote, BattleNoteLine, BattleState, Expression, Girl } from '../types';
import { battleActors, battleCast, battleOutcomeLabel, splitBattleCast, totalBattleRounds } from '../battleNote';
import type { BattleActor } from '../battleNote';
import { rotateSide } from '../storySlots';
import { GirlPortrait } from './GirlPortrait';
import { VnReader } from '../vn/VnReader';
import { VnModeToggle } from '../vn/VnModeToggle';
import { beatsFromBattleNote } from '../vn/beats';

const expressionLabel: Record<Expression, string> = {
  calm: '平静', smile: '微笑', surprise: '惊讶', sad: '难过', angry: '生气', shy: '害羞',
};

function lineKey(sceneId: string, index: number): string {
  return `${sceneId}:${index}`;
}

function portraitSubject(actor: ReturnType<typeof battleActors>[number], expression: Expression, girl?: Girl) {
  return {
    id: actor.girlId ?? actor.uid,
    name: actor.name,
    color: actor.color,
    // 单位快照可能只剩资产 id；存档里那位少女的立绘更完整，优先用她的。
    portrait: girl?.portrait || actor.portrait,
    portraitAsset: girl?.portraitAsset ?? actor.portraitAsset,
    codename: actor.codename,
    expression,
    portraitSpec: actor.portraitSpec,
    outfitId: girl?.outfitId,
    wardrobe: girl?.wardrobe,
    witch: girl?.witch,
    witchForm: girl?.witchForm,
    importedVariants: girl?.importedVariants,
  };
}

/** 单侧立绘栏：三人时前后三格（悬停后排会整体轮转），其余人数保持原来的单排。 */
function SideCast({ side, list, activeLine, girlsById, hoverKey, resetKey }: {
  side: 'left' | 'right';
  list: BattleActor[];
  activeLine: BattleNoteLine | null;
  girlsById: Map<string, Girl>;
  hoverKey: string;
  resetKey: string;
}) {
  const idsKey = list.map(actor => actor.girlId ?? actor.uid).join('|');
  const [order, setOrder] = useState<string[]>(() => list.map(actor => actor.girlId ?? actor.uid));
  useEffect(() => {
    setOrder(list.map(actor => actor.girlId ?? actor.uid));
  }, [idsKey, resetKey]);

  const hoveredId = hoverKey.startsWith(`${side}:`) ? hoverKey.slice(side.length + 1) : '';
  // 只在悬停换人这一下轮转；order 用函数式更新，不放进依赖，免得轮转后自己再转一次。
  useEffect(() => {
    if (!hoveredId) return;
    setOrder(current => {
      const next = rotateSide(current, hoveredId);
      return next === current ? current : [...next];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]);

  const byId = new Map(list.map(actor => [actor.girlId ?? actor.uid, actor]));
  const three = list.length === 3;
  const slots = ['slot-front-left', 'slot-front-right', 'slot-back'];
  const shown = three ? order.flatMap(id => { const actor = byId.get(id); return actor ? [actor] : []; }) : list;
  const label = list.every(actor => actor.side === 'ally') ? '我方' : list.every(actor => actor.side === 'enemy') ? '敌方' : '战场';

  return (
    <aside className={`battle-note-side ${side} ${list.length ? '' : 'empty'} ${list.length >= 3 ? 'dense' : ''} ${three ? 'three-up' : ''}`} aria-label={side === 'left' ? '左侧角色' : '右侧角色'}>
      {list.length > 0 && <span className="battle-note-side-label">{label}</span>}
      {shown.map((actor, index) => {
        const expression = activeLine && activeLine.speakerSide === actor.side && activeLine.speakerId === actor.girlId
          ? activeLine.expression
          : actor.expression;
        const speaking = Boolean(activeLine && activeLine.speakerSide === actor.side && activeLine.speakerId === actor.girlId);
        return (
          <figure
            key={actor.uid}
            className={`battle-note-portrait ${actor.side} ${three ? slots[index] : ''} ${speaking ? 'speaking' : ''} ${actor.down ? 'down' : ''}`}
            style={{ '--note-color': actor.color } as CSSProperties}
          >
            <div className="battle-note-portrait-art">
              <GirlPortrait girl={portraitSubject(actor, expression, girlsById.get(actor.girlId ?? ''))} variant="full" />
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
}

export function BattleNoteDialog({ battle, note, girls, busy, error, onGenerate, onRegenerate, onClose, vnStory = false }: {
  battle: BattleState;
  note: BattleNote | null;
  girls: Girl[];
  busy: boolean;
  error?: string;
  onGenerate: () => void;
  onRegenerate: () => void;
  onClose: () => void;
  /** 视觉小说模式（v95 全局开关）：有札记时改用逐句舞台。 */
  vnStory?: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<Record<string, HTMLElement | null>>({});
  const [activeKey, setActiveKey] = useState('');
  const [sceneIndex, setSceneIndex] = useState(0);
  // v152：台词悬停 → 后排的人轮转到前排。
  // 滚动时指针不动、台词从指针底下滑过也会触发 mouseenter，所以刚滚动过的这一下不算悬停。
  const [hoverKey, setHoverKey] = useState('');
  const scrolledAt = useRef(0);
  useEffect(() => {
    const onScroll = () => { scrolledAt.current = Date.now(); };
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, []);
  const cast = useMemo(() => battleCast(battle), [battle]);
  const actors = useMemo(() => battleActors(battle), [battle]);
  const girlsById = useMemo(() => new Map(girls.map(girl => [girl.id, girl])), [girls]);
  // v151：六人编队按队序左三右三；3v3 左我方、右敌方。
  const { left: leftCast, right: rightCast } = useMemo(() => splitBattleCast(cast), [cast]);
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

  // v95：视觉小说模式——有札记时把阅读区换成逐句舞台，「原文」可临时切回。
  const [textMode, setTextMode] = useState(false);
  const stage = Boolean(vnStory) && !textMode && Boolean(note) && !busy;
  const stageBeats = useMemo(
    () => (note ? beatsFromBattleNote(
      note.scenes,
      battleActors(battle).map(actor => ({ key: `${actor.side}:${actor.girlId ?? actor.uid}`, id: actor.girlId ?? actor.uid, name: actor.name })),
      { scene: { id: 'night' } },
    ) : []),
    [note, battle],
  );
  const stageCast = useMemo(
    () => battleActors(battle).flatMap(actor => {
      const girl = girlsById.get(actor.girlId ?? '');
      if (!girl) return [];
      return [{ id: actor.girlId ?? actor.uid, name: actor.name, girl }];
    }),
    [battle, girlsById],
  );

  const speakerFor = (line: BattleNoteLine) => actorByKey.get(`${line.speakerSide}:${line.speakerId}`);
  const lineOnRight = (line: BattleNoteLine) => rightKeys.has(`${line.speakerSide}:${line.speakerId}`);
  // 悬停 / 键盘聚焦同一句台词 → 该侧的三人轮转。刚滚动过的这一下不算（内容从指针下滑过也会触发 mouseenter）。
  const focusSpeaker = (line: BattleNoteLine) => {
    if (Date.now() - scrolledAt.current < 150) return;
    setHoverKey(`${lineOnRight(line) ? 'right' : 'left'}:${line.speakerId}`);
  };
  const renderSide = (list: BattleActor[], side: 'left' | 'right') => (
    <SideCast
      side={side}
      list={list}
      activeLine={activeLine}
      girlsById={girlsById}
      hoverKey={hoverKey}
      resetKey={note?.battleId ?? battle.id}
    />
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
            <span className="battle-note-outcome">{battleOutcomeLabel(battle.outcome, battle.partial === true)}</span>
            {note?.format !== 'continuous' && <span>{totalBattleRounds(battle)} 回合</span>}
            {note && <span className={`battle-note-source ${note.source}`}>{note.source === 'llm' ? '叙事版' : '简报版'}</span>}
            {vnStory && textMode && note && !busy && <VnModeToggle id="battle-note-vn-enter" onSwitch={() => setTextMode(false)} />}
            <button id="battle-note-close" type="button" className="icon-btn" aria-label="关闭战斗札记" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        {cast.length > 0 && (
          <div className="battle-note-mobile-cast" aria-label="参战角色">
            {cast.map(actor => {
              const expression = activeLine && activeLine.speakerSide === actor.side && activeLine.speakerId === actor.girlId
                ? activeLine.expression
                : actor.expression;
              return (
                <div key={actor.uid} className={`battle-note-mobile-face ${activeLine && activeLine.speakerSide === actor.side && activeLine.speakerId === actor.girlId ? 'active' : ''} ${actor.down ? 'down' : ''}`}>
                  <GirlPortrait girl={portraitSubject(actor, expression, girlsById.get(actor.girlId ?? ''))} variant="avatar" />
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
            {stage ? (
              <div className="battle-note-stage-body">
                <VnReader
                  beats={stageBeats}
                  resetKey={note?.battleId}
                  title={note?.title}
                  cast={stageCast}
                  onText={() => setTextMode(true)}
                  onClose={onClose}
                />
              </div>
            ) : (
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
                      {note.format !== 'continuous' && <div className="battle-note-scene-head">
                        <span>SCENE {String(index + 1).padStart(2, '0')}</span>
                        <h3>{entry.title}</h3>
                        <em>回合 {entry.roundFrom}{entry.roundTo > entry.roundFrom ? `–${entry.roundTo}` : ''}</em>
                      </div>}
                      {(() => {
                        const paragraphs = entry.narration.split(/\n+/).filter(Boolean);
                        const positioned = entry.lines.map((line, index) => ({ line, index, after: typeof line.after === 'number' ? Math.max(0, Math.floor(line.after)) : undefined }));
                        const byAfter = new Map<number, typeof positioned>();
                        for (const item of positioned) {
                          if (item.after === undefined) continue;
                          const list = byAfter.get(item.after) ?? [];
                          list.push(item);
                          byAfter.set(item.after, list);
                        }
                        const renderLine = (line: BattleNoteLine, at: number) => {
                          const speaker = speakerFor(line);
                          const key = lineKey(entry.id, at);
                          return <button key={key} id={`battle-note-line-${entry.id}-${at}`} type="button" data-note-line={key} aria-label={speaker ? `${speaker.name}：${line.text}` : line.text} style={{ '--speaker-color': speaker?.color ?? '#f3aec9' } as CSSProperties} className={`battle-note-line ${lineOnRight(line) ? 'right' : 'left'} ${line.mode === 'thought' ? 'thought' : ''} ${activeKey === key ? 'active' : ''}`}
                            onMouseEnter={() => focusSpeaker(line)}
                            onMouseLeave={() => setHoverKey('')}
                            onFocus={() => focusSpeaker(line)}
                            onBlur={() => setHoverKey('')}
                            onClick={() => setActiveKey(key)}>
                            {speaker && <span className="battle-note-speaker">{speaker.name}{line.mode === 'thought' ? ' · 心声' : ''}</span>}
                            <span className="battle-note-bubble">{line.text}</span>
                          </button>;
                        };
                        if (note.format === 'continuous') {
                          const tail = positioned.filter(item => item.after === undefined || item.after > paragraphs.length);
                          return <>
                            {(byAfter.get(0) ?? []).map(item => renderLine(item.line, item.index))}
                            {paragraphs.map((paragraph, at) => <Fragment key={`p-${at}`}>
                              <p className="battle-note-narration">{paragraph}</p>
                              {(byAfter.get(at + 1) ?? []).map(item => renderLine(item.line, item.index))}
                            </Fragment>)}
                            {tail.length > 0 && <div className="battle-note-lines">{tail.map(item => renderLine(item.line, item.index))}</div>}
                          </>;
                        }
                        return <>
                          {paragraphs.map((paragraph, at) => <p key={at} className="battle-note-narration">{paragraph}</p>)}
                          <div className="battle-note-lines">{positioned.map(item => renderLine(item.line, item.index))}</div>
                        </>;
                      })()}
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
                  <p>让叙事者一次写完这一战：动作、环境、停顿与对白，不写回合、伤害数字和技能名。没有 API 密钥时会生成一份据实简报。</p>
                  {error && <div className="battle-note-error">{error}</div>}
                  <button id="battle-note-generate" type="button" className="btn primary" onClick={onGenerate}><Sparkles size={15} />让叙事者写这一战</button>
                </div>
              )}
            </div>
            )}

            <footer className="battle-note-controls">
              {note?.format === 'continuous' ? <div className="battle-note-scene-nav"><span>一次写完 · {note.charCount} 字</span></div> : <div className="battle-note-scene-nav">
                <button id="battle-note-prev" type="button" className="btn icon-text" disabled={!note || sceneIndex <= 0} onClick={() => jumpScene(-1)}><ArrowLeft size={14} />上一场</button>
                <span>{note ? `${sceneIndex + 1} / ${note.scenes.length}` : '—'}{scene ? ` · ${scene.title}` : ''}</span>
                <button id="battle-note-next" type="button" className="btn icon-text" disabled={!note || sceneIndex >= note.scenes.length - 1} onClick={() => jumpScene(1)}>下一场<ArrowRight size={14} /></button>
              </div>}
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
