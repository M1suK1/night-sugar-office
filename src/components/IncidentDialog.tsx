import { AlertTriangle, Clock3, Heart, MapPin, MessageSquareQuote, ShieldCheck, Sparkles } from 'lucide-react';
import type { GameState, Incident } from '../types';
import { factionInfo } from '../content/items';
import { districts } from '../districts';
import { incidentCategoryOf, incidentRemaining } from '../incidents';

const kindLabel: Record<Incident['kind'], string> = {
  faction: '三方势力',
  environment: '环境变化',
  girl: '契约者状态',
};

const categoryLabel = { report: '通报', decision: '要拿主意', scene: '一段剧情' } as const;

export function IncidentDialog({ incident, state, onChoose, onGirl }: { incident: Incident; state: GameState; onChoose: (optionId?: string) => void; onGirl?: (id: string) => void }) {
  const girl = incident.girlId ? state.girls.find(item => item.id === incident.girlId) : undefined;
  const district = incident.district ? districts[incident.district] : undefined;
  const category = incidentCategoryOf(incident);
  const remaining = incidentRemaining(incident, { day: state.day, minutes: state.minutes });
  const sceneLines = incident.scene?.lines ?? [];
  return (
    <div className="incident-overlay" role="dialog" aria-modal="true" aria-label={incident.title}>
      <div className={`incident-card ${category}`} id="incident-card">
        <header className="incident-head">
          <span className={`incident-kind ${incident.kind}`}><AlertTriangle size={13} />{kindLabel[incident.kind]}</span>
          <span className={`incident-category ${category}`}>{categoryLabel[category]}</span>
          <span className="incident-source">{incident.source === 'llm' ? '叙事者拟稿' : incident.source === 'custom' ? '工坊投放' : '事务规则'}</span>
          <span className="incident-ttl" id="incident-ttl"><Clock3 size={12} />{Math.max(0, Math.round(remaining))} 分钟内不处理会自己过去</span>
        </header>
        <h2>{incident.title}</h2>
        {incident.faction && <p className="incident-meta"><ShieldCheck size={12} />{factionInfo[incident.faction].name} · {factionInfo[incident.faction].envoy}</p>}
        {district && <p className="incident-meta"><MapPin size={12} />{district.name}</p>}
        {girl && <p className="incident-meta"><Heart size={12} /><button type="button" className="incident-girl" onClick={() => onGirl?.(girl.id)}>{girl.name}</button> · 疲劳 {girl.fatigue} / 侵蚀 {girl.corruption}</p>}
        <p className="incident-body">{incident.body}</p>
        {sceneLines.length > 0 && (
          <div className="incident-scene" id="incident-scene">
            {incident.scene?.narration && <p className="incident-narration">{incident.scene.narration}</p>}
            {sceneLines.map((line, index) => (
              <p key={`${line.speaker}-${index}`} className="incident-line">
                <b>{line.speaker}</b>
                <span>{line.text}</span>
              </p>
            ))}
          </div>
        )}
        <div className="incident-options">
          {incident.options.map((option, index) => (
            <button key={option.id} id={`incident-option-${option.id}`} type="button" className="incident-option" onClick={() => onChoose(option.id)}>
              <em>{index + 1}</em>
              <span><b>{option.label}</b><small>{option.hint}</small></span>
            </button>
          ))}
          {incident.options.length === 0 && (
            <button id="incident-acknowledge" type="button" className="incident-option acknowledge" onClick={() => onChoose()}>
              <MessageSquareQuote size={14} />
              <span><b>知道了</b><small>这条不用拿主意，看过就行。</small></span>
            </button>
          )}
        </div>
        <footer className="incident-foot"><Sparkles size={12} />处理完才能继续推进时间；放着不管它也会到点过去，只是会留下代价。</footer>
      </div>
    </div>
  );
}
