import { useState } from 'react';
import { Heart, BatteryMedium, Sparkles, MessageCircle, ArrowUpRight, Moon, Cross, Star, LockKeyhole, BadgeCheck, Bandage, Users, Flower2, ShieldCheck, Swords, Timer } from 'lucide-react';
import type { GameState, Girl, StatKey } from '../types';
import { relationshipStage, stageHints, stageLabels, statLabels, statusLabels } from '../game';
import { effectText, getSkill, resourceLabels, tierLabels } from '../content/skills';

const dossierTabs = [
  { id: 'overview', label: '状态概览' },
  { id: 'ability', label: '魔法能力' },
  { id: 'relations', label: '关系网络' },
  { id: 'memory', label: '心愿与羁绊' },
];

export function CharacterDialog({ girl, state, onCare, onTalk, onAssign, onHire, onRetire }: {
  girl: Girl; state: GameState; onCare: (mode: 'healing' | 'resting') => void;
  onTalk: () => void; onAssign: () => void; onHire: () => void; onRetire: () => void;
}) {
  const [tab, setTab] = useState('overview');
  const candidate = !state.girls.some(g => g.id === girl.id);
  const keys = Object.keys(statLabels) as StatKey[];
  const stage = relationshipStage(girl.bond);
  const peers = Object.entries(girl.relationships).map(([id, score]) => ({ girl: state.girls.find(g => g.id === id), score })).filter(x => x.girl);
  return (
    <div className="character-dossier" style={{ '--girl-color': girl.color } as React.CSSProperties}>
      <div className="dossier-art">
        <span className="dossier-art-code">契约档案<br /><b>{girl.codename}</b></span>
        <div className="portrait-orbit" />
        <img src={girl.portrait} alt={`${girl.name}的魔法少女立绘`} />
        <span className="dossier-seal"><Star size={20} /><span>夜糖<br />契约</span></span>
        <span className="dossier-art-bottom">每一束星光，都有自己的名字。</span>
      </div>
      <div className="dossier-content">
        <div className="modal-eyebrow">{candidate ? '招募档案' : '契约者档案'} / {girl.element}</div>
        <div className="dossier-name"><h2>{girl.name}</h2><span>Lv.{girl.level.toString().padStart(2, '0')}</span></div>
        <div className="dossier-codename">{girl.codename}<span className="pill">{candidate ? '等待签约' : statusLabels[girl.status]}</span></div>
        <div className="dossier-tabs" role="tablist" aria-label="人物档案分页">
          {dossierTabs.map((t, index) => (
            <button role="tab" aria-selected={tab === t.id} aria-controls="dossier-tab-content" tabIndex={tab === t.id ? 0 : -1}
              id={`dossier-tab-${t.id}`} key={t.id} onClick={() => setTab(t.id)}
              onKeyDown={e => {
                let next = index;
                if (e.key === 'ArrowRight') next = (index + 1) % dossierTabs.length;
                else if (e.key === 'ArrowLeft') next = (index + dossierTabs.length - 1) % dossierTabs.length;
                else if (e.key === 'Home') next = 0;
                else if (e.key === 'End') next = dossierTabs.length - 1;
                else return;
                e.preventDefault(); setTab(dossierTabs[next].id); document.getElementById(`dossier-tab-${dossierTabs[next].id}`)?.focus();
              }}>{t.label}</button>
          ))}
        </div>
        <div id="dossier-tab-content" className="dossier-tab-body" role="tabpanel" aria-labelledby={`dossier-tab-${tab}`}>
          {tab === 'overview' && <>
            <div className="dossier-meter"><div><Heart size={14} /><span>血量</span><b>{girl.hp}<small> / {girl.maxHp}</small></b></div><i><b style={{ width: `${girl.hp / girl.maxHp * 100}%` }} /></i></div>
            <div className="dossier-meter spirit"><div><Sparkles size={15} /><span>共情值</span><b>{girl.spirit}<small> / {girl.maxSpirit}</small></b></div><i><b style={{ width: `${girl.spirit / girl.maxSpirit * 100}%` }} /></i></div>
            <div className="dossier-meter fatigue"><div><BatteryMedium size={15} /><span>疲劳值</span><b>{girl.fatigue}<small> / 100</small></b></div><i><b style={{ width: `${girl.fatigue}%` }} /></i></div>
            <div className="scar-track">
              <div className="scar-track-head"><span><Bandage size={13} />疤痕</span><b>{girl.scars.length} / 5</b></div>
              <div className="scar-slots">
                {Array.from({ length: 5 }, (_, index) => {
                  const scar = girl.scars[index];
                  return scar
                    ? <span key={index} className={`scar-slot filled ${scar.kind}`} title={`${scar.name}：${scar.condition}`}><Bandage size={11} />{scar.name}</span>
                    : <span key={index} className="scar-slot" aria-label="未受伤"><i /></span>;
                })}
              </div>
              <p>{girl.scars.length >= 4 ? '第 5 道疤痕会带来不可逆的死亡。她仍可以申请退役，转任事务所文职。' : `每道疤痕让血量上限降低约 8%。当前上限 ${girl.maxHp} / 基础 ${girl.baseMaxHp}。`}</p>
            </div>
            <p className="dossier-description">{girl.description}</p>
            <div className="location-note"><Moon size={15} />{girl.status === 'mission' ? `执行委托中 · ${girl.remaining} 分钟后返回` : `当前位于${state.rooms.find(r => r.id === girl.roomId)?.name ?? '会客厅'}`}</div>
          </>}
          {tab === 'ability' && <>
            <div className="skill-list">
              {girl.skills.map(id => {
                const skill = getSkill(id);
                return (
                  <article key={id} className={`skill-card tier-${skill.tier}`}>
                    <div className="skill-card-head"><span className="skill-tier">{tierLabels[skill.tier]}</span><h3>{skill.name}</h3><em>{resourceLabels[skill.resource]} · 倍率 {skill.power.toFixed(2)}</em></div>
                    <p>{skill.description}</p>
                    <div className="skill-meta">
                      <span><Cross size={11} />{resourceLabels[skill.resource]}</span>
                      <span><Users size={11} />{skill.side === 'enemy' ? `敌 ${skill.targets}` : skill.side === 'ally' ? `友 ${skill.targets}` : '自身'}</span>
                      <span><Timer size={11} />冷却 {skill.cooldown} 轮</span>
                      {skill.tier === 'ultimate' && <span className="ultimate-note">第 2 轮起可用</span>}
                    </div>
                    {skill.effects.length > 0 && <div className="skill-effects">{skill.effects.map((e, i) => <span key={i}>{effectText(e)}</span>)}</div>}
                  </article>
                );
              })}
            </div>
            <div className="stat-bars">{keys.map(k => <div key={k}><span>{statLabels[k]}</span><i><b style={{ width: `${girl.stats[k]}%` }} /></i><strong>{girl.stats[k]}</strong></div>)}</div>
            <p className="small-note">能力用于战斗结算与委托判定。疤痕会永久改变这些数值。</p>
          </>}
          {tab === 'relations' && <>
            <div className="bond-hero">
              <div className={`bond-ring stage-${stage}`} style={{ '--bond': `${girl.bond}%` } as React.CSSProperties}><Heart size={20} /><b>{girl.bond}</b></div>
              <div><small>与你的关系</small><h3>{stageLabels[stage]}</h3><p>{stageHints[stage]}</p></div>
            </div>
            <div className="relation-legend">{stageLabels.map((label, index) => <span key={label} className={`stage-${index} ${index === stage ? 'current' : ''}`}>{label}</span>)}</div>
            <div className="modal-section-heading"><h3>事务所内的关系</h3><small>同伴之间的看法</small></div>
            <div className="peer-list">
              {peers.map(({ girl: peer, score }) => {
                const peerStage = relationshipStage(score);
                return (
                  <button id={`relation-${peer!.id}`} key={peer!.id} className="peer-row" onClick={() => document.dispatchEvent(new CustomEvent('nso:open-girl', { detail: peer!.id }))}>
                    <img src={peer!.portrait} alt="" />
                    <span><b>{peer!.name}</b><small>{peer!.codename}</small></span>
                    <i><b style={{ width: `${score}%` }} /></i>
                    <em className={`stage-${peerStage}`}>{stageLabels[peerStage]}<small>{score}</small></em>
                  </button>
                );
              })}
            </div>
            <p className="small-note">关系会随共同出勤、战斗胜负与告别而变化。数值不会直接显示在对话里。</p>
          </>}
          {tab === 'memory' && <>
            <div className="bond-emblem"><Heart size={28} /><div><small>与你的羁绊</small><strong>{girl.bond}<span>/100</span></strong></div></div>
            <p className="dossier-description">{candidate ? '一个故事还没有开始。在签署契约之后，你会慢慢认识她不为人知的另一面。' : girl.bond >= 70 ? '「如果城市的灯都熄了，我也知道该往哪里走。因为你会在这里等我。」' : girl.bond >= 40 ? '「我不太擅长讲自己的事。不过，如果你愿意听……我们可以慢慢来。」' : '「工作之外的事，我还没有想好要不要告诉你。」'}</p>
            <div className="memory-item"><BadgeCheck size={17} /><span>已知心愿<small>{girl.quote ?? '希望每一次出勤之后，大家都能平安回来。'}</small></span></div>
            <div className="memory-item"><LockKeyhole size={16} /><span>{girl.bond >= 60 ? '被记住的片刻' : '未说出口的故事'}<small>{girl.bond >= 60 ? '深夜留在桌上的一杯热可可，杯沿有她的口红印。' : '多陪她聊聊，故事会在日常中慢慢展开。'}</small></span></div>
            {girl.scars.length > 0 && <div className="memory-scars">{girl.scars.map(scar => <div key={scar.id} className={`memory-scar ${scar.kind}`}><Bandage size={13} /><span><b>{scar.name}</b><small>{scar.condition} · {scar.gainedAt}</small></span></div>)}</div>}
          </>}
        </div>
        {candidate ? <button id="candidate-hire-from-profile" className="btn primary full" onClick={onHire}>缔结契约 · {girl.cost.toLocaleString()} 星砂<ArrowUpRight size={16} /></button> : <>
          <div className="care-actions">
            <button id="girl-heal" className="btn" disabled={girl.status !== 'idle' || girl.hp === girl.maxHp} onClick={() => onCare('healing')}><Cross size={15} /><span>送去治疗<small>180 星砂 · 60 分钟</small></span></button>
            <button id="girl-rest" className="btn" disabled={girl.status !== 'idle' || girl.fatigue === 0} onClick={() => onCare('resting')}><Moon size={15} /><span>安排休息<small>免费 · 90 分钟</small></span></button>
          </div>
          <div className="dossier-primary-actions">
            <button id="girl-talk" className="btn" disabled={girl.status === 'mission'} onClick={onTalk}><MessageCircle size={16} />和她聊聊</button>
            <button id="girl-assign" className="btn primary" disabled={girl.status !== 'idle' || girl.hp < 25 || girl.fatigue >= 80} onClick={onAssign}><Swords size={16} />安排派遣<ArrowUpRight size={17} /></button>
          </div>
          {girl.retired
            ? <p className="small-note"><ShieldCheck size={12} />已转任文职。她仍住在基地，也会出现在关系网络里。</p>
            : girl.scars.length >= 4 && <button id="girl-retire" className="btn retire-btn" onClick={onRetire}><Flower2 size={15} />申请退役 · 转任文职</button>}
          {girl.status !== 'idle' && <p className="small-note">正在{statusLabels[girl.status]}，剩余 {girl.remaining} 分钟。推进时间完成安排。</p>}
        </>}
      </div>
    </div>
  );
}
