import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Copy, Download, FlaskConical, Heart, Lock, MapPin, Play, Plus, Save, ShieldCheck, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type { Equipment, GameState, IncidentCard, IncidentCardEffect, MissionTemplate, MonsterRule, MonsterTemplate, Skill, SkillEffect, StatKey } from '../../types';
import { items as itemRegistry, factionInfo } from '../../content/items';
import { monsters as monsterRegistry, rankOrder } from '../../content/monsters';
import { effectText, resourceLabels, skills as skillRegistry, tierLabels } from '../../content/skills';
import { districts } from '../../districts';
import { missionTemplates } from '../../game';
import {
  applyLibrary, contentUsage, emptyIncidentCard, emptyItem, emptyMission, emptyMonster, emptySkill, exportContentPack, libraryCounts, mergeContentPack, readContentPack, ruleText, saveLibrary,
  type ContentLibrary, type ImportStrategy, type WorkshopKind,
} from '../../content/library';
import { MonsterGlyph } from '../MonsterGlyph';

const STAT_LABELS: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };
const STAT_KEYS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];
const EFFECT_KINDS: SkillEffect['kind'][] = ['dot', 'stun', 'shield', 'buff', 'debuff', 'regen'];
const EFFECT_KIND_LABELS: Record<SkillEffect['kind'], string> = { dot: '持续伤害', stun: '眩晕', shield: '护盾', buff: '增益', debuff: '减益', regen: '恢复' };
const EFFECT_STATS: NonNullable<SkillEffect['stat']>[] = [...STAT_KEYS, 'hit', 'initiative'];
const EFFECT_STAT_LABELS: Record<NonNullable<SkillEffect['stat']>, string> = { ...STAT_LABELS, hit: '命中', initiative: '先手' };
const RULE_TRIGGERS: MonsterRule['trigger'][] = ['roundStart', 'hit', 'always'];
const RULE_TRIGGER_LABELS: Record<MonsterRule['trigger'], string> = { roundStart: '每轮开始', hit: '被击中时', always: '始终' };
const RULE_EFFECTS: MonsterRule['effect'][] = ['heal', 'buff', 'haste', 'debuffAttacker', 'dot', 'immuneStun', 'damageReduce'];
const RULE_EFFECT_LABELS: Record<MonsterRule['effect'], string> = {
  heal: '恢复生命', buff: '属性增益', haste: '加速', debuffAttacker: '削弱攻击者', dot: '持续伤害', immuneStun: '免疫眩晕', damageReduce: '伤害减免',
};
const BODY_PLANS: MonsterTemplate['spec']['bodyPlan'][] = ['moth', 'feline', 'humanoid', 'machine', 'swarm', 'orb'];
const CORES: MonsterTemplate['spec']['core'][] = ['眼', '心', '钟', '糖', '月'];
const AURAS: MonsterTemplate['spec']['aura'][] = ['静电', '余烬', '花瓣', '故障'];
const MOTIFS: MonsterTemplate['spec']['motif'][] = ['猫', '糖', '星', '月', '蝶', '钟'];
const ELEMENTS: MonsterTemplate['element'][] = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物'];
const CONSUMABLES: NonNullable<Equipment['effect']>[] = ['drug', 'heal', 'purify', 'contractDiscount', 'taxRefund'];
const CONSUMABLE_LABELS: Record<NonNullable<Equipment['effect']>, string> = { drug: '药剂', heal: '治疗', purify: '净化', contractDiscount: '契约折扣', taxRefund: '退税' };
const MISSION_DIFFICULTIES: MissionTemplate['difficulty'][] = ['低危', '中危', '高危', '绝望'];
const MISSION_WORK_LABELS: Record<MissionTemplate['work'], string> = { combat: '战斗', investigation: '调查' };
const MISSION_WINDOW_LABELS: Record<NonNullable<MissionTemplate['window']>, string> = { urgent: '紧急', long: '长期' };
const INCIDENT_KINDS: IncidentCard['kind'][] = ['faction', 'environment', 'girl'];
const INCIDENT_KIND_LABELS: Record<IncidentCard['kind'], string> = { faction: '三方势力', environment: '环境变化', girl: '契约者状态' };
const INCIDENT_TRIGGERS: IncidentCard['trigger'][] = ['manual', 'pool'];
const INCIDENT_TRIGGER_LABELS: Record<IncidentCard['trigger'], string> = { manual: '手动投放', pool: '随机池（后续接入）' };
const KIND_LABELS: Record<WorkshopKind, string> = { mission: '委托', skill: '技能', item: '装备与消耗品', monster: '魔物', incident: '弹窗事件' };
const KIND_NEW_LABELS: Record<WorkshopKind, string> = { mission: '委托', skill: '技能', item: '装备', monster: '魔物', incident: '弹窗' };

interface PickerOption { value: string; label: string; note?: string }

