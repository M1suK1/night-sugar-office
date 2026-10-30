import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Moon } from 'lucide-react';
import { PROLOGUE } from '../prologue.ts';

/**
 * 开场三幕：一段旁白 + 少量台词，翻页推进。
 * 只用 CSS 动效（无图片、无动画库），所以加载慢也不会白屏。
 */
export function PrologueDialog({ onDone, replay = false }: { onDone: () => void; replay?: boolean }) {
  const [index, setIndex] = useState(0);
  const [closing, setClosing] = useState(false);
  const beat = PROLOGUE[index];
  const last = index === PROLOGUE.length - 1;

  const finish = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onDone, 260);
  }, [closing, onDone]);

  const next = useCallback(() => {
    if (last) finish();
    else setIndex(i => i + 1);
  }, [last, finish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { finish(); return; }
      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, finish]);

  return (
    <div className={`prologue-overlay${closing ? ' closing' : ''}`} role="dialog" aria-modal="true" aria-label="开场：面见三方与今晚的处境">
      <div className="prologue-stage" data-scene={beat.scene}>
        <div className="prologue-sky" aria-hidden="true">
          <span className="prologue-moon"><Moon size={64} strokeWidth={1.2} /></span>
          <span className="prologue-glow" />
        </div>
        <div className="prologue-panel" id="prologue-beat" key={beat.id}>
          <span className="prologue-step">
            <b>{String(index + 1).padStart(2, '0')}</b>
            <i />
            <em>{beat.title}</em>
          </span>
          {beat.narration.map((line, i) => (
            <p className="prologue-narration" key={`${beat.id}-n${i}`} style={{ animationDelay: `${i * 110}ms` }}>{line}</p>
          ))}
          {beat.lines.length > 0 && (
            <ul className="prologue-lines">
              {beat.lines.map((line, i) => (
                <li
                  key={`${beat.id}-l${i}`}
                  className={`prologue-line side-${line.side ?? (i % 2 === 0 ? 'left' : 'right')}`}
                  style={{ animationDelay: `${220 + i * 160}ms`, ['--line-color' as string]: line.color ?? '#e7d9ea' }}
                >
                  <b>{line.speaker}</b>
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="prologue-foot">
          <div className="prologue-dots" aria-hidden="true">
            {PROLOGUE.map((item, i) => <i key={item.id} className={i === index ? 'on' : i < index ? 'done' : ''} />)}
          </div>
          <div className="prologue-actions">
            <button id="prologue-skip" type="button" className="ghost" onClick={finish}>{replay ? '关闭' : '跳过'}</button>
            <button id="prologue-next" type="button" className="primary" onClick={next}>
              {last ? (replay ? '看完了' : '推开门') : '继续'}
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
        <span className="prologue-hint">按 → / 回车 继续，Esc 跳过</span>
      </div>
    </div>
  );
}
