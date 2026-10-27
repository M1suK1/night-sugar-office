import { useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AlertTriangle, Brain, Check, ChevronDown, ChevronUp, Copy, FileText, ListOrdered, SlidersHorizontal, Terminal, Trash2 } from 'lucide-react';
import { clearLlmLog, loadLlmLog, type LlmLogEntry } from '../llm';

type Filter = 'all' | 'failed';
type PanelSize = { w: number; h: number };

const SIZE_KEY = 'night-sugar:llm-console-size';
const MIN_SIZE: PanelSize = { w: 380, h: 260 };
const DEFAULT_SIZE: PanelSize = { w: 560, h: 520 };

function clampSize(size: PanelSize): PanelSize {
  const maxW = Math.max(MIN_SIZE.w, window.innerWidth - 80);
  const maxH = Math.max(MIN_SIZE.h, window.innerHeight - 170);
  return { w: Math.min(Math.max(MIN_SIZE.w, Math.round(size.w)), maxW), h: Math.min(Math.max(MIN_SIZE.h, Math.round(size.h)), maxH) };
}

function loadSize(): PanelSize {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return DEFAULT_SIZE;
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (!Number.isFinite(parsed.w) || !Number.isFinite(parsed.h)) return DEFAULT_SIZE;
    return clampSize({ w: Number(parsed.w), h: Number(parsed.h) });
  } catch {
    return DEFAULT_SIZE;
  }
}

function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

