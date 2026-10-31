import { useState } from 'react';
import { BookOpen, Skull, Flower2, Sparkles, Shield, ScanEye, ChevronRight, MoonStar, Quote, Flame } from 'lucide-react';
import type { GameState, MonsterTemplate } from '../types';
import { monsters as baseMonsters } from '../content/monsters';
import { eliteBuffs } from '../content/eliteBuffs';
import { statLabels } from '../game';
import { MonsterGlyph } from './MonsterGlyph';

type CodexTab = 'monster' | 'elite';

export function CodexDialog({ initialId, extra = [] }: { initialId?: string; extra?: MonsterTemplate[] }) {
  const monsters = [...extra, ...baseMonsters];
  const [tab, setTab] = useState<CodexTab>(initialId && eliteBuffs.some(b => b.id === initialId) ? 'elite' : 'monster');
  const [picked, setPicked] = useState<string>(initialId ?? monsters[0].id);
  const [pickedElite, setPickedElite] = useState<string>(eliteBuffs[0].id);
  const monster = monsters.find(m => m.id === picked) ?? monsters[0];
  const elite = eliteBuffs.find(b => b.id === pickedElite) ?? eliteBuffs[0];
  return (
    <div className="codex-dialog">
      <div className="modal-eyebrow"><BookOpen size={14} />夜班档案 / 魔物图鉴</div>
      <div className="codex-head"><div><h2>城市暗处的形状</h2><p>魔物不是没有名字的怪物。它们由未被说出口的心愿聚成，因此也有自己的习性、弱点与哀伤。</p></div><span className="codex-count">{monsters.length} 个记录</span></div>
      <div className="codex-tabs" role="tablist">
        <button id="codex-tab-monster" role="tab" aria-selected={tab === 'monster'} className={tab === 'monster' ? 'active' : ''} onClick={() => setTab('monster')}>普通记录</button>
        <button id="codex-tab-elite" role="tab" aria-selected={tab === 'elite'} className={tab === 'elite' ? 'active' : ''} onClick={() => setTab('elite')}>精英特征</button>
      </div>
      {tab === 'monster' ? (
        <div className="codex-layout">
          <nav className="codex-list" aria-label="魔物列表">
            {monsters.map(m => (
              <button id={`codex-${m.id}`} key={m.id} className={m.id === picked ? 'active' : ''} onClick={() => setPicked(m.id)} style={{ '--monster-color': m.color } as React.CSSProperties}>
                <MonsterGlyph monster={m} size={44} />
                <span><b>{m.name}</b><small>{m.rank} · {m.epithet}</small></span>
                <ChevronRight size={13} />
              </button>
            ))}
          </nav>
          <article className="codex-detail" style={{ '--monster-color': monster.color } as React.CSSProperties}>
            <div className="codex-art"><MonsterGlyph monster={monster} size={190} /><span className="codex-rank">{monster.rank}</span></div>
            <div className="codex-title"><span className="modal-eyebrow">{monster.element}属性 · {monster.rank}级</span><h3>{monster.name}</h3><p>{monster.epithet}</p></div>
            <p className="codex-description">{monster.description}</p>
            <div className="codex-vitals">
              <div><Sparkles size={14} /><span>血量</span><b>{monster.maxHp}</b></div>
              <div id={`codex-monster-guard`}><Sparkles size={14} /><span>心防</span><b>{monster.stats.empathy * 2}</b></div>
              {(['magic', 'insight', 'agility', 'empathy'] as const).map(k => <div key={k}><ScanEye size={13} /><span>{statLabels[k]}</span><b>{monster.stats[k]}</b></div>)}
            </div>
            <div className="codex-trait"><Shield size={15} /><div><small>特性</small><p>{monster.trait}</p></div></div>
            <div className="codex-notes">
              <div><small>习性</small><p>{monster.codex.habit}</p></div>
              <div><small>弱点</small><p>{monster.codex.weakness}</p></div>
            </div>
          </article>
        </div>
      ) : (
        <div className="codex-layout">
          <nav className="codex-list" aria-label="精英特征列表">
            {eliteBuffs.map(b => (
              <button id={`codex-elite-${b.id}`} key={b.id} className={b.id === pickedElite ? 'active' : ''} onClick={() => setPickedElite(b.id)} style={{ '--monster-color': b.color } as React.CSSProperties}>
                <Flame size={30} />
                <span><b>{b.name}</b><small>血量 ×{b.hpMul.toFixed(2)} · 心防 ×{b.empathyMul.toFixed(2)}</small></span>
                <ChevronRight size={13} />
              </button>
            ))}
          </nav>
          <article className="codex-detail" style={{ '--monster-color': elite.color } as React.CSSProperties}>
            <div className="codex-art"><Flame size={120} /><span className="codex-rank">精英</span></div>
            <div className="codex-title"><span className="modal-eyebrow">精英特征</span><h3>{elite.name}</h3><p>任何普通魔物都可能带着它出现。</p></div>
            <p className="codex-description">{elite.blurb}</p>
            <div className="codex-vitals">
              <div><Sparkles size={14} /><span>血量</span><b>×{elite.hpMul.toFixed(2)}</b></div>
              <div><ScanEye size={13} /><span>属性</span><b>×{elite.statMul.toFixed(2)}</b></div>
              <div><ScanEye size={13} /><span>心防</span><b>×{elite.empathyMul.toFixed(2)}</b></div>
            </div>
            <div className="codex-trait"><Flame size={15} /><div><small>附带技能</small><p>{elite.skillIds.join('、')}</p></div></div>
            <div className="codex-notes">
              <div><small>对策</small><p>{elite.counter}</p></div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

export function MemorialDialog({ state }: { state: GameState }) {
  return (
    <div className="memorial-dialog">
      <div className="modal-eyebrow"><Flower2 size={14} />事务所 / 星光纪念墙</div>
      <div className="memorial-head"><h2>她们留在了夜里。</h2><p>事务所会保留每一份契约档案。死亡不是数值归零，而是一个名字从值班表上永远划去。</p></div>
      {state.memorial.length === 0 ? (
        <div className="memorial-empty">
          <MoonStar size={40} /><h3>纪念墙还没有名字。</h3><p>愿它一直空着。每一位契约者都值得平安地看到天亮。</p>
          <span><Skull size={12} />第五道疤痕会导致死亡。请在她们还能退役时，认真考虑。</span>
        </div>
      ) : (
        <div className="memorial-list">
          {state.memorial.map(entry => (
            <article key={entry.girl.id} className="memorial-card" style={{ '--girl-color': entry.girl.color } as React.CSSProperties}>
              <div className="memorial-art"><img src={entry.girl.portrait} alt={`${entry.girl.name}的遗像`} /><span className="memorial-year">第 {entry.diedAt.split(' ')[0]} 日</span></div>
              <div className="memorial-info">
                <span className="modal-eyebrow">{entry.girl.codename} · {entry.girl.element}</span>
                <h3>{entry.girl.name}<small>Lv.{entry.girl.level}</small></h3>
                <p className="memorial-epitaph"><Quote size={13} />{entry.epitaph}</p>
                <dl><div><dt>死因</dt><dd>{entry.cause}</dd></div><div><dt>最后委托</dt><dd>{entry.girl.skill}</dd></div><div><dt>最后出勤</dt><dd>{entry.diedAt}</dd></div></dl>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="memorial-foot">如果她们还在，记得让她们休息、治疗，或者在退役申请上签字。</p>
    </div>
  );
}

export type MonsterRef = MonsterTemplate;
