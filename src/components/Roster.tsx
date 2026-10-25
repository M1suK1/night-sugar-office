import { GripVertical, Heart, Sparkles, ArrowUpRight, BatteryMedium, Bandage, MoonStar, Syringe, Clock3 } from 'lucide-react';
import type { GameState } from '../types';
import { capacity, drugDaysLeft, inWithdrawal, relationshipStage, stageLabels, statusLabels } from '../game';
import { effectiveMaxHp, effectiveMaxSpirit, effectiveStats } from '../economy';
import { GirlPortrait } from './GirlPortrait';

export function Roster({ state, onGirl, onMarket }: { state: GameState; onGirl: (id: string) => void; onMarket: () => void }) {
  const idle = state.girls.filter(g => g.status === 'idle').length;
  return (
    <aside className="roster" aria-label="当前经营状态与魔法少女">
      <div className="roster-header">
        <div className="eyebrow">值班契约者</div>
        <h2>今晚，也请多关照。<Sparkles size={15} /></h2>
        <div className="roster-count">
          <span><i />{idle} 人待命</span>
          <span>{state.girls.filter(g => !g.dead && !g.retired).length} / {capacity(state)} 席位</span>
        </div>
      </div>
      <div className="girl-roster">
        {state.girls.filter(g => !g.retired).map(g => {
          const stage = relationshipStage(g.bond);
          const draggable = g.status === 'idle' && !g.retired && !inWithdrawal(g);
          const ending = g.contractEndDay - state.day <= 2;
          const stats = effectiveStats(g);
          return (
            <article key={g.id} className={`girl-roster-card ${g.status !== 'idle' ? 'is-busy' : ''} ${g.retired ? 'is-retired' : ''}`} style={{ '--girl-color': g.color } as React.CSSProperties}
              draggable={draggable}
              onDragStart={e => { e.dataTransfer.setData('text/girl-id', g.id); e.dataTransfer.effectAllowed = 'move'; }}>
              <button id={`roster-girl-${g.id}`} className="girl-roster-main" onClick={() => onGirl(g.id)} aria-describedby={`tooltip-${g.id}`}>
                <div className="roster-portrait">
                  <GirlPortrait girl={g} variant="full" />
                  <span className="portrait-motif" />
                  {g.retired && <span className="retired-stamp">文职</span>}
                  {g.witch && <span className="witch-stamp">魔女</span>}
                </div>
                <div className="roster-info">
                  <div className="roster-name"><h3>{g.name}</h3><span>Lv.{g.level.toString().padStart(2, '0')}</span></div>
                  <p>{g.codename}</p>
                  <div className="girl-status"><i />{statusLabels[g.status]}{g.status !== 'idle' && !g.retired && <small> · {g.remaining} 分钟</small>}</div>
                  <div className="mini-meters">
                    <span aria-label={`血量 ${g.hp}`}><Heart size={10} /><i><b style={{ width: `${g.hp / effectiveMaxHp(g) * 100}%` }} /></i><em>{g.hp}</em></span>
                    <span aria-label={`疲劳 ${g.fatigue}`}><BatteryMedium size={11} /><i><b style={{ width: `${g.fatigue}%` }} /></i><em>{g.fatigue}</em></span>
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
              <div id={`tooltip-${g.id}`} role="tooltip" className="girl-tooltip">
                <div><b>{g.name}</b><span>{g.element} · {g.skills.map(id => id).length} 个技能</span></div>
                <p>{g.description}</p>
                <div className="tooltip-stats">
                  <span>魔力 <b>{stats.magic}</b></span><span>洞察 <b>{stats.insight}</b></span>
                  <span>敏捷 <b>{stats.agility}</b></span><span>共情 <b>{stats.empathy}</b></span>
                </div>
                <div className="tooltip-footer">
                  <span>{stageLabels[stage]} · 羁绊 {g.bond}</span>
                  <span>共情值 {g.spirit}/{effectiveMaxSpirit(g)}</span>
                </div>
                <small>{g.retired ? '已转任文职，不再参与派遣' : inWithdrawal(g) ? `断药第 ${g.withdrawalDays} 日，无法派遣，请尽快使用抑制剂` : g.status === 'idle' ? '拖动至地图任务点派遣 · 点击查看档案' : `当前${statusLabels[g.status]}，剩余 ${g.remaining} 分钟`}</small>
              </div>
            </article>
          );
        })}
        <button id="roster-open-market" className="roster-empty-slot" onClick={onMarket}>
          <span><MoonStar size={18} />为下一束星光留个位置</span>
          <small>前往市场，缔结新的契约</small>
          <ArrowUpRight size={17} />
        </button>
      </div>
    </aside>
  );
}
