import { useState } from 'react';
import { Radar, Candy, TrainFront, Eclipse, Cat, Mail, Plus, Minus, LocateFixed, ArrowUpRight, List, Map as MapIcon, Sparkles, Clock3, MoveUpRight, Crosshair, Radio, Check, Swords, ScanEye, Users, Skull } from 'lucide-react';
import type { GameState, Mission } from '../types';
import { getMonster } from '../content/monsters';

const icons = { candy: Candy, station: TrainFront, mirror: Eclipse, cat: Cat, tower: Mail };
type Filter = 'all' | 'combat' | 'investigation' | 'urgent' | 'active';

export function DispatchMap({ state, onMission, onDropGirl }: { state: GameState; onMission: (id: string) => void; onDropGirl: (girlId: string, missionId: string) => void }) {
  const [zoom, setZoom] = useState(1), [filter, setFilter] = useState<Filter>('all'), [list, setList] = useState(false), [over, setOver] = useState<string | null>(null);
  const open = state.missions.filter(m => m.status === 'open').length;
  const visible = (m: Mission) => filter === 'all' || (filter === 'urgent' ? m.category === '紧急委托' : filter === 'active' ? m.status === 'active' : m.work === filter);
  const threat = (m: Mission) => (m.enemyIds ?? []).reduce((sum, id) => sum + getMonster(id).maxHp, 0);
  return <section className="dispatch-map" aria-label="樱雾市派遣地图">
    <div className="map-heading">
      <div className="section-title"><Radar size={18} /><h2>城市感应地图</h2><span className="tiny-badge">{open} 个待处理</span></div>
      <div className="map-view-controls"><button id="map-view-map" aria-label="地图视图" aria-pressed={!list} className={!list ? 'selected' : ''} onClick={() => setList(false)}><MapIcon size={16} /></button><button id="map-view-list" aria-label="委托列表视图" aria-pressed={list} className={list ? 'selected' : ''} onClick={() => setList(true)}><List size={16} /></button></div>
    </div>
    <div className="map-filters" aria-label="地图任务筛选">
      {[{ id: 'all', label: '全部委托' }, { id: 'combat', label: '战斗' }, { id: 'investigation', label: '调查' }, { id: 'urgent', label: '紧急优先' }, { id: 'active', label: '派遣中' }].map(f => <button id={`map-filter-${f.id}`} key={f.id} aria-pressed={filter === f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id as Filter)}>{f.id === 'combat' ? <Swords size={11} /> : f.id === 'investigation' ? <ScanEye size={11} /> : null}{f.label}{f.id === 'urgent' && <i />}</button>)}
      <span><span className="signal-dot" />心愿信号已同步</span>
    </div>
    {list ? <div className="mission-list-view">
      {state.missions.filter(visible).map(m => {
        const Icon = icons[m.id as keyof typeof icons] ?? (m.work === 'combat' ? Swords : ScanEye);
        return <button id={`mission-list-${m.id}`} className="mission-list-row" key={m.id} onClick={() => onMission(m.id)}>
          <Icon size={24} />
          <div><small>{m.category} · {m.difficulty} · {m.work === 'combat' ? `${m.squad.length || m.attempts > 0 ? m.squad.length : '—'} 人编队` : '调查'}</small><h3>{m.title}</h3><span>{m.duration} 分钟 · {m.reward} 星砂{m.work === 'combat' && m.enemyIds ? ` · ${m.enemyIds.length} 个魔物` : ''}</span></div>
          <span className={`pill work-${m.work}`}>{m.status === 'done' ? '已完成' : m.status === 'active' ? '派遣中' : m.work === 'combat' ? '战斗' : '调查'}</span>
          <ArrowUpRight size={18} />
        </button>;
      })}
      {!state.missions.some(visible) && <div className="map-empty"><Radar /><h3>这个筛选项下没有委托</h3><p>切换到「全部委托」，或推进时间等待新的心愿信号。</p></div>}
    </div> : <div className={`map-viewport ${over ? 'is-drag-over' : ''}`}>
      <div className="map-world" style={{ transform: `scale(${zoom})` }}>
        <img className="city-art" src="/art/city.svg" alt="樱雾市夜间街区，穿城河流连接糖果街、月见广场和旧钟楼" draggable={false} />
        <div className="map-grain" />
        <svg className="mission-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{state.missions.filter(m => m.status === 'active').map(m => <path key={m.id} d={`M 53 88 Q ${m.x - 10} 76 ${m.x} ${m.y}`} fill="none" stroke={m.color} strokeWidth=".22" strokeDasharray=".6 .6" />)}</svg>
        <span className="district-label district-west">旧城区</span><span className="district-label district-river">星见川</span><span className="district-label district-south">南十字街区</span>
        {state.missions.map(m => {
          const Icon = icons[m.id as keyof typeof icons] ?? (m.work === 'combat' ? Swords : ScanEye);
          const squad = m.squad.map(id => state.girls.find(g => g.id === id)).filter(Boolean);
          return <button id={`mission-${m.id}`} key={m.id} className={`mission-pin ${m.category === '紧急委托' ? 'urgent' : ''} ${m.status} work-${m.work} ${over === m.id ? 'drop-target' : ''} ${!visible(m) ? 'filtered' : ''}`} style={{ left: `${m.x}%`, top: `${m.y}%`, '--pin-color': m.color } as React.CSSProperties} onClick={() => onMission(m.id)} aria-label={`${m.title}，${m.work === 'combat' ? '战斗委托' : '调查委托'}，${m.status === 'open' ? m.difficulty : m.status === 'active' ? '派遣中' : '已完成'}`} onDragOver={e => { if (m.status === 'open') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(m.id); } }} onDragLeave={() => setOver(null)} onDrop={e => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/girl-id'); if (id) onDropGirl(id, m.id); }}>
            <span className="pin-orbit" />
            <span className="pin-symbol">{m.status === 'done' ? <Check size={20} /> : <Icon size={21} />}</span>
            <span className="pin-caption">
              <small>{m.status === 'active' ? `${squad.map(g => g!.name).join('、') || '契约者'} · 出勤中` : m.status === 'done' ? '事件已归档' : `${m.work === 'combat' ? '战斗' : '调查'} · ${m.category}`}{m.category === '紧急委托' && m.status === 'open' && <b>优先</b>}</small>
              <strong>{m.title}</strong>
              <em><Clock3 size={10} />{m.duration} 分钟<span>+{m.reward} 星砂</span></em>
              {m.work === 'combat' && m.status === 'open' && <span className="pin-threat"><Skull size={10} />{m.enemyIds?.length ?? 0} 魔物 · 威胁 {threat(m)}</span>}
              {m.status === 'open' && m.work === 'combat' && <span className="pin-slots"><Users size={10} />队伍 0 / 3</span>}
              {m.worsened && <span className="pin-wounded">带伤 · 下次 −20%</span>}
            </span>
          </button>;
        })}
        <div className="base-map-marker"><div><Cat size={20} /><StarMark /></div><span>夜糖事务所</span><small>我们的归处</small></div>
      </div>
      <div className="map-coordinate"><Crosshair size={12} /><span>35° 41′ N · 139° 42′ E</span></div>
      <div className="map-compass"><span>北</span><MoveUpRight size={24} /></div>
      <div className="map-zoom"><button id="map-zoom-in" onClick={() => setZoom(z => Math.min(1.5, z + .1))} disabled={zoom >= 1.5} aria-label="放大地图"><Plus size={17} /></button><button id="map-zoom-out" onClick={() => setZoom(z => Math.max(1, z - .1))} disabled={zoom <= 1} aria-label="缩小地图"><Minus size={17} /></button><button id="map-reset-view" onClick={() => setZoom(1)} aria-label="还原地图"><LocateFixed size={16} /></button></div>
      <div className="map-location"><span>樱雾市</span><small>月光覆盖区 / 东七区</small></div>
      <div className="map-legend"><span><i className="legend-pink" />待处理</span><span><i className="legend-blue" />派遣中</span><span><i className="legend-gray" />已完成</span></div>
    </div>}
    <div className="map-footnote"><span><Radio size={13} />把契约者拖至任务点，或点击任务开始编队</span><span>夜间结界稳定 <i /></span></div>
  </section>;
}
function StarMark() { return <Sparkles size={10} className="base-star" />; }
