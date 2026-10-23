import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Clock3, FastForward, Heart, Pause, Play, Radio, X, Info, Moon, ChevronRight } from 'lucide-react';
import type { GameAction, GameState } from './types';
import { act, loadState, SAVE_KEY } from './game';
import { Navigation, PageHeading, Topbar } from './components/Shell';
import type { Page } from './components/Shell';
import { DispatchMap } from './components/DispatchMap';
import { Roster } from './components/Roster';
import { Dialog } from './components/Dialog';
import { MissionDialog, AssignmentPicker } from './components/MissionDialog';
import { CharacterDialog } from './components/CharacterDialog';
import { Conversation } from './components/Conversation';
import { BuildDialog, HelpDialog, HireDialog, NotificationsDialog, ResetDialog, RoomDialog, SettingsDialog } from './components/UtilityDialogs';
import { BaseView, MarketView, RecordsView } from './views/AuxViews';
import './styles.css';

type Modal = {type:'girl'|'talk'|'assign'|'hire'|'room'|'build';id:string} | {type:'mission';id:string;girlId?:string} | {type:'settings'|'help'|'notifications'|'reset'};
function readSave(){try{return loadState(localStorage.getItem(SAVE_KEY));}catch{return loadState(null);}}
function readReduced(){try{return localStorage.getItem('night-sugar:motion')==='reduced'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{return false;}}
export default function App() {
  const [state,setState]=useState<GameState>(readSave),[page,setPage]=useState<Page>('dispatch'),[modal,setModal]=useState<Modal|null>(null);
  const [toast,setToast]=useState<{message:string;ok:boolean;id:number}|null>(null),[auto,setAuto]=useState(false),[saved,setSaved]=useState(true),[reduced,setReduced]=useState(readReduced);
  useEffect(()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));setSaved(true);}catch{setSaved(false);}},[state]);
  useEffect(()=>{document.documentElement.classList.toggle('reduced-motion',reduced);try{localStorage.setItem('night-sugar:motion',reduced?'reduced':'full');}catch{/* Preferences are optional when storage is unavailable. */}},[reduced]);
  useEffect(()=>{if(!auto)return;const timer=window.setInterval(()=>{if(!document.hidden)setState(s=>act(s,{type:'advance',minutes:5}).state);},12000);return()=>clearInterval(timer);},[auto]);
  useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(null),5500);return()=>clearTimeout(timer);},[toast]);
  const notify=(message:string,ok=true)=>setToast({message,ok,id:Date.now()});
  const perform=(action:GameAction,quiet=false)=>{const result=act(state,action);if(result.ok)setState(result.state);if(!quiet||!result.ok)notify(result.message,result.ok);return result.ok;};
  const navigate=(p:Page)=>{setPage(p);setModal(null);window.scrollTo({top:0,behavior:'instant'});};
  const girl=(id:string)=>setModal({type:'girl',id});
  const talk=(id:string)=>{const g=state.girls.find(g=>g.id===id);if(g?.status==='mission'){notify(`${g.name}正在出勤，等她回到基地再聊聊吧。`,false);return;}setModal({type:'talk',id});};
  const exportSave=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`夜糖事务所-第${state.day}日存档.json`;a.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);notify('当前存档已导出到下载目录。');};
  const selectedGirl=modal&&'id' in modal?[...state.girls,...state.candidates].find(g=>g.id===modal.id):undefined;
  const selectedMission=modal?.type==='mission'?state.missions.find(m=>m.id===modal.id):undefined;
  const modalTitle=modal?.type==='talk'?'灯下私语':modal?.type==='girl'?'契约者详细档案':modal?.type==='mission'?'委托详情与派遣':modal?.type==='settings'?'游戏设置':modal?.type==='help'?'夜班操作手册':modal?.type==='notifications'?'事务所通知':modal?.type==='reset'?'重置进度确认':modal?.type==='hire'?'缔结契约':modal?.type==='build'?'建造与扩建':modal?.type==='room'?'基地房间详情':'安排派遣';
  return <div className="app-shell"><a id="skip-main-content" className="skip-link" href="#main-content">跳转到主要内容</a><Navigation page={page} onPage={navigate} onHelp={()=>setModal({type:'help'})} onSettings={()=>setModal({type:'settings'})}/><Topbar state={state} saved={saved} onNotifications={()=>setModal({type:'notifications'})}/><main id="main-content" className={`app-main page-${page}`}>
    {page==='dispatch'?<><PageHeading page={page}><div className="shift-badge"><span className="signal-dot"/><span>夜班进行中</span><small>第 014 号值班席</small></div></PageHeading><div className="dispatch-layout"><DispatchMap state={state} onMission={id=>setModal({type:'mission',id})} onDropGirl={(girlId,id)=>setModal({type:'mission',id,girlId})}/><Roster state={state} onGirl={girl} onMarket={()=>navigate('market')}/></div><div className="night-notes"><button id="story-open-conversation" className="story-note" onClick={()=>talk('yue')}><span className="note-icon"><Heart size={21}/></span><div><span className="eyebrow">留给你的话</span><h3>「任务结束后，要一起看星星吗？」</h3><p>{state.girls.find(g=>g.id==='yue')?.status==='mission'?'这句话，留给她归来后的夜晚。':'月见桃在基地等你，想听听今晚的故事。'}</p></div><ArrowUpRight size={20}/></button><button id="open-night-brief" className="brief-note" onClick={()=>setModal({type:'mission',id:'station'})}><span className="note-icon"><Radio size={21}/></span><div><span className="eyebrow">夜间速报 · 城市心跳</span><h3>末班列车，即将离站。</h3><p>{state.missions.find(m=>m.id==='station')?.status==='open'?'月台出现异常信号，请优先处理紧急委托。':'最新委托进展已同步到感应地图。'}</p></div><ArrowRight size={18}/></button></div></>:page==='base'?<BaseView state={state} onRoom={id=>setModal({type:'room',id})} onBuild={()=>setModal({type:'build',id:'dorm'})} onGirl={girl} onTalk={talk}/>:page==='market'?<MarketView state={state} onGirl={girl} onHire={id=>setModal({type:'hire',id})}/>:<RecordsView state={state}/>}
    <footer className="game-footer"><span><Moon size={12}/>愿每个心愿，都有回声。<i/>夜糖事务所</span><button id="footer-prototype-info" onClick={()=>setModal({type:'help'})}>纯前端原型<span>本地剧情演示</span><ChevronRight size={11}/></button></footer>
  </main><div className="time-control-bar"><div><Clock3 size={15}/><span>游戏时间</span><small>{auto?'每 12 秒推进 5 分钟':'已暂停 · 由你掌握夜晚的节奏'}</small></div><div><button id="toggle-auto-time" className={`auto-time-btn ${auto?'active':''}`} aria-pressed={auto} onClick={()=>setAuto(x=>!x)}>{auto?<Pause size={13}/>:<Play size={13}/>}<span>{auto?'暂停自动':'自动推进'}</span></button><button id="advance-time-30" className="advance-btn" onClick={()=>perform({type:'advance',minutes:30})}>推进 30 分钟<FastForward size={15}/></button></div></div>
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">{toast&&<div className={`game-toast ${toast.ok?'':'warning'}`} key={toast.id}>{toast.ok?<Check size={18}/>:<Info size={18}/>}<p>{toast.message}</p><button id="dismiss-toast" onClick={()=>setToast(null)} aria-label="关闭提示"><X size={15}/></button></div>}</div>
    {modal&&<Dialog label={modalTitle} onClose={()=>setModal(null)} wide={modal.type==='girl'||modal.type==='talk'}>
      {modal.type==='girl'&&selectedGirl&&<CharacterDialog key={`girl-${selectedGirl.id}`} girl={selectedGirl} state={state} onCare={mode=>perform({type:'care',girlId:selectedGirl.id,mode})} onTalk={()=>talk(selectedGirl.id)} onAssign={()=>setModal({type:'assign',id:selectedGirl.id})} onHire={()=>setModal({type:'hire',id:selectedGirl.id})}/>}
      {modal.type==='mission'&&selectedMission&&<MissionDialog key={`${modal.id}-${modal.girlId??''}`} state={state} mission={selectedMission} initialGirlId={modal.girlId} onGirl={girl} onDispatch={(girlId,missionId)=>{if(perform({type:'dispatch',girlId,missionId}))setModal(null);}}/>}
      {modal.type==='talk'&&selectedGirl&&<Conversation key={`talk-${selectedGirl.id}`} girl={selectedGirl} state={state} onSend={text=>perform({type:'talk',girlId:selectedGirl.id,text},true)}/>}
      {modal.type==='assign'&&<AssignmentPicker state={state} girlId={modal.id} onSelect={id=>setModal({type:'mission',id,girlId:modal.id})}/>}
      {modal.type==='hire'&&selectedGirl&&<HireDialog girl={selectedGirl} state={state} onConfirm={()=>{if(perform({type:'hire',girlId:selectedGirl.id}))setModal(null);}}/>}
      {modal.type==='build'&&<BuildDialog state={state} initialRoom={modal.id} onConfirm={roomId=>{if(perform({type:'build',roomId}))setModal(null);}}/>}
      {modal.type==='room'&&<RoomDialog state={state} id={modal.id} onGirl={girl} onTalk={talk} onBuild={()=>setModal({type:'build',id:modal.id})}/>}
      {modal.type==='settings'&&<SettingsDialog reduced={reduced} onReduced={setReduced} onExport={exportSave} onReset={()=>setModal({type:'reset'})}/>}
      {modal.type==='help'&&<HelpDialog/>}{modal.type==='notifications'&&<NotificationsDialog state={state}/>}{modal.type==='reset'&&<ResetDialog onConfirm={()=>{perform({type:'reset'});setAuto(false);setModal(null);}}/>}
    </Dialog>}
  </div>;
}
