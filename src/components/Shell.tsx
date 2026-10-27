import { Map, House, Gem, ScrollText, Landmark, Settings2, CircleHelp, Moon, CloudFog, Sparkles, ShieldCheck, Bell, ChevronRight, Cat, Star, BookOpen, Flower2, Siren, Compass, Terminal, Library } from 'lucide-react';
import type { FactionId, GameState } from '../types';
import { clock } from '../game';
import { cityStage, factionAttitude } from '../economy';
import { factionInfo } from '../content/items';

export type Page = 'dispatch' | 'base' | 'market' | 'records' | 'council' | 'worldbook';
const pages = [{ id: 'dispatch', label: '派遣', Icon: Map }, { id: 'base', label: '基地', Icon: House }, { id: 'council', label: '议会', Icon: Landmark }, { id: 'market', label: '市场', Icon: Gem }, { id: 'records', label: '记录', Icon: ScrollText }] as const;
const factionOrder: FactionId[] = ['witch', 'association', 'government'];

export function Navigation({ page, onPage, onHelp, onSettings, onCodex, onMemorial, memorialCount }: { page: Page; onPage: (p: Page) => void; onHelp: () => void; onSettings: () => void; onCodex: () => void; onMemorial: () => void; memorialCount: number }) {
  return <aside className="side-rail">
    <a id="brand-home" href="#dispatch" className="brand-mark" aria-label="夜糖事务所，返回派遣" onClick={e => { e.preventDefault(); onPage('dispatch'); }}>
      <Cat size={28} />
      <Star className="brand-star" size={10} />
    </a>
    <div className="rail-rule" />
    <nav aria-label="游戏主导航">
      {pages.map(({ id, label, Icon }) => (
        <button id={`nav-${id}`} key={id} aria-current={page === id ? 'page' : undefined} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => onPage(id)}>
          <Icon size={20} strokeWidth={1.65} />
          <span>{label}</span>
          {page === id && <i />}
        </button>
      ))}
    </nav>
    <div className="rail-bottom">
      <button id="open-codex" className="rail-utility" onClick={onCodex} aria-label="打开魔物图鉴" title="魔物图鉴"><BookOpen size={19} /></button>
      <button id="open-memorial" className="rail-utility memorial-utility" onClick={onMemorial} aria-label="打开星光纪念墙" title="星光纪念墙"><Flower2 size={19} />{memorialCount > 0 && <em className="rail-count">{memorialCount}</em>}</button>
      <button id="open-worldbook" className="rail-utility" onClick={() => onPage('worldbook')} aria-label="世界书与数值规则" title="世界书与数值规则"><Library size={19} /></button>
      <button id="open-help" className="rail-utility" onClick={onHelp} aria-label="操作指南"><CircleHelp size={20} /></button>
      <button id="open-settings" className="rail-utility" onClick={onSettings} aria-label="游戏设置"><Settings2 size={20} /></button>
      <span className="rail-edition">夜班契约</span>
    </div>
  </aside>;
}

