import { useState } from 'react';
import { Swords, ShieldCheck, X, Users, Clock3, MapPin } from 'lucide-react';
import type { GameState, FactionFront } from '../types';
import { districts } from '../districts';
import { factionInfo } from '../content/items';
import { factionName } from '../territories';
import { factionAttitude } from '../economy';
import { frontLabel, frontRemaining, squadPower } from '../fronts';
import { pairLabel, trackOf } from '../hostility';

const sideLabel = { attacker: '进攻方', defender: '守方' } as const;

/**
 * 战线对话框：看清两边是谁、为什么打、还剩多久，再决定站哪一边。
 *
 * 「观望」不改任何状态——到点由 `resolveDueFronts` 自己打。
 */
export function FrontDialog({ front, state, onJoin, onClose }: { front: FactionFront; state: GameState; onJoin: (side: 'attacker' | 'defender', girlIds: string[]) => void; onClose: () => void }) {
  const [side, setSide] = useState<'attacker' | 'defender' | undefined>(front.side);
  const [picked, setPicked] = useState<string[]>(front.squad ?? []);
  const remaining = frontRemaining(front, { day: state.day, minutes: state.minutes });
  const district = districts[front.district];
  const track = trackOf(state, front.pair);
  const idle = state.girls.filter(girl => !girl.dead && !girl.retired && girl.hp > 0 && girl.status !== 'mission' && girl.status !== 'expedition' && girl.status !== 'resting');
  const toggle = (id: string) => setPicked(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 2 ? current : [...current, id]);
  const power = (faction: 'attacker' | 'defender') => faction === 'attacker' ? front.attackerPower : front.defenderPower;
  const bar = (value: number) => `${Math.max(4, Math.min(100, value))}%`;
  const renderSide = (role: 'attacker' | 'defender') => {
    const faction = role === 'attacker' ? front.attacker : front.defender;
    const info = factionInfo[faction];
    return (
      <article className={`front-side ${role}`} id={`front-${role}`} key={role} style={{ '--side-color': info.color } as React.CSSProperties}>
        <span className="front-role"><Swords size={12} />{sideLabel[role]}</span>
        <strong className="front-name">{factionName[faction]}</strong>
        <span className="front-meta"><ShieldCheck size={11} />态度 {factionAttitude(state.factions[faction].standing).label} · {state.factions[faction].standing}</span>
        <div className="front-power" id={`front-power-${role}`}>
          <i style={{ width: bar(power(role)) }} />
          <span>战力 {power(role)}</span>
        </div>
      </article>
    );
  };

  return (
    <div className="front-dialog" id="front-dialog">
      <p className="front-reason" id="front-reason">
        <MapPin size={12} />{district.name} · 起因：{front.reason ?? track.reason ?? '旧账还没算清'}。{pairLabel(front.pair)}的火气烧到了 100/100。
      </p>
      <div className="front-sides">
        {renderSide('attacker')}
        <div className="front-vs" aria-hidden="true">VS</div>
        {renderSide('defender')}
      </div>
      <div className="front-choice" role="radiogroup" aria-label="选择站边">
        <button type="button" id="front-side-attacker" role="radio" aria-checked={side === 'attacker'} className={side === 'attacker' ? 'active' : ''} onClick={() => setSide('attacker')}>帮{factionName[front.attacker]}</button>
        <button type="button" id="front-side-defender" role="radio" aria-checked={side === 'defender'} className={side === 'defender' ? 'active' : ''} onClick={() => setSide('defender')}>帮{factionName[front.defender]}</button>
        <button type="button" id="front-side-watch" role="radio" aria-checked={side === undefined} className={side === undefined ? 'active' : ''} onClick={() => { setSide(undefined); setPicked([]); }}>观望</button>
      </div>
      {side && (
        <div className="front-girls" id="front-girls">
          <p className="front-girls-head"><Users size={12} />派谁过去（1–2 位，夜里走不开的人不会出现在这里）</p>
          <div className="front-girl-list">
            {idle.length === 0 && <span className="front-empty">今晚没人能出勤。</span>}
            {idle.map(girl => (
              <button
                type="button"
                key={girl.id}
                id={`front-girl-${girl.id}`}
                aria-pressed={picked.includes(girl.id)}
                className={picked.includes(girl.id) ? 'active' : ''}
                onClick={() => toggle(girl.id)}
              >
                {girl.name}<span>Lv.{girl.level} · 体力 {girl.fatigue}</span>
              </button>
            ))}
          </div>
          {picked.length > 0 && <p className="front-squad-line">带去的人合计战力 {squadPower(state, { ...front, squad: picked })}</p>}
        </div>
      )}
      <footer className="front-actions">
        <span className="front-remaining"><Clock3 size={12} />{remaining > 0 ? `还有 ${remaining} 分钟` : '时间到了，随时会打完'}</span>
        <button type="button" id="front-commit" className="front-commit" disabled={Boolean(side) && picked.length === 0} onClick={() => { if (side) onJoin(side, picked); onClose(); }}>{side ? '出发' : '观望到底'}</button>
        <button type="button" id="front-close" className="front-close" onClick={onClose}><X size={12} />关闭</button>
      </footer>
      <p className="front-hint">当前：{frontLabel(front)}。</p>
    </div>
  );
}
