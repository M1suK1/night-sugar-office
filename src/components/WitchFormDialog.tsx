import { useRef, useState } from 'react';
import { ImagePlus, Sparkles, Trash2 } from 'lucide-react';
import type { Girl, Outfit } from '../types';
import { rules } from '../balance';
import { resizeImageFile } from '../image';
import { GirlPortrait } from './GirlPortrait';

export function WitchFormDialog({ girl, onSave, onRemove, onClose }: {
  girl: Girl;
  onSave: (outfit: Outfit) => boolean;
  onRemove: () => boolean;
  onClose: () => void;
}) {
  const [portrait, setPortrait] = useState(girl.witchForm?.portrait ?? '');
  const [name, setName] = useState(girl.witchForm?.name ?? '魔女化 · 夜之形');
  const [description, setDescription] = useState(girl.witchForm?.description ?? '从她不肯放手的执念里长出来的形态。');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = portrait || girl.witchForm?.portrait || '';
  const threshold = rules().corruptionThreshold;

  function outfit(): Outfit {
    return {
      id: 'witchform', form: 'witch', name: name.trim().slice(0, 24) || '魔女化 · 夜之形',
      description: description.trim().slice(0, 100) || '从她不肯放手的执念里长出来的形态。',
      palette: girl.witchForm?.palette?.length ? [...girl.witchForm.palette] : [girl.color, '#c478b8', '#f3aec9'],
      layerKey: girl.witchForm?.layerKey ?? 'witch', portrait: preview, imported: true,
    };
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setNote('正在裁切魔女化立绘…');
    try {
      const data = await resizeImageFile(file);
      setPortrait(data);
      setNote('立绘已就位，保存后会留在衣柜第五格。');
    } catch (error) {
      setNote(error instanceof Error ? error.message : '这张图片无法读取。');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function save() {
    if (!preview) { setNote('先导入一张魔女化立绘。'); return; }
    if (onSave(outfit())) onClose();
    else setNote('保存失败，请查看界面顶部的提示。');
  }

  function remove() {
    if (!girl.witchForm) return;
    if (onRemove()) onClose();
    else setNote('移除失败，请查看界面顶部的提示。');
  }

  return (
    <div className="standard-modal witch-form-modal" role="dialog" aria-modal="true" aria-labelledby="witch-form-title">
      <div className="modal-eyebrow"><Sparkles size={13} />魔女化 / 第五格</div>
      <h2 id="witch-form-title">为她留一张夜之形。</h2>
      <p className="muted">魔女化立绘独立于四格衣柜，保存在第五格。导入后普通服装仍可用；真正切换要等侵蚀达到阈值。</p>

      <div className="witch-form-layout">
        <div className={`witch-form-preview ${preview ? 'ready' : 'empty'}`}>
          <GirlPortrait girl={{ ...girl, witch: true, witchForm: { ...outfit(), portrait: preview || undefined }, outfitId: 'witchform' }} variant="full" />
          {!preview && <span className="witch-form-empty"><ImagePlus size={22} />还没有导入魔女化立绘</span>}
          <em>第五格 · 魔女化</em>
        </div>

        <div className="witch-form-fields">
          <input ref={fileRef} id="witch-form-file" type="file" accept="image/png,image/jpeg,image/webp,image/*" hidden onChange={event => void pick(event.target.files?.[0])} />
          <button id="witch-form-upload" type="button" className="btn witch-form-upload" disabled={busy} onClick={() => fileRef.current?.click()}><ImagePlus size={15} />{preview ? '替换魔女化立绘' : '导入魔女化立绘'}</button>
          <label htmlFor="witch-form-name">形态名称<input id="witch-form-name" className="av-input" maxLength={24} value={name} onChange={event => setName(event.target.value)} /></label>
          <label htmlFor="witch-form-description">形态描述<textarea id="witch-form-description" className="av-input" maxLength={100} rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label>
          <p className="witch-form-threshold">当前侵蚀 <b>{girl.corruption}</b> / 阈值 <b>{threshold}</b>{girl.corruption < threshold && !girl.witch ? ' · 可以先保存，达到阈值后再从第五格切换。' : ''}</p>
          {note && <p className="witch-form-note" role="status">{note}</p>}
          <div className="witch-form-actions">
            <button id="witch-form-save" type="button" className="btn primary" disabled={busy || !preview} onClick={save}>保存到第五格</button>
            {girl.witchForm && <button id="witch-form-remove" type="button" className="btn witch-form-remove" disabled={busy} onClick={remove}><Trash2 size={14} />移除</button>}
          </div>
        </div>
      </div>

      <p className="small-note">魔女化状态会锁定这张立绘，并改用带有负面倾向的性格记录；恢复普通形态后，原本的性格不会被覆盖。</p>
    </div>
  );
}
