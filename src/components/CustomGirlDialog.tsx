import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, RefreshCw, Scissors, Shirt, Sparkles, Trash2, Upload, Wand2, X } from 'lucide-react';
import type { Archetype, DraftTrait, Element, GirlDraft, StatKey, TraitPolarity } from '../types';
import type { GeneratedGirlProfile } from '../llm';
import { STAT_MAX, STAT_MIN, rollStats, statsForArchetype, type PlayableArchetype } from '../content/archetypes';
import { tierLabels } from '../content/skills';
import { defaultSkillAccuracy } from '../combat';
import { filterSkills, girlSkillPool } from '../skills';
import { traits, traitPolarityLabel } from '../content/traits';
import { statLabels } from '../game';
import { factionTagFor, factionTagLabel, girlFactionColors, girlFactionLabels } from '../factions';
import type { GirlFaction } from '../types';
import { loadImage, removeImageBackground } from '../image';
import { readWardrobePackage, type WardrobePackage } from '../wardrobeImport';
import { fileDropProps } from '../drop';
import { CutoutPreview } from './CutoutPreview';

type FieldKey = 'name' | 'codename' | 'title' | 'element' | 'archetype' | 'goal' | 'quote' | 'appearance' | 'personality' | 'outfitDescription';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const elements: Element[] = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物'];
const archetypes: Archetype[] = ['输出', '守护', '治愈', '控制', '侦查'];
const colors = ['#F49ABD', '#B98AD9', '#9CC9D2', '#F2C879', '#A8D8A0', '#E58C8C'];
const steps = ['身份', '能力', '技能', '特性', '立绘'] as const;
/** 公共池里的流派标签，用来做筛选下拉。 */
const skillSchools = [...new Set(girlSkillPool().map(skill => skill.school))].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

function cropToDataUrl(image: HTMLImageElement, zoom: number, x: number, y: number): string {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 960;
  const ctx = canvas.getContext('2d'); if (!ctx) return '';
  const ratio = 4 / 5;
  let sw = Math.min(image.naturalWidth, image.naturalHeight * ratio) / zoom;
  let sh = sw / ratio;
  const maxX = image.naturalWidth - sw, maxY = image.naturalHeight - sh;
  const sx = Math.max(0, Math.min(maxX, (image.naturalWidth - sw) / 2 + (x / 100) * (sw / 2)));
  // 与 GirlPortrait 同向：+y 表示露出更多上方、人像整体往下；再加 +12 的全局取景偏移。
  const biasY = Math.max(-100, Math.min(100, y + 12));
  const sy = Math.max(0, Math.min(maxY, (image.naturalHeight - sh) / 2 - (biasY / 100) * (sh / 2)));
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 768, 960);
  return canvas.toDataURL('image/webp', 0.78);
}

const EMPTY_TRAIT = (): DraftTrait => ({ name: '', description: '', polarity: 'neutral' });
const emptyDraftTraits = () => [EMPTY_TRAIT(), EMPTY_TRAIT(), EMPTY_TRAIT()];

