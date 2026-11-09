import { useEffect, useState } from 'react';
import { Feather, GripVertical, Heart, Sparkles, ArrowUpRight, BatteryMedium, Bandage, MoonStar, Syringe, Clock3, Flame, Rows3, LayoutGrid } from 'lucide-react';
import type { GameState, Girl } from '../types';
import { capacity, drugDaysLeft, inWithdrawal, relationshipStage, stageLabels, statusLabels } from '../game';
import { corruptionLabels, corruptionStage, effectiveMaxHp, effectiveMaxSpirit, effectiveStats } from '../economy';
import { EMPLOYER_LABEL, factionTagColor, factionTagLabel } from '../factions';
import { GirlPortrait } from './GirlPortrait';

const ROSTER_VIEW_KEY = 'night-sugar:roster-view';
type RosterView = 'list' | 'grid';
function readRosterView(): RosterView {
  try { return localStorage.getItem(ROSTER_VIEW_KEY) === 'grid' ? 'grid' : 'list'; } catch { return 'list'; }
}

interface PreviewState { id: string; style: React.CSSProperties; }

/** 悬停预览：渲染在滚动容器之外，fixed 定位，避免被名册的 overflow 裁掉。 */
function RosterPreview({ girl, state, style }: { girl: Girl; state: GameState; style: React.CSSProperties }) {
  const stage = relationshipStage(girl.bond);
  const stats = effectiveStats(girl, state);
  return (
    <div id={`tooltip-${girl.id}`} role="tooltip" className="girl-tooltip is-floating" style={style}>
      <div><b>{girl.name}</b><span>{girl.element} · {girl.skills.length} 个技能</span></div>
      <p>{girl.description}</p>
      <div className="tooltip-stats">
        <span>魔力 <b>{stats.magic}</b></span><span>洞察 <b>{stats.insight}</b></span>
        <span>敏捷 <b>{stats.agility}</b></span><span>共情 <b>{stats.empathy}</b></span>
      </div>
      <div className="tooltip-footer">
        <span>{stageLabels[stage]} · 羁绊 {girl.bond}</span>
        <span>心防 {girl.spirit}/{effectiveMaxSpirit(girl)} · 侵蚀 {girl.corruption ?? 0}%</span>
      </div>
      <small>{girl.retired ? '已转任文职，不再参与派遣' : inWithdrawal(girl) ? `断药第 ${girl.withdrawalDays} 日，无法派遣，请尽快使用抑制剂` : girl.status === 'idle' ? '拖动至地图任务点派遣 · 点击查看档案' : `当前${statusLabels[girl.status]}，剩余 ${girl.remaining} 分钟`}</small>
    </div>
  );
}

