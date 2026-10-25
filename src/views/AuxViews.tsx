import { useId, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, BedDouble, BookOpen, Building2, Cat, Check, ChevronRight, Coins, Compass, Crosshair, Flower2, Heart, HeartPulse, History, House, Info, LockKeyhole, MessageCircle, Phone, Plus, Sparkles, Star, Swords, Telescope, Users } from 'lucide-react';
import type { FactionId, GameState, Girl, Room } from '../types';
import { factionInfo } from '../content/items';
import { inWithdrawal } from '../game';
import './aux-views.css';

type BaseViewProps = { state: GameState; onRoom: (id: string) => void; onBuild: () => void; onGirl: (id: string) => void; onTalk: (id: string) => void; onStartExpedition: (ids: string[]) => void; onRecallExpedition: (id: string) => void; onDecide: (id: string, decision: 'accept' | 'defer' | 'reject') => void; onAcceptTask: (faction: FactionId) => void };
type RecordsViewProps = { state: GameState; onBattle: (id: string) => void; onCodex: () => void };
type Metric = 'income' | 'expense' | 'reputation';
type LogKind = GameState['logs'][number]['kind'];

const number = (value: number) => value.toLocaleString('zh-CN');
const hm = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const statusText: Record<Girl['status'], string> = { idle: '闲暇中', mission: '任务执行中', healing: '正在治疗', resting: '正在休息', retired: '已退役', expedition: '星象台远行' };
const roomIcons = { lounge: Cat, clinic: HeartPulse, dorm: BedDouble, observatory: Telescope };
const roomCaptions = { lounge: '茶香、软糖与不必保密的心事。', clinic: '把伤口留在这里，把勇气带回去。', dorm: '今晚的星光，也需要好好休息。', observatory: '城市的每一次心跳，都有回声。' };
const metricNames: Record<Metric, string> = { income: '委托收入', expense: '经营支出', reputation: '城市声望' };
const kindNames: Record<LogKind, string> = { dispatch: '派遣', finance: '收支', story: '故事', care: '照护', base: '基地', battle: '战斗', relationship: '关系', memorial: '悼念', council: '议事', expedition: '远行', clinic: '诊所' };
const kindIcons = { dispatch: Crosshair, finance: Coins, story: MessageCircle, care: HeartPulse, base: House, battle: Swords, relationship: Heart, memorial: Flower2, council: Users, expedition: Telescope, clinic: HeartPulse };
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

