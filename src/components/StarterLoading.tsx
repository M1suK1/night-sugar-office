import { LoaderCircle } from 'lucide-react';

/**
 * 开局读卡时的读条。
 *
 * 30 张卡要一张张解 JSON、降维立绘，几秒钟里界面如果什么都不动，
 * 看起来就像卡死了。这里给出阶段、批次进度与已用时长。
 */
export function StarterLoading({ done, total, note }: { done: number; total: number; note: string }) {
  const safeTotal = Math.max(1, total);
  const percent = Math.min(100, Math.round((done / safeTotal) * 100));
  return (
    <div className="starter-loading-overlay" role="dialog" aria-modal="true" aria-label="正在整理卡库">
      <div className="starter-loading-card">
        <div className="starter-loading-head">
          <LoaderCircle size={18} className="spin" />
          <div><b>正在把卡库摆上桌</b><small id="starter-loading-note">{note}</small></div>
        </div>
        <div className="starter-loading-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="读取进度">
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="starter-loading-foot">
          <span id="starter-loading-done">{done} / {total} 批</span>
          <em>{percent}%</em>
        </div>
        <p className="starter-loading-hint">卡里的立绘会先降维再进名册；落盘时还会搬进资产库，所以第一遍会慢一点，之后快得多。</p>
      </div>
    </div>
  );
}
