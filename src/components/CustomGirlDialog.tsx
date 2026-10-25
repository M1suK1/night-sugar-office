import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Sparkles, Trash2, Wand2 } from 'lucide-react';
import type { Archetype, Element, GirlDraft, StatKey } from '../types';
import type { GeneratedGirlProfile } from '../llm';
import { skills, tierLabels } from '../content/skills';
import { traits, traitPolarityLabel } from '../content/traits';
import { statLabels } from '../game';

const elements: Element[] = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物'];
const archetypes: Archetype[] = ['输出', '守护', '治愈', '控制', '侦查'];
const colors = ['#F49ABD', '#B98AD9', '#9CC9D2', '#F2C879', '#A8D8A0', '#E58C8C'];
const steps = ['身份', '能力', '技能', '特性', '立绘'] as const;

function cropToDataUrl(image: HTMLImageElement, zoom: number, x: number, y: number): string {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 960;
  const ctx = canvas.getContext('2d'); if (!ctx) return '';
  const ratio = 4 / 5;
  let sw = Math.min(image.naturalWidth, image.naturalHeight * ratio) / zoom;
  let sh = sw / ratio;
  const maxX = image.naturalWidth - sw, maxY = image.naturalHeight - sh;
  const sx = Math.max(0, Math.min(maxX, (image.naturalWidth - sw) / 2 + (x / 100) * (sw / 2)));
  const sy = Math.max(0, Math.min(maxY, (image.naturalHeight - sh) / 2 + (y / 100) * (sh / 2)));
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 768, 960);
  return canvas.toDataURL('image/webp', 0.9);
}

