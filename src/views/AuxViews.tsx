import { useId, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, BedDouble, BookOpen, Building2, Cat, Check, ChevronRight, Coins, Crosshair, Flower2, Heart, HeartPulse, History, House, Info, LockKeyhole, MessageCircle, Plus, Search, Shield, Sparkles, Star, Swords, Telescope, Users } from 'lucide-react';
import type { GameState, Girl, Room } from '../types';
import './aux-views.css';

type BaseViewProps = { state: GameState; onRoom: (id: string) => void; onBuild: () => void; onGirl: (id: string) => void; onTalk: (id: string) => void };
type MarketViewProps = { state: GameState; onHire: (id: string) => void; onGirl: (id: string) => void };
type RecordsViewProps = { state: GameState; onBattle: (id: string) => void; onCodex: () => void };
type Metric = 'income' | 'expense' | 'reputation';
type LogKind = GameState['logs'][number]['kind'];

const number = (value: number) => value.toLocaleString('zh-CN');
const hm = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const statusText: Record<Girl['status'], string> = { idle: '闲暇中', mission: '任务执行中', healing: '正在治疗', resting: '正在休息', retired: '已退役' };
const roomIcons = { lounge: Cat, clinic: HeartPulse, dorm: BedDouble, observatory: Telescope };
const roomCaptions = { lounge: '茶香、软糖与不必保密的心事。', clinic: '把伤口留在这里，把勇气带回去。', dorm: '今晚的星光，也需要好好休息。', observatory: '城市的每一次心跳，都有回声。' };
const metricNames: Record<Metric, string> = { income: '委托收入', expense: '经营支出', reputation: '城市声望' };
const kindNames: Record<LogKind, string> = { dispatch: '派遣', finance: '收支', story: '故事', care: '照护', base: '基地', battle: '战斗', relationship: '关系', memorial: '悼念' };
const kindIcons = { dispatch: Crosshair, finance: Coins, story: MessageCircle, care: HeartPulse, base: House, battle: Swords, relationship: Heart, memorial: Flower2 };
const outcomeNames = { victory: '战斗胜利', repelled: '暂时击退', defeat: '战斗失败', draw: '僵持收场' } as const;

function capacityOf(state: GameState) {
  const dorms = state.rooms.filter(room => room.type === 'dorm');
  return (dorms.length ? dorms : state.rooms).reduce((sum, room) => sum + room.capacity, 0);
}

/** Furniture is an integral part of the floor plan, not an external image. */
function RoomFurniture({ type }: { type: Room['type'] }) {
  return <svg className={`av-furniture av-furniture-${type}`} viewBox="0 0 220 105" fill="none" aria-hidden="true">
    {type === 'lounge' && <>
      <rect x="16" y="28" width="80" height="35" rx="5" /><path d="M23 27v-8h65v8M16 37h80M29 38v23m27-23v23m27-23v23M20 64v7m72-7v7" />
      <rect x="116" y="37" width="47" height="32" rx="9" /><path d="M123 43h33m-27 11h20M138 46v15" />
      <circle cx="140" cy="54" r="4" /><path d="m171 18 7-10 5 11 10 3-6 7 2 11-11-5-9 5 1-12-7-7Z" />
      <path d="M25 84h145m-121 6h91" strokeDasharray="3 5" />
      <rect x="178" y="59" width="24" height="25" rx="2" /><path d="M190 59v-7m-9-9 9 9 9-9m-9 9V37" />
    </>}
    {type === 'clinic' && <>
      <rect x="26" y="17" width="57" height="73" rx="5" /><rect x="33" y="23" width="43" height="16" rx="3" /><path d="M26 48h57M34 54v27m41-27v27M21 22h-5v57h5m67-57h5v57h-5" />
      <rect x="130" y="15" width="56" height="27" rx="2" /><path d="M158 15v27m-14-19v12m-6-6h12m20-6v12m-6-6h12" />
      <circle cx="151" cy="72" r="14" /><path d="M151 62v20m-10-10h20m36-14v27m-8-9h16" />
    </>}
    {type === 'dorm' && <>
      <rect x="20" y="15" width="56" height="75" rx="3" /><rect x="27" y="21" width="42" height="18" rx="3" /><path d="M20 48h56m-48 7v27m40-27v27" />
      <rect x="135" y="15" width="56" height="75" rx="3" /><rect x="142" y="21" width="42" height="18" rx="3" /><path d="M135 48h56m-48 7v27m40-27v27" />
      <rect x="88" y="18" width="34" height="25" rx="2" /><circle cx="105" cy="30" r="6" /><path d="M105 24v6l4 3m-17 32h27m-22-5v20m17-20v20" />
      <path d="m100 79 5-9 5 9 10 1-7 7 2 10-10-5-9 5 2-10-7-7Z" />
    </>}
    {type === 'observatory' && <>
      <circle cx="112" cy="51" r="42" strokeDasharray="3 5" /><circle cx="112" cy="51" r="31" /><path d="m92 37 46-15 7 21-46 15Zm19 17-20 36m20-36 23 36m-23-36v36M76 51h72m-36-36v72" />
      <circle cx="36" cy="24" r="3" /><path d="m33 65 4-8 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6Zm141-41h13m-6-6v13m8 41h13m-6-6v13" />
    </>}
  </svg>;
}