export function Roster({ state, onGirl, onMarket, showPoints }: { state: GameState; onGirl: (id: string) => void; onMarket: () => void; showPoints?: (girl: { id: string; unspentPoints?: number }) => boolean }) {
  const [view, setView] = useState<RosterView>(readRosterView);
  useEffect(() => {
    try { localStorage.setItem(ROSTER_VIEW_KEY, view); } catch { /* 偏好存不下也无所谓 */ }
  }, [view]);
  const present = state.girls.filter(g => !g.retired && !g.left);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const previewGirl = preview ? present.find(g => g.id === preview.id) : undefined;
  useEffect(() => { setPreview(null); }, [view]);
  const openPreview = (id: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    const width = 266;
    const height = 320;
    if (view === 'grid') {
      const above = rect.top > height + 12;
      const left = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 12), window.innerWidth - width / 2 - 12);
      setPreview({ id, style: { top: above ? rect.top - 9 : rect.bottom + 9, left, transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' } });
      return;
    }
    const preferLeft = rect.left > width + 24;
    const top = Math.max(12, Math.min(rect.top - 7, window.innerHeight - height - 12));
    setPreview({ id, style: { top, left: preferLeft ? rect.left - 13 : rect.right + 13, transform: preferLeft ? 'translate(-100%, 0)' : 'translate(0, 0)' } });
  };
  const left = state.girls.filter(g => g.left && !g.dead).slice(0, 6);
  const idle = present.filter(g => g.status === 'idle').length;
  return (
    <aside className="roster" aria-label="当前经营状态与魔法少女">
      <div className="roster-header">
        <div className="eyebrow">PUELLA ROSTER · 值班契约者</div>
        <h2>今晚，也请多关照。<Sparkles size={15} /></h2>
        <div className="roster-count">
          <span><i />{idle} 人待命</span>
          <span>{present.filter(g => !g.dead).length} / {capacity(state)} 席位</span>
        </div>
        <div className="roster-tools">
          <div className="roster-view-toggle" role="group" aria-label="名册显示方式">
            <button id="roster-view-list" type="button" className={view === 'list' ? 'selected' : ''} aria-pressed={view === 'list'} title="列表" onClick={() => setView('list')}><Rows3 size={12} /></button>
            <button id="roster-view-grid" type="button" className={view === 'grid' ? 'selected' : ''} aria-pressed={view === 'grid'} title="只看头像" onClick={() => setView('grid')}><LayoutGrid size={12} /></button>
          </div>
        </div>
      </div>
      <div className="girl-roster-scroll" onScroll={() => setPreview(null)}>
      <div className={`girl-roster ${view === 'grid' ? 'is-grid' : ''}`}>
        {present.map(g => {
          const stage = relationshipStage(g.bond);
          const cStage = corruptionStage(g.corruption ?? 0);
          const draggable = g.status === 'idle' && !g.retired && !inWithdrawal(g);
          const ending = g.contractEndDay - state.day <= 2;
          const unread = state.whisperUnread?.[g.id] ?? 0;
          return (
            <article key={g.id} className={`girl-roster-card ${g.status !== 'idle' ? 'is-busy' : ''} ${g.retired ? 'is-retired' : ''} ${g.witch ? 'is-witch' : ''}`} style={{ '--girl-color': g.color } as React.CSSProperties}
              draggable={draggable}
              onMouseEnter={event => openPreview(g.id, event.currentTarget)}
              onMouseLeave={() => setPreview(current => (current?.id === g.id ? null : current))}
              onFocus={event => openPreview(g.id, event.currentTarget)}
              onBlur={() => setPreview(current => (current?.id === g.id ? null : current))}
              onDragStart={e => { e.dataTransfer.setData('text/girl-id', g.id); e.dataTransfer.effectAllowed = 'move'; }}>
              <button id={`roster-girl-${g.id}`} className="girl-roster-main" onClick={() => { setPreview(null); onGirl(g.id); }} aria-describedby={preview?.id === g.id ? `tooltip-${g.id}` : undefined}>
                <div className="roster-portrait">
                  <GirlPortrait girl={g} variant="full" />
                  <span className="portrait-motif" />
                  {unread > 0 && <span className="whisper-badge" aria-label={`有 ${unread} 条新消息`}>{unread}</span>}
                  {g.retired && <span className="retired-stamp">文职</span>}
                  {g.witch && <span className="witch-stamp">魔女</span>}
                  {(showPoints ? showPoints(g) : (g.unspentPoints ?? 0) > 0) && <span className="point-badge" id={`roster-points-${g.id}`} aria-label={`有 ${g.unspentPoints} 点可分配属性`}>+{g.unspentPoints}</span>}
                </div>
                <div className="roster-info">
                  <div className="roster-name"><h3>{g.name}</h3><span>Lv.{g.level.toString().padStart(2, '0')}</span></div>
                  <p>{g.codename} · <em>{corruptionLabels[cStage]}</em></p>
                  <div className="roster-origin" style={{ '--tag-color': factionTagColor(g.factionTag) } as React.CSSProperties}>
                    <span className="roster-employer">{EMPLOYER_LABEL}</span>
                    <span className="roster-tag"><Feather size={9} />{factionTagLabel(g.factionTag)}</span>
                  </div>
                  <div className="girl-status"><i />{statusLabels[g.status]}{g.status !== 'idle' && !g.retired && <small> · {g.remaining} 分钟</small>}</div>
                  <div className="mini-meters">
                    <span aria-label={`血量 ${g.hp}`}><Heart size={10} /><i><b style={{ width: `${Math.min(100, g.hp / effectiveMaxHp(g) * 100)}%` }} /></i><em>{g.hp}</em></span>
                    <span aria-label={`疲劳 ${g.fatigue}`}><BatteryMedium size={11} /><i><b style={{ width: `${Math.min(100, g.fatigue)}%` }} /></i><em>{g.fatigue}</em></span>
                    <span className="meter-corruption" aria-label={`侵蚀度 ${g.corruption ?? 0}`}><Flame size={10} /><i><b style={{ width: `${Math.min(100, g.corruption ?? 0)}%` }} /></i><em>{g.corruption ?? 0}</em></span>
                  </div>
                  <div className="roster-tags">
                    <span className={`stage-chip stage-${stage}`}>{stageLabels[stage]}</span>
                    {g.scars.length > 0 && <span className="scar-chip"><Bandage size={10} />疤痕 {g.scars.length}</span>}
                    {g.witch && <span className={`scar-chip witch-chip ${drugDaysLeft(g, state.day) <= 0 ? 'danger' : ''}`}><Syringe size={10} />{drugDaysLeft(g, state.day) > 0 ? `药 ${drugDaysLeft(g, state.day)} 日` : `断药 ${g.withdrawalDays ?? 0} 日`}</span>}
                    {!g.retired && ending && <span className="scar-chip contract-chip"><Clock3 size={10} />契约将到期</span>}
                  </div>
                </div>
                <GripVertical className="drag-handle" size={16} />
                <ArrowUpRight className="roster-arrow" size={15} />
              </button>
            </article>
          );
        })}
        {left.length > 0 && (
          <div className="roster-left" id="roster-left">
            <p className="roster-left-title">离开的人</p>
            {left.map(g => (
              <button type="button" id={`roster-left-${g.id}`} key={g.id} className="roster-left-row" onClick={() => onGirl(g.id)}>
                <span>{g.name}</span>
                <small>{g.leftReason === 'pension' ? '契约款没到账' : g.leftReason === 'fatigue' ? '撑不住了' : '心不在这里了'}</small>
              </button>
            ))}
          </div>
        )}
        <button id="roster-open-market" className="roster-empty-slot" onClick={onMarket}>
          <MoonStar size={18} />
          <div>
            <strong>为下一束星光留个位置</strong>
            <small>前往市场，缔结新的契约</small>
          </div>
          <ArrowUpRight size={17} />
        </button>
      </div>
      </div>
      {previewGirl && preview && <RosterPreview girl={previewGirl} state={state} style={preview.style} />}
    </aside>
  );
}
