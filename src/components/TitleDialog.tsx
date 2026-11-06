import { BookOpen, Moon, Sparkles, ArrowRight, FolderOpen, Settings2, Users } from 'lucide-react';

/**
 * 标题页：开场只问一次「怎么开始」。
 * 三个主入口（新游戏 / 读取存档 / 设置）+ 一个次级空白档案，
 * 具体信息全部由 App 传进来——这里不碰 state，方便在还没读档时渲染。
 */
export function TitleDialog({ cards, hint, onNew, onLoad, onSettings, onBlank, onStories }: {
  /** 契约卡库里有几张卡；0 表示会用默认六人。 */
  cards: number;
  /** 一句话状态：卡库几张、当前进度停在第几日。 */
  hint: string;
  onNew: () => void;
  onLoad: () => void;
  onSettings: () => void;
  onBlank: () => void;
  /** v176：观看保存在本地的剧情（不用读档）。 */
  onStories?: () => void;
}) {
  return (
    <div className="start-overlay" role="dialog" aria-modal="true" aria-label="夜糖事务所 · 开始">
      <div className="start-card title-card">
        <span className="modal-eyebrow"><Moon size={14} />夜糖事务所 / 第 014 号值班席</span>
        <h1>今晚，从哪一页开始？</h1>
        <p className="start-lead">
          新的一夜先把名册定下来：卡库里有卡就从卡里挑人，没有卡就用默认的四位在编少女。三方首领与随从也在同一步分配。
        </p>
        <div className="start-options title-options">
          <button id="start-new" type="button" className="start-option title-primary" onClick={onNew}>
            <span className="start-option-icon"><Sparkles size={20} /></span>
            <b>开始新游戏</b>
            <small>{cards > 0 ? `卡库里有 ${cards} 张契约卡，会先让你从里面挑人。` : '卡库里还没有卡，开局用默认的四位在编少女编成三方。'}</small>
            <em>从名册开始<ArrowRight size={14} /></em>
          </button>
          <button id="start-load" type="button" className="start-option" onClick={onLoad}>
            <span className="start-option-icon"><FolderOpen size={20} /></span>
            <b>读取存档</b>
            <small>三个档位、项目目录里的导出文件，或者接着上次那一夜。</small>
            <em>回到已有的夜<ArrowRight size={14} /></em>
          </button>
          {onStories && (
            <button id="start-stories" type="button" className="start-option" onClick={onStories}>
              <span className="start-option-icon"><BookOpen size={20} /></span>
              <b>观看保存的剧情</b>
              <small>演完的对话存在本地，不用读档也能在这里重看。</small>
              <em>翻旧的夜<ArrowRight size={14} /></em>
            </button>
          )}
          <button id="start-settings" type="button" className="start-option" onClick={onSettings}>
            <span className="start-option-icon"><Settings2 size={20} /></span>
            <b>设置</b>
            <small>故事引擎的接口与预设、玩家档案、减少动态效果，以及契约卡库。</small>
            <em>先调好再开始<ArrowRight size={14} /></em>
          </button>
          <button id="start-blank" type="button" className="start-option blank" onClick={onBlank}>
            <span className="start-option-icon"><Users size={20} /></span>
            <b>空白档案</b>
            <small>只有会客厅与 6,000 星砂，没有契约者、没有委托，安定度为 0。</small>
            <em>从一张白纸开始<ArrowRight size={14} /></em>
          </button>
        </div>
        <p className="start-note" id="start-hint">{hint}</p>
      </div>
    </div>
  );
}
