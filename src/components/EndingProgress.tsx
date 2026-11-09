import { Moon } from 'lucide-react';
import { loadBalance } from '../balance';
import { leaveProgress } from '../ending';
import type { GameState } from '../types';

/** v206：首页新闻卡旁的离城终局进度。 */
export function EndingProgress({ state, onOpen }: { state: GameState; onOpen: () => void }) {
  const progress = leaveProgress(state, loadBalance().endingLeaveGold);
  const clickable = progress.ready || progress.done;
  const label = progress.done ? '已离城' : progress.ready ? '可以走了' : '进行中';
  return (
    <button
      type="button"
      id="dispatch-ending"
      className={`dispatch-ending${progress.ready ? ' is-ready' : ''}${progress.done ? ' is-done' : ''}`}
      disabled={!clickable}
      onClick={onOpen}
      aria-label={progress.done ? '查看离城结局' : progress.ready ? '完成离城结局' : '离城结局进度'}
    >
      <span className="dispatch-ending-head"><Moon size={11} /><b>终局 · 离城</b><em>{label}</em></span>
      <span className="dispatch-ending-value">{progress.current.toLocaleString('en-US')}<small>/ {progress.target.toLocaleString('en-US')} 星砂</small></span>
      <span className="dispatch-ending-track" aria-hidden="true"><span style={{ width: `${progress.pct}%` }} /></span>
      <span className="dispatch-ending-note">
        {progress.done ? `已离城 · 第 ${progress.record?.day ?? 0} 日` : progress.ready ? '可以走了 · 点击完成结局' : '攒够就能离开樱雾市'}
      </span>
    </button>
  );
}
