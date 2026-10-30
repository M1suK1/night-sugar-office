import { useEffect, useRef, useState } from 'react';
import { Upload, FileJson, ImagePlus, ClipboardPaste, Sparkles, Scissors, Trash2, Wand2, Copy, Check, Shirt, Info } from 'lucide-react';
import type { Girl, GameState, Outfit } from '../types';
import { GirlPortrait } from './GirlPortrait';
import { CutoutPreview } from './CutoutPreview';
import { loadImage, removeImageBackground, originalImageDataUrl } from '../image';
import { fileDropProps } from '../drop';

type Mode = 'merge' | 'replace';

interface Described {
  name: string;
  description: string;
}

const LAYER_HINTS: { key: string; layer: string }[] = [
  { key: 'formal', layer: 'formal' },
  { key: '礼服', layer: 'formal' },
  { key: '制服', layer: 'uniform' },
  { key: 'casual', layer: 'casual' },
  { key: '私服', layer: 'casual' },
];

function layerFrom(name: string): string {
  const hit = LAYER_HINTS.find(item => name.toLowerCase().includes(item.key));
  return hit?.layer ?? 'custom';
}

function paletteFrom(color: string, extra?: unknown): string[] {
  const list = Array.isArray(extra) ? extra.filter((v): v is string => typeof v === 'string' && /^#?[0-9a-f]{3,8}$/i.test(v)).slice(0, 3) : [];
  return [color, ...list, '#17141c', '#f7e9f1'].slice(0, 4);
}

/** 从 SillyTavern 角色卡、衣柜包或裸数组里读出服装。 */
function readOutfits(raw: unknown, fallbackColor: string): { outfits: Outfit[]; note: string } {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { outfits?: unknown[] })?.outfits)
      ? ((raw as { outfits: unknown[] }).outfits)
      : Array.isArray((raw as { wardrobe?: unknown[] })?.wardrobe)
        ? ((raw as { wardrobe: unknown[] }).wardrobe)
        : Array.isArray((raw as { girl?: { wardrobe?: unknown[] } })?.girl?.wardrobe)
          ? ((raw as { girl: { wardrobe: unknown[] } }).girl.wardrobe)
          : [];
  const outfits: Outfit[] = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' && record.name.trim() ? record.name.trim().slice(0, 16) : `导入礼装 ${index + 1}`;
    const description = typeof record.description === 'string' && record.description.trim() ? record.description.trim().slice(0, 160) : '从衣柜导入的一套礼装，细节还留在缎带与褶边里。';
    const portrait = typeof record.portrait === 'string' && record.portrait.startsWith('data:image/') ? record.portrait : undefined;
    outfits.push({
      id: typeof record.id === 'string' && record.id ? record.id : `import-${Date.now().toString(36)}-${index}`,
      name,
      description,
      palette: paletteFrom(fallbackColor, record.palette),
      layerKey: typeof record.layerKey === 'string' && record.layerKey ? record.layerKey : layerFrom(name),
      portrait,
      imported: true,
    });
  });
  const note = outfits.length ? `读取到 ${outfits.length} 套服装` : '没有找到可用的服装字段';
  return { outfits, note };
}

