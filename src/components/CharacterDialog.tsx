import { useState } from 'react';
import { rules } from '../balance';
import { Heart, BatteryMedium, Sparkles, MessageCircle, ArrowUpRight, Moon, Cross, Star, LockKeyhole, BadgeCheck, Bandage, Users, Flower2, ShieldCheck, Swords, Timer, RefreshCw, Phone, UserRoundCheck, Brain, ClipboardList, Download, Shirt, Syringe, Wand2, X, Smile, Frown, Angry, Meh, ChevronRight, GripVertical, PackageOpen } from 'lucide-react';
import type { Equipment, Expression, GameState, Girl, StatKey } from '../types';
import { effectiveMaxHp, effectiveMaxSpirit, effectiveStats, corruptionStage } from '../economy';
import { drugDaysLeft, relationshipStage, stageHints, stageLabels, statLabels, statusLabels } from '../game';
import { effectText, findSkill, resourceLabels, tierLabels } from '../content/skills';
import { contractLabel, pensionArrears, pensionFor, renewalCost } from '../contracts';
import { expNeeded, progressLabel } from '../progression';
import { GirlPortrait } from './GirlPortrait';
import { ClinicPanel } from './ClinicPanel';
import { getItem, items } from '../content/items';

const dossierTabs = [
  { id: 'overview', label: '状态概览' },
  { id: 'ability', label: '魔法能力' },
  { id: 'relations', label: '关系网络' },
  { id: 'growth', label: '契约成长' },
  { id: 'appearance', label: '外观装备' },
  { id: 'memory', label: '心愿与羁绊' },
];
const expressions: { id: Expression; label: string; note: string }[] = [
  { id: 'calm', label: '平静', note: '呼吸放轻' }, { id: 'smile', label: '微笑', note: '眼角弯起' }, { id: 'surprise', label: '惊讶', note: '微微睁大' },
  { id: 'sad', label: '低落', note: '视线垂下' }, { id: 'angry', label: '生气', note: '眉峰压低' }, { id: 'shy', label: '害羞', note: '别开脸' },
];
const expressionIcons = { calm: Meh, smile: Smile, surprise: Sparkles, sad: Frown, angry: Angry, shy: Heart } as const;
const slotLabels = { weapon: '法器', charm: '护符' } as const;

function gearSummary(item: Equipment) {
  const stats = Object.entries(item.stats ?? {}).map(([key, value]) => `${statLabels[key as StatKey]}+${value}`).join(' · ');
  return item.passive ?? (stats || item.description);
}

