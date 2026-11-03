import { useState } from 'react';
import { BookOpen, Building2, Check, Feather, MoonStar, Save, UserRound, UserRoundCheck, X } from 'lucide-react';
import type { Girl, OfficeProfile } from '../types';
import { OFFICE_LIMITS, representativeOf } from '../office';
import { EMPLOYER_LABEL, factionTagColor, factionTagLabel } from '../factions';
import { loadPlayerProfile, savePlayerProfile, type PlayerProfile } from '../player';

interface OfficeDialogProps {
  profile: OfficeProfile;
  girls: Girl[];
  assistantId?: string;
  onSave: (profile: OfficeProfile) => void;
  onAssistant: (girlId?: string) => void;
  onClose: () => void;
}

type OfficeTab = 'office' | 'player';

const fields = [
  { key: 'background', label: '背景', hint: '事务所从哪里来、为什么关门、又被谁重新点亮。', limit: OFFICE_LIMITS.background, id: 'office-background' },
  { key: 'philosophy', label: '理念', hint: '它凭什么在三方之间站住脚。', limit: OFFICE_LIMITS.philosophy, id: 'office-philosophy' },
  { key: 'goal', label: '目标', hint: '你打算把这间事务所带去哪里。', limit: OFFICE_LIMITS.goal, id: 'office-goal' },
] as const;

const PLAYER_LIMITS = { name: 24, alias: 24, appearance: 400, personality: 400, background: 400, relation: 400 } as const;

/**
 * 事务所档案 + 玩家档案。
 *
 * 事务所这一页编辑的是「雇主」的自我介绍，不是第四方势力：没有辖区、没有声望、没有净化加成。
 * 玩家这一页写的是叙事者眼里的所长；两项都在这里一次改完，事务所部分保存后由 App 写进世界书。
 */
export function OfficeDialog({ profile, girls, assistantId, onSave, onAssistant, onClose }: OfficeDialogProps) {
  const [tab, setTab] = useState<OfficeTab>('office');
  const [draft, setDraft] = useState<OfficeProfile>(profile);
  const [player, setPlayer] = useState<PlayerProfile>(loadPlayerProfile);
  const [saved, setSaved] = useState(false);
  const representative = representativeOf({ assistantId, girls });
  const active = girls.filter(g => !g.dead && !g.retired);
  const candidates = active.filter(g => g.bond >= 40);
  const patchPlayer = (patch: Partial<PlayerProfile>) => {
    setPlayer(current => ({ ...current, ...patch }));
    setSaved(false);
  };
  const commit = () => {
    savePlayerProfile(player);
    setSaved(true);
    onSave(draft);
  };

  return (
    <div id="office-dialog" className="office-dialog">
      <div className="modal-eyebrow"><Building2 size={14} />事务所档案 / 玩家档案 · {EMPLOYER_LABEL}</div>

      <nav className="office-tabs" role="tablist" aria-label="事务所与玩家档案">
        {([
          { id: 'office' as const, label: '事务所档案', icon: Building2 },
          { id: 'player' as const, label: '玩家档案', icon: UserRound },
        ]).map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              id={`office-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`office-tab ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <Icon size={12} />{item.label}
            </button>
          );
        })}
        <span className="office-tab-note">档案会作为事实写进叙事者的世界观</span>
      </nav>

      {tab === 'office' ? (
        <>
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
                  onChange={e => { setDraft(current => ({ ...current, [field.key]: e.target.value.slice(0, field.limit) })); setSaved(false); }}
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
        </>
      ) : (
        <section className="office-player" aria-label="玩家档案">
          <p className="office-player-note">叙事者眼里的你：会以 {'{{player}}'} 注入每个任务的提示词；电台播报与议会都会用这里的名字称呼你。</p>
          <div className="player-card office-player-card">
            <div className="player-grid">
              <label><span>名字</span><input id="office-player-name" value={player.name} maxLength={PLAYER_LIMITS.name} placeholder="例如：白鸟" onChange={e => patchPlayer({ name: e.target.value.slice(0, PLAYER_LIMITS.name) })} /></label>
              <label><span>称呼 / 代号</span><input id="office-player-alias" value={player.alias} maxLength={PLAYER_LIMITS.alias} placeholder="所长、夜班负责人" onChange={e => patchPlayer({ alias: e.target.value.slice(0, PLAYER_LIMITS.alias) })} /></label>
              <label><span>代词</span><select id="office-player-pronoun" value={player.pronoun} onChange={e => patchPlayer({ pronoun: e.target.value })}>
                <option value="">不指定</option>
                <option value="你">你</option>
                <option value="他">他</option>
                <option value="她">她</option>
                <option value="TA">TA</option>
              </select></label>
            </div>
            <label className="player-wide"><span>外貌</span><input id="office-player-appearance" value={player.appearance} maxLength={PLAYER_LIMITS.appearance} placeholder="叙事者描述你时可以参考的样子" onChange={e => patchPlayer({ appearance: e.target.value.slice(0, PLAYER_LIMITS.appearance) })} /></label>
            <label className="player-wide"><span>性格</span><input id="office-player-personality" value={player.personality} maxLength={PLAYER_LIMITS.personality} placeholder="她眼里的你是什么样的人" onChange={e => patchPlayer({ personality: e.target.value.slice(0, PLAYER_LIMITS.personality) })} /></label>
            <label className="player-wide"><span>背景</span><textarea id="office-player-background" rows={2} value={player.background} maxLength={PLAYER_LIMITS.background} placeholder="你为什么接手这间事务所" onChange={e => patchPlayer({ background: e.target.value.slice(0, PLAYER_LIMITS.background) })} /></label>
            <label className="player-wide"><span>与她们的关系</span><textarea id="office-player-relation" rows={2} value={player.relation} maxLength={PLAYER_LIMITS.relation} placeholder="你希望她们怎么叫你、怎么待你" onChange={e => patchPlayer({ relation: e.target.value.slice(0, PLAYER_LIMITS.relation) })} /></label>
          </div>
        </section>
      )}

      <footer className="office-foot">
        <span><BookOpen size={12} />{tab === 'office' ? `保存后同步到世界书「${EMPLOYER_LABEL}」条目。` : '玩家档案只存在本地，随预设 {{player}} 注入叙事者。'}{saved && <b className="office-saved"> 已保存</b>}</span>
        <div>
          <button id="office-cancel" type="button" className="btn ghost" onClick={onClose}>关闭</button>
          <button id="office-save" type="button" className="btn" onClick={commit}><Save size={14} />保存档案</button>
        </div>
      </footer>
    </div>
  );
}
