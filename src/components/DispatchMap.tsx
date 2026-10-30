import { useMemo, useState } from 'react';
import { Radar, Candy, TrainFront, Eclipse, Cat, Mail, Plus, Minus, LocateFixed, ArrowUpRight, List, Map as MapIcon, Sparkles, Clock3, MoveUpRight, Crosshair, Radio, Check, Swords, ScanEye, Users, Skull, Hourglass, MapPin, Wind } from 'lucide-react';
import type { GameState, Mission } from '../types';
import { findMonster } from '../content/monsters';
import { districts, districtOrder, effectLines, districtOfMission, type DistrictId } from '../districts';
import { missionDeadlineLabel } from '../game';
import { factionColor, factionName } from '../territories';
import { windowLabel } from '../shift';
import { cityAveragePollution, clampPollution, pollutionEffect, pollutionLines, pollutionRelief, pollutionTier, pollutionTierColors, pollutionTierLabel, pollutionTierNames, pollutionTierOrder } from '../pollution';
import { canIntercept, factionPurification } from '../factions';
import { frontRemaining } from '../fronts';
import { factionAttitude } from '../economy';

const icons = { candy: Candy, station: TrainFront, mirror: Eclipse, cat: Cat, tower: Mail };
type Filter = 'all' | 'combat' | 'investigation' | 'urgent' | 'active';

