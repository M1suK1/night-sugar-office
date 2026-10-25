import { useState } from 'react';
import { ArrowUpRight, Check, Coins, Flower2, Info, Phone, Plus, Search, ShoppingBag, Sparkles, Star } from 'lucide-react';
import type { FactionId, GameState, Girl } from '../types';
import { factionInfo, items } from '../content/items';
import { itemPrice, marketPool, marketUpgrade } from '../game';
import { pensionArrears, pensionFor } from '../contracts';
import { getSkill } from '../content/skills';
import { GirlPortrait } from '../components/GirlPortrait';
import './market-view.css';

type Tab = 'candidates' | 'contracts' | 'supplies' | 'retired';
const tabs: { id: Tab; label: string }[] = [
  { id: 'candidates', label: '候选名册' },
  { id: 'contracts', label: '在册契约' },
  { id: 'supplies', label: '势力物资' },
  { id: 'retired', label: '退休区' },
];

export type MarketViewProps = {
  state: GameState;
  onHire: (id: string) => void;
  onGirl: (id: string) => void;
  onRemote: (id: string) => void;
  onRehire: (id: string) => void;
  onRenew: (id: string) => void;
  onUpgradeMarket: () => void;
  onAdvancedRecruit: (level: number) => void;
  onCustom: () => void;
  onBuyItem: (id: string) => void;
};

