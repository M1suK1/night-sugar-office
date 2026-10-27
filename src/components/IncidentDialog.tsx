import { AlertTriangle, Heart, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import type { GameState, Incident } from '../types';
import { factionInfo } from '../content/items';
import { districts } from '../districts';

const kindLabel: Record<Incident['kind'], string> = {
  faction: '三方势力',
  environment: '环境变化',
  girl: '契约者状态',
};

export function IncidentDialog({ incident, state, onChoose, onGirl }: { incident: Incident; state: GameState; onChoose: (optionId: string) => void; onGirl?: (id: string) => void }) {
  const girl = incident.girlId ? state.girls.find(item => item.id === incident.girlId) : undefined;
  const district = incident.district ? districts[incident.district] : undefined;
  return (
    <div className="incident-overlay" role="dialog" aria-modal="true" aria-label={incident.title}>
      <div className="incident-card">
        <header className="incident-head">
          <span className={`incident-kind ${incident.kind}`}><AlertTriangle size={13} />{kindLabel[incident.kind]}</span>
          <span className="incident-source">{incident.source === 'llm' ? '叙事者拟稿' : '事务规则'}</span>
        </header>
        <h2>{incident.title}</h2>
        {incident.faction && <p className="incident-meta"><ShieldCheck size={12} />{factionInfo[incident.faction].name} · {factionInfo[incident.faction].envoy}</p>}
        {district && <p className="incident-meta"><MapPin size={12} />{district.name}</p>}
        {girl && <p className="incident-meta"><Heart size={12} /><button type="button" className="incident-girl" onClick={() => onGirl?.(girl.id)}>{girl.name}</button> · 疲劳 {girl.fatigue} / 侵蚀 {girl.corruption}</p>}
        <p className="incident-body">{incident.body}</p>
        <div className="incident-options">
          {incident.options.map((option, index) => (
            <button key={option.id} id={`incident-option-${option.id}`} type="button" className="incident-option" onClick={() => onChoose(option.id)}>
              <em>{index + 1}</em>
              <span><b>{option.label}</b><small>{option.hint}</small></span>
            </button>
          ))}
        </div>
        <footer className="incident-foot"><Sparkles size={12} />必须现在决定。处理完才能继续推进时间。</footer>
      </div>
    </div>
  );
}