function RoomTile({ room, occupants, selected, onSelect, onGirl }: { room: Room; occupants: Girl[]; selected: boolean; onSelect: () => void; onGirl: (id: string) => void }) {
  const Icon = roomIcons[room.type];
  return <div className={`av-room-tile ${selected ? 'av-room-tile-selected' : ''}`}>
    <button id={`av-base-room-${room.id}`} type="button" className="av-room" aria-pressed={selected} onClick={onSelect} aria-label={`${room.name}，等级${room.level}，${occupants.length}名成员在此。查看房间`}>
      <span className="av-room-title"><Icon size={15} strokeWidth={1.4} />{room.name}</span>
      <span className="av-room-number">{room.type === 'lounge' ? '公共区域' : room.type === 'clinic' ? '照护区域' : room.type === 'dorm' ? '居住区域' : '观测区域'}</span>
      <RoomFurniture type={room.type} />
      <span className="av-room-note">{room.type === 'dorm' ? `可容纳 ${room.capacity} 名成员` : `设施等级 ${room.level}`}<ChevronRight size={11} /></span>
    </button>
    <div className="av-room-people" aria-label={`${room.name}内的成员`}>
      {occupants.length ? occupants.map(girl => <button id={`av-base-map-girl-${girl.id}`} className="av-map-person" key={girl.id} type="button" onClick={() => onGirl(girl.id)} title={`${girl.name} · ${statusText[girl.status]}`} aria-label={`查看${girl.name}，${statusText[girl.status]}`}><img className="av-room-avatar" src={girl.portrait} alt="" loading="lazy" /><span>{girl.name}</span></button>) : <small className="av-room-unoccupied">暂无成员停留</small>}
    </div>
  </div>;
}

