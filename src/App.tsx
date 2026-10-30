import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Clock3, FastForward, Heart, Pause, Play, Radio, X, Info, Moon, ChevronRight, ShieldCheck, ChevronsRight } from 'lucide-react';
import type { BattleState, CharacterEvent, FactionId, GameAction, GameState, Girl, StoryPassage, StoryPlan } from './types';
import { act, buildTemplateArc, canAcceptGeneratedContent, dateLabel, deployIncidentCard, deployMissionTemplate, importState, loadState, SAVE_KEY } from './game';
import { cityStage, factionAttitude } from './economy';
import { factionInfo } from './content/items';
import { Navigation, PageHeading, Topbar } from './components/Shell';
import type { Page } from './components/Shell';
import { DispatchMap } from './components/DispatchMap';
import { FrontDialog } from './components/FrontDialog';
import { TaskPanel } from './components/TaskPanel';
import type { TaskEntry } from './tasks';
import { Roster } from './components/Roster';
import { Dialog } from './components/Dialog';
import { MissionDialog, AssignmentPicker } from './components/MissionDialog';
import { CharacterDialog } from './components/CharacterDialog';
import { Conversation } from './components/Conversation';
import { BuildDialog, HelpDialog, HireDialog, NotificationsDialog, ResetDialog, SettingsDialog } from './components/UtilityDialogs';
import { RoomDialog } from './components/RoomDialog';
import { BaseView, RecordsView } from './views/AuxViews';
import { MarketView } from './views/MarketView';
import { WorldbookView } from './views/WorldbookView';
import { CustomGirlDialog } from './components/CustomGirlDialog';
import { BattleReport } from './components/BattleReport';
import { BattleNoteDialog } from './components/BattleNoteDialog';
import { buildBattleBrief } from './battleNote';
import { CodexDialog, MemorialDialog } from './components/ArchiveDialogs';
import { FactionDialog } from './components/FactionDialog';
import { OfficeDialog } from './components/OfficeDialog';
import { ChronicleDialog } from './components/ChronicleDialog';
import { buildGirlCard, girlCardFileName, parseGirlCard } from './cards';
import { taskRuntime } from './llm';
import { incidentPoolNeed } from './incidents.ts';
import { generateBattleNote, generateDaily, generateDialogue, generateEvent, generateGirlProfile, generateIncidentBatch, generateOutfitDescription, generateStoryArc, generateStoryBlueprint, generateWitchFormProfile, llmHasKey, loadLlmConfig } from './llm';
import { activePersonality } from './personality';
import { materializeNightProposal } from './llm-night';
import { ProposalDialog, type PendingProposal } from './components/ProposalDialog';
import { boundPreset, duplicatePreset, ensureTaskPresets, loadBinding, loadPresets, promptScopeLabel, saveBinding, savePresets, PROMPT_TASK_SCOPES, TASK_PRESET_MARKER, type ChatPreset, type PresetBinding, type PromptScope, type PromptTask } from './presets';
import { clockLabel, minutesToClose, phaseLabel, shiftPhase } from './shift';
import { LlmConsole } from './components/LlmConsole';
import { PresetDialog } from './components/PresetDialog';
import { WardrobeDialog } from './components/WardrobeDialog';
import { ExpressionVariantDialog } from './components/ExpressionVariantDialog';
import { WitchFormDialog } from './components/WitchFormDialog';
import { CommandConsole } from './components/CommandConsole';
import { CouncilView } from './components/CouncilView';
import { IncidentDialog } from './components/IncidentDialog';
import { blockingIncidents } from './incidents';
import { hostilityOf } from './hostility';
import { EventDialog } from './components/EventDialog';
import { StoryPlayerDialog } from './components/StoryPlayerDialog';
import { StoryGraphDialog } from './components/StoryGraphDialog';
import { fallbackStoryPlan, storyPlanTemplate } from './storyplan';
import { StartDialog } from './components/StartDialog';
import { ContentWorkshopDialog } from './components/workshop/ContentWorkshopDialog';
import { loadLibrary, withCustomStock, type ContentLibrary } from './content/library';
import { districtOrder, districts, effectLines } from './districts';
import { representativeOf } from './office';
import { syncOfficeWorldbook } from './worldbook';
import './styles.css';
import './combat.css';

type Modal =
  | { type: 'girl' | 'assign' | 'hire' | 'room' | 'build' | 'wardrobe' | 'expression' | 'witch-form'; id: string; portraitFile?: File }
  | { type: 'talk'; id: string; remote?: boolean }
  | { type: 'mission'; id: string; girlId?: string }
  | { type: 'front'; id: string }
  | { type: 'battle'; id: string }
  | { type: 'battle-note'; id: string }
  | { type: 'event'; id: string }
  | { type: 'story'; id: string }
  | { type: 'story-graph'; id: string }
  | { type: 'codex'; id?: string }
  | { type: 'presets'; scope?: PromptScope; presetId?: string }
  | { type: 'settings' | 'help' | 'notifications' | 'reset' | 'memorial' | 'custom' | 'chronicle' | 'end-night' | 'workshop' }
  | { type: 'faction'; id: FactionId }
  | { type: 'office' };