export function WardrobeDialog({ girl, state, onImport, onRemove, onDescribe, onDescribeSaved, onClose }: {
  girl: Girl; state: GameState;
  onImport: (outfits: Outfit[], mode: Mode) => void;
  onRemove: (outfitId: string) => void;
  onDescribe: (portrait: string) => Promise<Described | null>;
  onDescribeSaved: (outfitId: string, description: string) => void;
  onClose: () => void;
}) {
  const [staged, setStaged] = useState<Outfit[]>([]);
  const [mode, setMode] = useState<Mode>('merge');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [paste, setPaste] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [describing, setDescribing] = useState<string | null>(null);
  const [cut, setCut] = useState<{ id: string; before: string; after: string; removed: number } | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const slots = Math.max(0, 4 - girl.wardrobe.length);

  useEffect(() => { if (cut) previewRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [cut]);

  const addStaged = (outfits: Outfit[], text: string, ok = true) => {
    if (!outfits.length) { setNote({ ok: false, text }); return; }
    setStaged(current => {
      const seen = new Set(current.map(item => item.name));
      return [...current, ...outfits.filter(item => !seen.has(item.name))];
    });
    setNote({ ok, text });
  };

  const readFile = async (file: File) => {
    setBusy(true);
    try {
      if (file.type.startsWith('image/')) {
        const portrait = await originalImageDataUrl(file);
        const name = file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 16) || '导入立绘';
        addStaged([{ id: `import-${Date.now().toString(36)}`, name, description: '还没有描述。可以先去掉背景，再让叙事者看图补全。', palette: paletteFrom(girl.color), layerKey: layerFrom(file.name), portrait, imported: true }], `已读取立绘「${name}」`);
        return;
      }
      const parsed = JSON.parse(await file.text()) as unknown;
      const { outfits, note: message } = readOutfits(parsed, girl.color);
      addStaged(outfits, message);
    } catch (error) {
      setNote({ ok: false, text: error instanceof Error ? error.message : '文件无法解析' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const importPaste = () => {
    if (!paste.trim()) { setNote({ ok: false, text: '先粘贴衣柜 JSON。' }); return; }
    try {
      const { outfits, note: message } = readOutfits(JSON.parse(paste), girl.color);
      addStaged(outfits, message);
      if (outfits.length) setPaste('');
    } catch {
      setNote({ ok: false, text: '这段文本不是合法的 JSON。' });
    }
  };

  const copyFrom = () => {
    const donor = state.girls.find(item => item.id === source);
    if (!donor) { setNote({ ok: false, text: '选择一位已有衣柜的契约者。' }); return; }
    const outfits = donor.wardrobe.filter(item => item.portrait || item.id !== 'custom').map((item, index) => ({ ...item, id: `${donor.id}-${item.id}-${index}`, imported: true }));
    addStaged(outfits, outfits.length ? `从${donor.name}的衣柜复制了 ${outfits.length} 套` : '她的衣柜里还没有可复制的礼装');
  };

  const editStaged = (id: string, patch: Partial<Outfit>) => {
    setStaged(current => current.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const cutStaged = async (item: Outfit) => {
    if (!item.portrait) { setNote({ ok: false, text: '这套服装没有立绘，无法去背景。' }); return; }
    setBusy(true);
    try {
      const result = await removeImageBackground(await loadImage(item.portrait));
      setCut({ id: item.id, before: item.portrait, after: result.dataUrl, removed: result.removedRatio });
    } catch {
      setNote({ ok: false, text: '去背景失败，可以重试或先写描述。' });
    } finally {
      setBusy(false);
    }
  };

  const applyCut = () => {
    if (!cut) return;
    editStaged(cut.id, { portrait: cut.after });
    setCut(null);
    setNote({ ok: true, text: '已应用去背景结果。' });
  };

  const describeStaged = async (item: Outfit) => {
    if (!item.portrait) { setNote({ ok: false, text: '先导入一张立绘，叙事者才能看图写描述。' }); return; }
    setDescribing(item.id);
    try {
      const data = await onDescribe(item.portrait);
      if (!data) { setNote({ ok: false, text: '这次没有拿到描述，可以重试，或自己写一句。' }); return; }
      editStaged(item.id, { name: data.name, description: data.description, layerKey: layerFrom(data.name) });
      setNote({ ok: true, text: `叙事者写好了「${data.name}」。` });
    } finally {
      setDescribing(null);
    }
  };

  const describeSaved = async (item: Outfit) => {
    if (!item.portrait) { setNote({ ok: false, text: '这套服装没有立绘，叙事者看不见就写不了。' }); return; }
    setDescribing(item.id);
    try {
      const data = await onDescribe(item.portrait);
      if (!data) { setNote({ ok: false, text: '这次没有拿到描述，可以重试，或自己改一句。' }); return; }
      onDescribeSaved(item.id, data.description);
      setNote({ ok: true, text: `「${item.name}」的描述已让叙事者重写。` });
    } finally {
      setDescribing(null);
    }
  };

  const confirm = () => {
    if (!staged.length) { setNote({ ok: false, text: '还没有可导入的服装。' }); return; }
    onImport(staged, mode);
    setStaged([]);
    setNote({ ok: true, text: '已写入衣柜。' });
  };

  return <div className="standard-modal wardrobe-modal">
    <div className="modal-eyebrow"><Shirt size={14} />衣柜 / 四格礼装</div>
    <h2>{girl.name}的衣柜。</h2>
    <p className="muted">每位契约者有四个衣柜格。契约礼装（自定义立绘与服装描述）直接占用第一格；导入的礼装会同步立绘与头像，只保存在本地存档里。导入的服装可以在这里删除，也可以让叙事者看图补一条描述。</p>

    <div className="wardrobe-slots">
      {girl.wardrobe.map((outfit, index) => <div key={outfit.id} className={`wardrobe-slot ${girl.outfitId === outfit.id ? 'picked' : ''}`}>
        <span className="wardrobe-slot-preview"><GirlPortrait girl={{ ...girl, outfitId: outfit.id }} variant="avatar" /></span>
        <b>{outfit.name}{outfit.custom && <em>契约礼装</em>}</b>
        <small>0{index + 1}</small>
        {outfit.portrait && <button id={`wardrobe-slot-ai-${outfit.id}`} type="button" className="wardrobe-slot-ai" title="让叙事者看这套立绘重写描述" disabled={describing === outfit.id} onClick={() => void describeSaved(outfit)}><Sparkles size={11} />{describing === outfit.id ? '写着…' : '写描述'}</button>}
        {girl.wardrobe.length > 1 && <button id={`wardrobe-remove-${outfit.id}`} className="wardrobe-slot-remove" aria-label={`删除${outfit.name}`} title={`删除${outfit.name}`} onClick={() => onRemove(outfit.id)}><Trash2 size={12} />删除</button>}
      </div>)}
      {Array.from({ length: slots }).map((_, index) => <div key={`empty-${index}`} className="wardrobe-slot empty"><span className="wardrobe-slot-preview">＋</span><b>空置</b><small>0{girl.wardrobe.length + index + 1}</small></div>)}
    </div>

    <div className="wardrobe-import-grid">
      <div className="wardrobe-import-block">
        <div className="wardrobe-import-head"><ImagePlus size={14} /><div><b>立绘或衣柜包</b><small>PNG/JPG/WebP，或 JSON（衣柜、角色卡）</small></div></div>
        <label className={`wardrobe-drop ${over ? 'is-drop-over' : ''}`} htmlFor="wardrobe-file-input" {...fileDropProps(setOver, files => { files.forEach(file => void readFile(file)); })}>
          <Upload size={17} />
          <span>{busy ? '正在读取…' : over ? '松手就导入' : '选择文件，可多选，或拖进来'}</span>
          <input id="wardrobe-file-input" ref={fileRef} type="file" accept=".json,application/json,image/png,image/jpeg,image/webp" multiple hidden onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void Promise.all(files.map(file => readFile(file))); }} />
        </label>
      </div>
      <div className="wardrobe-import-block">
        <div className="wardrobe-import-head"><Copy size={14} /><div><b>从其他契约者复制</b><small>只复制服装，不复制数值</small></div></div>
        <div className="wardrobe-copy-row">
          <select id="wardrobe-copy-source" value={source} onChange={event => setSource(event.target.value)}>
            <option value="">选择契约者…</option>
            {state.girls.filter(item => item.id !== girl.id).map(item => <option key={item.id} value={item.id}>{item.name}（{item.wardrobe.length} 套）</option>)}
          </select>
          <button id="wardrobe-copy-run" className="btn" onClick={copyFrom} disabled={!source}>复制</button>
        </div>
      </div>
    </div>

    <div className="wardrobe-paste">
      <div className="wardrobe-import-head"><ClipboardPaste size={14} /><div><b>粘贴 JSON</b><small>{'{"outfits":[…]} / 角色卡 / 裸数组'}</small></div></div>
      <textarea id="wardrobe-paste" rows={3} value={paste} onChange={event => setPaste(event.target.value)} placeholder='[{"name":"莓色礼装","description":"…","palette":["#e8a7c2"]}]' />
      <button id="wardrobe-paste-run" className="llm-reset" onClick={importPaste}><FileJson size={12} />解析这段 JSON</button>
    </div>

    {staged.length > 0 && <div className="wardrobe-staged">
      <div className="wardrobe-import-head"><Wand2 size={14} /><div><b>待写入 {staged.length} 套</b><small>可以逐套改名字、去背景、让叙事者补描述</small></div></div>
      <div className="wardrobe-staged-list">
        {staged.map((item, index) => <article className="wardrobe-stage" key={item.id}>
          <span className="wardrobe-stage-thumb">{item.portrait ? <img src={item.portrait} alt="" /> : <Shirt size={16} />}</span>
          <div className="wardrobe-stage-fields">
            <input id={`wardrobe-stage-name-${index}`} className="av-input" maxLength={16} aria-label="服装名称" value={item.name} onChange={event => editStaged(item.id, { name: event.target.value })} />
            <textarea id={`wardrobe-stage-desc-${index}`} className="av-input" rows={2} maxLength={160} aria-label="服装描述" placeholder="还没有描述，可以让叙事者看图补全。" value={item.description} onChange={event => editStaged(item.id, { description: event.target.value })} />
            <div className="wardrobe-stage-actions">
              {item.portrait && <button id={`wardrobe-stage-cut-${index}`} type="button" className="llm-reset" disabled={busy} onClick={() => void cutStaged(item)}><Scissors size={12} />去背景</button>}
              <button id={`wardrobe-stage-ai-${index}`} type="button" className="llm-reset" disabled={!item.portrait || describing === item.id} onClick={() => void describeStaged(item)}><Sparkles size={12} />{describing === item.id ? '叙事者正在看' : '让叙事者写描述'}</button>
              <button id={`wardrobe-stage-remove-${index}`} type="button" className="llm-reset" onClick={() => setStaged(current => current.filter(entry => entry.id !== item.id))}><Trash2 size={12} />移出</button>
            </div>
          </div>
        </article>)}
      </div>
      <div className="wardrobe-mode" role="radiogroup" aria-label="导入方式">
        <button id="wardrobe-mode-merge" role="radio" aria-checked={mode === 'merge'} className={mode === 'merge' ? 'picked' : ''} onClick={() => setMode('merge')}>合并（保留现有）</button>
        <button id="wardrobe-mode-replace" role="radio" aria-checked={mode === 'replace'} className={mode === 'replace' ? 'picked' : ''} onClick={() => setMode('replace')}>替换（覆盖衣柜）</button>
      </div>
    </div>}

    <div ref={previewRef}>{cut && <CutoutPreview before={cut.before} after={cut.after} removed={cut.removed} tolerance={36} note={`「${staged.find(item => item.id === cut.id)?.name ?? '这套服装'}」的去背景预览，应用后只影响待写入的这一套。`} busy={busy} onApply={applyCut} onDiscard={() => setCut(null)} onRetry={() => { const target = staged.find(item => item.id === cut.id); if (target) void cutStaged(target); }} />}</div>

    {note && <div className={`wardrobe-note ${note.ok ? 'ok' : 'bad'}`} role="status">{note.ok ? <Check size={13} /> : <Info size={13} />}{note.text}</div>}

    <div className="settings-data-actions">
      <button id="wardrobe-import-confirm" className="btn primary" disabled={!staged.length} onClick={confirm}><Sparkles size={15} />写入衣柜</button>
      <button id="wardrobe-import-close" className="btn" onClick={onClose}>关闭</button>
    </div>
  </div>;
}
