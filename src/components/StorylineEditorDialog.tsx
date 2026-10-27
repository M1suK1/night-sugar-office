import { useMemo, useState } from 'react';
import { Clapperboard, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import type { Girl, StoryBeat, StoryPlan } from '../types';
import { sanitizeStoryPlan, storyPlanIssues, storyPlanTemplate } from '../storyplan.ts';

type Props = {
  girl: Girl;
  onSave: (plan: StoryPlan) => void;
  onClose: () => void;
};

const DIFFICULTIES = ['简单', '常规', '棘手', '危险'] as const;

function blankBeat(index: number): StoryBeat {
  return {
    id: `plan-${index + 1}`,
    index,
    title: '',
    summary: '',
    scene: '',
    hook: '',
    choices: [
      { id: 'c1', label: '', intent: '', effect: { bond: 3 } },
      { id: 'c2', label: '', intent: '', effect: { bond: 1, corruption: 1 } },
    ],
    status: index === 0 ? 'open' : 'locked',
  };
}

export function StorylineEditorDialog({ girl, onSave, onClose }: Props) {
  const initial = useMemo(() => {
    const source = sanitizeStoryPlan(girl.storyPlan) ?? storyPlanTemplate(`${girl.name}的故事`);
    const beats = [...source.beats];
    while (beats.length < 4) beats.push(blankBeat(beats.length));
    return { ...source, beats: beats.slice(0, 4) };
  }, [girl.id, girl.name, girl.storyPlan]);
  const [plan, setPlan] = useState<StoryPlan>(initial);
  const [issues, setIssues] = useState<string[]>([]);
  const missionDraft = (beat: StoryBeat) => ({ title: '', goal: '', category: '故事委托', duration: 90, difficulty: '常规' as const, ...(beat.mission ?? {}) });

  const patch = (part: Partial<StoryPlan>) => setPlan(current => ({ ...current, ...part }));
  const patchBeat = (index: number, part: Partial<StoryBeat>) => setPlan(current => ({
    ...current,
    beats: current.beats.map((beat, at) => at === index ? { ...beat, ...part } : beat),
  }));

  const patchChoice = (index: number, choiceIndex: number, part: { label?: string; intent?: string; bond?: number; corruption?: number }) => {
    setPlan(current => ({
      ...current,
      beats: current.beats.map((beat, at) => {
        if (at !== index) return beat;
        const choices = beat.choices.map((choice, cIndex) => {
          if (cIndex !== choiceIndex) return choice;
          const next = { ...choice, ...(part.label !== undefined ? { label: part.label } : {}), ...(part.intent !== undefined ? { intent: part.intent } : {}) };
          if (part.bond !== undefined || part.corruption !== undefined) {
            next.effect = {
              ...(choice.effect ?? {}),
              ...(part.bond !== undefined ? { bond: part.bond } : {}),
              ...(part.corruption !== undefined ? { corruption: part.corruption } : {}),
            };
          }
          return next;
        });
        return { ...beat, choices };
      }),
    }));
  };

  const save = () => {
    const found = storyPlanIssues(plan);
    if (found.length) { setIssues(found); return; }
    onSave(plan);
  };

  return (
    <div className="story-plan-modal" role="dialog" aria-modal="true" aria-label="故事线手稿">
      <header className="story-plan-head">
        <div>
          <span className="story-plan-kicker"><Clapperboard size={13} /> 手稿 · 人工设计</span>
          <h2>{girl.name}的故事，由你落笔。</h2>
          <p>写好的剧本会跟着她的契约卡一起导出；开局时按手稿走，不调用叙事者。</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭"><X size={16} /></button>
      </header>

      <div className="story-plan-fields">
        <label>标题<input id="story-plan-title" className="av-input" value={plan.title} onChange={event => patch({ title: event.target.value })} maxLength={40} /></label>
        <label>基调<input id="story-plan-tone" className="av-input" value={plan.tone} onChange={event => patch({ tone: event.target.value })} placeholder="例如：克制的温柔" maxLength={40} /></label>
        <label className="wide">前提<textarea id="story-plan-premise" className="av-input" rows={2} value={plan.premise} onChange={event => patch({ premise: event.target.value })} placeholder="她为什么愿意讲这件事。" maxLength={400} /></label>
      </div>

      <div className="story-plan-beats">
        {plan.beats.map((beat, index) => (
          <section className="story-plan-beat" key={beat.id}>
            <header>
              <b>第 {index + 1} 幕</b>
              <input id={`story-plan-beat-title-${index}`} className="av-input" value={beat.title} onChange={event => patchBeat(index, { title: event.target.value })} placeholder="这一幕叫什么" maxLength={30} />
            </header>
            <label>摘要<input id={`story-plan-beat-summary-${index}`} className="av-input" value={beat.summary} onChange={event => patchBeat(index, { summary: event.target.value })} placeholder="一句话概括这一幕" maxLength={160} /></label>
            <label>场景<textarea id={`story-plan-beat-scene-${index}`} className="av-input" rows={3} value={beat.scene} onChange={event => patchBeat(index, { scene: event.target.value })} placeholder="发生在一个什么样的晚上。" maxLength={700} /></label>
            <label>钩子<input id={`story-plan-beat-hook-${index}`} className="av-input" value={beat.hook} onChange={event => patchBeat(index, { hook: event.target.value })} placeholder="玩家要处理的那件事" maxLength={160} /></label>
            <div className="story-plan-mission">
              <label>这一幕的委托<input id={`story-plan-mission-title-${index}`} className="av-input" value={beat.mission?.title ?? ''} onChange={event => patchBeat(index, { mission: { ...missionDraft(beat), title: event.target.value } })} placeholder="留空则只走剧情" maxLength={30} /></label>
              <label>目标<input id={`story-plan-mission-goal-${index}`} className="av-input" value={beat.mission?.goal ?? ''} onChange={event => patchBeat(index, { mission: { ...missionDraft(beat), goal: event.target.value } })} maxLength={160} /></label>
              <label>难度
                <select id={`story-plan-mission-difficulty-${index}`} className="av-input" value={beat.mission?.difficulty ?? '常规'} onChange={event => patchBeat(index, { mission: { ...missionDraft(beat), difficulty: event.target.value } })}>
                  {DIFFICULTIES.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
            <div className="story-plan-choices">
              {beat.choices.map((choice, choiceIndex) => (
                <div className="story-plan-choice" key={choice.id}>
                  <input id={`story-plan-choice-label-${index}-${choiceIndex}`} className="av-input" value={choice.label} onChange={event => patchChoice(index, choiceIndex, { label: event.target.value })} placeholder={`选项 ${choiceIndex + 1}`} maxLength={40} />
                  <input id={`story-plan-choice-intent-${index}-${choiceIndex}`} className="av-input" value={choice.intent ?? ''} onChange={event => patchChoice(index, choiceIndex, { intent: event.target.value })} placeholder="她为什么会这样选" maxLength={120} />
                  <input id={`story-plan-choice-bond-${index}-${choiceIndex}`} className="av-input num" type="number" value={choice.effect?.bond ?? 0} onChange={event => patchChoice(index, choiceIndex, { bond: Number(event.target.value) })} aria-label="羁绊" />
                  <input id={`story-plan-choice-corruption-${index}-${choiceIndex}`} className="av-input num" type="number" value={choice.effect?.corruption ?? 0} onChange={event => patchChoice(index, choiceIndex, { corruption: Number(event.target.value) })} aria-label="侵蚀" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {issues.length > 0 && <ul className="story-plan-issues">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}

      <footer className="story-plan-actions">
        <button type="button" className="btn ghost" id="story-plan-reset" onClick={() => { setPlan(storyPlanTemplate(`${girl.name}的故事`)); setIssues([]); }}><RotateCcw size={14} /> 清空重写</button>
        <button type="button" className="btn ghost" id="story-plan-add-beat" onClick={() => setPlan(current => ({ ...current, beats: [...current.beats, blankBeat(current.beats.length)] }))}><Plus size={14} /> 加一幕</button>
        {plan.beats.length > 1 && <button type="button" className="btn ghost" id="story-plan-remove-beat" onClick={() => setPlan(current => ({ ...current, beats: current.beats.slice(0, -1) }))}><Trash2 size={14} /> 删末幕</button>}
        <span className="spacer" />
        <button type="button" className="btn ghost" id="story-plan-cancel" onClick={onClose}>取消</button>
        <button type="button" className="btn primary" id="story-plan-save" onClick={save}><Save size={14} /> 保存到卡片</button>
      </footer>
    </div>
  );
}
