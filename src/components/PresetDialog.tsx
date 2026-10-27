import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Braces, Download, FileJson, FlaskConical, KeyRound, Plus, RotateCcw, Save, SlidersHorizontal, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';
import {
  DEFAULT_PRESET_BINDING, DEFAULT_PROMPTS, PROMPT_SCOPES, PROMPT_TASK_SCOPES, PROMPT_VARIABLES, applyRegexScripts, boundPreset, duplicatePreset, exportPresetJson, importPresetJson, newEntryId, presetPrompts,
  promptScope, promptScopeLabel, promptTokens, promptHasMechanicBan, stripMechanicBan, SAMPLING_FIELDS, samplingValue, activePrompts,
  type ChatPreset, type PresetApi, type PresetBinding, type PromptEntry, type PromptScope, type PromptTask, type RegexScript,
} from '../presets';

interface Props {
  presets: ChatPreset[];
  binding: PresetBinding;
  initialScope?: PromptScope;
  initialPresetId?: string;
  onPresets: (next: ChatPreset[]) => void;
  onBinding: (next: PresetBinding) => void;
  onNotify: (message: string, ok?: boolean) => void;
}

const ROLE_LABEL: Record<PromptEntry['role'], string> = { system: '系统', user: '用户', assistant: '助手' };

/** 标签页：每个任务一页，另加共用词条与全部词条。 */
type PresetView = PromptScope | 'all';

