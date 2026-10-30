import { useId, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, BedDouble, BookOpen, Brain, Building2, Cat, Check, ChevronRight, Coins, Compass, Copy, Crosshair, Feather, Flame, Flower2, Heart, HeartPulse, History, House, Info, LockKeyhole, MapPin, MessageCircle, Moon, Phone, Plus, ScrollText, ShieldCheck, Siren, Sparkles, Star, Swords, Syringe, Telescope, Users } from 'lucide-react';
import type { FactionId, GameState, Girl, Room } from '../types';
import { factionInfo, items } from '../content/items';
import { buildCost, drugDaysLeft, inWithdrawal } from '../game';
import { cityStage, corruptionLabels, corruptionMultipliers, corruptionStage, equipmentOf, factionAttitude } from '../economy';
import { EMPLOYER_LABEL, factionTagColor, factionTagLabel } from '../factions';
import { pensionFor } from '../contracts';
import { GirlPortrait } from '../components/GirlPortrait';
import { ClinicPanel } from '../components/ClinicPanel';
import './aux-views.css';

type BaseViewProps = {
  state: GameState;
  onRoom: (id: string) => void;
  onBuild: () => void;
  onGirl: (id: string) => void;
  onTalk: (id: string) => void;
  onStartExpedition: (ids: string[]) => void;
  onRecallExpedition: (id: string) => void;
  onDecide: (id: string, decision: 'accept' | 'defer' | 'reject') => void;
  onAcceptTask: (faction: FactionId) => void;
  onClinic?: (girlId: string, mode: 'treat' | 'wipe' | 'clone', kink?: boolean) => void;
  onCare?: (girlId: string, mode: 'resting') => void;
  onAssistant?: (girlId?: string) => void;
  onUseItem?: (girlId: string, itemId: string) => void;
  onCouncil?: () => void;
  onOffice?: () => void;
};
type RecordsViewProps = { state: GameState; onBattle: (id: string) => void; onBattleNote?: (id: string) => void; onCodex: () => void; onChronicle: () => void; onGirl?: (id: string) => void };
type Metric = 'income' | 'expense' | 'reputation';
type LogKind = GameState['logs'][number]['kind'];

const number = (value: number) => value.toLocaleString('zh-CN');
const hm = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const statusText: Record<Girl['status'], string> = { idle: '闲暇中', mission: '任务执行中', healing: '正在治疗', resting: '正在休息', retired: '已退役', expedition: '星象台远行', left: '已离开' };
const roomIcons = { lounge: Cat, clinic: HeartPulse, dorm: BedDouble, observatory: Telescope };
const metricNames: Record<Metric, string> = { income: '委托收入', expense: '经营支出', reputation: '城市安定度' };
const kindNames: Record<LogKind, string> = { dispatch: '派遣', finance: '收支', story: '故事', care: '照护', base: '基地', battle: '战斗', relationship: '关系', memorial: '悼念', council: '议事', expedition: '远行', clinic: '诊所', incident: '事件', territory: '辖区' };
const kindIcons = { dispatch: Crosshair, finance: Coins, story: MessageCircle, care: HeartPulse, base: House, battle: Swords, relationship: Heart, memorial: Flower2, council: Users, expedition: Telescope, clinic: HeartPulse, incident: AlertTriangle, territory: MapPin };
const outcomeNames = { victory: '战斗胜利', repelled: '暂时击退', defeat: '战斗失败', draw: '僵持收场' } as const;
const factionIds: FactionId[] = ['witch', 'association', 'government'];
const factionEffects: Record<FactionId, string> = {
  witch: '声望 +6 · 城市安定 −2',
  association: '声望 +6 · 城市安定 +2',
  government: '声望 +6 · 城市安定 +1',
};

const demoResolved = [
  { id: 'demo-res-1', day: 12, author: '月见桃', topic: '排班', title: '午夜零点后的巡逻改为双人同行', result: '已批准 · 夜間调查事故率下降，会客厅保留热茶供应。' },
  { id: 'demo-res-2', day: 13, author: '砂糖', topic: '设施', title: '月光诊所增设低温药剂冷藏柜', result: '已批准 · 可安全存放月蚀庭抑制剂与协会净化药剂。' },
];
const demoMinutes = [
  { id: 'demo-min-1', time: '第 14 日 · 19:00', text: '演示纪要：三方势力代表首次同席，月蚀庭要求事务所不得向协会透露魔女化名单。' },
  { id: 'demo-min-2', time: '第 13 日 · 22:30', text: '演示纪要：晚安宿舍确认加装静音结界，每次休息可额外平复 5 点灵魂侵蚀。' },
  { id: 'demo-min-3', time: '第 11 日 · 20:15', text: '演示纪要：星象台校准第 13 号月台残留电波，远行队带回空月周期的初步星图。' },
];

function capacityOf(state: GameState) {
  const dorms = state.rooms.filter(room => room.type === 'dorm');
  return (dorms.length ? dorms : state.rooms).reduce((sum, room) => sum + room.capacity, 0);
}

