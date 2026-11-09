import { Dialog } from './Dialog';
import { loadBalance } from '../balance';
import { LEAVE_ENDING } from '../ending';
import type { EndingRecord, GameState } from '../types';

/** v206：离城确认框与落幕页。 */
export function CampaignEndingDialog({ phase, state, record, onConfirm, onClose }: {
  phase: 'confirm' | 'done';
  state: GameState;
  record?: EndingRecord;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (phase === 'confirm') {
    return <Dialog label="离城确认" onClose={onClose}>
      <div className="campaign-ending" id="ending-leave-confirm">
        <div className="modal-eyebrow">终局 · 离城</div>
        <h2>把事务所留在身后？</h2>
        <p className="meeting-lead">星砂已经够数。现在离开樱雾市，这一局会记下结局；事务所不会消失，之后仍可继续经营。</p>
        <div className="ending-facts">
          <span>当前星砂<b>{state.gold.toLocaleString('en-US')}</b></span>
          <span>离城门槛<b>{loadBalance().endingLeaveGold.toLocaleString('en-US')}</b></span>
        </div>
        <div className="meeting-actions">
          <button type="button" className="btn" onClick={onClose}>再留一阵</button>
          <button id="ending-leave-confirm" type="button" className="btn primary" onClick={onConfirm}>离开樱雾市</button>
        </div>
      </div>
    </Dialog>;
  }
  if (!record) return null;
  return <Dialog label="离城结局" onClose={onClose}>
    <div className="campaign-ending is-done" id="ending-leave">
      <div className="modal-eyebrow">终局 · 第 {record.day} 日</div>
      <h2>{LEAVE_ENDING.title}</h2>
      <p className="meeting-lead">{LEAVE_ENDING.epilogue}</p>
      <div className="ending-facts">
        <span>离城时星砂<b>{record.gold.toLocaleString('en-US')}</b></span>
        <span>城市安定度<b>{record.reputation}</b></span>
        <span>在册契约<b>{record.girls} 人</b></span>
      </div>
      <div className="meeting-actions">
        <button id="ending-leave-close" type="button" className="btn primary" onClick={onClose}>继续这一局</button>
      </div>
    </div>
  </Dialog>;
}