export function MarketView({ state, onHire, onGirl, onRemote, onRehire, onRenew, onUpgradeMarket, onAdvancedRecruit, onCustom, onBuyItem }: MarketViewProps) {
  const [tab, setTab] = useState<Tab>('candidates');
  const [filter, setFilter] = useState<'all' | 'combat' | 'support'>('all');
  const [query, setQuery] = useState('');
  const [advancedLevel, setAdvancedLevel] = useState(1);
  const pool = marketPool(state);
  const retired = state.girls.filter(girl => girl.retired);
  const active = state.girls.filter(girl => !girl.retired && !girl.dead);
  const upgrade = marketUpgrade(state);
  const candidates = pool.filter(girl => {
    const support = girl.stats.empathy >= girl.stats.magic;
    const matchesRole = filter === 'all' || (filter === 'support' ? support : !support);
    return matchesRole && `${girl.name}${girl.codename}${girl.title}${girl.element}${girl.description}`.includes(query.trim());
  });
  const maxAdvanced = Math.min(6, state.marketLevel + 2);
  return <section className="av-view av-market-view" aria-labelledby="av-market-title">
    <header className="av-heading"><div><p className="av-eyebrow"><Star size={12} />星愿契约 · 人才市场</p><h1 id="av-market-title">寻找下一束微光</h1><p>每一份契约，都是两段命运的相遇。</p></div><div className="av-heading-meta"><Coins size={14} /><span>可用星砂</span><strong>{state.gold.toLocaleString('zh-CN')}</strong></div></header>

    <div className="av-market-bar">
      <div className="av-market-level"><span>市场等级 <b>Lv.{state.marketLevel}</b></span><small>每日候选 {upgrade.size} 位 · 高级招聘上限 Lv.{maxAdvanced}</small></div>
      <button id="av-market-upgrade" type="button" className="av-btn av-btn-small" disabled={upgrade.cost === null || state.gold < upgrade.cost} onClick={onUpgradeMarket}><ArrowUpRight size={13} />{upgrade.cost === null ? '已达最高等级' : `升级市场 · ${upgrade.cost.toLocaleString('zh-CN')} 星砂`}</button>
      <button id="av-market-custom" type="button" className="av-btn av-btn-small" onClick={onCustom}><Sparkles size={13} />自定义登记</button>
    </div>

    <div className="av-market-tabs" role="tablist" aria-label="市场分类">
      {tabs.map(item => <button key={item.id} id={`av-market-tab-${item.id}`} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`av-market-panel-${item.id}`} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>{item.label}{item.id === 'retired' && retired.length > 0 && <small>{retired.length}</small>}</button>)}
    </div>

    {tab === 'candidates' && <div id="av-market-panel-candidates" role="tabpanel" aria-labelledby="av-market-tab-candidates">
      <div className="av-toolbar"><div className="av-filters" aria-label="候选成员类型">{([['all', '全部'], ['combat', '作战'], ['support', '支援']] as const).map(([value, label]) => <button id={`av-market-filter-${value}`} type="button" className="av-filter" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{label}</button>)}<span className="av-filter-count">{candidates.length} 位候选成员</span></div><label className="av-search" htmlFor="av-market-search"><Search size={14} /><input id="av-market-search" className="av-input" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="寻找姓名、称号或元素" aria-label="搜索候选魔法少女" /></label></div>
      <div className="av-advanced"><div><strong>高级招聘</strong><small>指定 1–6 级候选；等级越高，消耗星砂与城市安定度越多。每日 1 次。</small></div><label htmlFor="av-market-advanced-level" className="av-visually-hidden">高级招聘等级</label><select id="av-market-advanced-level" className="av-select" value={advancedLevel} onChange={event => setAdvancedLevel(Number(event.target.value))}>{Array.from({ length: maxAdvanced }, (_, index) => index + 1).map(level => <option key={level} value={level}>Lv.{level} · {1000 + level * 400} 星砂</option>)}</select><button id="av-market-advanced" type="button" className="av-btn av-btn-small" onClick={() => onAdvancedRecruit(advancedLevel)}>发布招募<Plus size={12} /></button></div>
      {candidates.length ? <div className="av-candidate-grid">{candidates.map(girl => <CandidateCard key={girl.id} girl={girl} state={state} onHire={onHire} onGirl={onGirl} />)}</div> : <div className="av-empty"><Search size={30} strokeWidth={1} /><p>没有符合条件的候选者。<br />试试更换类型，或使用其他关键词。</p></div>}
    </div>}

    {tab === 'contracts' && <div id="av-market-panel-contracts" role="tabpanel" aria-labelledby="av-market-tab-contracts" className="av-contract-list">
      {active.map(girl => <article key={girl.id} className="av-contract-row"><button type="button" className="av-contract-main" onClick={() => onGirl(girl.id)}><GirlPortrait girl={girl} variant="avatar" /><span><b>{girl.name}</b><small>Lv.{girl.level} · {girl.codename} · 羁绊 {girl.bond}</small></span><Chevron /></button><div className="av-contract-meta"><span>契约剩余<b>{Math.max(0, girl.contractEndDay - state.day)} 日</b></span><span>退休金<b>{pensionFor(girl)} / 10 日</b></span><button id={`av-market-renew-${girl.id}`} type="button" className="av-btn av-btn-small" onClick={() => onRenew(girl.id)}>续签契约</button></div></article>)}
    </div>}

    {tab === 'supplies' && <div id="av-market-panel-supplies" role="tabpanel" aria-labelledby="av-market-tab-supplies" className="av-supplies">
      {(Object.keys(factionInfo) as FactionId[]).map(faction => { const info = factionInfo[faction]; const stock = items.filter(item => item.faction === faction); return <section key={faction} className="av-supply-group" style={{ '--faction': info.color } as React.CSSProperties}><header><span className="av-supply-seal">{info.short}</span><div><small>{info.title}</small><h2>{info.name}</h2></div><span className="av-supply-standing">声望 <b>{state.factions[faction].standing}</b></span></header><div className="av-supply-grid">{stock.map(item => { const price = itemPrice(state, item); const canBuy = state.factions[faction].standing >= item.standingReq && state.gold >= price; return <article key={item.id} className="av-supply-card"><div className="av-supply-title"><ShoppingBag size={13} /><b>{item.name}</b><span>{item.slot === 'consumable' ? '消耗品' : item.slot === 'weapon' ? '法器' : '护符'}</span></div><p>{item.passive ?? item.description}</p><div className="av-supply-buy"><span>{price.toLocaleString('zh-CN')} <small>星砂</small></span><button id={`av-supply-buy-${item.id}`} type="button" className="av-btn av-btn-small" disabled={!canBuy} onClick={() => onBuyItem(item.id)}>{state.factions[faction].standing < item.standingReq ? `声望 ${item.standingReq}` : <><Plus size={12} />购入</>}</button></div></article>; })}</div></section>; })}
      <p className="av-section-caption"><Info size={11} /> 物资进入仓库后，可在成员档案的“外观与装备”页装配；消耗品也可在那里使用。</p>
    </div>}

    {tab === 'retired' && <div id="av-market-panel-retired" role="tabpanel" aria-labelledby="av-market-tab-retired">
      <div className="av-retired-head"><div><p className="av-eyebrow"><Flower2 size={12} />退休区 · 城南</p><h2>她们把夜班，交给了后来的人</h2><p>退役成员仍住在事务所附近。退休金每 10 日划拨一次，欠缴会累积；手机一直开着。</p></div><span className="av-retired-count">{retired.length} 位退役成员</span></div>
      {retired.length ? <div className="av-retired-grid">{retired.map(girl => <article key={girl.id} className="av-retired-card"><button type="button" className="av-retired-portrait" onClick={() => onGirl(girl.id)}><GirlPortrait girl={girl} /><span>{girl.retiredReason === 'injury' ? '因伤退役' : '契约到期'}</span></button><div className="av-retired-body"><div className="av-retired-name"><h3>{girl.name}</h3><small>Lv.{girl.level}</small></div><p>{girl.codename} · 羁绊 {girl.bond} · {girl.scars.length} 道疤痕</p><div className="av-retired-stats"><span>退休金<b>{pensionFor(girl)}<small> / 10 日</small></b></span><span>欠缴<b className={pensionArrears(girl) ? 'warn' : ''}>{pensionArrears(girl)}</b></span></div><div className="av-retired-actions"><button id={`av-market-remote-${girl.id}`} type="button" className="av-btn av-btn-small" onClick={() => onRemote(girl.id)}><Phone size={13} />远程联络</button>{girl.retiredReason === 'contract' && <button id={`av-market-rehire-${girl.id}`} type="button" className="av-btn av-btn-small" disabled={state.gold < 600 + girl.level * 120} onClick={() => onRehire(girl.id)}>返聘 · {600 + girl.level * 120}</button>}</div></div></article>)}</div> : <div className="av-empty"><Flower2 size={28} /><p>还没有退役成员。</p></div>}
      <p className="av-section-caption"><Info size={11} /> 退休金与欠缴会进入每日账本；长期欠缴会触发强制退休与声望惩罚。</p>
    </div>}
  </section>;
}

