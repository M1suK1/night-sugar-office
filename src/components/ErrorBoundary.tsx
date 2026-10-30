import { Component, type ErrorInfo, type ReactNode } from 'react';
import { kvGet } from '../store';
import { SAVE_CURRENT_KEY } from '../migrate';
import { SAVE_KEY } from '../game';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('夜糖事务所遇到未处理的界面错误', error, info.componentStack);
  }

  /** 应急导出：优先从 IndexedDB 取，取不到再退回旧的 localStorage 键。 */
  async exportEmergency() {
    let raw = '';
    try {
      const stored = await kvGet<unknown>(SAVE_CURRENT_KEY);
      if (stored) raw = JSON.stringify(stored);
    } catch { /* IndexedDB 不可用时退回 localStorage。 */ }
    if (!raw) {
      try { raw = localStorage.getItem(SAVE_KEY) ?? ''; } catch { raw = ''; }
    }
    if (!raw) return;
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    anchor.download = '夜糖事务所-应急存档.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal-screen">
        <div className="fatal-card" role="alert">
          <span className="fatal-eyebrow">夜班中断</span>
          <h1>事务所的灯忽然暗了一下。</h1>
          <p>界面遇到了未处理的错误。你的存档仍保存在当前浏览器中，可以先导出备份，再刷新页面继续。</p>
          <pre>{this.state.error.message}</pre>
          <div className="fatal-actions">
            <button id="fatal-reload" className="btn primary" onClick={() => window.location.reload()}>刷新并继续</button>
            <button id="fatal-export" className="btn" onClick={() => { void this.exportEmergency(); }}>导出应急存档</button>
          </div>
          <small>如果问题反复出现，请把上面的错误信息与浏览器控制台记录一起反馈。</small>
        </div>
      </div>
    );
  }
}
