import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Terminal, X } from 'lucide-react';

type Line = { kind: 'in' | 'out' | 'err'; text: string };

const banner: Line[] = [
  { kind: 'out', text: '夜糖事务所 · 值班终端 v1.0' },
  { kind: 'out', text: '输入 help 查看命令；↑↓ 翻历史，Esc 关闭。' },
];

const quick = ['help', 'status', 'advance 30', 'end', 'generate', 'page base', 'district candy'];

export function CommandConsole({ onRun, onClose }: { onRun: (line: string) => Promise<string>; onClose: () => void }) {
  const [lines, setLines] = useState<Line[]>(banner);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [busy, setBusy] = useState(false);
  const output = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => { output.current?.scrollTo({ top: output.current.scrollHeight }); }, [lines, busy]);
  useEffect(() => { field.current?.focus(); }, []);

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;
    setHistory(list => [text, ...list].slice(0, 40));
    setCursor(-1);
    setInput('');
    if (text === 'clear' || text === '清屏') { setLines([]); return; }
    setLines(list => [...list, { kind: 'in', text }]);
    setBusy(true);
    try {
      const reply = await onRun(text);
      if (reply) setLines(list => [...list, { kind: reply.startsWith('未知命令') || reply.startsWith('无法') ? 'err' : 'out', text: reply }]);
    } catch (error) {
      setLines(list => [...list, { kind: 'err', text: error instanceof Error ? error.message : '命令执行失败。' }]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = Math.min(history.length - 1, cursor + 1);
      if (next >= 0) { setCursor(next); setInput(history[next]); }
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = cursor - 1;
      setCursor(next);
      setInput(next < 0 ? '' : history[next]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return <div className="cmd-overlay" onClick={onClose}>
    <section className="cmd-panel" role="dialog" aria-modal="true" aria-label="事务所终端" onClick={event => event.stopPropagation()}>
      <header className="cmd-head">
        <span className="cmd-mark"><Terminal size={14} />CMD</span>
        <div>
          <strong>事务所终端</strong>
          <small>Ctrl+K 开关 · 输入 help 查看命令</small>
        </div>
        <button id="cmd-close" type="button" className="cmd-close" onClick={onClose} aria-label="关闭终端"><X size={15} /></button>
      </header>
      <div className="cmd-output" id="cmd-output" ref={output} role="log" aria-live="polite">
        {lines.map((line, index) => <p key={`${line.kind}-${index}`} className={`cmd-line ${line.kind}`}>{line.kind === 'in' ? <><span className="cmd-caret">›</span>{line.text}</> : line.text}</p>)}
        {busy && <p className="cmd-line out cmd-busy">执行中…</p>}
      </div>
      <form id="cmd-form" className="cmd-input-row" onSubmit={event => { event.preventDefault(); void submit(input); }}>
        <span className="cmd-caret">›</span>
        <input
          id="cmd-input"
          ref={field}
          value={input}
          onChange={event => setInput(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={busy ? '等待叙事者回应…' : 'help / status / advance 30 / end / district candy'}
          aria-label="终端命令"
          autoComplete="off"
          spellCheck={false}
        />
        <button id="cmd-run" type="submit" className="cmd-send" disabled={busy} aria-label="执行命令"><CornerDownLeft size={15} /></button>
      </form>
      <footer className="cmd-hints">
        {quick.map(command => <button key={command} type="button" className="cmd-chip" onClick={() => { setInput(command); field.current?.focus(); }}>{command}</button>)}
      </footer>
    </section>
  </div>;
}