export function CustomGirlDialog({ onCreate, onGenerate }: { onCreate: (draft: GirlDraft) => void; onGenerate?: () => Promise<{ ok: boolean; message: string; profile?: GeneratedGirlProfile }> }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(''); const [codename, setCodename] = useState('未命名契约'); const [title, setTitle] = useState('新登记的魔法少女');
  const [element, setElement] = useState<Element>('星光系'); const [archetype, setArchetype] = useState<Archetype>('输出'); const [color, setColor] = useState(colors[0]);
  const [quote, setQuote] = useState('请多指教。我会努力记住这座城市的路。'); const [goal, setGoal] = useState('完成第一次独立委托，并得到同伴的认可。');
  const [stats, setStats] = useState<Record<StatKey, number>>({ magic: 45, insight: 45, agility: 45, empathy: 45 });
  const [skillIds, setSkillIds] = useState<string[]>([]); const [traitIds, setTraitIds] = useState<string[]>([]);
  const [appearance, setAppearance] = useState('短发，发梢有一缕不合规矩的挑染。'); const [personality, setPersonality] = useState('嘴硬心软，习惯把紧张藏进玩笑里。'); const [outfitDescription, setOutfitDescription] = useState('自己改短的制服外套，袖口缝着一颗星形扣子。');
  const [preview, setPreview] = useState(''); const [source, setSource] = useState<HTMLImageElement | null>(null); const [zoom, setZoom] = useState(1); const [x, setX] = useState(0); const [y, setY] = useState(0);
  const [message, setMessage] = useState('');
  const [drafting, setDrafting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const total = Object.values(stats).reduce((sum, value) => sum + value, 0);
  const remaining = 260 - total;

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

  const adjust = (key: StatKey, delta: number) => setStats(prev => ({ ...prev, [key]: Math.max(40, Math.min(96, prev[key] + delta)) }));
  const toggleSkill = (id: string) => setSkillIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length >= 3 ? prev : [...prev, id]);
  const toggleTrait = (id: string) => setTraitIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : prev.length >= 3 ? prev : [...prev, id]);
  const canCreate = name.trim().length > 0 && skillIds.length === 3 && traitIds.length === 3 && remaining === 0;
  const submit = () => {
    if (!canCreate) { setMessage('请填写名字、分配完 260 点、选定 3 个技能与 3 个特性。'); return; }
    onCreate({
      name: name.trim(), codename: codename.trim() || '未命名契约', title: title.trim() || '新登记的魔法少女', element, archetype, color, quote, goal,
      appearance, personality, outfitDescription, stats, skillIds, traits: traitIds,
      portrait: preview || undefined,
    });
  };

  const draftFromStory = async () => {
    if (!onGenerate) return;
    setDrafting(true); setMessage('');
    const result = await onGenerate();
    setDrafting(false);
    if (!result.ok || !result.profile) { setMessage(result.message); return; }
    const profile = result.profile;
    setName(profile.name); setCodename(profile.codename); setTitle(profile.title);
    setElement(profile.element); setArchetype(profile.archetype);
    setQuote(profile.quote); setGoal(profile.goal);
    setAppearance(profile.appearance); setPersonality(profile.personality); setOutfitDescription(profile.outfitDescription);
    const nextStats: Record<StatKey, number> = { magic: 60, insight: 60, agility: 60, empathy: 60 };
    nextStats[profile.focus] = 80;
    setStats(nextStats); setSkillIds(profile.skillIds); setTraitIds(profile.traitIds);
    setStep(0); setMessage('叙事者已起草身份、能力、技能与特性；请逐步检查后再登记。');
  };

  return <div className="standard-modal custom-girl">
    <div className="modal-eyebrow"><Wand2 size={14} />契约登记 / 自定义魔法少女</div>
    {onGenerate && <div className="custom-draft-bar"><div><b>让叙事者先写一版</b><p>只生成文案与选项，260 点仍由本地分配。生成后可以逐步改写。</p></div><button id="custom-draft" type="button" className="btn" disabled={drafting} onClick={draftFromStory}><Sparkles size={14} />{drafting ? '正在起草' : '自动填表'}</button></div>}
    <div className="custom-steps" role="tablist" aria-label="创建步骤">{steps.map((label, index) => <button key={label} id={`custom-step-${index}`} type="button" role="tab" aria-selected={step === index} className={step === index ? 'active' : ''} onClick={() => setStep(index)}><i>{index + 1}</i>{label}</button>)}</div>

    {step === 0 && <div className="custom-step-body">
      <h2>先写下她的名字。</h2><p className="muted">契约登记不收费，但每个名字都会留在事务所的账本上。</p>
      <div className="custom-grid"><label>名字<input id="custom-name" className="av-input" value={name} onChange={e => setName(e.target.value)} maxLength={12} placeholder="例如：夜见 灯" /></label><label>称号<input id="custom-codename" className="av-input" value={codename} onChange={e => setCodename(e.target.value)} maxLength={16} /></label></div>
      <label>一句话介绍<input id="custom-title" className="av-input" value={title} onChange={e => setTitle(e.target.value)} maxLength={30} /></label>
      <div className="custom-grid"><label>元素<select id="custom-element" className="av-select" value={element} onChange={e => setElement(e.target.value as Element)}>{elements.filter(e => e !== '魔物').map(e => <option key={e}>{e}</option>)}</select></label><label>职阶<select id="custom-archetype" className="av-select" value={archetype} onChange={e => setArchetype(e.target.value as Archetype)}>{archetypes.filter(a => a !== '魔物').map(a => <option key={a}>{a}</option>)}</select></label></div>
      <label>代表色<div className="custom-colors">{colors.map(c => <button key={c} type="button" id={`custom-color-${c.slice(1)}`} aria-label={`代表色 ${c}`} aria-pressed={color === c} style={{ background: c }} onClick={() => setColor(c)} />)}</div></label>
      <label>当前目标<input id="custom-goal" className="av-input" value={goal} onChange={e => setGoal(e.target.value)} maxLength={60} /></label>
      <label>登场台词<input id="custom-quote" className="av-input" value={quote} onChange={e => setQuote(e.target.value)} maxLength={80} /></label>
    </div>}

    {step === 1 && <div className="custom-step-body">
      <h2>把 260 点，分给她的可能性。</h2><p className="muted">单项 40–96。等级固定为 1，之后靠委托成长。</p>
      <div className="custom-points"><span>剩余点数</span><strong className={remaining < 0 ? 'warn' : ''}>{remaining}</strong><button id="custom-autofill" type="button" className="av-btn av-btn-small" onClick={() => setStats({ magic: 65, insight: 65, agility: 65, empathy: 65 })}>平均分配</button></div>
      <div className="custom-stat-list">{(Object.keys(statLabels) as StatKey[]).map(key => <div key={key} className="custom-stat-row"><span>{statLabels[key]}</span><input aria-label={`${statLabels[key]}数值`} type="range" min={40} max={96} value={stats[key]} onChange={e => setStats(prev => ({ ...prev, [key]: Number(e.target.value) }))} /><b>{stats[key]}</b><button type="button" className="av-btn av-btn-small" aria-label={`${statLabels[key]}减一`} onClick={() => adjust(key, -1)}>−</button><button type="button" className="av-btn av-btn-small" aria-label={`${statLabels[key]}加一`} onClick={() => adjust(key, 1)}>+</button></div>)}</div>
      <p className="small-note">推荐：突击偏魔力与敏捷，守护偏共情与生命，侦察偏洞察。数值会永久影响战斗、调查与匹配率。</p>
    </div>}

    {step === 2 && <div className="custom-step-body">
      <h2>留下三种施法方式。</h2><p className="muted">从技能池选择 3 个；建议一基础、一本职、一奥义。已选 {skillIds.length}/3。</p>
      <div className="custom-pick-list">{skills.filter(s => !['monster'].includes(s.school)).map(skill => <button key={skill.id} id={`custom-skill-${skill.id}`} type="button" className={`custom-pick ${skillIds.includes(skill.id) ? 'picked' : ''}`} aria-pressed={skillIds.includes(skill.id)} onClick={() => toggleSkill(skill.id)}><span className={`tier tier-${skill.tier}`}>{tierLabels[skill.tier]}</span><b>{skill.name}</b><small>{skill.power}% · {skill.targets} 体 · {skill.description}</small>{skillIds.includes(skill.id) && <Check size={14} />}</button>)}</div>
    </div>}

    {step === 3 && <div className="custom-step-body">
      <h2>脾气，也是战斗力。</h2><p className="muted">选择 3 个特性。它们只影响叙事倾向与少量判定，不会直接改数值。已选 {traitIds.length}/3。</p>
      <div className="custom-pick-list">{traits.map(trait => <button key={trait.id} id={`custom-trait-${trait.id}`} type="button" className={`custom-pick ${traitIds.includes(trait.id) ? 'picked' : ''}`} aria-pressed={traitIds.includes(trait.id)} onClick={() => toggleTrait(trait.id)}><span className={`polarity ${trait.polarity}`}>{traitPolarityLabel(trait.polarity)}</span><b>{trait.name}</b><small>{trait.tags.join(' · ')} — {trait.description}</small>{traitIds.includes(trait.id) && <Check size={14} />}</button>)}</div>
    </div>}

    {step === 4 && <div className="custom-step-body">
      <h2>最后，让她有一个能被认出的轮廓。</h2><p className="muted">当前阶段使用剪影验证功能。可以导入 PNG 立绘，按 4:5 实时裁剪；不导入则使用代表色剪影。</p>
      <div className="custom-portrait-layout">
        <div><div className="custom-crop-preview"><canvas ref={canvas => { if (canvas && preview) { const ctx = canvas.getContext('2d'); const img = new Image(); img.onload = () => ctx?.drawImage(img, 0, 0, canvas.width, canvas.height); img.src = preview; } }} width={240} height={300} /><span>{preview ? '导入立绘' : '代表色剪影'}</span></div>{preview && <button id="custom-portrait-remove" type="button" className="av-btn av-btn-small" onClick={() => { setSource(null); setPreview(''); }}><Trash2 size={12} />移除导入</button>}</div>
        <div className="custom-portrait-fields">
          <input ref={fileRef} id="custom-portrait-file" type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => pickFile(e.target.files?.[0])} />
          <button type="button" className="av-btn" onClick={() => fileRef.current?.click()}><ImagePlus size={14} />导入 PNG / JPEG</button>
          {source && <><label>缩放<input aria-label="立绘缩放" type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} /></label><label>水平<input aria-label="立绘水平位置" type="range" min={-50} max={50} value={x} onChange={e => setX(Number(e.target.value))} /></label><label>垂直<input aria-label="立绘垂直位置" type="range" min={-50} max={50} value={y} onChange={e => setY(Number(e.target.value))} /></label></>}
          <label>外貌描述<textarea className="av-input" rows={2} value={appearance} onChange={e => setAppearance(e.target.value)} maxLength={80} /></label>
          <label>性格描述<textarea className="av-input" rows={2} value={personality} onChange={e => setPersonality(e.target.value)} maxLength={80} /></label>
          <label>服装描述<textarea className="av-input" rows={2} value={outfitDescription} onChange={e => setOutfitDescription(e.target.value)} maxLength={80} /></label>
        </div>
      </div>
    </div>}

    {message && <p className="inline-warning" role="alert">{message}</p>}
    <div className="custom-footer">
      <button type="button" className="btn" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}><ArrowLeft size={14} />上一步</button>
      <span>第 {step + 1} / {steps.length} 步</span>
      {step < steps.length - 1 ? <button id="custom-next" type="button" className="btn primary" onClick={() => { if (step === 0 && !name.trim()) { setMessage('先给她一个名字。'); return; } setMessage(''); setStep(s => s + 1); }}>下一步<ArrowRight size={14} /></button> : <button id="custom-create" type="button" className="btn primary" disabled={!canCreate} onClick={submit}><Sparkles size={14} />登记并加入名册</button>}
    </div>
  </div>;
}
