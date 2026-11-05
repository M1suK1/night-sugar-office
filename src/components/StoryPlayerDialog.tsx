import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Heart, Sparkles, X } from 'lucide-react';
import type { CharacterEvent, Girl } from '../types';
import { GirlPortrait } from './GirlPortrait';
import { VnReader } from '../vn/VnReader';
import { VnModeRow, VnModeToggle } from '../vn/VnModeToggle';
import { beatsFromPassage } from '../vn/beats';

/** 分幕剧情：一次完整故事，每段结尾做一次选择，直到收束。 */
export function StoryPlayerDialog({ event, girl, busy, vnStory = false, onChoose, onClose }: {
  event: CharacterEvent;
  girl?: Girl;
  busy?: boolean;
  /** 视觉小说模式（v93 全局开关）：开着时正文区换成一句句演的舞台。 */
  vnStory?: boolean;
  onChoose: (eventId: string, choiceId: string) => void;
  onClose: () => void;
}) {
  const passages = event.passages ?? [];
  const index = Math.min(event.passageIndex ?? 0, Math.max(0, passages.length - 1));
  const current = passages[index];
  const done = event.status === 'done';
  const started = useRef(false);
  // 舞台里点「原文」：本次弹窗内临时回到整段文字，不改全局开关。
  const [textMode, setTextMode] = useState(false);
  const stage = Boolean(vnStory) && !textMode;
  const beats = useMemo(
    () => (current ? beatsFromPassage(current, { speakerId: girl?.id, speakerName: girl?.name, expression: girl?.expression ?? 'calm', element: girl?.element }) : []),
    [current, girl?.id, girl?.name, girl?.expression, girl?.element],
  );
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!started.current) { started.current = true; return; }
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [index, done]);

  const history = passages.slice(0, done ? passages.length : index);

  return (
    <div className="story-player" role="dialog" aria-modal="true">
      <aside className="story-player-side">
        <div className="story-portrait">{girl && <GirlPortrait girl={girl} variant="full" />}</div>
        <div className="story-player-meta">
          <b>{girl?.name ?? '她'}</b>
          <span>{girl?.codename}</span>
          <div className="story-player-stats">
            <span><Heart size={12} /> 羁绊 {girl?.bond ?? 0}</span>
            <span>侵蚀 {girl?.corruption ?? 0}</span>
          </div>
        </div>
        <div className="story-player-progress">
          {passages.map((passage, at) => (
            <span key={passage.id} className={at < index || done ? 'done' : at === index ? 'now' : ''} title={passage.title} />
          ))}
        </div>
      </aside>

      <button id="story-dismiss" type="button" className="story-dismiss" aria-label="关闭剧情" onClick={onClose}><X size={16} /></button>
      <section className="story-player-main">
        <header className="story-player-head">
          <span className="modal-eyebrow"><BookOpen size={13} />角色剧情 · {event.title}</span>
          <h2>{done ? '这件事收束了。' : current?.title ?? event.title}</h2>
          <p>{event.hook}</p>
        </header>

        {Boolean(vnStory) && textMode && !busy && (
          <VnModeRow><VnModeToggle id="story-vn-enter" onSwitch={() => setTextMode(false)} /></VnModeRow>
        )}

        {stage && current && !busy && (
          <VnReader
            beats={beats}
            title={`${event.title} · ${current.title ?? ''}`}
            cast={girl ? [{ id: girl.id, name: girl.name, girl }] : []}
            onChoose={choiceId => onChoose(event.id, choiceId)}
            onText={() => setTextMode(true)}
            onClose={onClose}
          />
        )}
        {stage && current && !busy ? null : (
        <div className="story-player-body" ref={bodyRef} role="log">
          {history.map(passage => (
            <article key={passage.id} className="story-passage past">
              {passage.title && <h3>{passage.title}</h3>}
              <p className="story-narration">{passage.narration}</p>
              {passage.lines.map((line, at) => (
                <p key={at} className={`story-line ${line.tone ?? ''}`}><b>{line.speaker}</b><span>{line.text}</span></p>
              ))}
              {event.chosen?.[passages.indexOf(passage)] && (
                <p className="story-picked">你选择了：{passage.choices.find(choice => choice.id === event.chosen?.[passages.indexOf(passage)])?.label}</p>
              )}
            </article>
          ))}

          {!done && current && (
            <article className="story-passage now">
              {busy ? <p className="story-wait">叙事者正在把这一段写下去……</p> : <>
                <p className="story-narration">{current.narration}</p>
                {current.lines.map((line, at) => (
                  <p key={at} className={`story-line ${line.tone ?? ''}`}><b>{line.speaker}</b><span>{line.text}</span></p>
                ))}
              </>}
            </article>
          )}

          {done && (
            <article className="story-passage ending">
              <p className="story-narration">{event.summary || '这一晚到这里。她把没说完的话留在了门口。'}</p>
            </article>
          )}
        </div>
        )}

        {!stage && <footer className="story-player-actions">
          {busy ? (
            <span className="story-busy"><Sparkles size={13} />叙事者正在写……</span>
          ) : done ? (
            <button id="story-close" type="button" className="btn primary" onClick={onClose}>把这段收进记忆</button>
          ) : current && current.choices.length ? (
            <div className="story-choices">
              {current.choices.map(choice => (
                <button key={choice.id} id={`story-choice-${choice.id}`} type="button" className="btn story-choice" onClick={() => onChoose(event.id, choice.id)}>
                  <span>{choice.label}</span>
                  {choice.effect && <em>{effectHint(choice.effect)}</em>}
                  <ArrowRight size={13} />
                </button>
              ))}
            </div>
          ) : (
            <button id="story-close" type="button" className="btn" onClick={onClose}>收起</button>
          )}
        </footer>}
      </section>
    </div>
  );
}

function effectHint(effect: { bond?: number; corruption?: number; gold?: number; reputation?: number }): string {
  const parts: string[] = [];
  if (effect.bond) parts.push(`羁绊 ${effect.bond > 0 ? '+' : ''}${effect.bond}`);
  if (effect.corruption) parts.push(`侵蚀 ${effect.corruption > 0 ? '+' : ''}${effect.corruption}`);
  if (effect.gold) parts.push(`星砂 ${effect.gold > 0 ? '+' : ''}${effect.gold}`);
  if (effect.reputation) parts.push(`安定度 ${effect.reputation > 0 ? '+' : ''}${effect.reputation}`);
  return parts.join(' · ');
}