export function CharacterDialog({ girl, state, onCare, onTalk, onAssign, onHire, onRetire, onClinic, onAssistant, onRemote, onRenew, onRehire, onChangeOutfit, onExpression, onWardrobe, onEquip, onUseItem, onUnequip, onExportCard, onStory, onStoryEdit, onStoryGraph, onStoryChoice, onStoryPort, onStoryMission, onEvent, onWitch }: {
  girl: Girl; state: GameState; onCare: (mode: 'resting') => void;
  onTalk: () => void; onAssign: () => void; onHire: () => void; onRetire: () => void;
  onClinic: (mode: 'treat' | 'wipe' | 'clone', kink?: boolean) => void;
  onAssistant: () => void; onRemote: () => void; onRenew: () => void; onRehire: () => void;
  onChangeOutfit: (id: string) => void; onExpression: (expression: Expression) => void;
  onWardrobe: () => void;
  onStory: () => void;
  onStoryEdit: () => void;
  onStoryGraph: () => void;
  onStoryChoice: (storylineId: string, beatId: string, choiceId: string) => void;
  onStoryPort: (storylineId: string, port: string) => void;
  onStoryMission: (missionId: string) => void;
  onEvent: () => void;
  onWitch: () => void;
  onEquip: (itemId: string, slot: 'weapon' | 'charm') => void; onExportCard: () => void; onUseItem: (itemId: string) => void; onUnequip: (slot: 'weapon' | 'charm') => void;
}) {
  const [tab, setTab] = useState('overview');
  const [equipmentDrawer, setEquipmentDrawer] = useState<'weapon' | 'charm' | null>(null);
  const [dragOver, setDragOver] = useState<'weapon' | 'charm' | null>(null);
  const [drawerMessage, setDrawerMessage] = useState('');
  const candidate = !state.girls.some(g => g.id === girl.id);
  const keys = Object.keys(statLabels) as StatKey[];
  const stage = relationshipStage(girl.bond);
  const peers = Object.entries(girl.relationships).map(([id, score]) => ({ girl: state.girls.find(g => g.id === id), score })).filter(x => x.girl);
  const renewCost = renewalCost(girl) + pensionArrears(girl);
  const contract = contractLabel(girl, state.day);
  const isAssistant = state.assistantId === girl.id;
  const eff = effectiveStats(girl);
  const corruptionTier = corruptionStage(girl.corruption);
  const drug = drugDaysLeft(girl, state.day);
  const consumables = items.filter(item => item.slot === 'consumable' && (state.inventory[item.id] ?? 0) > 0);
  const gear = items.filter(item => (item.slot === 'weapon' || item.slot === 'charm') && (state.inventory[item.id] ?? 0) > 0);
  const corruptionLabel = girl.witch ? '魔女化' : corruptionTier === 2 ? '第三阶段' : corruptionTier === 1 ? '第二阶段' : '第一阶段';
  const storyline = state.storylines.find(item => item.girlId === girl.id && item.status === 'active');
  const current = storyline ? storyline.beats.find(item => item.status !== 'done') ?? storyline.beats[storyline.beats.length - 1] : undefined;
  const beat = current ?? (storyline ? storyline.beats[storyline.stage] : undefined);
  const graphChoice = storyline?.graph && storyline.run?.waiting?.kind === 'choice'
    ? storyline.graph.nodes.find(node => node.id === storyline.run?.waiting?.ref)
    : undefined;
  const witchOutfit = girl.witchForm;

  function equipFromInventory(itemId: string, slot: 'weapon' | 'charm') {
    const item = getItem(itemId);
    if (!item || (item.slot !== 'weapon' && item.slot !== 'charm')) return;
    if (item.slot !== slot) {
      setDrawerMessage(`「${item.name}」只能放入${slotLabels[item.slot]}槽位。`);
      return;
    }
    setDrawerMessage('');
    onEquip(itemId, slot);
  }

  function dropOnSlot(event: React.DragEvent, slot: 'weapon' | 'charm') {
    event.preventDefault();
    setDragOver(null);
    const itemId = event.dataTransfer.getData('text/equipment-id');
    if (itemId) equipFromInventory(itemId, slot);
  }
  return (
    <div className="character-dossier" style={{ '--girl-color': girl.color } as React.CSSProperties}>
      <div className="dossier-art">
        <span className="dossier-art-code">契约档案<br /><b>{girl.codename}</b></span>
        <div className="portrait-orbit" />
        <GirlPortrait girl={girl} variant="full" />
        <span className="dossier-seal"><Star size={20} /><span>夜糖<br />契约</span></span>
        <span className="dossier-art-bottom">每一束星光，都有自己的名字。</span>
      </div>
      <div className="dossier-content">
        <div className="modal-eyebrow">{candidate ? '招募档案' : '契约者档案'} / {girl.element}</div>
        <div className="dossier-name"><h2>{girl.name}</h2><span>Lv.{girl.level.toString().padStart(2, '0')}</span><button id="girl-export-card" type="button" className="dossier-export" onClick={onExportCard} title="把这位契约者导出为可再次导入的卡片"><Download size={13}/>导出卡片</button></div>
        <div className="dossier-codename">{girl.codename}<span className={`pill contract-pill ${girl.contractEndDay - state.day < 3 ? 'urgent' : ''}`}>{candidate ? '等待签约' : statusLabels[girl.status]}</span>{!candidate && <span className="contract-mini">{contract}</span>}</div>
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
            <div className="dossier-meter"><div><Heart size={14} /><span>血量</span><b>{girl.hp}<small> / {effectiveMaxHp(girl)}</small></b></div><i><b style={{ width: `${girl.hp / effectiveMaxHp(girl) * 100}%` }} /></i></div>
            <div className="dossier-meter spirit"><div><Sparkles size={15} /><span>共情值</span><b>{girl.spirit}<small> / {effectiveMaxSpirit(girl)}</small></b></div><i><b style={{ width: `${girl.spirit / effectiveMaxSpirit(girl) * 100}%` }} /></i></div>
            <div className="dossier-meter fatigue"><div><BatteryMedium size={15} /><span>疲劳值</span><b>{girl.fatigue}<small> / 100</small></b></div><i><b style={{ width: `${girl.fatigue}%` }} /></i></div>
            <div className={`corruption-panel corruption-inline stage-${corruptionTier}`}>
              <div className="corruption-head"><span><Syringe size={14} />侵蚀度<em>{corruptionLabel}</em></span><b>{girl.corruption}<small> / 100</small></b></div>
              <i><b style={{ width: `${girl.corruption}%` }} /></i>
              <div className="corruption-facts"><span>魔女阈值<b>70</b></span><span>共情修正<b>−{corruptionTier === 2 ? 25 : corruptionTier === 1 ? 12 : 5}%</b></span><span>抑制剂<b className={drug <= 2 ? 'warn' : ''}>{girl.witch ? (drug > 0 ? `${drug} 日` : `断药第 ${girl.withdrawalDays ?? 0} 日`) : '未转化'}</b></span></div>
              {girl.witch && <p className="corruption-note">{drug > 0 ? '抑制剂仍在起效。断药前记得补充。' : '断药期间无法派遣、远行或接受势力任务；第 10 日会死亡。'}</p>}
            </div>
            <div className="dossier-meter exp-meter"><div><Star size={14} /><span>成长经验</span><b>{progressLabel(girl)}<small> · Lv.{girl.level}</small></b></div><i><b style={{ width: `${girl.level >= 10 ? 100 : girl.exp / Math.max(1, expNeeded(girl.level)) * 100}%` }} /></i></div>
            <div className="goal-line"><ClipboardList size={14} /><span><small>当前目标</small>{girl.goal}</span></div>
            <div className="trait-tags">{girl.traits.length ? girl.traits.map(trait => <span key={trait.id} className={`trait-tag ${trait.polarity}`} title={trait.description}>{trait.name}</span>) : <span className="trait-empty">还没有显露特性</span>}</div>
            {girl.conditions.length > 0 && <div className="condition-list">{girl.conditions.map(condition => <span key={condition.id} className={`condition-chip ${condition.kind}`} title={condition.description}>{condition.name}<small>{condition.remaining} 日</small></span>)}</div>}
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
            <section className="story-panel" aria-labelledby="story-title">
              <div className="appearance-head"><span className="appearance-index">04</span><div><h3 id="story-title"><Sparkles size={14} />故事线</h3><small>{girl.storyPlan ? '手稿由你写下 · 开场后按幕推进' : '由叙事者按她的过去写四幕 · 每幕的选项会落到状态上'}</small></div><em>{storyline ? `第 ${storyline.stage + 1} / ${storyline.beats.length} 幕` : '未开启'}</em></div>
              {girl.eventBadge && <button id="dossier-event-enter" type="button" className="story-event-btn" onClick={onEvent}><Sparkles size={14} />角色事件 · {girl.eventBadge} · 进入</button>}
              {storyline && beat ? (
                <div className="story-beat">
                  <b>{beat.title}</b>
                  {beat.summary && <p>{beat.summary}</p>}
                  <small>{beat.scene}</small>
                  {beat.mission ? (
                    <div className={`story-mission ${beat.status ?? 'open'}`}>
                      <small>{beat.status === 'done' ? '这一幕的委托已完成 · 事件在头像角标' : beat.missionId ? '委托已在地图上 · 完成后触发她的剧情事件' : '委托准备中'}</small>
                      <b>{beat.mission.title}</b>
                      <p>{beat.mission.goal}</p>
                      <span>{beat.mission.difficulty} · {beat.mission.duration} 分钟 · {beat.mission.category ?? '故事委托'}</span>
                      {(beat.mission.companion || beat.mission.monsters?.length || beat.mission.rewardEquipment || beat.mission.followUpIncident || beat.mission.followUpEvent) && (
                        <span className="story-grant-tags">
                          {beat.mission.companion && <em>新契约者 · {beat.mission.companion.name}</em>}
                          {beat.mission.requiredGirlId && <em>指定同行</em>}
                          {Boolean(beat.mission.monsters?.length) && <em>专属魔物 · {beat.mission.monsters!.length}</em>}
                          {beat.mission.rewardEquipment && <em>专属装备 · {beat.mission.rewardEquipment.name}</em>}
                          {beat.mission.followUpIncident && <em>后续弹窗</em>}
                          {beat.mission.followUpEvent && <em>额外事件</em>}
                        </span>
                      )}
                      {beat.missionId && beat.status !== 'done' && <button id="dossier-story-mission" type="button" className="btn" onClick={() => onStoryMission(beat.missionId as string)}>查看这份委托</button>}
                    </div>
                  ) : (
                    <div className="story-choices">
                      {beat.choices.map(choice => <button key={choice.id} id={`dossier-story-choice-${choice.id}`} type="button" className="btn" onClick={() => onStoryChoice(storyline.id, beat.id, choice.id)}>{choice.label}</button>)}
                      {graphChoice?.data.kind === 'choice' && graphChoice.data.options.map(option => (
                        <button key={option.id} id={`dossier-story-port-${option.id}`} type="button" className="btn" onClick={() => onStoryPort(storyline.id, option.id)}>{option.label || '继续'}</button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                {girl.storyPlan && (
                  <div className="story-plan-card" id="dossier-story-plan">
                    <b>{girl.storyPlan.title}</b>
                    <small>{girl.storyPlan.beats.length} 幕手稿 · 随契约卡一起导出</small>
                    <span className="story-plan-tags">{girl.storyPlan.beats.map((planBeat, planIndex) => <em key={planBeat.id}>{planIndex + 1}. {planBeat.title || '未命名'}</em>)}</span>
                  </div>
                )}
                <div className="story-start-row">
                  <button id="dossier-story-start" type="button" className="btn" disabled={girl.bond < 20} onClick={onStory}>{girl.storyPlan ? '按手稿开场' : '开启角色故事线'}{girl.bond < 20 ? '（羁绊需 20）' : ''}</button>
                  <button id="dossier-story-edit" type="button" className="btn ghost" onClick={onStoryEdit}>{girl.storyPlan ? '编辑手稿' : '自己写一条'}</button>
                  <button id="dossier-story-graph" type="button" className="btn ghost" onClick={onStoryGraph}>蓝图编辑</button>
                </div>
                </>
              )}
            </section>
            <div className="location-note"><Moon size={15} />{girl.status === 'mission' ? `执行委托中 · ${girl.remaining} 分钟后返回` : girl.status === 'expedition' ? '星象台远行中 · 每 60 分钟回报一次' : `当前位于${state.rooms.find(r => r.id === girl.roomId)?.name ?? '会客厅'}`}</div>
          </>}
          {tab === 'ability' && <>
            <div className="skill-list">
              {girl.skills.map(id => findSkill(id)).filter((skill): skill is NonNullable<typeof skill> => Boolean(skill)).map(skill => (
                  <article key={skill.id} className={`skill-card tier-${skill.tier}`}>
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
                ))}
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
                    <img src={peer!.portrait} alt="" />                    <span><b>{peer!.name}</b><small>{peer!.codename}</small></span>
                    <i><b style={{ width: `${score}%` }} /></i>
                    <em className={`stage-${peerStage}`}>{stageLabels[peerStage]}<small>{score}</small></em>
                  </button>
                );
              })}
            </div>
            <p className="small-note">关系会随共同出勤、战斗胜负与告别而变化。数值不会直接显示在对话里。</p>
          </>}
          {tab === 'growth' && <>
            <div className="growth-columns">
            <div className="growth-col">
            <div className="growth-hero"><div><small>当前目标</small><strong>{girl.goal}</strong><span>{girl.goalKind}倾向 · Lv.{girl.level}</span></div><div className="growth-level">{girl.level >= 10 ? 'MAX' : `Lv.${girl.level}`}</div></div>
            <div className="exp-progress"><span>距离下一级</span><b>{progressLabel(girl)} EXP</b><i><b style={{ width: `${girl.level >= 10 ? 100 : girl.exp / Math.max(1, expNeeded(girl.level)) * 100}%` }} /></i><small>战斗经验按推荐等级结算；连续两次达标战斗或四次调查可提升一级。</small></div>
            <div className="modal-section-heading"><h3>特性</h3><small>派遣后随机显露，长期保留</small></div>
            <div className="trait-grid">{girl.traits.length ? girl.traits.map(trait => <article key={trait.id} className={`trait-card ${trait.polarity}`}><b>{trait.name}</b><small>{trait.polarity === 'positive' ? '正面' : trait.polarity === 'negative' ? '负面' : '中性'} · {trait.tags.join(' / ')}</small><p>{trait.description}</p></article>) : <p className="small-note">还没有显露特性。完成派遣后，她可能会表现出新的习惯。</p>}</div>
            </div>
            <div className="growth-col">
            <div className="modal-section-heading"><h3>契约与退休金</h3><small>到期后需续签</small></div>
            <div className="contract-grid">
              <div><span>契约状态</span><b>{contract}</b><small>{girl.contractEndDay} 日到期 · 已续签 {girl.contractRenewals} 次</small></div>
              <div><span>退休金标准</span><b>{pensionFor(girl)} <small>星砂 / 10 日</small></b><small>{girl.retired ? '每月从事务所账户划拨' : '退役后开始计发'}</small></div>
              <div><span>欠缴</span><b className={pensionArrears(girl) ? 'warn' : ''}>{pensionArrears(girl)}</b><small>{girl.pensionMissed} 日未结</small></div>
            </div>
            {!girl.retired && <button id="girl-renew" className="btn full renew-btn" disabled={state.gold < renewCost} onClick={onRenew}><RefreshCw size={15} />续签契约 · {renewCost.toLocaleString()} 星砂（含欠缴与羁绊系数）</button>}
            {girl.retired && girl.retiredReason === 'contract' && <button id="girl-rehire" className="btn full" onClick={onRehire}><UserRoundCheck size={15} />返聘 · {600 + girl.level * 120} 星砂</button>}
            {girl.retired && <p className="small-note"><Phone size={12} />已退役，可进行远程联络。每次通话 40 星砂，每日首次提升羁绊。</p>}
            {!candidate && <button id="girl-assistant-toggle" className={`btn full ${isAssistant ? 'active' : ''}`} onClick={onAssistant}><ShieldCheck size={15} />{isAssistant ? '取消值班助理' : '设为值班助理'} · 需羁绊 40</button>}
            </div>
            </div>
            <section className="growth-clinic">
              <div className="modal-section-heading"><h3>月光诊所</h3><small>按缺失血量收费，按小时恢复；治疗期间不能派遣</small></div>
              <ClinicPanel state={state} girls={[girl]} onTreat={(_girlId, kink) => onClinic('treat', kink)} />
              <div className="clinic-grid">
                <button id="clinic-wipe" className="clinic-action" disabled={state.gold < 4000 || girl.status === 'mission' || girl.status === 'expedition'} onClick={() => onClinic('wipe')}><Brain size={16} /><b>记忆重塑</b><small>4,000 星砂 · 等级归 1，属性重置</small></button>
                <button id="clinic-clone" className="clinic-action" disabled={state.gold < 18000 || girl.level < 3 || Boolean(girl.cloneOf)} onClick={() => onClinic('clone')}><Users size={16} /><b>复制契约</b><small>18,000 星砂 · 从 1 级开始，仅一次</small></button>
              </div>
            </section>
          </>}
          {tab === 'appearance' && <>
            <div className="appearance-page">
              <section className="appearance-section" aria-labelledby="wardrobe-title">
                <div className="appearance-head"><span className="appearance-index">01</span><div><h3 id="wardrobe-title"><Shirt size={14} />衣柜</h3><small>四格礼装 · 换装同步立绘与头像</small></div><em>{Math.min(4, girl.wardrobe.length)} / 4</em></div>
                <div className="wardrobe-grid">
                  {girl.wardrobe.slice(0, 4).map(outfit => (
                    <button key={outfit.id} id={`dossier-outfit-${outfit.id}`} type="button" className={`wardrobe-tile ${girl.outfitId === outfit.id ? 'picked' : ''}`} aria-pressed={girl.outfitId === outfit.id} onClick={() => onChangeOutfit(outfit.id)}>
                      <span className="wardrobe-preview"><GirlPortrait girl={{ ...girl, outfitId: outfit.id }} variant="avatar" /></span>
                      <span className="wardrobe-copy"><b>{outfit.name}{outfit.custom && <em className="wardrobe-tag">契约礼装</em>}</b><small title={outfit.description}>{outfit.description}</small></span>
                      {girl.outfitId === outfit.id && <span className="wardrobe-check"><BadgeCheck size={12} /></span>}
                    </button>
                  ))}
                  {girl.wardrobe.length < 4 && <button id="dossier-wardrobe-import" type="button" className="wardrobe-tile wardrobe-add" onClick={onWardrobe}><span className="wardrobe-preview"><PackageOpen size={18} /></span><span className="wardrobe-copy"><b>导入衣柜</b><small>立绘、JSON 或从其他契约者复制</small></span></button>}
                  {(witchOutfit || girl.corruption >= rules().corruptionThreshold) && <button id="dossier-witch-slot" type="button" className={`wardrobe-tile witch ${girl.witch ? 'picked' : ''}`} aria-pressed={Boolean(girl.witch)} onClick={onWitch}>
                    <span className="wardrobe-preview"><GirlPortrait girl={{ ...girl, witch: Boolean(witchOutfit), portrait: witchOutfit?.portrait ?? girl.portrait }} variant="avatar" /></span>
                    <span className="wardrobe-copy"><b>魔女化 · 夜之形<em className="wardrobe-tag">第五格</em></b><small>{witchOutfit ? (girl.witch ? '已切换 · 点击恢复' : '已解锁 · 点击切换') : '侵蚀 40 解锁'}</small></span>
                  </button>}
                </div>
                <button id="dossier-wardrobe-manage" type="button" className="llm-reset wardrobe-manage" onClick={onWardrobe}>管理衣柜 · 导入 / 删除</button>
              </section>

              <section className="appearance-section" aria-labelledby="expression-title">
                <div className="appearance-head"><span className="appearance-index">02</span><div><h3 id="expression-title"><Sparkles size={14} />表情</h3><small>只改变呈现，不影响数值</small></div><em>{expressions.find(item => item.id === girl.expression)?.label ?? '平静'}</em></div>
                <div className="expression-grid" role="group" aria-label="选择表情">
                  {expressions.map(item => {
                    const Icon = expressionIcons[item.id];
                    return <button key={item.id} id={`dossier-expression-${item.id}`} type="button" aria-pressed={girl.expression === item.id} className={`expression-tile ${girl.expression === item.id ? 'picked' : ''}`} onClick={() => onExpression(item.id)}><Icon size={15} /><b>{item.label}</b><small>{item.note}</small></button>;
                  })}
                </div>
              </section>

              <section className="appearance-section" aria-labelledby="equipment-title">
                <div className="appearance-head"><span className="appearance-index">03</span><div><h3 id="equipment-title"><Wand2 size={14} />装备</h3><small>法器与护符各一 · 从仓库拖入</small></div><em>{gear.length} 件在库</em></div>
                <div className="equipment-slots">
                  {(['weapon', 'charm'] as const).map((slot, index) => {
                    const item = getItem(girl.equipment[slot]);
                    return (
                      <button key={slot} id={`dossier-equipment-${slot}`} type="button" className={`equipment-slot ${equipmentDrawer === slot ? 'active' : ''}`} onClick={() => { setEquipmentDrawer(slot); setDrawerMessage(''); }} aria-label={`打开${slotLabels[slot]}仓库，当前${item?.name ?? '空置'}`}>
                        <span className="equipment-slot-top"><em>{slotLabels[slot]}</em><small>0{index + 1}</small></span>
                        {item ? <><b>{item.name}</b><small>{gearSummary(item)}</small></> : <><b className="empty">空置</b><small>点击打开仓库，拖入装备</small></>}
                        <span className="equipment-open">打开仓库 <ChevronRight size={11} /></span>
                      </button>
                    );
                  })}
                </div>
                <div className="consumable-row">
                  <span className="consumable-label"><Syringe size={12} />随身物资</span>
                  {consumables.length ? consumables.map(item => <button key={item.id} id={`dossier-use-${item.id}`} type="button" className="consumable-chip" onClick={() => onUseItem(item.id)}>{item.name}<em>×{state.inventory[item.id]}</em></button>) : <p>仓库里没有可用物资。去市场采购，或从势力货架补充。</p>}
                </div>
              </section>

              <div className="appearance-stats">
                <div className="appearance-head"><span className="appearance-index">04</span><div><h3><ShieldCheck size={14} />有效能力</h3><small>装备、侵蚀与服装被动已计入</small></div></div>
                <div className="stat-bars">{keys.map(k => <div key={k}><span>{statLabels[k]}</span><i><b style={{ width: `${Math.min(100, eff[k])}%` }} /></i><strong className={eff[k] !== girl.stats[k] ? 'modified' : ''}>{eff[k]}</strong></div>)}</div>
              </div>
            </div>
          </>}
          {tab === 'memory' && <>
            <div className="bond-emblem"><Heart size={28} /><div><small>与你的羁绊</small><strong>{girl.bond}<span>/100</span></strong></div></div>
            <p className="dossier-description">{candidate ? '一个故事还没有开始。在签署契约之后，你会慢慢认识她不为人知的另一面。' : girl.bond >= 70 ? '「如果城市的灯都熄了，我也知道该往哪里走。因为你会在这里等我。」' : girl.bond >= 40 ? '「我不太擅长讲自己的事。不过，如果你愿意听……我们可以慢慢来。」' : '「工作之外的事，我还没有想好要不要告诉你。」'}</p>
            <div className="goal-line"><ClipboardList size={14} /><span><small>当前目标</small>{girl.goal}</span></div>
            <div className="memory-item"><BadgeCheck size={17} /><span>已知心愿<small>{girl.quote ?? '希望每一次出勤之后，大家都能平安回来。'}</small></span></div>
            <div className="memory-item"><LockKeyhole size={16} /><span>{girl.bond >= 60 ? '被记住的片刻' : '未说出口的故事'}<small>{girl.bond >= 60 ? '深夜留在桌上的一杯热可可，杯沿有她的口红印。' : '多陪她聊聊，故事会在日常中慢慢展开。'}</small></span></div>
            {girl.conditions.length > 0 && <div className="condition-list">{girl.conditions.map(condition => <span key={condition.id} className={`condition-chip ${condition.kind}`} title={condition.description}>{condition.name}<small>{condition.remaining} 日</small></span>)}</div>}
            {girl.scars.length > 0 && <div className="memory-scars">{girl.scars.map(scar => <div key={scar.id} className={`memory-scar ${scar.kind}`}><Bandage size={13} /><span><b>{scar.name}</b><small>{scar.condition} · {scar.gainedAt}</small></span></div>)}</div>}
          </>}
        </div>
        {candidate ? <button id="candidate-hire-from-profile" className="btn primary full" onClick={onHire}>缔结契约 · {girl.cost.toLocaleString()} 星砂<ArrowUpRight size={16} /></button> : <>
          <div className="dossier-footer">
          <div className="care-actions">
            <button id="girl-rest" className="btn" disabled={girl.status !== 'idle' || girl.fatigue === 0} onClick={() => onCare('resting')}><Moon size={15} /><span>安排休息<small>免费 · 90 分钟</small></span></button>
          </div>
          <div className="dossier-primary-actions">
            <button id="girl-talk" className="btn" disabled={girl.status === 'mission'} onClick={onTalk}><MessageCircle size={16} />和她聊聊</button>
            <button id="girl-remote" className="btn" disabled={!girl.retired} onClick={onRemote}><Phone size={16} />远程联络</button>
            <button id="girl-assign" className="btn primary" disabled={girl.status !== 'idle' || girl.hp < 25 || girl.fatigue >= 80 || Boolean(girl.witch && drugDaysLeft(girl, state.day) <= 0)} onClick={onAssign}><Swords size={16} />安排派遣<ArrowUpRight size={17} /></button>
          </div>
          </div>
          {girl.retired
            ? <p className="small-note"><ShieldCheck size={12} />已转任文职。她仍住在基地，也会出现在关系网络里。退休金从每月经营收入中划拨。</p>
            : girl.scars.length >= 4 && <button id="girl-retire" className="btn retire-btn" onClick={onRetire}><Flower2 size={15} />申请退役 · 转任文职</button>}
          {girl.status !== 'idle' && <p className="small-note">正在{statusLabels[girl.status]}，剩余 {girl.remaining} 分钟。推进时间完成安排。</p>}
        </>}
      </div>
      {equipmentDrawer && (
        <aside className="equipment-drawer" aria-label="装备仓库" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); setEquipmentDrawer(null); } }}>
          <div className="drawer-head">
            <div><small>装备仓库 / ARMORY</small><h3>{slotLabels[equipmentDrawer]}</h3></div>
            <button id="equipment-drawer-close" type="button" className="drawer-close" aria-label="关闭装备仓库" onClick={() => setEquipmentDrawer(null)}><X size={16} /></button>
          </div>
          <p className="drawer-hint">把下方装备拖进对应槽位，或点击装备直接穿戴。装备会立即计入有效能力。</p>
          <div className="drawer-slots">
            {(['weapon', 'charm'] as const).map(slot => {
              const item = getItem(girl.equipment[slot]);
              return (
                <div key={slot} id={`equipment-drop-${slot}`} className={`drawer-slot ${equipmentDrawer === slot ? 'focused' : ''} ${dragOver === slot ? 'over' : ''}`}
                  onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragOver(slot); }}
                  onDragLeave={() => setDragOver(current => current === slot ? null : current)}
                  onDrop={event => dropOnSlot(event, slot)}>
                  <span className="drawer-slot-label">{slotLabels[slot]}<small>DROP HERE</small></span>
                  {item ? <><b>{item.name}</b><small>{gearSummary(item)}</small><button type="button" id={`dossier-unequip-${slot}`} className="drawer-unequip" onClick={() => { setDrawerMessage(''); onUnequip(slot); }}>卸下</button></> : <><b className="empty">拖入{slotLabels[slot]}</b><small>空置槽位</small></>}
                </div>
              );
            })}
          </div>
          <div className="drawer-inventory-head"><span><GripVertical size={12} />持有装备</span><b>{gear.length}</b></div>
          <div className="drawer-inventory">
            {gear.length ? gear.map(item => (
              <button key={item.id} id={`dossier-gear-${item.id}`} type="button" draggable className={`gear-card ${item.slot === equipmentDrawer ? 'compatible' : ''}`}
                onDragStart={event => { event.dataTransfer.setData('text/equipment-id', item.id); event.dataTransfer.effectAllowed = 'move'; }}
                onClick={() => { if (item.slot === 'weapon' || item.slot === 'charm') equipFromInventory(item.id, item.slot); }}>
                <span className={`gear-glyph ${item.slot}`}>{item.slot === 'weapon' ? <Wand2 size={15} /> : <ShieldCheck size={15} />}</span>
                <span className="gear-copy"><b>{item.name}</b><small>{gearSummary(item)}</small></span>
                <em>×{state.inventory[item.id]}</em>
              </button>
            )) : <div className="drawer-empty"><PackageOpen size={22} /><p>仓库里还没有装备。<br />去市场或势力货架采购。</p></div>}
          </div>
          {drawerMessage && <p className="drawer-message" role="status">{drawerMessage}</p>}
        </aside>
      )}
    </div>
  );
}