export function DispatchMap({ state, onMission, onFront, onDropGirl }: { state: GameState; onMission: (id: string) => void; onFront: (id: string) => void; onDropGirl: (girlId: string, missionId: string) => void }) {
  const [zoom, setZoom] = useState(1), [filter, setFilter] = useState<Filter>('all'), [list, setList] = useState(false), [over, setOver] = useState<string | null>(null), [focus, setFocus] = useState<DistrictId | null>(null);
  const open = state.missions.filter(m => m.status === 'open').length;
  const visible = (m: Mission) => filter === 'all' || (filter === 'urgent' ? m.window === 'urgent' || m.category === '紧急委托' : filter === 'active' ? m.status === 'active' : m.work === filter);
  const threat = (m: Mission) => (m.enemyIds ?? []).reduce((sum, id) => sum + (findMonster(id)?.maxHp ?? 0), 0);
  const pins = useMemo(() => state.missions.map(m => ({ mission: m, district: districtOfMission(m).id })), [state.missions]);
  const focused = focus ? districts[focus] : null;
  const focusedMissions = focus ? pins.filter(p => p.district === focus && p.mission.status !== 'done' && p.mission.status !== 'expired') : [];
  const districtCount = (id: DistrictId) => pins.filter(p => p.district === id && (p.mission.status === 'open' || p.mission.status === 'active')).length;

  const toggleFocus = (id: DistrictId) => setFocus(current => current === id ? null : id);

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
        const region = districtOfMission(m);
        const deadline = missionDeadlineLabel(m, state);
        return <button id={`mission-list-${m.id}`} className="mission-list-row" key={m.id} onClick={() => onMission(m.id)}>
          <Icon size={24} />
          <div>
            <small>{region.name} · {m.category} · {m.difficulty} · {m.work === 'combat' ? `${m.squad.length} 人编队` : '调查'}</small>
            <h3>{m.title}</h3>
            <span>{m.duration} 分钟 · {m.reward} 星砂{m.window ? ` · ${windowLabel[m.window]}委托` : ''}{deadline && m.status === 'open' ? ` · ${deadline}` : ''}</span>
          </div>
          <span className={`pill work-${m.work}`}>{m.status === 'expired' ? '已过期' : m.status === 'done' ? '已完成' : m.status === 'active' ? '派遣中' : m.window === 'urgent' ? '紧急' : m.work === 'combat' ? '战斗' : '调查'}</span>
          <ArrowUpRight size={18} />
        </button>;
      })}
      {!state.missions.some(visible) && <div className="map-empty"><Radar /><h3>这个筛选项下没有委托</h3><p>切换到「全部委托」，或推进时间等待新的心愿信号。</p></div>}
    </div> : <div className={`map-viewport ${over ? 'is-drag-over' : ''}`}>
      <div className="map-world" style={{ transform: `scale(${zoom})` }}>
        <img className="city-art" src="/art/city.svg" alt="樱雾市夜间街区，穿城河流连接糖果公园、旧钟楼与南十字街区" draggable={false} />
        <div className="map-grain" />
        <svg className="district-layer" viewBox="0 0 1100 780" preserveAspectRatio="none" aria-label="辖区边界">
          {districtOrder.map(id => {
            const region = districts[id];
            const count = districtCount(id);
            const level = clampPollution(state.pollution?.[id] ?? 0);
            const tier = pollutionTier(level);
            return <g key={id} className={`district-shape ${focus === id ? 'focused' : ''} ${count ? 'has-work' : ''}`} style={{ '--district-tint': region.tint } as React.CSSProperties}>
              <polygon className="district-owner" points={region.points} style={{ fill: factionColor[state.territories[id]] }} aria-hidden="true" />
              <polygon className={`district-pollution ${tier}`} points={region.points} aria-hidden="true" style={{ '--pollution-alpha': 0.04 + level / 100 * 0.26 } as React.CSSProperties} />
              <polygon className="district-fill" points={region.points} onClick={() => toggleFocus(id)} />
              <polygon className="district-edge" points={region.points} />
              <text className="district-name" x={region.label.x} y={region.label.y} onClick={() => toggleFocus(id)}>{region.name}</text>
              <text className={`district-pollution-label ${tier}`} x={region.label.x} y={region.label.y + 15} onClick={() => toggleFocus(id)}>污染 {level}</text>
              {count > 0 && <g className="district-count" transform={`translate(${region.label.x} ${region.label.y + 29})`}><rect x={-9} y={-9} width={18} height={13} rx={3} /><text x={0} y={1}>{count}</text></g>}
            </g>;
          })}
          {state.fronts.filter(front => front.status === 'open' || front.status === 'joined').map(front => {
            const region = districts[front.district];
            const left = frontRemaining(front, { day: state.day, minutes: state.minutes });
            return <g key={front.id} className="district-front" id={`map-front-${front.district}`} transform={`translate(${region.label.x} ${region.label.y - 26})`} role="button" tabIndex={0} onClick={() => onFront(front.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onFront(front.id); }}>
              <rect className="front-chip" x={-38} y={-10} width={76} height={20} rx={10} style={{ '--front-a': factionColor[front.attacker], '--front-b': factionColor[front.defender] } as React.CSSProperties} />
              <text className="front-chip-text" x={0} y={4}>战线 {left}</text>
            </g>;
          })}
        </svg>
        <svg className="mission-routes" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{state.missions.filter(m => m.status === 'active').map(m => <path key={m.id} d={`M 53 88 Q ${m.x - 10} 76 ${m.x} ${m.y}`} fill="none" stroke={m.color} strokeWidth=".22" strokeDasharray=".6 .6" />)}</svg>
        {state.missions.map(m => {
          const Icon = icons[m.id as keyof typeof icons] ?? (m.work === 'combat' ? Swords : ScanEye);
          const squad = m.squad.map(id => state.girls.find(g => g.id === id)).filter(Boolean);
          const region = districtOfMission(m);
          const deadline = missionDeadlineLabel(m, state);
          const expired = m.status === 'expired';
          return <button id={`mission-${m.id}`} key={m.id} disabled={expired} className={`mission-pin ${m.window === 'urgent' ? 'urgent' : ''} ${m.status} work-${m.work} ${over === m.id ? 'drop-target' : ''} ${!visible(m) ? 'filtered' : ''}`} style={{ left: `${m.x}%`, top: `${m.y}%`, '--pin-color': m.color } as React.CSSProperties} onClick={() => onMission(m.id)} aria-label={`${region.name}，${m.title}，${m.work === 'combat' ? '战斗委托' : '调查委托'}${deadline ? `，${deadline}` : ''}`} onDragOver={e => { if (m.status === 'open') { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(m.id); } }} onDragLeave={() => setOver(null)} onDrop={e => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/girl-id'); if (id) onDropGirl(id, m.id); }}>
            <span className="pin-orbit" />
            <span className="pin-symbol">{expired ? <Hourglass size={19} /> : m.status === 'done' ? <Check size={20} /> : <Icon size={21} />}</span>
            <span className="pin-caption">
              <small>{expired ? `${region.name} · 信号已消散` : m.status === 'active' ? `${squad.map(g => g!.name).join('、') || '契约者'} · 出勤中` : `${region.name} · ${m.window ? windowLabel[m.window] : m.work === 'combat' ? '战斗' : '调查'}`}{m.window === 'urgent' && m.status === 'open' && <b>限时</b>}</small>
              <strong>{m.title}</strong>
              <em><Clock3 size={10} />{m.duration} 分钟<span>+{m.reward} 星砂</span></em>
              {deadline && (m.status === 'open' || m.status === 'active') && <span className={`pin-deadline ${m.window === 'urgent' ? 'urgent' : ''}`}><Hourglass size={10} />{m.status === 'active' ? '派遣中' : `接取${deadline}`}</span>}
              {m.work === 'combat' && m.status === 'open' && <span className="pin-threat"><Skull size={10} />{m.enemyIds?.length ?? 0} 魔物 · 威胁 {threat(m)}</span>}
              {m.status === 'open' && m.work === 'combat' && <span className="pin-slots"><Users size={10} />队伍 0 / 3</span>}
              {m.worsened && <span className="pin-wounded">带伤 · 下次 −20%</span>}
            </span>
          </button>;
        })}
        <div className="base-map-marker"><div><Cat size={20} /><StarMark /></div><span>夜糖事务所</span><small>我们的归处</small></div>
      </div>
      {focused && <aside className="district-panel" id={`district-panel-${focused.id}`} aria-label={`${focused.name}辖区详情`}>
        <header>
          <span className="district-panel-eyebrow"><MapPin size={11} />辖区 · {focused.terrain}</span>
          <button id="district-panel-close" onClick={() => setFocus(null)} aria-label="收起辖区详情">×</button>
        </header>
        <h3>{focused.name}<small>{focused.subtitle}</small></h3>
        <p>{focused.description}</p>
        <div className="district-effects" role="list" aria-label="环境影响">
          {effectLines(focused.effect).map(line => <span role="listitem" key={line.label} className={`district-effect tone-${line.tone}`}><b>{line.label}</b><em>{line.value}</em></span>)}
        </div>
        {(() => {
          const level = clampPollution(state.pollution?.[focused.id] ?? 0);
          const tier = pollutionTier(level);
          const effect = pollutionEffect(level);
          const owner = state.territories[focused.id];
          const relief = pollutionRelief({ owner, duration: 60, work: 'investigation' });
          const interceptable = focusedMissions.some(item => canIntercept(state, item.mission));
          const ownerLabel = factionName[owner];
          const attitude = factionAttitude(state.factions[owner].standing).label;
          return <div className="district-pollution-panel" id={`district-pollution-${focused.id}`}>
            <div className="district-pollution-head">
              <b>污染 {level}</b>
              <span className={`pollution-tier ${tier}`} style={{ color: pollutionTierColors[tier] }}>{pollutionTierLabel(level)}</span>
            </div>
            <div className="district-pollution-meter" aria-hidden="true"><i style={{ width: `${level}%`, background: pollutionTierColors[tier] }} /></div>
            <ul>
              <li>每日 +{level >= 60 ? 3 : level >= 30 ? 2 : 1}（自然增长，不受势力影响）</li>
              <li>完成委托约 −{relief}（按 60 分钟调查估算，{ownerLabel}净化 +{factionPurification(owner).relief}）</li>
              {pollutionLines(effect).map(line => <li key={line} className="pollution-risk">{line}</li>)}
            </ul>
            <p className="district-pollution-owner">当主 {ownerLabel} · {attitude}</p>
            {interceptable && <p className="district-interception-note">此区派遣会被{ownerLabel}所属少女拦截。</p>}
            <p className="district-pollution-flavor">{owner === 'association' ? '协会的净化班每天清晨经过这里。' : owner === 'government' ? '勤务课把这里排进了夜间轮值表。' : '庭里只救受洗的人；未受洗者，绕路。'}</p>
          </div>;
        })()}
        <footer>
          <span><Wind size={11} />本夜可接委托 {focusedMissions.length} 件</span>
          <small>{focusedMissions.map(m => m.mission.title).slice(0, 2).join(' · ') || '暂时没有心愿信号'}</small>
        </footer>
      </aside>}
      <div className="map-coordinate"><Crosshair size={12} /><span>35° 41′ N · 139° 42′ E</span></div>
      <div className="map-compass"><span>北</span><MoveUpRight size={24} /></div>
      <div className="map-zoom"><button id="map-zoom-in" onClick={() => setZoom(z => Math.min(1.5, z + .1))} disabled={zoom >= 1.5} aria-label="放大地图"><Plus size={17} /></button><button id="map-zoom-out" onClick={() => setZoom(z => Math.max(1, z - .1))} disabled={zoom <= 1} aria-label="缩小地图"><Minus size={17} /></button><button id="map-reset-view" onClick={() => { setZoom(1); setFocus(null); }} aria-label="还原地图"><LocateFixed size={16} /></button></div>
      <div className="map-location"><span>樱雾市</span><small>月光覆盖区 / 东七区</small></div>
      <div className="map-legend"><span><i className="legend-pink" />待处理</span><span><i className="legend-blue" />派遣中</span><span><i className="legend-gray" />已归档</span></div>
          <div className="map-legend territory"><span><i style={{ background: factionColor.witch }} />{factionName.witch}</span><span><i style={{ background: factionColor.association }} />{factionName.association}</span><span><i style={{ background: factionColor.government }} />{factionName.government}</span></div>
          <div className="map-legend pollution" id="map-pollution-legend">
            <span className="pollution-legend-title">污染</span>
            {pollutionTierOrder.map(tier => <span key={tier}><i style={{ background: pollutionTierColors[tier] }} />{pollutionTierNames[tier]}</span>)}
            <span className="pollution-legend-average">城市平均 {cityAveragePollution(state)} · {pollutionTierLabel(cityAveragePollution(state))}</span>
          </div>
    </div>}
    <div className="map-footnote"><span><Radio size={13} />点选辖区查看环境与背景；把契约者拖至任务点即可编队</span><span>夜间结界稳定 <i /></span></div>
    {!list && <p className="map-window-note"><Hourglass size={11} />紧急委托两小时内必须接下，否则自动撤销；长期委托整晚有效，打烊时统一结算。</p>}
  </section>;
}

function StarMark() { return <Sparkles size={10} className="base-star" />; }