function FilterPickerRow({ idPrefix, index, options, value, disabled, placeholder, taken, onChange, onRemove }: {
  idPrefix: string;
  index: number;
  options: PickerOption[];
  value: string;
  disabled: boolean;
  placeholder: string;
  taken: Set<string>;
  onChange: (value: string) => void;
  onRemove?: () => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const pool = options.filter(option => (!taken.has(option.value) || option.value === value)
    && (!needle || `${option.label} ${option.note ?? ''}`.toLowerCase().includes(needle)));
  const chosen = options.find(option => option.value === value);
  const visible = chosen && !pool.some(option => option.value === value) ? [chosen, ...pool] : pool;
  return (
    <div className="workshop-picker-row">
      <input
        id={`${idPrefix}-filter-${index}`}
        className="workshop-picker-filter"
        value={query}
        placeholder="输入关键词筛选"
        disabled={disabled}
        onChange={event => setQuery(event.target.value)}
      />
      <select id={`${idPrefix}-${index}`} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {visible.map(option => <option key={option.value} value={option.value}>{option.label}{option.note ? ` · ${option.note}` : ''}</option>)}
      </select>
      {onRemove && <button id={`${idPrefix}-remove-${index}`} type="button" className="icon-btn" disabled={disabled} onClick={onRemove} aria-label="移除这一项"><Trash2 size={12} /></button>}
    </div>
  );
}

interface Props {
  state: GameState;
  library: ContentLibrary;
  onCommit: (library: ContentLibrary) => void;
  onDeployMission: (template: MissionTemplate) => void;
  onDeployIncident: (card: IncidentCard) => void;
  onClose: () => void;
  onNotify: (message: string, ok?: boolean) => void;
}

const isCustom = (id: string) => id.startsWith('custom-');
const num = (value: string, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const baseMission = (option: ReturnType<typeof missionTemplates>[number]): MissionTemplate => ({
  id: option.id, title: option.title, category: option.category, description: option.description,
  difficulty: option.difficulty as MissionTemplate['difficulty'], duration: option.duration,
  requirement: option.requirement, target: option.target, work: option.work,
  enemyIds: option.monsters.map(monster => monster.id), rounds: 3, recommendedLevel: 3,
  reward: 600, color: '#c9a7e8',
});

export function ContentWorkshopDialog({ state, library, onCommit, onDeployMission, onDeployIncident, onClose, onNotify }: Props) {
  const [draft, setDraft] = useState<ContentLibrary>(library);
  const [kind, setKind] = useState<WorkshopKind>('mission');
  const [selected, setSelected] = useState<Record<WorkshopKind, string>>({
    skill: library.skills[0]?.id ?? skillRegistry[0]?.id ?? '',
    item: library.items[0]?.id ?? itemRegistry[0]?.id ?? '',
    monster: library.monsters[0]?.id ?? monsterRegistry[0]?.id ?? '',
    mission: library.missions[0]?.id ?? missionTemplates()[0]?.id ?? '',
    incident: library.incidents[0]?.id ?? '',
  });
  const [tab, setTab] = useState<'form' | 'preview'>('form');
  const [strategy, setStrategy] = useState<ImportStrategy>('rename');
  const importRef = useRef<HTMLInputElement>(null);
  const [enemySlots, setEnemySlots] = useState<string[]>(['']);
  const [skillSlots, setSkillSlots] = useState<string[]>(['']);

  const allSkills = useMemo(() => [...skillRegistry.filter(entry => !isCustom(entry.id)), ...draft.skills], [draft.skills]);
  const allItems = useMemo(() => [...itemRegistry.filter(entry => !isCustom(entry.id)), ...draft.items], [draft.items]);
  const allMonsters = useMemo(() => [...monsterRegistry.filter(entry => !isCustom(entry.id)), ...draft.monsters], [draft.monsters]);
  const allMissions = useMemo(
    () => [...missionTemplates().filter(entry => !entry.id.startsWith('custom-')).map(baseMission), ...draft.missions],
    [draft.missions],
  );
  const allIncidents = draft.incidents;
  const list: { id: string; name: string; note: string }[] = kind === 'skill'
    ? allSkills.map(entry => ({ id: entry.id, name: entry.name, note: `${tierLabels[entry.tier]} · ${resourceLabels[entry.resource]}` }))
    : kind === 'item'
      ? allItems.map(entry => ({ id: entry.id, name: entry.name, note: `${factionInfo[entry.faction].name} · ${entry.slot}` }))
      : kind === 'monster'
        ? allMonsters.map(entry => ({ id: entry.id, name: entry.name, note: `${entry.rank} · ${entry.element}` }))
        : kind === 'incident'
          ? allIncidents.map(entry => ({ id: entry.id, name: entry.title, note: `${INCIDENT_KIND_LABELS[entry.kind]} · ${entry.options.length} 个选项` }))
          : allMissions.map(entry => ({ id: entry.id, name: entry.title, note: `${entry.difficulty} · ${MISSION_WORK_LABELS[entry.work]} · ${entry.duration} 分` }));
  const currentId = selected[kind];
  const skill = allSkills.find(entry => entry.id === currentId) ?? allSkills[0];
  const item = allItems.find(entry => entry.id === currentId) ?? allItems[0];
  const monster = allMonsters.find(entry => entry.id === currentId) ?? allMonsters[0];
  const mission = allMissions.find(entry => entry.id === currentId) ?? allMissions[0];
  const incident = allIncidents.find(entry => entry.id === currentId) ?? allIncidents[0];
  const current = kind === 'skill' ? skill : kind === 'item' ? item : kind === 'monster' ? monster : kind === 'incident' ? incident : mission;
  const currentName = kind === 'mission' ? mission?.title : kind === 'incident' ? incident?.title : (current as Skill | Equipment | MonsterTemplate | undefined)?.name;
  const editable = Boolean(current && isCustom(current.id));

  useEffect(() => {
    setEnemySlots(mission && mission.enemyIds.length ? [...mission.enemyIds] : ['']);
  }, [selected.mission]);
  useEffect(() => {
    setSkillSlots(monster && monster.skillIds.length ? [...monster.skillIds] : ['']);
  }, [selected.monster]);

  const switchKind = (next: WorkshopKind) => {
    setKind(next);
    setTab('form');
  };
  const select = (id: string) => setSelected(prev => ({ ...prev, [kind]: id }));

  const patchSkill = (patch: Partial<Skill>) => {
    if (!skill || !isCustom(skill.id)) return;
    setDraft(prev => ({ ...prev, skills: prev.skills.map(entry => entry.id === skill.id ? { ...entry, ...patch } : entry) }));
  };
  const patchEffect = (index: number, patch: Partial<SkillEffect>) => {
    if (!skill) return;
    patchSkill({ effects: skill.effects.map((entry, at) => at === index ? { ...entry, ...patch } : entry) });
  };
  const patchItem = (patch: Partial<Equipment>) => {
    if (!item || !isCustom(item.id)) return;
    setDraft(prev => ({ ...prev, items: prev.items.map(entry => entry.id === item.id ? { ...entry, ...patch } : entry) }));
  };
  const patchMonster = (patch: Partial<MonsterTemplate>) => {
    if (!monster || !isCustom(monster.id)) return;
    setDraft(prev => ({ ...prev, monsters: prev.monsters.map(entry => entry.id === monster.id ? { ...entry, ...patch } : entry) }));
  };
  const patchMission = (patch: Partial<MissionTemplate>) => {
    if (!mission || !isCustom(mission.id)) return;
    setDraft(prev => ({ ...prev, missions: prev.missions.map(entry => entry.id === mission.id ? { ...entry, ...patch } : entry) }));
  };
  const patchIncident = (patch: Partial<IncidentCard>) => {
    if (!incident || !isCustom(incident.id)) return;
    setDraft(prev => ({ ...prev, incidents: prev.incidents.map(entry => entry.id === incident.id ? { ...entry, ...patch } : entry) }));
  };
  const patchIncidentOption = (index: number, patch: Partial<IncidentCard['options'][number]>) => {
    if (!incident) return;
    patchIncident({ options: incident.options.map((entry, at) => at === index ? { ...entry, ...patch } : entry) });
  };
  const patchIncidentEffect = (index: number, patch: Partial<IncidentCardEffect>) => {
    const option = incident?.options[index];
    if (!option) return;
    patchIncidentOption(index, { effect: { ...option.effect, ...patch } });
  };
  const setIncidentDistrict = (index: number, patch: Partial<NonNullable<IncidentCardEffect['district']>>) => {
    const option = incident?.options[index];
    if (!option) return;
    const base = option.effect.district ?? { id: 'candy' as const, days: 1 };
    patchIncidentEffect(index, { district: { ...base, ...patch } });
  };
  const patchRule = (index: number, patch: Partial<MonsterRule>) => {
    if (!monster) return;
    patchMonster({ rules: (monster.rules ?? []).map((entry, at) => at === index ? { ...entry, ...patch } : entry) });
  };

  const createNew = () => {
    if (kind === 'skill') {
      const next = emptySkill();
      setDraft(prev => ({ ...prev, skills: [...prev.skills, next] }));
      select(next.id);
    } else if (kind === 'item') {
      const next = emptyItem();
      setDraft(prev => ({ ...prev, items: [...prev.items, next] }));
      select(next.id);
    } else if (kind === 'monster') {
      const next = emptyMonster();
      setDraft(prev => ({ ...prev, monsters: [...prev.monsters, next] }));
      select(next.id);
    } else if (kind === 'incident') {
      const next = emptyIncidentCard();
      setDraft(prev => ({ ...prev, incidents: [...prev.incidents, next] }));
      select(next.id);
    } else {
      const next = emptyMission();
      setDraft(prev => ({ ...prev, missions: [...prev.missions, next] }));
      select(next.id);
    }
    setTab('form');
  };

  const duplicate = () => {
    if (!current) return;
    if (kind === 'skill' && skill) {
      const next: Skill = { ...skill, id: `custom-skill-${Date.now().toString(36)}`, name: `${skill.name} 副本`, school: '自制', effects: skill.effects.map(effect => ({ ...effect })) };
      setDraft(prev => ({ ...prev, skills: [...prev.skills, next] }));
      select(next.id);
    } else if (kind === 'item' && item) {
      const next: Equipment = { ...item, id: `custom-item-${Date.now().toString(36)}`, name: `${item.name} 副本`, stats: { ...item.stats } };
      setDraft(prev => ({ ...prev, items: [...prev.items, next] }));
      select(next.id);
    } else if (kind === 'monster' && monster) {
      const next: MonsterTemplate = { ...monster, id: `custom-monster-${Date.now().toString(36)}`, name: `${monster.name} 副本`, stats: { ...monster.stats }, skillIds: [...monster.skillIds], rules: (monster.rules ?? []).map(rule => ({ ...rule })), spec: { ...monster.spec, palette: { ...monster.spec.palette } }, codex: { ...monster.codex } };
      setDraft(prev => ({ ...prev, monsters: [...prev.monsters, next] }));
      select(next.id);
    } else if (kind === 'mission' && mission) {
      const next: MissionTemplate = { ...mission, id: `custom-mission-${Date.now().toString(36)}`, title: `${mission.title} 副本`, enemyIds: [...mission.enemyIds] };
      setDraft(prev => ({ ...prev, missions: [...prev.missions, next] }));
      select(next.id);
    } else if (kind === 'incident' && incident) {
      const next: IncidentCard = {
        ...incident, id: `custom-incident-${Date.now().toString(36)}`, title: `${incident.title} 副本`,
        options: incident.options.map(option => ({ ...option, effect: { ...option.effect, faction: option.effect.faction ? { ...option.effect.faction } : undefined, girl: option.effect.girl ? { ...option.effect.girl } : undefined, district: option.effect.district ? { ...option.effect.district } : undefined, territory: option.effect.territory ? { ...option.effect.territory } : undefined } })),
      };
      setDraft(prev => ({ ...prev, incidents: [...prev.incidents, next] }));
      select(next.id);
    }
    setTab('form');
  };

  const remove = () => {
    if (!current || !isCustom(current.id)) return;
    const used = contentUsage(state, kind, current.id);
    if (used.length) {
      onNotify(`这份内容正在被${used.join('、')}使用，先解除引用再删除。`, false);
      return;
    }
    if (kind === 'skill') setDraft(prev => ({ ...prev, skills: prev.skills.filter(entry => entry.id !== current.id) }));
    if (kind === 'item') setDraft(prev => ({ ...prev, items: prev.items.filter(entry => entry.id !== current.id) }));
    if (kind === 'monster') setDraft(prev => ({ ...prev, monsters: prev.monsters.filter(entry => entry.id !== current.id) }));
    if (kind === 'mission') setDraft(prev => ({ ...prev, missions: prev.missions.filter(entry => entry.id !== current.id) }));
    if (kind === 'incident') setDraft(prev => ({ ...prev, incidents: prev.incidents.filter(entry => entry.id !== current.id) }));
    onNotify('已从草稿中移除，保存后生效。');
  };

  const commit = (next: ContentLibrary) => {
    const clean = saveLibrary(next);
    applyLibrary(clean);
    setDraft(clean);
    onCommit(clean);
    return clean;
  };

  const persist = () => {
    commit(draft);
    onNotify('内容库已保存，自制内容已进入图鉴、商店、委托轮转与战斗池。');
  };

  const exportPack = () => {
    const pack = exportContentPack(draft);
    const text = JSON.stringify(pack, null, 2);
    const count = pack.skills.length + pack.items.length + pack.monsters.length + pack.missions.length + pack.incidents.length;
    if (!count) {
      onNotify('内容库还是空的，先做一点东西再导出。', false);
      return;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `night-sugar-content-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify(`已导出 ${count} 条自制内容（约 ${Math.max(1, Math.round(text.length / 1024))} KB）。`);
  };

  const importPack = async (file: File) => {
    const raw = await file.text();
    const read = readContentPack(raw);
    if (!read.ok || !read.pack) {
      onNotify(read.errors[0] ?? '内容包读取失败。', false);
      return;
    }
    const merged = mergeContentPack(draft, read.pack, strategy);
    commit(merged.library);
    const extra = read.invalid ? `；忽略 ${read.invalid} 条非法条目` : '';
    onNotify(`导入完成：新增 ${merged.added}、覆盖 ${merged.replaced}、跳过 ${merged.skipped}、改名 ${merged.renamed}${extra}。`);
  };

  const addEffect = () => {
    if (!skill) return;
    patchSkill({ effects: [...skill.effects, { kind: 'buff', amount: 2, duration: 2 } as SkillEffect].slice(0, 6) });
  };
  const removeEffect = (index: number) => {
    if (!skill) return;
    patchSkill({ effects: skill.effects.filter((_, at) => at !== index) });
  };
  const addRule = () => {
    if (!monster) return;
    patchMonster({ rules: [...(monster.rules ?? []), { trigger: 'roundStart', effect: 'heal', amount: 4 } as MonsterRule].slice(0, 6) });
  };
  const removeRule = (index: number) => {
    if (!monster) return;
    patchMonster({ rules: (monster.rules ?? []).filter((_, at) => at !== index) });
  };

  const setEnemyAt = (index: number, id: string) => {
    if (!mission) return;
    const next = [...enemySlots];
    next[index] = id;
    setEnemySlots(next);
    patchMission({ enemyIds: next.filter(Boolean).slice(0, 3) });
  };
  const addEnemySlot = () => setEnemySlots(previous => [...previous, ''].slice(0, 3));
  const removeEnemySlot = (index: number) => {
    const next = enemySlots.filter((_, at) => at !== index);
    const slots = next.length ? next : [''];
    setEnemySlots(slots);
    if (mission) patchMission({ enemyIds: slots.filter(Boolean) });
  };
  const setSkillAt = (index: number, id: string) => {
    if (!monster) return;
    const next = [...skillSlots];
    next[index] = id;
    setSkillSlots(next);
    patchMonster({ skillIds: next.filter(Boolean).slice(0, 6) });
  };
  const addSkillSlot = () => setSkillSlots(previous => [...previous, ''].slice(0, 6));
  const removeSkillSlot = (index: number) => {
    const next = skillSlots.filter((_, at) => at !== index);
    const slots = next.length ? next : [''];
    setSkillSlots(slots);
    if (monster) patchMonster({ skillIds: slots.filter(Boolean) });
  };

  const deploy = () => {
    if (!mission) return;
    if (mission.work === 'combat' && mission.enemyIds.length === 0) {
      onNotify('战斗委托至少需要一只魔物。', false);
      return;
    }
    onDeployMission(mission);
  };
  const addIncidentOption = () => {
    if (!incident) return;
    patchIncident({ options: [...incident.options, { id: `opt-${incident.options.length + 1}`, label: '新的选择', hint: '', effect: {} }].slice(0, 3) });
  };
  const removeIncidentOption = (index: number) => {
    if (!incident || incident.options.length <= 2) return;
    patchIncident({ options: incident.options.filter((_, at) => at !== index) });
  };
  const deployIncident = () => {
    if (!incident) return;
    if (!incident.title.trim() || !incident.body.trim()) {
      onNotify('弹窗需要标题和正文。', false);
      return;
    }
    onDeployIncident(incident);
  };

  return (
    <section className="workshop-layer" aria-label="内容工坊">
      <div className="workshop-shell">
        <header className="workshop-head">
          <div>
            <p className="eyebrow"><Sparkles size={12} /> 内容工坊 · 人工设计</p>
            <h2>夜糖内容工坊</h2>
            <p className="workshop-sub">{libraryCounts(draft)} · 保存后进入图鉴、商店货架与战斗池</p>
          </div>
          <div className="workshop-head-actions">
            <button id="workshop-new" className="ghost-btn" onClick={createNew}><Plus size={14} /> 新建{KIND_NEW_LABELS[kind]}</button>
            <button id="workshop-export" className="ghost-btn" onClick={exportPack} title="导出全部自制内容为 JSON"><Download size={14} /> 导出</button>
            <button id="workshop-import" className="ghost-btn" onClick={() => importRef.current?.click()} title="从 JSON 内容包导入"><Upload size={14} /> 导入</button>
            <select id="workshop-import-strategy" className="workshop-import-select" value={strategy} onChange={event => setStrategy(event.target.value as ImportStrategy)} title="导入时的冲突处理方式">
              <option value="rename">冲突另存</option>
              <option value="overwrite">冲突覆盖</option>
              <option value="skip">冲突跳过</option>
            </select>
            <input
              ref={importRef}
              id="workshop-import-file"
              type="file"
              accept="application/json,.json"
              hidden
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importPack(file);
              }}
            />
            <button id="workshop-save" className="primary-btn" onClick={persist}><Save size={14} /> 保存内容库</button>
            <button id="workshop-close" className="icon-btn" onClick={onClose} aria-label="关闭内容工坊"><X size={18} /></button>
          </div>
        </header>

        <div className="workshop-tabs" role="tablist">
          {(['mission', 'incident', 'skill', 'item', 'monster'] as WorkshopKind[]).map(entry => (
            <button key={entry} id={`workshop-tab-${entry}`} role="tab" aria-selected={kind === entry} className={kind === entry ? 'active' : ''} onClick={() => switchKind(entry)}>
              {KIND_LABELS[entry]}
              <em>{entry === 'skill' ? allSkills.length : entry === 'item' ? allItems.length : entry === 'monster' ? allMonsters.length : entry === 'incident' ? allIncidents.length : allMissions.length}</em>
            </button>
          ))}
        </div>

        <div className="workshop-body">
          <aside className="workshop-list" aria-label="内容列表">
            <div className="workshop-list-head"><span>全部条目</span><small>{list.length}</small></div>
            <div id="workshop-list" role="list">
              {list.map(entry => (
                <button key={entry.id} id={`workshop-entry-${entry.id}`} role="listitem" className={`workshop-entry ${entry.id === current?.id ? 'active' : ''}`} onClick={() => select(entry.id)}>
                  <span>{entry.name}</span>
                  <em>{entry.note}</em>
                  {!isCustom(entry.id) && <Lock size={11} />}
                </button>
              ))}
            </div>
          </aside>

          <main className="workshop-main">
            <div className="workshop-main-head">
              <div>
                <p className="eyebrow">{current && isCustom(current.id) ? '自制内容 · 可编辑' : '内置内容 · 只读'}</p>
                <h3>{currentName ?? '未选择'}</h3>
              </div>
              <div className="workshop-main-actions">
                <button id="workshop-duplicate" className="ghost-btn" onClick={duplicate}><Copy size={13} /> 复制为自制</button>
                {editable && <button id="workshop-delete" className="ghost-btn danger" onClick={remove}><Trash2 size={13} /> 删除</button>}
                {mission && kind === 'mission' && <button id="workshop-deploy" className="ghost-btn" onClick={deploy}><Play size={13} /> 投放测试</button>}
                {incident && kind === 'incident' && <button id="workshop-deploy" className="ghost-btn" onClick={deployIncident}><Play size={13} /> 投放测试</button>}
                <button id="workshop-tab-form" className={`ghost-btn ${tab === 'form' ? 'active' : ''}`} onClick={() => setTab('form')}>编辑</button>
                <button id="workshop-tab-preview" className={`ghost-btn ${tab === 'preview' ? 'active' : ''}`} onClick={() => setTab('preview')}>预览</button>
              </div>
            </div>

            {!editable && <p className="workshop-lock"><Lock size={13} /> 内置内容保持只读；点「复制为自制」后即可修改。</p>}

            {!current && <p className="workshop-lock">这一页还没有条目，点右上角新建。</p>}

            {current && tab === 'preview' && (
              <div id="workshop-preview" className="workshop-preview">
                {kind === 'skill' && skill && (
                  <article className="workshop-card">
                    <header><FlaskConical size={16} /><strong>{skill.name}</strong><em>{tierLabels[skill.tier]} · {resourceLabels[skill.resource]} · 威力 {skill.power}</em></header>
                    <p>{skill.description || '还没有写说明。'}</p>
                    <ul>{skill.effects.map((effect, index) => <li key={`${effect.kind}-${index}`}>{effectText(effect)}</li>)}</ul>
                  </article>
                )}
                {kind === 'item' && item && (
                  <article className="workshop-card">
                    <header><Sparkles size={16} /><strong>{item.name}</strong><em>{factionInfo[item.faction].name} · {item.price} 星砂</em></header>
                    <p>{item.description || '还没有写说明。'}</p>
                    <ul>
                      {item.passive && <li>{item.passive}</li>}
                      {STAT_KEYS.filter(key => item.stats?.[key]).map(key => <li key={key}>{STAT_LABELS[key]} +{item.stats?.[key]}</li>)}
                      {item.skillId && <li>附带技能：{skillRegistry.find(entry => entry.id === item.skillId)?.name ?? item.skillId}</li>}
                      {item.effect && <li>{CONSUMABLE_LABELS[item.effect]} {item.amount ?? 0}</li>}
                    </ul>
                  </article>
                )}
                {kind === 'monster' && monster && (
                  <article className="workshop-card workshop-monster-preview">
                    <MonsterGlyph monster={monster} size={150} />
                    <div>
                      <header><strong>{monster.name}</strong><em>{monster.rank} · {monster.element}</em></header>
                      <p>{monster.epithet}</p>
                      <p className="workshop-muted">{monster.trait || '尚未填写特性描述。'} HP {monster.maxHp} / 共情 {monster.maxSpirit}</p>
                      <ul>{(monster.rules ?? []).map((rule, index) => <li key={index}>{ruleText(rule)}</li>)}</ul>
                      <p className="workshop-muted">技能：{monster.skillIds.map(id => skillRegistry.find(entry => entry.id === id)?.name ?? id).join('、')}</p>
                    </div>
                  </article>
                )}
                {kind === 'incident' && incident && (
                  <article className="incident-card workshop-incident-card">
                    <header className="incident-head">
                      <span className={`incident-kind ${incident.kind}`}><AlertTriangle size={13} />{INCIDENT_KIND_LABELS[incident.kind]}</span>
                      <span className="incident-source">工坊投放</span>
                    </header>
                    <h2>{incident.title}</h2>
                    {incident.faction && <p className="incident-meta"><ShieldCheck size={12} />{factionInfo[incident.faction].name} · {factionInfo[incident.faction].envoy}</p>}
                    {incident.district && <p className="incident-meta"><MapPin size={12} />{districts[incident.district].name}</p>}
                    {incident.girlId && <p className="incident-meta"><Heart size={12} />{state.girls.find(girl => girl.id === incident.girlId)?.name ?? incident.girlId}</p>}
                    <p className="incident-body">{incident.body || '还没有写正文。'}</p>
                    <div className="incident-options">
                      {incident.options.map((option, index) => (
                        <div key={option.id} className="incident-option">
                          <em>{index + 1}</em>
                          <span><b>{option.label}</b><small>{option.hint || '没有补充说明。'}</small></span>
                        </div>
                      ))}
                    </div>
                    <footer className="incident-foot"><Sparkles size={12} />必须现在决定。处理完才能继续推进时间。</footer>
                  </article>
                )}
                {kind === 'mission' && mission && (
                  <article className="workshop-card">
                    <header><Play size={16} /><strong>{mission.title}</strong><em>{mission.difficulty} · {MISSION_WORK_LABELS[mission.work]}</em></header>
                    <p>{mission.description || '还没有写说明。'}</p>
                    <ul>
                      <li>时长 {mission.duration} 分钟 · 判定 {STAT_LABELS[mission.requirement]} ≥ {mission.target}</li>
                      <li>{mission.district ? districts[mission.district].name : '辖区自动轮转'} · {mission.window ? MISSION_WINDOW_LABELS[mission.window] : '窗口自动'}</li>
                      <li>报酬 {mission.reward} 星砂 · 推荐等级 {mission.recommendedLevel} · {mission.rounds} 轮</li>
                      <li>对手：{mission.enemyIds.length ? mission.enemyIds.map(id => allMonsters.find(entry => entry.id === id)?.name ?? id).join('、') : '无（调查委托）'}</li>
                    </ul>
                  </article>
                )}
              </div>
            )}

            {current && tab === 'form' && kind === 'skill' && skill && (
              <div className="workshop-form">
                <div className="workshop-grid">
                  <label className="field"><span>名称</span><input id="workshop-name" value={skill.name} disabled={!editable} onChange={event => patchSkill({ name: event.target.value })} /></label>
                  <label className="field"><span>流派</span><input id="workshop-school" value={skill.school} disabled={!editable} onChange={event => patchSkill({ school: event.target.value })} /></label>
                  <label className="field"><span>阶级</span><select id="workshop-tier" value={skill.tier} disabled={!editable} onChange={event => patchSkill({ tier: event.target.value as Skill['tier'] })}>{Object.entries(tierLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="field"><span>消耗</span><select id="workshop-resource" value={skill.resource} disabled={!editable} onChange={event => patchSkill({ resource: event.target.value as Skill['resource'] })}>{Object.entries(resourceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label className="field"><span>作用对象</span><select id="workshop-side" value={skill.side} disabled={!editable} onChange={event => patchSkill({ side: event.target.value as Skill['side'] })}><option value="enemy">敌方单体</option><option value="ally">友方</option><option value="self">自身</option></select></label>
                  <label className="field"><span>威力</span><input id="workshop-power" type="number" step="0.1" value={skill.power} disabled={!editable} onChange={event => patchSkill({ power: num(event.target.value) })} /></label>
                  <label className="field"><span>目标数</span><input id="workshop-targets" type="number" value={skill.targets} disabled={!editable} onChange={event => patchSkill({ targets: Math.max(1, num(event.target.value, 1)) })} /></label>
                  <label className="field"><span>冷却</span><input id="workshop-cooldown" type="number" value={skill.cooldown} disabled={!editable} onChange={event => patchSkill({ cooldown: Math.max(0, num(event.target.value)) })} /></label>
                </div>
                <label className="field"><span>说明</span><textarea id="workshop-description" rows={3} value={skill.description} disabled={!editable} onChange={event => patchSkill({ description: event.target.value })} /></label>
                <section className="workshop-section">
                  <header><h4>附加效果</h4><button id="workshop-add-effect" className="ghost-btn" disabled={!editable || skill.effects.length >= 6} onClick={addEffect}><Plus size={12} /> 添加</button></header>
                  {skill.effects.length === 0 && <p className="workshop-muted">没有附加效果，只造成基础伤害或治疗。</p>}
                  {skill.effects.map((effect, index) => (
                    <div className="workshop-row" key={index}>
                      <select id={`workshop-effect-kind-${index}`} value={effect.kind} disabled={!editable} onChange={event => patchEffect(index, { kind: event.target.value as SkillEffect['kind'] })}>
                        {EFFECT_KINDS.map(value => <option key={value} value={value}>{EFFECT_KIND_LABELS[value]}</option>)}
                      </select>
                      <select id={`workshop-effect-stat-${index}`} value={effect.stat ?? ''} disabled={!editable} onChange={event => patchEffect(index, { stat: (event.target.value || undefined) as SkillEffect['stat'] })}>
                        <option value="">无属性</option>
                        {EFFECT_STATS.map(value => <option key={value} value={value}>{EFFECT_STAT_LABELS[value]}</option>)}
                      </select>
                      <input id={`workshop-effect-amount-${index}`} type="number" value={effect.amount} disabled={!editable} onChange={event => patchEffect(index, { amount: num(event.target.value) })} aria-label="效果数值" />
                      <input id={`workshop-effect-duration-${index}`} type="number" value={effect.duration} disabled={!editable} onChange={event => patchEffect(index, { duration: Math.max(1, num(event.target.value, 1)) })} aria-label="持续回合" />
                      <input id={`workshop-effect-chance-${index}`} type="number" step="0.05" min="0" max="1" value={effect.chance ?? 1} disabled={!editable} onChange={event => patchEffect(index, { chance: Math.min(1, Math.max(0, num(event.target.value, 1))) })} aria-label="触发概率" />
                      <button id={`workshop-effect-remove-${index}`} className="icon-btn" disabled={!editable} onClick={() => removeEffect(index)} aria-label="删除效果"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </section>
              </div>
            )}

            {current && tab === 'form' && kind === 'item' && item && (
              <div className="workshop-form">
                <div className="workshop-grid">
                  <label className="field"><span>名称</span><input id="workshop-name" value={item.name} disabled={!editable} onChange={event => patchItem({ name: event.target.value })} /></label>
                  <label className="field"><span>阵营</span><select id="workshop-faction" value={item.faction} disabled={!editable} onChange={event => patchItem({ faction: event.target.value as Equipment['faction'] })}>{Object.entries(factionInfo).map(([value, info]) => <option key={value} value={value}>{info.name}</option>)}</select></label>
                  <label className="field"><span>槽位</span><select id="workshop-slot" value={item.slot} disabled={!editable} onChange={event => patchItem({ slot: event.target.value as Equipment['slot'] })}><option value="weapon">武器</option><option value="charm">护符</option><option value="consumable">消耗品</option></select></label>
                  <label className="field"><span>价格</span><input id="workshop-price" type="number" value={item.price} disabled={!editable} onChange={event => patchItem({ price: Math.max(0, num(event.target.value)) })} /></label>
                  <label className="field"><span>声望要求</span><input id="workshop-standing" type="number" value={item.standingReq} disabled={!editable} onChange={event => patchItem({ standingReq: Math.max(0, num(event.target.value)) })} /></label>
                  <label className="field"><span>附带技能</span><select id="workshop-skill" value={item.skillId ?? ''} disabled={!editable} onChange={event => patchItem({ skillId: event.target.value || undefined })}><option value="">无</option>{skillRegistry.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                  <label className="field"><span>被动</span><input id="workshop-passive" value={item.passive ?? ''} disabled={!editable} onChange={event => patchItem({ passive: event.target.value || undefined })} /></label>
                  <label className="field"><span>消耗品效果</span><select id="workshop-consumable" value={item.effect ?? ''} disabled={!editable} onChange={event => patchItem({ effect: (event.target.value || undefined) as Equipment['effect'] })}><option value="">无</option>{CONSUMABLES.map(value => <option key={value} value={value}>{CONSUMABLE_LABELS[value]}</option>)}</select></label>
                  <label className="field"><span>效果数值</span><input id="workshop-amount" type="number" value={item.amount ?? 0} disabled={!editable} onChange={event => patchItem({ amount: num(event.target.value) })} /></label>
                  <label className="field"><span>额外生命</span><input id="workshop-maxhp" type="number" value={item.maxHpBonus ?? 0} disabled={!editable} onChange={event => patchItem({ maxHpBonus: num(event.target.value) })} /></label>
                  <label className="field"><span>额外共情</span><input id="workshop-spirit" type="number" value={item.spiritBonus ?? 0} disabled={!editable} onChange={event => patchItem({ spiritBonus: num(event.target.value) })} /></label>
                  <label className="field"><span>每战侵蚀</span><input id="workshop-corruption" type="number" value={item.corruptionPerBattle ?? 0} disabled={!editable} onChange={event => patchItem({ corruptionPerBattle: num(event.target.value) })} /></label>
                  <label className="field"><span>伤害加成 %</span><input id="workshop-damage-bonus" type="number" value={item.damageBonus ?? 0} disabled={!editable} onChange={event => patchItem({ damageBonus: num(event.target.value) })} /></label>
                  <label className="field"><span>先手加成</span><input id="workshop-initiative-bonus" type="number" value={item.initiativeBonus ?? 0} disabled={!editable} onChange={event => patchItem({ initiativeBonus: num(event.target.value) })} /></label>
                </div>
                <div className="workshop-stats">
                  {STAT_KEYS.map(key => (
                    <label className="field" key={key}><span>{STAT_LABELS[key]}</span><input id={`workshop-stat-${key}`} type="number" value={item.stats?.[key] ?? 0} disabled={!editable} onChange={event => patchItem({ stats: { ...item.stats, [key]: num(event.target.value) } })} /></label>
                  ))}
                </div>
                <label className="field"><span>说明</span><textarea id="workshop-description" rows={3} value={item.description} disabled={!editable} onChange={event => patchItem({ description: event.target.value })} /></label>
              </div>
            )}

            {current && tab === 'form' && kind === 'monster' && monster && (
              <div className="workshop-form">
                <div className="workshop-grid">
                  <label className="field"><span>名称</span><input id="workshop-name" value={monster.name} disabled={!editable} onChange={event => patchMonster({ name: event.target.value })} /></label>
                  <label className="field"><span>别称</span><input id="workshop-epithet" value={monster.epithet} disabled={!editable} onChange={event => patchMonster({ epithet: event.target.value })} /></label>
                  <label className="field"><span>阶级</span><select id="workshop-rank" value={monster.rank} disabled={!editable} onChange={event => patchMonster({ rank: event.target.value as MonsterTemplate['rank'] })}>{rankOrder.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="field"><span>属性</span><select id="workshop-element" value={monster.element} disabled={!editable} onChange={event => patchMonster({ element: event.target.value as MonsterTemplate['element'] })}>{ELEMENTS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="field"><span>生命</span><input id="workshop-hp" type="number" value={monster.maxHp} disabled={!editable} onChange={event => patchMonster({ maxHp: Math.max(10, num(event.target.value, 120)) })} /></label>
                  <label className="field"><span>共情值</span><input id="workshop-spirit" type="number" value={monster.maxSpirit} disabled={!editable} onChange={event => patchMonster({ maxSpirit: Math.max(0, num(event.target.value)) })} /></label>
                  <label className="field"><span>主色</span><input id="workshop-color" type="color" value={monster.color} disabled={!editable} onChange={event => patchMonster({ color: event.target.value })} /></label>
                </div>
                <div className="workshop-stats">
                  {STAT_KEYS.map(key => (
                    <label className="field" key={key}><span>{STAT_LABELS[key]}</span><input id={`workshop-stat-${key}`} type="number" value={monster.stats[key]} disabled={!editable} onChange={event => patchMonster({ stats: { ...monster.stats, [key]: num(event.target.value, monster.stats[key]) } })} /></label>
                  ))}
                </div>
                <div className="workshop-grid">
                  <label className="field"><span>体型</span><select id="workshop-bodyplan" value={monster.spec.bodyPlan} disabled={!editable} onChange={event => patchMonster({ spec: { ...monster.spec, bodyPlan: event.target.value as MonsterTemplate['spec']['bodyPlan'] } })}>{BODY_PLANS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="field"><span>核心</span><select id="workshop-core" value={monster.spec.core} disabled={!editable} onChange={event => patchMonster({ spec: { ...monster.spec, core: event.target.value as MonsterTemplate['spec']['core'] } })}>{CORES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="field"><span>光效</span><select id="workshop-aura" value={monster.spec.aura} disabled={!editable} onChange={event => patchMonster({ spec: { ...monster.spec, aura: event.target.value as MonsterTemplate['spec']['aura'] } })}>{AURAS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="field"><span>纹样</span><select id="workshop-motif" value={monster.spec.motif} disabled={!editable} onChange={event => patchMonster({ spec: { ...monster.spec, motif: event.target.value as MonsterTemplate['spec']['motif'] } })}>{MOTIFS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="field"><span>附肢</span><input id="workshop-appendages" type="number" value={monster.spec.appendages} disabled={!editable} onChange={event => patchMonster({ spec: { ...monster.spec, appendages: Math.max(0, num(event.target.value)) } })} /></label>
                  <label className="field"><span>尺度</span><input id="workshop-scale" type="number" step="0.1" value={monster.spec.scale} disabled={!editable} onChange={event => patchMonster({ spec: { ...monster.spec, scale: num(event.target.value, 1) } })} /></label>
                </div>
                <div className="workshop-colors">
                  {(['body', 'shade', 'rim'] as const).map(part => (
                    <label className="field" key={part}><span>{part === 'body' ? '主体' : part === 'shade' ? '阴影' : '轮廓'}</span><input id={`workshop-palette-${part}`} type="color" value={monster.spec.palette[part]} disabled={!editable} onChange={event => patchMonster({ spec: { ...monster.spec, palette: { ...monster.spec.palette, [part]: event.target.value } } })} /></label>
                  ))}
                </div>
                <label className="field"><span>特性描述</span><textarea id="workshop-trait" rows={2} value={monster.trait} disabled={!editable} onChange={event => patchMonster({ trait: event.target.value })} /></label>
                <label className="field"><span>说明</span><textarea id="workshop-description" rows={2} value={monster.description} disabled={!editable} onChange={event => patchMonster({ description: event.target.value })} /></label>
                <div className="workshop-grid">
                  <label className="field"><span>习性</span><input id="workshop-habit" value={monster.codex.habit} disabled={!editable} onChange={event => patchMonster({ codex: { ...monster.codex, habit: event.target.value } })} /></label>
                  <label className="field"><span>弱点</span><input id="workshop-weakness" value={monster.codex.weakness} disabled={!editable} onChange={event => patchMonster({ codex: { ...monster.codex, weakness: event.target.value } })} /></label>
                </div>
                <section className="workshop-section">
                  <header><h4>战斗特性（MonsterRule）</h4><button id="workshop-add-rule" className="ghost-btn" disabled={!editable || (monster.rules ?? []).length >= 6} onClick={addRule}><Plus size={12} /> 添加规则</button></header>
                  {(monster.rules ?? []).length === 0 && <p className="workshop-muted">没有特性规则，这只魔物只会使用技能。</p>}
                  {(monster.rules ?? []).map((rule, index) => (
                    <div className="workshop-rule" key={index}>
                      <select id={`workshop-rule-trigger-${index}`} value={rule.trigger} disabled={!editable} onChange={event => patchRule(index, { trigger: event.target.value as MonsterRule['trigger'] })}>{RULE_TRIGGERS.map(value => <option key={value} value={value}>{RULE_TRIGGER_LABELS[value]}</option>)}</select>
                      <select id={`workshop-rule-effect-${index}`} value={rule.effect} disabled={!editable} onChange={event => patchRule(index, { effect: event.target.value as MonsterRule['effect'] })}>{RULE_EFFECTS.map(value => <option key={value} value={value}>{RULE_EFFECT_LABELS[value]}</option>)}</select>
                      <input id={`workshop-rule-amount-${index}`} type="number" value={rule.amount ?? 0} disabled={!editable} onChange={event => patchRule(index, { amount: num(event.target.value) })} aria-label="规则数值" />
                      {(rule.effect === 'buff' || rule.effect === 'debuffAttacker') && <select id={`workshop-rule-stat-${index}`} value={rule.stat ?? 'hit'} disabled={!editable} onChange={event => patchRule(index, { stat: event.target.value as MonsterRule['stat'] })}>{[...STAT_KEYS, 'hit'].map(value => <option key={value} value={value}>{value === 'hit' ? '命中' : STAT_LABELS[value as StatKey]}</option>)}</select>}
                      {(rule.effect === 'buff' || rule.effect === 'debuffAttacker' || rule.effect === 'dot') && <input id={`workshop-rule-duration-${index}`} type="number" value={rule.duration ?? 1} disabled={!editable} onChange={event => patchRule(index, { duration: Math.max(1, num(event.target.value, 1)) })} aria-label="持续回合" />}
                      {(rule.effect === 'buff' || rule.effect === 'heal') && <input id={`workshop-rule-below-${index}`} type="number" step="0.05" min="0.1" max="1" value={rule.belowHpPct ?? 1} disabled={!editable} onChange={event => patchRule(index, { belowHpPct: num(event.target.value, 1) })} aria-label="血量阈值" />}
                      {rule.effect === 'heal' && <label className="workshop-check"><input id={`workshop-rule-empathy-${index}`} type="checkbox" checked={Boolean(rule.unlessEmpathyDamage)} disabled={!editable} onChange={event => patchRule(index, { unlessEmpathyDamage: event.target.checked })} />受共情伤害的回合不触发</label>}
                      <button id={`workshop-rule-remove-${index}`} className="icon-btn" disabled={!editable} onClick={() => removeRule(index)} aria-label="删除规则"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </section>
                <section className="workshop-section">
                  <header><h4>技能（最多 6 个）</h4><small>{skillSlots.filter(Boolean).length}/6</small></header>
                  <div className="workshop-picker">
                    {skillSlots.map((value, index) => (
                      <FilterPickerRow
                        key={`${monster.id}-skill-${index}`}
                        idPrefix="workshop-monster-skill"
                        index={index}
                        options={allSkills.map(entry => ({ value: entry.id, label: entry.name, note: `${tierLabels[entry.tier]} · ${resourceLabels[entry.resource]}` }))}
                        value={value}
                        disabled={!editable}
                        placeholder="选择技能"
                        taken={new Set(skillSlots.filter((entry, at) => Boolean(entry) && at !== index))}
                        onChange={next => setSkillAt(index, next)}
                        onRemove={skillSlots.length > 1 ? () => removeSkillSlot(index) : undefined}
                      />
                    ))}
                    <button id="workshop-add-monster-skill" type="button" className="ghost-btn workshop-picker-add" disabled={!editable || skillSlots.length >= 6} onClick={addSkillSlot}><Plus size={13} /> 添加技能</button>
                  </div>
                </section>
              </div>
            )}

            {current && tab === 'form' && kind === 'mission' && mission && (
              <div className="workshop-form">
                <div className="workshop-grid">
                  <label className="field"><span>委托标题</span><input id="workshop-mission-title" value={mission.title} disabled={!editable} onChange={event => patchMission({ title: event.target.value })} /></label>
                  <label className="field"><span>分类</span><input id="workshop-mission-category" value={mission.category} disabled={!editable} onChange={event => patchMission({ category: event.target.value })} /></label>
                  <label className="field"><span>难度</span><select id="workshop-mission-difficulty" value={mission.difficulty} disabled={!editable} onChange={event => patchMission({ difficulty: event.target.value as MissionTemplate['difficulty'] })}>{MISSION_DIFFICULTIES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="field"><span>类型</span><select id="workshop-mission-work" value={mission.work} disabled={!editable} onChange={event => patchMission({ work: event.target.value as MissionTemplate['work'] })}><option value="combat">战斗</option><option value="investigation">调查</option></select></label>
                  <label className="field"><span>时长（分钟）</span><input id="workshop-mission-duration" type="number" step="15" min="15" max="240" value={mission.duration} disabled={!editable} onChange={event => patchMission({ duration: Math.round(num(event.target.value, 60) / 15) * 15 })} /></label>
                  <label className="field"><span>判定属性</span><select id="workshop-mission-requirement" value={mission.requirement} disabled={!editable} onChange={event => patchMission({ requirement: event.target.value as StatKey })}>{STAT_KEYS.map(value => <option key={value} value={value}>{STAT_LABELS[value]}</option>)}</select></label>
                  <label className="field"><span>目标值</span><input id="workshop-mission-target" type="number" min="30" max="120" value={mission.target} disabled={!editable} onChange={event => patchMission({ target: num(event.target.value, 60) })} /></label>
                  <label className="field"><span>轮数</span><input id="workshop-mission-rounds" type="number" min="2" max="8" value={mission.rounds} disabled={!editable} onChange={event => patchMission({ rounds: num(event.target.value, 3) })} /></label>
                  <label className="field"><span>推荐等级</span><input id="workshop-mission-level" type="number" min="1" max="12" value={mission.recommendedLevel} disabled={!editable} onChange={event => patchMission({ recommendedLevel: num(event.target.value, 3) })} /></label>
                  <label className="field"><span>报酬（星砂）</span><input id="workshop-mission-reward" type="number" min="0" value={mission.reward} disabled={!editable} onChange={event => patchMission({ reward: Math.max(0, num(event.target.value)) })} /></label>
                  <label className="field"><span>辖区</span><select id="workshop-mission-district" value={mission.district ?? ''} disabled={!editable} onChange={event => patchMission({ district: (event.target.value || undefined) as MissionTemplate['district'] })}><option value="">自动轮转</option>{Object.values(districts).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                  <label className="field"><span>接取窗口</span><select id="workshop-mission-window" value={mission.window ?? ''} disabled={!editable} onChange={event => patchMission({ window: (event.target.value || undefined) as MissionTemplate['window'] })}><option value="">按时段</option><option value="urgent">紧急</option><option value="long">长期</option></select></label>
                  <label className="field"><span>颜色</span><input id="workshop-mission-color" type="color" value={mission.color} disabled={!editable} onChange={event => patchMission({ color: event.target.value })} /></label>
                </div>
                <label className="field"><span>说明</span><textarea id="workshop-mission-description" rows={3} value={mission.description} disabled={!editable} onChange={event => patchMission({ description: event.target.value })} /></label>
                <section className="workshop-section">
                  <header><h4>敌人（战斗委托 1–3 只）</h4><small>{enemySlots.filter(Boolean).length}/3</small></header>
                  {mission.work === 'combat' && mission.enemyIds.length === 0 && <p className="workshop-muted">战斗委托至少需要一只魔物；保存时会自动补一只。</p>}
                  <div className="workshop-picker">
                    {enemySlots.map((value, index) => (
                      <FilterPickerRow
                        key={`${mission.id}-enemy-${index}`}
                        idPrefix="workshop-mission-enemy"
                        index={index}
                        options={allMonsters.map(entry => ({ value: entry.id, label: entry.name, note: `${entry.rank} · ${entry.element}` }))}
                        value={value}
                        disabled={!editable || mission.work !== 'combat'}
                        placeholder="选择魔物"
                        taken={new Set(enemySlots.filter((entry, at) => Boolean(entry) && at !== index))}
                        onChange={next => setEnemyAt(index, next)}
                        onRemove={enemySlots.length > 1 ? () => removeEnemySlot(index) : undefined}
                      />
                    ))}
                    <button id="workshop-add-mission-enemy" type="button" className="ghost-btn workshop-picker-add" disabled={!editable || mission.work !== 'combat' || enemySlots.length >= 3} onClick={addEnemySlot}><Plus size={13} /> 添加敌人</button>
                  </div>
                </section>
                <p className="workshop-muted">保存后进入夜间委托轮转池；也可以点右上「投放测试」立刻在当前夜晚生成一份。</p>
              </div>
            )}

            {current && tab === 'form' && kind === 'incident' && incident && (
              <div className="workshop-form">
                <div className="workshop-grid">
                  <label className="field"><span>标题</span><input id="workshop-incident-title" value={incident.title} disabled={!editable} onChange={event => patchIncident({ title: event.target.value })} /></label>
                  <label className="field"><span>类型</span><select id="workshop-incident-kind" value={incident.kind} disabled={!editable} onChange={event => patchIncident({ kind: event.target.value as IncidentCard['kind'] })}>{INCIDENT_KINDS.map(value => <option key={value} value={value}>{INCIDENT_KIND_LABELS[value]}</option>)}</select></label>
                  <label className="field"><span>触发方式</span><select id="workshop-incident-trigger" value={incident.trigger} disabled={!editable} onChange={event => patchIncident({ trigger: event.target.value as IncidentCard['trigger'] })}>{INCIDENT_TRIGGERS.map(value => <option key={value} value={value}>{INCIDENT_TRIGGER_LABELS[value]}</option>)}</select></label>
                  <label className="field"><span>权重</span><input id="workshop-incident-weight" type="number" min="1" max="20" value={incident.weight} disabled={!editable} onChange={event => patchIncident({ weight: Math.min(20, Math.max(1, num(event.target.value, 5))) })} /></label>
                  <label className="field"><span>势力</span><select id="workshop-incident-faction" value={incident.faction ?? ''} disabled={!editable} onChange={event => patchIncident({ faction: (event.target.value || undefined) as IncidentCard['faction'] })}><option value="">不绑定</option>{Object.entries(factionInfo).map(([value, info]) => <option key={value} value={value}>{info.name}</option>)}</select></label>
                  <label className="field"><span>辖区</span><select id="workshop-incident-district" value={incident.district ?? ''} disabled={!editable} onChange={event => patchIncident({ district: (event.target.value || undefined) as IncidentCard['district'] })}><option value="">不绑定</option>{Object.values(districts).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                  <label className="field"><span>契约者</span><select id="workshop-incident-girl" value={incident.girlId ?? ''} disabled={!editable} onChange={event => patchIncident({ girlId: event.target.value || undefined })}><option value="">不绑定</option>{state.girls.map(girl => <option key={girl.id} value={girl.id}>{girl.name}</option>)}</select></label>
                  <label className="workshop-check"><input id="workshop-incident-once" type="checkbox" checked={incident.oncePerDay} disabled={!editable} onChange={event => patchIncident({ oncePerDay: event.target.checked })} />每日最多一次</label>
                </div>
                <label className="field"><span>正文</span><textarea id="workshop-incident-body" rows={4} value={incident.body} disabled={!editable} onChange={event => patchIncident({ body: event.target.value })} /></label>
                <section className="workshop-section">
                  <header><h4>选项（2–3 个）</h4><button id="workshop-add-option" className="ghost-btn" disabled={!editable || incident.options.length >= 3} onClick={addIncidentOption}><Plus size={12} /> 添加选项</button></header>
                  {incident.options.map((option, index) => (
                    <div className="workshop-incident-option" key={index}>
                      <div className="workshop-row">
                        <input id={`workshop-incident-option-label-${index}`} value={option.label} disabled={!editable} onChange={event => patchIncidentOption(index, { label: event.target.value })} aria-label="选项文字" />
                        <input id={`workshop-incident-option-hint-${index}`} value={option.hint} disabled={!editable} onChange={event => patchIncidentOption(index, { hint: event.target.value })} aria-label="选项提示" />
                        <button id={`workshop-incident-option-remove-${index}`} className="icon-btn" disabled={!editable || incident.options.length <= 2} onClick={() => removeIncidentOption(index)} aria-label="删除选项"><Trash2 size={12} /></button>
                      </div>
                      <div className="workshop-stats">
                        <label className="field"><span>星砂</span><input id={`workshop-incident-gold-${index}`} type="number" value={option.effect.gold ?? 0} disabled={!editable} onChange={event => patchIncidentEffect(index, { gold: num(event.target.value) })} /></label>
                        <label className="field"><span>声望</span><input id={`workshop-incident-reputation-${index}`} type="number" value={option.effect.reputation ?? 0} disabled={!editable} onChange={event => patchIncidentEffect(index, { reputation: num(event.target.value) })} /></label>
                        <label className="field"><span>势力好感</span><select id={`workshop-incident-effect-faction-${index}`} value={option.effect.faction?.id ?? ''} disabled={!editable} onChange={event => patchIncidentEffect(index, { faction: event.target.value ? { id: event.target.value as NonNullable<IncidentCardEffect['faction']>['id'], standing: option.effect.faction?.standing ?? 0 } : undefined })}><option value="">无</option>{Object.entries(factionInfo).map(([value, info]) => <option key={value} value={value}>{info.name}</option>)}</select></label>
                        <label className="field"><span>势力数值</span><input id={`workshop-incident-standing-${index}`} type="number" value={option.effect.faction?.standing ?? 0} disabled={!editable} onChange={event => patchIncidentEffect(index, { faction: option.effect.faction ? { ...option.effect.faction, standing: num(event.target.value) } : undefined })} /></label>
                        <label className="field"><span>疲劳</span><input id={`workshop-incident-fatigue-${index}`} type="number" value={option.effect.girl?.fatigue ?? 0} disabled={!editable} onChange={event => patchIncidentEffect(index, { girl: { ...option.effect.girl, fatigue: num(event.target.value) } })} /></label>
                        <label className="field"><span>共情</span><input id={`workshop-incident-spirit-${index}`} type="number" value={option.effect.girl?.spirit ?? 0} disabled={!editable} onChange={event => patchIncidentEffect(index, { girl: { ...option.effect.girl, spirit: num(event.target.value) } })} /></label>
                        <label className="field"><span>侵蚀</span><input id={`workshop-incident-corruption-${index}`} type="number" value={option.effect.girl?.corruption ?? 0} disabled={!editable} onChange={event => patchIncidentEffect(index, { girl: { ...option.effect.girl, corruption: num(event.target.value) } })} /></label>
                        <label className="field"><span>好感</span><input id={`workshop-incident-bond-${index}`} type="number" value={option.effect.girl?.bond ?? 0} disabled={!editable} onChange={event => patchIncidentEffect(index, { girl: { ...option.effect.girl, bond: num(event.target.value) } })} /></label>
                      </div>
                      <div className="workshop-stats">
                        <label className="field"><span>辖区影响</span><select id={`workshop-incident-district-effect-${index}`} value={option.effect.district?.id ?? ''} disabled={!editable} onChange={event => event.target.value ? setIncidentDistrict(index, { id: event.target.value as NonNullable<IncidentCardEffect['district']>['id'] }) : patchIncidentEffect(index, { district: undefined })}><option value="">无</option>{Object.values(districts).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                        <label className="field"><span>委托目标%</span><input id={`workshop-incident-target-${index}`} type="number" value={option.effect.district?.targetPct ?? 0} disabled={!editable} onChange={event => setIncidentDistrict(index, { targetPct: num(event.target.value) })} /></label>
                        <label className="field"><span>报酬%</span><input id={`workshop-incident-reward-${index}`} type="number" value={option.effect.district?.rewardPct ?? 0} disabled={!editable} onChange={event => setIncidentDistrict(index, { rewardPct: num(event.target.value) })} /></label>
                        <label className="field"><span>持续天数</span><input id={`workshop-incident-days-${index}`} type="number" min="1" max="7" value={option.effect.district?.days ?? 1} disabled={!editable} onChange={event => setIncidentDistrict(index, { days: Math.min(7, Math.max(1, num(event.target.value, 1))) })} /></label>
                        <label className="field"><span>辖区易主</span><select id={`workshop-incident-territory-${index}`} value={option.effect.territory?.id ?? ''} disabled={!editable} onChange={event => patchIncidentEffect(index, { territory: event.target.value ? { id: event.target.value as NonNullable<IncidentCardEffect['territory']>['id'], faction: option.effect.territory?.faction ?? 'witch' } : undefined })}><option value="">无</option>{Object.values(districts).map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                        <label className="field"><span>易主势力</span><select id={`workshop-incident-territory-faction-${index}`} value={option.effect.territory?.faction ?? ''} disabled={!editable || !option.effect.territory} onChange={event => patchIncidentEffect(index, { territory: option.effect.territory ? { ...option.effect.territory, faction: event.target.value as NonNullable<IncidentCardEffect['territory']>['faction'] } : undefined })}><option value="">无</option>{Object.entries(factionInfo).map(([value, info]) => <option key={value} value={value}>{info.name}</option>)}</select></label>
                      </div>
                    </div>
                  ))}
                </section>
                <p className="workshop-muted">投放后快照为当前存档的弹窗；随机池触发尚未接入调度器。</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}
