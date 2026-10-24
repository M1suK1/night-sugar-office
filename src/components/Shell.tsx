import { Map, House, Gem, ScrollText, Settings2, CircleHelp, Moon, CloudFog, Sparkles, ShieldCheck, Bell, ChevronRight, Cat, Star, BookOpen, Flower2 } from 'lucide-react';
import type { GameState } from '../types';
import { clock } from '../game';
export type Page = 'dispatch' | 'base' | 'market' | 'records';
const pages = [{id:'dispatch',label:'派遣',Icon:Map},{id:'base',label:'基地',Icon:House},{id:'market',label:'市场',Icon:Gem},{id:'records',label:'记录',Icon:ScrollText}] as const;
export function Navigation({page,onPage,onHelp,onSettings,onCodex,onMemorial,memorialCount}:{page:Page;onPage:(p:Page)=>void;onHelp:()=>void;onSettings:()=>void;onCodex:()=>void;onMemorial:()=>void;memorialCount:number}) {
  return <aside className="side-rail"><a id="brand-home" href="#dispatch" className="brand-mark" aria-label="夜糖事务所，返回派遣" onClick={e=>{e.preventDefault();onPage('dispatch');}}><Cat size={29}/><Star className="brand-star" size={10}/></a><div className="rail-rule"/><nav aria-label="游戏主导航">{pages.map(({id,label,Icon})=><button id={`nav-${id}`} key={id} aria-current={page===id?'page':undefined} className={`nav-item ${page===id?'active':''}`} onClick={()=>onPage(id)}><Icon size={21} strokeWidth={1.65}/><span>{label}</span>{page===id&&<i/>}</button>)}</nav><div className="rail-bottom"><button id="open-codex" className="rail-utility" onClick={onCodex} aria-label="打开魔物图鉴" title="魔物图鉴"><BookOpen size={20}/></button><button id="open-memorial" className="rail-utility memorial-utility" onClick={onMemorial} aria-label="打开星光纪念墙" title="星光纪念墙"><Flower2 size={20}/>{memorialCount>0&&<em className="rail-count">{memorialCount}</em>}</button><button id="open-help" className="rail-utility" onClick={onHelp} aria-label="操作指南"><CircleHelp size={21}/></button><button id="open-settings" className="rail-utility" onClick={onSettings} aria-label="游戏设置"><Settings2 size={21}/></button><span className="rail-edition">夜班制</span></div></aside>;
}
export function Topbar({state,onNotifications,saved}:{state:GameState;onNotifications:()=>void;saved:boolean}) {
  return <header className="topbar"><div className="wordmark"><strong>夜糖事务所<span className="logo-dot">.</span></strong><span>NIGHT SUGAR OFFICE</span></div><div className="scene-time"><Moon size={25} strokeWidth={1.4}/><div><span className="eyebrow">第 {state.day} 日 · 夜间</span><strong>{clock(state.minutes)}</strong></div><div className="weather"><CloudFog size={16}/><span>樱雾市<br/><b>薄雾 · 18°C</b></span></div></div><div className="top-resources"><div className="resource"><Sparkles size={18}/><span><small>星砂储备</small><b>{state.gold.toLocaleString('zh-CN')}</b></span></div><div className="resource stability"><ShieldCheck size={18}/><span><small>城市安定度</small><b>{state.reputation}<em>/ 100</em></b></span></div><span className={`save-indicator ${!saved?'error':''}`} title={saved?'进度保存在当前浏览器':'浏览器未能保存，请导出存档'}><i/>{saved?'已存档':'未保存'}</span><button id="open-notifications" className="icon-btn notification-btn" onClick={onNotifications} aria-label="打开事务所通知"><Bell size={19}/><i/></button></div></header>;
}
const pageTitles:Record<Page,{kicker:string;title:string;subtitle:string}> = {
  dispatch:{kicker:'城市派遣',title:'星光，不会准时下班。',subtitle:'城市沉睡之后，轮到我们守护那些微小的心愿。'},
  base:{kicker:'事务所基地',title:'这里，总有一盏灯为她们亮着。',subtitle:'照顾每一位归来的契约者，也为新的相遇留一个位置。'},
  market:{kicker:'契约招募',title:'寻找下一束微光。',subtitle:'每一种魔法背后，都有一个值得被听见的故事。'},
  records:{kicker:'夜班档案',title:'把每一个夜晚，认真记下来。',subtitle:'那些被守护的心愿，最终都会成为城市的光。'},
};
export function PageHeading({page,children}:{page:Page;children?:React.ReactNode}) {
  const d=pageTitles[page];
  return <div className="page-heading"><div><div className="breadcrumb"><span>事务所</span><ChevronRight size={11}/><b>{d.kicker}</b></div><h1>{d.title}</h1><p>{d.subtitle}</p></div>{children}</div>;
}