/** Furniture is an integral part of the floor plan, not an external image. */
function RoomFurniture({ type }: { type: Room['type'] }) {
  return <svg className={`av-furniture av-furniture-${type}`} viewBox="0 0 220 105" fill="none" aria-hidden="true">
    {type === 'lounge' && <>
      <rect x="16" y="28" width="80" height="35" rx="5" /><path d="M23 27v-8h65v8M16 37h80M29 38v23m27-23v23m27-23v23M20 64v7m72-7v7" />
      <rect x="116" y="37" width="47" height="32" rx="9" /><path d="M123 43h33m-27 11h20M138 46v15" />
      <circle cx="140" cy="54" r="4" /><path d="m171 18 7-10 5 11 10 3-6 7 2 11-11-5-9 5 1-12-7-7Z" />
      <path d="M25 84h145m-121 6h91" strokeDasharray="3 5" />
      <rect x="178" y="59" width="24" height="25" rx="2" /><path d="M190 59v-7m-9-9 9 9 9-9m-9 9V37" />
    </>}
    {type === 'clinic' && <>
      <rect x="26" y="17" width="57" height="73" rx="5" /><rect x="33" y="23" width="43" height="16" rx="3" /><path d="M26 48h57M34 54v27m41-27v27M21 22h-5v57h5m67-57h5v57h-5" />
      <rect x="130" y="15" width="56" height="27" rx="2" /><path d="M158 15v27m-14-19v12m-6-6h12m20-6v12m-6-6h12" />
      <circle cx="151" cy="72" r="14" /><path d="M151 62v20m-10-10h20m36-14v27m-8-9h16" />
    </>}
    {type === 'dorm' && <>
      <rect x="20" y="15" width="56" height="75" rx="3" /><rect x="27" y="21" width="42" height="18" rx="3" /><path d="M20 48h56m-48 7v27m40-27v27" />
      <rect x="135" y="15" width="56" height="75" rx="3" /><rect x="142" y="21" width="42" height="18" rx="3" /><path d="M135 48h56m-48 7v27m40-27v27" />
      <rect x="88" y="18" width="34" height="25" rx="2" /><circle cx="105" cy="30" r="6" /><path d="M105 24v6l4 3m-17 32h27m-22-5v20m17-20v20" />
      <path d="m100 79 5-9 5 9 10 1-7 7 2 10-10-5-9 5 2-10-7-7Z" />
    </>}
    {type === 'observatory' && <>
      <circle cx="112" cy="51" r="42" strokeDasharray="3 5" /><circle cx="112" cy="51" r="31" /><path d="m92 37 46-15 7 21-46 15Zm19 17-20 36m20-36 23 36m-23-36v36M76 51h72m-36-36v72" />
      <circle cx="36" cy="24" r="3" /><path d="m33 65 4-8 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6Zm141-41h13m-6-6v13m8 41h13m-6-6v13" />
    </>}
  </svg>;
}

