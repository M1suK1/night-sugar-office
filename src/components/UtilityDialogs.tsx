import { useState } from 'react';
import { Sparkles, ArrowUpRight, Users, Plus, Building2, MessageCircle, Settings2, Download, RotateCcw, MousePointer2, Grip, Heart, BookOpen, Info, Bell, Check, Moon, ShieldCheck, Bot, Boxes, Trash2, KeyRound, PlugZap, AlertTriangle } from 'lucide-react';
import type { GameState, Girl } from '../types';
import { buildCost, capacity, statusLabels } from '../game';
import { monsters } from '../content/monsters';
import { loadLlmConfig, saveLlmConfig, testLlmConnection, type LlmConfig } from '../llm';
export function HireDialog({girl,state,onConfirm}:{girl:Girl;state:GameState;onConfirm:()=>void}) {
  const full=state.girls.length>=capacity(state),poor=state.gold<girl.cost;
  return <div className="standard-modal hire-confirm"><div className="modal-eyebrow"><Sparkles size={14}/>一份新的契约</div><div className="hire-confirm-person"><img src={girl.portrait} alt=""/><div><span>{girl.codename}</span><h2>欢迎，{girl.name}。</h2><p>{girl.skill} · {girl.element}</p></div></div><p className="muted">签署契约后，她将来到星屑会客厅，成为事务所的一员。你可以安排她出勤、照顾她，或开始属于你们的故事。</p><div className="confirmation-facts"><span>契约费用<b>{girl.cost.toLocaleString()} 星砂</b></span><span>剩余星砂<b>{(state.gold-girl.cost).toLocaleString()}</b></span><span>契约席位<b>{state.girls.length} / {capacity(state)}</b></span></div>{(full||poor)&&<div className="inline-warning"><Info size={16}/>{full?'契约席位已满，请先扩建晚安宿舍。':'星砂不足，完成更多委托后再来吧。'}</div>}<button id="hire-confirm" className="btn primary full" disabled={full||poor} onClick={onConfirm}>签署契约<ArrowUpRight size={17}/></button></div>;
}
export function BuildDialog({state,initialRoom,onConfirm}:{state:GameState;initialRoom:string;onConfirm:(id:string)=>void}) {
  const [roomId,setRoomId]=useState(initialRoom);const room=state.rooms.find(r=>r.id===roomId)!,cost=buildCost(room),max=room.level>=4,poor=state.gold<cost;
  return <div className="standard-modal"><div className="modal-eyebrow"><Building2 size={14}/>建造与扩建</div><h2>让归处，再宽敞一些。</h2><p className="muted">现有房间可扩建至四级。扩建宿舍增加契约席位，其他设施增加空间容量。</p><div className="build-room-options">{state.rooms.map(r=><button id={`build-room-${r.id}`} key={r.id} className={roomId===r.id?'selected':''} aria-pressed={roomId===r.id} onClick={()=>setRoomId(r.id)}><Building2 size={18}/><b>{r.name}</b><span>等级 {r.level}</span></button>)}</div><div className="confirmation-facts"><span>设施等级<b>{room.level} <ArrowUpRight size={12}/> {Math.min(4,room.level+1)}</b></span><span>{room.type==='dorm'?'契约容量':'空间容量'}<b>{room.capacity} <ArrowUpRight size={12}/> {room.capacity+(room.type==='dorm'?2:1)}</b></span><span>扩建费用<b>{cost.toLocaleString()} 星砂</b></span></div>{room.type==='observatory'&&<p className="small-note">观星台扩建仅升级空间，当前原型不影响委托数值。</p>}{(max||poor)&&<div className="inline-warning"><Info size={16}/>{max?'当前设施已达到最高等级。':'星砂不足，完成委托后再来扩建。'}</div>}<button id="build-confirm" className="btn primary full" disabled={max||poor} onClick={()=>onConfirm(roomId)}><Plus size={16}/>确认扩建</button></div>;
}
export function RoomDialog({state,id,onGirl,onTalk,onBuild}:{state:GameState;id:string;onGirl:(id:string)=>void;onTalk:(id:string)=>void;onBuild:()=>void}) {
  const room=state.rooms.find(r=>r.id===id)!,people=state.girls.filter(g=>g.roomId===id&&g.status!=='mission');
  return <div className="standard-modal"><div className="modal-eyebrow"><Building2 size={14}/>基地设施 / 等级 {room.level}</div><h2>{room.name}</h2><p className="muted">{room.description}</p><div className="room-facts"><span><Users size={16}/>当前 {people.length} 人</span><span><ShieldCheck size={16}/>{room.type==='dorm'?'契约席位':'空间容量'} {room.capacity}</span></div><h3 className="modal-subtitle">在这里的契约者</h3><div className="room-person-list">{people.map(g=><div key={g.id}><button id={`room-profile-${g.id}`} onClick={()=>onGirl(g.id)}><img src={g.portrait} alt=""/><span><b>{g.name}</b><small>{statusLabels[g.status]} · 血量 {g.hp} · 疲劳 {g.fatigue}</small></span><ArrowUpRight size={15}/></button><button id={`room-talk-${g.id}`} className="icon-btn" aria-label={`与${g.name}交谈`} onClick={()=>onTalk(g.id)}><MessageCircle size={17}/></button></div>)}</div>{!people.length&&<p className="empty-note">此刻没有契约者停留。窗边的灯仍然亮着。</p>}<button id="room-open-build" className="btn full" onClick={onBuild}><Plus size={16}/>扩建这个房间</button></div>;
}
export function HelpDialog(){return <div className="standard-modal help-modal"><div className="modal-eyebrow"><BookOpen size={14}/>给新任所长的夜班手册</div><h2>用温柔，经营一座城。</h2><p className="muted">欢迎来到夜糖事务所。这是一份可操作、自动本地保存的纯前端游戏原型。</p><div className="help-items">{[{Icon:Grip,title:'把心愿，交给合适的人',text:'拖动右侧待命契约者到地图任务点，或点击委托选择人选。疲劳会影响契合度；血量低于 30 或疲劳达到 80 时不能派遣。'},{Icon:Moon,title:'让时间，慢慢往前走',text:'点击「推进 30 分钟」结算派遣、治疗与休息。也可启用自动推进，每 12 秒前进 5 分钟。不会在离线时推进。'},{Icon:Heart,title:'她们不只是能力数值',text:'点击契约者查看档案，安排治疗、休息，或在基地交谈。对话每人每天前三次增加羁绊，所有历史都保存在本地。'},{Icon:MousePointer2,title:'为未来的叙事留出空间',text:'对话窗口包含角色状态、场景记忆和自由输入。目前是明确标记的本地剧情回复，没有模型调用或后端服务。'}].map(({Icon,title,text})=><div key={title}><Icon size={22}/><section><h3>{title}</h3><p>{text}</p></section></div>)}</div><p className="small-note">支持键盘 Tab 导航；Esc 关闭窗口。浏览器存档只属于当前设备，可在设置中导出。</p></div>;}

