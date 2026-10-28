import { useState } from 'react';
import { Check, ImagePlus, Info, Loader2, Shirt, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type { Expression, Girl } from '../types';
import { EXPRESSIONS, EXPRESSION_META, EXPRESSION_VARIANT_LIMIT, expressionFromFileName, expressionVariantKey } from '../expressions';
import { resizeImageFile } from '../image';
import { GirlPortrait } from './GirlPortrait';

interface Note { ok: boolean; text: string }

export function ExpressionVariantDialog({ girl, onSave, onSaveMany, onRemove, onClose }: {
  girl: Girl;
  onSave: (key: string, dataUrl: string) => boolean;
  onSaveMany: (variants: Record<string, string>) => boolean;
  onRemove: (key: string) => boolean;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [outfitId, setOutfitId] = useState(girl.outfitId ?? girl.wardrobe?.[0]?.id ?? 'custom');
  const wardrobe = girl.wardrobe ?? [];
  const activeOutfitId = wardrobe.some(item => item.id === outfitId) ? outfitId : wardrobe[0]?.id ?? outfitId;
  const imported = EXPRESSIONS.filter(id => Boolean(girl.importedVariants?.[expressionVariantKey(activeOutfitId, id)])).length;
  const importedFor = (id: string) => EXPRESSIONS.filter(expression => Boolean(girl.importedVariants?.[expressionVariantKey(id, expression)])).length;
  const chooseOutfit = (id: string) => {
    setOutfitId(id);
    setNote(null);
  };

  const readOne = async (file: File, expression: Expression) => {
    if (!file.type.startsWith('image/')) { setNote({ ok: false, text: '请选择 PNG、JPG 或 WebP 图片。' }); return; }
    setBusy(expression);
    try {
      const dataUrl = await resizeImageFile(file);
      const key = expressionVariantKey(activeOutfitId, expression);
      const ok = onSave(key, dataUrl);
      setNote({ ok, text: ok ? `「${EXPRESSION_META[expression].label}」表情差分已保存到这套服装。` : '这张差分没有保存成功，请检查存档空间。' });
    } catch (error) {
      setNote({ ok: false, text: error instanceof Error ? error.message : '图片读取失败。' });
    } finally {
      setBusy(null);
    }
  };

  const readBatch = async (files: File[]) => {
    if (!files.length) return;
    setBusy('batch');
    const variants: Record<string, string> = {};
    const skipped: string[] = [];
    try {
      for (const file of files) {
        const expression = expressionFromFileName(file.name);
        if (!file.type.startsWith('image/') || !expression) { skipped.push(file.name); continue; }
        try {
          variants[expressionVariantKey(activeOutfitId, expression)] = await resizeImageFile(file);
        } catch {
          skipped.push(file.name);
        }
      }
      const count = Object.keys(variants).length;
      if (!count) {
        setNote({ ok: false, text: '没有从文件名里认出表情。请用 calm / smile / surprise / sad / angry / shy，或平静 / 微笑 / 惊讶 / 低落 / 生气 / 害羞 命名。' });
        return;
      }
      const ok = onSaveMany(variants);
      setNote({
        ok,
        text: ok
          ? `这套服装已保存 ${count} 张表情差分${skipped.length ? `，跳过 ${skipped.length} 张无法识别或读取失败的文件` : ''}。`
          : `这批差分没有保存成功，每套服装最多保留 ${EXPRESSION_VARIANT_LIMIT} 张。`,
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = (expression: Expression) => {
    const ok = onRemove(expressionVariantKey(activeOutfitId, expression));
    setNote({ ok, text: ok ? `「${EXPRESSION_META[expression].label}」的差分已移除，回到基础立绘。` : '这张差分已经不存在了。' });
  };

  return <div className="standard-modal expression-variant-modal">
    <div className="modal-eyebrow"><Sparkles size={14} />表情差分 / 按服装管理</div>
    <h2>{girl.name}的表情。</h2>
    <p className="muted">每套服装单独准备六种表情的立绘。导入后会真正替换图片，角色档案、对话、战斗札记与多人舞台都会同步；没有导入的表情继续使用基础立绘。差分只保存在本地存档里。</p>

    {wardrobe.length > 0 && <div className="expression-variant-outfits" role="tablist" aria-label="选择要管理的服装">
      {wardrobe.map(item => <button
        key={item.id}
        id={`expression-variant-outfit-${item.id}`}
        type="button"
        role="tab"
        aria-selected={item.id === activeOutfitId}
        className={item.id === activeOutfitId ? 'active' : ''}
        disabled={Boolean(busy)}
        onClick={() => chooseOutfit(item.id)}
      ><Shirt size={12} /><span>{item.name}</span><b>{importedFor(item.id)} / {EXPRESSION_VARIANT_LIMIT}</b></button>)}
    </div>}

    <div className="expression-variant-summary">
      <span><ImagePlus size={14} /><b>{imported}</b> / {EXPRESSION_VARIANT_LIMIT} 张已导入</span>
      <label className={`expression-variant-batch ${busy ? 'busy' : ''}`} htmlFor="expression-variant-batch">
        {busy === 'batch' ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        {busy === 'batch' ? '正在读取…' : '批量导入'}
        <input
          id="expression-variant-batch"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          disabled={Boolean(busy)}
          onChange={event => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void readBatch(files);
          }}
        />
      </label>
    </div>
    <p className="expression-variant-hint">批量导入会按文件名识别表情，例如 <code>yue-calm.png</code>、<code>yue-smile.png</code>；同一套服装的同一表情只保留最后一张。</p>

    <div className="expression-variant-grid">
      {EXPRESSIONS.map(expression => {
        const key = expressionVariantKey(activeOutfitId, expression);
        const has = Boolean(girl.importedVariants?.[key]);
        const meta = EXPRESSION_META[expression];
        return <article key={expression} id={`expression-variant-card-${expression}`} className={`expression-variant-card ${has ? 'has-image' : ''} ${girl.expression === expression ? 'picked' : ''}`}>
          <div className="expression-variant-preview">
            <GirlPortrait girl={{ ...girl, outfitId: activeOutfitId, expression }} variant="full" className="expression-variant-portrait" />
            <span className={`expression-variant-state ${has ? 'ready' : ''}`}>{has ? '已导入' : '基础立绘'}</span>
          </div>
          <div className="expression-variant-copy">
            <b>{meta.label}<small>{has ? '差分图片' : '程序化表情'}</small></b>
            <p>{meta.note}</p>
          </div>
          <div className="expression-variant-actions">
            <label className={`expression-variant-upload ${busy ? 'busy' : ''}`} htmlFor={`expression-variant-file-${expression}`}>
              {busy === expression ? <Loader2 size={12} className="spin" /> : <ImagePlus size={12} />}
              {has ? '替换' : '导入'}
              <input
                id={`expression-variant-file-${expression}`}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                disabled={Boolean(busy)}
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void readOne(file, expression);
                }}
              />
            </label>
            {has && <button id={`expression-variant-remove-${expression}`} type="button" className="expression-variant-remove" aria-label={`移除${meta.label}表情差分`} onClick={() => remove(expression)} disabled={Boolean(busy)}><Trash2 size={12} />移除</button>}
          </div>
        </article>;
      })}
    </div>

    {note && <p className={`expression-variant-note ${note.ok ? 'ok' : 'bad'}`} role="status">{note.ok ? <Check size={13} /> : <Info size={13} />}{note.text}</p>}

    <div className="expression-variant-foot">
      <span><Info size={12} />换装后，只显示那套服装自己的差分。</span>
      <button id="expression-variant-close" type="button" className="btn" onClick={onClose}><X size={13} />完成</button>
    </div>
  </div>;
}