export function BaseView({ state, onRoom, onBuild, onGirl, onTalk }: BaseViewProps) {
  const [selectedId, setSelectedId] = useState(state.rooms[0]?.id ?? '');
  const room = state.rooms.find(item => item.id === selectedId) ?? state.rooms[0];
  const present = state.girls.filter(girl => !girl.retired && girl.status !== 'mission');
  const active = state.girls.filter(girl => !girl.retired);
  const away = active.filter(girl => girl.status === 'mission').length;
  const occupants = room ? present.filter(girl => girl.roomId === room.id) : [];
  const capacity = capacityOf(state);
  const Icon = room ? roomIcons[room.type] : House;
  return <section className="av-view av-base-view" aria-labelledby="av-base-title">
    <header className="av-heading"><div><p className="av-eyebrow"><House size={12} />夜糖事务所 · 基地</p><h1 id="av-base-title">灯火为你而留</h1><p>出发之前，或归来之后。这里始终有一个位置。</p></div><div className="av-heading-meta"><Users size={14} /><span>契约成员</span><strong>{active.length}<span className="av-capacity-denominator"> / {capacity}</span></strong></div></header>
    <div className="av-base-layout">
      <div><div className="av-floorplan"><div className="av-floor-topline"><span><span className="av-live-dot" />基地平面图</span><span>月见街 17 号 · 二层</span></div>
        <div className="av-room-grid">{state.rooms.slice(0, 2).map(item => <RoomTile key={item.id} room={item} occupants={present.filter(girl => girl.roomId === item.id)} selected={room?.id === item.id} onSelect={() => { setSelectedId(item.id); onRoom(item.id); }} onGirl={onGirl} />)}
          <div className="av-corridor"><span>星屑回廊</span><Star size={10} strokeWidth={1} /></div>
          {state.rooms.slice(2).map(item => <RoomTile key={item.id} room={item} occupants={present.filter(girl => girl.roomId === item.id)} selected={room?.id === item.id} onSelect={() => { setSelectedId(item.id); onRoom(item.id); }} onGirl={onGirl} />)}
        </div><div className="av-floor-bottomline"><span><Info size={11} />选择房间管理设施，选择成员查看档案</span><span className="av-floor-scale">5 米</span></div></div>
        <div className="av-base-footer"><p><Building2 size={13} /> 给下一位归来的少女，留一扇亮着的窗。<br /><span>扩建宿舍，增加事务所可容纳的契约成员。</span></p><button id="av-base-expand" className="av-btn av-btn-primary" type="button" onClick={onBuild}><Plus size={14} />建造与扩建<ArrowRight size={14} /></button></div>
      </div>
      <aside className="av-room-detail" aria-labelledby="av-room-detail-title"><div className="av-room-detail-icon"><Icon size={22} strokeWidth={1.3} /></div><h2 id="av-room-detail-title">{room?.name ?? '尚未建造房间'}</h2><p>{room?.description ?? '建造第一间设施，让这里成为真正的家。'}</p>
        {room && <><div className="av-detail-stat"><span>设施等级</span><strong>等级 {room.level}</strong></div><div className="av-detail-stat"><span>当前成员</span><strong>{occupants.length} 人</strong></div></>}
        <div className="av-room-characters"><h3>在此相遇</h3>{occupants.length ? occupants.map(girl => <div className="av-person-row" key={girl.id}><button id={`av-base-detail-girl-${girl.id}`} type="button" className="av-person" onClick={() => onGirl(girl.id)}><img src={girl.portrait} alt="" loading="lazy" /><span className="av-person-copy"><span>{girl.name}</span><small>{statusText[girl.status]} · 生命 {girl.hp}/{girl.maxHp}</small></span><ChevronRight size={14} /></button><button id={`av-base-talk-${girl.id}`} type="button" className="av-talk-btn" onClick={() => onTalk(girl.id)} aria-label={`与${girl.name}交谈`} title={`与${girl.name}交谈`}><MessageCircle size={15} /></button></div>) : <div className="av-empty av-empty-room"><Cat size={27} strokeWidth={1} /><p>这里很安静。<br />{room ? roomCaptions[room.type] : '选择一间房间，看看谁在这里。'}</p></div>}</div>
        {room && <div className="av-room-actions"><button id="av-base-manage-selected-room" type="button" className="av-btn av-btn-small" onClick={() => onRoom(room.id)}>管理房间<ArrowUpRight size={12} /></button></div>}
      </aside>
    </div>
    <p className="av-section-caption"><Sparkles size={12} />{present.length} 名成员在基地 · {away} 名成员正在城市中执行委托。交谈将保留为她们各自的故事记忆。</p>
  </section>;
}