export function PresetDialog({ presets, binding, initialScope, initialPresetId, onPresets, onBinding, onNotify }: Props) {
  const [selectedId, setSelectedId] = useState(() => {
    if (initialPresetId && presets.some(item => item.id === initialPresetId)) return initialPresetId;
    if (initialScope && initialScope !== 'shared') {
      const bound = boundPreset(initialScope, presets, binding);
      if (bound) return bound.id;
    }
    return presets[0]?.id ?? '';
  });
  const [tab, setTab] = useState<'sampling' | 'prompts' | 'advanced'>(initialScope ? 'prompts' : 'sampling');
  const [view, setView] = useState<PresetView>(initialScope ?? 'all');
  const [draft, setDraft] = useState('');
  const [report, setReport] = useState<{ ok: boolean; text: string; notes?: string[]; unsupported?: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preset = presets.find(item => item.id === selectedId) ?? presets[0];
  const entries = useMemo(() => (preset ? presetPrompts(preset) : []), [preset]);
  const activeTask: PromptTask | null = view !== 'shared' && view !== 'all' ? view : null;
  const visibleEntries = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => view === 'all' || promptScope(entry) === view);
  const viewLabel = view === 'all' ? '全部用途' : promptScopeLabel(view);
  const editable = Boolean(preset && !preset.builtin);
  const totalTokens = entries.reduce((sum, entry) => sum + (entry.enabled && !entry.marker ? promptTokens(entry.content) : 0), 0);
  const [regexSample, setRegexSample] = useState('（她把杯子放下）这一晚的剧情到这里就结束了。<think_nya>她的声音很轻</think_nya>');
  const previewRegex = preset?.regex ?? [];
  const previewPrompt = applyRegexScripts(regexSample, previewRegex, 'input', 'prompt');
  const previewDisplay = applyRegexScripts(regexSample, previewRegex, 'output', 'display');

  const replace = (next: ChatPreset) => onPresets(presets.map(item => item.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : item));

  const patchSetting = (key: string, value: unknown) => {
    if (!preset || !editable) return;
    replace({ ...preset, settings: { ...preset.settings, [key]: value } });
  };

  const patchEntries = (next: PromptEntry[]) => {
    if (!preset || !editable) return;
    // 词条列表本身就是编辑顺序：同步 promptOrder，保证上下移动与注入顺序一致。
    replace({ ...preset, prompts: next, promptOrder: next.map(entry => ({ identifier: entry.id, enabled: entry.enabled })) });
  };

  const patchEntry = (id: string, patch: Partial<PromptEntry>) => patchEntries(entries.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  const resetScope = () => {
    if (!preset || !editable) return;
    const scope = view === 'all' ? undefined : view;
    const defaults = DEFAULT_PROMPTS.filter(entry => !scope || promptScope(entry) === scope);
    const kept = scope ? entries.filter(entry => promptScope(entry) !== scope) : [];
    patchEntries([...kept, ...defaults.map((entry, index) => ({ ...entry, id: newEntryId(kept.length + index) }))]);
    onNotify(scope ? `已恢复「${promptScopeLabel(scope)}」的默认词条。` : '已恢复全部默认词条。');
  };
  const chooseView = (next: PresetView) => {
    setView(next);
    if (next !== 'shared' && next !== 'all') {
      const bound = boundPreset(next, presets, binding);
      if (bound) setSelectedId(bound.id);
    }
  };
  const bindTask = (task: PromptTask, id: string) => {
    onBinding({ ...binding, [task]: id });
    setSelectedId(id);
  };
  const patchApi = (patch: Partial<PresetApi>) => {
    if (!preset || !editable) return;
    replace({ ...preset, api: { ...preset.api, ...patch } });
  };
  const patchRegex = (id: string, patch: Partial<RegexScript>) => {
    if (!preset || !editable) return;
    replace({ ...preset, regex: (preset.regex ?? []).map(script => script.id === id ? { ...script, ...patch } : script) });
  };
  const moveEntry = (index: number, delta: number) => {
    const next = [...entries];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    patchEntries(next);
  };

  const duplicate = () => {
    if (!preset) return;
    const copy = duplicatePreset(preset);
    onPresets([...presets, copy]);
    setSelectedId(copy.id);
    onNotify(`已复制「${preset.name}」，可以自由修改。`);
  };

  const remove = () => {
    if (!preset || preset.builtin) return;
    const next = presets.filter(item => item.id !== preset.id);
    const nextBinding = { ...binding };
    for (const task of PROMPT_TASK_SCOPES) {
      if (nextBinding[task] === preset.id) nextBinding[task] = DEFAULT_PRESET_BINDING[task];
    }
    onPresets(next);
    if (PROMPT_TASK_SCOPES.some(task => binding[task] === preset.id)) onBinding(nextBinding);
    setSelectedId(activeTask ? boundPreset(activeTask, next, nextBinding).id : next[0]?.id ?? '');
    onNotify(`已删除「${preset.name}」。`);
  };

  const doImport = (source: string, label: string) => {
    const result = importPresetJson(source);
    if (!result.ok || !result.preset) { setReport({ ok: false, text: result.message }); return; }
    onPresets([...presets, result.preset]);
    setSelectedId(result.preset.id);
    setReport({
      ok: true,
      text: `${result.message}${result.ignored.length ? `（忽略：${result.ignored.join('、')}）` : ''}`,
      notes: result.warnings,
      unsupported: result.unsupported.map(item => `${item.name}：${item.reason}`),
    });
    onNotify(`已导入预设「${result.preset.name}」（${label}）。`);
  };

  const doExport = () => {
    if (!preset) return;
    const url = URL.createObjectURL(new Blob([exportPresetJson(preset)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `夜糖-对话预设-${preset.name}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify(`预设「${preset.name}」已导出，可重新导入 SillyTavern。`);
  };

  return <div className="standard-modal preset-modal">
    <div className="modal-eyebrow"><FlaskConical size={14}/>对话补全预设 · SillyTavern 兼容</div>
    <h2>让叙事者的笔，更接近你要的语气。</h2>
    <p className="muted">{"读取 SillyTavern 对话补全预设的采样参数与提示词词条；词条顺序即拼装顺序，可用 {{world}}、{{player}}、{{context}} 等变量。世界书与酒馆聊天界面不在本作范围内。"}</p>

    <div className="preset-task-tabs" role="tablist" aria-label="按任务编辑预设">
      {PROMPT_SCOPES.map(scope => <button key={scope.id} type="button" id={`preset-task-tab-${scope.id}`} className={view === scope.id ? 'active' : ''} role="tab" aria-selected={view === scope.id} onClick={() => chooseView(scope.id)}>{scope.label}</button>)}
      <button type="button" id="preset-task-tab-all" className={view === 'all' ? 'active' : ''} role="tab" aria-selected={view === 'all'} onClick={() => chooseView('all')}>全部词条</button>
    </div>

    <div className="preset-view-bar">
      {activeTask ? <>
        <span className="preset-view-label">此任务使用</span>
        <select id="preset-bind-current" aria-label="此任务绑定的预设" value={boundPreset(activeTask, presets, binding)?.id ?? ''} onChange={event => bindTask(activeTask, event.target.value)}>
          {presets.map(item => <option key={item.id} value={item.id}>{item.name}{item.builtin ? '（内置）' : ''}</option>)}
        </select>
        <span className="preset-view-hint">{PROMPT_SCOPES.find(scope => scope.id === activeTask)?.hint}；改绑只影响「{viewLabel}」。</span>
      </> : <>
        <span className="preset-view-label">编辑预设</span>
        <select id="preset-edit-preset" aria-label="选择要编辑的预设" value={preset?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>
          {presets.map(item => <option key={item.id} value={item.id}>{item.name}{item.builtin ? '（内置）' : ''}</option>)}
        </select>
        <span className="preset-view-hint">{view === 'shared' ? '共用词条会进入这份预设被用到的每一个任务；这里只改当前预设。' : '全部词条按各自用途注入；左侧可管理预设。'}</span>
      </>}
    </div>

    <div className={`preset-layout ${activeTask ? 'preset-layout-focus' : ''}`}>
      {!activeTask && <aside className="preset-list" aria-label="预设列表">
        {presets.map(item => <button key={item.id} id={`preset-item-${item.id}`} type="button" className={item.id === preset?.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>
          <b>{item.name}</b>
          <small>{item.builtin ? '内置' : '自定义'} · 温度 {samplingValue(item, 'temp_openai').toFixed(2)}</small>
        </button>)}
        <button type="button" id="preset-new" className="preset-new" onClick={() => {
          const created: ChatPreset = {
            id: `preset-${Date.now().toString(36)}`, name: '新的预设', description: '',
            settings: { ...(preset?.settings ?? {}), temp_openai: 0.8 }, prompts: DEFAULT_PROMPTS.map(entry => ({ ...entry, id: newEntryId(0), builtin: false })),
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          };
          onPresets([...presets, created]);
          setSelectedId(created.id);
          setTab('prompts');
        }}><Sparkles size={12}/>新建空白预设</button>
      </aside>}

      {preset && <div className="preset-editor">
        <div className="preset-editor-head">
          <label className="preset-name"><span>名称</span>
            <input id="preset-name" value={preset.name} readOnly={!editable} maxLength={40} onChange={event => replace({ ...preset, name: event.target.value })} /></label>
          <div className="preset-editor-actions">
            {!editable && <button type="button" id="preset-duplicate" className="btn" onClick={duplicate}><Save size={13}/>基于此预设新建副本</button>}
            {editable && <button type="button" id="preset-delete" className="btn danger" onClick={remove}><Trash2 size={13}/>删除</button>}
            <button type="button" id="preset-export" className="btn" onClick={doExport}><Download size={13}/>导出</button>
          </div>
        </div>

        {!editable && <p className="small-note">内置预设是只读的。想调整温度或提示词，请先创建副本。</p>}

        <div className="preset-tabs" role="tablist">
          <button type="button" id="preset-tab-sampling" className={tab === 'sampling' ? 'active' : ''} role="tab" aria-selected={tab === 'sampling'} onClick={() => setTab('sampling')}><SlidersHorizontal size={13}/>采样参数</button>
          <button type="button" id="preset-tab-prompts" className={tab === 'prompts' ? 'active' : ''} role="tab" aria-selected={tab === 'prompts'} onClick={() => setTab('prompts')}><Wand2 size={13}/>提示词词条</button>
          <button type="button" id="preset-tab-advanced" className={tab === 'advanced' ? 'active' : ''} role="tab" aria-selected={tab === 'advanced'} onClick={() => setTab('advanced')}><Braces size={13}/>接口与正则</button>
        </div>

        {tab === 'sampling' ? <div className="preset-fields">
          {SAMPLING_FIELDS.map(field => {
            const value = samplingValue(preset, field.key);
            return <div className={`preset-field ${field.applied ? '' : 'stored-only'}`} key={field.key}>
              <div className="preset-field-head">
                <span>{field.label}{!field.applied && <em>仅保存</em>}</span>
                <input id={`preset-field-${field.key}`} type="number" min={field.min} max={field.max} step={field.step} value={value} readOnly={!editable} onChange={event => patchSetting(field.key, Number(event.target.value))} />
              </div>
              <input type="range" aria-label={field.label} min={field.min} max={field.max} step={field.step} value={value} disabled={!editable} onChange={event => patchSetting(field.key, Number(event.target.value))} />
              <small>{field.hint}</small>
            </div>;
          })}
        </div> : tab === 'advanced' ? <div className="preset-advanced">
          <section className="preset-advanced-block">
            <div className="preset-advanced-head"><KeyRound size={13}/><b>这个预设专用的接口</b><span>三项齐全才生效；不填就走设置里的全局接口</span></div>
            <div className="preset-api-grid">
              <label className="preset-field"><span>Endpoint</span>
                <input id="preset-api-endpoint" className="preset-text" value={preset.api?.endpoint ?? ''} readOnly={!editable} placeholder="https://api.example.com/v1" onChange={event => patchApi({ endpoint: event.target.value })} />
              </label>
              <label className="preset-field"><span>模型</span>
                <input id="preset-api-model" className="preset-text" value={preset.api?.model ?? ''} readOnly={!editable} placeholder="deepseek-chat" onChange={event => patchApi({ model: event.target.value })} />
              </label>
              <label className="preset-field"><span>API 密钥</span>
                <input id="preset-api-key" className="preset-text" type="password" value={preset.api?.apiKey ?? ''} readOnly={!editable} placeholder="只存在本地，导出时会剥离" onChange={event => patchApi({ apiKey: event.target.value })} />
              </label>
            </div>
            <p className="small-note">远程接口必须同时填密钥；`localhost` / `127.0.0.1` 可以不填。导出预设时不会带上密钥。</p>
          </section>

          <section className="preset-advanced-block">
            <div className="preset-advanced-head"><Braces size={13}/><b>格式串</b><span>决定场景、性格与世界书怎么进入提示词；{'{0}'} 是内容占位</span></div>
            <div className="preset-api-grid">
              <label className="preset-field"><span>场景 scenario_format</span>
                <textarea id="preset-format-scenario" className="preset-text" rows={2} value={String(preset.settings.scenario_format ?? '')} readOnly={!editable} placeholder="{{scenario}}" onChange={event => patchSetting('scenario_format', event.target.value)} />
              </label>
              <label className="preset-field"><span>性格 personality_format</span>
                <textarea id="preset-format-personality" className="preset-text" rows={2} value={String(preset.settings.personality_format ?? '')} readOnly={!editable} placeholder="{{personality}}" onChange={event => patchSetting('personality_format', event.target.value)} />
              </label>
              <label className="preset-field"><span>世界书 wi_format</span>
                <input id="preset-format-wi" className="preset-text" value={String(preset.settings.wi_format ?? '')} readOnly={!editable} placeholder="{0}" onChange={event => patchSetting('wi_format', event.target.value)} />
              </label>
            </div>
            <p className="small-note">留空则用默认值（{'{{scenario}}'} / {'{{personality}}'} / {'{0}'}）。只有单个 {'{{…}}'} 的写法表示「原样放入」；带 {'{0}'} 时会按模板包装。</p>
          </section>

          <section className="preset-advanced-block">
            <div className="preset-advanced-head"><Braces size={13}/><b>正则脚本</b><span>按 SillyTavern 的 placement：玩家输入 / 模型输出；prompt 改发给模型的内容，display 改界面显示的文本</span></div>
            <div className="preset-regex-list">
              {(preset.regex ?? []).map((script, index) => <div className={`preset-regex ${script.enabled ? '' : 'off'}`} key={script.id}>
                <div className="preset-regex-head">
                  <button type="button" id={`preset-regex-enabled-${index}`} className={`preset-eye ${script.enabled ? 'on' : ''}`} aria-pressed={script.enabled} aria-label={script.enabled ? '停用正则' : '启用正则'} disabled={!editable} onClick={() => patchRegex(script.id, { enabled: !script.enabled })}>●</button>
                  <input id={`preset-regex-name-${index}`} className="preset-entry-name" value={script.name} maxLength={40} readOnly={!editable} onChange={event => patchRegex(script.id, { name: event.target.value })} />
                  <label className="preset-regex-target"><input id={`preset-regex-input-${index}`} type="checkbox" checked={script.targets.includes('input')} disabled={!editable} onChange={event => patchRegex(script.id, { targets: event.target.checked ? [...new Set([...script.targets, 'input' as const])] : script.targets.filter(target => target !== 'input') })} />输入</label>
                  <label className="preset-regex-target"><input id={`preset-regex-output-${index}`} type="checkbox" checked={script.targets.includes('output')} disabled={!editable} onChange={event => patchRegex(script.id, { targets: event.target.checked ? [...new Set([...script.targets, 'output' as const])] : script.targets.filter(target => target !== 'output') })} />输出</label>
                  <label className="preset-regex-target"><input id={`preset-regex-prompt-only-${index}`} type="checkbox" checked={Boolean(script.promptOnly)} disabled={!editable} onChange={event => patchRegex(script.id, { promptOnly: event.target.checked })} />仅提示词</label>
                  <label className="preset-regex-target"><input id={`preset-regex-display-only-${index}`} type="checkbox" checked={Boolean(script.markdownOnly)} disabled={!editable} onChange={event => patchRegex(script.id, { markdownOnly: event.target.checked })} />仅显示</label>
                  <button type="button" id={`preset-regex-delete-${index}`} aria-label="删除正则" disabled={!editable} onClick={() => replace({ ...preset, regex: (preset.regex ?? []).filter(item => item.id !== script.id) })}><Trash2 size={12}/></button>
                </div>
                <div className="preset-regex-body">
                  <textarea id={`preset-regex-find-${index}`} className="preset-text" rows={2} value={script.find} readOnly={!editable} placeholder="/表达式/flags" onChange={event => patchRegex(script.id, { find: event.target.value })} />
                  <textarea id={`preset-regex-replace-${index}`} className="preset-text" rows={2} value={script.replace} readOnly={!editable} placeholder="替换文本；可用 $1" onChange={event => patchRegex(script.id, { replace: event.target.value })} />
                </div>
              </div>)}
              {(preset.regex ?? []).length === 0 && <p className="small-note">还没有正则。导入带 `extensions.regex_scripts` 的预设会自动带进来。</p>}
            </div>
            <button type="button" id="preset-regex-add" className="btn" disabled={!editable} onClick={() => replace({ ...preset, regex: [...(preset.regex ?? []), { id: `regex-${Date.now().toString(36)}`, name: '新正则', find: '', replace: '', targets: ['output'], enabled: true }] })}><Plus size={12}/>添加正则</button>
          </section>
            <section className="preset-advanced-block preset-regex-preview">
              <div className="preset-advanced-head"><Braces size={13}/><b>正则预览</b><span>改一行样例，看 prompt 与 display 两端分别变成什么</span></div>
              <textarea id="preset-regex-sample" className="preset-text" rows={3} value={regexSample} onChange={event => setRegexSample(event.target.value)} />
              <div className="preset-regex-outputs">
                <div><span>发给模型的 prompt</span><pre id="preset-regex-preview-prompt">{previewPrompt}</pre></div>
                <div><span>界面上显示的 display</span><pre id="preset-regex-preview-display">{previewDisplay}</pre></div>
              </div>
            </section></div> : <div className="preset-entries">
          <div className="preset-entry-toolbar">
            <button type="button" id="preset-entry-add" className="btn" disabled={!editable} onClick={() => patchEntries([...entries, { id: newEntryId(entries.length), name: '新词条', content: '', role: 'system', enabled: true, scope: view === 'all' ? 'shared' : view }])}><Plus size={12}/>添加词条</button>
            <button type="button" id="preset-entry-add-marker" className="btn" disabled={!editable} onClick={() => patchEntries([...entries, { id: newEntryId(entries.length), name: '—— 分隔 ——', content: '', role: 'system', enabled: true, marker: true, scope: view === 'all' ? 'shared' : view }])}><Plus size={12}/>分隔标记</button>
            <span className="preset-scope-current">{viewLabel}</span>
            <button type="button" id="preset-entry-reset" className="btn" disabled={!editable} onClick={() => { if (window.confirm(view === 'all' ? '恢复成默认词条？当前编辑会被覆盖。' : `恢复「${viewLabel}」的默认词条？该页的编辑会被覆盖。`)) resetScope(); }}><RotateCcw size={12}/>{view === 'all' ? '恢复全部默认' : view === 'shared' ? '恢复共用默认' : '恢复本任务'}</button>
            <span className="preset-order-note">注入 {activePrompts(preset, view === 'all' ? undefined : view).filter(entry => entry.enabled && !entry.marker).length} 条 · 顺序 {preset.promptOrder?.length ?? '未设置'}</span>
            <span className="preset-token-total">约 {totalTokens} tokens</span>
          </div>
          {view !== 'all' && <p className="small-note">{PROMPT_SCOPES.find(scope => scope.id === view)?.hint}。代码里的 JSON 输出契约会自动追加在本页词条之后，不需要写进词条。</p>}

          <div className="preset-entry-vars">
            <span>可用变量</span>
            {PROMPT_VARIABLES.map(variable => <button key={variable.key} type="button" className="preset-var" title={variable.hint} disabled={!editable} onClick={() => {
              const target = entries.find(entry => entry.enabled && !entry.marker);
              if (!target) return;
              patchEntry(target.id, { content: `${target.content}{{${variable.key}}}` });
            }}>{`{{${variable.key}}}`}</button>)}
          </div>

          {visibleEntries.length === 0 && <p className="small-note">这个用途还没有词条。添加一条，或恢复本用途默认。</p>}
          <ol className="preset-entry-list">
            {visibleEntries.map(({ entry, index }) => <li key={entry.id} className={`preset-entry ${entry.enabled ? '' : 'off'} ${entry.marker ? 'marker' : ''}`}>
              <div className="preset-entry-head">
                <button type="button" id={`preset-entry-enabled-${index}`} className={`preset-eye ${entry.enabled ? 'on' : ''}`} aria-pressed={entry.enabled} aria-label={entry.enabled ? '停用词条' : '启用词条'} disabled={!editable} onClick={() => patchEntry(entry.id, { enabled: !entry.enabled })}>●</button>
                <input id={`preset-entry-name-${index}`} className="preset-entry-name" value={entry.name} maxLength={40} readOnly={!editable} onChange={event => patchEntry(entry.id, { name: event.target.value })} />
                {!entry.marker && <select id={`preset-entry-scope-${index}`} className="preset-entry-scope" value={promptScope(entry)} disabled={!editable} aria-label="词条用途" onChange={event => patchEntry(entry.id, { scope: event.target.value as PromptScope })}>
                  {PROMPT_SCOPES.map(scope => <option key={scope.id} value={scope.id}>{scope.label}</option>)}
                </select>}
                {!entry.marker && <select id={`preset-entry-role-${index}`} className="preset-entry-role" value={entry.role} disabled={!editable} onChange={event => patchEntry(entry.id, { role: event.target.value as PromptEntry['role'] })}>
                  {(['system', 'user', 'assistant'] as const).map(role => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                </select>}
                <span className="preset-entry-tokens">{entry.marker ? '——' : `${promptTokens(entry.content)}t`}</span>
                <div className="preset-entry-move">
                  <button type="button" id={`preset-entry-up-${index}`} aria-label="上移" disabled={!editable || index === 0} onClick={() => moveEntry(index, -1)}><ArrowUp size={12}/></button>
                  <button type="button" id={`preset-entry-down-${index}`} aria-label="下移" disabled={!editable || index === entries.length - 1} onClick={() => moveEntry(index, 1)}><ArrowDown size={12}/></button>
                  <button type="button" id={`preset-entry-delete-${index}`} aria-label="删除词条" disabled={!editable} onClick={() => patchEntries(entries.filter(item => item.id !== entry.id))}><Trash2 size={12}/></button>
                </div>
              </div>
              {!entry.marker && <textarea id={`preset-entry-content-${index}`} className="preset-entry-content" rows={3} value={entry.content} readOnly={!editable} placeholder="词条内容；可以写 {{world}}、{{player}}、{{context}} 等变量。" onChange={event => patchEntry(entry.id, { content: event.target.value })} />}
              {!entry.marker && promptHasMechanicBan(entry.content) && <div className="preset-entry-warning">
                <span>这条要求会禁止模型写数值、奖励或规则，和夜班提案 v2 的完整生成冲突。</span>
                <button type="button" id={`preset-entry-fix-ban-${index}`} disabled={!editable} onClick={() => patchEntry(entry.id, { content: stripMechanicBan(entry.content) })}>移除这一句</button>
              </div>}
            </li>)}
          </ol>
          <p className="small-note">词条按顺序拼进系统提示词，再交给模型。空变量会被跳过；推理模型会把思维链计入输出额度，剧情类预设建议把「最大输出」设到 2000 以上。</p>
        </div>}
      </div>}
    </div>

    <div className="preset-import">
      <div className="preset-import-head"><FileJson size={14}/>导入 SillyTavern 预设</div>
      <div className="preset-import-row">
        <label id="preset-import-file" className="btn" htmlFor="preset-import-file-input"><Upload size={14}/>选择 JSON 文件<input ref={fileRef} id="preset-import-file-input" type="file" accept="application/json,.json" hidden onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          if (file.size > 2_000_000) { setReport({ ok: false, text: '文件超过 2MB，可能不是对话补全预设。' }); return; }
          doImport(await file.text(), file.name);
        }} /></label>
        <input id="preset-import-paste" className="preset-paste" value={draft} onChange={event => setDraft(event.target.value)} placeholder="或把预设 JSON 粘贴到这里" spellCheck={false} />
        <button type="button" id="preset-import-paste-run" className="btn" disabled={!draft.trim()} onClick={() => { doImport(draft, '粘贴'); setDraft(''); }}>导入</button>
      </div>
      {report && <p className={`preset-report ${report.ok ? 'ok' : 'bad'}`}>{report.text}</p>}
      {report?.notes?.length ? (
        <ul className="preset-notes">
          {report.notes.map((note, index) => <li key={index}>{note}</li>)}
        </ul>
      ) : null}
      {report?.unsupported?.length ? (
        <div className="preset-unsupported">
          <b>需要你手动处理</b>
          {report.unsupported.map((item, index) => <p key={index}>{item}</p>)}
        </div>
      ) : null}
      <p className="small-note">兼容 {`{ name, settings }`} 与平铺 settings 两种格式；提示词词条会读入并可编辑，导出时写回 SillyTavern 的 prompts[] 形状。openai_model、世界书等用不到的字段保留在原始 settings 中。</p>
    </div>
  </div>;
}
