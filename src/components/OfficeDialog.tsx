import { useState } from 'react';
import { BookOpen, Building2, Check, Feather, MoonStar, UserRoundCheck, X } from 'lucide-react';
import type { Girl, OfficeProfile } from '../types';
import { OFFICE_LIMITS, representativeOf } from '../office';
import { EMPLOYER_LABEL, factionTagColor, factionTagLabel } from '../factions';

interface OfficeDialogProps {
  profile: OfficeProfile;
  girls: Girl[];
  assistantId?: string;
  onSave: (profile: OfficeProfile) => void;
  onAssistant: (girlId?: string) => void;
  onClose: () => void;
}

const fields = [
  { key: 'background', label: '背景', hint: '事务所从哪里来、为什么关门、又被谁重新点亮。', limit: OFFICE_LIMITS.background, id: 'office-background' },
  { key: 'philosophy', label: '理念', hint: '它凭什么在三方之间站住脚。', limit: OFFICE_LIMITS.philosophy, id: 'office-philosophy' },
  { key: 'goal', label: '目标', hint: '你打算把这间事务所带去哪里。', limit: OFFICE_LIMITS.goal, id: 'office-goal' },
] as const;

/**
 * 事务所档案。
 *
 * 这里编辑的是「雇主」的自我介绍，不是第四方势力：没有辖区、没有声望、没有净化加成。
 * 保存后由 App 一并写进世界书，所以弹窗本身不碰存储。
 */
export function OfficeDialog({ profile, girls, assistantId, onSave, onAssistant, onClose }: OfficeDialogProps) {
  const [draft, setDraft] = useState<OfficeProfile>(profile);
  const representative = representativeOf({ assistantId, girls });
  const active = girls.filter(g => !g.dead && !g.retired);
  const candidates = active.filter(g => g.bond >= 40);

  return (
    <div id="office-dialog" className="office-dialog">
      <div className="modal-eyebrow"><Building2 size={14} />事务所档案 / {EMPLOYER_LABEL}</div>

      <header className="office-head">
        <h2>{EMPLOYER_LABEL}</h2>
        <p>三方之外的中立委托机构：不占辖区，不参与易主，也没有声望与净化加成。这里写下的一切会成为世界书里的事实。</p>
        <div className="office-head-facts">
          <span><small>归属</small><b>中立 · 不属于任何一方</b></span>
          <span><small>辖区</small><b>无</b></span>
          <span><small>收留</small><b>任何出身</b></span>
        </div>
      </header>

      <div className="office-fields">
        {fields.map(field => (
          <label key={field.key} className="office-field" htmlFor={field.id}>
            <span className="office-field-head">
              <b>{field.label}</b>
              <i>{draft[field.key].length} / {field.limit}</i>
            </span>
            <textarea
              id={field.id}
              value={draft[field.key]}
              rows={3}
              maxLength={field.limit}
              onChange={e => setDraft(current => ({ ...current, [field.key]: e.target.value.slice(0, field.limit) }))}
            />
            <small>{field.hint}</small>
          </label>
        ))}
      </div>

      <section className="office-representative">
        <header>
          <UserRoundCheck size={15} />
          <div>
            <b>对外代表</b>
            <small>代表由值班助理兼任；换代表就是换助理，规则与会客厅一致。</small>
          </div>
        </header>
        <div id="office-representative" className="office-representative-card">
          {representative ? (
            <>
              <b>{representative.name}</b>
              <small>{representative.codename}</small>
              <span className="office-tag" style={{ '--tag-color': factionTagColor(representative.factionTag) } as React.CSSProperties}>
                <Feather size={11} />出身 {factionTagLabel(representative.factionTag)}
              </span>
            </>
          ) : (
            <p>尚未任命对外代表。任命值班助理后，她会替你坐到三方的那张桌子前。</p>
          )}
        </div>
        <div className="office-assistant-picks">
          {candidates.map(girl => (
            <button
              key={girl.id}
              id={`office-assistant-${girl.id}`}
              type="button"
              className={assistantId === girl.id ? 'active' : ''}
              onClick={() => onAssistant(assistantId === girl.id ? undefined : girl.id)}
            >
              {assistantId === girl.id ? <Check size={12} /> : <MoonStar size={12} />}
              {assistantId === girl.id ? `代表·${girl.name}` : `任命${girl.name}`}
              <i>羁绊 {girl.bond}</i>
            </button>
          ))}
          {assistantId && (
            <button id="office-assistant-clear" type="button" className="clear" onClick={() => onAssistant(undefined)}>
              <X size={12} />取消代表
            </button>
          )}
        </div>
        {candidates.length === 0 && <p className="office-note">还没有羁绊达到 40 的少女可以出任代表。</p>}
      </section>

      <footer className="office-foot">
        <span><BookOpen size={12} />保存后同步到世界书「{EMPLOYER_LABEL}」条目。</span>
        <div>
          <button id="office-cancel" type="button" className="btn ghost" onClick={onClose}>取消</button>
          <button id="office-save" type="button" className="btn" onClick={() => onSave(draft)}>保存档案</button>
        </div>
      </footer>
    </div>
  );
}
