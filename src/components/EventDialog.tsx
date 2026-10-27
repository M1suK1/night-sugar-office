import { useEffect, useState } from 'react';
import { ArrowRight, ChevronRight, MessageCircle, Sparkles, X } from 'lucide-react';
import type { CharacterEvent, Girl } from '../types';
import { GirlPortrait } from './GirlPortrait';

export function EventDialog({ event, girl, onAdvance, onChoose, onClose }: { event: CharacterEvent; girl?: Girl; onAdvance: (eventId: string) => void; onChoose: (eventId: string, choiceId: string) => void; onClose: () => void }) {
  const scene = event.scenes[Math.min(event.stage, event.scenes.length - 1)];
  const [revealed, setRevealed] = useState(1);
  useEffect(() => { setRevealed(1); }, [event.id, event.stage]);

  if (!scene) return null;
  const allShown = revealed >= scene.lines.length;
  const last = event.stage >= event.scenes.length - 1;

  return (
    <div className="event-modal">
      <button id="event-close" type="button" className="event-close" aria-label="关闭事件" onClick={onClose}><X size={15} /></button>
      <div className="event-head">
        <span className="modal-eyebrow"><Sparkles size={13} />角色事件 · 第 {event.stage + 1} / {event.scenes.length} 场</span>
        <h2>{scene.title}</h2>
        <p className="event-title">{event.title} · {event.hook}</p>
      </div>
      <div className="event-body">
        {girl && <div className="event-figure"><GirlPortrait girl={girl} variant="full" /></div>}
        <div className="event-script" role="log">
          <p className="event-narration">{scene.narration}</p>
          {scene.lines.slice(0, revealed).map((line, index) => (
            <p key={index} className={`event-line ${line.tone ?? ''}`}>
              <b>{line.speaker}</b>
              <span>{line.text}</span>
            </p>
          ))}
        </div>
      </div>
      <footer className="event-actions">
        {!allShown ? (
          <button id="event-next-line" type="button" className="btn primary" onClick={() => setRevealed(value => value + 1)}><MessageCircle size={14} />继续<ChevronRight size={14} /></button>
        ) : last && scene.choices?.length ? (
          <div className="event-choices">
            {scene.choices.map(choice => (
              <button key={choice.id} id={`event-choice-${choice.id}`} type="button" className="btn" onClick={() => onChoose(event.id, choice.id)}>{choice.label}<ArrowRight size={13} /></button>
            ))}
          </div>
        ) : last ? (
          <button id="event-finish" type="button" className="btn primary" onClick={onClose}>把这一幕收进记忆</button>
        ) : (
          <button id="event-advance" type="button" className="btn primary" onClick={() => onAdvance(event.id)}>下一场<ArrowRight size={14} /></button>
        )}
      </footer>
    </div>
  );
}
