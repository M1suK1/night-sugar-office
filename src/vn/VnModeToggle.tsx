import { Clapperboard } from 'lucide-react';
import './vn.css';

/**
 * 「切回演出」按钮：原文（文字）视图里用来回到视觉小说界面。
 * 与 VnReader 工具栏里的 .vn-chip 保持同一套暗紫细描边风格。
 */
export function VnModeToggle({ onSwitch, label = '演出', id = 'vn-enter' }: {
  onSwitch: () => void;
  label?: string;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      className="vn-chip vn-mode-toggle"
      title="切回视觉小说演出界面"
      onClick={onSwitch}
    >
      <Clapperboard size={11} />{label}
    </button>
  );
}

/** 文字视图里顶部的一行按钮槽位（右对齐）。 */
export function VnModeRow({ children }: { children: React.ReactNode }) {
  return <div className="vn-mode-row">{children}</div>;
}