export function Topbar({ state, onNotifications, onCommand, saved }: { state: GameState; onNotifications: () => void; onCommand: () => void; saved: boolean }) {
  const stage = cityStage(state.reputation);
  return <header className="topbar">
    <div className="wordmark">
      <strong>夜糖事务所<span className="logo-dot">.</span></strong>
      <span>NIGHT SUGAR · PUELLA LEDGER</span>
    </div>
    <div className="scene-time">
      <Moon size={23} strokeWidth={1.4} />
      <div>
        <span className="eyebrow">第 {state.day} 日 · 午夜值班</span>
        <strong>{clock(state.minutes)}</strong>
      </div>
      <div className="weather">
        <CloudFog size={15} />
        <span>樱雾市<br /><b>薄雾 · 结界观测中</b></span>
      </div>
    </div>
    <div className="top-resources">
      {state.boss && (
        <div className="boss-banner" role="status" title="城市级威胁：空月降临。城市安定度正在下降。">
          <Siren size={15} />
          <span><small>城市级威胁</small><b>空月降临</b></span>
        </div>
      )}
      <div className="resource">
        <Sparkles size={17} />
        <span><small>星砂储备</small><b>{state.gold.toLocaleString('zh-CN')}</b></span>
      </div>
      <div className="resource stability" title={`城市安定度阶段：${stage.name}（${stage.note}）`}>
        <ShieldCheck size={17} />
        <span><small>城市安定度 · {stage.name}</small><b>{state.reputation}<em>/ 100</em></b></span>
      </div>
      <div className="top-factions" role="group" aria-label="三方势力态度">
        {factionOrder.map(id => {
          const info = factionInfo[id];
          const standing = state.factions?.[id]?.standing ?? 0;
          const att = factionAttitude(standing);
          return (
            <div key={id} className={`top-faction-pill tone-${att.tone}`} title={`${info.name}（代表：${info.envoy}）· 声望 ${standing}/100 · 态度：${att.label}（${att.discount}）`}>
              <small>{info.short}</small>
              <b>{standing}</b>
              <em>{att.label}</em>
            </div>
          );
        })}
      </div>
      <span className={`save-indicator ${!saved ? 'error' : ''}`} title={saved ? '进度保存在当前浏览器' : '浏览器未能保存，请导出存档'}>
        <i />{saved ? '已存档' : '未保存'}
      </span>
      <button id="open-command" className="icon-btn command-btn" onClick={onCommand} aria-label="打开事务所终端" title="事务所终端 · Ctrl+K"><Terminal size={17} /></button>
      <button id="open-notifications" className="icon-btn notification-btn" onClick={onNotifications} aria-label="打开事务所通知">
        <Bell size={18} /><i />
      </button>
    </div>
  </header>;
}

const pageTitles: Record<Page, { kicker: string; title: string; subtitle: string; code: string }> = {
  dispatch: { kicker: '城市派遣 · 灵魂天平', title: '星光，不会准时下班。', subtitle: '甜美的祈愿在午夜结成晶石；在灵魂混浊之前，替这座城市守住最后的灯火。', code: 'CONTRACT // DISPATCH TERMINAL' },
  base: { kicker: '事务所基地 · 平面图总控', title: '这里，总有一盏灯为她们亮着。', subtitle: '会客厅的茶会、月光诊所的手术台、晚安宿舍的梦境与星象台的远响，全部收纳于二层平面图中。', code: 'SANCTUARY // FLOORPLAN MODULES' },
  market: { kicker: '契约招募 · 势力配给', title: '寻找下一束微光。', subtitle: '每一纸契约都标着甜美的价格；在纯白与深渊之间，挑选今晚还能握紧武器的人。', code: 'REGISTRY // CANDIDATES & SUPPLIES' },
  council: { kicker: '会客厅 · 三方议事', title: '灯亮着，就该把话说清楚。', subtitle: '月蚀、星灯、市役所的代表轮流坐进这把椅子；你的决定会写进辖区与她们的记忆。', code: 'COUNCIL // NIGHTFALL ASSEMBLY' },
  records: { kicker: '夜班档案 · 因果台账', title: '把每一个夜晚，认真记下来。', subtitle: '收支、安定度、三方势力态度、灵魂侵蚀与魔女抑制剂——所有代价都不会被抹去。', code: 'ARCHIVE // SOUL & FACTION LEDGER' },
  worldbook: { kicker: '叙事规则 · 世界书', title: '先定下这世界的说法。', subtitle: '词条决定叙事者知道什么，数值决定夜里会发生什么；保存于本地，改动即时生效。', code: 'WORLDBOOK // CANON & RULES' },
};

export function PageHeading({ page, children }: { page: Page; children?: React.ReactNode }) {
  const d = pageTitles[page];
  return <div className="page-heading">
    <div>
      <div className="breadcrumb">
        <Compass size={11} />
        <span>夜糖事务所</span>
        <ChevronRight size={11} />
        <b>{d.kicker}</b>
        <em className="heading-code">{d.code}</em>
      </div>
      <h1>{d.title}</h1>
      <p>{d.subtitle}</p>
    </div>
    {children}
  </div>;
}