function CandidateCard({ girl, state, onHire, onGirl }: { girl: Girl; state: GameState; onHire: (id: string) => void; onGirl: (id: string) => void }) {
  const hired = state.girls.some(member => member.id === girl.id);
  const stats: [string, number][] = [['魔力', girl.stats.magic], ['洞察', girl.stats.insight], ['敏捷', girl.stats.agility], ['共情', girl.stats.empathy]];
  return <article className="av-candidate" aria-labelledby={`av-candidate-name-${girl.id}`}>
    <button id={`av-market-preview-${girl.id}`} type="button" className="av-candidate-preview" onClick={() => onGirl(girl.id)} aria-label={`查看${girl.name}的完整档案`}><img src={girl.portrait} alt={`${girl.name}的魔法少女立绘`} loading="lazy" /><span className="av-candidate-rank">{girl.element}</span><span className="av-candidate-inspect">查看档案<ArrowUpRight size={12} /></span></button>
    <div className="av-candidate-body"><div className="av-candidate-title"><h2 id={`av-candidate-name-${girl.id}`}>{girl.name}</h2><span className="av-tag">等级 {girl.level}</span></div><p className="av-candidate-role">{girl.codename} · {girl.title}</p><p className="av-candidate-quote">{girl.description}</p><div className="av-candidate-skills"><span className="av-tag av-tag-pink"><Sparkles size={10} />{girl.skill}</span><span className="av-tag">{girl.stats.empathy >= girl.stats.magic ? '支援倾向' : '作战倾向'}</span></div><div className="av-candidate-stats">{stats.map(([label, value]) => <div className="av-candidate-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="av-candidate-hire"><span className="av-candidate-price">{number(girl.cost)}<small>星砂</small></span><button id={`av-market-hire-${girl.id}`} type="button" className="av-btn av-btn-primary av-btn-small" onClick={() => onHire(girl.id)} disabled={hired}>{hired ? <><Check size={13} />已签订契约</> : <><Plus size={13} />邀请加入</>}</button></div></div>
  </article>;
}

export function MarketView({ state, onHire, onGirl }: MarketViewProps) {
  const [filter, setFilter] = useState<'all' | 'combat' | 'support'>('all');
  const [query, setQuery] = useState('');
  const candidates = state.candidates.filter(girl => {
    const support = girl.stats.empathy >= girl.stats.magic;
    const matchesRole = filter === 'all' || (filter === 'support' ? support : !support);
    return matchesRole && `${girl.name}${girl.codename}${girl.title}${girl.element}${girl.description}`.includes(query.trim());
  });
  return <section className="av-view av-market-view" aria-labelledby="av-market-title"><header className="av-heading"><div><p className="av-eyebrow"><Star size={12} />星愿契约 · 人才市场</p><h1 id="av-market-title">寻找下一束微光</h1><p>每一份契约，都是两段命运的相遇。</p></div><div className="av-heading-meta"><Coins size={14} /><span>可用星砂</span><strong>{number(state.gold)}</strong></div></header>
    <div className="av-market-note"><Shield size={21} strokeWidth={1.3} /><p><strong>不是雇佣武器，而是邀请伙伴。</strong><br />签约前可以查看完整档案；加入后，她的能力、情绪与经历都将影响事务所的故事。</p></div>
    <div className="av-toolbar"><div className="av-filters" aria-label="候选成员类型">{([['all', '全部'], ['combat', '作战'], ['support', '支援']] as const).map(([value, label]) => <button id={`av-market-filter-${value}`} type="button" className="av-filter" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{label}</button>)}<span className="av-filter-count">{candidates.length} 位候选成员</span></div><label className="av-search" htmlFor="av-market-search"><Search size={14} /><input id="av-market-search" className="av-input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="寻找姓名、称号或元素" aria-label="搜索候选魔法少女" /></label></div>
    {candidates.length ? <div className="av-candidate-grid">{candidates.map(girl => <CandidateCard key={girl.id} girl={girl} state={state} onHire={onHire} onGirl={onGirl} />)}</div> : <div className="av-empty"><Search size={30} strokeWidth={1} /><p>{state.candidates.length ? '没有找到符合条件的契约者。' : '此刻的星愿名册已经翻到最后一页。'}<br />{state.candidates.length ? '试着更换类型，或使用其他关键词。' : '已加入的伙伴，可以在基地中找到。'}</p>{state.candidates.length > 0 && <button id="av-market-clear-filters" className="av-btn av-btn-small" type="button" onClick={() => { setFilter('all'); setQuery(''); }}>清除筛选</button>}</div>}
    <footer className="av-market-footer"><span><Info size={12} /> 契约费用为一次性支出。完成邀请前会再次确认。</span><span>成员容量 {state.girls.filter(girl => !girl.retired).length} / {capacityOf(state)} · 在基地扩建宿舍可增加容量</span></footer>
  </section>;
}

function RecordsChart({ state, range, metric }: { state: GameState; range: number; metric: Metric }) {
  const gradientId = `av-record-gradient-${useId().replace(/:/g, '')}`;
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const samples = useMemo(() => state.samples.filter(sample => sample.day >= Math.max(1, state.day - range + 1)).slice(-range), [state.samples, state.day, range]);
  const width = 760, height = 220, left = 47, right = 19, top = 16, bottom = 35;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(4, ...samples.map(sample => sample[metric]));
  const tick = Math.max(1, Math.ceil(maxValue / 4));
  const ceiling = tick * 4;
  const points = samples.map((sample, index) => ({ ...sample, x: samples.length > 1 ? left + index * (width - left - right) / (samples.length - 1) : (width + left - right) / 2, y: top + chartHeight * (1 - sample[metric] / ceiling) }));
  const active = points.find(point => point.day === activeDay) ?? points.at(-1);
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const areaPath = points.length ? `${linePath} L${points.at(-1)!.x},${height - bottom} L${points[0].x},${height - bottom} Z` : '';
  const latest = points.at(-1)?.[metric] ?? 0;
  return <><div className="av-chart-metric"><strong>{number(latest)}</strong><span>{metric === 'reputation' ? '声望' : '星砂'} · 最近一日</span></div>{points.length ? <div className="av-chart-wrap"><svg className="av-chart-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`最近${range}天${metricNames[metric]}折线图。可使用制表键查看每日数据。`}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f49abd" stopOpacity=".16" /><stop offset="100%" stopColor="#f49abd" stopOpacity="0" /></linearGradient></defs>{[0, 1, 2, 3, 4].map(index => { const y = top + chartHeight * index / 4; return <g key={index}><line className="av-chart-grid" x1={left} y1={y} x2={width - right} y2={y} /><text x={left - 12} y={y + 3} textAnchor="end">{number(ceiling - index * tick)}</text></g>; })}<path d={areaPath} fill={`url(#${gradientId})`} /><path className="av-chart-line" d={linePath} />{active && <line className="av-chart-selected-line" x1={active.x} y1={top} x2={active.x} y2={height - bottom} />}{points.map((point, index) => <g key={point.day}><g id={`av-record-point-${metric}-day-${point.day}`} className="av-chart-point" role="button" tabIndex={0} aria-label={`第${point.day}天，${metricNames[metric]}${point[metric]}${metric === 'reputation' ? '点' : '星砂'}`} data-active={active?.day === point.day} onMouseEnter={() => setActiveDay(point.day)} onFocus={() => setActiveDay(point.day)} onClick={() => setActiveDay(point.day)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveDay(point.day); } }}><circle cx={point.x} cy={point.y} r="14" fill="transparent" /><circle className="av-chart-point-dot" cx={point.x} cy={point.y} r="3.5" /><title>第{point.day}天：{metricNames[metric]} {number(point[metric])}</title></g>{(samples.length <= 7 || index % 2 === 0 || index === samples.length - 1) && <text x={point.x} y={height - 10} textAnchor="middle">第{point.day}天</text>}</g>)}</svg><div className="av-chart-tooltip" aria-live="polite">{active && <><span>第 {active.day} 天</span><span>{metricNames[metric]}</span><strong>{number(active[metric])}</strong><span>{metric === 'reputation' ? '声望' : '星砂'}</span></>}</div></div> : <div className="av-empty"><History size={28} strokeWidth={1} /><p>还没有经营数据。<br />推进游戏时间后，第一条曲线会从这里开始。</p></div>}</>;
}

