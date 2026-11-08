import { Dialog } from './Dialog';
import type { EndingNotice } from '../storylineEnding';

/** 蓝图走到结局时的弹窗（v193）：把「已经结束了」这件事当面说清楚。 */
export function EndingDialog({ notice, girlName, onClose }: { notice: EndingNotice; girlName: string; onClose: () => void }) {
  return <Dialog label="故事线结局" onClose={onClose}>
    <div className="ending-notice" id="storyline-ending" role="status">
      <div className="modal-eyebrow">故事线结局</div>
      <h2>{notice.ending}</h2>
      <p className="ending-notice-line">{girlName} · 「{notice.title}」</p>
      {notice.premise ? <p className="meeting-lead">{notice.premise}</p> : null}
      <p className="ending-notice-note">这条故事线已经走完，之后不会再有新的节点。</p>
      <div className="meeting-actions">
        <button id="storyline-ending-close" type="button" className="btn primary" onClick={onClose}>收下这个结局</button>
      </div>
    </div>
  </Dialog>;
}