export function BaseView({
  state,
  onRoom,
  onBuild,
  onGirl,
  onTalk,
  onStartExpedition,
  onRecallExpedition,
  onDecide,
  onAcceptTask,
  onClinic,
  onCare,
  onAssistant,
  onUseItem,
  onCouncil,
  onOffice,
}: BaseViewProps) {
  const [selectedId, setSelectedId] = useState(state.rooms[0]?.id ?? 'lounge');
  const [loungeTab, setLoungeTab] = useState<'pending' | 'envoys' | 'resolved' | 'minutes'>('pending');
  const [clinicTab, setClinicTab] = useState<'care' | 'surgery' | 'supplies'>('care');
  const [dormTab, setDormTab] = useState<'rest' | 'capacity'>('rest');
  const [obsTab, setObsTab] = useState<'expedition' | 'logs'>('expedition');
  const [expeditionSquad, setExpeditionSquad] = useState<string[]>([]);

  const present = state.girls.filter(girl => !girl.dead && !girl.retired && girl.status !== 'mission' && girl.status !== 'expedition');
  const active = state.girls.filter(girl => !girl.dead && !girl.retired);
  const away = active.filter(girl => girl.status === 'mission' || girl.status === 'expedition').length;
  const capacity = capacityOf(state);
  const expedition = state.expeditions[0];
  const pendingOpinions = state.opinions.filter(opinion => opinion.status === 'pending');
  const resolvedOpinions = state.opinions.filter(opinion => opinion.status !== 'pending');
  const decision = pendingOpinions[0];
  const assistant = state.girls.find(girl => girl.id === state.assistantId);
  const eligible = state.girls.filter(girl => girl.status === 'idle' && !girl.retired && !inWithdrawal(girl) && girl.id !== state.assistantId && girl.hp >= 30 && girl.fatigue < 80);
  const expeditionMembers = expedition ? expedition.memberIds.map(id => state.girls.find(girl => girl.id === id)).filter((girl): girl is Girl => Boolean(girl)) : [];
  const decisionAuthor = decision ? state.girls.find(girl => girl.id === decision.authorId) : undefined;
  const availableEnvoys = factionIds.filter(id => !state.factions[id].envoyTaskId).length;
  const needCareCount = active.filter(g => g.hp < g.maxHp || g.fatigue >= 45 || (g.corruption ?? 0) >= 35 || inWithdrawal(g)).length;
  const toggleExpedition = (id: string) => setExpeditionSquad(current => current.includes(id) ? current.filter(item => item !== id) : current.length >= 2 ? current : [...current, id]);

  const renderRoomModule = (item: Room) => {
    const Icon = roomIcons[item.type];
    const occupants = present.filter(girl => girl.roomId === item.id);
    const selected = selectedId === item.id;
    const wingLabel = item.type === 'lounge' ? 'NW-01 · 议事与来使模块' : item.type === 'clinic' ? 'NE-02 · 诊疗与重塑模块' : item.type === 'dorm' ? 'SW-03 · 休息与席位模块' : 'SE-04 · 星象与远行模块';
    const badgeLabel = item.type === 'lounge'
      ? `待议 ${pendingOpinions.length} · 代表 ${availableEnvoys}/3`
      : item.type === 'clinic'
        ? `待照护 ${needCareCount} · 抑制剂 ${state.inventory['moon-drug'] ?? 0}`
        : item.type === 'dorm'
          ? `入住 ${active.length}/${capacity} · 降侵蚀`
          : expedition
            ? `观测中 · 第 ${expedition.cyclesDone} 轮`
            : `待出发 · ${eligible.length} 人可选`;

    return (
      <article key={item.id} className={`av-room-tile av-room-module-${item.type} ${selected ? 'av-room-tile-selected' : ''}`} aria-label={`${item.name}模块`}>
        <div className="av-room-head">
          <button
            id={`av-base-room-${item.id}`}
            type="button"
            className="av-room-trigger"
            aria-pressed={selected}
            onClick={() => setSelectedId(item.id)}
          >
            <span className="av-room-title"><Icon size={15} strokeWidth={1.5} />{item.name}<em>Lv.{item.level}</em></span>
            <span className="av-room-number">{wingLabel}</span>
          </button>
          <span className="av-room-badge">{badgeLabel}</span>
          {item.type === 'dorm' ? (
            <button id="av-base-expand" type="button" className="av-btn av-btn-primary av-btn-small av-room-quick-btn" onClick={onBuild}>
              <Plus size={12} />建造与扩建
            </button>
          ) : (
            <button id={`av-room-open-${item.id}`} type="button" className="av-btn av-btn-small av-room-quick-btn" onClick={() => onRoom(item.id)} title={`打开${item.name}独立视窗`}>
              详情<ArrowUpRight size={11} />
            </button>
          )}
        </div>

        <div className="av-room-blueprint">
          <RoomFurniture type={item.type} />
          <p className="av-room-desc">{item.description}</p>
          <div className="av-room-people" aria-label={`${item.name}内的成员`}>
            <small className="av-people-label">驻留成员 ({occupants.length})</small>
            {occupants.length ? occupants.map(girl => (
              <div className="av-map-person-group" key={girl.id}>
                <button
                  id={`av-base-map-girl-${girl.id}`}
                  className="av-map-person"
                  type="button"
                  onClick={() => onGirl(girl.id)}
                  title={`${girl.name} · ${statusText[girl.status]} · 血量 ${girl.hp}/${girl.maxHp}`}
                  aria-label={`查看${girl.name}，${statusText[girl.status]}`}
                >
                  <img className="av-room-avatar" src={girl.portrait} alt="" loading="lazy" />
                  <span>{girl.name}<small>HP {girl.hp} · 蚀 {girl.corruption ?? 0}%</small></span>
                </button>
                <button
                  id={`av-base-talk-${girl.id}`}
                  type="button"
                  className="av-talk-btn"
                  onClick={() => onTalk(girl.id)}
                  aria-label={`与${girl.name}交谈`}
                  title={`与${girl.name}交谈`}
                >
                  <MessageCircle size={13} />
                </button>
              </div>
            )) : <small className="av-room-unoccupied">暂无契约者在此停留</small>}
          </div>
        </div>

        {/* Room-Specific Embedded Functional Console */}
        {item.type === 'lounge' && (
          <div className="av-module-console">
            <div className="av-module-tabs" role="tablist" aria-label="会客厅功能模块">
              <button id="av-lounge-tab-pending" type="button" role="tab" aria-selected={loungeTab === 'pending'} className={loungeTab === 'pending' ? 'active' : ''} onClick={() => setLoungeTab('pending')}>
                待议 ({pendingOpinions.length})
              </button>
              <button id="av-lounge-tab-envoys" type="button" role="tab" aria-selected={loungeTab === 'envoys'} className={loungeTab === 'envoys' ? 'active' : ''} onClick={() => setLoungeTab('envoys')}>
                势力代表 ({availableEnvoys}/3)
              </button>
              <button id="av-lounge-tab-resolved" type="button" role="tab" aria-selected={loungeTab === 'resolved'} className={loungeTab === 'resolved' ? 'active' : ''} onClick={() => setLoungeTab('resolved')}>
                已决 ({resolvedOpinions.length + demoResolved.length})
              </button>
              <button id="av-lounge-tab-minutes" type="button" role="tab" aria-selected={loungeTab === 'minutes'} className={loungeTab === 'minutes' ? 'active' : ''} onClick={() => setLoungeTab('minutes')}>
                会议记录 ({demoMinutes.length})
              </button>
            </div>

            {loungeTab === 'pending' && (
              <div className="av-module-panel">
                <div className="av-module-subbar">
                  <span>值班助理：<b>{assistant ? assistant.name : '未任命'}</b></span>
                  {assistant && <span className="av-assistant-origin" style={{ '--tag-color': factionTagColor(assistant.factionTag) } as React.CSSProperties}><Feather size={10} />{EMPLOYER_LABEL} · 出身{factionTagLabel(assistant.factionTag)}</span>}
                  {onCouncil && <button id="enter-council" type="button" className="av-mini-pill council-enter" onClick={onCouncil}>进入会客厅议事 →</button>}
                  {onAssistant && (
                    <div className="av-assistant-picks">
                      {active.filter(g => g.bond >= 40).map(g => (
                        <button
                          key={g.id}
                          id={`av-lounge-assistant-${g.id}`}
                          type="button"
                          className={`av-mini-pill ${state.assistantId === g.id ? 'active' : ''}`}
                          onClick={() => onAssistant(state.assistantId === g.id ? undefined : g.id)}
                        >
                          {state.assistantId === g.id ? `助理·${g.name}` : `任命${g.name}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {decision ? (
                  <div className="av-opinion">
                    <span className="av-opinion-meta">{decisionAuthor?.name ?? '事务所'} · {decision.topic} · 第 {decision.day} 日</span>
                    <h3>{decision.title}</h3>
                    <p>{decision.text}</p>
                    <div className="av-opinion-request"><MessageCircle size={13} /><span>{decision.request}</span></div>
                    {decision.assistantNote && <small className="av-opinion-note"><Sparkles size={11} />{decision.assistantNote}</small>}
                    <div className="av-opinion-actions">
                      {decision.options.map(option => (
                        <button
                          key={option.id}
                          id={`av-council-${option.id}`}
                          type="button"
                          className={`av-btn av-btn-small ${option.id === 'accept' ? 'av-btn-primary' : ''}`}
                          onClick={() => onDecide(decision.id, option.id)}
                          title={option.effect}
                        >
                          {option.id === 'accept' ? <Check size={12} /> : option.id === 'reject' ? <AlertTriangle size={12} /> : <Compass size={12} />}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="av-op-quiet">
                    <Phone size={16} strokeWidth={1.2} />
                    <p>{assistant ? `会客厅暂时安静。${assistant.name}正在值班，她会在每日议事时带回新的请求。` : '会客厅暂时安静。任命一位值班助理后，她会替你留意城市里的请求。'}</p>
                  </div>
                )}
              </div>
            )}

            {loungeTab === 'envoys' && (
              <div className="av-module-panel">
                <div className="av-envoy-compact-list">
                  {factionIds.map(fid => {
                    const info = factionInfo[fid];
                    const standing = state.factions[fid].standing;
                    const att = factionAttitude(standing);
                    const done = Boolean(state.factions[fid].envoyTaskId);
                    return (
                      <div key={fid} className="av-envoy-row" style={{ '--faction': info.color } as React.CSSProperties}>
                        <span className="av-envoy-seal">{info.short}</span>
                        <div className="av-envoy-copy">
                          <strong>{info.envoy} <small>{info.title} · {info.name}</small></strong>
                          <p>态度：<b>{att.label}</b>（声望 {standing}/100 · {att.discount}） · {factionEffects[fid]}</p>
                        </div>
                        <button
                          id={`av-envoy-accept-${fid}`}
                          type="button"
                          className={`av-btn av-btn-small ${done ? '' : 'av-btn-primary'}`}
                          disabled={done}
                          onClick={() => onAcceptTask(fid)}
                        >
                          {done ? <><Check size={12} />已接取</> : <>接受委托<ArrowUpRight size={12} /></>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {loungeTab === 'resolved' && (
              <div className="av-module-panel av-scroll-panel">
                {resolvedOpinions.map(op => (
                  <div key={op.id} className="av-archive-row">
                    <span>第 {op.day} 日 · {op.topic} · {op.status === 'accepted' ? '已批准' : op.status === 'rejected' ? '已驳回' : '已暂缓'}</span>
                    <strong>{op.title}</strong>
                    <p>{op.request}</p>
                  </div>
                ))}
                {demoResolved.map(item => (
                  <div key={item.id} className="av-archive-row">
                    <span>第 {item.day} 日 · {item.topic} · 演示议题</span>
                    <strong>{item.title}（提议：{item.author}）</strong>
                    <p>{item.result}</p>
                  </div>
                ))}
              </div>
            )}

            {loungeTab === 'minutes' && (
              <div className="av-module-panel av-scroll-panel">
                {demoMinutes.map(m => (
                  <div key={m.id} className="av-archive-row">
                    <span>{m.time} · 演示议题</span>
                    <p>{m.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {item.type === 'clinic' && (
          <div className="av-module-console">
            <div className="av-module-tabs" role="tablist" aria-label="月光诊所功能模块">
              <button id="av-clinic-tab-care" type="button" role="tab" aria-selected={clinicTab === 'care'} className={clinicTab === 'care' ? 'active' : ''} onClick={() => setClinicTab('care')}>
                治疗
              </button>
              <button id="av-clinic-tab-surgery" type="button" role="tab" aria-selected={clinicTab === 'surgery'} className={clinicTab === 'surgery' ? 'active' : ''} onClick={() => setClinicTab('surgery')}>
                记忆重塑与复制
              </button>
              <button id="av-clinic-tab-supplies" type="button" role="tab" aria-selected={clinicTab === 'supplies'} className={clinicTab === 'supplies' ? 'active' : ''} onClick={() => setClinicTab('supplies')}>
                抑制剂与净化 ({(state.inventory['moon-drug'] ?? 0) + (state.inventory['purify-course'] ?? 0)})
              </button>
            </div>

            {clinicTab === 'care' && (
              <div className="av-module-panel">
                <p className="av-module-hint">按缺失血量收费，按小时线性恢复；治疗期间不能出勤，也不会恢复疲劳（疲劳归宿舍）。只列出受伤的契约者。</p>
                <ClinicPanel
                  state={state}
                  girls={active}
                  onGirl={id => onGirl?.(id)}
                  onTreat={(girlId, kink) => onClinic?.(girlId, 'treat', kink)}
                />
              </div>
            )}

            {clinicTab === 'surgery' && (
              <div className="av-module-panel">
                <p className="av-module-hint">记忆重塑 4,000 星砂（抹除精神疤痕，等级与关系归初）；复制契约 18,000 星砂（Lv.3+ 生成 1 级镜像复制体）。</p>
                <div className="girl-card-grid">
                  {active.map(g => (
                    <article key={g.id} className="girl-card">
                      <div className="girl-card-face"><GirlPortrait girl={g} variant="avatar" /></div>
                      <div className="girl-card-body">
                        <strong>{g.name} <small>Lv.{g.level}</small></strong>
                        <span>疤痕 {g.scars.length}/5 · {g.cloneOf ? '复制体' : '原体'} · 羁绊 {g.bond}</span>
                        <div className="girl-card-actions">
                          <button
                            id={`av-clinic-wipe-${g.id}`}
                            type="button"
                            className="av-btn av-btn-small"
                            disabled={state.gold < 4000 || g.status !== 'idle' || !onClinic}
                            onClick={() => onClinic?.(g.id, 'wipe')}
                          >
                            <Brain size={11} />重塑 4,000
                          </button>
                          <button
                            id={`av-clinic-clone-${g.id}`}
                            type="button"
                            className="av-btn av-btn-small"
                            disabled={state.gold < 18000 || g.level < 3 || Boolean(g.cloneOf) || !onClinic}
                            onClick={() => onClinic?.(g.id, 'clone')}
                          >
                            <Copy size={11} />复制 18,000
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {clinicTab === 'supplies' && (
              <div className="av-module-panel">
                <p className="av-module-hint">月蚀抑制剂库存：{state.inventory['moon-drug'] ?? 0} 支 · 净化课程：{state.inventory['purify-course'] ?? 0} 份 · 星灯治疗包：{state.inventory['star-kit'] ?? 0} 份。</p>
                <div className="girl-card-grid">
                  {active.map(g => (
                    <article key={g.id} className="girl-card">
                      <div className="girl-card-face"><GirlPortrait girl={g} variant="avatar" /></div>
                      <div className="girl-card-body">
                        <strong>{g.name} <small>{g.witch ? (inWithdrawal(g) ? `断药第 ${g.withdrawalDays} 日` : `药效余 ${drugDaysLeft(g, state.day)} 日`) : `侵蚀 ${g.corruption ?? 0}%`}</small></strong>
                        <span>阶段：{corruptionLabels[corruptionStage(g.corruption ?? 0)]}</span>
                        <div className="girl-card-actions">
                          <button
                            id={`av-clinic-drug-${g.id}`}
                            type="button"
                            className="av-btn av-btn-small"
                            disabled={!g.witch || !(state.inventory['moon-drug'] > 0) || !onUseItem}
                            onClick={() => onUseItem?.(g.id, 'moon-drug')}
                          >
                            <Syringe size={11} />注射抑制剂
                          </button>
                          <button
                            id={`av-clinic-purify-${g.id}`}
                            type="button"
                            className="av-btn av-btn-small"
                            disabled={(g.corruption ?? 0) <= 0 || !(state.inventory['purify-course'] > 0) || !onUseItem}
                            onClick={() => onUseItem?.(g.id, 'purify-course')}
                          >
                            <Sparkles size={11} />净化 −8
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {item.type === 'dorm' && (
          <div className="av-module-console">
            <div className="av-module-tabs" role="tablist" aria-label="晚安宿舍功能模块">
              <button id="av-dorm-tab-rest" type="button" role="tab" aria-selected={dormTab === 'rest'} className={dormTab === 'rest' ? 'active' : ''} onClick={() => setDormTab('rest')}>
                降侵蚀休息
              </button>
              <button id="av-dorm-tab-capacity" type="button" role="tab" aria-selected={dormTab === 'capacity'} className={dormTab === 'capacity' ? 'active' : ''} onClick={() => setDormTab('capacity')}>
                契约床位 ({active.length}/{capacity})
              </button>
            </div>

            {dormTab === 'rest' && (
              <div className="av-module-panel">
                <p className="av-module-hint">在晚安宿舍休息 90 分钟可恢复 60 点疲劳并平复 5 点灵魂侵蚀度（免费）。</p>
                <div className="girl-card-grid">
                  {active.map(g => (
                    <article key={g.id} className="girl-card">
                      <div className="girl-card-face"><GirlPortrait girl={g} variant="avatar" /></div>
                      <div className="girl-card-body">
                        <strong>{g.name} <small>{statusText[g.status]}</small></strong>
                        <span>疲劳 {g.fatigue}/100 · 侵蚀 {g.corruption ?? 0}%</span>
                        <div className="girl-card-actions">
                          <button
                            id={`av-dorm-rest-${g.id}`}
                            type="button"
                            className="av-btn av-btn-small"
                            disabled={g.status !== 'idle' || (g.fatigue === 0 && (g.corruption ?? 0) === 0) || !onCare}
                            onClick={() => onCare?.(g.id, 'resting')}
                          >
                            <Moon size={11} />安排休息
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {dormTab === 'capacity' && (
              <div className="av-module-panel">
                <div className="av-dorm-summary">
                  <div><span>当前床位容量</span><strong>{active.length} / {capacity} 席</strong></div>
                  <div><span>扩建费用</span><strong>{number(buildCost(item))} 星砂</strong></div>
                  <div><span>退役文职成员</span><strong>{state.girls.filter(g => g.retired).length} 人（不占床位）</strong></div>
                </div>
                <p className="av-module-hint">每次扩建晚安宿舍可增加 2 个契约席位（最高 4 级），供市场招募或诊所复制体入住。</p>
              </div>
            )}
          </div>
        )}

        {item.type === 'observatory' && (
          <div className="av-module-console">
            <div className="av-module-tabs" role="tablist" aria-label="星象台功能模块">
              <button id="av-obs-tab-expedition" type="button" role="tab" aria-selected={obsTab === 'expedition'} className={obsTab === 'expedition' ? 'active' : ''} onClick={() => setObsTab('expedition')}>
                远行观测 ({expedition ? '进行中' : '可出发'})
              </button>
              <button id="av-obs-tab-logs" type="button" role="tab" aria-selected={obsTab === 'logs'} className={obsTab === 'logs' ? 'active' : ''} onClick={() => setObsTab('logs')}>
                星象记录
              </button>
            </div>

            {obsTab === 'expedition' && (
              <div className="av-module-panel">
                {expedition ? (
                  <div className="av-exp-active">
                    <div className="av-exp-members">
                      {expeditionMembers.map(girl => (
                        <button key={girl.id} id={`av-exp-member-${girl.id}`} type="button" className="av-exp-member" onClick={() => onGirl(girl.id)}>
                          <img src={girl.portrait} alt="" loading="lazy" />
                          <span>{girl.name}<small>{statusText[girl.status]} · 疲劳 {girl.fatigue}</small></span>
                        </button>
                      ))}
                    </div>
                    <p><Compass size={13} />已观测 {expedition.cyclesDone} 轮。每 60 分钟结算 60–180 星砂，疲劳达 95 自动返程。</p>
                    <button id="av-expedition-recall" type="button" className="av-btn av-btn-small" onClick={() => onRecallExpedition(expedition.id)}>
                      召回队伍 · 未结算的一轮作废
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="av-module-hint">派 1–2 名待命成员进入星象台远行，每小时带回 60–180 星砂与见闻（断药期不可参加）。</p>
                    <div className="av-exp-roster" role="group" aria-label="选择远行成员">
                      {eligible.length ? eligible.map(girl => (
                        <button
                          key={girl.id}
                          id={`av-expedition-pick-${girl.id}`}
                          type="button"
                          className="av-exp-pick"
                          aria-pressed={expeditionSquad.includes(girl.id)}
                          onClick={() => toggleExpedition(girl.id)}
                        >
                          <img src={girl.portrait} alt="" loading="lazy" />
                          <span>{girl.name}<small>Lv.{girl.level} · 疲劳 {girl.fatigue}</small></span>
                          {expeditionSquad.includes(girl.id) && <Check size={13} />}
                        </button>
                      )) : <small className="av-op-empty">没有可出发的成员。让她们先休息，或结束当前派遣。</small>}
                    </div>
                    <button
                      id="av-expedition-start"
                      type="button"
                      className="av-btn av-btn-primary av-btn-small"
                      disabled={!expeditionSquad.length}
                      onClick={() => { onStartExpedition(expeditionSquad); setExpeditionSquad([]); }}
                    >
                      <Compass size={13} />组建远行队 · 已选 {expeditionSquad.length} / 2
                    </button>
                  </>
                )}
              </div>
            )}

            {obsTab === 'logs' && (
              <div className="av-module-panel av-scroll-panel">
                {state.logs.filter(l => l.kind === 'expedition').slice(0, 5).map(l => (
                  <div key={l.id} className="av-archive-row">
                    <span>{l.time} · 星象远行</span>
                    <p>{l.text}</p>
                  </div>
                ))}
                {!state.logs.some(l => l.kind === 'expedition') && (
                  <div className="av-archive-row">
                    <span>星象台说明 · 等级 {item.level}</span>
                    <p>远行观测按 60 分钟周期自动记入行动手记，并有概率让契约者觉醒新的性格特性。</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="av-view av-base-view" aria-labelledby="av-base-title">
      <header className="av-heading">
        <div>
          <p className="av-eyebrow"><House size={12} />夜糖事务所 · 基地平面图总控</p>
          <h1 id="av-base-title">灯火为你而留</h1>
          <p>所有基地设施功能（会客厅议事与三方来使、月光诊所治疗/重塑/复制、晚安宿舍降侵蚀休息与扩建、星象台远行）均已集成于下方平面图对应房间模块内。</p>
        </div>
        <div className="av-heading-side">
          <div className="av-heading-meta">
            <Users size={14} />
            <span>在职契约</span>
            <strong>{active.length}<span className="av-capacity-denominator"> / {capacity}</span></strong>
          </div>
          {onOffice && (
            <button id="open-office-profile" type="button" className="av-btn av-btn-small av-office-enter" onClick={onOffice}>
              <Building2 size={12} />事务所档案
            </button>
          )}
        </div>
      </header>

      <div className="av-floorplan av-floorplan-integrated">
        <div className="av-floor-topline">
          <span><span className="av-live-dot" />基地建筑平面图 · 设施功能内嵌总控</span>
          <div className="av-floor-badges">
            <span>会客厅：待议 {pendingOpinions.length} / 来使 {availableEnvoys}</span>
            <span>诊所：待护 {needCareCount}</span>
            <span>宿舍：席位 {active.length}/{capacity}</span>
            <span>星象台：{expedition ? `观测第 ${expedition.cyclesDone} 轮` : '可派远行'}</span>
          </div>
          <span>月见街 17 号 · 二层</span>
        </div>

        <div className="av-room-grid av-room-grid-integrated">
          {state.rooms.slice(0, 2).map(renderRoomModule)}
          <div className="av-corridor">
            <span>✦ 星屑回廊 · 灵魂澄明监测线 · 在基地 {present.length} 人 / 外勤与远行 {away} 人 ✦</span>
            <Star size={11} strokeWidth={1.2} />
          </div>
          {state.rooms.slice(2).map(renderRoomModule)}
        </div>

        <div className="av-floor-bottomline">
          <span><Info size={11} />点击任意房间模块内的功能标签即可直接办理议事、接待来使、手术重塑、降侵蚀休息或组建星象远行</span>
          <span className="av-floor-scale">比例尺 · 5 米</span>
        </div>
      </div>
    </section>
  );
}

export { MarketView } from './MarketView';

function RecordsChart({ state, range, metric }: { state: GameState; range: number; metric: Metric }) {
  const gradientId = `av-record-gradient-${useId().replace(/:/g, '')}`;
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const samples = useMemo(() => state.samples.filter(sample => sample.day >= Math.max(1, state.day - range + 1)).slice(-range), [state.samples, state.day, range]);
  const width = 760, height = 220, left = 47, right = 19, top = 16, bottom = 35;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(4, ...samples.map(sample => sample[metric]));
  const tick = Math.max(1, Math.ceil(maxValue / 4));
  const ceiling = tick * 4;
  const points = samples.map((sample, index) => ({ ...sample, x: samples.length > 1 ? left + index * (width - left - right) / (samples.length - 1) : (width + left - right) / 2, y: top + chartHeight * (1 - sample[metric] / ceiling) }));
  const active = points.find(point => point.day === activeDay) ?? points.at(-1);
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const areaPath = points.length ? `${linePath} L${points.at(-1)!.x},${height - bottom} L${points[0].x},${height - bottom} Z` : '';
  const latest = points.at(-1)?.[metric] ?? 0;
  return <>
    <div className="av-chart-metric"><strong>{number(latest)}</strong><span>{metric === 'reputation' ? '安定度' : '星砂'} · 最近一日</span></div>
    {points.length ? (
      <div className="av-chart-wrap">
        <svg className="av-chart-svg" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`最近${range}天${metricNames[metric]}折线图。可使用制表键查看每日数据。`}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f49abd" stopOpacity=".24" />
              <stop offset="100%" stopColor="#f49abd" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map(index => {
            const y = top + chartHeight * index / 4;
            return (
              <g key={index}>
                <line className="av-chart-grid" x1={left} y1={y} x2={width - right} y2={y} />
                <text x={left - 12} y={y + 3} textAnchor="end">{number(ceiling - index * tick)}</text>
              </g>
            );
          })}
          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path className="av-chart-line" d={linePath} />
          {active && <line className="av-chart-selected-line" x1={active.x} y1={top} x2={active.x} y2={height - bottom} />}
          {points.map((point, index) => (
            <g key={point.day}>
              <g
                id={`av-record-point-${metric}-day-${point.day}`}
                className="av-chart-point"
                role="button"
                tabIndex={0}
                aria-label={`第${point.day}天，${metricNames[metric]}${point[metric]}${metric === 'reputation' ? '点' : '星砂'}`}
                data-active={active?.day === point.day}
                onMouseEnter={() => setActiveDay(point.day)}
                onFocus={() => setActiveDay(point.day)}
                onClick={() => setActiveDay(point.day)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveDay(point.day);
                  }
                }}
              >
                <circle cx={point.x} cy={point.y} r="14" fill="transparent" />
                <circle className="av-chart-point-dot" cx={point.x} cy={point.y} r="3.5" />
                <title>第{point.day}天：{metricNames[metric]} {number(point[metric])}</title>
              </g>
              {(samples.length <= 7 || index % 2 === 0 || index === samples.length - 1) && (
                <text x={point.x} y={height - 10} textAnchor="middle">第{point.day}天</text>
              )}
            </g>
          ))}
        </svg>
        <div className="av-chart-tooltip" aria-live="polite">
          {active && (
            <>
              <span className="av-tooltip-dot" />
              <span>第 {active.day} 天</span>
              <span>{metricNames[metric]}</span>
              <strong>{number(active[metric])}</strong>
              <span>{metric === 'reputation' ? '点' : '星砂'}</span>
            </>
          )}
        </div>
      </div>
    ) : <div className="av-empty">暂无轨迹样本</div>}
  </>;
}

export function RecordsView({ state, onBattle, onBattleNote, onCodex, onChronicle, onGirl }: RecordsViewProps) {
  const [range, setRange] = useState(7);
  const [metric, setMetric] = useState<Metric>('income');
  const [kind, setKind] = useState<'all' | LogKind>('all');
  const [visibleCount, setVisibleCount] = useState(8);
  const totals = useMemo(() => state.samples.reduce((sum, sample) => ({ income: sum.income + sample.income, expense: sum.expense + sample.expense }), { income: 0, expense: 0 }), [state.samples]);
  const logs = state.logs.filter(log => kind === 'all' || log.kind === kind);
  const stage = cityStage(state.reputation);
  const retiredGirls = state.girls.filter(g => g.retired);
  const totalPension = retiredGirls.reduce((sum, g) => sum + pensionFor(g), 0);
  const inventoryEntries = items.filter(it => (state.inventory[it.id] ?? 0) > 0);

  return (
    <section className="av-view av-records-view" aria-labelledby="av-records-title">
      <header className="av-heading">
        <div>
          <p className="av-eyebrow"><History size={12} />事务所档案 · 因果与经营台账 (PLAN-V4)</p>
          <h1 id="av-records-title">每个选择，都有回响</h1>
          <p>收支轨迹、城市安定度与周期天灾、三方势力态度与货架配给、契约者灵魂侵蚀与魔女抑制剂监测。</p>
        </div>
        <div className="av-heading-meta">
          <span className="av-live-dot" />
          <span>记录至第 {state.day} 日 · 市场 Lv.{state.marketLevel}</span>
        </div>
      </header>

      <div className="av-record-summary av-record-summary-v4">
        <div className="av-record-stat">
          <span><ArrowDownLeft size={13} />记录期委托收入</span>
          <strong>{number(totals.income)}</strong>
          <small>星砂 · 每日委托与远行汇总</small>
        </div>
        <div className="av-record-stat">
          <span><ArrowUpRight size={13} />记录期经营支出</span>
          <strong>{number(totals.expense)}</strong>
          <small>星砂 · 契约、物资、诊疗与扩建</small>
        </div>
        <div className="av-record-stat">
          <span><Star size={13} />当前星砂与退休金压力</span>
          <strong>{number(state.gold)}</strong>
          <small>退役 {retiredGirls.length} 人（{number(totalPension)}/10日） · 欠缴 {number(state.pensionDebt)}</small>
        </div>
        <div className="av-record-stat">
          <span><ShieldCheck size={13} />城市安定度 · {stage.name}</span>
          <strong>{state.reputation}<small> / 100</small></strong>
          <small>{state.boss ? '天灾「空月」在场（每3小时−1安定）' : `下次周期 Boss：第 ${state.nextBossDay} 日 21:00`}</small>
        </div>
      </div>

      <section className="av-record-chart-panel" aria-labelledby="av-chart-title">
        <div className="av-chart-header">
          <h2 id="av-chart-title">经营与安定轨迹</h2>
          <div className="av-chart-controls">
            <div className="av-filters" aria-label="图表指标">
              {(['income', 'expense', 'reputation'] as const).map(value => (
                <button id={`av-record-metric-${value}`} className="av-filter" type="button" key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}>
                  {metricNames[value]}
                </button>
              ))}
            </div>
            <label className="av-visually-hidden" htmlFor="av-record-range">图表时间范围</label>
            <select id="av-record-range" className="av-select" value={range} onChange={event => setRange(Number(event.target.value))}>
              <option value={7}>最近 7 天</option>
              <option value={14}>最近 14 天</option>
            </select>
          </div>
        </div>
        <RecordsChart state={state} metric={metric} range={range} />
      </section>

      {/* Plan-v4 Section: Three Factions Attitude & Supply Archive */}
      <section className="av-v4-ledger-section" aria-labelledby="av-record-faction-title">
        <div className="av-log-head">
          <h2 id="av-record-faction-title"><Sparkles size={14} />三方势力态度与物资配给档案<small>市场 Lv.{state.marketLevel} · 仓库存货 {inventoryEntries.reduce((s, i) => s + (state.inventory[i.id] ?? 0), 0)} 件</small></h2>
        </div>
        <div className="av-record-faction-grid">
          {factionIds.map(fid => {
            const info = factionInfo[fid];
            const standing = state.factions[fid].standing;
            const att = factionAttitude(standing);
            const factionItems = items.filter(it => it.faction === fid);
            const unlockedCount = factionItems.filter(it => standing >= it.standingReq).length;
            const taskDone = Boolean(state.factions[fid].envoyTaskId);
            return (
              <article key={fid} className="av-record-faction-card" style={{ '--faction': info.color } as React.CSSProperties}>
                <header>
                  <span className="av-envoy-seal">{info.short}</span>
                  <div>
                    <h3>{info.name}</h3>
                    <small>代表：{info.envoy}（{info.title}）</small>
                  </div>
                  <span className={`av-attitude-badge tone-${att.tone}`}>{att.label} · {att.discount}</span>
                </header>
                <div className="av-faction-meter">
                  <span>声望 <b>{standing}</b> / 100</span>
                  <i><b style={{ width: `${Math.min(100, standing)}%` }} /></i>
                </div>
                <p className="av-faction-meta">
                  <span>今日代表委托：<b>{taskDone ? '已接取' : '待接取'}</b>（{factionEffects[fid]}）</span>
                  <span>已解锁货架：<b>{unlockedCount} / {factionItems.length}</b> 项</span>
                </p>
                <div className="av-faction-shelf-tags">
                  {factionItems.map(it => {
                    const unlocked = standing >= it.standingReq;
                    const stock = state.inventory[it.id] ?? 0;
                    return (
                      <span key={it.id} className={`av-shelf-chip ${unlocked ? 'unlocked' : 'locked'}`} title={`${it.name}（需声望 ${it.standingReq}）· ${it.description}`}>
                        {it.name} {stock > 0 ? `×${stock}` : unlocked ? '可购' : `需${it.standingReq}`}
                      </span>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Plan-v4 Section: Soul Gem Corruption, Witch Drug & Contract Ledger */}
      <section className="av-v4-ledger-section" aria-labelledby="av-record-soul-title">
        <div className="av-log-head">
          <h2 id="av-record-soul-title"><Flame size={14} />灵魂宝石侵蚀与契约监理台账<small>契约者 {state.girls.length} 名 · 抑制剂库存 {state.inventory['moon-drug'] ?? 0} 支</small></h2>
          {state.boss && <span className="av-boss-record-flag"><Siren size={12} />周期 Boss「空月」在场</span>}
        </div>
        <div className="av-soul-ledger-grid">
          {state.girls.map(g => {
            const cStage = corruptionStage(g.corruption ?? 0);
            const mult = corruptionMultipliers(g.corruption ?? 0);
            const eq = equipmentOf(g);
            const wardrobe = g.wardrobe?.find(o => o.id === g.outfitId);
            const drugLeft = drugDaysLeft(g, state.day);
            const withdrawing = inWithdrawal(g);
            return (
              <button
                key={g.id}
                id={`av-record-girl-${g.id}`}
                type="button"
                className={`av-soul-card ${g.witch ? 'is-witch' : ''} ${g.retired ? 'is-retired' : ''}`}
                onClick={() => onGirl?.(g.id)}
              >
                <div className="av-soul-head">
                  <GirlPortrait girl={g} variant="avatar" />
                  <div>
                    <strong>{g.name} <small>Lv.{g.level} · {g.codename}</small></strong>
                    <span>{g.retired ? `已退役（退休金 ${pensionFor(g)}/10日 · 欠缴 ${g.pensionMissed}）` : `${statusText[g.status]} · 契约余 ${Math.max(0, g.contractEndDay - state.day)} 日`}</span>
                  </div>
                  <span className={`av-corruption-pill stage-${cStage}`}>
                    {corruptionLabels[cStage]} · {g.corruption ?? 0}%
                  </span>
                </div>
                <div className="av-soul-bar">
                  <i><b style={{ width: `${Math.min(100, g.corruption ?? 0)}%` }} /></i>
                </div>
                <div className="av-soul-meta">
                  <span>修正：{cStage === 0 ? '共情 100% / 其余 100%' : `共情 ${Math.round((mult.empathy - 1) * 100)}% / 其余 +${Math.round((mult.other - 1) * 100)}%`}</span>
                  <span>装束：{wardrobe?.name ?? '制服'} · {eq.length ? eq.map(e => e.name).join(' + ') : '无装备'}</span>
                  {g.witch && (
                    <span className={withdrawing ? 'warn' : ''}>
                      <Syringe size={11} />{withdrawing ? `断药第 ${g.withdrawalDays} 日（禁派）` : `抑制剂余 ${drugLeft} 日`}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="av-battle-archive" aria-labelledby="av-record-battle-title">
        <div className="av-log-head">
          <h2 id="av-record-battle-title"><Swords size={14} />战斗档案<small>{state.battles.length} 场</small></h2>
          <button id="av-record-chronicle" type="button" className="av-btn av-btn-small" onClick={onChronicle}><ScrollText size={13} />编年史 {state.chronicle.length}<ChevronRight size={12} /></button><button id="av-record-codex" type="button" className="av-btn av-btn-small" onClick={onCodex}>
            <BookOpen size={13} />魔物图鉴<ChevronRight size={12} />
          </button>
        </div>
        {state.battles.length ? (
          <ol className="av-battle-list">
            {state.battles.slice(0, 6).map(battle => {
              const note = state.battleNotes?.find(item => item.battleId === battle.id);
              return (
                <li key={battle.id}>
                  <button id={`av-record-battle-${battle.id}`} type="button" className={`av-battle-row av-tone-${battle.outcome ?? 'draw'}${note ? ' has-note' : ''}`} onClick={() => onBattle(battle.id)}>
                    <span className="av-battle-date">第 {battle.startedAt.day} 日 · {hm(battle.startedAt.minutes)}</span>
                    <strong>{battle.missionTitle}</strong>
                    <span className="av-battle-outcome-tag">{outcomeNames[battle.outcome ?? 'draw']}</span>
                    <span className="av-battle-meta">{battle.rounds} 轮 · {number(battle.rewards?.gold ?? 0)} 星砂</span>
                    {note ? <span className="av-battle-note-mark"><BookOpen size={11} />札记</span> : <ArrowUpRight size={12} />}
                  </button>
                  {note && onBattleNote && <button id={`records-note-${battle.id}`} type="button" className="av-battle-note-link" onClick={() => onBattleNote(battle.id)}><BookOpen size={12} />读札记</button>}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="av-empty av-empty-battle">
            <Swords size={26} strokeWidth={1} />
            <p>还没有战斗记录。<br />战斗委托结束后，完整过程会被保存在这里。</p>
          </div>
        )}
        {state.battles.length > 6 && <p className="av-battle-more">仅展示最近 6 场战斗，完整战报可在派遣地图的任务详情中回看。</p>}
      </section>

      <section aria-labelledby="av-record-log-title">
        <div className="av-log-head">
          <h2 id="av-record-log-title"><History size={14} />行动手记<small>{logs.length} 条</small></h2>
          <div className="av-log-filter">
            <label htmlFor="av-record-log-filter">记录类型</label>
            <select id="av-record-log-filter" className="av-select" value={kind} onChange={event => { setKind(event.target.value as typeof kind); setVisibleCount(8); }}>
              <option value="all">全部记录</option>
              {(Object.keys(kindNames) as LogKind[]).map(value => (
                <option key={value} value={value}>{kindNames[value]}记录</option>
              ))}
            </select>
          </div>
        </div>
        {logs.length ? (
          <ol className="av-log-list">
            {logs.slice(0, visibleCount).map(log => {
              const Icon = kindIcons[log.kind];
              return (
                <li className="av-log-item" key={log.id}>
                  <time className="av-log-time">{log.time}</time>
                  <span className="av-log-icon"><Icon size={12} strokeWidth={1.5} /></span>
                  <div className="av-log-copy">
                    <strong>{log.text}</strong>
                    {typeof log.delta === 'number' && log.delta !== 0 && (
                      <p className={log.delta > 0 ? 'av-log-positive' : ''}>{log.delta > 0 ? '+' : '−'}{number(Math.abs(log.delta))} 星砂</p>
                    )}
                  </div>
                  <span className="av-log-category">{kindNames[log.kind]}</span>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="av-empty">
            <History size={28} strokeWidth={1} />
            <p>这一页还没有记录。<br />{kind === 'all' ? '派遣、照护或与成员交谈后，故事会留在这里。' : '切换到全部记录，看看事务所发生过的其他故事。'}</p>
          </div>
        )}
        {logs.length > visibleCount && (
          <button id="av-record-load-more" className="av-btn av-log-more" type="button" onClick={() => setVisibleCount(count => count + 8)}>
            继续翻阅 · 还有 {logs.length - visibleCount} 条<ChevronRight size={13} />
          </button>
        )}
      </section>
      <p className="av-section-caption"><LockKeyhole size={11} />经营与故事记录仅保存在此浏览器，不会上传到任何服务。</p>
    </section>
  );
}
