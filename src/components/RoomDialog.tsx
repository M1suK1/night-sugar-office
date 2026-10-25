import { useState } from 'react';
import { ArrowUpRight, Building2, Check, Compass, Cross, MessageCircle, Moon, Plus, ShieldCheck, Sparkles, Telescope, Users } from 'lucide-react';
import type { GameState } from '../types';
import { buildCost, capacity, statusLabels } from '../game';
import { GirlPortrait } from './GirlPortrait';

type Props = {
  state: GameState; id: string; onGirl: (id: string) => void; onTalk: (id: string) => void; onBuild: () => void;
  onDecide: (id: string, decision: 'accept' | 'defer' | 'reject') => void;
  onStartExpedition: (ids: string[]) => void; onRecall: (id: string) => void;
  onClinic: (girlId: string, mode: 'heal' | 'rest') => void;
};

export function RoomDialog({ state, id, onGirl, onTalk, onBuild, onDecide, onStartExpedition, onRecall, onClinic }: Props) {
  const room = state.rooms.find(r => r.id === id)!;
  const people = state.girls.filter(g => g.roomId === id && g.status !== 'mission' && !g.retired);
  const tabs = room.type === 'lounge' ? ['members', 'council'] : room.type === 'observatory' ? ['members', 'expedition'] : room.type === 'clinic' ? ['members', 'clinic'] : ['members', 'dorm'];
  const [tab, setTab] = useState(tabs[0]);
  const [picked, setPicked] = useState<string[]>([]);
  const decision = state.opinions.find(o => o.status === 'pending');
  const expedition = state.expeditions[0];
  const eligible = state.girls.filter(g => g.status === 'idle' && !g.retired && g.hp >= 30 && g.fatigue < 80);
  const labels: Record<string, string> = { members: '在这里', council: '议事', expedition: '远行', clinic: '诊疗', dorm: '休息' };
  return <div className="standard-modal room-dialog">
    <div className="modal-eyebrow"><Building2 size={14} />基地设施 / 等级 {room.level}</div>
    <h2>{room.name}</h2><p className="muted">{room.description}</p>
    <div className="room-facts"><span><Users size={15} />当前 {people.length} 人</span><span><ShieldCheck size={15} />{room.type === 'dorm' ? '契约席位' : '空间容量'} {room.capacity}</span><span><Sparkles size={15} />{room.type === 'lounge' ? '议事与来使' : room.type === 'clinic' ? '治疗与疗养' : room.type === 'dorm' ? '休息与恢复' : '远行观测'}</span></div>
    <div className="room-tabs" role="tablist" aria-label="房间功能">{tabs.map(value => <button key={value} id={`room-tab-${value}`} type="button" role="tab" aria-selected={tab === value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{labels[value]}</button>)}</div>

    {tab === 'members' && <>{people.length ? <div className="room-person-list">{people.map(g => <div key={g.id}><button id={`room-profile-${g.id}`} onClick={() => onGirl(g.id)}><GirlPortrait girl={g} variant="avatar" /><span><b>{g.name}</b><small>{statusLabels[g.status]} · 血量 {g.hp} · 疲劳 {g.fatigue}</small></span><ArrowUpRight size={15} /></button><button id={`room-talk-${g.id}`} className="icon-btn" aria-label={`与${g.name}交谈`} onClick={() => onTalk(g.id)}><MessageCircle size={17} /></button></div>)}</div> : <p className="empty-note">此刻没有契约者停留。窗边的灯仍然亮着。</p>}<button id="room-open-build" className="btn full" onClick={onBuild}><Plus size={16} />扩建这个房间 · {buildCost(room).toLocaleString()} 星砂</button></>}

    {tab === 'council' && <div className="room-function">{decision ? <><span className="av-tag">{decision.topic} · 第 {decision.day} 日</span><h3>{decision.title}</h3><p>{decision.text}</p><p className="small-note">{decision.request}</p><div className="room-function-actions">{decision.options.map(option => <button key={option.id} id={`room-council-${option.id}`} type="button" className={`btn ${option.id === 'accept' ? 'primary' : ''}`} onClick={() => onDecide(decision.id, option.id)}>{option.id === 'accept' ? <Check size={13} /> : null}{option.label}</button>)}</div></> : <p className="empty-note">今天的议事已经结束。任命值班助理后，她会在每日开始时带来新议题。</p>}</div>}

    {tab === 'expedition' && <div className="room-function">{expedition ? <><h3>观测进行中</h3><p>已观测 {expedition.cyclesDone} 轮，每 60 分钟结算一次。成员会持续累积疲劳。</p><button id="room-expedition-recall" type="button" className="btn" onClick={() => onRecall(expedition.id)}>召回队伍</button></> : <><h3>派一支小队，去城市之外听听</h3><p>1–2 名成员，每小时带回星砂与见闻。</p><div className="room-pick-list">{eligible.map(g => <button key={g.id} id={`room-expedition-${g.id}`} type="button" className={picked.includes(g.id) ? 'picked' : ''} aria-pressed={picked.includes(g.id)} onClick={() => setPicked(current => current.includes(g.id) ? current.filter(v => v !== g.id) : current.length >= 2 ? current : [...current, g.id])}><GirlPortrait girl={g} variant="avatar" /><span>{g.name}<small>Lv.{g.level} · 疲劳 {g.fatigue}</small></span>{picked.includes(g.id) && <Check size={13} />}</button>)}</div><button id="room-expedition-start" type="button" className="btn primary full" disabled={!picked.length} onClick={() => { onStartExpedition(picked); setPicked([]); }}><Telescope size={14} />出发 · 已选 {picked.length} / 2</button></>}</div>}

    {tab === 'clinic' && <div className="room-function"><h3>今夜，先把伤口放下</h3><p>快速治疗 240 星砂；深度疗养 360 星砂，清空疲劳。</p><div className="room-clinic-list">{people.map(g => <div key={g.id}><span><b>{g.name}</b><small>血量 {g.hp} · 疲劳 {g.fatigue}</small></span><button id={`room-heal-${g.id}`} type="button" className="av-btn av-btn-small" disabled={state.gold < 240} onClick={() => onClinic(g.id, 'heal')}><Cross size={12} />治疗</button><button id={`room-rest-${g.id}`} type="button" className="av-btn av-btn-small" disabled={state.gold < 360} onClick={() => onClinic(g.id, 'rest')}><Moon size={12} />疗养</button></div>)}</div></div>}

    {tab === 'dorm' && <div className="room-function"><h3>晚安，明天见</h3><p>宿舍休息会降低侵蚀度。满员 {capacity(state)} 人，扩建可增加 2 个席位。</p><div className="room-clinic-list">{people.map(g => <div key={g.id}><span><b>{g.name}</b><small>侵蚀 {g.corruption} · 疲劳 {g.fatigue}</small></span><button id={`room-dorm-rest-${g.id}`} type="button" className="av-btn av-btn-small" onClick={() => onClinic(g.id, 'rest')}><Moon size={12} />休息</button></div>)}</div></div>}

    <p className="small-note"><Compass size={11} />房间功能会直接写入本地状态；断药成员无法参加远行。</p>
  </div>;
}
