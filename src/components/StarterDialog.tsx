import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Search, Star, UserRoundPlus, Users, X } from 'lucide-react';
import type { FactionGirl, FactionId, FactionLeader, FactionRoster, GameState } from '../types';
import { factionInfo } from '../content/items';
import { FACTION_ORDER } from '../territories';
import { customGirlOf, customLeaderOf, defaultFactionRoster, factionTagColor, factionTagLabel, type RosterSubject } from '../factions';
import { loadCardBox, type CardBoxEntry } from '../cardbox';
import { rosterPool } from '../roster';
import { GirlPortrait } from './GirlPortrait';

interface StarterDialogProps {
  state: GameState;
  onConfirm: (
    girlIds: string[],
    roster: Record<FactionId, FactionRoster>,
    custom: { leaders: FactionLeader[]; girls: FactionGirl[] },
  ) => void;
  onAddCard: () => void;
  onAddCustom: () => void;
  onClose: () => void;
}

const STARTER_DEFAULT = ['yue', 'tang', 'ling', 'wu'];
const MEMBER_LIMIT = 4;

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

type SourceFilter = 'all' | 'native' | 'custom';

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

  /** 三方名册的可选池：原属阵容 + 已编进来的自定义少女 + 契约卡库 + 名册里的自定义少女。 */
  const [library, setLibrary] = useState<CardBoxEntry[]>([]);
  useEffect(() => { void loadCardBox().then(setLibrary).catch(() => setLibrary([])); }, []);
  const pool = useMemo<RosterSubject[]>(() => rosterPool(state, library), [state, library]);

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
  const [source, setSource] = useState<SourceFilter>('all');
  const [query, setQuery] = useState('');

  const toggle = (id: string) => {
    setPicked(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 6 ? current : [...current, id]);
  };

  const seatOf = (id: string): { faction: FactionId; role: 'leader' | 'member' } | undefined => {
    for (const faction of FACTION_ORDER) {
      if (roster[faction].leaderId === id) return { faction, role: 'leader' };
      if (roster[faction].memberIds.includes(id)) return { faction, role: 'member' };
    }
    return undefined;
  };

  const setLeader = (faction: FactionId, subject: RosterSubject) => {
    setRoster(current => {
      const next = structuredClone(current) as Record<FactionId, FactionRoster>;
      // 一个人只能坐一个位置：先把她在别处的座位清掉。
      for (const key of FACTION_ORDER) {
        if (next[key].leaderId === subject.id) next[key].leaderId = defaultFactionRoster()[key].leaderId;
        next[key].memberIds = next[key].memberIds.filter(id => id !== subject.id);
      }
      next[faction].leaderId = subject.id;
      if (next[faction].memberIds.length === 0) {
        const fallback = roster[faction].leaderId;
        if (fallback && fallback !== subject.id) next[faction].memberIds = [fallback];
      }
      return next;
    });
    setPicked(current => current.filter(id => id !== subject.id));
  };

  const toggleMember = (faction: FactionId, subject: RosterSubject) => {
    const seat = seatOf(subject.id);
    setRoster(current => {
      const next = structuredClone(current) as Record<FactionId, FactionRoster>;
      if (seat) {
        for (const key of FACTION_ORDER) next[key].memberIds = next[key].memberIds.filter(id => id !== subject.id);
        return next;
      }
      if (next[faction].memberIds.length >= MEMBER_LIMIT) return current;
      next[faction].memberIds = [...next[faction].memberIds, subject.id];
      return next;
    });
    if (!seat) setPicked(current => current.filter(id => id !== subject.id));
  };

  const visibleSubjects = useMemo(() => {
    const keyword = query.trim();
    return pool.filter(subject => {
      if (source === 'native' && subject.origin === 'custom') return false;
      if (source === 'custom' && subject.origin !== 'custom') return false;
      if (!keyword) return true;
      return subject.name.includes(keyword) || subject.title.includes(keyword);
    });
  }, [pool, source, query]);

  const poolLeaderIds = new Set(FACTION_ORDER.map(faction => roster[faction].leaderId));
  const legal = picked.length >= 4 && picked.length <= 6
    && poolLeaderIds.size === 3
    && FACTION_ORDER.every(faction => roster[faction].memberIds.length >= 1 && roster[faction].memberIds.length <= MEMBER_LIMIT)
    && FACTION_ORDER.every(faction => !roster[faction].memberIds.includes(roster[faction].leaderId));

  const confirm = () => {
    const leaders: FactionLeader[] = [];
    const girls: FactionGirl[] = [];
    for (const faction of FACTION_ORDER) {
      const leaderId = roster[faction].leaderId;
      const leaderSubject = pool.find(subject => subject.id === leaderId);
      if (leaderSubject && leaderSubject.origin === 'custom') leaders.push(customLeaderOf(faction, leaderSubject));
      for (const id of roster[faction].memberIds) {
        const subject = pool.find(item => item.id === id);
        if (subject && subject.origin === 'custom') girls.push(customGirlOf(faction, subject));
      }
    }
    onConfirm(picked, roster, { leaders, girls });
  };

  const rosterOf = (faction: FactionId) => {
    const leaderId = roster[faction].leaderId;
    const leader = pool.find(subject => subject.id === leaderId);
    const members = roster[faction].memberIds
      .map(id => pool.find(subject => subject.id === id))
      .filter((subject): subject is RosterSubject => Boolean(subject));
    return { leader, members };
  };

  return (
    <div className="starter-dialog" id="starter-dialog" role="dialog" aria-label="开局编成">
      <div className="starter-sheet">
      <header className="starter-head">
        <div>
          <span className="starter-kicker">开局编成</span>
          <h2>先把人和位置定下来</h2>
          <p>挑 4–6 位少女签进事务所，再把三方阵营的首领与随从点好。首领和随从都可以用你自己带来的少女，之后改动只能在档案页里一个个谈。</p>
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
              <button id="starter-add-card" type="button" className="btn ghost" onClick={onAddCard}><UserRoundPlus size={13} />从契约卡库添加</button>
              <button id="starter-add-custom" type="button" className="btn ghost" onClick={onAddCustom}>现场登记一位</button>
              <button id="starter-default" type="button" className="btn ghost" onClick={() => setPicked(STARTER_DEFAULT.filter(id => state.girls.some(girl => girl.id === id)))}>恢复默认四人</button>
              <button id="starter-reset-roster" type="button" className="btn ghost" onClick={() => setRoster(defaultFactionRoster())}><RotateCcw size={13} />按原属重置阵容</button>
            </div>
          </div>
          <div className="starter-grid">
            {poolPicks.map(pick => {
              const on = picked.includes(pick.id);
              const seat = seatOf(pick.id);
              return (
                <button
                  key={pick.id}
                  id={`starter-card-${pick.id}`}
                  type="button"
                  className={`starter-card ${on ? 'on' : ''} ${seat ? 'seated' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(pick.id)}
                >
                  <span id={`starter-pick-${pick.id}`} className="starter-card-art">
                    <GirlPortrait girl={{ id: pick.id, name: pick.name, color: pick.color, portrait: pick.portrait }} variant="avatar" />
                  </span>
                  <span className="starter-card-copy">
                    <b>{pick.name}</b>
                    <small>Lv.{pick.level} · {pick.source} · {pick.archetype}</small>
                    <span className="starter-card-meta">
                      <span className="starter-tag">{pick.tag}</span>
                      {seat && <span className="starter-seat">{factionInfo[seat.faction].name}·{seat.role === 'leader' ? '首领' : '随从'}</span>}
                    </span>
                  </span>
                  {on && <Check size={16} className="starter-check" />}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="starter-faction">
          <div className="starter-faction-head">
            <div className="starter-faction-leader" id={`starter-leader-slot-${tab}`}>
              <span className="starter-leader-art">
                {(() => {
                  const { leader } = rosterOf(tab);
                  return leader
                    ? <GirlPortrait girl={{ id: leader.id, name: leader.name, color: leader.color, portrait: leader.portrait, portraitSpec: leader.portraitSpec }} variant="avatar" />
                    : <Star size={18} />;
                })()}
              </span>
              <span className="starter-leader-copy">
                <small>首领</small>
                <b id={`starter-leader-name-${tab}`}>{rosterOf(tab).leader?.name ?? '待指派'}</b>
                <em>{rosterOf(tab).leader?.title ?? '点下面的星标来指派'}</em>
              </span>
              <button
                id={`starter-leader-reset-${tab}`}
                type="button"
                className="btn ghost tiny"
                onClick={() => setRoster(current => ({ ...current, [tab]: { ...current[tab], leaderId: defaultFactionRoster()[tab].leaderId } }))}
              >换回原属首领</button>
            </div>
            <div className="starter-faction-meta">
              <span id={`starter-roster-count-${tab}`} className="starter-roster-count">随从 {roster[tab].memberIds.length} / {MEMBER_LIMIT} · 至少 1 人</span>
              <div className="starter-source-filter">
                <button type="button" id="starter-source-all" className={source === 'all' ? 'on' : ''} onClick={() => setSource('all')}>全部</button>
                <button type="button" id="starter-source-native" className={source === 'native' ? 'on' : ''} onClick={() => setSource('native')}>原属</button>
                <button type="button" id="starter-source-custom" className={source === 'custom' ? 'on' : ''} onClick={() => setSource('custom')}>自定义</button>
              </div>
              <label className="starter-search">
                <Search size={13} />
                <input id="starter-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="找人" aria-label="按名字找人" />
              </label>
            </div>
          </div>

          <div className="starter-members" id={`starter-members-${tab}`}>
            {rosterOf(tab).members.length === 0
              ? <span className="starter-members-empty">还没有随从，下面点头像加入。</span>
              : rosterOf(tab).members.map(subject => (
                <button key={subject.id} type="button" className="starter-chip" id={`starter-member-chip-${subject.id}`} onClick={() => toggleMember(tab, subject)}>
                  <GirlPortrait girl={{ id: subject.id, name: subject.name, color: subject.color, portrait: subject.portrait, portraitSpec: subject.portraitSpec }} variant="avatar" />
                  <span>{subject.name}</span>
                  <X size={11} />
                </button>
              ))}
          </div>

          <div className="starter-grid faction" id={`starter-pool-${tab}`}>
            {visibleSubjects.map(subject => {
              const seat = seatOf(subject.id);
              const here = seat?.faction === tab;
              const isLeader = here && seat?.role === 'leader';
              const isMember = here && seat?.role === 'member';
              return (
                <div key={subject.id} className={`starter-tile ${isLeader ? 'leader' : ''} ${isMember ? 'member' : ''} ${seat && !here ? 'elsewhere' : ''}`}>
                  <button
                    id={`starter-subject-${subject.id}`}
                    type="button"
                    className="starter-tile-main"
                    aria-pressed={Boolean(isMember)}
                    onClick={() => toggleMember(tab, subject)}
                  >
                    <span className="starter-tile-art">
                      <GirlPortrait girl={{ id: subject.id, name: subject.name, color: subject.color, portrait: subject.portrait, portraitSpec: subject.portraitSpec }} variant="avatar" />
                    </span>
                    <span className="starter-tile-copy">
                      <b>{subject.name}</b>
                      <small>Lv.{subject.level} · {subject.title}</small>
                      <span className="starter-tile-tag" style={{ borderColor: factionTagColor(subject.faction) }}>
                        {subject.origin === 'custom' ? '自定义' : factionTagLabel(subject.faction)}
                      </span>
                      {seat && (
                        <span className="starter-tile-seat">
                          {isLeader ? '本阵首领' : here ? '本阵随从' : `已任${factionInfo[seat.faction].name}${seat.role === 'leader' ? '首领' : '随从'}`}
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    id={`starter-set-leader-${subject.id}`}
                    type="button"
                    className="starter-tile-star"
                    title={`让${subject.name}当首领`}
                    aria-label={`让${subject.name}当首领`}
                    onClick={() => setLeader(tab, subject)}
                  ><Star size={13} fill={isLeader ? 'currentColor' : 'none'} /></button>
                </div>
              );
            })}
            {visibleSubjects.length === 0 && <p className="starter-pool-empty">没有符合条件的人。</p>}
          </div>
        </section>
      )}

      <footer className="starter-foot">
        <span className={legal ? 'starter-ok' : 'starter-bad'}>
          {legal ? '编成合法，可以确认' : '至少 4 人；每方 1 位首领、1–4 位随从；同一个人不能占两个位置'}
        </span>
        <button id="starter-confirm" type="button" className="btn" disabled={!legal} onClick={confirm}>确认编成</button>
      </footer>
      </div>
    </div>
  );
}
