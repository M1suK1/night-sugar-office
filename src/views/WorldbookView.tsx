import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Download, Eye, EyeOff, FilePlus2, RotateCcw, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import {
  WORLDBOOK_BUDGET, WORLDBOOK_EVENT, defaultWorldbook, exportWorldbookJson, importWorldbookJson,
  loadWorldbook, saveWorldbook, worldbookContext, type WorldbookEntry,
} from '../worldbook';
import { OFFICE_WORLDBOOK_ID } from '../office';
import { BALANCE_FIELDS, loadBalance, resetBalance, saveBalance, type BalanceRules } from '../balance';
import './worldbook.css';

type Tab = 'entries' | 'balance';

function newEntry(): WorldbookEntry {
  return { id: `wb-${Date.now().toString(36)}`, name: '新词条', keys: [], content: '', enabled: true, constant: false, priority: 0, order: 99 };
}

export function WorldbookView({ onOpenOffice }: { onOpenOffice?: () => void }) {
  const [tab, setTab] = useState<Tab>('entries');
  const [entries, setEntries] = useState<WorldbookEntry[]>(() => loadWorldbook());
  const [activeId, setActiveId] = useState<string>(() => loadWorldbook()[0]?.id ?? '');
  const [trigger, setTrigger] = useState('诊所 治疗 侵蚀');
  const [note, setNote] = useState('');
  const [balance, setBalance] = useState<BalanceRules>(() => loadBalance());
  const fileRef = useRef<HTMLInputElement>(null);

  /** 事务所档案改动后由 `syncOfficeWorldbook` 广播，这里只负责重新读一遍磁盘上的副本。 */
  useEffect(() => {
    const reload = () => setEntries(loadWorldbook());
    window.addEventListener(WORLDBOOK_EVENT, reload);
    return () => window.removeEventListener(WORLDBOOK_EVENT, reload);
  }, []);


  const active = entries.find(item => item.id === activeId) ?? entries[0];
  const context = useMemo(() => worldbookContext(trigger, entries), [trigger, entries]);
  const spent = useMemo(() => worldbookContext('', entries), [entries]);

  function commit(next: WorldbookEntry[], message = '已保存。') {
    setEntries(next);
    setNote(saveWorldbook(next) ? message : '浏览器拒绝了这次写入。');
  }

  function patch(id: string, changes: Partial<WorldbookEntry>) {
    commit(entries.map(item => (item.id === id ? { ...item, ...changes } : item)));
  }

  function importFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importWorldbookJson(String(reader.result ?? ''));
      setNote(result.message);
      if (result.ok && result.entries) commit(result.entries, result.message);
    };
    reader.readAsText(file);
  }

  function exportFile() {
    const blob = new Blob([exportWorldbookJson(entries)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = '夜糖-世界书.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setNote('世界书已导出。');
  }

  return <div className="worldbook-view">
    <div className="wb-tabs" role="tablist">
      <button id="worldbook-tab-entries" role="tab" aria-selected={tab === 'entries'} className={tab === 'entries' ? 'active' : ''} onClick={() => setTab('entries')}><BookOpen size={14} />世界词条</button>
      <button id="worldbook-tab-balance" role="tab" aria-selected={tab === 'balance'} className={tab === 'balance' ? 'active' : ''} onClick={() => setTab('balance')}><RotateCcw size={14} />数值规则</button>
      <span className="wb-tab-note">{note || '规则改动即时生效，不需要重启。'}</span>
    </div>

    {tab === 'entries' ? <div className="wb-layout">
      <section className="wb-list" aria-label="世界词条列表">
        <header>
          <div>
            <b>{entries.length}</b> 条词条 · 常驻 <b>{spent.hits.length}</b>
          </div>
          <div className="wb-list-actions">
            <button id="worldbook-new" className="wb-mini" onClick={() => { const entry = newEntry(); commit([...entries, entry], '已新建词条。'); setActiveId(entry.id); }}><FilePlus2 size={12} />新建</button>
            <button id="worldbook-reset" className="wb-mini" onClick={() => { commit(defaultWorldbook(), '已恢复内置词条。'); setActiveId(defaultWorldbook()[0]?.id ?? ''); }}><RotateCcw size={12} />恢复内置</button>
          </div>
        </header>
        <div className="wb-budget">
          <span>注入预算 {spent.tokens} / {WORLDBOOK_BUDGET}</span>
          <i style={{ width: `${Math.min(100, (spent.tokens / WORLDBOOK_BUDGET) * 100)}%` }} />
        </div>
        <div className="wb-items">
          {entries.map(entry => <button
            key={entry.id}
            id={`worldbook-entry-${entry.id}`}
            className={`wb-item ${entry.id === active?.id ? 'active' : ''} ${entry.enabled ? '' : 'off'}`}
            onClick={() => setActiveId(entry.id)}
          >
            <div className="wb-item-name-row">
              <span className="wb-item-name">{entry.name}</span>
              {entry.generated && <Sparkles size={10} className="wb-item-generated" />}
            </div>
            <small>{entry.constant ? '常驻' : entry.keys.length ? `${entry.keys.length} 关键词` : '无触发词'} · P{entry.priority}</small>
            {entry.enabled ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>)}
        </div>
        <div className="wb-io">
          <input ref={fileRef} id="worldbook-import-file" type="file" accept="application/json,.json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) importFile(file); event.target.value = ''; }} />
          <button id="worldbook-import" className="wb-mini" onClick={() => fileRef.current?.click()}><Upload size={12} />导入 ST 世界书</button>
          <button id="worldbook-export" className="wb-mini" onClick={exportFile}><Download size={12} />导出</button>
        </div>
      </section>

      <section className="wb-editor" aria-label="词条编辑">
        {active ? <>
          {active.generated ? <>
            <div className="wb-generated">
              <div className="wb-generated-head"><Sparkles size={13} /><b>由事务所档案自动生成</b></div>
              <p>这一条不是手写的词条，而是「基础 · 事务所档案」的投影：背景、理念、目标与对外代表都从那边取。改这里不会生效，下一次同步会被覆盖。</p>
              {active.id === OFFICE_WORLDBOOK_ID && onOpenOffice && <button id="worldbook-open-office" type="button" className="wb-mini" onClick={onOpenOffice}><Sparkles size={12} />前往事务所档案</button>}
            </div>
            <div className="wb-editor-head">
              <span id="worldbook-name" className="wb-input wb-name wb-readonly">{active.name}</span>
              <span className="wb-switch wb-locked">{active.enabled ? '启用' : '停用'}</span>
              <span className="wb-switch wb-locked">{active.constant ? '常驻' : '非常驻'}</span>
            </div>
            <label className="wb-field">
              <span>关键词</span>
              <span id="worldbook-keys" className="wb-input wb-readonly">{active.keys.join('，')}</span>
            </label>
            <label className="wb-field">
              <span>内容（自动生成，随档案同步）</span>
              <textarea id="worldbook-content" className="wb-input wb-content wb-readonly" value={active.content} readOnly rows={10} />
            </label>
            <div className="wb-numbers">
              <span className="wb-tokens">优先 {active.priority} · 顺序 {active.order} · {Math.ceil(active.content.length / 1.6)} tokens</span>
            </div>
          </> : <>
          <div className="wb-editor-head">
            <input id="worldbook-name" className="wb-input wb-name" value={active.name} onChange={event => patch(active.id, { name: event.target.value })} aria-label="词条名称" />
            <label className="wb-switch"><input id="worldbook-enabled" type="checkbox" checked={active.enabled} onChange={event => patch(active.id, { enabled: event.target.checked })} /><span>{active.enabled ? '启用' : '停用'}</span></label>
            <label className="wb-switch"><input id="worldbook-constant" type="checkbox" checked={active.constant} onChange={event => patch(active.id, { constant: event.target.checked })} /><span>常驻</span></label>
            <button id="worldbook-delete" className="wb-icon" title="删除词条" onClick={() => { const next = entries.filter(item => item.id !== active.id); commit(next, '词条已删除。'); setActiveId(next[0]?.id ?? ''); }}><Trash2 size={14} /></button>
          </div>
          <label className="wb-field">
            <span>关键词（逗号分隔，命中即注入）</span>
            <input id="worldbook-keys" className="wb-input" value={active.keys.join('，')} onChange={event => patch(active.id, { keys: event.target.value.split(/[，,]/).map(key => key.trim()).filter(Boolean) })} placeholder="诊所，治疗，疗养" />
          </label>
          <label className="wb-field">
            <span>内容（会以 ### 名称 的段落进入提示词）</span>
            <textarea id="worldbook-content" className="wb-input wb-content" value={active.content} onChange={event => patch(active.id, { content: event.target.value })} rows={10} />
          </label>
          <div className="wb-numbers">
            <label><span>优先</span><input id="worldbook-priority" type="number" className="wb-input" value={active.priority} onChange={event => patch(active.id, { priority: Math.round(Number(event.target.value) || 0) })} /></label>
            <label><span>顺序</span><input id="worldbook-order" type="number" className="wb-input" value={active.order} onChange={event => patch(active.id, { order: Math.round(Number(event.target.value) || 0) })} /></label>
            <span className="wb-tokens">{Math.ceil(active.content.length / 1.6)} tokens</span>
          </div>
          </>}
        </> : <p className="wb-empty">还没有词条。新建一条，或恢复内置。</p>}
      </section>

      <section className="wb-preview" aria-label="命中预览">
        <h3><Search size={13} />命中预览</h3>
        <input id="worldbook-trigger" className="wb-input" value={trigger} onChange={event => setTrigger(event.target.value)} placeholder="输入一段情境，看看会命中哪些词条" />
        <div className="wb-hits">
          {context.hits.map(hit => <span key={hit.id} className={`wb-hit ${hit.reason}`}>{hit.name}<small>{hit.reason === 'constant' ? '常驻' : '关键词'}</small></span>)}
          {!context.hits.length && <p className="wb-empty">这段情境没有命中任何词条。</p>}
        </div>
        <p className="wb-meta">本次注入约 {context.tokens} tokens{context.dropped ? ` · 因预算跳过 ${context.dropped} 条` : ''}</p>
      </section>
    </div> : <div className="wb-balance">
      <div className="wb-balance-head">
        <div><b>平衡数值</b><small>随存档保存；已接入结算的位置立即生效。</small></div>
        <button id="balance-reset" className="wb-mini" onClick={() => { const next = resetBalance(); setBalance(next); setNote('已恢复默认数值。'); }}><RotateCcw size={12} />恢复默认</button>
      </div>
      <div className="wb-balance-grid">
        {BALANCE_FIELDS.map(field => <label key={field.key} className="wb-balance-field">
          <span>{field.label}<em>{field.hint}</em></span>
          <div>
            <input
              id={`balance-${field.key}`}
              type="number"
              className="wb-input"
              value={balance[field.key]}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={event => {
                const next = { ...balance, [field.key]: Number(event.target.value) };
                setBalance(next);
                saveBalance(next);
                setNote('数值已保存。');
              }}
            />
            <small>{field.unit}</small>
          </div>
        </label>)}
      </div>
    </div>}
  </div>;
}