export function BaseView({ state, onRoom, onBuild, onGirl, onTalk, onStartExpedition, onRecallExpedition, onDecide, onAcceptTask }: BaseViewProps) {
  const [selectedId, setSelectedId] = useState(state.rooms[0]?.id ?? '');
  const [expeditionSquad, setExpeditionSquad] = useState<string[]>([]);
  const room = state.rooms.find(item => item.id === selectedId) ?? state.rooms[0];
  const present = state.girls.filter(girl => !girl.dead && !girl.retired && girl.status !== 'mission' && girl.status !== 'expedition');
  const active = state.girls.filter(girl => !girl.retired);
  const away = active.filter(girl => girl.status === 'mission').length;
  const occupants = room ? present.filter(girl => girl.roomId === room.id) : [];
  const capacity = capacityOf(state);
  const Icon = room ? roomIcons[room.type] : House;
  const expedition = state.expeditions[0];
  const decision = state.opinions.find(opinion => opinion.status === 'pending');
  const assistant = state.girls.find(girl => girl.id === state.assistantId);
  const eligible = state.girls.filter(girl => girl.status === 'idle' && !girl.retired && !inWithdrawal(girl) && girl.id !== state.assistantId && girl.hp >= 30 && girl.fatigue < 80);
  const expeditionMembers = expedition ? expedition.memberIds.map(id => state.girls.find(girl => girl.id === id)).filter((girl): girl is Girl => Boolean(girl)) : [];
  const decisionAuthor = decision ? state.girls.find(girl => girl.id === decision.authorId) : undefined;
  const toggleExpedition = (id: string) => setExpeditionSquad(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 2 ? current : [...current, id]);
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
    <div className="av-ops">
      <article className="av-op-card av-op-expedition">
        <div className="av-op-head"><span className="av-op-icon"><Telescope size={18} strokeWidth={1.4} /></span><div><small>星象台 · 远行观测</small><h2>把耳朵借给城市之外</h2></div><span className={`av-op-status ${expedition ? 'busy' : ''}`}>{expedition ? '观测中' : '可出发'}</span></div>
        {expedition ? <div className="av-exp-active">
          <div className="av-exp-members">{expeditionMembers.map(girl => <button key={girl.id} type="button" className="av-exp-member" onClick={() => onGirl(girl.id)}><img src={girl.portrait} alt="" loading="lazy" /><span>{girl.name}<small>{statusText[girl.status]} · 疲劳 {girl.fatigue}</small></span></button>)}</div>
          <p><Compass size={13} />已观测 {expedition.cyclesDone} 轮。下一轮将在 60 分钟内回报，远行会持续累积疲劳。</p>
          <button id="av-expedition-recall" type="button" className="av-btn av-btn-small" onClick={() => onRecallExpedition(expedition.id)}>召回队伍 · 未结算的一轮作废</button>
        </div> : <>
          <p className="av-op-copy">派 1–2 名闲暇成员进入星象台，每小时带回 60–180 星砂与新的见闻。远行会累积疲劳，也可能显露特性。</p>
          <div className="av-exp-roster" role="group" aria-label="选择远行成员">
            {eligible.length ? eligible.map(girl => <button key={girl.id} id={`av-expedition-pick-${girl.id}`} type="button" className="av-exp-pick" aria-pressed={expeditionSquad.includes(girl.id)} onClick={() => toggleExpedition(girl.id)}><img src={girl.portrait} alt="" loading="lazy" /><span>{girl.name}<small>Lv.{girl.level} · 疲劳 {girl.fatigue}</small></span>{expeditionSquad.includes(girl.id) && <Check size={13} />}</button>) : <small className="av-op-empty">没有可出发的成员。让她们先休息，或结束当前派遣。</small>}
          </div>
          <button id="av-expedition-start" type="button" className="av-btn av-btn-primary av-btn-small" disabled={!expeditionSquad.length} onClick={() => { onStartExpedition(expeditionSquad); setExpeditionSquad([]); }}><Compass size={14} />组建远行队 · 已选 {expeditionSquad.length} / 2</button>
        </>}
      </article>
      <article className="av-op-card av-op-council">
        <div className="av-op-head"><span className="av-op-icon"><Users size={18} strokeWidth={1.4} /></span><div><small>会客厅 · 议事</small><h2>有些决定，需要一起做</h2></div>{assistant && <button type="button" className="av-op-status assistant" onClick={() => onGirl(assistant.id)}>助理 · {assistant.name}</button>}</div>
        {decision ? <div className="av-opinion">
          <span className="av-opinion-meta">{decisionAuthor?.name ?? '事务所'} · {decision.topic} · 第 {decision.day} 日</span>
          <h3>{decision.title}</h3>
          <p>{decision.text}</p>
          <div className="av-opinion-request"><MessageCircle size={13} /><span>{decision.request}</span></div>
          {decision.assistantNote && <small className="av-opinion-note"><Sparkles size={11} />{decision.assistantNote}</small>}
          <div className="av-opinion-actions">{decision.options.map(option => <button key={option.id} id={`av-council-${option.id}`} type="button" className={`av-btn av-btn-small ${option.id === 'accept' ? 'av-btn-primary' : ''}`} onClick={() => onDecide(decision.id, option.id)} title={option.effect}>{option.id === 'accept' ? <Check size={13} /> : option.id === 'reject' ? <AlertTriangle size={13} /> : <Compass size={13} />}{option.label}</button>)}</div>
        </div> : <div className="av-op-quiet"><Phone size={17} strokeWidth={1.2} /><p>{assistant ? `${assistant.name} 正在值班。她会在每日议事时带回一条来自城市或同伴的请求。` : '会客厅暂时安静。任命一位值班助理后，她会替你留意城市里的请求。'}</p></div>}
      </article>
    </div>
    <section className="av-envoys" aria-labelledby="av-envoy-title"><div className="av-envoy-head"><div><p className="av-eyebrow"><Sparkles size={12} />会客厅 · 每日来使</p><h2 id="av-envoy-title">三方都想知道，事务所今晚站在哪一边</h2><p>每个势力每天派来一位代表。接受任务会改变声望，也会改变城市安定度。</p></div><span className="av-tag">每日各 1 次</span></div><div className="av-envoy-grid">{(Object.keys(factionInfo) as FactionId[]).map(id => { const info = factionInfo[id]; const done = state.factions[id].envoyDay >= state.day; return <article key={id} className="av-envoy-card" style={{ '--faction': info.color } as React.CSSProperties}><span className="av-envoy-seal">{info.short}</span><div><small>{info.title}</small><h3>{info.envoy}</h3><p>「{info.motto}」</p><div className="av-envoy-stats"><span>声望 <b>{state.factions[id].standing}</b></span><span>任务 <b>{done ? '已完成' : '待接取'}</b></span></div><button id={`av-envoy-accept-${id}`} type="button" className="av-btn av-btn-small" disabled={done} onClick={() => onAcceptTask(id)}>{done ? <><Check size={12} />今日已领取</> : <>接受委托<ArrowUpRight size={12} /></>}</button></div></article>; })}</div></section>
    <p className="av-section-caption"><Sparkles size={12} />{present.length} 名成员在基地 · {away} 名成员在外执行委托或远行。交谈将保留为她们各自的故事记忆。</p>
  </section>;
}

export { MarketView } from './MarketView';

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