function Chevron() { return <ArrowUpRight size={12} />; }

function CandidateCard({ girl, state, onHire, onGirl }: { girl: Girl; state: GameState; onHire: (id: string) => void; onGirl: (id: string) => void }) {
  const hired = state.girls.some(member => member.id === girl.id);
  const stats: [string, number][] = [['魔力', girl.stats.magic], ['洞察', girl.stats.insight], ['敏捷', girl.stats.agility], ['共情', girl.stats.empathy]];
  return <article className="av-candidate" aria-labelledby={`av-candidate-name-${girl.id}`}>
    <button id={`av-market-preview-${girl.id}`} type="button" className="av-candidate-preview" onClick={() => onGirl(girl.id)} aria-label={`查看${girl.name}的完整档案`}><GirlPortrait girl={girl} /><span className="av-candidate-rank">{girl.element}</span><span className="av-candidate-inspect">查看档案<ArrowUpRight size={12} /></span></button>
    <div className="av-candidate-body"><div className="av-candidate-title"><h2 id={`av-candidate-name-${girl.id}`}>{girl.name}</h2><span className="av-tag">等级 {girl.level}</span></div><p className="av-candidate-role">{girl.codename} · {girl.title}</p><p className="av-candidate-quote">{girl.description}</p>
      <div className="av-candidate-skills">{girl.skills.slice(0, 3).map(id => <span className="av-tag" key={id}><Sparkles size={10} />{getSkill(id).name}</span>)}</div>
      <div className="av-candidate-contract"><span>契约期 <b>20 日</b></span><span>退休金 <b>{pensionFor(girl)} / 10 日</b></span></div>
      <div className="av-candidate-stats">{stats.map(([label, value]) => <div className="av-candidate-stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><div className="av-candidate-hire"><span className="av-candidate-price">{girl.cost.toLocaleString('zh-CN')}<small>星砂</small></span><button id={`av-market-hire-${girl.id}`} type="button" className="av-btn av-btn-primary av-btn-small" onClick={() => onHire(girl.id)} disabled={hired}>{hired ? <><Check size={13} />已签订契约</> : <><Plus size={13} />邀请加入</>}</button></div></div>
  </article>;
}
