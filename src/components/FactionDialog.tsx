import { useState } from 'react';
import { BookOpen, ChevronDown, CloudFog, Compass, MoonStar, MapPin, Quote, ScrollText, Users, House, X, ClipboardList } from 'lucide-react';
import type { FactionGirl, FactionId, GameState } from '../types';
import { factionInfo } from '../content/items';
import { hostilityOf, hostilityTier, hostilityTierLabel } from '../hostility';
import {
  factionDossiers,
  factionGirlsOf,
  factionLeader,
  factionPurification,
  factionRelationLine,
  girlFactionLabels,
} from '../factions';
import { factionAttitude } from '../economy';
import { districtOrder, districts } from '../districts';
import { pollutionTierLabel } from '../pollution';
import { representativeOf } from '../office';
import { statLabels } from '../game';
import { GirlPortrait } from './GirlPortrait';

type FactionTab = 'origin' | 'members' | 'city' | 'witch' | 'relations';

const tabs: { id: FactionTab; label: string; icon: typeof ScrollText }[] = [
  { id: 'origin', label: '理念', icon: ScrollText },
  { id: 'members', label: '成员', icon: Users },
  { id: 'city', label: '城市', icon: MapPin },
  { id: 'witch', label: '魔女', icon: MoonStar },
  { id: 'relations', label: '关系', icon: Compass },
];

interface FactionDialogProps {
  state: GameState;
  faction: FactionId;
  onBase: () => void;
  onClose: () => void;
}