export function CustomGirlDialog({ onCreate, onGenerate }: { onCreate: (draft: GirlDraft) => void; onGenerate?: (portrait?: string, hint?: string) => Promise<{ ok: boolean; message: string; profile?: GeneratedGirlProfile }> }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(''); const [codename, setCodename] = useState('未命名契约'); const [title, setTitle] = useState('新登记的魔法少女');
  const [element, setElement] = useState<Element>('星光系'); const [archetype, setArchetype] = useState<Archetype>('输出'); const [color, setColor] = useState(colors[0]);
  const [quote, setQuote] = useState('请多指教。我会努力记住这座城市的路。'); const [goal, setGoal] = useState('完成第一次独立委托，并得到同伴的认可。');
  const [stats, setStats] = useState<Record<StatKey, number>>({ magic: 65, insight: 65, agility: 65, empathy: 65 });
  /** 出身默认按名字推导；玩家一旦手动点过，就固定成他选的那个。 */
  const [manualTag, setManualTag] = useState<GirlFaction | null>(null);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  /** 技能池筛选：流派 + 阶级，只影响列表，不影响已选。 */
  const [skillSchool, setSkillSchool] = useState('全部');
  const [skillTier, setSkillTier] = useState<'all' | 'basic' | 'signature' | 'ultimate'>('all');
  const [draftTraits, setDraftTraits] = useState<DraftTrait[]>(() => emptyDraftTraits());  const [appearance, setAppearance] = useState('短发，发梢有一缕不合规矩的挑染。'); const [personality, setPersonality] = useState('嘴硬心软，习惯把紧张藏进玩笑里。'); const [outfitDescription, setOutfitDescription] = useState('自己改短的制服外套，袖口缝着一颗星形扣子。');
  const [preview, setPreview] = useState(''); const [source, setSource] = useState<HTMLImageElement | null>(null); const [zoom, setZoom] = useState(1); const [x, setX] = useState(0); const [y, setY] = useState(0);
  const [message, setMessage] = useState('');
  const [hint, setHint] = useState('');
  const [cutting, setCutting] = useState(false);
  const [tolerance, setTolerance] = useState(36);
  const [cutNote, setCutNote] = useState('');
  const [cut, setCut] = useState<{ before: string; after: string; removed: number } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [entry, setEntry] = useState<'gate' | 'wizard'>('gate');
  const [overPortrait, setOverPortrait] = useState(false);
  const [filled, setFilled] = useState<Set<FieldKey>>(new Set());
  const [pending, setPending] = useState<Set<FieldKey>>(new Set());
  const [hasDraft, setHasDraft] = useState(false);
  const [wardrobe, setWardrobe] = useState<WardrobePackage | null>(null);
  const [wardrobeNote, setWardrobeNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const wardrobeRef = useRef<HTMLInputElement>(null);
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);
  const remaining = 260 - total;
  const pickerSkills = filterSkills({ school: skillSchool, tier: skillTier });

  useEffect(() => {
    if (!source) return;
    setPreview(cropToDataUrl(source, zoom, x, y));
  }, [source, zoom, x, y]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage('只支持 PNG、JPEG 或 WebP。'); return; }
    if (file.size > 12 * 1024 * 1024) { setMessage('图片超过 12MB，请先压缩。'); return; }
    const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth < 320 || image.naturalHeight < 400) { setMessage('图片至少需要 320×400；尺寸不足会明显模糊。'); return; }
      setSource(image); setZoom(1); setX(0); setY(0); setMessage('');
    };
    image.src = url;
  };

  const pickWardrobe = async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setWardrobeNote('衣柜包需要是 JSON 文件，例如 wardrobe.json。');
      return;
    }
    if (file.size > 12 * 1024 * 1024) { setWardrobeNote('衣柜包超过 12MB，请先压缩图片。'); return; }
    try {
      const parsed = readWardrobePackage(JSON.parse(await file.text()), color);
      if (!parsed.ok) { setWardrobeNote(parsed.message); return; }
      setWardrobe(parsed);
      if (parsed.portrait && !preview) setPreview(parsed.portrait);
      const variantCount = Object.keys(parsed.importedVariants).length;
      setWardrobeNote(`已读取 ${parsed.outfits.length} 套服装${parsed.witchForm ? '、魔女化立绘' : ''}和 ${variantCount} 张表情差分。`);
      setMessage('');
    } catch {
      setWardrobeNote('衣柜包不是有效的 JSON，请检查文件。');
    }
  };

  const adjust = (key: StatKey, delta: number) => setStats(prev => ({ ...prev, [key]: Math.max(STAT_MIN, Math.min(STAT_MAX, prev[key] + delta)) }));
  const chooseArchetype = (next: PlayableArchetype) => { setArchetype(next); setStats(statsForArchetype(next)); };
  const toggleSkill = (id: string) => setSkillIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length >= 3 ? prev : [...prev, id]);
  const fillTrait = (trait: { name: string; description: string; polarity: TraitPolarity }) => setDraftTraits(prev => {
    const copy = [...prev];
    const blank = copy.findIndex(item => !item.name.trim());
    if (blank < 0) return copy;
    copy[blank] = { name: trait.name, description: trait.description, polarity: trait.polarity };
    return copy;
  });
  const updateTrait = (index: number, patch: Partial<DraftTrait>) => setDraftTraits(prev => prev.map((item, at) => at === index ? { ...item, ...patch } : item));
  const statInvalid = Object.values(stats).some(value => value < STAT_MIN || value > STAT_MAX);
  const filledTraits = draftTraits.filter(item => item.name.trim());
  /** 没手动选过就按名字推导：同名总得到同一出身，重开游戏也不会变。 */
  const tagOf = (value: string) => manualTag ?? factionTagFor(value.trim() || '未命名契约');
  const currentTag = tagOf(name);
  const canCreate = name.trim().length > 0 && skillIds.length === 3 && filledTraits.length === 3 && remaining === 0 && !statInvalid;
  const createHint = [
    !name.trim() && '缺少名字',
    remaining > 0 && `还剩 ${remaining} 点`,
    remaining < 0 && `超出 ${-remaining} 点`,
    statInvalid && `单项需在 ${STAT_MIN}–${STAT_MAX}`,
    skillIds.length !== 3 && `技能 ${skillIds.length}/3`,
    filledTraits.length !== 3 && `特性 ${filledTraits.length}/3`,
  ].filter(Boolean).join(' · ');
  const submit = () => {
    if (!name.trim()) { setStep(0); setMessage('先给她一个名字，再登记。'); return; }
    if (statInvalid) { setStep(1); setMessage(`四维每项需在 ${STAT_MIN}–${STAT_MAX}。`); return; }
    if (remaining !== 0) { setStep(1); setMessage(remaining > 0 ? `还有 ${remaining} 点没有分配。` : `属性点超出 ${-remaining} 点，请调低。`); return; }
    if (skillIds.length !== 3) { setStep(2); setMessage(`请选择 3 个技能，现在还差 ${3 - skillIds.length} 个。`); return; }
    if (filledTraits.length !== 3) { setStep(3); setMessage(`请写满 3 条特性，现在还差 ${3 - filledTraits.length} 条。`); return; }
    onCreate({
      name: name.trim(), codename: codename.trim() || '未命名契约', title: title.trim() || '新登记的魔法少女', element, archetype, color, quote, goal,
      appearance, personality, outfitDescription, stats, skillIds, traits: filledTraits.map(item => ({ name: item.name.trim(), description: item.description.trim(), polarity: item.polarity })),
      // 存原图，取景另存：不再把立绘压成 768×960 的 WebP。
      portrait: source?.src || preview || wardrobe?.portrait || undefined,
      portraitCrop: source ? { zoom, x, y } : undefined,
      factionTag: tagOf(name),
      wardrobe: wardrobe?.outfits,
      outfitId: wardrobe?.outfitId,
      importedVariants: wardrobe?.importedVariants,
      witchForm: wardrobe?.witchForm,
    });
  };

  const applyField = (key: FieldKey, profile: GeneratedGirlProfile) => {
    if (key === 'name') setName(profile.name);
    else if (key === 'codename') setCodename(profile.codename);
    else if (key === 'title') setTitle(profile.title);
    else if (key === 'element') setElement(profile.element);
    else if (key === 'archetype') { const next = profile.archetype === '魔物' ? '输出' : profile.archetype; setArchetype(next); setStats(statsForArchetype(next)); }
    else if (key === 'goal') setGoal(profile.goal);
    else if (key === 'quote') setQuote(profile.quote);
    else if (key === 'appearance') setAppearance(profile.appearance);
    else if (key === 'personality') setPersonality(profile.personality);
    else setOutfitDescription(profile.outfitDescription);
  };
  const allFields: FieldKey[] = ['name', 'codename', 'title', 'element', 'archetype', 'goal', 'quote', 'appearance', 'personality', 'outfitDescription'];

  const runGenerate = async (targets: FieldKey[] | 'all') => {
    if (!onGenerate || drafting) return;
    const keys = targets === 'all' ? allFields : targets;
    setDrafting(true); setMessage('');
    setPending(new Set(keys));
    if (targets === 'all') setFilled(new Set());
    const result = await onGenerate(preview || undefined, hint.trim() || undefined);
    if (!result.ok || !result.profile) {
      setDrafting(false); setPending(new Set()); setMessage(result.message); return;
    }
    const profile = result.profile;
    if (targets === 'all') {
      for (const key of keys) {
        applyField(key, profile);
        setFilled(prev => new Set(prev).add(key));
        setPending(prev => { const next = new Set(prev); next.delete(key); return next; });
        await sleep(130);
      }
      setSkillIds(profile.skillIds); setDraftTraits(profile.traits);
      setStats(statsForArchetype(profile.archetype === '魔物' ? '输出' : profile.archetype));
      if (profile.color) setColor(profile.color);
      setStep(0); setHasDraft(true); setDrafting(false);
      setMessage('使魔读取了立绘，补全了身份、描述，并按职阶分配了 260 点能力值。请逐项检查，仍可手动微调。');
    } else {
      for (const key of keys) {
        applyField(key, profile);
        setFilled(prev => new Set(prev).add(key));
        setPending(prev => { const next = new Set(prev); next.delete(key); return next; });
      }
      setHasDraft(true); setDrafting(false);
      setMessage('这一项已重写。你仍然可以手动修改。');
    }
  };

  const cutBackground = async () => {
    if (!preview || cutting) return;
    setCutting(true); setCutNote('');
    try {
      const result = await removeImageBackground(await loadImage(preview), { tolerance });
      setCut({ before: preview, after: result.dataUrl, removed: result.removedRatio });
    } catch {
      setCutNote('去背景失败，已保留原图。');
    } finally { setCutting(false); }
  };
  const applyCut = () => {
    if (!cut) return;
    setPreview(cut.after); setSource(null); setCut(null);
    setCutNote('已应用去背景版本。');
  };
  const discardCut = () => { setCut(null); setCutNote('已保留原图。'); };
  const changeTolerance = (value: number) => {
    setTolerance(value);
    if (cut) { setCut(null); setCutNote('容差已改变，点「去背景」重新计算。'); }
  };
  const editText = (key: FieldKey, setter: (value: string) => void, value: string) => {
    setter(value);
    setFilled(prev => { const next = new Set(prev); next.delete(key); return next; });
  };

  const fieldOrigin = (key: FieldKey) => filled.has(key)
    ? <span className="field-origin">由使魔补全</span>
    : pending.has(key) ? <span className="field-origin pending">补全中</span> : null;
  const fieldRewrite = (key: FieldKey) => hasDraft
    ? <button key="rewrite" id={`custom-rewrite-${key}`} type="button" className="field-rewrite" disabled={drafting} onClick={() => runGenerate([key])} title="让使魔重写这一项">重写</button>
    : null;
  const fieldHead = (label: string, key: FieldKey) => <span className="field-head"><span>{label}</span>{fieldOrigin(key)}{fieldRewrite(key)}</span>;
  const shimmer = (key: FieldKey) => pending.has(key) ? ' is-shimmer' : '';

  return <div className="standard-modal custom-girl">
    <div className="modal-eyebrow"><Wand2 size={14} />契约登记 / 自定义魔法少女</div>
    <input ref={fileRef} id="custom-portrait-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => pickFile(e.target.files?.[0])} />
    {entry === 'gate' ? <div className="custom-gate">
      <h2>先留下一个轮廓。</h2>
      <p>可以只导入一张立绘，让使魔根据她知道的名字与气质补全档案；也可以从空白开始，全部自己写。</p>
      <div className="custom-gate-grid">
        <button id="custom-entry-import" type="button" className={`custom-gate-card ${overPortrait ? 'is-drop-over' : ''}`} onClick={() => fileRef.current?.click()} {...fileDropProps(setOverPortrait, files => { if (files[0]) void pickFile(files[0]); })}><ImagePlus size={22} /><b>只导入立绘</b><small>PNG / JPEG / WebP，4:5 实时裁剪；也可以直接拖进来。</small></button>
        <button id="custom-entry-blank" type="button" className="custom-gate-card" onClick={() => setEntry('wizard')}><Wand2 size={22} /><b>从空白开始</b><small>直接进入五步向导，260 点由你分配。</small></button>
      </div>
      {preview && <div className="custom-gate-draft"><img src={preview} alt="已导入的立绘预览" /><div><b>立绘已经就位</b><p>让使魔读取立绘，补全身份、目标、台词与外观；属性和职阶会一起给出，仍可逐项修改。</p><label className="custom-gate-hint">给叙事者的一句话要求（可选）<input id="custom-portrait-hint" className="av-input" maxLength={80} placeholder="例：银白发，披风边缘像融化的糖，笑得很轻" value={hint} onChange={e => setHint(e.target.value)} /></label><div className="custom-gate-actions"><button id="custom-gate-cutout" type="button" className="btn" disabled={cutting} onClick={() => void cutBackground()}><Scissors size={14} />{cutting ? '正在去背景' : '去背景'}</button><button id="custom-draft" type="button" className="btn primary" disabled={drafting || Boolean(cut)} onClick={() => { setEntry('wizard'); runGenerate('all'); }}><Sparkles size={14} />{drafting ? '正在补全' : '让使魔补全'}</button><button id="custom-gate-manual" type="button" className="btn" onClick={() => setEntry('wizard')}>继续手动填写</button></div></div></div>}
      {cut && <CutoutPreview before={cut.before} after={cut.after} removed={cut.removed} tolerance={tolerance} busy={cutting} onApply={applyCut} onDiscard={discardCut} onRetry={() => void cutBackground()} />}
      {cutNote && <p className="custom-cut-note">{cutNote}</p>}
      {message && <p className="inline-warning" role="alert">{message}</p>}
    </div> : <>
    <div className="custom-steps" role="tablist" aria-label="创建步骤">{steps.map((label, index) => <button key={label} id={`custom-step-${index}`} type="button" role="tab" aria-selected={step === index} className={step === index ? 'active' : ''} onClick={() => setStep(index)}><i>{index + 1}</i>{label}</button>)}</div>

    {step === 0 && <div className="custom-step-body">
      <h2>先写下她的名字。</h2><p className="muted">契约登记不收费，但每个名字都会留在事务所的账本上。</p>
      <div className="custom-grid"><label>{fieldHead('名字', 'name')}<input id="custom-name" className={`av-input${shimmer('name')}`} value={name} onChange={e => editText('name', setName, e.target.value)} maxLength={12} placeholder="例如：夜见 灯" /></label><label>{fieldHead('称号', 'codename')}<input id="custom-codename" className={`av-input${shimmer('codename')}`} value={codename} onChange={e => editText('codename', setCodename, e.target.value)} maxLength={16} /></label></div>
      <label>{fieldHead('一句话介绍', 'title')}<input id="custom-title" className={`av-input${shimmer('title')}`} value={title} onChange={e => editText('title', setTitle, e.target.value)} maxLength={30} /></label>
      <div className="custom-grid"><label>{fieldHead('元素', 'element')}<select id="custom-element" className={`av-select${shimmer('element')}`} value={element} onChange={e => { setElement(e.target.value as Element); editText('element', () => undefined, ''); }}>{elements.filter(e => e !== '魔物').map(e => <option key={e}>{e}</option>)}</select></label><label>{fieldHead('职阶', 'archetype')}<select id="custom-archetype" className={`av-select${shimmer('archetype')}`} value={archetype} onChange={e => { chooseArchetype(e.target.value as PlayableArchetype); editText('archetype', () => undefined, ''); }}>{archetypes.filter(a => a !== '魔物').map(a => <option key={a}>{a}</option>)}</select></label></div>
      <label>代表色<div className="custom-colors">{colors.map(c => <button key={c} type="button" id={`custom-color-${c.slice(1)}`} aria-label={`代表色 ${c}`} aria-pressed={color === c} style={{ background: c }} onClick={() => setColor(c)} />)}</div></label>
      <label>{fieldHead('当前目标', 'goal')}<input id="custom-goal" className={`av-input${shimmer('goal')}`} value={goal} onChange={e => editText('goal', setGoal, e.target.value)} maxLength={60} /></label>
      <label>{fieldHead('登场台词', 'quote')}<input id="custom-quote" className={`av-input${shimmer('quote')}`} value={quote} onChange={e => editText('quote', setQuote, e.target.value)} maxLength={80} /></label>
      <div className="custom-origin">
        <span className="field-head"><span>出身</span></span>
        <p className="small-note">她从哪里来。事务所对所有出身开放，这只影响街上的目光与委托里的说辞，不影响属性。</p>
        <div className="custom-origin-options" role="radiogroup" aria-label="出身">
          {(['association', 'government', 'witch', 'none'] as GirlFaction[]).map(tag => (
            <button key={tag} id={`custom-origin-${tag}`} type="button" role="radio" aria-checked={currentTag === tag}
              className={`custom-origin-option${currentTag === tag ? ' active' : ''}`}
              style={{ '--tag-color': girlFactionColors[tag] } as React.CSSProperties}
              onClick={() => setManualTag(tag)}>
              <i />{girlFactionLabels[tag]}
            </button>
          ))}
          <button id="custom-origin-auto" type="button" className="custom-origin-auto" disabled={!manualTag} onClick={() => setManualTag(null)}>按名字推导（{factionTagLabel(factionTagFor(name.trim() || '未命名契约'))}）</button>
        </div>
      </div>
    </div>}

    {step === 1 && <div className="custom-step-body">
      <h2>把 260 点，分给她的可能性。</h2><p className="muted">单项 {STAT_MIN}–{STAT_MAX}。等级固定为 1，之后靠委托成长。</p>
      <div className="custom-points"><span>剩余点数</span><strong className={remaining < 0 ? 'warn' : ''}>{remaining}</strong><button id="custom-randomize" type="button" className="av-btn av-btn-small" onClick={() => setStats(rollStats(archetype === '魔物' ? '输出' : archetype))}>随机分配</button><button id="custom-autofill" type="button" className="av-btn av-btn-small" onClick={() => setStats({ magic: 65, insight: 65, agility: 65, empathy: 65 })}>平均分配</button></div>
      <div className="custom-stat-list">{(Object.keys(statLabels) as StatKey[]).map(key => <div key={key} className="custom-stat-row"><span>{statLabels[key]}</span><input aria-label={`${statLabels[key]}数值`} type="range" min={STAT_MIN} max={STAT_MAX} value={stats[key]} onChange={e => setStats(prev => ({ ...prev, [key]: Number(e.target.value) }))} /><b>{stats[key]}</b><button type="button" className="av-btn av-btn-small" aria-label={`${statLabels[key]}减一`} onClick={() => adjust(key, -1)}>−</button><button type="button" className="av-btn av-btn-small" aria-label={`${statLabels[key]}加一`} onClick={() => adjust(key, 1)}>+</button></div>)}</div>
      <p className="small-note">选择职阶会自动分配 260 点：输出偏魔力与敏捷，守护偏共情，治愈偏共情与洞察，控制偏洞察与魔力，侦查偏洞察与敏捷。分配后仍可逐点微调。</p>
    </div>}

    {step === 2 && <div className="custom-step-body">
      <h2>留下三种施法方式。</h2><p className="muted">少女与魔物共用同一个技能池，按流派和阶级挑就行；建议一基础、一本职、一奥义。已选 {skillIds.length}/3。</p>
      <div className="custom-skill-filter">
        <label className="field"><span>流派</span><select id="custom-skill-school" value={skillSchool} onChange={event => setSkillSchool(event.target.value)}>{['全部', ...skillSchools].map(school => <option key={school} value={school}>{school}</option>)}</select></label>
        <label className="field"><span>阶级</span><select id="custom-skill-tier" value={skillTier} onChange={event => setSkillTier(event.target.value as 'all' | 'basic' | 'signature' | 'ultimate')}>{(['all', 'basic', 'signature', 'ultimate'] as const).map(tier => <option key={tier} value={tier}>{tier === 'all' ? '全部' : tierLabels[tier]}</option>)}</select></label>
        <span className="custom-skill-count">筛出 {pickerSkills.length} 条</span>
      </div>
      <div className="custom-pick-list">{pickerSkills.map(skill => <button key={skill.id} id={`custom-skill-${skill.id}`} type="button" className={`custom-pick ${skillIds.includes(skill.id) ? 'picked' : ''}`} aria-pressed={skillIds.includes(skill.id)} onClick={() => toggleSkill(skill.id)}><span className={`tier tier-${skill.tier}`}>{tierLabels[skill.tier]}</span><b>{skill.name}</b><small>{skill.school} · {skill.power}% · {skill.targets} 体 · 命中 {skill.accuracy ?? defaultSkillAccuracy(skill.targets)}% · {skill.description}</small>{skillIds.includes(skill.id) && <Check size={14} />}</button>)}</div>
    </div>}

    {step === 3 && <div className="custom-step-body">
      <h2>脾气，也是战斗力。</h2><p className="muted">手写 3 条特性：名称 + 一句解释。下面的事件库只用来填字，不会替你决定。已写 {filledTraits.length}/3。</p>
      <div className="custom-trait-rows">
        {draftTraits.map((trait, index) => (
          <div className="custom-trait-row" key={index}>
            <span className="custom-trait-index">{index + 1}</span>
            <input className="av-input" id={`custom-trait-name-${index}`} value={trait.name} maxLength={12} placeholder="特性名，例如「夜里不睡」" onChange={event => updateTrait(index, { name: event.target.value })} />
            <input className="av-input" id={`custom-trait-desc-${index}`} value={trait.description} maxLength={60} placeholder="一句话解释它在故事里的表现" onChange={event => updateTrait(index, { description: event.target.value })} />
            <select className="av-select" id={`custom-trait-polarity-${index}`} value={trait.polarity} onChange={event => updateTrait(index, { polarity: event.target.value as TraitPolarity })}>
              <option value="positive">正面</option>
              <option value="negative">负面</option>
              <option value="neutral">中性</option>
            </select>
          </div>
        ))}
      </div>
      <p className="muted custom-trait-hint">从事件库取一条填入空位：</p>
      <div className="custom-pick-list">{traits.slice(0, 9).map(trait => <button key={trait.id} id={`custom-trait-${trait.id}`} type="button" className="custom-pick" onClick={() => fillTrait(trait)}><span className={`polarity ${trait.polarity}`}>{traitPolarityLabel(trait.polarity)}</span><b>{trait.name}</b><small>{trait.description}</small></button>)}</div>
    </div>}

    {step === 4 && <div className="custom-step-body">
      <h2>最后，让她有一个能被认出的轮廓。</h2><p className="muted">当前阶段使用剪影验证功能。可以导入 PNG 立绘，按 4:5 实时裁剪，也可以把图片直接拖到左边的预览框；不导入则使用代表色剪影。</p>
      <div className="custom-portrait-layout">
        <div><div className={`custom-crop-preview ${overPortrait ? 'is-drop-over' : ''}`} {...fileDropProps(setOverPortrait, files => { if (files[0]) void pickFile(files[0]); })}><canvas ref={canvas => { if (canvas && preview) { const ctx = canvas.getContext('2d'); const img = new Image(); img.onload = () => ctx?.drawImage(img, 0, 0, canvas.width, canvas.height); img.src = preview; } }} width={240} height={300} /><span>{preview ? '导入立绘' : '代表色剪影'}</span></div>{preview && <button id="custom-portrait-remove" type="button" className="av-btn av-btn-small" onClick={() => { setSource(null); setPreview(''); }}><Trash2 size={12} />移除导入</button>}</div>
        <div className="custom-portrait-fields">
          <button type="button" className="av-btn" onClick={() => fileRef.current?.click()}><ImagePlus size={14} />导入 PNG / JPEG</button>
          {source && <><label>缩放<input aria-label="立绘缩放" type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><label>水平<input aria-label="立绘水平位置" type="range" min={-50} max={50} value={x} onChange={e => setX(Number(e.target.value))} /></label><label>垂直<input aria-label="立绘垂直位置" type="range" min={-50} max={50} value={y} onChange={e => setY(Number(e.target.value))} /></label></>}
          
          {preview && <div className="custom-cutout">
            <button id="custom-cutout" type="button" className="av-btn" disabled={cutting} onClick={() => void cutBackground()}>{cutting ? '正在去背景' : '简单去背景'}</button>
            <label>容差<input aria-label="去背景容差" type="range" min={12} max={90} value={tolerance} onChange={e => changeTolerance(Number(e.target.value))} /></label>
            {cutNote && <small className="muted">{cutNote}</small>}
          </div>}
          <label>{fieldHead('外貌描述', 'appearance')}<textarea className={`av-input${shimmer('appearance')}`} rows={3} value={appearance} onChange={e => editText('appearance', setAppearance, e.target.value)} maxLength={200} /></label>
          <label>{fieldHead('性格描述', 'personality')}<textarea className={`av-input${shimmer('personality')}`} rows={2} value={personality} onChange={e => editText('personality', setPersonality, e.target.value)} maxLength={80} /></label>
          <label>{fieldHead('服装描述', 'outfitDescription')}<textarea className={`av-input${shimmer('outfitDescription')}`} rows={2} value={outfitDescription} onChange={e => editText('outfitDescription', setOutfitDescription, e.target.value)} maxLength={80} /></label>
        </div>
      </div>
      <div className="custom-wardrobe-package">
        <div className="custom-wardrobe-head">
          <span><Shirt size={14} /><b>衣柜与表情</b></span>
          <small>可选：一次带入多套服装、各套表情差分和魔女化立绘</small>
        </div>
        <div className="custom-wardrobe-actions">
          <button id="custom-wardrobe-import" type="button" className="av-btn av-btn-small" onClick={() => wardrobeRef.current?.click()}><Upload size={12} />导入衣柜包 JSON</button>
          <input
            id="custom-wardrobe-file"
            ref={wardrobeRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void pickWardrobe(file); }}
          />
          {wardrobe && <button id="custom-wardrobe-clear" type="button" className="av-btn av-btn-small" onClick={() => { setWardrobe(null); setWardrobeNote(''); }}><X size={12} />移除衣柜包</button>}
        </div>
        {wardrobe && <div className="custom-wardrobe-summary">
          <b>{wardrobe.outfits.length} 套服装{wardrobe.witchForm ? ' · 含魔女化' : ''}</b>
          <span>{Object.keys(wardrobe.importedVariants).length} 张表情差分</span>
          <small>{wardrobe.outfits.map(item => item.name).join(' / ')}</small>
        </div>}
        {wardrobeNote && <p className="custom-wardrobe-note" role="status">{wardrobeNote}</p>}
        <p className="muted custom-wardrobe-hint">包内可含 <code>wardrobe</code>（或 <code>outfits</code>）、<code>outfitId</code>、<code>importedVariants</code>、<code>witchForm</code> 和 <code>portrait</code>；表情键写成 <code>服装ID:表情</code>。</p>
      </div>
      {cut && <CutoutPreview before={cut.before} after={cut.after} removed={cut.removed} tolerance={tolerance} busy={cutting} onApply={applyCut} onDiscard={discardCut} onRetry={() => void cutBackground()} />}
    </div>}

      {message && <p className="inline-warning" role="alert">{message}</p>}
    {hasDraft && <div className="custom-regenerate"><span>不满意这一版？只会重写文案与技能选项，保留立绘与你已经分配的属性点。</span><button id="custom-regenerate-all" type="button" className="av-btn av-btn-small" disabled={drafting} onClick={() => runGenerate('all')}><RefreshCw size={12} />重新生成全部</button></div>}
    <div className="custom-footer">
      <button id="custom-back" type="button" className="btn" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}><ArrowLeft size={14} />上一步</button>
      <span>第 {step + 1} / {steps.length} 步{!canCreate && <em className="custom-hint"> · {createHint}</em>}</span>
      {step < steps.length - 1 ? <button id="custom-next" type="button" className="btn primary" disabled={drafting} onClick={() => { if (step === 0 && !name.trim()) { setMessage('先给她一个名字。'); return; } setMessage(''); setStep(s => s + 1); }}>下一步<ArrowRight size={14} /></button> : <button id="custom-create" type="button" className="btn primary" disabled={drafting} onClick={submit}><Sparkles size={14} />登记并加入名册</button>}
    </div>
    </>}
  </div>;
}
