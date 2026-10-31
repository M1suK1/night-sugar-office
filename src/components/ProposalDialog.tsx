import { AlertTriangle, Check, RefreshCw, Sparkles, X } from 'lucide-react';
import type { GameState, Opinion } from '../types';
import { opinionOptionTags, previewOpinionOption } from '../opinions';
import { districts } from '../districts';
import type { NightProposalV2 } from '../llm-night';

export interface PendingProposal {
  data: NightProposalV2;
  warnings: string[];
}

const statLabels = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共感' } as const;
const factionLabels = { witch: '月蚀庭', association: '星灯协会', government: '樱雾市役所' } as const;
const polarityLabels = { positive: '正面', negative: '负面', neutral: '中立' } as const;
const triggerLabels = { roundStart: '回合开始', hit: '受击', always: '常驻' } as const;
const ruleLabels = { heal: '回复', buff: '强化', haste: '加速', debuffAttacker: '削弱攻击者', dot: '持续伤害', immuneStun: '免疫眩晕', damageReduce: '减伤' } as const;

function StatLine({ stats }: { stats: Record<'magic' | 'insight' | 'agility' | 'empathy', number> }) {
  return <div className="proposal-stats">{Object.entries(statLabels).map(([key, label]) => <span key={key}>{label}<b>{stats[key as keyof typeof statLabels]}</b></span>)}</div>;
}