type SettingsTab = 'general' | 'llm' | 'pools';
export function SettingsDialog({state,reduced,onReduced,onExport,onReset,onPoolLimit,onDeleteMission,onDeleteCandidate,onDeleteMonster}:{state:GameState;reduced:boolean;onReduced:(v:boolean)=>void;onExport:()=>void;onReset:()=>void;onPoolLimit:(pool:'missions'|'monsters'|'candidates',value:number)=>void;onDeleteMission:(id:string)=>void;onDeleteCandidate:(id:string)=>void;onDeleteMonster:(id:string)=>void}) {
  const [tab, setTab] = useState<SettingsTab>('general');
  const [llm, setLlm] = useState<LlmConfig>(loadLlmConfig);
  const [llmNote, setLlmNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const openMissions = state.missions.filter(m => m.status !== 'done');
  const monsterPool = monsters.filter(m => !(state.removedMonsters ?? []).includes(m.id));
  const update = (patch: Partial<LlmConfig>) => { const next = { ...llm, ...patch }; setLlm(next); saveLlmConfig(next); };
  const probe = async () => { setBusy(true); setLlmNote(null); const result = await testLlmConnection(llm); setLlmNote({ ok: result.ok, text: result.message }); setBusy(false); };
  return <div className="standard-modal settings-modal"><div className="modal-eyebrow"><Settings2 size={14}/>事务所偏好</div><h2>按自己的节奏，守夜。</h2><div className="settings-tabs" role="tablist" aria-label="设置分类">{[{ id: 'general', label: '一般', Icon: Settings2 }, { id: 'llm', label: '故事引擎', Icon: Bot }, { id: 'pools', label: '内容池', Icon: Boxes }].map(({ id, label, Icon }) => <button id={`settings-tab-${id}`} key={id} role="tab" aria-selected={tab === id} className={`settings-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id as SettingsTab)}><Icon size={14}/>{label}</button>)}</div>
    {tab === 'general' && <>
      <div className="settings-row"><div><b>减少动态效果</b><p>关闭漂浮与入场动画，保留必要的状态反馈。</p></div><button id="settings-reduced-motion" role="switch" aria-checked={reduced} aria-label="减少动态效果" className={`toggle ${reduced?'on':''}`} onClick={()=>onReduced(!reduced)}><i/></button></div>
      <div className="settings-row"><div><b>本地自动存档</b><p>每次操作后保存于当前浏览器，不上传任何数据。</p></div><span className="settings-enabled"><Check size={14}/>已启用</span></div>
      <div className="settings-data-actions"><button id="settings-export-save" className="btn" onClick={onExport}><Download size={16}/>导出当前存档</button><button id="settings-reset-save" className="btn danger" onClick={onReset}><RotateCcw size={15}/>重置演示进度</button></div>
      <div className="prototype-note"><Info size={17}/><p><b>纯前端 · 本地剧情演示</b><br/>不包含后端、登录或支付。故事引擎的密钥只保存在当前浏览器，不会写入游戏存档。</p></div>
    </>}
    {tab === 'llm' && <div className="llm-settings">
      <div className="llm-intro"><Bot size={20}/><div><b>把夜晚交给一位叙事者</b><p>连接任意 OpenAI 兼容接口。模型只负责提案，数值、结算与存档仍由本地规则决定。</p></div></div>
      <label className="llm-field"><span>接口地址</span><input id="settings-llm-endpoint" value={llm.endpoint} onChange={e => update({ endpoint: e.target.value })} spellCheck={false} placeholder="https://api.openai.com/v1"/></label>
      <label className="llm-field"><span>API 密钥</span><input id="settings-llm-key" type="password" value={llm.apiKey} onChange={e => update({ apiKey: e.target.value })} spellCheck={false} autoComplete="off" placeholder="sk-..."/></label>
      <label className="llm-field"><span>模型名称</span><input id="settings-llm-model" value={llm.model} onChange={e => update({ model: e.target.value })} spellCheck={false} placeholder="gpt-4o-mini"/></label>
      <div className="llm-actions"><button id="settings-llm-test" className="btn" disabled={busy} onClick={probe}><PlugZap size={15}/>{busy ? '正在连接' : '测试连接'}</button><span className="llm-key-note"><KeyRound size={13}/>密钥仅存于 localStorage</span></div>
      {llmNote && <div id="settings-llm-result" className={`llm-result ${llmNote.ok ? 'ok' : 'error'}`} role="status">{llmNote.ok ? <Check size={14}/> : <AlertTriangle size={14}/>}{llmNote.text}</div>}
      <div className="llm-warning"><AlertTriangle size={15}/><p>浏览器直连会暴露密钥给页面脚本。正式版本应改为服务端代理；此处仅用于本地原型验证。</p></div>
    </div>}
    {tab === 'pools' && <div className="pool-settings">
      <p className="pool-intro">内容池满后，故事引擎会停止补充对应内容。你可以随时手动移除，为新的相遇腾出位置。</p>
      {([{ id: 'missions', label: '事件池', count: openMissions.length, desc: '地图上尚未结束的委托与事件。' }, { id: 'monsters', label: '魔物池', count: monsterPool.length, desc: '可被事件引用的魔物模板。' }, { id: 'candidates', label: '市场池', count: state.candidates.length, desc: '市场中尚未签约的候选契约者。' }] as const).map(pool => <section className="pool-block" key={pool.id}>
        <header><div><b>{pool.label}</b><span>{pool.count} / {state.poolLimits[pool.id]}</span></div><label><span>上限</span><input id={`settings-limit-${pool.id}`} type="number" min={1} max={40} value={state.poolLimits[pool.id]} onChange={e => onPoolLimit(pool.id, Number(e.target.value))}/></label></header>
        <p>{pool.desc}</p>
        <div className="pool-bar"><i style={{ width: `${Math.min(100, pool.count / state.poolLimits[pool.id] * 100)}%` }}/></div>
        {pool.id === 'missions' && <ul>{openMissions.slice(0, 8).map(m => <li key={m.id}><span>{m.title}</span><small>{m.work === 'combat' ? '战斗' : '调查'} · {m.status === 'active' ? '进行中' : '待处理'}</small><button id={`settings-delete-mission-${m.id}`} disabled={m.status === 'active'} aria-label={`移除事件 ${m.title}`} onClick={() => onDeleteMission(m.id)}><Trash2 size={14}/></button></li>)}</ul>}
        {pool.id === 'monsters' && <ul>{monsterPool.map(m => <li key={m.id}><span>{m.name}</span><small>{m.rank} · {m.element}</small><button id={`settings-delete-monster-${m.id}`} aria-label={`移除魔物 ${m.name}`} onClick={() => onDeleteMonster(m.id)}><Trash2 size={14}/></button></li>)}</ul>}
        {pool.id === 'candidates' && <ul>{state.candidates.map(g => <li key={g.id}><span>{g.name}</span><small>Lv.{g.level} · {g.element}</small><button id={`settings-delete-candidate-${g.id}`} aria-label={`移除候选者 ${g.name}`} onClick={() => onDeleteCandidate(g.id)}><Trash2 size={14}/></button></li>)}</ul>}
      </section>)}
    </div>}
  </div>;
}
export function NotificationsDialog({state}:{state:GameState}) {return <div className="standard-modal"><div className="modal-eyebrow"><Bell size={14}/>事务所来信</div><h2>那些值得被记住的小事。</h2><p className="muted">最近的经营动态与故事片刻。</p><div className="notification-list">{state.logs.slice(0,15).map(l=><article key={l.id}><span><Sparkles size={14}/></span><div><small>{l.time}</small><p>{l.text}</p>{l.delta!==undefined&&<em>{l.delta>0?'+':''}{l.delta.toLocaleString()} 星砂</em>}</div></article>)}</div></div>;}
export function ResetDialog({onConfirm}:{onConfirm:()=>void}) {return <div className="standard-modal"><div className="modal-eyebrow"><RotateCcw size={14}/>重新开始</div><h2>要重新开始这个夜晚吗？</h2><p className="muted">当前的派遣、招募、扩建与对话记录将被清除，恢复到第十四日 21:40 的演示状态。此操作无法撤销，建议先导出存档。</p><button id="reset-confirm" className="btn danger full" onClick={onConfirm}>确认重置演示进度</button></div>;}
