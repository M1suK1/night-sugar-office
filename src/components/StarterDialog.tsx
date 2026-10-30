import { useMemo, useState } from 'react';
import { Check, RotateCcw, Users, X } from 'lucide-react';
import type { FactionId, FactionRoster, GameState } from '../types';
import { factionInfo } from '../content/items';
import { FACTION_ORDER } from '../territories';
import { allFactionLeaders, defaultFactionRoster, leaderTitle } from '../factions';
import { factionGirls } from '../content/factionGirls';
import { factionTagLabel } from '../factions';
import { GirlPortrait } from './GirlPortrait';

interface StarterDialogProps {
  state: GameState;
  onConfirm: (girlIds: string[], roster: Record<FactionId, FactionRoster>) => void;
  onAddCard: () => void;
  onAddCustom: () => void;
  onClose: () => void;
}

const STARTER_DEFAULT = ['yue', 'tang', 'ling', 'wu'];

interface Pick {
  id: string;
  name: string;
  level: number;
  color: string;
  portrait: string;
  tag: string;
  source: string;
  custom: boolean;
  archetype?: string;
}

/** 开局编成：挑自己的少女，再把三方的首领与随从分配好。 */
export function StarterDialog({ state, onConfirm, onAddCard, onAddCustom, onClose }: StarterDialogProps) {
  const poolPicks = useMemo<Pick[]>(() => {
    const own = state.girls.filter(girl => !girl.dead).map(girl => ({
      id: girl.id, name: girl.name, level: girl.level, color: girl.color, portrait: girl.portrait,
      tag: factionTagLabel(girl.factionTag), source: girl.custom ? '契约卡' : '在编',
      custom: Boolean(girl.custom), archetype: girl.archetype,
    }));
    const cards = state.candidates.filter(girl => girl.custom).map(girl => ({
      id: girl.id, name: girl.name, level: girl.level, color: girl.color, portrait: girl.portrait,
      tag: factionTagLabel(girl.factionTag), source: '契约卡', custom: true, archetype: girl.archetype,
    }));
    const seen = new Set<string>();
    return [...own, ...cards].filter(pick => (seen.has(pick.id) ? false : (seen.add(pick.id), true)));
  }, [state.girls, state.candidates]);

  const [picked, setPicked] = useState<string[]>(() => {
    const ids = STARTER_DEFAULT.filter(id => state.girls.some(girl => girl.id === id && !girl.dead));
    if (ids.length) return ids;
    return state.girls.filter(girl => !girl.dead).slice(0, 4).map(girl => girl.id);
  });
  const [roster, setRoster] = useState<Record<FactionId, FactionRoster>>(() => {
    const saved = state.factionRoster;
    return saved ? structuredClone(saved) : defaultFactionRoster();
  });
  const [tab, setTab] = useState<'own' | FactionId>('own');
  const [leaderHolding, setLeaderHolding] = useState<string>();

  const toggle = (id: string) => {
    setPicked(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 6 ? current : [...current, id]);
  };

  const assignMember = (girlId: string) => {
    setRoster(current => {
      const next = structuredClone(current);
      for (const faction of FACTION_ORDER) {
        if (next[faction].memberIds.includes(girlId)) {
          next[faction].memberIds = next[faction].memberIds.filter(item => item !== girlId);
          return next;
        }
      }
      const target = typeof tab === 'string' && tab !== 'own' ? tab : 'association';
      if (next[target].memberIds.length >= 4) return current;
      next[target].memberIds = [...next[target].memberIds, girlId];
      return next;
    });
  };

  const placeLeader = (faction: FactionId) => {
    if (!leaderHolding) return;
    setRoster(current => {
      const next = structuredClone(current);
      for (const key of FACTION_ORDER) {
        if (next[key].leaderId === leaderHolding) next[key].leaderId = current[faction].leaderId;
      }
      next[faction].leaderId = leaderHolding;
      return next;
    });
    setLeaderHolding(undefined);
  };

  const poolLeaderIds = new Set(FACTION_ORDER.map(faction => roster[faction].leaderId));
  const totalMembers = FACTION_ORDER.reduce((sum, faction) => sum + roster[faction].memberIds.length, 0);
  const legal = picked.length >= 4 && picked.length <= 6
    && poolLeaderIds.size === 3
    && FACTION_ORDER.every(faction => roster[faction].memberIds.length >= 1 && roster[faction].memberIds.length <= 4)
    && totalMembers === factionGirls.length;

  return (
    <div className="starter-dialog" id="starter-dialog" role="dialog" aria-label="开局编成">
      <header className="starter-head">
        <div>
          <span className="starter-kicker">开局编成</span>
          <h2>先把人和位置定下来</h2>
          <p>挑 4–6 位少女签进事务所，再把三方阵营的首领与随从分配好。之后改动只能在档案页里一个个谈。</p>
        </div>
        <button id="starter-close" type="button" className="btn ghost" onClick={onClose}><X size={14} />稍后再说</button>
      </header>

      <nav className="starter-tabs">
        <button id="starter-tab-own" type="button" className={tab === 'own' ? 'on' : ''} onClick={() => setTab('own')}><Users size={14} />你的少女</button>
        {FACTION_ORDER.map(faction => (
          <button key={faction} id={`starter-tab-${faction}`} type="button" className={tab === faction ? 'on' : ''} onClick={() => setTab(faction)}>
            {factionInfo[faction].name}
          </button>
        ))}
      </nav>

      {tab === 'own' ? (
        <section className="starter-own">
          <div className="starter-bar">
            <span id="starter-count">已选 {picked.length} / 6 · 至少 4 人</span>
            <div className="starter-bar-actions">
              <button id="starter-add-card" type="button" className="btn ghost" onClick={onAddCard}>从契约卡库添加</button>
              <button id="starter-add-custom" type="button" className="btn ghost" onClick={onAddCustom}>现场登记一位</button>
              <button id="starter-default" type="button" className="btn ghost" onClick={() => setPicked(STARTER_DEFAULT.filter(id => state.girls.some(girl => girl.id === id)))}>恢复默认四人</button>
              <button id="starter-reset-roster" type="button" className="btn ghost" onClick={() => setRoster(defaultFactionRoster())}><RotateCcw size={13} />按原属重置阵容</button>
            </div>
          </div>
          <div className="starter-grid">
            {poolPicks.map(pick => {
              const on = picked.includes(pick.id);
              return (
                <button
                  key={pick.id}
                  id={`starter-card-${pick.id}`}
                  type="button"
                  className={`starter-card ${on ? 'on' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(pick.id)}
                >
                  <span id={`starter-pick-${pick.id}`} className="starter-card-art">
                    <GirlPortrait girl={{ id: pick.id, name: pick.name, color: pick.color, portrait: pick.portrait }} variant="avatar" />
                  </span>
                  <span className="starter-card-copy">
                    <b>{pick.name}</b>
                    <small>Lv.{pick.level} · {pick.source} · {pick.archetype}</small>
                    <span className="starter-tag">{pick.tag}</span>
                  </span>
                  {on && <Check size={16} className="starter-check" />}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="starter-faction">
          <div className="starter-leader-pool" id="starter-leader-pool">
            {allFactionLeaders.map(leader => {
              const taken = poolLeaderIds.has(leader.id);
              const owner = FACTION_ORDER.find(faction => roster[faction].leaderId === leader.id);
              return (
                <button
                  key={leader.id}
                  id={`starter-leader-pick-${leader.id}`}
                  type="button"
                  className={`starter-leader ${leaderHolding === leader.id ? 'on' : ''} ${taken && leaderHolding ? 'muted' : ''}`}
                  aria-pressed={leaderHolding === leader.id}
                  onClick={() => setLeaderHolding(leaderHolding === leader.id ? undefined : leader.id)}
                >
                  <b>{leader.name}</b>
                  <small>{owner ? `${factionInfo[owner].name} · ${leaderTitle(leader, owner)}` : leaderTitle(leader, leader.origin)}</small>
                </button>
              );
            })}
          </div>

          <div className="starter-slots">
            {FACTION_ORDER.map(faction => {
              const leader = allFactionLeaders.find(item => item.id === roster[faction].leaderId);
              return (
                <div className="starter-slot" key={faction} id={`starter-leader-slot-${faction}`}>
                  <span className="starter-slot-head">{factionInfo[faction].name}</span>
                  <button type="button" className="starter-slot-leader" onClick={() => placeLeader(faction)} disabled={!leaderHolding}>
                    <b>{leader ? leader.name : '待指派'}</b>
                    <small>{leader ? leaderTitle(leader, faction) : '先在上面选一位首领'}</small>
                  </button>
                  <button
                    id={`starter-leader-slot-clear-${faction}`}
                    type="button"
                    className="btn ghost tiny"
                    onClick={() => setRoster(current => ({ ...current, [faction]: { ...current[faction], leaderId: current[faction].leaderId } }))}
                    disabled
                  >清空</button>
                  <div className="starter-roster" id={`starter-roster-${faction}`}>
                    <span id={`starter-roster-count-${faction}`} className="starter-roster-count">随从 {roster[faction].memberIds.length} 人 · 至少 1 人</span>
                    {factionGirls.map(girl => {
                      const here = roster[faction].memberIds.includes(girl.id);
                      const elsewhere = !here && FACTION_ORDER.some(key => roster[key].memberIds.includes(girl.id));
                      return (
                        <button
                          key={girl.id}
                          id={`starter-roster-pick-${girl.id}`}
                          type="button"
                          className={`starter-roster-row ${here ? 'on' : ''}`}
                          onClick={() => { setTab(faction); assignMember(girl.id); }}
                        >
                          <span>{girl.name}</span>
                          <small>{here ? '本阵营' : elsewhere ? '从另方调来' : '未分配'}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <footer className="starter-foot">
        <span className={legal ? 'starter-ok' : 'starter-bad'}>
          {legal ? '编成合法，可以确认' : '至少 4 人、每方 1 位首领与 1–4 位随从，随从合计 9 人'}
        </span>
        <button id="starter-confirm" type="button" className="btn" disabled={!legal} onClick={() => onConfirm(picked, roster)}>确认编成</button>
      </footer>
    </div>
  );
}
