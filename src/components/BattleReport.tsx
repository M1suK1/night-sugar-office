import { useEffect, useMemo, useState } from 'react';
import { Play, Pause, SkipForward, FastForward, Swords, Heart, Sparkles, Trophy, Skull, Bandage, X, ScanEye, ArrowRight, Shield, Flame, Snowflake, TrendingDown, TrendingUp, Timer } from 'lucide-react';
import type { BattleState, BattleUnit, BattleEvent } from '../types';
import { outcomeLabel } from '../combat';
import { getMonster } from '../content/monsters';
import { MonsterGlyph } from './MonsterGlyph';

const effectLabels: Record<string, string> = { dot: '灼伤', stun: '眩晕', shield: '护盾', buff: '增益', debuff: '减益', regen: '恢复' };
const effectIcons: Record<string, typeof Flame> = { dot: Flame, stun: Snowflake, shield: Shield, buff: TrendingUp, debuff: TrendingDown, regen: Heart };

function UnitCard({ unit, active, compact }: { unit: BattleUnit; active: boolean; compact?: boolean }) {
  const monster = unit.side === 'enemy' ? (unit.monster ?? getMonster(unit.portrait)) : null;
  return (
    <article className={`battle-unit ${unit.side} ${unit.down ? 'down' : ''} ${active ? 'active' : ''}`} style={{ '--unit-color': unit.color } as React.CSSProperties}>
      <div className="battle-unit-art">
        {monster ? <MonsterGlyph monster={monster} size={compact ? 46 : 68} /> : <img src={unit.portrait} alt="" />}
        {unit.down && <span className="down-stamp">无法行动</span>}
      </div>
      <div className="battle-unit-info">
        <div className="battle-unit-name"><b>{unit.name}</b>{unit.side === 'enemy' && <small>{monster?.rank}</small>}</div>
        <div className="battle-bar hp"><i><b style={{ width: `${Math.max(0, unit.hp / unit.maxHp * 100)}%` }} /></i><span>{Math.max(0, unit.hp)}<small>/{unit.maxHp}</small></span></div>
        <div className="battle-bar spirit"><i><b style={{ width: `${Math.max(0, unit.spirit / unit.maxSpirit * 100)}%` }} /></i><span>{Math.max(0, unit.spirit)}<small>/{unit.maxSpirit}</small></span></div>
        {unit.effects.length > 0 && <div className="unit-effects">{unit.effects.filter(e => e.kind !== 'shield' || e.amount > 0).map((e, i) => {
          const Icon = effectIcons[e.kind] ?? Sparkles;
          return <span key={i} className={`fx-${e.kind}`} title={`${effectLabels[e.kind]}${e.stat ? ` ${e.stat}` : ''}`}><Icon size={9} />{effectLabels[e.kind]}{e.kind === 'shield' ? ` ${e.amount}` : ''}</span>;
        })}</div>}
      </div>
    </article>
  );
}

function calcText(event: BattleEvent): string {
  const calc = event.calc;
  if (!calc) return '';
  const parts: string[] = [];
  if (calc.hit) {
    const h = calc.hit;
    const bonus = h.bonus ? ` + 修正 ${h.bonus}` : '';
    parts.push(`命中 ${Math.round(h.chance)}% ＝ 50 + 敏捷 ${h.agility} − 敌敏 ${h.targetAgility}${bonus}；d100 ${h.roll.toFixed(1)} → ${event.hit ? '命中' : '落空'}`);
  }
  if (calc.damage) {
    const d = calc.damage;
    const mitigation = d.mitigation < 1 ? ` × 减伤 ${Math.round(d.mitigation * 100)}%` : '';
    const shield = d.shield > 0 ? ` − 护盾吸收 ${d.shield}` : '';
    const label = event.resource === 'spirit' ? '共情削减' : '伤害';
    parts.push(`${label} ${d.raw} ＝ 魔力 ${d.magic} × 倍率 ${d.power} × 波动 ${d.variance.toFixed(2)}${mitigation}${shield} → 实际 ${d.dealt}`);
  }
  if (calc.heal) {
    const h = calc.heal;
    parts.push(`恢复 ${h.raw} ＝ 魔力 ${h.magic} × 倍率 ${h.power} × 0.5 → 实际 ${h.capped}`);
  }
  return parts.join('　｜　');
}

