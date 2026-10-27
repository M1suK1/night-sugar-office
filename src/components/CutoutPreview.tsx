import { ArrowRight, RotateCcw, Scissors, Undo2 } from 'lucide-react';

interface Props {
  before: string;
  after: string;
  removed: number;
  tolerance: number;
  note?: string;
  busy?: boolean;
  onApply: () => void;
  onDiscard: () => void;
  onRetry: () => void;
}

/** 去背景前后对比：棋盘格暴露透明区域，先看再决定。 */
export function CutoutPreview({ before, after, removed, tolerance, note, busy, onApply, onDiscard, onRetry }: Props) {
  const percent = Math.min(100, Math.max(0, Math.round(removed * 100)));
  return (
    <section className="cutout-preview" aria-label="去背景预览">
      <div className="cutout-figures">
        <figure className="cutout-figure">
          <img src={before} alt="原图" />
          <figcaption>原图</figcaption>
        </figure>
        <ArrowRight size={16} className="cutout-arrow" aria-hidden="true" />
        <figure className="cutout-figure on-checker">
          <img src={after} alt="去背景后的效果" />
          <figcaption>去背景后</figcaption>
        </figure>
      </div>
      <div className="cutout-copy">
        <b>先看一眼，再决定。</b>
        <p>已移除边缘背景约 {percent}% · 当前容差 {tolerance}{note ? ` · ${note}` : ''}</p>
        <div className="cutout-actions">
          <button id="cutout-apply" type="button" className="btn primary" onClick={onApply} disabled={busy}>
            <Scissors size={14} />应用这一版
          </button>
          <button id="cutout-discard" type="button" className="btn" onClick={onDiscard} disabled={busy}>
            <Undo2 size={14} />保留原图
          </button>
          <button id="cutout-retry" type="button" className="btn" onClick={onRetry} disabled={busy}>
            <RotateCcw size={14} />{busy ? '重新计算中' : '重新计算'}
          </button>
        </div>
      </div>
    </section>
  );
}