export function RecordsView({ state, onBattle, onCodex }: RecordsViewProps) {
  const [range, setRange] = useState(7);
  const [metric, setMetric] = useState<Metric>('income');
  const [kind, setKind] = useState<'all' | LogKind>('all');
  const [visibleCount, setVisibleCount] = useState(8);
  const totals = useMemo(() => state.samples.reduce((sum, sample) => ({ income: sum.income + sample.income, expense: sum.expense + sample.expense }), { income: 0, expense: 0 }), [state.samples]);
  const logs = state.logs.filter(log => kind === 'all' || log.kind === kind);
  return <section className="av-view av-records-view" aria-labelledby="av-records-title"><header className="av-heading"><div><p className="av-eyebrow"><History size={12} />事务所档案 · 经营记录</p><h1 id="av-records-title">每个选择，都有回响</h1><p>那些守护过的夜晚，和慢慢变好的日常。</p></div><div className="av-heading-meta"><span className="av-live-dot" /><span>记录至第 {state.day} 天</span></div></header>
    <div className="av-record-summary"><div className="av-record-stat"><span><ArrowDownLeft size={13} />记录期委托收入</span><strong>{number(totals.income)}</strong><small>星砂 · 每日经营记录汇总</small></div><div className="av-record-stat"><span><ArrowUpRight size={13} />记录期经营支出</span><strong>{number(totals.expense)}</strong><small>星砂 · 契约、照护与建设</small></div><div className="av-record-stat"><span><Star size={13} />当前星砂储备</span><strong>{number(state.gold)}</strong><small>可用余额 · 声望 {state.reputation} · 已完成 {state.completed.length} 项</small></div></div>
    <section className="av-record-chart-panel" aria-labelledby="av-chart-title"><div className="av-chart-header"><h2 id="av-chart-title">经营轨迹</h2><div className="av-chart-controls"><div className="av-filters" aria-label="图表指标">{(['income', 'expense', 'reputation'] as const).map(value => <button id={`av-record-metric-${value}`} className="av-filter" type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>{metricNames[value]}</button>)}</div><label className="av-visually-hidden" htmlFor="av-record-range">图表时间范围</label><select id="av-record-range" className="av-select" value={range} onChange={event => setRange(Number(event.target.value))}><option value={7}>最近 7 天</option><option value={14}>最近 14 天</option></select></div></div><RecordsChart state={state} metric={metric} range={range} /></section>
    <section className="av-battle-archive" aria-labelledby="av-record-battle-title"><div className="av-log-head"><h2 id="av-record-battle-title"><Swords size={14} />战斗档案<small>{state.battles.length} 场</small></h2><button id="av-record-codex" type="button" className="av-btn av-btn-small" onClick={onCodex}><BookOpen size={13} />魔物图鉴<ChevronRight size={12} /></button></div>
      {state.battles.length ? <ol className="av-battle-list">{state.battles.slice(0, 4).map(battle => <li key={battle.id}><button id={`av-record-battle-${battle.id}`} type="button" className={`av-battle-row av-tone-${battle.outcome ?? 'draw'}`} onClick={() => onBattle(battle.id)}><span className="av-battle-date">第 {battle.startedAt.day} 日 · {hm(battle.startedAt.minutes)}</span><strong>{battle.missionTitle}</strong><span className="av-battle-outcome-tag">{outcomeNames[battle.outcome ?? 'draw']}</span><span className="av-battle-meta">{battle.rounds} 轮 · {number(battle.rewards?.gold ?? 0)} 星砂</span><ArrowUpRight size={12} /></button></li>)}</ol> : <div className="av-empty av-empty-battle"><Swords size={26} strokeWidth={1} /><p>还没有战斗记录。<br />战斗委托结束后，完整过程会被保存在这里。</p></div>}
      {state.battles.length > 4 && <p className="av-battle-more">仅展示最近 4 场战斗，完整战报可在派遣地图的任务详情中回看。</p>}
    </section>
    <section aria-labelledby="av-record-log-title"><div className="av-log-head"><h2 id="av-record-log-title"><History size={14} />行动手记<small>{logs.length} 条</small></h2><div className="av-log-filter"><label htmlFor="av-record-log-filter">记录类型</label><select id="av-record-log-filter" className="av-select" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setVisibleCount(8); }}><option value="all">全部记录</option>{(Object.keys(kindNames) as LogKind[]).map(value => <option key={value} value={value}>{kindNames[value]}记录</option>)}</select></div></div>
      {logs.length ? <ol className="av-log-list">{logs.slice(0, visibleCount).map(log => { const Icon = kindIcons[log.kind]; return <li className="av-log-item" key={log.id}><time className="av-log-time">{log.time}</time><span className="av-log-icon"><Icon size={12} strokeWidth={1.5} /></span><div className="av-log-copy"><strong>{log.text}</strong>{typeof log.delta === 'number' && log.delta !== 0 && <p className={log.delta > 0 ? 'av-log-positive' : ''}>{log.delta > 0 ? '+' : '−'}{number(Math.abs(log.delta))} 星砂</p>}</div><span className="av-log-category">{kindNames[log.kind]}</span></li>; })}</ol> : <div className="av-empty"><History size={28} strokeWidth={1} /><p>这一页还没有记录。<br />{kind === 'all' ? '派遣、照护或与成员交谈后，故事会留在这里。' : '切换到全部记录，看看事务所发生过的其他故事。'}</p></div>}
      {logs.length > visibleCount && <button id="av-record-load-more" className="av-btn av-log-more" type="button" onClick={() => setVisibleCount(count => count + 8)}>继续翻阅 · 还有 {logs.length - visibleCount} 条<ChevronRight size={13} /></button>}
    </section><p className="av-section-caption"><LockKeyhole size={11} />经营与故事记录仅保存在此浏览器，不会上传到任何服务。</p>
  </section>;
}