function EventRow({ event, units }: { event: BattleEvent; units: BattleUnit[] }) {
  const nameOf = (n: string) => units.find(u => u.name === n)?.name ?? n;
  const formula = calcText(event);
  return (
    <li className={event.hit ? 'hit' : 'miss'}>
      <span className="event-time">{String(event.at.minutes % 1440).padStart(4, '0').replace(/^(\d\d)(\d\d)$/, '$1:$2')}</span>
      <span className="event-actor">{event.actor}</span>
      <ArrowRight size={11} />
      <span className="event-skill">{event.skillName}</span>
      <span className="event-target">{event.targets.map(nameOf).join('、')}</span>
      {event.amount !== undefined && <em className={event.resource === 'spirit' ? 'spirit' : ''}>{event.resource === 'spirit' ? '共情' : '血量'} {event.note?.includes('恢复') ? '+' : '−'}{event.amount}</em>}
      <small>{event.note}</small>
      {formula && <span className="event-formula">{formula}</span>}
    </li>
  );
}

export function BattleReport({ battle, onClose }: { battle: BattleState; onClose: () => void }) {
  const frames = battle.frames?.length ? battle.frames : [{ round: battle.round, units: battle.units, initiative: battle.initiative }];
  const [tab, setTab] = useState<'replay' | 'report'>('replay');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const frame = frames[Math.min(index, frames.length - 1)];
  const round = frame.round;
  const units = frame.units;
  const allies = units.filter(u => u.side === 'ally');
  const enemies = units.filter(u => u.side === 'enemy');
  const events = useMemo(() => battle.events.filter(e => e.round === round), [battle.events, round]);
  const atEnd = index >= frames.length - 1;

  useEffect(() => {
    if (!playing || atEnd) return;
    const timer = window.setTimeout(() => setIndex(i => Math.min(i + 1, frames.length - 1)), 1900 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, atEnd, frames.length]);
  useEffect(() => {
    if (atEnd) { setPlaying(false); }
  }, [atEnd]);

  const outcome = battle.outcome;
  const tone = outcome === 'victory' ? 'win' : outcome === 'defeat' ? 'lose' : outcome === 'draw' ? 'draw' : 'repel';
  const allyNames = battle.units.filter(u => u.side === 'ally').map(u => u.name).join('、');
  return (
    <div className={`battle-theater tone-${tone}`}>
      <header className="battle-head">
        <div>
          <div className="modal-eyebrow"><ScanEye size={14} />战斗记录 / {battle.missionTitle}</div>
          <h2>第 {battle.startedAt.day} 日 · {String(Math.floor(battle.startedAt.minutes / 60)).padStart(2, '0')}:{String(battle.startedAt.minutes % 60).padStart(2, '0')} 的战斗</h2>
        </div>
        <div className="battle-head-right">
          <span className="battle-seed">SEED {battle.seed.toString(16).toUpperCase()}</span>
          <div className="battle-tabs" role="tablist" aria-label="战斗记录分页">
            <button id="battle-tab-replay" role="tab" aria-selected={tab === 'replay'} onClick={() => setTab('replay')}>回放</button>
            <button id="battle-tab-report" role="tab" aria-selected={tab === 'report'} onClick={() => setTab('report')}>战报</button>
          </div>
          <button id="battle-close" className="icon-btn" onClick={onClose} aria-label="关闭战斗记录"><X size={18} /></button>
        </div>
      </header>

      {tab === 'replay' ? <>
        <div className="battle-initiative">
          <span className="initiative-label"><ScanEye size={12} />本轮洞察顺序</span>
          {frame.initiative.map((uid, i) => {
            const unit = units.find(u => u.uid === uid);
            if (!unit) return null;
            return <span key={uid} className={`initiative-chip ${i === 0 ? 'first' : ''} ${unit.down ? 'down' : ''}`}><b>{i + 1}</b>{unit.name}</span>;
          })}
          {frame.initiative.length === 0 && <span className="initiative-chip">尚无行动</span>}
        </div>
        <div className="battle-stage">
          <div className="battle-side allies">{allies.map(u => <UnitCard key={u.uid} unit={u} active={frame.initiative[0] === u.uid} />)}</div>
          <div className="battle-versus"><span>第</span><b>{round}</b><span>轮</span><Swords size={18} /></div>
          <div className="battle-side enemies">{enemies.map(u => <UnitCard key={u.uid} unit={u} active={frame.initiative[0] === u.uid} />)}</div>
        </div>
        <div className="battle-controls">
          <button id="battle-play" className="btn icon-text" onClick={() => { if (atEnd) { setIndex(0); setPlaying(true); } else setPlaying(p => !p); }}>
            {playing ? <Pause size={16} /> : <Play size={16} />}{playing ? '暂停' : atEnd ? '重播' : '播放'}
          </button>
          <button id="battle-speed" className="btn icon-text" onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 3 : 1)}><FastForward size={16} />{speed}×</button>
          <div className="battle-round-rail" role="group" aria-label="战斗轮次">
            {frames.map((f, i) => <button key={f.round} id={`battle-round-${f.round}`} aria-current={i === index ? 'true' : undefined} className={i === index ? 'active' : ''} onClick={() => { setIndex(i); setPlaying(false); }}>{f.round}</button>)}
          </div>
          <button id="battle-skip" className="btn icon-text" onClick={() => { setIndex(frames.length - 1); setPlaying(false); setTab('report'); }}><SkipForward size={16} />跳过</button>
        </div>
        <section className="battle-log" aria-live="polite">
          <div className="battle-log-head"><h3>第 {round} 轮行动记录</h3><span><Timer size={12} />15 分钟 / 轮</span></div>
          <ul>{events.length ? events.map((e, i) => <EventRow key={i} event={e} units={units} />) : <li className="quiet">本轮没有发生行动。</li>}</ul>
        </section>
      </> : <>
        <div className={`battle-outcome tone-${tone}`}>
          <div className="outcome-mark">{outcome === 'defeat' ? <Skull size={30} /> : <Trophy size={30} />}</div>
          <div><small>{battle.missionTitle} · {battle.round} 轮</small><h2>{outcomeLabel(outcome)}</h2><p>{outcome === 'victory' ? '所有魔物失去战斗能力。委托完成，事件已从城市事件池中移除。' : outcome === 'repelled' ? '委托时间耗尽，魔物被暂时击退。事务所获得八成报酬，事件仍会回到池中。' : outcome === 'defeat' ? '全员失去战斗能力。她们会带着疤痕回来，而事件仍留在城市里。' : '双方都没能彻底结束战斗。城市暂时安静下来。'}</p></div>
          <div className="outcome-reward"><span>星砂</span><b>{battle.rewards?.gold ?? 0}</b><span>经验</span><b>{battle.rewards?.exp ?? 0}</b><span>羁绊</span><b>{battle.rewards?.bond ?? 0}</b></div>
        </div>
        <div className="report-body">
          <section>
            <div className="modal-section-heading"><h3>小队表现</h3><small>{allyNames}</small></div>
            <table id="battle-report-table">
              <thead><tr><th>契约者</th><th>造成</th><th>承受</th><th>治疗</th><th>控制</th><th>击倒</th></tr></thead>
              <tbody>{allies.map(u => <tr key={u.uid} className={u.down ? 'down' : ''}><td>{u.name}</td><td>{u.dealt}</td><td>{u.taken}</td><td>{u.healed}</td><td>{u.controlled}</td><td>{u.kills}</td></tr>)}</tbody>
            </table>
          </section>
          <section>
            <div className="modal-section-heading"><h3>战后记录</h3><small>疤痕与羁绊</small></div>
            {battle.scars?.length ? (
              <div className="report-scars">
                {battle.scars.map(s => <div key={s.id} className={`report-scar ${s.kind} ${s.fatal ? 'fatal' : ''}`}><Bandage size={14} /><span><b>{s.name}</b><small>{s.condition}{s.fatal ? ' · 致命' : ''}</small></span></div>)}
                <p>每道疤痕让血量上限下降约 8%。第五道疤痕意味着死亡。</p>
              </div>
            ) : <div className="report-quiet"><Shield size={16} /><span>{outcome === 'victory' ? '没有人受伤。今晚的星光很温柔。' : '没有新增疤痕，但疲劳会留在她们身上。'}</span></div>}
            <div className="report-exp"><span>战斗经验</span><i><b style={{ width: `${Math.min(100, (battle.rewards?.exp ?? 0) * 2)}%` }} /></i><b>+{battle.rewards?.exp ?? 0} EXP</b></div>
            {battle.fatal?.length ? <div className="fatal-note"><Skull size={14} />{battle.fatal.map(id => battle.units.find(u => u.uid === `ally-${id}`)?.name).join('、')}的第五道疤痕已经出现。她回不来了。</div> : null}
          </section>
        </div>
        <div className="modal-actions"><span>报告由规则引擎生成，叙事不会改写数值。</span><button id="battle-return" className="btn primary" onClick={onClose}>返回事务所<ArrowRight size={16} /></button></div>
      </>}
    </div>
  );
}
