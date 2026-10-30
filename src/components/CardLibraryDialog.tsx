import { useMemo, useState } from 'react';
import { FileJson, Search, Trash2, Upload, X } from 'lucide-react';
import {
  CARD_BOX_LIMIT, cardBoxTagLabel, cardboxAdd, cardboxCards, cardboxFilter, cardboxRemove, loadCardBox,
} from '../cardbox.ts';
import { girlFactionColors } from '../factions.ts';
import type { GirlCard } from '../types.ts';

export function CardLibraryDialog({ onImport, notify }: {
  onImport: (cards: GirlCard[]) => void;
  notify: (text: string, ok?: boolean) => void;
}) {
  const [entries, setEntries] = useState(() => loadCardBox());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ name: string; message: string }[]>([]);
  const [busy, setBusy] = useState('');
  const shown = useMemo(() => cardboxFilter(entries, query), [entries, query]);
  const pickedSet = new Set(picked);

  const toggle = (hash: string) => setPicked(list => list.includes(hash) ? list.filter(item => item !== hash) : [...list, hash]);
  const intake = async (files: File[]) => {
    if (!files.length) return;
    setBusy(`已读 0 / ${files.length}`);
    const failed: { name: string; message: string }[] = [];
    const inputs: { name: string; text: string }[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      try {
        inputs.push({ name: file.name, text: await file.text() });
      } catch {
        failed.push({ name: file.name, message: '这个文件读不出来' });
      }
      setBusy(`已读 ${index + 1} / ${files.length}`);
    }
    const result = cardboxAdd(inputs, entries);
    setEntries(result.entries);
    setErrors([...failed, ...result.failed]);
    setBusy('');
    if (result.added.length) notify(`收进卡库 ${result.added.length} 张。`);
    else if (result.duplicates.length) notify('这些卡已经在库里了。', false);
    else if (failed.length || result.failed.length) notify('这些文件没能收进卡库。', false);
  };

  const importPicked = () => {
    const cards = cardboxCards(entries, picked);
    if (!cards.length) { notify('选中的卡读不出来了，可能文件被动过。', false); return; }
    onImport(cards);
    setPicked([]);
  };

  const deletePicked = () => {
    if (!picked.length) return;
    const kept = cardboxRemove(picked, entries);
    setEntries(kept);
    setPicked([]);
    notify(`从卡库删掉 ${picked.length} 张（名册里的少女不受影响）。`);
  };

  return <div id="cardbox-dialog" className="cardbox">
      <header className="cardbox-head">
        <div>
          <p className="av-eyebrow"><FileJson size={12} />契约卡 · 文件柜</p>
          <h2>卡库</h2>
          <p className="cardbox-sub">存在这台机器的浏览器里，不进存档。一次拖一叠进来，慢慢挑。</p>
        </div>
        <span id="cardbox-count" className="cardbox-count">库里 {entries.length} 张 · 已选 {picked.length} 张</span>
      </header>

      <div className="cardbox-tools">
        <label className="cardbox-search">
          <Search size={14} />
          <input id="cardbox-search" value={query} placeholder="搜名字、文件名、元素或出身" onChange={event => setQuery(event.currentTarget.value)} />
        </label>
        <label id="cardbox-drop" className="cardbox-drop" htmlFor="cardbox-file"
          onDragOver={event => { event.preventDefault(); }}
          onDrop={event => { event.preventDefault(); void intake([...event.dataTransfer.files]); }}>
          <Upload size={14} />{busy || '拖文件进来，或点这里选'}
        </label>
        <input id="cardbox-file" type="file" accept="application/json,.json" multiple hidden
          onChange={event => { void intake([...(event.currentTarget.files ?? [])]); event.currentTarget.value = ''; }} />
      </div>

      {errors.length > 0 && <ul id="cardbox-errors" className="cardbox-errors">
        {errors.map((error, index) => <li key={`${error.name}-${index}`}><b>{error.name}</b>{error.message}</li>)}
      </ul>}

      {entries.length === 0 ? <div id="cardbox-empty" className="cardbox-empty">
        <FileJson size={26} />
        <p>卡库还是空的。</p>
        <small>把导出的契约卡 JSON 拖进来，或者点上面的选文件。收进来之后可以一起导入名册。</small>
      </div> : <>
        <div className="cardbox-bar">
          <button id="cardbox-select-all" type="button" className="av-btn av-btn-small" onClick={() => setPicked(shown.map(entry => entry.hash))}>全选当前 {shown.length} 张</button>
          {picked.length > 0 && <button type="button" className="av-btn av-btn-small" onClick={() => setPicked([])}><X size={12} />清空选择</button>}
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
        <button id="cardbox-delete" type="button" className="av-btn av-btn-small" disabled={!picked.length} onClick={deletePicked}><Trash2 size={13} />从库里删掉</button>
        <span className="cardbox-hint">删除只动卡库，名册里已经在的少女不受影响。</span>
        <button id="cardbox-import" type="button" className="av-btn av-btn-small primary" disabled={!picked.length} onClick={importPicked}><Upload size={13} />导入选中的 {picked.length} 张</button>
      </footer>
  </div>;
}