export function ProposalDialog({ state, proposal, busy, onAccept, onRegenerate, onDiscard }: {
  state: GameState;
  proposal: PendingProposal;
  busy: boolean;
  onAccept: () => void;
  onRegenerate: () => void;
  onDiscard: () => void;
}) {
  const { monster, candidate, mission, opinion, envoy, loot } = proposal.data;
  const lootNames = new Map(loot.map(item => [item.ref, item.name]));
  const previewOpinion: Opinion = {
    id: 'preview', day: state.day, authorId: opinion.authorId, topic: opinion.topic,
    title: opinion.title, text: opinion.text, request: opinion.request, status: 'pending', options: [],
  };
  return <div className="standard-modal proposal-modal">
    <div className="modal-eyebrow"><Sparkles size={14} />故事引擎 / 完整提案</div>
    <h2>今晚的提案，已经写到了数值。</h2>
    <p className="muted">这份提案由叙事者起草，已通过本地校验。采纳后才会写入事务所；魔物、候选者、委托、议会与使者会一起入场。</p>
    {proposal.warnings.length > 0 && <div className="proposal-warnings"><AlertTriangle size={15} /><div><b>本地校验做了 {proposal.warnings.length} 处裁剪</b>{proposal.warnings.map((warning, index) => <span key={`${warning}-${index}`}>{warning}</span>)}</div></div>}
    <div className="proposal-grid">
      <section className="proposal-section">
        <header><span>01</span><div><b>今夜的魔物</b><small>{monster.rank} · {monster.element}</small></div></header>
        <h3>{monster.name}<em>{monster.epithet}</em></h3>
        <p>{monster.description}</p>
        <div className="proposal-facts"><span>生命<b>{monster.maxHp}</b></span><span>心防<b>{monster.stats.empathy * 2}</b></span><span>技能<b>{monster.skillIds.join('、')}</b></span></div>
        <StatLine stats={monster.stats} />
        <p className="proposal-note">习性：{monster.habit} 弱点：{monster.weakness}</p>
        {monster.rules.length > 0 && <p className="proposal-note">规则：{monster.rules.map(rule => `${triggerLabels[rule.trigger]}/${ruleLabels[rule.effect]}${rule.amount !== undefined ? ` ${rule.amount}` : ''}`).join('；')}</p>}
      </section>
      <section className="proposal-section">
        <header><span>02</span><div><b>新的候选者</b><small>{candidate.element} · {candidate.archetype}</small></div></header>
        <h3>{candidate.name}<em>{candidate.codename}</em></h3>
        <p>{candidate.title}。{candidate.quote}</p>
        <div className="proposal-facts"><span>等级<b>Lv.{candidate.level}</b></span><span>契约费<b>{candidate.cost.toLocaleString('zh-CN')}</b></span><span>目标<b>{candidate.goalKind}</b></span></div>
        <StatLine stats={candidate.stats} />
        <p className="proposal-note">{candidate.appearance} {candidate.personality}</p>
        <p className="proposal-note">{candidate.traits.map(trait => `${polarityLabels[trait.polarity]}「${trait.name}」${trait.description}`).join('；')}</p>
      </section>
      <section className="proposal-section">
        <header><span>03</span><div><b>今夜的委托</b><small>{mission.work === 'combat' ? '战斗' : '调查'} · {mission.difficulty}</small></div></header>
        <h3>{mission.title}<em>{mission.category}</em></h3>
        <p>{mission.description}</p>
        <div className="proposal-facts"><span>时长<b>{mission.duration} 分钟</b></span><span>报酬<b>{mission.reward.toLocaleString('zh-CN')} 星砂</b></span><span>判定<b>{statLabels[mission.requirement]} {mission.target}</b></span><span>轮次<b>{mission.rounds}</b></span><span>推荐等级<b>Lv.{mission.recommendedLevel}</b></span><span>辖区<b>{mission.district ? districts[mission.district].name : '事务所周边'}</b></span></div>
        {mission.rewardItemRef && <p className="proposal-note">额外报酬：{lootNames.get(mission.rewardItemRef) ?? mission.rewardItemRef}{mission.rewardGirlLevel > 0 ? `，并可获得 Lv.${mission.rewardGirlLevel} 契约者` : ''}</p>}
      </section>
      <section className="proposal-section proposal-opinion">
        <header><span>04</span><div><b>议会提案</b><small>{opinion.topic} · {factionLabels[opinion.faction]}</small></div></header>
        <h3>{opinion.title}</h3>
        <p>{opinion.text}</p>
        <p className="proposal-note">请求：{opinion.request}</p>
        <div className="proposal-dialogue">{opinion.dialogue.map((line, index) => <p key={`${line.speaker}-${index}`}><b>{line.speaker}</b><span>{line.text}</span></p>)}</div>
        <div className="proposal-options">{opinion.options.map(option => {
          const tags = opinionOptionTags(option, state).map(tag => {
            for (const [ref, name] of lootNames) tag = tag.replace(ref, name);
            return tag;
          });
          const preview = previewOpinionOption(state, previewOpinion, option);
          return <article key={option.id} className={preview.ok ? '' : 'locked'}>
            <div><b>{option.label}</b>{!preview.ok && <small>{preview.missing.join('；')}</small>}</div>
            <p>{option.effect}</p>
            <div className="proposal-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>
          </article>;
        })}</div>
      </section>
      <section className="proposal-section">
        <header><span>05</span><div><b>使者委托</b><small>{factionLabels[envoy.faction]}</small></div></header>
        <h3>{envoy.title}<em>{envoy.category}</em></h3>
        <p>{envoy.description}</p>
        <div className="proposal-facts"><span>时长<b>{envoy.duration} 分钟</b></span><span>报酬<b>{envoy.reward.toLocaleString('zh-CN')} 星砂</b></span><span>判定<b>{statLabels[envoy.requirement]} {envoy.target}</b></span><span>轮次<b>{envoy.rounds}</b></span></div>
      </section>
      <section className="proposal-section">
        <header><span>06</span><div><b>一次性奖励</b><small>采纳后登记进仓库</small></div></header>
        {loot.length ? loot.map(item => <div className="proposal-loot" key={item.ref}><b>{item.name}</b><span>{item.slot === 'weapon' ? '武器' : item.slot === 'charm' ? '护符' : '消耗品'} · {factionLabels[item.faction]}</span><p>{item.description}</p>{item.stats && <StatLine stats={{ magic: 0, insight: 0, agility: 0, empathy: 0, ...item.stats }} />}{item.passive && <p className="proposal-note">{item.passive}</p>}</div>) : <p className="proposal-note">这次没有额外装备。</p>}
      </section>
    </div>
    <div className="proposal-actions">
      <button id="proposal-discard" className="btn" disabled={busy} onClick={onDiscard}><X size={15} />丢弃</button>
      <button id="proposal-regenerate" className="btn" disabled={busy} onClick={onRegenerate}><RefreshCw size={15} />{busy ? '叙事者正在重写' : '重新生成'}</button>
      <button id="proposal-accept" className="btn primary" disabled={busy} onClick={onAccept}><Check size={16} />采纳提案</button>
    </div>
  </div>;
}