function compact(text: string, limit = 120): string {
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function entryText(entry: LlmLogEntry): string {
  const lines = [`[${timeLabel(entry.at)}] ${entry.kind} · ${entry.ok ? '成功' : '失败'}${entry.status ? ` · HTTP ${entry.status}` : ''}`, entry.message];
  if (entry.request) {
    lines.push('', `参数：${Object.entries(entry.request.params).map(([key, value]) => `${key}=${value}`).join('，')}`);
    for (const section of entry.request.sections) lines.push('', `── ${section.label} ──`, section.text);
  }
  if (entry.response?.reasoning) lines.push('', '── 思维链 ──', entry.response.reasoning);
  return lines.join('\n');
}

export function LlmConsole() {
  const [entries, setEntries] = useState<LlmLogEntry[]>(loadLlmLog);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [size, setSize] = useState<PanelSize>(loadSize);
  const [resizing, setResizing] = useState(false);
  const [wide, setWide] = useState(() => window.innerWidth > 800);

  useEffect(() => {
    const onResize = () => { setWide(window.innerWidth > 800); setSize(current => clampSize(current)); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const start = size;
    setResizing(true);
    const move = (moveEvent: PointerEvent) => {
      setSize(clampSize({ w: start.w + (startX - moveEvent.clientX), h: start.h + (startY - moveEvent.clientY) }));
    };
    const up = () => {
      setResizing(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setSize(current => { try { localStorage.setItem(SIZE_KEY, JSON.stringify(current)); } catch { /* 仅本次会话 */ } return current; });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ entry?: LlmLogEntry; cleared?: boolean }>).detail;
      if (detail?.cleared) { setEntries([]); setExpanded(null); return; }
      if (!detail?.entry) return;
      setEntries(current => [detail.entry!, ...current.filter(item => item.id !== detail.entry!.id)].slice(0, 40));
      if (!detail.entry.ok) { setOpen(true); setExpanded(detail.entry.id); }
    };
    window.addEventListener('night-sugar:llm-log', listener);
    return () => window.removeEventListener('night-sugar:llm-log', listener);
  }, []);

  const latest = entries[0];
  const failed = useMemo(() => entries.filter(entry => !entry.ok).length, [entries]);
  const visible = filter === 'failed' ? entries.filter(entry => !entry.ok) : entries;

  const copy = async (entry: LlmLogEntry) => {
    try {
      await navigator.clipboard.writeText(entryText(entry));
      setCopied(entry.id);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return <section
    className={`llm-console ${open ? 'open' : ''} ${resizing ? 'resizing' : ''}`}
    aria-label="叙事引擎日志"
    style={open && wide ? { width: size.w, height: size.h, maxHeight: 'none' } : undefined}
  >
    {open && <span
      id="llm-console-resize"
      className={`llm-console-resize ${resizing ? 'active' : ''}`}
      role="separator"
      aria-label="拖动调整叙事引擎面板大小"
      title="拖动调整大小"
      onPointerDown={startResize}
    />}
    <button type="button" id="llm-console-toggle" className="llm-console-head" aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Terminal size={15} />
      <strong>叙事引擎</strong>
      {latest
        ? <span className={`llm-console-state ${latest.ok ? 'ok' : 'bad'}`}>
            <i />
            {latest.ok ? '最近一次成功' : '最近一次失败'} · {latest.kind} · {timeLabel(latest.at)}
          </span>
        : <span className="llm-console-state idle"><i />还没有调用记录</span>}
      {failed > 0 && <span className="llm-console-count">{failed} 次失败</span>}
      <span className="llm-console-spacer" />
      {open ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
    </button>

    {open && <div className="llm-console-body">
      <div className="llm-console-tools">
        <div className="llm-console-filters" role="group" aria-label="日志筛选">
          <button type="button" id="llm-filter-all" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部 <b>{entries.length}</b></button>
          <button type="button" id="llm-filter-failed" className={filter === 'failed' ? 'active' : ''} onClick={() => setFilter('failed')}>仅失败 <b>{failed}</b></button>
        </div>
        <span className="llm-console-tip"><SlidersHorizontal size={12} />保留最近 40 次 · 拖动左上角调整大小</span>
        <button type="button" id="llm-console-clear" className="llm-console-icon" title="清空日志" onClick={() => { clearLlmLog(); setEntries([]); setExpanded(null); }}>
          <Trash2 size={14} />
        </button>
      </div>

      <div className="llm-console-list">
        {visible.length === 0 && <p className="llm-console-empty">还没有记录。让叙事引擎生成一次提案、起草一位契约者，或和她说句话，这里会显示它读到的全部内容。</p>}
        {visible.map(entry => <article key={entry.id} className={`llm-entry ${entry.ok ? 'ok' : 'bad'} ${expanded === entry.id ? 'expanded' : ''}`}>
          <button type="button" className="llm-entry-head" onClick={() => setExpanded(current => current === entry.id ? null : entry.id)} aria-expanded={expanded === entry.id}>
            <span className="llm-entry-time">{timeLabel(entry.at)}</span>
            <span className="llm-entry-kind">{entry.kind}</span>
            <span className={`llm-entry-badge ${entry.ok ? 'ok' : 'bad'}`}>{entry.ok ? <Check size={11} /> : <AlertTriangle size={11} />}{entry.ok ? '成功' : '失败'}</span>
            {entry.status ? <span className="llm-entry-meta">HTTP {entry.status}</span> : null}
            <span className="llm-entry-meta">{entry.durationMs} ms</span>
            <span className="llm-entry-message">{compact(entry.message)}</span>
            {expanded === entry.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {expanded === entry.id && <div className="llm-entry-detail">
            <div className="llm-entry-facts">
              <span>模型<b>{entry.model || '未填写'}</b></span>
              <span>接口<b>{entry.endpoint}</b></span>
              {entry.request && <span>消息<b>{entry.request.messageCount} 条</b></span>}
              {entry.response?.finish && <span>结束原因<b>{entry.response.finish}</b></span>}
              {entry.response?.usage && <span>用量<b>{entry.response.usage.prompt ?? '?'} → {entry.response.usage.completion ?? '?'} tokens</b></span>}
            </div>
            {entry.request && <>
              <h4><SlidersHorizontal size={12} />本次请求参数</h4>
              <div className="llm-param-grid">
                {Object.entries(entry.request.params).map(([key, value]) => <span key={key}><i>{key}</i><b>{String(value)}</b></span>)}
              </div>
              {entry.request.slots?.length ? <>
                <h4><ListOrdered size={12} />预设槽位 · {entry.request.slots.filter(slot => slot.enabled && !slot.marker).length}/{entry.request.slots.length} 条启用</h4>
                <div className="llm-slots">
                  {entry.request.slots.map(slot => <div key={`${entry.id}-slot-${slot.index}`} id={`llm-slot-${slot.index}`} className={`llm-slot ${slot.enabled ? '' : 'off'} ${slot.marker ? 'marker' : ''}`}>
                    <i>{String(slot.index).padStart(2, '0')}</i>
                    <b>{slot.name}</b>
                    <em>{slot.marker ? '分隔' : slot.role}</em>
                    <small>{slot.tokens}t</small>
                  </div>)}
                </div>
              </> : null}
              <h4><FileText size={12} />本次读到的内容{entry.request.truncated ? '（已截断）' : ''}</h4>
              <div className="llm-sections">
                {entry.request.sections.map((section, index) => <details key={`${entry.id}-${index}`} open={index === 0}>
                  <summary><span>{section.label}</span><em>{section.text.length} 字</em></summary>
                  <pre>{section.text}</pre>
                </details>)}
              </div>
            </>}
            {entry.response?.reasoning
              ? <><h4><Brain size={12} />思维链</h4><pre className="llm-reasoning">{entry.response.reasoning}</pre></>
              : <p className="llm-no-reasoning">这次响应没有思维链字段（部分模型或网关不会返回 reasoning_content）。</p>}
            {!entry.ok && <p className="llm-error">{entry.message}</p>}
            <button type="button" className="llm-copy" id={`llm-copy-${entry.id}`} onClick={() => void copy(entry)}>
              {copied === entry.id ? <Check size={12} /> : <Copy size={12} />}{copied === entry.id ? '已复制' : '复制这次调用'}
            </button>
          </div>}
        </article>)}
      </div>
    </div>}
  </section>;
}
