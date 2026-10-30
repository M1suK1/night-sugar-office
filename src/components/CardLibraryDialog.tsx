import { useEffect, useMemo, useRef, useState } from 'react';
import { FileJson, FolderOpen, Info, Loader2, ScanLine, Search, Trash2, Upload, X } from 'lucide-react';
import {
  CARD_BOX_LIMIT, cardBoxTagLabel, cardboxAdd, cardboxCards, cardboxFilter, cardboxRemove, loadCardBox,
} from '../cardbox.ts';
import type { CardBoxEntry } from '../cardbox.ts';
import { girlFactionColors } from '../factions.ts';
import type { GirlCard } from '../types.ts';

type Failure = { name: string; message: string };

interface ScanResult {
  ok: boolean;
  dir?: string;
  message?: string;
  files?: { name: string; text: string }[];
  skipped?: { name: string; reason: string }[];
}

export function CardLibraryDialog({ onImport, notify }: {
  onImport: (cards: GirlCard[]) => void;
  notify: (text: string, ok?: boolean) => void;
}) {
  const [entries, setEntries] = useState<CardBoxEntry[]>([]);
  useEffect(() => { void loadCardBox().then(setEntries); }, []);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [errors, setErrors] = useState<Failure[]>([]);
  const [busy, setBusy] = useState('');
  const [dir, setDir] = useState('');
  const [scanning, setScanning] = useState(false);
  const folderRef = useRef<HTMLInputElement>(null);
  const shown = useMemo(() => cardboxFilter(entries, query), [entries, query]);
  const pickedSet = new Set(picked);

  const toggle = (hash: string) => setPicked(list => list.includes(hash) ? list.filter(item => item !== hash) : [...list, hash]);

  /** 所有入口最后都走这里：收进卡库，并把这次新收的自动勾上，省掉再点一次全选。 */
  const absorb = async (inputs: { name: string; text: string }[], failed: Failure[] = []) => {
    const result = await cardboxAdd(inputs, entries);
    setEntries(result.entries);
    setErrors([...failed, ...result.failed]);
    setPicked(result.added.map(entry => entry.hash));
    return result;
  };

  const intake = async (files: File[]) => {
    const list = files.filter(file => file.name.toLowerCase().endsWith('.json') || file.type === 'application/json');
    if (!list.length) { notify('这些文件不是 JSON 契约卡。', false); return; }
    setBusy(`已读 0 / ${list.length}`);
    const failed: Failure[] = [];
    const inputs: { name: string; text: string }[] = [];
    for (let index = 0; index < list.length; index += 1) {
      try {
        inputs.push({ name: list[index].name, text: await list[index].text() });
      } catch {
        failed.push({ name: list[index].name, message: '这个文件读不出来' });
      }
      setBusy(`已读 ${index + 1} / ${list.length}`);
    }
    setBusy('');
    const result = await absorb(inputs, failed);
    if (result.added.length) notify(`收进卡库 ${result.added.length} 张，已自动选中。`);
    else if (result.duplicates.length) notify('这些卡已经在库里了。', false);
    else if (failed.length || result.failed.length) notify('这些文件没能收进卡库。', false);
  };

  /** 走本地服务读路径：只有 npm run dev / start.cmd 起来的站点才有这个接口。 */
  const scanDir = async () => {
    const target = dir.trim();
    if (!target) { notify('先填一个目录，例如 G:\\cards 或 ~/cards。', false); return; }
    setScanning(true);
    try {
      const response = await fetch(`/api/cards?dir=${encodeURIComponent(target)}`);
      const text = await response.text();
      let data: ScanResult | null = null;
      try { data = JSON.parse(text) as ScanResult; } catch { data = null; }
      if (!data) { notify('这台机器上没有本地读取接口（静态部署读不了路径），请用「选择文件夹」。', false); return; }
      if (!data.ok || !data.files) {
        setErrors(data.skipped?.map(item => ({ name: item.name, message: item.reason })) ?? []);
        notify(data.message ?? '这个目录里没有可用的契约卡。', false);
        return;
      }
      const failed = (data.skipped ?? []).map(item => ({ name: item.name, message: item.reason }));
      const result = await absorb(data.files, failed);
      if (result.added.length) notify(`从 ${data.dir ?? target} 收进 ${result.added.length} 张，已自动选中。`);
      else if (result.duplicates.length) notify(`目录里的 ${result.duplicates.length} 张都已在库里。`, false);
      else notify('这个目录里没有能读的契约卡。', false);
    } catch {
      notify('连不上本地服务，静态部署请用「选择文件夹」。', false);
    } finally {
      setScanning(false);
    }
  };

  const importPicked = () => {
    const cards = cardboxCards(entries, picked);
    if (!cards.length) { notify('选中的卡读不出来了，可能文件被动过。', false); return; }
    onImport(cards);
    setPicked([]);
  };

  const deletePicked = async () => {
    if (!picked.length) return;
    const kept = await cardboxRemove(picked, entries);
    setEntries(kept);
    setPicked([]);
    notify(`从卡库删掉 ${picked.length} 张（名册里的少女不受影响）。`);
  };

  return <div id="cardbox-dialog" className="standard-modal cardbox">
    <header className="cardbox-head">
      <div>
        <div className="modal-eyebrow"><FileJson size={13} />契约卡 · 文件柜</div>
        <h2>卡库</h2>
        <p className="muted">存在这台机器的浏览器里，不进存档。一次收一叠，慢慢挑，再决定谁进名册。</p>
      </div>
      <span id="cardbox-count" className="cardbox-count">库里 {entries.length} 张 · 已选 {picked.length} 张</span>
    </header>

    <div className="cardbox-dir">
      <label className="cardbox-dir-field">
        <FolderOpen size={13} />
        <input
          id="cardbox-dir"
          value={dir}
          spellCheck={false}
          placeholder="填一个目录，例如 G:\cards 或 ~/cards"
          onChange={event => setDir(event.currentTarget.value)}
          onKeyDown={event => { if (event.key === 'Enter') void scanDir(); }}
        />
      </label>
      <button id="cardbox-dir-scan" type="button" className="btn" disabled={scanning} onClick={() => void scanDir()}>
        {scanning ? <Loader2 size={13} className="spin" /> : <ScanLine size={13} />}{scanning ? '正在扫描' : '扫描并导入'}
      </button>
      <button id="cardbox-dir-pick" type="button" className="llm-reset" onClick={() => folderRef.current?.click()}>
        <FolderOpen size={12} />选择文件夹
      </button>
      <input
        id="cardbox-dir-file"
        ref={folderRef}
        type="file"
        multiple
        hidden
        accept="application/json,.json"
        {...{ webkitdirectory: '', directory: '' }}
        onChange={event => { const files = [...(event.currentTarget.files ?? [])]; event.currentTarget.value = ''; void intake(files); }}
      />
    </div>
    <p className="cardbox-tip"><Info size={11} />填路径只在 <code>npm run dev</code> / <code>start.cmd</code> 下有效；部署成静态站点时用「选择文件夹」，读的是同一个目录。</p>

    <div className="cardbox-tools">
      <label className="cardbox-search">
        <Search size={13} />
        <input id="cardbox-search" value={query} placeholder="搜名字、文件名、元素或出身" onChange={event => setQuery(event.currentTarget.value)} />
      </label>
      <label id="cardbox-drop" className="cardbox-drop" htmlFor="cardbox-file"
        onDragOver={event => { event.preventDefault(); }}
        onDrop={event => { event.preventDefault(); void intake([...event.dataTransfer.files]); }}>
        <Upload size={13} />{busy || '也可以把文件拖进来'}
      </label>
      <input id="cardbox-file" type="file" accept="application/json,.json" multiple hidden
        onChange={event => { const files = [...(event.currentTarget.files ?? [])]; event.currentTarget.value = ''; void intake(files); }} />
    </div>

    {errors.length > 0 && <ul id="cardbox-errors" className="cardbox-errors">
      {errors.map((error, index) => <li key={`${error.name}-${index}`}><b>{error.name}</b>{error.message}</li>)}
    </ul>}

    {entries.length === 0 ? <div id="cardbox-empty" className="cardbox-empty">
      <FileJson size={22} />
      <p>卡库还是空的。</p>
      <small>填一个装着契约卡 JSON 的目录，或者选择文件夹，也可以直接把文件拖进来。</small>
    </div> : <>
      <div className="cardbox-bar">
        <button id="cardbox-select-all" type="button" className="llm-reset" onClick={() => setPicked(shown.map(entry => entry.hash))}>全选当前 {shown.length} 张</button>
        {picked.length > 0 && <button type="button" className="llm-reset" onClick={() => setPicked([])}><X size={12} />清空选择</button>}
        <span className="cardbox-limit">上限 {CARD_BOX_LIMIT} 张</span>
      </div>
      <ul id="cardbox-list" className="cardbox-list">
        {shown.map(entry => {
          const short = entry.hash.slice(0, 8);
          const on = pickedSet.has(entry.hash);
          return <li key={entry.hash} id={`cardbox-row-${short}`} className={`cardbox-row ${on ? 'on' : ''}`} onClick={() => toggle(entry.hash)}>
            <input id={`cardbox-check-${short}`} type="checkbox" checked={on} aria-label={`选择 ${entry.name}`} onChange={() => toggle(entry.hash)} />
            <span className="cardbox-name">{entry.name}<small>{entry.fileName}</small></span>
            <span className="cardbox-meta">Lv.{entry.level}</span>
            <span className="cardbox-meta">{entry.element}</span>
            <span className="cardbox-tag" style={{ color: girlFactionColors[entry.factionTag], borderColor: `${girlFactionColors[entry.factionTag]}55` }}>{cardBoxTagLabel(entry.factionTag)}</span>
          </li>;
        })}
      </ul>
    </>}

    <footer className="cardbox-foot">
      <button id="cardbox-delete" type="button" className="llm-reset" disabled={!picked.length} onClick={() => void deletePicked()}><Trash2 size={12} />从库里删掉</button>
      <span className="cardbox-hint">删除只动卡库，名册里已经在的少女不受影响。</span>
      <button id="cardbox-import" type="button" className="btn primary" disabled={!picked.length} onClick={importPicked}><Upload size={13} />导入选中的 {picked.length} 张</button>
    </footer>
  </div>;
}