function readSave() { try { return loadState(localStorage.getItem(SAVE_KEY)); } catch { return loadState(null); } }
function readAutoGenerate() { try { return localStorage.getItem('night-sugar:auto-generate') === 'on'; } catch { return false; } }
function readReduced() { try { return localStorage.getItem('night-sugar:motion') === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }
function leftLabel(minutes: number) {
  if (minutes <= 0) return '已打烊';
  const h = Math.floor(minutes / 60), m = minutes % 60;
  if (!h) return `距打烊 ${m} 分钟`;
  return m ? `距打烊 ${h} 小时 ${m} 分` : `距打烊 ${h} 小时`;
}
const factionOrder: FactionId[] = ['witch', 'association', 'government'];

function worldBrief(state: GameState) {
  const open = state.missions.filter(m => m.status === 'open');
  const urgent = open.filter(m => m.boss || m.difficulty === '高').length;
  const bossMission = state.boss ? state.missions.find(m => m.id === state.boss?.missionId) : undefined;
  const boss = bossMission ? `周期魔物正在城内，相关委托「${bossMission.title}」尚未解决。` : '当前没有周期魔物。';
  const standings = factionOrder.map(id => `${factionInfo[id].name} ${state.factions[id].standing}`).join('，');
  const recent = state.chronicle.slice(0, 4).map(entry => entry.title).join('、') || '尚无';
  return `第 ${state.day} 日 ${clockLabel(state.minutes)}，星砂 ${state.gold}，城市安定度 ${state.reputation}。待处理委托 ${open.length} 条（高危 ${urgent} 条），${boss}势力声望：${standings}。最近编年史：${recent}。`;
}

export default function App() {
  const [state, setState] = useState<GameState>(readSave);
  const [page, setPage] = useState<Page>('dispatch');
  const [modal, setModal] = useState<Modal | null>(null);
  const [library, setLibrary] = useState<ContentLibrary>(loadLibrary);
  const [toast, setToast] = useState<{ message: string; ok: boolean; id: number } | null>(null);
  const [auto, setAuto] = useState(false);
  const [saved, setSaved] = useState(true);
  const [pendingSave, setPendingSave] = useState<GameState | null>(null);
  const [reduced, setReduced] = useState(readReduced);
  const [autoGenerate, setAutoGenerate] = useState(readAutoGenerate);
  const [presets, setPresets] = useState<ChatPreset[]>(loadPresets);
  const [binding, setBinding] = useState<PresetBinding>(loadBinding);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [incidentFocus, setIncidentFocus] = useState<string | null>(null);
  const [arcBusy, setArcBusy] = useState<string | null>(null);
  const STARTED_KEY = 'night-sugar-office:started';
  const markStarted = () => { try { sessionStorage.setItem(STARTED_KEY, '1'); } catch { /* 忽略存储异常 */ } setStarted(true); };
  const [started, setStarted] = useState(() => { try { return sessionStorage.getItem(STARTED_KEY) === '1' || Boolean(localStorage.getItem(SAVE_KEY)); } catch { return false; } });
  const [generating, setGenerating] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [storyBusy, setStoryBusy] = useState<string | null>(null);
  const [storyNotice, setStoryNotice] = useState<string | null>(null);
  const lastIncidentDay = useRef(state.day);
  const officeSynced = useRef(false);
  const lastGeneratedDay = useRef(state.day);
  const generatingRef = useRef(false);

  useEffect(() => { try { savePresets(presets); } catch { /* 预设只是本地偏好。 */ } }, [presets]);
  useEffect(() => { try { saveBinding(binding); } catch { /* 绑定失效时回落内置预设。 */ } }, [binding]);

  const taskPresetsReady = useRef(false);
  useEffect(() => {
    if (taskPresetsReady.current) return;
    taskPresetsReady.current = true;
    try { if (localStorage.getItem(TASK_PRESET_MARKER)) return; } catch { /* 没有存储时仍按本次会话拆分。 */ }
    const workspace = ensureTaskPresets(presets, binding);
    setPresets(workspace.presets);
    setBinding(workspace.binding);
    try { localStorage.setItem(TASK_PRESET_MARKER, '1'); } catch { /* 下次启动再拆一次。 */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      setSaved(true);
    } catch {
      setSaved(false);
      setToast({ message: '浏览器存储空间不足，本次进度没有写入。请导出存档并清理浏览器站点数据。', ok: false, id: Date.now() });
    }
  }, [state]);
  useEffect(() => { document.documentElement.classList.toggle('reduced-motion', reduced); try { localStorage.setItem('night-sugar:motion', reduced ? 'reduced' : 'full'); } catch { /* Preferences are optional when storage is unavailable. */ } }, [reduced]);
  useEffect(() => { if (!auto) return; const timer = window.setInterval(() => { if (!document.hidden) setState(s => act(s, { type: 'advance', minutes: 5 }).state); }, 12000); return () => clearInterval(timer); }, [auto]);
  useEffect(() => { try { localStorage.setItem('night-sugar:auto-generate', autoGenerate ? 'on' : 'off'); } catch { /* Optional preference. */ } }, [autoGenerate]);
  useEffect(() => {
    if (!autoGenerate) { lastGeneratedDay.current = state.day; return; }
    if (state.day <= lastGeneratedDay.current) { lastGeneratedDay.current = state.day; return; }
    lastGeneratedDay.current = state.day;
    if (generatingRef.current || !llmHasKey()) return;
    void generateContent('auto');
  }, [state.day, autoGenerate]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 5500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (state.day <= lastIncidentDay.current) { lastIncidentDay.current = state.day; return; }
    lastIncidentDay.current = state.day;
    if (!llmHasKey()) return;
    if (incidentPoolNeed(state) <= 0) return;
    void generateIncidentBatch(loadLlmConfig(), state, taskRuntime(boundPreset('incident', presets, binding), 'incident')).then(result => {
      if (!result.ok) return;
      const applied = act(state, { type: 'mergeIncidentPool', entries: result.data.entries });
      if (applied.ok) setState(applied.state);
    });
  }, [state.day]);
  useEffect(() => {
    if (modal?.type !== 'event') return;
    const event = state.events.find(item => item.id === modal.id);
    if (!event || event.mode !== 'story' || (event.passages?.length ?? 0) > 0) return;
    if (arcBusy) return;
    const target = state.girls.find(item => item.id === event.girlId);
    if (!target) return;
    setArcBusy(event.id);
    const story = state.storylines.find(item => item.id === event.storylineId);
    const beat = story?.beats.find(item => item.eventId === event.id);
    void (async () => {
      const config = loadLlmConfig();
      const preset = taskRuntime(boundPreset('arc', presets, binding), 'arc');
      const memory = story ? [story.title, story.premise, ...story.beats.filter(item => item.index < story.stage).map(item => `${item.title}：${item.hook}`)].join('\n') : '';
      const result = config.apiKey
        ? await generateStoryArc(config, target, { storylineTitle: story?.title, premise: story?.premise, beatTitle: beat?.title, beatHook: beat?.hook, memory }, preset)
        : { ok: false as const, message: '' };
      if (!result.ok && config.apiKey) notify(result.message || '叙事者没有写完，改用模板剧情。', false);
      const passages: StoryPassage[] = result.ok
        ? result.data.passages.map((passage, index) => ({ id: `p${index + 1}`, title: passage.title, narration: passage.narration, lines: passage.lines, choices: passage.choices.map((choice, at) => ({ id: `c${index + 1}-${at + 1}`, label: choice.label, intent: choice.intent, effect: choice.effect })) }))
        : buildTemplateArc(target, story?.premise ?? '', event.hook);
      const summary = result.ok ? result.data.summary : `「${event.title}」：${target.name}把没说完的话说完了。`;
      setState(prev => { const applied = act(prev, { type: 'beginStoryEvent', eventId: event.id, passages, summary }); return applied.ok ? applied.state : prev; });
      setArcBusy(null);
    })();
  }, [modal, state.events, arcBusy]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCmdOpen(open => !open); return; }
      if (event.key === 'Escape') setCmdOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => {
    const openGirl = (event: Event) => { const id = (event as CustomEvent<string>).detail; if (id) setModal({ type: 'girl', id }); };
    document.addEventListener('nso:open-girl', openGirl);
    return () => document.removeEventListener('nso:open-girl', openGirl);
  }, []);
  /**
   * 世界书的「夜糖事务所」条目由 `state.office` 生成：首次挂载只在缺失时补写，
   * 之后玩家改档案或换代表才整条重写。读档时旧条目里残留的「月蚀教团」也在这里一并迁移。
   */
  useEffect(() => {
    if (!officeSynced.current) { officeSynced.current = true; syncOfficeWorldbook(state.office, representativeOf(state), { onlyIfMissing: true }); return; }
    syncOfficeWorldbook(state.office, representativeOf(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.office, state.assistantId]);

  const notify = (message: string, ok = true) => setToast({ message, ok, id: Date.now() });

  /** 从设置页的任务入口打开预设：内置预设只读，先复制成只改绑当前任务的可编辑副本。 */
  const openPresetScope = (scope?: PromptScope) => {
    if (!scope) { setModal({ type: 'presets' }); return; }
    const task: PromptTask = scope === 'shared' ? 'chat' : scope;
    const current = boundPreset(task, presets, binding);
    if (!current) { setModal({ type: 'presets', scope }); return; }
    if (!current.builtin) { setModal({ type: 'presets', scope, presetId: current.id }); return; }
    const copy = duplicatePreset(current, scope === 'shared' ? `${current.name} 副本` : promptScopeLabel(scope));
    const nextPresets = [...presets, copy];
    const nextBinding = { ...binding };
    const affected: PromptTask[] = scope === 'shared'
      ? PROMPT_TASK_SCOPES.filter(item => binding[item] === current.id)
      : [task];
    for (const item of affected.length ? affected : [task]) nextBinding[item] = copy.id;
    setPresets(nextPresets);
    setBinding(nextBinding);
    savePresets(nextPresets);
    saveBinding(nextBinding);
    setModal({ type: 'presets', scope, presetId: copy.id });
    notify(scope === 'shared'
      ? `已将「${current.name}」复制为可编辑副本，并让共用词条同时作用于 ${affected.length} 个任务。`
      : `已将「${current.name}」复制为可编辑副本，并绑定到「${promptScopeLabel(scope)}」。`);
  };

  const describeWitchForm = async (girl: Girl, portrait: string) => {
    const config = loadLlmConfig();
    if (!config.apiKey.trim()) { notify('填写 API 密钥后，叙事者才能看图写魔女化形态。', false); return null; }
    const result = await generateWitchFormProfile(config, {
      portrait,
      girlName: girl.name,
      codename: girl.codename,
      appearance: girl.appearance,
      personality: activePersonality(girl),
    }, taskRuntime(boundPreset('profile', presets, binding), 'profile'));
    if (!result.ok) { notify(result.message, false); return null; }
    notify(`叙事者写好了「${result.data.name}」，顺带补上了魔女化人格。`);
    return result.data;
  };
  const describeOutfit = async (portrait: string) => {
    const config = loadLlmConfig();
    if (!config.apiKey.trim()) { notify('填写 API 密钥后，叙事者才能看图写服装描述。', false); return null; }
    const result = await generateOutfitDescription(config, portrait, taskRuntime(boundPreset('outfit', presets, binding), 'outfit'));
    if (!result.ok) { notify(result.message, false); return null; }
    notify(result.data.name ? `叙事者写好了「${result.data.name}」。` : '叙事者写好了这套服装的描述。');
    return result.data;
  };
  const generateContent = async (mode: 'manual' | 'auto' = 'manual'): Promise<{ ok: boolean; message: string }> => {
    if (generatingRef.current) return { ok: false, message: '叙事者还在写上一份提案。' };
    const gate = canAcceptGeneratedContent(state);
    if (!gate.ok) {
      if (mode === 'auto') notify(`夜间自动补充跳过：${gate.message}`, false);
      return { ok: false, message: gate.message };
    }
    generatingRef.current = true;
    setGenerating(true);
    try {
      const result = await generateDaily(loadLlmConfig(), state, worldBrief(state), taskRuntime(boundPreset('daily', presets, binding), 'daily'));
      if (!result.ok) {
        if (mode === 'auto') notify(`夜间自动补充停笔：${result.message}`, false);
        return { ok: false, message: result.message };
      }
      if (mode === 'manual') {
        setModal(null);
        setPendingProposal({ data: result.data, warnings: result.warnings });
        return { ok: true, message: '提案已生成，确认后才会写入事务所。' };
      }
      const content = materializeNightProposal(result.data, state);
      const applied = act(state, { type: 'addGeneratedContent', ...content });
      if (!applied.ok) {
        notify(`夜间自动补充没有写入：${applied.message}`, false);
        return { ok: false, message: applied.message };
      }
      setState(applied.state);
      notify(result.warnings.length ? `夜间自动补充完成，本地裁剪了 ${result.warnings.length} 处越界数值。` : '夜间自动补充完成，新的魔物、候选者、委托与议会提案已经入场。');
      return { ok: true, message: applied.message };
    } finally {
      generatingRef.current = false;
      setGenerating(false);
    }
  };
  const acceptProposal = () => {
    if (!pendingProposal) return;
    const gate = canAcceptGeneratedContent(state);
    if (!gate.ok) { notify(gate.message, false); return; }
    const content = materializeNightProposal(pendingProposal.data, state);
    const applied = act(state, { type: 'addGeneratedContent', ...content });
    if (!applied.ok) { notify(applied.message, false); return; }
    setState(applied.state);
    setPendingProposal(null);
    setModal(null);
    notify(pendingProposal.warnings.length ? `提案已采纳；其中 ${pendingProposal.warnings.length} 处数值由本地规则裁剪。` : '提案已采纳，今晚的新内容已经入场。');
  };
  const draftGirlProfile = async (portrait?: string, hint?: string) => {
    const result = await generateGirlProfile(loadLlmConfig(), portrait, hint, taskRuntime(boundPreset('profile', presets, binding), 'profile'));
    return result.ok ? { ok: true, message: '', profile: result.data } : { ok: false, message: result.message };
  };
  const perform = (action: GameAction, quiet = false) => {
    const result = act(state, action);
    if (result.ok) setState(result.state);
    if (!quiet || !result.ok) notify(result.message, result.ok);
    if (result.ok && result.battle) setModal({ type: 'battle', id: result.battle.id });
    return result.ok;
  };
  const writeBattleNote = async (battle: BattleState) => {
    if (noteBusy) return;
    setNoteBusy(true);
    setNoteError(undefined);
    try {
      const config = loadLlmConfig();
      const result = await generateBattleNote(config, battle, taskRuntime(boundPreset('battle', presets, binding), 'battle'));
      if (result.ok) {
        perform({ type: 'saveBattleNote', note: result.data }, true);
        notify(`战斗札记写好了：${result.data.charCount} 字，已收进战斗记录。`);
        return;
      }
      const brief = buildBattleBrief(battle);
      perform({ type: 'saveBattleNote', note: brief }, true);
      setNoteError(`完整札记没有写成：${result.message} 先保存了一份据实简报。`);
      notify('叙事者没有写成完整札记，已先保存据实简报。', false);
    } finally {
      setNoteBusy(false);
    }
  };
  const openBattleNote = (id: string) => { setNoteError(undefined); setModal({ type: 'battle-note', id }); };
  const navigate = (p: Page) => { setPage(p); setModal(null); window.scrollTo({ top: 0, behavior: 'instant' }); };
  const openTask = (target: TaskEntry['target']) => {
    switch (target.modal) {
      case 'council': navigate('council'); return;
      case 'base': navigate('base'); return;
      case 'incident': if (target.id) setIncidentFocus(target.id); return;
      case 'mission': if (target.id) setModal({ type: 'mission', id: target.id }); return;
      case 'girl': if (target.id) setModal({ type: 'girl', id: target.id }); return;
      case 'faction': if (target.id) setModal({ type: 'faction', id: target.id as FactionId }); return;
    }
  };
  const girl = (id: string) => setModal({ type: 'girl', id });
  const talk = (id: string, remote = false) => { const g = state.girls.find(g => g.id === id); if (remote) { if (!g?.retired) { notify(`${g?.name ?? '她'}还没有退役，直接去会客厅找她吧。`, false); return; } setModal({ type: 'talk', id, remote: true }); return; } if (g?.retired) { notify(`${g.name}已经退役，可以用远程联络。`, false); setModal({ type: 'talk', id, remote: true }); return; } if (g?.status === 'mission') { notify(`${g.name}正在出勤，等她回到基地再聊聊吧。`, false); return; } if (g?.status === 'healing' || g?.status === 'resting') { notify(`${g.name}正在${g.status === 'healing' ? '治疗' : '休息'}，稍后再聊吧。`, false); return; } if (g?.status === 'expedition') { notify(`${g.name}正在星象台远行，暂时联络不上。`, false); return; } setModal({ type: 'talk', id }); };
  const sendTalk = async (id: string, text: string, remote = false): Promise<boolean> => {
    const target = state.girls.find(g => g.id === id) ?? state.candidates.find(g => g.id === id);
    if (!target) return false;
    const config = loadLlmConfig();
    if (config.apiKey.trim()) {
      const result = await generateDialogue(config, { girl: target, state, text, remote }, taskRuntime(boundPreset('chat', presets, binding), 'chat'));
      if (result.ok) return perform({ type: 'talk', girlId: id, text, remote, reply: result.text }, true);
      notify(`叙事者没有回应：${result.message} 已切回本地剧情。`, false);
    }
    return perform({ type: 'talk', girlId: id, text, remote }, true);
  };
  const exportCard = (girl: Parameters<typeof buildGirlCard>[0]) => {
    const card = buildGirlCard(girl, state);
    const url = URL.createObjectURL(new Blob([JSON.stringify(card, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = girlCardFileName(card); document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`契约卡「${girl.name}」已导出，可在新游戏中重新导入。`);
  };
  const importCard = async (file: File) => {
    if (file.size > 4_000_000) { notify('卡片文件超过 4MB，无法导入。', false); return; }
    const parsed = parseGirlCard(await file.text());
    if (!parsed.ok) { notify(`导入失败：${parsed.message}`, false); return; }
    perform({ type: 'importCard', card: parsed.card });
  };
  const exportSave = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `夜糖事务所-第${state.day}日存档.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('当前存档已导出到下载目录。');
  };
  const importSave = async (file: File) => {
    if (file.size > 6_000_000) { notify('存档文件超过 6MB，无法导入。', false); return; }
    const next = importState(await file.text());
    if (!next) { notify('导入失败：这不是可识别的夜糖事务所存档，或文件已经损坏。', false); return; }
    setModal(null);
    setPendingSave(next);
  };

  const runCommand = async (line: string): Promise<string> => {
    const raw = line.trim();
    const [head, ...rest] = raw.split(/\s+/);
    const cmd = (head ?? '').toLowerCase();
    const arg = rest.join(' ').trim();
    switch (cmd) {
      case 'help': case '?': case '帮助':
        return ['可用命令：',
          '  help                              这份清单',
          '  status                            当前夜班状态',
          '  advance [分钟]                    推进时间（默认 30，最多 180）',
          '  end                               打开打烊与交接确认',
          '  page <dispatch|base|market|records>  切换页面',
          '  generate                          让叙事者补充今晚的内容',
          '  preset [list]                     查看对话补全预设',
          '  preset use <名称>                 绑定生成用预设',
          '  preset chat <名称>                绑定对话用预设',
          '  district <辖区>                   查看辖区背景与环境影响',
          '  mission <关键词>                  打开委托详情',
          '  girl <名字>                       打开契约者档案',
          '  clear                             清空终端输出'].join('\n');
      case 'status': case '状态': {
        const open = state.missions.filter(m => m.status === 'open').length;
        const idle = state.girls.filter(g => !g.retired && !g.left && g.status === 'idle').length;
        return `第 ${state.day} 日 · ${clockLabel(state.minutes)}（${phaseLabel[shiftPhase(state.minutes)]}，距打烊 ${Math.max(0, minutesToClose(state.minutes))} 分钟）\n星砂 ${state.gold} · 安定度 ${state.reputation}/100 · 待命 ${idle} 人 · 可接委托 ${open} 件 · 已放号 ${state.shift.wave}/3 批`;
      }
      case 'advance': case '推进': case 'adv': {
        const n = arg ? Number(arg) : 30;
        if (!Number.isFinite(n) || n < 1 || n > 180) return '无法推进：一次只能推进 1–180 分钟。';
        const result = act(state, { type: 'advance', minutes: Math.round(n) });
        if (!result.ok) return result.message;
        setState(result.state);
        if (result.battle) setModal({ type: 'battle', id: result.battle.id });
        return `${clockLabel(result.state.minutes)} · ${result.message}`;
      }
      case 'end': case '打烊': case 'close':
        setCmdOpen(false);
        setModal({ type: 'end-night' });
        return '已打开打烊确认，请在弹窗里再确认一次。';
      case 'page': case 'go': case '页面': {
        const pages: Record<string, Page> = { dispatch: 'dispatch', 派遣: 'dispatch', base: 'base', 基地: 'base', market: 'market', 市场: 'market', records: 'records', 记录: 'records' };
        const target = pages[arg.toLowerCase()];
        if (!target) return '无法切换：page 后面接 dispatch、base、market 或 records。';
        navigate(target);
        return `已切换到${target === 'dispatch' ? '派遣' : target === 'base' ? '基地' : target === 'market' ? '市场' : '记录'}页。`;
      }
      case 'generate': case '生成': {
        const result = await generateContent();
        return result.message || (result.ok ? '叙事者写完了新的内容。' : '生成失败。');
      }
      case 'preset': case '预设': {
        const sub = (rest[0] ?? '').toLowerCase();
        const name = rest.slice(1).join(' ').trim();
        if (!sub || sub === 'list') {
          return presets.map(preset => {
            const tasks = PROMPT_TASK_SCOPES.filter(task => binding[task] === preset.id).map(task => promptScopeLabel(task));
            return `${tasks.length ? `[${tasks.join('/')}] ` : ''}${preset.name}${preset.builtin ? '（内置）' : ''}`;
          }).join('\n');
        }
        const found = presets.find(preset => preset.name === name || preset.id === name);
        if (!found) return `找不到预设「${name}」。先输入 preset 查看列表。`;
        const alias: Record<string, PromptTask> = {
          chat: 'chat', daily: 'daily', profile: 'profile', storyline: 'storyline', story: 'storyline',
          event: 'event', arc: 'arc', incident: 'incident', outfit: 'outfit', generate: 'daily',
        };
        const task = alias[sub];
        if (!task) return `未知用途「${sub}」。可用：${PROMPT_TASK_SCOPES.join('、')}。`;
        setBinding(current => ({ ...current, [task]: found.id }));
        return `已把「${promptScopeLabel(task)}」绑定到「${found.name}」。`;
      }
      case 'district': case '辖区': {
        const found = districtOrder.map(id => districts[id]).find(region => region.id === arg.toLowerCase() || region.name.includes(arg) || region.subtitle.includes(arg));
        if (!found) return `找不到辖区「${arg}」。可用：${districtOrder.map(id => `${id}（${districts[id].name}）`).join('、')}`;
        const effects = effectLines(found.effect).map(item => `${item.label} ${item.value}`).join(' · ');
        return `${found.name} · ${found.subtitle}\n${found.description}\n环境影响：${effects || '无'}`;
      }
      case 'mission': case '委托': {
        const found = state.missions.find(mission => mission.id === arg || mission.id.startsWith(arg) || mission.title.includes(arg));
        if (!found) return `找不到委托「${arg}」。`;
        setModal({ type: 'mission', id: found.id });
        return `已打开「${found.title}」。`;
      }
      case 'girl': case '契约者': {
        const found = [...state.girls, ...state.candidates].find(candidate => candidate.id === arg || candidate.name === arg || candidate.codename === arg || candidate.name.includes(arg));
        if (!found) return `找不到契约者「${arg}」。`;
        setModal({ type: 'girl', id: found.id });
        return `已打开「${found.name}」的档案。`;
      }
      case 'clear': case '清屏':
        return '';
      default:
        return `未知命令：${cmd}。输入 help 查看可用命令。`;
    }
  };

  // 必须当场决定的事自动摆到桌上；通报类的先收在一边，点开才看。
  const pendingIncidents = state.incidents.filter(incident => incident.status === 'pending');
  const blockingPending = blockingIncidents(state);
  const shelfIncidents = pendingIncidents.filter(incident => !blockingPending.some(item => item.id === incident.id));
  const pendingIncident = blockingPending[0]
    ?? (incidentFocus ? pendingIncidents.find(incident => incident.id === incidentFocus) : undefined);
  const startStory = (girlId: string) => {
    const target = state.girls.find(item => item.id === girlId);
    if (!target?.storyPlan) { notify('先生成或画一张故事蓝图，再按蓝图开场。', false); return; }
    perform({ type: 'startStoryline', girlId });
  };
  const generateBlueprint = async (girlId: string) => {
    if (storyBusy) return;
    const target = state.girls.find(item => item.id === girlId);
    if (!target) return;
    setStoryBusy(girlId);
    setStoryNotice(null);
    try {
      const result = await generateStoryBlueprint(loadLlmConfig(), target, undefined, taskRuntime(boundPreset('storyline', presets, binding), 'storyline'));
      if (result.ok) {
        const plan: StoryPlan = { title: result.data.title, premise: result.data.premise, tone: result.data.tone, beats: [], graph: result.data.graph };
        if (!perform({ type: 'setStoryPlan', girlId, plan }, true)) return;
        setModal({ type: 'story-graph', id: girlId });
        notify(`蓝图写好了：${result.data.graph.nodes.length} 个节点、${result.data.graph.nodes.filter(node => node.kind === 'end').length} 个结局。先检查，再按蓝图开场。`);
        return;
      }
      if (target.storyPlan) {
        notify(`这次没有重写蓝图：${result.message} 原来的蓝图还在。`, false);
        return;
      }
      const plan = fallbackStoryPlan(target);
      if (!perform({ type: 'setStoryPlan', girlId, plan }, true)) return;
      setStoryNotice(`这次生成没有通过：${result.message} 先用本地四幕模板起了一张蓝图，你可以直接改。`);
      setModal({ type: 'story-graph', id: girlId });
      notify('叙事者这次没写成，先用本地模板起了一张蓝图。', false);
    } catch (error) {
      notify(`生成蓝图时出错了：${error instanceof Error ? error.message : '未知错误'}`, false);
    } finally {
      setStoryBusy(null);
    }
  };
  const startEvent = async (girlId: string) => {
    const active = state.events.find(event => event.girlId === girlId && event.status === 'active');
    if (active) { setModal({ type: 'event', id: active.id }); return; }
    const target = state.girls.find(item => item.id === girlId);
    if (!target) return;
    const storyline = state.storylines.find(item => item.girlId === girlId && item.status === 'active');
    const result = await generateEvent(loadLlmConfig(), target, storyline ? { title: storyline.title, premise: storyline.premise } : undefined, taskRuntime(boundPreset('event', presets, binding), 'event'));
    const stamp = Date.now();
    const data = result.ok ? result.data : undefined;
    const fallbackTitle = storyline ? `${storyline.title} · 夜路` : '夜路';
    const event: CharacterEvent = {
      id: `ev-${girlId}-${stamp}`, girlId, storylineId: storyline?.id,
      title: data ? data.title : fallbackTitle,
      hook: data ? data.hook : '她在门口停下，像是还有话没说完。',
      scenes: data
        ? data.scenes.map((scene, index) => ({ id: `s${index + 1}`, title: scene.title, narration: scene.narration, lines: scene.lines }))
        : [{ id: 's1', title: '门口的灯', narration: '灯把她的影子拉得很长。今晚的风比平时冷一点。', lines: [{ speaker: target.name, tone: 'soft', text: '「我想再确认一次——你还会在这里等我回来吧？」' }, { speaker: '你', tone: 'calm', text: '「会。去吧，回来的时候灯还亮着。」' }], choices: [{ id: 'c1', label: '把外套递给她', intent: '温柔', effect: { bond: 6 } }, { id: 'c2', label: '让她自己去', intent: '克制', effect: { corruption: 2 } }] }],
      stage: 0, status: 'active', day: state.day, source: data ? 'llm' : 'template', badge: true,
    };
    const applied = act(state, { type: 'addCharacterEvent', event });
    if (applied.ok) { setState(applied.state); setModal({ type: 'event', id: event.id }); }
    else notify(applied.message, false);
  };  const selectedGirl = modal && 'id' in modal ? [...state.girls, ...state.candidates].find(g => g.id === modal.id) : undefined;
  const selectedMission = modal?.type === 'mission' ? state.missions.find(m => m.id === modal.id) : undefined;
  const selectedBattle = modal?.type === 'battle' || modal?.type === 'battle-note' ? state.battles.find(b => b.id === modal.id) : undefined;
  const selectedNote = modal?.type === 'battle-note' ? state.battleNotes?.find(note => note.battleId === modal.id) : undefined;
  const modalTitle = modal?.type === 'talk' ? (modal.remote ? '远程联络' : '灯下私语') : modal?.type === 'girl' ? '契约者详细档案' : modal?.type === 'wardrobe' ? '衣柜与礼装' : modal?.type === 'expression' ? '表情差分管理' : modal?.type === 'witch-form' ? '魔女化立绘' : modal?.type === 'mission' ? '委托详情与派遣' : modal?.type === 'settings' ? '游戏设置' : modal?.type === 'presets' ? '对话补全预设' : modal?.type === 'help' ? '夜班操作手册' : modal?.type === 'notifications' ? '事务所通知' : modal?.type === 'reset' ? '重置进度确认' : modal?.type === 'hire' ? '缔结契约' : modal?.type === 'build' ? '建造与扩建' : modal?.type === 'room' ? '基地房间详情' : modal?.type === 'battle' ? '战斗剧场' : modal?.type === 'codex' ? '魔物图鉴' : modal?.type === 'memorial' ? '星光纪念墙' : modal?.type === 'custom' ? '契约登记' : modal?.type === 'chronicle' ? '使魔编年史' : modal?.type === 'faction' ? `查看${factionInfo[modal.id].name}档案` : modal?.type === 'office' ? '事务所档案' : '安排派遣';
  const stabilityStage = cityStage(state.reputation);

  return <div className="app-shell">
    {!started && <StartDialog onStandard={markStarted} onBlank={() => { setState(act(state, { type: 'reset', mode: 'blank' }).state); markStarted(); }} />}
    <a id="skip-main-content" className="skip-link" href="#main-content">跳转到主要内容</a>
    <Navigation page={page} onPage={navigate} onHelp={() => setModal({ type: 'help' })} onSettings={() => setModal({ type: 'settings' })} onCodex={() => setModal({ type: 'codex' })} onMemorial={() => setModal({ type: 'memorial' })} onWorkshop={() => setModal({ type: 'workshop' })} memorialCount={state.memorial.length} />
    <Topbar state={state} saved={saved} onNotifications={() => setModal({ type: 'notifications' })} onCommand={() => setCmdOpen(true)} />
    <main id="main-content" className={`app-main page-${page}`}>
      {page === 'dispatch' ? <>
        <PageHeading page={page}><div className="shift-badge"><span className="signal-dot" /><span>夜班契约进行中</span><small>第 014 号值班席 · 灵魂天平</small></div></PageHeading>

        {/* 主页：城市安定度与三方势力态度并列栏 */}
        <section className="dispatch-world-strip" aria-label="城市安定度与三方势力态度">
          <div className="world-stability-box">
            <div className="world-stability-head">
              <ShieldCheck size={16} />
              <span>城市安定度 · <b>{stabilityStage.name}</b></span>
              <strong>{state.reputation}<small>/100</small></strong>
            </div>
            <div className="world-stability-bar">
              <i style={{ width: `${Math.min(100, state.reputation)}%` }} />
            </div>
            <p>{stabilityStage.note} {state.boss ? '· 城市级威胁「空月」在场（每3小时 −1 安定）' : `· 下次周期天灾：第 ${state.nextBossDay} 日`}</p>
          </div>
          <div className="world-factions-box" role="group" aria-label="三方势力对事务所的态度">
            {factionOrder.map(fid => {
              const info = factionInfo[fid];
              const standing = state.factions?.[fid]?.standing ?? 0;
              const att = factionAttitude(standing);
              const taskDone = Boolean(state.factions?.[fid]?.envoyTaskId);
              const hottest = hostilityOf(state, fid).find(item => item.track.value >= 90);
              return (
                <button
                  key={fid}
                  id={`dispatch-faction-${fid}`}
                  type="button"
                  className={`world-faction-card tone-${att.tone}`}
                  style={{ '--faction-color': info.color } as React.CSSProperties}
                  onClick={() => setModal({ type: 'faction', id: fid })}
                  title={`查看${info.name}档案`}
                >
                  <div className="world-faction-top">
                    <span className="world-faction-seal">{info.short}</span>
                    <div>
                      <strong>{info.name}</strong>
                      <small>代表：{info.envoy}</small>
                    </div>
                    <span className="world-faction-attitude">{att.label}</span>
                    {hottest && <span className="world-faction-war" id={`faction-war-${fid}`}>临战 {hottest.track.value}</span>}
                  </div>
                  <div className="world-faction-meter">
                    <i style={{ width: `${Math.min(100, standing)}%` }} />
                  </div>
                  <div className="world-faction-foot">
                    <span>声望 <b>{standing}</b>/100 · {att.discount}</span>
                    <em>{taskDone ? '今日已派发' : '来使待命'}</em>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <TaskPanel state={state} onOpen={openTask} onNavigate={() => navigate('base')} />
        <div className="dispatch-layout">
          <DispatchMap state={state} onMission={id => setModal({ type: 'mission', id })} onFront={id => setModal({ type: 'front', id })} onDropGirl={(girlId, id) => setModal({ type: 'mission', id, girlId })} />
          <Roster state={state} onGirl={girl} onMarket={() => navigate('market')} />
        </div>
        <div className="night-notes">
          <button id="story-open-conversation" className="story-note" onClick={() => talk('yue')}><span className="note-icon"><Heart size={21} /></span><div><span className="eyebrow">留给你的话</span><h3>「任务结束后，要一起看星星吗？」</h3><p>{state.girls.find(g => g.id === 'yue')?.status === 'mission' ? '这句话，留给她归来后的夜晚。' : '月见桃在基地等你，想听听今晚的故事。'}</p></div><ArrowUpRight size={20} /></button>
          <button id="open-night-brief" className="brief-note" onClick={() => setModal({ type: 'codex' })}><span className="note-icon"><Radio size={21} /></span><div><span className="eyebrow">夜间速报 · 城市心跳</span><h3>末班列车，即将离站。</h3><p>{state.missions.find(m => m.id === 'station')?.status === 'open' ? '月台出现异常信号与两只魔物。查看图鉴，再决定编队。' : '最新委托进展已同步到感应地图与魔物图鉴。'}</p></div><ArrowRight size={18} /></button>
        </div>
      </> : page === 'base' ? (
        <>
        <TaskPanel state={state} onOpen={openTask} onNavigate={() => navigate('base')} />
        <BaseView
          state={state}
          onRoom={id => setModal({ type: 'room', id })}
          onBuild={() => setModal({ type: 'build', id: 'dorm' })}
          onGirl={girl}
          onTalk={talk}
          onStartExpedition={ids => perform({ type: 'startExpedition', memberIds: ids })}
          onRecallExpedition={id => perform({ type: 'recallExpedition', expeditionId: id })}
          onDecide={(opinionId, decision) => perform({ type: 'decideOpinion', opinionId, decision })}
          onAcceptTask={faction => perform({ type: 'acceptFactionTask', faction })}
          onClinic={(girlId, mode, kink) => perform({ type: 'clinic', girlId, mode, kink })}
          onCare={(girlId, mode) => perform({ type: 'care', girlId, mode })}
          onAssistant={girlId => perform({ type: 'setAssistant', girlId })}
          onUseItem={(girlId, itemId) => perform({ type: 'useItem', girlId, itemId })}
          onCouncil={() => navigate('council')}
          onOffice={() => setModal({ type: 'office' })}
        />
        </>
      ) : page === 'worldbook' ? (
        <>
          <PageHeading page="worldbook" />
          <WorldbookView onOpenOffice={() => setModal({ type: 'office' })} />
        </>
      ) : page === 'council' ? (
        <CouncilView state={state} onDecide={(opinionId, decision) => perform({ type: 'decideOpinion', opinionId, decision })} onGirl={girl} />
      ) : page === 'market' ? (
        <MarketView state={state} onGirl={girl} onHire={id => setModal({ type: 'hire', id })} onRemote={id => talk(id, true)} onImportCard={importCard} onRehire={id => perform({ type: 'rehire', girlId: id })} onBuyItem={(itemId, stockId) => perform({ type: 'buyItem', itemId, stockId })} onRenew={id => perform({ type: 'renewContract', girlId: id })} onUpgradeMarket={() => perform({ type: 'upgradeMarket' })} onAdvancedRecruit={level => perform({ type: 'advancedRecruit', level })} onCustom={() => setModal({ type: 'custom' })} />
      ) : (
        <RecordsView state={state} onBattle={id => setModal({ type: 'battle', id })} onBattleNote={openBattleNote} onChronicle={() => setModal({ type: 'chronicle' })} onCodex={() => setModal({ type: 'codex' })} onGirl={girl} />
      )}
      <footer className="game-footer"><span><Moon size={12} />愿每个心愿，都有回声。<i />夜糖事务所 · 灵魂契约台账</span><button id="footer-prototype-info" onClick={() => setModal({ type: 'help' })}>纯前端原型<span>本地剧情演示</span><ChevronRight size={11} /></button></footer>
    </main>
    <div className="time-control-bar">
      <div className="shift-clock">
        <Clock3 size={15} />
        <div>
          <span>第 {state.day} 日 · <b>{clockLabel(state.minutes)}</b></span>
          <small>{phaseLabel[shiftPhase(state.minutes)]}{minutesToClose(state.minutes) > 0 ? ` · ${leftLabel(minutesToClose(state.minutes))}` : ' · 已打烊'}</small>
        </div>
      </div>
      <div className="time-actions">
        <button id="toggle-auto-time" className={`auto-time-btn ${auto ? 'active' : ''}`} aria-pressed={auto} onClick={() => setAuto(x => !x)}>{auto ? <Pause size={13} /> : <Play size={13} />}<span>{auto ? '暂停自动' : '自动推进'}</span></button>
        <button id="advance-time-30" className="advance-btn" onClick={() => perform({ type: 'advance', minutes: 30 })}>推进 30 分钟<FastForward size={15} /></button>
        <button id="end-night" className="end-night-btn" onClick={() => setModal({ type: 'end-night' })}>前往下一天<ChevronsRight size={15} /></button>
      </div>
    </div>
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">{toast && <div className={`game-toast ${toast.ok ? '' : 'warning'}`} key={toast.id}>{toast.ok ? <Check size={18} /> : <Info size={18} />}<p>{toast.message}</p><button id="dismiss-toast" onClick={() => setToast(null)} aria-label="关闭提示"><X size={15} /></button></div>}</div>
    {modal && modal.type !== 'event' && modal.type !== 'story-graph' && modal.type !== 'workshop' && modal.type !== 'battle-note' && <Dialog label={modalTitle} onClose={() => setModal(modal.type === 'expression' || modal.type === 'witch-form' ? { type: 'girl', id: modal.id } : null)} wide={modal.type === 'girl' || modal.type === 'talk' || modal.type === 'battle' || modal.type === 'codex' || modal.type === 'memorial' || modal.type === 'custom' || modal.type === 'chronicle' || modal.type === 'presets' || modal.type === 'wardrobe' || modal.type === 'expression' || modal.type === 'witch-form' || modal.type === 'faction' || modal.type === 'office'}>
      {modal.type === 'girl' && selectedGirl && <CharacterDialog key={`girl-${selectedGirl.id}`} girl={selectedGirl} state={state} onCare={mode => perform({ type: 'care', girlId: selectedGirl.id, mode })} onTalk={() => talk(selectedGirl.id)} onAssign={() => setModal({ type: 'assign', id: selectedGirl.id })} onHire={() => setModal({ type: 'hire', id: selectedGirl.id })} onRetire={() => { if (perform({ type: 'retire', girlId: selectedGirl.id })) setModal(null); }} onClinic={(mode, kink) => perform({ type: 'clinic', girlId: selectedGirl.id, mode, kink })} onAssistant={() => perform({ type: 'setAssistant', girlId: state.assistantId === selectedGirl.id ? undefined : selectedGirl.id })} onRemote={() => talk(selectedGirl.id, true)} onRenew={() => perform({ type: 'renewContract', girlId: selectedGirl.id })} onRehire={() => perform({ type: 'rehire', girlId: selectedGirl.id })} onChangeOutfit={outfitId => perform({ type: 'changeOutfit', girlId: selectedGirl.id, outfitId })} onExpression={expression => perform({ type: 'setExpression', girlId: selectedGirl.id, expression })} onExpressionVariants={() => setModal({ type: 'expression', id: selectedGirl.id })} onWardrobe={() => setModal({ type: 'wardrobe', id: selectedGirl.id })} onStory={() => startStory(selectedGirl.id)} onStoryBlueprint={() => void generateBlueprint(selectedGirl.id)} onStoryRegenerate={() => { if (window.confirm('重新生成会覆盖当前蓝图，确定吗？')) void generateBlueprint(selectedGirl.id); }} onStoryGraph={() => { setStoryNotice(null); setModal({ type: 'story-graph', id: selectedGirl.id }); }} storyBusy={storyBusy === selectedGirl.id}
          onStoryMission={(missionId) => setModal({ type: 'mission', id: missionId })} onStoryChoice={(storylineId, beatId, choiceId) => perform({ type: 'decideStoryChoice', storylineId, beatId, choiceId })} onStoryPort={(storylineId, port) => perform({ type: 'chooseStoryPort', storylineId, port })} onEvent={() => void startEvent(selectedGirl.id)} onWitch={() => { if (selectedGirl.witch) perform({ type: 'setWitchForm', girlId: selectedGirl.id, outfit: null }); else if (selectedGirl.witchForm) perform({ type: 'setWitchForm', girlId: selectedGirl.id, outfit: selectedGirl.witchForm }); else setModal({ type: 'witch-form', id: selectedGirl.id }); }} onWitchForm={() => setModal({ type: 'witch-form', id: selectedGirl.id })} onWitchFile={file => setModal({ type: 'witch-form', id: selectedGirl.id, portraitFile: file })} onPersonality={text => perform({ type: 'setPersonality', girlId: selectedGirl.id, text })} onEquip={(itemId, slot) => perform({ type: 'equipItem', girlId: selectedGirl.id, itemId, slot })} onUnequip={slot => perform({ type: 'unequipItem', girlId: selectedGirl.id, slot })} onUseItem={itemId => perform({ type: 'useItem', girlId: selectedGirl.id, itemId })} onExportCard={() => exportCard(selectedGirl)} />}
      {modal.type === 'wardrobe' && selectedGirl && <WardrobeDialog girl={selectedGirl} state={state} onImport={(outfits, mode) => perform({ type: 'importWardrobe', girlId: selectedGirl.id, outfits, mode })} onRemove={outfitId => perform({ type: 'removeOutfit', girlId: selectedGirl.id, outfitId })} onDescribe={describeOutfit} onDescribeSaved={(outfitId, description) => perform({ type: 'setOutfitDescription', girlId: selectedGirl.id, outfitId, description })} onClose={() => setModal({ type: 'girl', id: selectedGirl.id })} />}
      {modal.type === 'expression' && selectedGirl && <ExpressionVariantDialog key={`expression-${selectedGirl.id}`} girl={selectedGirl} onSave={(key, dataUrl) => perform({ type: 'setVariant', girlId: selectedGirl.id, key, dataUrl })} onSaveMany={variants => perform({ type: 'setVariants', girlId: selectedGirl.id, variants })} onRemove={key => perform({ type: 'deleteVariant', girlId: selectedGirl.id, key })} onClose={() => setModal({ type: 'girl', id: selectedGirl.id })} />}
      {modal.type === 'witch-form' && selectedGirl && <WitchFormDialog key={`witch-form-${selectedGirl.id}`} girl={selectedGirl} initialFile={modal.portraitFile} onSave={(outfit, personality) => perform({ type: 'setWitchForm', girlId: selectedGirl.id, outfit, personality, activate: false })} onDescribe={portrait => describeWitchForm(selectedGirl, portrait)} onRemove={() => perform({ type: 'clearWitchForm', girlId: selectedGirl.id })} onClose={() => setModal({ type: 'girl', id: selectedGirl.id })} />}
      {modal.type === 'mission' && selectedMission && <MissionDialog key={`${modal.id}-${modal.girlId ?? ''}`} state={state} mission={selectedMission} initialGirlId={modal.girlId} onGirl={girl} onEnemy={id => setModal({ type: 'codex', id })} onBattle={id => setModal({ type: 'battle', id })} onDispatch={(girlIds, missionId) => { if (perform({ type: 'dispatch', girlIds, missionId })) setModal(null); }} />}
      {modal.type === 'talk' && selectedGirl && <Conversation key={`talk-${selectedGirl.id}`} girl={selectedGirl} state={state} remote={modal.remote} modelEnabled={llmHasKey()} onSend={text => sendTalk(selectedGirl.id, text, modal.remote)} />}
      {modal.type === 'assign' && <AssignmentPicker state={state} girlId={modal.id} onSelect={id => setModal({ type: 'mission', id, girlId: modal.id })} />}
      {modal.type === 'hire' && selectedGirl && <HireDialog girl={selectedGirl} state={state} onConfirm={() => { if (perform({ type: 'hire', girlId: selectedGirl.id })) setModal(null); }} />}
      {modal.type === 'build' && <BuildDialog state={state} initialRoom={modal.id} onConfirm={roomId => { if (perform({ type: 'build', roomId })) setModal(null); }} />}
      {modal.type === 'room' && <RoomDialog state={state} id={modal.id} onGirl={girl} onTalk={talk} onBuild={() => setModal({ type: 'build', id: modal.id })} onDecide={(opinionId, decision) => perform({ type: 'decideOpinion', opinionId, decision })} onStartExpedition={ids => perform({ type: 'startExpedition', memberIds: ids })} onRecall={id => perform({ type: 'recallExpedition', expeditionId: id })} onClinic={(girlId, mode, kink) => perform({ type: 'clinic', girlId, mode, kink })} onRest={girlId => perform({ type: 'care', girlId, mode: 'resting' })} onAcceptTask={faction => perform({ type: 'acceptFactionTask', faction })} />}
      {modal.type === 'battle' && selectedBattle && <BattleReport key={selectedBattle.id} battle={selectedBattle} hasNote={Boolean(state.battleNotes?.some(note => note.battleId === selectedBattle.id))} onNote={() => openBattleNote(selectedBattle.id)} onClose={() => setModal(null)} />}
      {modal.type === 'codex' && <CodexDialog initialId={modal.id} extra={state.customMonsters} />}
      {modal.type === 'faction' && <FactionDialog state={state} faction={modal.id} onBase={() => { setModal(null); navigate('base'); }} onClose={() => setModal(null)} />}
      {modal.type === 'office' && <OfficeDialog profile={state.office} girls={state.girls} assistantId={state.assistantId} onSave={profile => { if (perform({ type: 'setOfficeProfile', profile })) setModal(null); }} onAssistant={girlId => perform({ type: 'setAssistant', girlId })} onClose={() => setModal(null)} />}
      {modal.type === 'chronicle' && <ChronicleDialog state={state} />}
      {modal.type === 'memorial' && <MemorialDialog state={state} />}
      {modal.type === 'custom' && <CustomGirlDialog onGenerate={draftGirlProfile} onCreate={draft => { if (perform({ type: 'createGirl', draft })) setModal(null); }} />}
      {modal.type === 'settings' && <SettingsDialog state={state} reduced={reduced} onReduced={setReduced} onExport={exportSave} onImport={importSave} onReset={() => setModal({ type: 'reset' })} onPoolLimit={(pool, value) => perform({ type: 'setPoolLimit', pool, value }, true)} onDeleteMission={missionId => perform({ type: 'deleteMission', missionId })} onDeleteCandidate={girlId => perform({ type: 'deleteCandidate', girlId })} onDeleteMonster={monsterId => perform({ type: 'deleteMonster', monsterId })} onGenerate={generateContent} autoGenerate={autoGenerate} onAutoGenerate={setAutoGenerate} onPresets={openPresetScope} />}
      {modal.type === 'presets' && <PresetDialog initialScope={modal.scope} initialPresetId={modal.presetId} presets={presets} binding={binding} onPresets={setPresets} onBinding={setBinding} onNotify={notify} />}
      {modal.type === 'help' && <HelpDialog />}{modal.type === 'notifications' && <NotificationsDialog state={state} />}{modal.type === 'reset' && <ResetDialog onConfirm={() => { perform({ type: 'reset' }); setAuto(false); setModal(null); }} />}
    </Dialog>}
      {modal?.type === 'battle-note' && selectedBattle && <BattleNoteDialog battle={selectedBattle} note={selectedNote ?? null} girls={state.girls} busy={noteBusy} error={noteError} onGenerate={() => void writeBattleNote(selectedBattle)} onRegenerate={() => void writeBattleNote(selectedBattle)} onClose={() => { setModal({ type: 'battle', id: selectedBattle.id }); setNoteError(undefined); }} />}
      {modal?.type === 'story-graph' && selectedGirl && (
        <StoryGraphDialog
          girl={selectedGirl}
          incidents={library.incidents}
          notice={storyNotice ?? undefined}
          onClose={() => { setStoryNotice(null); setModal({ type: 'girl', id: selectedGirl.id }); }}
          onSave={(graph, meta) => {
            const base = selectedGirl.storyPlan ?? storyPlanTemplate(`${selectedGirl.name}的故事`, '');
            const plan: StoryPlan = { ...base, graph, ...(meta ?? {}) };
            if (!perform({ type: 'setStoryPlan', girlId: selectedGirl.id, plan }, true)) return;
            setStoryNotice(null);
            setModal({ type: 'girl', id: selectedGirl.id });
            notify(`蓝图已保存：${graph.nodes.length} 个节点、${graph.nodes.filter(node => node.kind === 'end').length} 个结局。`);
          }}
        />
      )}
      {modal?.type === 'workshop' && (
        <ContentWorkshopDialog
          state={state}
          library={library}
          onClose={() => setModal(null)}
          onNotify={notify}
          onDeployMission={template => {
            const mission = deployMissionTemplate(state, template);
            setState(current => ({
              ...current,
              missions: [mission, ...current.missions],
              logs: [{
                id: `log-workshop-${mission.id}`,
                time: dateLabel(current.day, current.minutes),
                kind: 'dispatch' as const,
                text: `内容工坊投放了「${mission.title}」，它已经出现在今夜的地图上。`,
              }, ...current.logs],
            }));
            notify(`「${mission.title}」已投放到今夜的地图。`);
          }}
          onDeployIncident={card => {
            const incident = deployIncidentCard(state, card);
            setState(current => ({
              ...current,
              incidents: [incident, ...current.incidents],
              logs: [{
                id: `log-workshop-${incident.id}`,
                time: dateLabel(current.day, current.minutes),
                kind: 'incident' as const,
                text: `内容工坊投放了「${incident.title}」。`,
              }, ...current.logs],
            }));
            setModal(null);
            notify(`「${incident.title}」已经弹出。`);
          }}
          onCommit={next => {
            setLibrary(next);
            setState(current => ({ ...current, marketStock: withCustomStock(current.marketStock) }));
          }}
        />
      )}
    {pendingProposal && <Dialog label="今晚的提案" onClose={() => { if (!generating) setPendingProposal(null); }} wide>
      <ProposalDialog state={state} proposal={pendingProposal} busy={generating} onAccept={acceptProposal} onDiscard={() => setPendingProposal(null)} onRegenerate={() => { void generateContent('manual').then(result => { if (!result.ok) notify(result.message, false); }); }} />
    </Dialog>}
    <LlmConsole />
    {cmdOpen && <CommandConsole onRun={runCommand} onClose={() => setCmdOpen(false)} />}
    {!pendingIncident && shelfIncidents.length > 0 && (
      <div className="incident-tray" id="incident-tray">
        <span className="incident-tray-label">桌上还压着 {shelfIncidents.length} 件事</span>
        {shelfIncidents.slice(0, 3).map(incident => (
          <button key={incident.id} type="button" id={`incident-open-${incident.id}`} className="incident-tray-item" onClick={() => setIncidentFocus(incident.id)}>{incident.title}</button>
        ))}
      </div>
    )}
    {modal?.type === 'front' && (() => {
      const front = state.fronts.find(item => item.id === modal.id);
      if (!front) return null;
      return <Dialog label="势力之间的战线" onClose={() => setModal(null)} wide>
        <FrontDialog front={front} state={state} onJoin={(side, girlIds) => { perform({ type: 'joinFront', frontId: front.id, side, girlIds }); }} onClose={() => setModal(null)} />
      </Dialog>;
    })()}
    {pendingIncident && <IncidentDialog incident={pendingIncident} state={state} onChoose={optionId => { perform({ type: 'resolveIncident', incidentId: pendingIncident.id, ...(optionId ? { optionId } : {}) }); setIncidentFocus(null); }} onGirl={girl} />}
    {modal?.type === 'event' && (() => {
      const target = state.events.find(event => event.id === modal.id);
      if (!target) return null;
      const subject = state.girls.find(item => item.id === target.girlId);
      if (target.mode === 'story') return <div className="story-overlay"><StoryPlayerDialog event={target} girl={subject} busy={arcBusy === target.id} onChoose={(eventId, choiceId) => perform({ type: 'chooseStoryPassage', eventId, choiceId })} onClose={() => setModal(null)} /></div>;
      return <div className="story-overlay"><EventDialog event={target} girl={subject} onAdvance={eventId => perform({ type: 'advanceEvent', eventId })} onChoose={(eventId, choiceId) => perform({ type: 'resolveEvent', eventId, choiceId })} onClose={() => setModal(null)} /></div>;
    })()}
    {modal?.type === 'end-night' && <Dialog label="打烊与交接" onClose={() => setModal(null)}>
      <div className="standard-modal end-night-modal">
        <div className="modal-eyebrow"><Moon size={14} />营业结束 / 前往下一天</div>
        <h2>把今晚折好，放进抽屉里吗？</h2>
        <p className="muted">事务所 20:00 开门、次日 02:00 打烊，午夜之后仍算同一夜。确认后会结算今晚，未完成的紧急委托会作废，长期委托统一归档；契约者会休息到第二天傍晚，疲劳 −12、精神力 +20。</p>
        <div className="confirmation-facts">
          <span>今晚<b>第 {state.day} 日 · {clockLabel(state.minutes)}</b></span>
          <span>待处理委托<b>{state.missions.filter(m => m.status === 'open').length} 件</b></span>
          <span>下一天<b>第 {state.day + 1} 日 20:00</b></span>
        </div>
        <div className="confirmation-facts">
          <span>出勤中<b>{state.girls.filter(g => g.status === 'mission').length} 人（会顺延到明晚）</b></span>
          <span>星砂<b>{state.gold.toLocaleString('zh-CN')}</b></span>
          <span>安定度<b>{state.reputation}/100</b></span>
        </div>
        <div className="settings-data-actions">
          <button id="end-night-confirm" className="btn primary" onClick={() => { if (perform({ type: 'endNight' })) { setModal(null); setAuto(false); } }}>打烊，前往第 {state.day + 1} 日</button>
          <button id="end-night-cancel" className="btn" onClick={() => setModal(null)}>再守一会儿</button>
        </div>
      </div>
    </Dialog>}
    {pendingSave && <Dialog label="导入存档确认" onClose={() => setPendingSave(null)}>
      <div className="standard-modal import-save-modal">
        <div className="modal-eyebrow"><ShieldCheck size={14} />存档恢复 / 覆盖确认</div>
        <h2>要回到那个夜晚吗？</h2>
        <p className="muted">导入会把当前进度替换为第 {pendingSave.day} 日、{pendingSave.girls.length} 位契约者、{pendingSave.gold.toLocaleString('zh-CN')} 星砂的存档。当前进度尚未自动备份，建议先取消并导出。</p>
        <div className="confirmation-facts">
          <span>目标日期<b>第 {pendingSave.day} 日</b></span>
          <span>契约者<b>{pendingSave.girls.length} 人</b></span>
          <span>星砂<b>{pendingSave.gold.toLocaleString('zh-CN')}</b></span>
        </div>
        <div className="settings-data-actions">
          <button id="import-save-confirm" className="btn primary" onClick={() => { setState(pendingSave); setPendingSave(null); notify(`已载入第 ${pendingSave.day} 日的存档。`); }}>确认覆盖并继续</button>
          <button id="import-save-cancel" className="btn" onClick={() => setPendingSave(null)}>取消</button>
        </div>
      </div>
    </Dialog>}
  </div>;
}
