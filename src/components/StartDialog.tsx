import { Moon, Sparkles, ArrowRight } from 'lucide-react';

export function StartDialog({ onStandard, onBlank }: { onStandard: () => void; onBlank: () => void }) {
  return (
    <div className="start-overlay" role="dialog" aria-modal="true" aria-label="开始新的一夜">
      <div className="start-card">
        <span className="modal-eyebrow"><Moon size={14} />夜糖事务所 / 第 014 号值班席</span>
        <h1>今晚，从哪一页开始？</h1>
        <p className="start-lead">标准开局会继承已经谈好的契约与七条城市信号；空白档案只留下会客厅、一笔启动资金，和一处还没被填满的辖区版图。</p>
        <div className="start-options">
          <button id="start-standard" type="button" className="start-option" onClick={onStandard}>
            <span className="start-option-icon"><Moon size={20} /></span>
            <b>标准开局</b>
            <small>六位契约者、七条委托、已分配的九辖区。适合直接进入夜班。</small>
            <em>继续已有的一夜<ArrowRight size={14} /></em>
          </button>
          <button id="start-blank" type="button" className="start-option blank" onClick={onBlank}>
            <span className="start-option-icon"><Sparkles size={20} /></span>
            <b>空白档案</b>
            <small>只有会客厅与 6,000 星砂，没有契约者、没有委托，安定度为 0。</small>
            <em>从一张白纸开始<ArrowRight size={14} /></em>
          </button>
        </div>
        <p className="start-note">之后可以在「设置 → 重置进度」里切换开局方式；当前进度会先导出提醒。</p>
      </div>
    </div>
  );
}