/** 一方势力的完整档案：首领在最上面，其余信息按页签分装。 */
export function FactionDialog({ state, faction, onBase, onClose }: FactionDialogProps) {
  const [tab, setTab] = useState<FactionTab>('origin');
  const [openGirl, setOpenGirl] = useState<string>();
  const info = factionInfo[faction];
  const dossier = factionDossiers[faction];
  const leader = factionLeader(faction);
  const girls = factionGirlsOf(faction);
  const standing = state.factions?.[faction]?.standing ?? 0;
  const attitude = factionAttitude(standing);
  const purification = factionPurification(faction).relief;
  const owned = districtOrder.filter(id => state.territories?.[id] === faction);
  const hostilityLines = hostilityOf(state, faction).map(item => ({
    pair: item.pair,
    otherName: factionInfo[item.other].name,
    value: item.track.value,
    tier: hostilityTier(item.track.value),
    reason: item.track.reason,
  }));
  const averagePollution = owned.length
    ? Math.round(owned.reduce((sum, id) => sum + (state.pollution?.[id] ?? 0), 0) / owned.length)
    : 0;
  const envoyDone = Boolean(state.factions?.[faction]?.envoyTaskId);
  const others = (Object.keys(factionInfo) as FactionId[]).filter(id => id !== faction);

  return (
    <div id="faction-dialog" className="faction-dialog" style={{ '--faction-color': dossier.color } as React.CSSProperties}>
      <div className="modal-eyebrow"><BookOpen size={14} />势力档案 / {info.name}</div>

      <header id="faction-leader" className="faction-leader">
        <div id="faction-leader-portrait" className="faction-leader-art">
          <GirlPortrait
            girl={{ id: leader.id, name: leader.name, color: leader.color, portrait: leader.portrait, portraitSpec: leader.portraitSpec }}
            variant="full"
          />
          <span className="faction-leader-seal">{dossier.seal}</span>
        </div>
        <div className="faction-leader-copy">
          <span className="faction-leader-kicker">{info.name} · {leader.title}</span>
          <h2 id="faction-leader-name">{leader.name}</h2>
          <p className="faction-leader-quote"><Quote size={12} /><span>{leader.quote}</span></p>
          <p className="faction-leader-note">{leader.note}</p>
          <div className="faction-leader-facts">
            <span><small>别称</small><b>{dossier.epithet}</b></span>
            <span><small>声望</small><b>{standing}<i>/100</i></b></span>
            <span><small>态度</small><b className={attitude.label === '戒备' ? 'alert' : ''}>{attitude.label}</b></span>
            <span><small>辖区</small><b>{owned.length}<i>块</i></b></span>
            <span><small>额外净化</small><b>{purification > 0 ? `−${purification}` : '无'}</b></span>
            <span><small>所属少女</small><b>{girls.length}<i>人</i></b></span>
          </div>
        </div>
      </header>

      <div className="faction-hostility" id="faction-hostility">
        <p className="faction-hostility-head">两条线上的火气：满 100 就会在街上动手</p>
        {hostilityLines.map(line => (
          <div className={`faction-hostility-row ${line.tier}`} id={`faction-hostility-${line.pair}`} key={line.pair}>
            <span className="faction-hostility-pair">{line.otherName}</span>
            <span className="faction-hostility-meter"><i style={{ width: `${Math.max(3, line.value)}%` }} /></span>
            <span className="faction-hostility-value">{line.value}<small>/100 · {hostilityTierLabel(line.value)}</small></span>
            <span className="faction-hostility-reason">{line.reason}</span>
          </div>
        ))}
      </div>

      <nav className="faction-tabs" role="tablist" aria-label={`${info.name}档案页签`}>
        {tabs.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`faction-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              <Icon size={13} />{item.label}
            </button>
          );
        })}
      </nav>

      <div className="faction-body">
        {tab === 'origin' && (
          <div className="faction-tab-body">
            <div className="faction-rows">
              <div><small>起源</small><p>{dossier.origin}</p></div>
              <div><small>成员构成</small><p>{dossier.membership}</p></div>
              <div><small>手段</small><p>{dossier.method}</p></div>
              <div><small>公开面孔</small><p>{dossier.publicFace}</p></div>
              <div><small>内部矛盾</small><p>{dossier.tension}</p></div>
              <div><small>技术立场 · 量产与抑制剂</small><p>{dossier.technologyStance}</p></div>
            </div>
            <p className="faction-pledge">「{dossier.doctrine}」</p>
          </div>
        )}

        {tab === 'members' && (
          <div className="faction-tab-body">
            <ul className="faction-girl-list">
              {girls.map(girl => (
                <li key={girl.id} className={openGirl === girl.id ? 'open' : ''}>
                  <button id={`faction-girl-${girl.id}`} type="button" className="faction-girl" onClick={() => setOpenGirl(openGirl === girl.id ? undefined : girl.id)}>
                    <span className="faction-girl-art" style={{ '--girl-color': girl.color } as React.CSSProperties}>
                      <GirlPortrait girl={{ id: girl.id, name: girl.name, color: girl.color, portrait: girl.portrait, codename: girl.codename, portraitSpec: girl.portraitSpec }} variant="avatar" />
                    </span>
                    <span className="faction-girl-copy">
                      <b>{girl.name}<i>{girl.codename}</i></b>
                      <small>{girl.title} · Lv.{girl.level}</small>
                      <p>{girl.quote}</p>
                    </span>
                    <span className="faction-girl-tag">{girlFactionLabels[girl.tag]}</span>
                    <ChevronDown size={14} className="faction-girl-chevron" />
                  </button>
                  {openGirl === girl.id && (
                    <div className="faction-girl-detail">
                      <p>{girl.note}</p>
                      <div className="faction-girl-stats">
                        {(['magic', 'insight', 'agility', 'empathy'] as const).map(key => (
                          <span key={key}>{statLabels[key]} <b>{girl.stats[key]}</b></span>
                        ))}
                      </div>
                      <small>她不会进入事务所的契约池；只会在辖区戒备时出面拦截。</small>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            {girls.length === 0 && <p className="faction-empty">这一方目前没有登记在册的所属少女。</p>}
          </div>
        )}

        {tab === 'city' && (
          <div className="faction-tab-body">
            <div className="faction-city-facts">
              <span><small>掌控辖区</small><b>{owned.length}</b></span>
              <span><small>完成委托额外净化</small><b>{purification > 0 ? `−${purification}` : '无'}</b></span>
              <span><small>辖区平均污染</small><b>{averagePollution}<i>{owned.length ? ` · ${pollutionTierLabel(averagePollution)}` : ''}</i></b></span>
              <span><small>货架</small><b>{attitude.discount}</b></span>
            </div>
            <ul className="faction-district-list">
              {owned.map(id => {
                const level = state.pollution?.[id] ?? 0;
                return (
                  <li key={id}>
                    <span><b>{districts[id].name}</b><small>{districts[id].subtitle}</small></span>
                    <span className="faction-district-pollution"><CloudFog size={12} />污染 {level} · {pollutionTierLabel(level)}</span>
                  </li>
                );
              })}
            </ul>
            {owned.length === 0 ? (
              <p className="faction-empty">目前没有辖区。三方每夜会争夺地图上的街区，态度越冷，越容易被别人拿走。</p>
            ) : (
              <p className="faction-note">辖区内完成委托时，这一方会额外净化 {purification > 0 ? `−${purification}` : '0'} 点污染；污染每天自然上升，势力不改这项速度。</p>
            )}
          </div>
        )}

        {tab === 'witch' && (
          <div className="faction-tab-body">
            {dossier.coup && (
              <div id="faction-coup" className="faction-coup">
                <small>内部政变</small>
                <p>{dossier.coup}</p>
              </div>
            )}
            <div className="faction-rows">
              <div><small>对魔女化的定义</small><p>{dossier.witchStance}</p></div>
              <div><small>对普通魔法少女的立场</small><p>{dossier.girlStance}</p></div>
            </div>
            <p className="faction-note">出身只解释她从哪里来、为什么可能不信任某一方；它不改任何数值。</p>
          </div>
        )}

        {tab === 'relations' && (
          <div className="faction-tab-body">
            <div className="faction-rows">
              {others.map(id => (
                <div key={id}>
                  <small>{factionInfo[id].name}</small>
                  <p>{factionRelationLine(faction, id)}</p>
                </div>
              ))}
              <div><small>内部</small><p>{factionRelationLine(faction, faction)}</p></div>
            </div>
            <div className="faction-envoy">
              <ClipboardList size={15} />
              <div>
                <b>{info.envoy} · {info.title}</b>
                <small>{envoyDone ? '今日代表委托已接取' : '来使待命，可在会客厅接取代表委托'}</small>
              </div>
            </div>
            <div className="faction-representative">
              <small>事务所对外代表</small>
              <b>{(() => { const rep = representativeOf(state); return rep ? `${rep.name}（${rep.codename}）` : '尚未任命'; })()}</b>
            </div>
          </div>
        )}
      </div>

      <footer className="faction-foot">
        <button id="faction-go-base" type="button" className="btn ghost" onClick={onBase}><House size={14} />前往会客厅</button>
        <button id="faction-close" type="button" className="btn" onClick={onClose}><X size={14} />关闭</button>
      </footer>
    </div>
  );
}

export type { FactionGirl };
