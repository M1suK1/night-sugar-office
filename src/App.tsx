import { postLlmLog, setLlmLogSink } from './llmLog';
import { assetUrl } from './store';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock3, FastForward, Feather, Pause, Play, Radio, TriangleAlert, X, Info, Moon, ChevronRight, ShieldCheck, ChevronsRight } from 'lucide-react';
import type { BattleState, CharacterEvent, CityNews, FactionId, GameAction, GameState, Girl, GirlCard, StoryLine, StoryPassage, StoryPlan, Storyline, StoryTurn } from './types';
import { act, buildTemplateArc, canAcceptGeneratedContent, dateLabel, deployIncidentCard, deployMissionTemplate, importState, loadState } from './game';
import { kvSet, storeAvailable } from './store';
import { loadChimeEnabled, playChime, resolveChime, saveChimeEnabled } from './audio';
import { shouldAutoGenerate } from './autoGenerate';
import { planForSlot } from './storyplan';
import { shouldAutoOpenStory } from './storySession';
import { loadProposalCheck, saveProposalCheck, type ProposalCheckMode } from './proposalCheck';
import { portraitMissing } from './portraitReload';
import { loadLlmLog, onLlmFinished, type LlmLogEntry } from './llm';
import { SAVE_CURRENT_KEY, bootState } from './migrate';
import { cityStage, factionAttitude } from './economy';
import { factionInfo } from './content/items';
import { representativeNameOf } from './factions';
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
import { EnvoyPreviewDialog } from './components/EnvoyPreviewDialog';
import { MeetingPlanDialog } from './components/MeetingPlanDialog';
import { MeetingRecordsDialog } from './components/MeetingRecordsDialog';
import { NewsDialog } from './components/NewsDialog';
import { NewsTicker } from './components/NewsTicker';
import { StoryArchiveDialog } from './components/StoryArchiveDialog';
import { replayEventOf, saveStoryToArchive, type ArchivedStory } from './storyArchive';
import { EndingDialog } from './components/EndingDialog';
import { newlyFinishedStories, storylineStatuses, type EndingNotice } from './storylineEnding';
import { meetEventId } from './rules/summon';
import { diagnoseVariants, recoverVariants } from './variantRecovery';
import { OfficeDialog } from './components/OfficeDialog';
import { ChronicleDialog } from './components/ChronicleDialog';
import { buildGirlCard, girlCardFileName, optimizeCardImages, parseGirlCard } from './cards';
import { slimStateImages } from './imageSlim';
import { resizeImageFile, yieldToGC } from './image';
import { taskRuntime } from './llm';
import { incidentPoolNeed } from './incidents.ts';
import { generateBattleNote, generateCityNews, generateDaily, generateDialogue, generateEvent, generateGirlProfile, generateIncidentBatch, generateOutfitDescription, generateStoryArc, generateStoryBlueprint, generateStoryEnding, generateStoryOpening, generateStoryTurn, generateWhisper, generateWitchFormProfile, llmHasKey, loadLlmConfig, localSessionSummary, type GirlResearch } from './llm';
import { newsCastPool, newsIsStale, OPENING_NEWS_DAY, openingCityNews } from './cityNews';
import { localCityNews } from './cityNewsLocal';
import { loadBalance } from './balance';
import { loadPlayerProfile } from './player';
import { loadResearchPrefs, normalizeResearchQuery, researchCharacter } from './research';
import { activePersonality } from './personality';
import { materializeNightProposal } from './llm-night';
import { ProposalDialog, type PendingProposal } from './components/ProposalDialog';
import { boundPreset, duplicatePreset, ensureTaskPresets, hydratePresetsFromStore, loadBinding, loadPresets, promptScopeLabel, saveBinding, savePresetBindingToStore, savePresets, savePresetsToStore, syncVnPrompts, PROMPT_TASK_SCOPES, TASK_PRESET_MARKER, type ChatPreset, type PresetBinding, type PromptScope, type PromptTask } from './presets';
import { clockLabel, minutesToClose, phaseLabel, shiftPhase } from './shift';
import { LlmConsole } from './components/LlmConsole';
import { PresetDialog } from './components/PresetDialog';
import { WardrobeDialog } from './components/WardrobeDialog';
import { ExpressionVariantDialog } from './components/ExpressionVariantDialog';
import { WitchFormDialog } from './components/WitchFormDialog';
import { CommandConsole } from './components/CommandConsole';
import { CouncilView } from './components/CouncilView';
import { IncidentDialog } from './components/IncidentDialog';
import { blockingIncidents, openIncidentFor } from './incidents';
import { pendingChoiceOf } from './rules/storyChoice';
import { finishedSessionEvents } from './rules/storyEvent';
import { loadPointsMuted, pointsKey, savePointsMuted, shouldShowPointBadge } from './points';
import { loadVnStory, saveVnStory, type VnStoryMode } from './vnPrefs';
import { dismissToast, expireToasts, pushToast } from './toasts';
import { hostilityOf } from './hostility';
import { EventDialog, type StoryCastPerson } from './components/EventDialog';
import { StoryPlayerDialog } from './components/StoryPlayerDialog';
import { StoryGraphDialog } from './components/StoryGraphDialog';
import { fallbackStoryPlan, storyPlanTemplate } from './storyplan';
import { TitleDialog } from './components/TitleDialog';
import { PrologueDialog } from './components/PrologueDialog';
import { prologueFor } from './prologue';
import { OPENING_CARDS, openingGaps } from './opening';
import { cardFileGuard, saveFileGuard } from './fileLimits';
import { marketCardGap, marketNeedsCards, unusedCards, usedCardIds } from './cardMarket';
import { planCardBatches } from './cardImport';
import type { CardBoxEntry } from './cardbox';
import { CardLibraryDialog } from './components/CardLibraryDialog';
import { SaveSlotsDialog } from './components/SaveSlotsDialog';
import { clearSlot, readSlot, writeSlot, type SaveSlotId } from './saves';
import { extractStatePortraits, hydrateStatePortraits } from './portraitAssets';
import { storyPersonOf } from './storySubject';
import { backfillPortraits } from './portraitBackfill';
import { cardboxCards, loadCardBox, readCardRaw, saveCardBox } from './cardbox';
import { LIBRARY_START_ROSTER, normalizeToLevel, readLibraryCards } from './cardLibrary';
import { STARTER_COUNT, factionSnapshotFromCards } from './roster';
import { backfillFactionDescriptions, rosterDescriptionsMissing } from './rosterBackfill';
import { factionSeatsMissing } from './factions';
import { StarterDialog } from './components/StarterDialog';
import { StarterLoading } from './components/StarterLoading';
import { ContentWorkshopDialog } from './components/workshop/ContentWorkshopDialog';
import { loadLibrary, withCustomStock, type ContentLibrary } from './content/library';
import { districtOrder, districts, effectLines } from './districts';
import { representativeOf } from './office';
import { syncBuiltinWorldbook, syncOfficeWorldbook } from './worldbook';
import { downloadFile, readLocalFile, shortPath, writeLocalFile } from './localfiles';
import './styles.css';
import './combat.css';

type Modal =
  | { type: 'girl' | 'assign' | 'hire' | 'room' | 'build' | 'wardrobe' | 'expression' | 'witch-form'; id: string; portraitFile?: File }
  | { type: 'talk'; id: string; remote?: boolean }
  | { type: 'mission'; id: string; girlId?: string }
  | { type: 'front'; id: string }
  | { type: 'cardbox' }
  | { type: 'slots'; boot?: boolean }
  | { type: 'starter' }
  | { type: 'battle'; id: string }
  | { type: 'battle-note'; id: string }
  | { type: 'event'; id: string }
  | { type: 'story'; id: string }
  | { type: 'story-graph'; id: string; slot?: number }
  | { type: 'codex'; id?: string }
  | { type: 'presets'; scope?: PromptScope; presetId?: string }
  | { type: 'settings'; boot?: boolean }
  | { type: 'help' | 'notifications' | 'reset' | 'memorial' | 'custom' | 'chronicle' | 'end-night' | 'workshop' }
  | { type: 'faction'; id: FactionId }
  | { type: 'envoy'; id: FactionId }
  | { type: 'meeting-plan' }
  | { type: 'meeting-records' }
  | { type: 'news' }
  | { type: 'stories' }
  | { type: 'office' };

/** 开场相位：标题页 → 编成 → 序章 → 正片。 */
type BootPhase = 'title' | 'roster' | 'prologue' | 'play';

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
  const urgent = open.filter(m => m.boss || m.difficulty === '高危' || m.difficulty === '绝望').length;
  const bossMission = state.boss ? state.missions.find(m => m.id === state.boss?.missionId) : undefined;
  const boss = bossMission ? `周期魔物正在城内，相关委托「${bossMission.title}」尚未解决。` : '当前没有周期魔物。';
  const standings = factionOrder.map(id => `${factionInfo[id].name} ${state.factions[id].standing}`).join('，');
  const recent = state.chronicle.slice(0, 4).map(entry => entry.title).join('、') || '尚无';
  return `第 ${state.day} 日 ${clockLabel(state.minutes)}，星砂 ${state.gold}，城市安定度 ${state.reputation}。待处理委托 ${open.length} 条（高危 ${urgent} 条），${boss}势力声望：${standings}。最近编年史：${recent}。`;
}

/** 等一张图真的解码完，进度条才不会骗人。 */
function preloadImage(url: string): Promise<void> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

export default function App() {
  // 初始先给一份空档占位，真正的进度在挂载后从 IndexedDB 读出来。
  const [state, setState] = useState<GameState>(() => loadState(null));
  const hydratedRef = useRef(false);
  const [booted, setBooted] = useState(false);
  /** 存档真的读完了才算数：否则「编成守卫」会拿默认空档把刚存好的进度踢回编成。 */
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<Page>('dispatch');
  const [modal, setModal] = useState<Modal | null>(null);
  const [library, setLibrary] = useState<ContentLibrary>(loadLibrary);
  const [toasts, setToasts] = useState<{ message: string; ok: boolean; id: number; createdAt: number }[]>([]);
  const toastSeq = useRef(0);
  const [auto, setAuto] = useState(false);
  const [saved, setSaved] = useState(true);
  const [pendingSave, setPendingSave] = useState<GameState | null>(null);
  /** 当前真正生效的状态引用：异步任务（比如读档后的图片降维）回来时用它做冲突判断。 */
  const stateRef = useRef(state);
  const [reduced, setReduced] = useState(readReduced);
  const [chime, setChime] = useState(loadChimeEnabled);
  const [autoGenerate, setAutoGenerate] = useState(readAutoGenerate);
  const [presets, setPresets] = useState<ChatPreset[]>(loadPresets);
  const [binding, setBinding] = useState<PresetBinding>(loadBinding);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [incidentFocus, setIncidentFocus] = useState<string | null>(null);
  /** 关掉的加点提醒：键是「人:点数」，升级发新点数后会重新出现。 */
  const [pointsMuted, setPointsMuted] = useState<string[]>(loadPointsMuted);
  const mutePoints = (girlId: string, points: number) => {
    const next = [...pointsMuted.filter(key => !key.startsWith(`${girlId}:`)), pointsKey(girlId, points)];
    setPointsMuted(next);
    savePointsMuted(next);
  };
  /** 提案审查力度：严格会整份作废，宽松就地修好驳回。 */
  const [proposalCheck, setProposalCheck] = useState<ProposalCheckMode>(loadProposalCheck);
  /** 上一次提案失败的原文：留着给「重新生成」按钮用。 */
  const [proposalError, setProposalError] = useState<string | null>(null);
  /** 开局读卡进度：null 表示没在读。 */
  const [starterLoad, setStarterLoad] = useState<{ done: number; total: number; note: string } | null>(null);
  /** 点过「稍后再说」的事件：不再自己弹，但还留在任务列表里。换日重置。 */
  const [deferredIncidents, setDeferredIncidents] = useState<string[]>([]);
  // 换了一天，昨天说「稍后再说」的事还得再摆一次：不催就没人管了。
  useEffect(() => { setDeferredIncidents([]); }, [state.day]);
  const [arcBusy, setArcBusy] = useState<string | null>(null);
  const STARTED_KEY = 'night-sugar-office:started';
  // 相位取代「已开始」布尔：标题页 → 编成 → 序章 → 正片。会话标记只记「已进入正片」。
  const [phase, setPhase] = useState<BootPhase>(() => { try { return sessionStorage.getItem(STARTED_KEY) === '1' ? 'play' : 'title'; } catch { return 'title'; } });
  /** 启动时读到的自动存档是否存在——标题页只在这时给「接着上一夜」。 */
  const [hadSave, setHadSave] = useState(false);
  /** 卡库里能用的卡数：够选人池上限时编成界面不掺内置角色。 */
  const [boxUsable, setBoxUsable] = useState(0);
  // 视觉小说模式（v93）：默认关闭，关着时角色剧情仍是原文。
  const [vnStory, setVnStory] = useState<VnStoryMode>(() => loadVnStory());
  const enterPlay = () => { try { sessionStorage.setItem(STARTED_KEY, '1'); } catch { /* 忽略存储异常 */ } setPhase('play'); };
  /** 载入存档后的分流：没编成过的老档先补编成，空白档直接进正片。 */
  useEffect(() => { stateRef.current = state; }, [state]);

  const afterLoad = (next: GameState) => { if (!next.startersPicked && !next.blank) setPhase('roster'); else enterPlay(); };
  /**
   * 读档后的后台降维：老存档里可能躺着几百 MB 的原图差分，
   * 这里在不打断操作的前提下把它们逐张压到 200KB 上下，再回写一次状态。
   */
  const slimLoadedImages = (next: GameState) => {
    void slimStateImages(next)
      .then(({ state: slim }) => {
        // 降维是异步的：如果这期间又读了一次档、或重开了一局，这份结果已经过期。
        // 以前这里无条件 setState，会把刚读进来的进度悄悄换回上一局（存档因此显示成旧的）。
        if (stateRef.current !== next) return;
        if (slim !== next) setState(slim);
      })
      .catch(() => { /* 降维失败不影响正常游玩，图保持原样。 */ });
  };
  const [generating, setGenerating] = useState(false);
  const [pendingProposal, setPendingProposal] = useState<PendingProposal | null>(null);
  /** v193：刚走到结局的故事线排队弹窗；读档时本来就结束的不补弹。 */
  const [endingQueue, setEndingQueue] = useState<EndingNotice[]>([]);
  const endingSeen = useRef<Map<string, Storyline['status']>>(new Map());
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | undefined>(undefined);
  const [storyBusy, setStoryBusy] = useState<string | null>(null);
  const [storyNotice, setStoryNotice] = useState<string | null>(null);
  const lastIncidentDay = useRef(state.day);
  const officeSynced = useRef(false);
  const generatingRef = useRef(false);
  /** 已经提示过「今天没自动补」的日号，避免同一天反复弹。 */
  const skippedNoticeDay = useRef(0);
  const savingRef = useRef(false);
  const queuedSave = useRef<GameState | null>(null);
  const latestState = useRef<GameState | null>(null);
  const writtenState = useRef<GameState | null>(null);
  const newsBusyRef = useRef(false);
  const [newsBusy, setNewsBusy] = useState(false);
  const newsEnabled = loadBalance().cityNewsEnabled === 1;

  // v170：预设和世界书一样，浏览器与本地存档各存一份 —— 换浏览器不该把玩家调好的词条丢掉。
  const presetSynced = useRef(false);
  /** v179：名册里缺性格与外形的人，启动时按 cardId 补读一次卡面（只补空的字段）。 */
  const rosterDescribed = useRef(false);
  useEffect(() => {
    if (rosterDescribed.current) return;
    if (!rosterDescriptionsMissing(state).length) return;
    rosterDescribed.current = true;
    void backfillFactionDescriptions(state).then(result => {
      if (!result) return;
      setState(result.state);
      notify(`名册补全：${result.filled.length} 位从卡面补上了性格与外形。`);
    });
  }, [state]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      await hydratePresetsFromStore();
      if (!alive) return;
      setPresets(loadPresets());
      setBinding(loadBinding());
      presetSynced.current = true;
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { try { savePresets(presets); } catch { /* 预设只是本地偏好。 */ } void savePresetsToStore(presets); }, [presets]);
  // 视觉小说开关：同步两条内置词条（战斗札记 / 完整剧情），让模型多写对白少写旁白。
  useEffect(() => { setPresets(current => syncVnPrompts(current, vnStory === 'on')); }, [vnStory]);
  useEffect(() => { try { saveBinding(binding); } catch { /* 绑定失效时回落内置预设。 */ } void savePresetBindingToStore(binding); }, [binding]);

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

  // 启动：先做一次性迁移（localStorage → IndexedDB），再读进度。
  useEffect(() => {
    let alive = true;
    void (async () => {
      const boot = await bootState({ keepInline: true });
      if (!alive) return;
      setState(boot.state);
      setHadSave(boot.hadSave);
      slimLoadedImages(boot.state);
      // 有存档也停在标题页：老板该先决定是接着那一夜还是重开一场。
      // 但会话里已经进过正片、读到的又是一份没编成过的旧档时，先补编成。
      try {
        if (sessionStorage.getItem(STARTED_KEY) === '1' && !boot.state.startersPicked && !boot.state.blank) setPhase('roster');
      } catch { /* 没有存储时按标题页处理。 */ }
      // 读档也补一次：卡里有图、存档里却是剪影的人（旧版本导入的），启动时就修好。
      void backfillPortraits([...boot.state.girls, ...boot.state.candidates], hash => readCardRaw(hash), await loadCardBox().catch(() => [])).then(async refill => {
        if (!alive || !refill.filled) return;
        let patched = boot.state;
        for (const [girlId, portrait] of refill.portraits) {
          const result = act(patched, { type: 'setPortrait', girlId, portrait });
          if (result.ok) patched = result.state;
        }
        if (patched === boot.state) return;
        setState(patched);
        console.info(`[卡库] 读档补回 ${refill.filled} 张立绘。`);
      });
      setBooted(true);
      setLoaded(true);
    })();
    return () => { alive = false; };
  }, []);

  // 标题页/编成期间随时更新卡库张数，决定编成池要不要补内置角色。
  useEffect(() => {
    if (phase !== 'title' && phase !== 'roster') return;
    let alive = true;
    void loadCardBox().then(box => { if (alive) setBoxUsable(box.length); }).catch(() => { /* 读不出来就当没卡。 */ });
    return () => { alive = false; };
  }, [phase]);

  // 开场守卫：进了正片但名册还没定（重置、读老档、导入未编成的存档），先回编成。
  useEffect(() => {
    if (phase !== 'play' || !booted || !loaded) return;
    if (state.startersPicked || state.blank) return;
    setPhase('roster');
  }, [phase, booted, loaded, state.startersPicked, state.blank]);

  // 自动存档：每个状态变更立即排队写入（写入串行化，IDB 事务不能并发冲同一键）。
  // 不做防抖——刷新页面丢掉最后一步的代价，比多写几 kB 大得多。
  useEffect(() => {
    if (!booted) return;
    latestState.current = state;
    void persist(state);
  }, [booted, state]);

  // 读档后的第一帧：把 portraitAsset 引用解析回 data URL，界面照旧直接用 girl.portrait。
  useEffect(() => {
    if (!loaded || hydratedRef.current) return;
    hydratedRef.current = true;
    void hydrateStatePortraits(state).then(hydrated => {
      if (hydrated === state) return;
      setState(hydrated);
      latestState.current = hydrated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  // 关页/切后台时补一次落盘——只在这份状态还没写成功时才写，
  // 免得把外部（例如测试脚本）刚写进去的存档又盖回内存里的旧版本。
  useEffect(() => {
    const flush = () => {
      if (!booted || !latestState.current) return;
      if (writtenState.current === latestState.current) return;
      void extractStatePortraits(latestState.current).then(flat => kvSet(SAVE_CURRENT_KEY, flat.state));
    };
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [booted]);

  async function persist(next: GameState) {
    if (savingRef.current) { queuedSave.current = next; return; }
    savingRef.current = true;
    try {
      // 立绘先搬进资产库，存档里只留引用：一个人几百 KB 的图不该反复写进存档。
      const flat = await extractStatePortraits(next);
      await kvSet(SAVE_CURRENT_KEY, flat.state);
      writtenState.current = next;
      setSaved(true);
    } catch {
      setSaved(false);
      setToasts(list => pushToast(list, { message: '浏览器存储写入失败，本次进度没有保存。请导出存档并清理站点数据。', ok: false, id: Date.now(), createdAt: Date.now() }));
    } finally {
      savingRef.current = false;
      const queued = queuedSave.current;
      queuedSave.current = null;
      if (queued) void persist(queued);
    }
  }
  // 叙事者每一次操作结束（成功或失败）都问一次音频模块该不该响；开关存 localStorage。
  useEffect(() => onLlmFinished(info => {
    const kind = resolveChime(info, chime);
    if (kind) playChime(kind);
  }), [chime]);
  useEffect(() => { saveChimeEnabled(chime); }, [chime]);
  useEffect(() => { document.documentElement.classList.toggle('reduced-motion', reduced); try { localStorage.setItem('night-sugar:motion', reduced ? 'reduced' : 'full'); } catch { /* Preferences are optional when storage is unavailable. */ } }, [reduced]);
  const blockedNoticeDay = useRef(0);
  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setState(current => {
        const moved = act(current, { type: 'advance', minutes: 5 });
        if (!moved.ok && blockedNoticeDay.current !== current.day) {
          blockedNoticeDay.current = current.day;
          // 时间不走，星象台就不会按小时结算——把原因说出来，别让人以为是坏了。
          notify(`时间被拦住了：${moved.message}`, false);
        }
        return moved.state;
      });
    }, 12000);
    return () => clearInterval(timer);
  }, [auto]);
  useEffect(() => { try { localStorage.setItem('night-sugar:auto-generate', autoGenerate ? 'on' : 'off'); } catch { /* Optional preference. */ } }, [autoGenerate]);
  useEffect(() => { saveProposalCheck(proposalCheck); }, [proposalCheck]);
  useEffect(() => {
    const fresh = newlyFinishedStories(endingSeen.current, state.storylines);
    endingSeen.current = storylineStatuses(state.storylines);
    if (fresh.length) setEndingQueue(queue => [...queue, ...fresh]);
  }, [state.storylines]);
  // 叙事引擎日志落盘：只有本地接口（npm run dev / start.cmd）能写，静态部署时 fetch 会失败并被忽略。
  useEffect(() => { setLlmLogSink(postLlmLog); return () => setLlmLogSink(null); }, []);
  useEffect(() => {
    if (!loaded) return;
    // 存档里没有这个日号（旧档、或被读档清洗掉）：先补一个今天的值，不生成。
    if (typeof state.generatedDay !== 'number') { setState(prev => ({ ...prev, generatedDay: prev.day })); return; }
    // 序章看完 + 编成定下才补：那之前名册还是默认的，写出来的提案会认错人。
    if (!shouldAutoGenerate(state, autoGenerate)) {
      // 换日了却没补：把原因说出来，别再让人干等一份不会来的提案。
      const generated = typeof state.generatedDay === 'number' ? state.generatedDay : state.day;
      if (autoGenerate && state.day > generated && skippedNoticeDay.current !== state.day) {
        skippedNoticeDay.current = state.day;
        notify('夜间自动补充被拦住了：开局流程（序章或编成）还没走完。', false);
      }
      return;
    }
    if (modal) return;
    if (generatingRef.current || !llmHasKey()) return;
    // 先把「今天已经补过」记进存档，再发请求：失败也不会在读档时反复重放。
    setState(prev => (prev.generatedDay === prev.day ? prev : { ...prev, generatedDay: prev.day }));
    void generateContent('auto');
  }, [state.day, state.generatedDay, autoGenerate, loaded, modal, state.prologueSeen, state.startersPicked, state.blank]);
  /** 播报一律走函数式更新：异步生成回来时，别拿旧快照把这一整份状态盖回去。 */
  /** v167：换主持人——先把人写进存档，再按新主持重开今晚这档。 */
  const changeNewsHost = (girlId: string) => {
    const applied = act(latestState.current ?? state, { type: 'setNewsHost', girlId });
    if (!applied.ok) { notify(applied.message, false); return; }
    setState(applied.state);
    notify(applied.message, true);
    void refreshCityNews('manual', applied.state);
  };
  const commitCityNews = (news: CityNews | null) => {
    let ok = false;
    setState(prev => {
      const applied = act(prev, { type: 'setCityNews', news });
      if (applied.ok) { ok = true; return applied.state; }
      return prev;
    });
    return ok;
  };
  /** v167：返回这一档最终写入的内容（没生成出来就是 undefined），控制台的 news 命令要用它回话。 */
  const refreshCityNews = async (mode: 'auto' | 'manual' = 'manual', override?: GameState): Promise<CityNews | undefined> => {
    let current = override ?? latestState.current ?? state;
    // 接手的第一夜自动播开场那一条；手动刷新（含 news 命令）照常请叙事者。
    if (current.day <= OPENING_NEWS_DAY && mode === 'auto') {
      const opening = openingCityNews(OPENING_NEWS_DAY, loadPlayerProfile().name);
      if (!current.cityNews || current.cityNews.headline !== opening.headline || current.cityNews.items[0]?.text !== opening.items[0]?.text) {
        commitCityNews(opening);
      }
      return;
    }
    // v179：手动刷新先翻一版节目单 —— 换个嘉宾、换块辖区、换要谈的事，
    // 不翻的话同一档节目每次生成出来都是同一批人问同一件事。
    if (mode === 'manual') {
      const rolled = act(current, { type: 'rollNewsCast' });
      if (rolled.ok) {
        current = rolled.state;
        setState(rolled.state);
      }
    }
    if (newsBusyRef.current) return;
    if (loadBalance().cityNewsEnabled !== 1) {
      if (mode === 'manual') notify('城市新闻已在「世界书 → 数值」里关掉了。', false);
      return;
    }
    newsBusyRef.current = true;
    setNewsBusy(true);
    try {
      let news: CityNews | undefined;
      if (llmHasKey()) {
        const result = await generateCityNews(loadLlmConfig(), current, taskRuntime(boundPreset('news', presets, binding), 'news'));
        if (result.ok) news = result.data;
      }
      const latest = latestState.current ?? current;
      const committed = commitCityNews(news ?? localCityNews(latest));
      if (mode === 'manual') notify(committed ? (news ? '城市播报已由叙事者写好。' : '没有连上叙事者，先用本地快讯顶上。') : '这条播报没有可用的内容，保留原来那条。', committed);
    } finally {
      newsBusyRef.current = false;
      setNewsBusy(false);
    }
  };
  useEffect(() => {
    if (!loaded) return;
    // 接手的第一夜固定播开场那一条，不请叙事者；旧档在这一天缺播报、或玩家刚改了名字时补上。
    if (state.day <= OPENING_NEWS_DAY) {
      const name = loadPlayerProfile().name.trim();
      const text = state.cityNews?.items[0]?.text ?? '';
      if (!state.cityNews || (name && !text.includes(name))) void refreshCityNews('auto');
      return;
    }
    if (loadBalance().cityNewsEnabled !== 1) return;
    if (!newsIsStale(state.cityNews, state.day)) return;
    void refreshCityNews('auto');
  }, [state.day, loaded]);
  useEffect(() => {
    // 提示排队逐条出现：一次推进里可能同时完成多个委托、多人升级，不能互相覆盖。
    // 过期按 createdAt 判断——链式 setTimeout 一旦被打断（重渲染、切标签页），
    // 那条提示就会永远留在屏幕上。
    if (!toasts.length) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      setToasts(list => expireToasts(list, now));
    }, 1200);
    return () => clearTimeout(timer);
  }, [toasts]);
  useEffect(() => {
    if (state.day <= lastIncidentDay.current) { lastIncidentDay.current = state.day; return; }
    lastIncidentDay.current = state.day;
    if (!llmHasKey()) return;
    if (incidentPoolNeed(state) <= 0) return;
    void generateIncidentBatch(loadLlmConfig(), state, taskRuntime(boundPreset('incident', presets, binding), 'incident')).then(result => {
      if (!result.ok) return;
      // v107：这批突发是几十秒后才回来的，必须落在**当时最新的 state**上。
      // 以前这里用的是发起请求时那一刻的 state，回来时会把期间写进去的剧情回合整段覆盖掉。
      setState(prev => { const applied = act(prev, { type: 'mergeIncidentPool', entries: result.data.entries }); return applied.ok ? applied.state : prev; });
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
        ? await generateStoryArc(config, target, { storylineTitle: story?.title, premise: story?.premise, beatTitle: beat?.title, beatHook: beat?.hook, memory }, preset, latestState.current ?? state)
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

  // v34：交互剧情的开场白。旧图没写开场白时也在这里补一次。
  /** v177：回看已保存的剧情时，先把立绘读回来再开演，进度条按人头走。 */
  const [storyReplay, setStoryReplay] = useState<{ event: CharacterEvent; castPool: StoryCastPerson[] } | null>(null);
  const [replayLoad, setReplayLoad] = useState<{ title: string; pct: number; note: string } | null>(null);
  const [storyBusyTurn, setStoryBusyTurn] = useState(false);
  /** v123：玩家写下的开场。写进去之后再请叙事者起笔；空串表示「按引子开始」。 */
  const seedStoryOpening = (eventId: string, seed: string) => { perform({ type: 'seedStorySession', eventId, seed }); };
  useEffect(() => {
    if (!modal || modal.type !== 'event') return;
    const event = state.events.find(item => item.id === modal.id);
    if (!event) return;
    if (arcBusy) return;
    // v186：蓝图自带的开场白也算已就绪；约谈 / 会议没有开场白，仍等玩家先写。
    if (!shouldAutoOpenStory(event)) return;
    setArcBusy(event.id);
    void (async () => {
      const config = loadLlmConfig();
      const cast = (event.cast?.length ? event.cast : [event.girlId]).slice(0, 5);
      const seed = event.playerSeed ?? '';
      let opening = event.opening?.trim() ?? '';
      let lines: StoryLine[] = [];
      let options: string[] = [];
      // 蓝图已经写好开场白就直接用，别让叙事者再覆盖一遍。
      if (config.apiKey && !opening) {
        const result = await generateStoryOpening(config, state, event, taskRuntime(boundPreset('arc', presets, binding), 'arc'), seed);
        if (result.ok) { opening = result.narration; lines = result.lines; options = result.options; }
        else {
          // 失败就停在这一步：玩家写的那段还留着，卡片会退回输入态。
          notify(`${result.message || '开场白没有写出来'}这一句已经记下了，可以再试一次。`, false);
          setArcBusy(null);
          return;
        }
      }
      if (!opening) opening = seed ? `${seed}\n\n${event.hook}` : (event.hook || '她在这里等你开口。');
      if (!options.length) options = ['你先开口问她', '你看一眼她手边的东西', '你什么都不说，等她先讲'];
      setState(prev => { const applied = act(prev, { type: 'startStorySession', eventId: event.id, cast, opening, lines, options, seed }); return applied.ok ? applied.state : prev; });
      setArcBusy(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, state.events, arcBusy]);

  /** 玩家写下一句行动：先落玩家那一轮，再请叙事者续写。 */
  const submitStoryTurn = async (eventId: string, action: string): Promise<boolean> => {
    const event = state.events.find(item => item.id === eventId);
    const text = action.trim().slice(0, 300);
    if (!event || !text || storyBusyTurn) return false;
    // 主角可能是三方名册里的首领/随从（「登门拜访首领」就是这样），
    // 只在 girls/candidates 里找会直接断线：玩家写完一句，叙事者永远不会回。
    const target = storyPersonOf(state, event.girlId)?.girl;
    const playerTurn: StoryTurn = {
      id: `turn-p-${Date.now().toString(36)}`, role: 'player', text,
      lines: [{ speakerId: 'player', speakerName: '所长', expression: 'calm', text, mode: 'speech' }],
      at: Date.now(),
    };
    const appended = act(state, { type: 'appendStoryTurn', eventId, turn: playerTurn });
    if (!appended.ok) { notify(appended.message, false); return false; }
    setState(appended.state);
    const config = loadLlmConfig();
    if (!config.apiKey || !target) return true;
    setStoryBusyTurn(true);
    try {
      const result = await generateStoryTurn(config, appended.state, appended.state.events.find(item => item.id === eventId)!, text, taskRuntime(boundPreset('arc', presets, binding), 'arc'));
      if (!result.ok) { notify(`${result.message}这一句已经记下了，可以再试一次。`, false); return false; }
      const gains = result.turn.bond;
      // 模型写完了却没能写进剧情时，必须说出来——以前这里是静默丢弃，
      // 表现就是「引擎显示生成成功，但界面里一个字都没有」。
      let appendError = '';
      setState(prev => {
        const turn: StoryTurn = { id: `turn-n-${Date.now().toString(36)}`, role: 'narrator', text: result.turn.narration, lines: result.turn.lines, options: result.turn.options, at: Date.now() };
        const applied = act(prev, { type: 'appendStoryTurn', eventId, turn });
        if (!applied.ok) { appendError = applied.message; return prev; }
        if (!gains) return applied.state;
        const next = { ...applied.state, girls: applied.state.girls.map(girl => girl.id === event.girlId ? { ...girl, bond: Math.max(0, Math.min(100, girl.bond + gains)) } : girl) };
        return next;
      });
      if (appendError) {
        notify(`这一轮没能写进剧情：${appendError}`, false);
        return false;
      }
      return true;
    } finally {
      setStoryBusyTurn(false);
    }
  };

  /**
   * 手动改一句（v104）：只改文本，不重新请求模型。
   * 玩家那一轮的台词跟正文是同一句，一起改掉。
   */
  const editStoryTurn = (eventId: string, turnId: string, text: string) => {
    setState(prev => {
      const applied = act(prev, { type: 'editStoryTurn', eventId, turnId, text });
      if (!applied.ok) { notify(applied.message, false); return prev; }
      return applied.state;
    });
  };

  /** 删掉自己说的那一轮：模型写的那一段会保留，读起来像两个人之间的空白被剪掉。 */
  const deleteStoryTurn = (eventId: string, turnId: string) => {
    setState(prev => {
      const applied = act(prev, { type: 'deleteStoryTurn', eventId, turnId });
      if (!applied.ok) { notify(applied.message, false); return prev; }
      return applied.state;
    });
  };

  /** 重写单独一段旁白：同样的局面，换一种写法。 */
  const rewriteStoryTurn = async (eventId: string, turnId: string): Promise<boolean> => {
    const event = state.events.find(item => item.id === eventId);
    if (!event || storyBusyTurn) return false;
    const turns = event.turns ?? [];
    const index = turns.findIndex(turn => turn.id === turnId);
    if (index <= 0) return false;
    const action = [...turns.slice(0, index)].reverse().find(turn => turn.role === 'player')?.text ?? '';
    if (!action) return false;
    const config = loadLlmConfig();
    if (!config.apiKey) { notify('配置叙事者后才能重写这一段。', false); return false; }
    const target = storyPersonOf(state, event.girlId)?.girl;
    if (!target) return false;
    setStoryBusyTurn(true);
    try {
      const context: CharacterEvent = { ...event, turns: turns.slice(0, index) };
      const result = await generateStoryTurn(config, state, context, action, taskRuntime(boundPreset('arc', presets, binding), 'arc'), { rewrite: true });
      if (!result.ok) { notify(result.message, false); return false; }
      const turn: StoryTurn = { id: turnId, role: 'narrator', text: result.turn.narration, lines: result.turn.lines, options: result.turn.options, at: Date.now() };
      setState(prev => { const applied = act(prev, { type: 'replaceStoryTurn', eventId, turnId, turn }); return applied.ok ? applied.state : prev; });
      return true;
    } finally {
      setStoryBusyTurn(false);
    }
  };
  /**
   * 结束这一段剧情：先请叙事者写一个结局，再把它接在最后。
   *
   * 关掉界面交给玩家自己——他要看到这一段是怎么收的。
   */
  /** v177：手动把这一段收进「已保存的剧情」。按钮在剧情结尾，不再自动存。 */
  /**
   * 回看一段保存的剧情（v177）：还原成事件，把在场者的立绘先读回来，再交给同一套演出界面。
   * 进度条按人头推进——这段过程跟读档一样要等资产，不给个进度就会以为是卡住了。
   */
  const watchArchivedStory = async (story: ArchivedStory) => {
    setReplayLoad({ title: story.title, pct: 8, note: '解析保存的副本' });
    try {
      // 正篇存档里还留着这一段时优先用它：那里的每一句都带着当时的表情，
      // 老副本只存了文字，回看会是一张定格的脸。
      const live = state.events.find(item => item.id === story.eventId);
      const event = live?.turns?.length && live.turns.length >= story.turns.length
        ? { ...live, status: 'done' as const, mode: 'session' as const, pendingChoice: undefined }
        : replayEventOf(story);
      const pool: StoryCastPerson[] = [...state.girls, ...state.candidates, ...(state.customFactionLeaders ?? []), ...(state.customFactionGirls ?? [])];
      const byName = new Map(pool.map(girl => [girl.name, girl.id]));
      // 老副本只存了名字：按名字把 id 补回来，舞台才取得到立绘。
      for (const turn of event.turns ?? []) {
        for (const line of turn.lines ?? []) {
          if (!pool.some(girl => girl.id === line.speakerId) && byName.has(line.speakerName)) line.speakerId = byName.get(line.speakerName)!;
        }
      }
      const people = [...new Set([event.girlId, ...(event.cast ?? [])])]
        .map(id => pool.find(girl => girl.id === id))
        .filter((girl): girl is StoryCastPerson => Boolean(girl));
      const total = Math.max(1, people.length);
      for (const [index, girl] of people.entries()) {
        const asset = (girl as { portraitAsset?: string }).portraitAsset;
        const url = girl.portrait || (asset ? (await assetUrl(asset)) ?? '' : '');
        setReplayLoad({ title: story.title, pct: 25 + Math.round(((index + 1) / total) * 60), note: `取回 ${girl.name} 的立绘` });
        if (url) await preloadImage(url);
      }
      setReplayLoad({ title: story.title, pct: 100, note: '准备好了' });
      setStoryReplay({ event, castPool: pool });
    } catch {
      notify('这一段回看不了：副本可能不完整。', false);
    } finally {
      setReplayLoad(null);
    }
  };
  const archiveStoryNow = (eventId: string) => {
    const current = latestState.current ?? state;
    const event = current.events.find(item => item.id === eventId);
    if (!event) { notify('这一段已经不在了，没法留存副本。', false); return; }
    void saveStoryToArchive(event, current).then(ok => {
      notify(ok ? `「${event.title}」已收进记忆：开局界面的「观看保存的剧情」里能看到。` : '没能写到本地存档，稍后再试一次。', ok);
    });
  };
  const endStorySession = async (eventId: string): Promise<boolean> => {
    const event = state.events.find(item => item.id === eventId);
    if (!event) return false;
    if (storyBusyTurn) return false;
    const config = loadLlmConfig();
    // 没有配叙事者、或者正卡在蓝图岔路口：只能本地收尾（没有模型可重试）。
    // 收尾时仍然留一份本地摘要，之后的历史只引用它。
    if (!config.apiKey || pendingChoiceOf(state, event.girlId)) {
      return perform({ type: 'finishStorySession', eventId, summary: localSessionSummary(event, '') });
    }
    setStoryBusyTurn(true);
    try {
      const result = await generateStoryEnding(config, state, event, taskRuntime(boundPreset('arc', presets, binding), 'arc'));
      if (!result.ok) {
        // v117：收尾没写出来就**不要**结束事件——否则这一段既没有结局也没有摘要，
        // 等于把剧情硬切断。保持开着，玩家可以再点一次「结束事件」重试。
        notify(`收尾没有写出来：${result.message}剧情还开着，可以再点一次「结束事件」。`, false);
        return false;
      }
      return perform({ type: 'finishStorySession', eventId, ending: result.turn, summary: result.summary });
    } finally {
      setStoryBusyTurn(false);
    }
  };
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
    if (!officeSynced.current) {
      officeSynced.current = true;
      // 常驻词条（空月、心防…）是这一版才有的说明书，老档不会自己长出来，启动时补齐。
      syncBuiltinWorldbook();
      syncOfficeWorldbook(state.office, representativeOf(state), { onlyIfMissing: true });
      return;
    }
    syncOfficeWorldbook(state.office, representativeOf(state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.office, state.assistantId]);

  const notify = (message: string, ok = true) => {
    if (!message) return;
    toastSeq.current += 1;
    const now = Date.now();
    setToasts(list => pushToast(list, { message, ok, id: now + toastSeq.current, createdAt: now }));
  };

  // 委托完成 / 升级：新通知逐条进提示队列，不覆盖彼此。
  const seenNoticeIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!loaded) return;
    const list = state.notices ?? [];
    if (!list.length) return;
    const seen = seenNoticeIds.current;
    // 第一次同步只记账不补发：读档时不该把二十条历史通知全弹一遍。
    if (!seen.size || seen.size > 200) { for (const notice of list) seen.add(notice.id); return; }
    const fresh = list.filter(notice => !seen.has(notice.id));
    for (const notice of list) seen.add(notice.id);
    if (fresh.length > 4) return;
    for (const notice of fresh.reverse()) notify(`${notice.title} —— ${notice.text}`, notice.kind !== 'level');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.notices, loaded]);

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
    setProposalError(null);
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
        setProposalError(result.message);
        if (mode === 'auto') notify(`夜间自动补充停笔：${result.message}`, false);
        return { ok: false, message: result.message };
      }
      if (mode === 'manual') {
        setModal(null);
        setPendingProposal({ data: result.data, warnings: result.warnings });
        return { ok: true, message: '提案已生成，确认后才会写入事务所。' };
      }
      // 请求期间玩家可能又写了剧情：合并到最新状态上，别把这段覆盖掉。
      let failure = '';
      setState(prev => {
        const next = materializeNightProposal(result.data, prev);
        const applied = act(prev, { type: 'addGeneratedContent', ...next });
        if (!applied.ok) { failure = applied.message; return prev; }
        return applied.state;
      });
      if (failure) {
        notify(`夜间自动补充没有写入：${failure}`, false);
        return { ok: false, message: failure };
      }
      notify(result.warnings.length ? `夜间自动补充完成，本地裁剪了 ${result.warnings.length} 处越界数值。` : '夜间自动补充完成，新的委托与议题已经入场；候选者改由契约卡库补货。');
      return { ok: true, message: '夜间补充完成。' };
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
  const draftGirlProfile = async (portrait?: string, hint?: string, query?: string) => {
    const config = loadLlmConfig();
    // 联网考据只服务同人角色起草：先查资料，再把摘要作为参考注入；查不到就照常起草。
    let research: GirlResearch | undefined;
    const asked = normalizeResearchQuery(query ?? '');
    if (loadResearchPrefs().enabled && asked) {
      const found = await researchCharacter(config, asked);
      if (found.ok) research = found.data;
      else notify(`联网考据没有成功：${found.message} 先按现有资料起草。`, false);
    }
    const result = await generateGirlProfile(config, portrait, hint, taskRuntime(boundPreset('profile', presets, binding), 'profile'), research);
    return result.ok ? { ok: true, message: '', profile: result.data } : { ok: false, message: result.message };
  };
  const perform = (action: GameAction, quiet = false) => {
    const result = act(state, action);
    if (result.ok) setState(result.state);
    if (!quiet || !result.ok) notify(result.message, result.ok);
    if (result.ok && result.battle) setModal({ type: 'battle', id: result.battle.id });
    return result.ok;
  };

  // 灯下私语：模型读战报，生成成功才写入未读与角标；失败只丢队列，不造假消息。
  const whisperRunning = useRef(false);
  useEffect(() => {
    if (!loaded || phase !== 'play' || whisperRunning.current) return;
    const job = state.whisperQueue?.[0];
    if (!job) return;
    if (!llmHasKey()) {
      perform({ type: 'dropWhisper', jobId: job.id, reason: '尚未配置叙事者' }, true);
      return;
    }
    whisperRunning.current = true;
    void (async () => {
      try {
        const config = loadLlmConfig();
        const result = await generateWhisper(config, state, job, taskRuntime(boundPreset('whisper', presets, binding), 'whisper'));
        // 用函数式更新落地：等模型时玩家可能已经推进过时间。
        setState(prev => {
          const applied = act(prev, result.ok
            ? { type: 'addWhisper', jobId: job.id, lines: result.lines }
            : { type: 'dropWhisper', jobId: job.id, reason: result.message });
          return applied.ok ? applied.state : prev;
        });
        if (result.ok) notify('她发来了一条灯下私语。');
      } finally {
        whisperRunning.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, phase, state.whisperQueue, presets, binding]);
  const writeBattleNote = async (battle: BattleState) => {
    if (noteBusy) return;
    setNoteBusy(true);
    setNoteError(undefined);
    try {
      const config = loadLlmConfig();
      const result = await generateBattleNote(config, battle, taskRuntime(boundPreset('battle', presets, binding), 'battle'), latestState.current ?? state);
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
  const talk = (id: string, remote = false) => {
    if (state.whisperUnread?.[id]) perform({ type: 'markWhispersRead', girlId: id }, true);
    const g = state.girls.find(g => g.id === id); if (remote) { if (!g?.retired) { notify(`${g?.name ?? '她'}还没有退役，直接去会客厅找她吧。`, false); return; } setModal({ type: 'talk', id, remote: true }); return; } if (g?.retired) { notify(`${g.name}已经退役，可以用远程联络。`, false); setModal({ type: 'talk', id, remote: true }); return; } if (g?.status === 'mission') { notify(`${g.name}正在出勤，等她回到基地再聊聊吧。`, false); return; } if (g?.status === 'healing' || g?.status === 'resting') { notify(`${g.name}正在${g.status === 'healing' ? '治疗' : '休息'}，稍后再聊吧。`, false); return; } if (g?.status === 'expedition') { notify(`${g.name}正在星象台远行，暂时联络不上。`, false); return; } setModal({ type: 'talk', id }); };
  const sendTalk = async (id: string, text: string, remote = false): Promise<boolean> => {
    const target = state.girls.find(g => g.id === id) ?? state.candidates.find(g => g.id === id);
    if (!target) return false;
    const config = loadLlmConfig();
    if (config.apiKey.trim()) {
      const result = await generateDialogue(config, { girl: target, state, text, remote }, taskRuntime(boundPreset('chat', presets, binding), 'chat'));
      if (result.ok) return perform({ type: 'talk', girlId: id, text, remote, reply: { lines: result.lines } }, true);
      notify(`叙事者没有回应：${result.message} 已切回本地剧情。`, false);
    }
    return perform({ type: 'talk', girlId: id, text, remote }, true);
  };
  const exportCard = async (girlId: string) => {
    // 从最新状态取人：刚换完表情/衣柜就点导出时，不能用上一次渲染的旧对象。
    const latest = latestState.current ?? state;
    const girl = [...latest.girls, ...latest.candidates].find(entry => entry.id === girlId);
    if (!girl) { notify('找不到这位契约者，无法导出。', false); return; }
    const card = buildGirlCard(girl, latest);
    const name = girlCardFileName(card);
    const text = JSON.stringify(card, null, 2);
    // 卡库里如果已经有这张卡，顺手把 raw 换成刚导出的版本：否则从卡库再导入还是旧立绘。
    try {
      const box = await loadCardBox();
      const at = box.findIndex(entry => entry.fileName === name || entry.hash === girl.cardId);
      if (at >= 0) {
        const next = [...box];
        next[at] = { ...next[at], raw: text, name: girl.name, level: girl.level, element: girl.element, factionTag: girl.factionTag ?? 'none', addedAt: Date.now() };
        await saveCardBox(next);
      }
    } catch { /* 卡库写不进去不影响文件导出。 */ }
    const saved = await writeLocalFile('card', name, text);
    const storyNote = card.storylines?.length ? `（含 ${card.storylines.length} 段故事线）` : '';
    if (saved) { notify(`契约卡「${girl.name}」已存进 ${shortPath(saved)}。${storyNote}`); return; }
    downloadFile(name, text);
    notify(`契约卡「${girl.name}」已导出到下载目录。${storyNote}`);
  };
  const importCard = async (file: File) => {
    // 一张带立绘与表情差分的 PNG 卡十兆二十兆都正常，这里只拦明显不是卡的文件。
    const guard = cardFileGuard(file.size);
    if (!guard.ok) { notify(`导入失败：${guard.message}`, false); return; }
    const parsed = parseGirlCard(await file.text());
    if (!parsed.ok) { notify(`导入失败：${parsed.message}`, false); return; }
    const optimized = await optimizeCardImages(parsed.card);
    perform({ type: 'importCard', card: optimized });
  };
  const exportSave = async () => {
    const name = `夜糖事务所-第${state.day}日存档.json`;
    const text = JSON.stringify(state, null, 2);
    const saved = await writeLocalFile('save', name, text);
    if (saved) { notify(`当前存档已存进 ${shortPath(saved)}。`); return; }
    downloadFile(name, text);
    notify('当前存档已导出到下载目录。');
  };
  const importSave = async (file: File) => {
    const guard = saveFileGuard(file.size);
    if (!guard.ok) { notify(`导入失败：${guard.message}`, false); return; }
    const next = importState(await file.text());
    if (!next) { notify('导入失败：这不是可识别的夜糖事务所存档，或文件已经损坏。', false); return; }
    setModal(null);
    setHadSave(true);
    setPendingSave(next);
  };
  const loadLocalSave = async (name: string) => {
    const text = await readLocalFile('save', name);
    if (!text) { notify(`读不到 ${name}，可能已经被移走了。`, false); return; }
    const next = importState(text);
    if (!next) { notify('导入失败：这不是可识别的夜糖事务所存档，或文件已经损坏。', false); return; }
    setModal(null);
    if (phase !== 'play') { setState(next); setHadSave(true); afterLoad(next); slimLoadedImages(next); notify(`已载入第 ${next.day} 日的存档（${next.startersPicked ? '已编成' : '未编成'}）。`); return; }
    setHadSave(true);
    setPendingSave(next);
  };

  const saveToSlot = async (id: SaveSlotId) => {
    if (pendingSave) { notify('还有一个读档在等你确认：先确认或取消，再存这一局。', false); return; }
    const stamp = `第 ${state.day} 日 · ${state.startersPicked ? '已编成' : '未编成'}`;
    const result = await writeSlot(id, state);
    notify(result.ok ? `${result.message}（${stamp}）` : result.message, result.ok);
  };
  const loadFromSlot = async (id: SaveSlotId) => {
    const next = await readSlot(id).then(async slotState => (slotState ? hydrateStatePortraits(slotState) : null));
    if (!next) { notify('这个档位读不出来，可能已经损坏。', false); return; }
    setModal(null);
    if (phase !== 'play') { setState(next); setHadSave(true); afterLoad(next); slimLoadedImages(next); notify(`已载入第 ${next.day} 日的存档（${next.startersPicked ? '已编成' : '未编成'}）。`); return; }
    setHadSave(true);
    setPendingSave(next);
  };
  const deleteSlot = async (id: SaveSlotId) => { await clearSlot(id); notify(`存档位 ${id} 已清空。`); };
  const restartGame = () => { setAuto(false); setModal(null); perform({ type: 'reset' }); setPhase('roster'); notify('新的一局开始了，先看看开场。'); };

  /**
   * 分批读卡，再逐批写进 state。
   *
   * 每批只把几十 MB 里的几张读进来，解析完立刻交给 `importCards` 并丢掉原文引用，
   * 峰值只跟一批有关，而不是整库。`onProgress` 给界面显示「第几批」。
   */
  const importCardsInBatches = async (
    base: GameState,
    entries: CardBoxEntry[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<GameState> => {
    const batches = planCardBatches(entries);
    let working = base;
    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index]!;
      const cards = await cardboxCards(batch.map(entry => entry.hash));
      if (cards.length) {
        // 批次内卡片逐张进行安全瘦身，防止外部大图突发撑爆内存
        const sanitizedCards: GirlCard[] = [];
        for (const c of cards) {
          sanitizedCards.push(await optimizeCardImages(c));
          await yieldToGC(8);
        }
        const applied = act(working, { type: 'importCards', cards: sanitizedCards });
        if (applied.ok) working = applied.state;
      }
      onProgress?.(index + 1, batches.length);
      if (batches.length > 1) {
        const mb = Math.round(batch.reduce((sum, entry) => sum + entry.bytes, 0) / 1024 / 1024);
        console.info(`[卡库] 分批读取 ${index + 1}/${batches.length}：${cards.length} 张 · ${mb}MB`);
      }
      // 批次之间让出微任务，促发垃圾回收
      await yieldToGC(24);
    }
    return working;
  };

  /**
   * 开始新游戏：标准开局 → 如果卡库里有卡，先进卡库让玩家自己挑要导入的人 → 再进编成。
   *
   * 以前是开局自动读一批卡进来，玩家既没法挑、也要等读图。现在开局一张都不读：
   * 拆成「你挑 → 我读 → 进编成」，读图那点时间就落在玩家已经选好之后。
   */
  const startNewGame = async (mode: 'standard' | 'blank' = 'standard') => {
    // 角色来源：本地卡库优先（src/cardLibrary.ts）。读得到就空名册开局，六个人全从卡库来、统一 1 级；
    // 读不到（静态部署、卡库为空）才回退内置名册，并且明说原因，不再静默换人。
    // v85 批三：名册与三方名册**都**从卡库随机取（「全随机」的决定）。
    // 一次读 12 张：前 6 张进事务所名册，后 6 张坐三方位置，读不齐就退回内置名册。
    if (mode === 'standard' || mode === 'blank') {
      const library = await readLibraryCards(LIBRARY_START_ROSTER * 2, { exclude: usedCardIds(state) });
      if (library.ok && library.cards.length >= STARTER_COUNT) {
        const rosterCards = library.cards.slice(0, Math.min(LIBRARY_START_ROSTER, library.cards.length));
        const factionCards = library.cards.slice(rosterCards.length);
        const empty = act(state, { type: 'reset', mode, roster: mode === 'standard' ? 'empty' : undefined });
        let working = empty;
        if (empty.ok) {
          const imported = act(empty.state, { type: 'importCards', cards: rosterCards });
          if (imported.ok) working = imported;
        }
        if (working.ok) {
          const snapshot = factionSnapshotFromCards(factionCards);
          const assigned = snapshot ? act(working.state, { type: 'assignFactionRoster', ...snapshot }) : null;
          const final = assigned?.ok ? assigned : working;
          setState(final.state);
          setPhase(mode === 'blank' && !final.state.girls.length ? 'prologue' : 'roster');
          // 三方名册不再回退内置人物：卡不够就空着，并在提示里说清楚要导入。
          const missing = factionSeatsMissing(final.state);
          const factionNote = assigned?.ok
            ? `三方名册也从卡库排定：${snapshot!.leaders.map(leader => leader.name).join('、')}`
            : `三方还有 ${Math.max(missing, 3)} 个席位空着：契约卡不足，需要导入（三方各 1 位首领 + 1 位随从）`;
          notify(`名册来自本地卡库：${rosterCards.map(card => card.girl.name).join('、')}（统一 1 级）。${factionNote}。`);
          return;
        }
      }
      notify(`没读到本地卡库（${library.reason ?? '卡库为空'}），这一局先用内置名册。`, false);
    }
    const next = act(state, { type: 'reset', mode }).state;
    let boxEmpty = false;
    try {
      const box = await loadCardBox();
      setBoxUsable(box.length);
      boxEmpty = !box.some(entry => !usedCardIds(next).has(entry.hash));
    } catch { boxEmpty = true; /* 卡库读不出来就当没卡，按默认名册开局。 */ }
    setState(next);
    // 空白档案里没有契约者，先别进编成，否则四个位置一个都填不满。
    // v83 批三：空白档也从卡库补两位候选，市场才不会一开局就是死的。
    if (mode === 'blank' && !next.girls.length && !next.candidates.length) {
      const library = await readLibraryCards(2, { exclude: usedCardIds(next) });
      if (library.ok && library.cards.length) {
        const filled = act(next, { type: 'importCards', cards: library.cards });
        if (filled.ok) {
          setState(filled.state);
          setPhase('prologue');
          notify(`空白档案从卡库补了 ${library.cards.length} 位候选。`);
          return;
        }
      }
    }
    setPhase(mode === 'blank' && !next.girls.length && !next.candidates.length ? 'prologue' : 'roster');
    // 有卡就先让玩家在卡库里挑；挑完（或直接关掉）都落到编成界面。
    if (!boxEmpty) setModal({ type: 'cardbox' });
  };

  /**
   * 缺省补位（v83 批三）：市场没人时直接从卡库补几位候选。
   *
   * 市场和候选池以前空了就只能等第二天，或者玩家自己开卡库导入。这里统一走一条路：
   * 读卡 → 归一 1 级 → importCards，读不到就照实说卡库为空。
   */
  const fillFromLibrary = async (count = 3): Promise<boolean> => {
    const library = await readLibraryCards(count, { exclude: usedCardIds(state) });
    if (!library.ok || !library.cards.length) {
      notify(`卡库里没有可补的卡（${library.reason ?? '都已在名册里'}）。`, false);
      return false;
    }
    // 读卡库是异步的：写回时以最新状态为准，避免覆盖期间的剧情与结算。
    let failure = '';
    setState(prev => {
      const next = act(prev, { type: 'importCards', cards: library.cards });
      if (!next.ok) { failure = next.message; return prev; }
      return next.state;
    });
    if (failure) {
      notify(failure, false);
      return false;
    }
    notify(`从卡库补了 ${library.cards.length} 位候选：${library.cards.map(card => card.girl.name).join('、')}。`);
    return true;
  };

  /**
   * 高级招聘：先扫卡库挑一张，把卡随动作交给规则层。
   *
   * 规则层的动作是同步的，读卡是异步的，所以顺序必须是「读 → 归一 → 下发」。
   * 卡库读不到（静态部署 / 空库）时不下发卡，规则层退回现场合成，界面会标「临时登记」。
   */
  const advancedRecruit = async (level: number) => {
    const library = await readLibraryCards(1, { exclude: usedCardIds(state) });
    const card = library.ok ? library.cards[0] : undefined;
    if (card) {
      perform({ type: 'advancedRecruit', level, cards: [{ ...card, girl: normalizeToLevel(card.girl, level) }] });
      return;
    }
    perform({ type: 'advancedRecruit', level });
  };

  /** 首夜空缺：先本地兜底，有 key 再让叙事者补上委托与弹窗。 */
  const [openingBusy, setOpeningBusy] = useState(false);
  const openingRunning = useRef(false);
  const fillOpening = async () => {
    if (openingRunning.current) return;
    openingRunning.current = true;
    setOpeningBusy(true);
    try {
      // 本地兜底先跑：没 key 也要有议题和待用事件，别让开局空着。
      const local = act(state, { type: 'openingFill' });
      const base = local.ok ? local.state : state;
      if (local.ok) setState(local.state);
      if (!llmHasKey()) return;
      if (!canAcceptGeneratedContent(base).ok) return;
      const config = loadLlmConfig();
      const daily = await generateDaily(config, base, worldBrief(base), taskRuntime(boundPreset('daily', presets, binding), 'daily'));
      if (!daily.ok) { notify(`叙事者这次没接上：${daily.message}。今夜先用本地内容开着。`, false); return; }
      const content = materializeNightProposal(daily.data, base);
      // 用函数式更新落地，等模型这段时间里玩家点过的东西不会被盖掉。
      setState(prev => { const applied = act(prev, { type: 'addGeneratedContent', ...content }); return applied.ok ? applied.state : prev; });
      const batch = await generateIncidentBatch(config, base, taskRuntime(boundPreset('incident', presets, binding), 'incident'));
      if (!batch.ok) return;
      setState(prev => { const merged = act(prev, { type: 'mergeIncidentPool', entries: batch.data.entries }); return merged.ok ? merged.state : prev; });
    } finally {
      openingRunning.current = false;
      setOpeningBusy(false);
    }
  };
  /** 这一局是不是「从头开始」：读档进来的不动首夜，只在每天开门时由换日逻辑处理。 */
  const openingFilledOnce = useRef(false);
  useEffect(() => {
    // 等存档读完再补首夜：否则会拿默认名册去写提案，模型写出来的全是内置角色。
    if (phase !== 'play' || !booted || !loaded) return;
    // 读档进来的一局：首夜该补的在当时就补过了，不要在载入时又补一份提案与委托。
    // 这里只处理「刚开的一局」——它没有 hadSave，且是从编成/序章走到正片的。
    if (openingFilledOnce.current) return;
    // 只在「名册定下 + 序章看完」之后才允许补齐：那之前玩家还没挑人，补出来的全是默认角色。
    if (!state.startersPicked || !state.prologueSeen) return;
    openingFilledOnce.current = true;
    if (hadSave) return;
    // 只补「首夜」：补过（openingFilledAt ≠ 0）就交给每日自动补充，不再插手。
    if (state.openingFilledAt !== 0) return;
    void fillOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, booted, loaded, state.openingFilledAt]);

  // 市场补货：每天只补一次，买走候选不会当场刷新窗口；售罄空位留到次日。
  const marketEmptyDay = useRef(0);
  const marketRefillDay = useRef(0);
  const refilling = useRef(false);
  const refillMarketFromCards = async () => {
    if (refilling.current) return;
    refilling.current = true;
    try {
      const box = await loadCardBox();
      const gap = marketCardGap(state);
      if (gap > 0) {
        const picks = unusedCards(box, state, gap);
        if (picks.length) {
          // 异步取卡回来同样合并到最新状态上。
          const cards = await cardboxCards(picks.map(entry => entry.hash));
          setState(prev => { const applied = act(prev, { type: 'refillMarket', cards }); return applied.ok ? applied.state : prev; });
        }
      }
      if (marketNeedsCards(state, box) && marketEmptyDay.current !== state.day) {
        marketEmptyDay.current = state.day;
        notify('卡库里的卡都用完了。去契约卡库加几张新的，市场会自己补货。', false);
      }
    } catch { /* 卡库读不出来就不补，不挡路。 */ } finally {
      refilling.current = false;
    }
  };
  useEffect(() => {
    if (phase !== 'play' || !booted || !loaded) return;
    if (marketRefillDay.current === state.day) return;
    const firstThisSession = marketRefillDay.current === 0;
    marketRefillDay.current = state.day;
    // 读档回到同一天：货架保持存档里的样子，不要一进来就补货。
    if (firstThisSession && hadSave) return;
    if (marketCardGap(state) <= 0) return;
    void refillMarketFromCards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, booted, loaded, state.day]);

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
          '  proposal                          每日提案立即补充（先补待用事件，再补议题）',
          '  news [主持人]                     立即生成今晚的访谈（可选：指定主持人）',
          '  variants [restore]                检查 / 补回表情差分（资产库与卡面原文两条路）',
          '  witch <名字>                      让指定少女立刻魔女化（调试）',
          '  reset <名字>                      把指定少女重置回初始状态（调试，不可撤销）',
          '  contract <卡名>                   从卡库直接契约一位少女（调试，免费、不看席位）',
          '  remove <名字>                     移除一位已契约的少女（调试，连带清理派遣/关系/故事线）',
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
      case 'proposal': case '提案': case '补充': {
        // 先把本地能补的补齐（待用事件），再看议题缺不缺；缺就当场请叙事者写一轮。
        const filled = act(state, { type: 'openingFill' });
        if (filled.ok) setState(filled.state);
        const gaps = openingGaps(filled.ok ? filled.state : state);
        if (gaps.opinions <= 0) return `${filled.message} 议题已经满了（还缺 ${gaps.opinions} 条）。`;
        const result = await generateContent();
        return `${filled.message} 议题还缺 ${gaps.opinions} 条 → ${result.message || (result.ok ? '叙事者补充完成。' : '生成失败。')}`;
      }
      case 'news': case '访谈': {
        // v167：立刻把今晚这档访谈生成出来（不推进时间，也不看是不是到点）。
        const current = latestState.current ?? state;
        // v176：第一天也能手动生成访谈（自动流程仍然只在第一夜播开场那一条）。
        if (loadBalance().cityNewsEnabled !== 1) return '城市新闻已在「世界书 → 数值」里关掉了。';
        // 可选：news <名字> 先换主持人再开节目。
        if (arg) {
          const pool = newsCastPool(current);
          const picked = pool.find(person => person.id === arg) ?? pool.find(person => person.name.includes(arg) || person.title.includes(arg));
          if (!picked) return `现场没有「${arg}」。今晚能干活的：${pool.map(person => person.name).join('、') || '一个都没有'}`;
          const applied = act(current, { type: 'setNewsHost', girlId: picked.id });
          if (!applied.ok) return applied.message;
          setState(applied.state);
          const made = await refreshCityNews('manual', applied.state);
          return `${picked.name}接下今晚的主持。${made ? `节目已重新生成（${made.lines?.length ?? 0} 句）。` : '节目没生成出来。'}`;
        }
        if (newsBusyRef.current) return '节目还在写，等这一档出来。';
        const made = await refreshCityNews('manual', current);
        return made
          ? `第 ${made.day} 日的访谈已就绪：${made.headline}（${made.source === 'llm' ? '叙事者' : '本地快报'}，${made.lines?.length ?? 0} 句，主持人 ${made.host?.name ?? '无'}）`
          : '节目没有生成出来，原因看上面的提示。';
      }
      case 'prompt': case '提示词': {
        // v177：审查用 —— 把最近几次请求的 system / user 原样打出来，不发新请求。
        const log = loadLlmLog();
        if (!log.length) return '还没有请求记录：先让叙事者跑一次，再回来敲 prompt。';
        const wanted = Number.parseInt(arg, 10);
        const count = Number.isFinite(wanted) && wanted > 0 ? Math.min(wanted, 5) : 1;
        const blocks = log.slice(0, count).reverse().map((entry: LlmLogEntry) => {
          const lines = [`[${entry.kind}] 预设：${entry.request?.preset ?? '未记录'} · 模型 ${entry.model}`];
          for (const section of entry.request?.sections ?? []) lines.push('', `── ${section.label} ──`, section.text);
          return lines.join('\n');
        });
        return blocks.join('\n\n');
      }
      case 'variants': case '表情': {
        // v175：差分不见了先别开新档 —— 先看它躺在资产库还是卡面原文里。
        const current = latestState.current ?? state;
        if (arg === 'restore' || arg === '恢复') {
          const result = await recoverVariants(current);
          const fixed = result.reports.filter(report => report.total > report.inline);
          if (!fixed.length) return '没有可补的差分：资产库读不回、卡面原文里也没有。';
          setState(result.state);
          const lines = fixed.map(report => `${report.name} +${report.total - report.inline}（资产 ${report.resolvable} / 卡面 ${report.fromCard}）`);
          return `补回 ${fixed.length} 人的表情差分：\n${lines.join('\n')}`;
        }
        const reports = await diagnoseVariants(current);
        if (!reports.length) return '名册里还没有人。';
        const lines = reports.map(report => `${report.name}：内联 ${report.inline} · 资产 ${report.assets}（可读 ${report.resolvable}）${report.cardId ? ` · 卡 ${report.cardId.slice(0, 8)}` : ' · 没有卡号'}`);
        return ['差分体检（`variants restore` 可尝试补回）：', ...lines].join('\n');
      }
      case 'contract': case '契约': case '招收': {
        // 从卡库按名字/代号找一张卡，读原文后直接契约（不收费、不看席位）。
        if (!arg) return '用法：contract <卡面名字或代号的一部分>';
        const box = await loadCardBox().catch(() => []);
        if (!box.length) return '卡库读不出来，或者里面没有卡。';
        const hit = box.find(entry => entry.name.includes(arg) || (entry.codename ?? '').includes(arg));
        if (!hit) return `卡库里没有匹配「${arg}」的卡。`;
        const cards = await cardboxCards([hit.hash]).catch(() => []);
        const card = cards[0];
        if (!card) return `「${hit.name}」这张卡读不出来（原文可能已损坏）。`;
        const result = act(state, { type: 'debugContractCard', card });
        if (!result.ok) return result.message;
        setState(result.state);
        return `${result.message} 卡库来源：${hit.name}`;
      }
      case 'remove': case '移除': case '剔除': {
        const target = state.girls.find(girl => girl.id === arg || girl.name === arg || girl.codename === arg || (arg && girl.name.includes(arg)));
        if (!target) return `名册里没有「${arg}」（这条命令只移除已契约的少女）。`;
        const result = act(state, { type: 'debugRemoveGirl', girlId: target.id });
        if (!result.ok) return result.message;
        setState(result.state);
        return result.message;
      }
      case 'witch': case '魔女化': {
        const target = [...state.girls, ...state.candidates].find(girl => girl.id === arg || girl.name === arg || girl.codename === arg || (girl.name.includes(arg) && arg));
        if (!target) return `找不到契约者「${arg}」。`;
        const result = act(state, { type: 'debugGirl', girlId: target.id, mode: 'witch' });
        if (!result.ok) return result.message;
        setState(result.state);
        return result.message;
      }
      case 'reset': case '重置': {
        const target = [...state.girls, ...state.candidates].find(girl => girl.id === arg || girl.name === arg || girl.codename === arg || (girl.name.includes(arg) && arg));
        if (!target) return `找不到契约者「${arg}」。`;
        const result = act(state, { type: 'debugGirl', girlId: target.id, mode: 'reset' });
        if (!result.ok) return result.message;
        setState(result.state);
        return result.message;
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
    ?? (incidentFocus ? pendingIncidents.find(incident => incident.id === incidentFocus) : undefined)
    // 没有任何阻塞事件时，也把最新一条还没推迟过的摆出来：事件本来就该自己找上门。
    ?? openIncidentFor(state, deferredIncidents);
  const startStory = (girlId: string) => {
    const target = state.girls.find(item => item.id === girlId);
    if (!target?.storyPlan) { notify('先生成或画一张故事蓝图，再按蓝图开场。', false); return; }
    perform({ type: 'startStoryline', girlId });
  };
  const generateBlueprint = async (girlId: string, slot = 1) => {
    if (storyBusy) return;
    const target = state.girls.find(item => item.id === girlId);
    if (!target) return;
    const wanted = Math.max(1, Math.min(3, Math.round(slot)));
    setStoryBusy(girlId);
    setStoryNotice(null);
    try {
      const result = await generateStoryBlueprint(loadLlmConfig(), target, undefined, taskRuntime(boundPreset('storyline', presets, binding), 'storyline'), latestState.current ?? state, { slot: wanted });
      const priorEnding = [...(latestState.current ?? state).storylines]
        .filter(story => story.girlId === girlId && story.status === 'done')
        .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))
        .at(-1)?.ending;
      if (result.ok) {
        const plan: StoryPlan = { title: result.data.title, premise: result.data.premise, tone: result.data.tone, beats: [], graph: result.data.graph, continuesFrom: wanted > 1 ? priorEnding : undefined };
        if (!perform({ type: 'setStoryPlan', girlId, plan, slot: wanted }, true)) return;
        setModal({ type: 'story-graph', id: girlId, slot: wanted });
        notify(`第 ${wanted} 段蓝图写好了：${result.data.graph.nodes.length} 个节点、${result.data.graph.nodes.filter(node => node.kind === 'end').length} 个结局。先检查，再按蓝图开场。`);
        return;
      }
      if (planForSlot(target, wanted)) {
        notify(`这次没有重写蓝图：${result.message} 原来的蓝图还在。`, false);
        return;
      }
      const plan = fallbackStoryPlan(target);
      if (!perform({ type: 'setStoryPlan', girlId, plan, slot: wanted }, true)) return;
      setStoryNotice(`这次生成没有通过：${result.message} 先用本地四幕模板起了一张蓝图，你可以直接改。`);
      setModal({ type: 'story-graph', id: girlId, slot: wanted });
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
    const result = await generateEvent(loadLlmConfig(), target, storyline ? { title: storyline.title, premise: storyline.premise } : undefined, taskRuntime(boundPreset('event', presets, binding), 'event'), latestState.current ?? state);
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
      // v34：进入角色剧情就是交互模式，开场白由 App 里的效果补生成。
      mode: 'session',
      cast: [girlId],
      opening: '',
      turns: [],
      sessionDone: false,
      stage: 0, status: 'active', day: state.day, source: data ? 'llm' : 'template', badge: true,
    };
    // 生成事件时可能已经过去几十秒：写回时以最新状态为准，别把期间的剧情回合覆盖掉。
    let added = false;
    let rejected = '';
    setState(prev => {
      const applied = act(prev, { type: 'addCharacterEvent', event });
      if (!applied.ok) { rejected = applied.message; return prev; }
      added = true;
      return applied.state;
    });
    if (added) setModal({ type: 'event', id: event.id });
    else notify(rejected, false);
  };  const selectedGirl = modal && 'id' in modal ? [...state.girls, ...state.candidates].find(g => g.id === modal.id) : undefined;
  const selectedMission = modal?.type === 'mission' ? state.missions.find(m => m.id === modal.id) : undefined;
  const selectedBattle = modal?.type === 'battle' || modal?.type === 'battle-note' ? state.battles.find(b => b.id === modal.id) : undefined;
  const selectedNote = modal?.type === 'battle-note' ? state.battleNotes?.find(note => note.battleId === modal.id) : undefined;
  const modalTitle = modal?.type === 'starter' ? '开局编成' : modal?.type === 'talk' ? (modal.remote ? '远程联络' : '灯下私语') : modal?.type === 'girl' ? '契约者详细档案' : modal?.type === 'wardrobe' ? '衣柜与礼装' : modal?.type === 'expression' ? '表情差分管理' : modal?.type === 'witch-form' ? '魔女化立绘' : modal?.type === 'mission' ? '委托详情与派遣' : modal?.type === 'settings' ? '游戏设置' : modal?.type === 'presets' ? '对话补全预设' : modal?.type === 'help' ? '夜班操作手册' : modal?.type === 'notifications' ? '事务所通知' : modal?.type === 'reset' ? '重置进度确认' : modal?.type === 'hire' ? '缔结契约' : modal?.type === 'build' ? '建造与扩建' : modal?.type === 'room' ? '基地房间详情' : modal?.type === 'battle' ? '战斗剧场' : modal?.type === 'codex' ? '魔物图鉴' : modal?.type === 'memorial' ? '星光纪念墙' : modal?.type === 'custom' ? '契约登记' : modal?.type === 'chronicle' ? '使魔编年史' : modal?.type === 'faction' ? `查看${factionInfo[modal.id].name}档案` : modal?.type === 'office' ? '事务所档案' : modal?.type === 'slots' ? '存档位' : modal?.type === 'cardbox' ? '契约卡库' : '安排派遣';
  const [cardCount, setCardCount] = useState(0);
  const modalKind = modal?.type ?? '';
  useEffect(() => {
    if (phase !== 'title') return;
    let alive = true;
    void loadCardBox().then(box => { if (alive) setCardCount(box.length); }).catch(() => { if (alive) setCardCount(0); });
    return () => { alive = false; };
  }, [phase, modalKind]);
  const titleHint = [
    cardCount > 0 ? `卡库里有 ${cardCount} 张契约卡；开局会先把最近导入的几张排进名册。` : '卡库里还没有卡，开局用默认的四位在编少女编成三方。',
    hadSave ? `上次停在第 ${state.day} 日。` : '',
  ].filter(Boolean).join(' ');
  const stabilityStage = cityStage(state.reputation);
  const durable = storeAvailable();

  // 进度还在 IndexedDB 里读，先给一块占位屏，避免闪一帧空档。
  if (!booted) {
    return (
      <div className="boot-splash" id="boot-splash" role="status">
        <span className="boot-mark">夜糖事务所</span>
        <p>正在读取档案…</p>
      </div>
    );
  }

  return <div className="app-shell">
    {!durable && (
      <div className="storage-warning" id="storage-warning" role="alert">
        <TriangleAlert size={13} />这台浏览器没给出可用的 IndexedDB（隐私模式或存储被禁用），本次进度不会被保存。
      </div>
    )}
    {phase === 'title' && (
      <TitleDialog
        cards={cardCount}
        hint={titleHint}
        onNew={() => void startNewGame('standard')}
        onLoad={() => setModal({ type: 'slots', boot: true })}
        onSettings={() => setModal({ type: 'settings', boot: true })}
        onBlank={() => void startNewGame('blank')}
        onStories={() => setModal({ type: 'stories' })}
      />
    )}
    {(phase === 'roster' || modal?.type === 'starter') && (
      <StarterDialog onDisableCard={girlId => perform({ type: 'deleteCandidate', girlId }, true)}
        state={state}
        forced={phase === 'roster'}
        randomize={phase === 'roster'}
        cardsOnly={boxUsable >= OPENING_CARDS}
        onConfirm={(girlIds, roster, custom, assistantId) => {
          if (!perform({ type: 'setStarters', girlIds, roster, customLeaders: custom.leaders, customGirls: custom.girls, assistantId })) return;
          setModal(null);
          // 只在开场编成时推进相位；从设置页重开编成不该把人送回序章。
          if (phase === 'roster') setPhase(state.prologueSeen ? 'play' : 'prologue');
        }}
        onAddCard={() => setModal({ type: 'cardbox' })}
        onAddCustom={() => setModal({ type: 'custom' })}
        onClose={() => setModal(null)}
      />
    )}
    {phase === 'prologue' && (
      <PrologueDialog beats={prologueFor(state)} onDone={() => { setState(prev => act(prev, { type: 'seenPrologue' }).state); enterPlay(); }} />
    )}
    <a id="skip-main-content" className="skip-link" href="#main-content">跳转到主要内容</a>
    <Navigation page={page} onPage={navigate} onHelp={() => setModal({ type: 'help' })} onSettings={() => setModal({ type: 'settings' })} onCodex={() => setModal({ type: 'codex' })} onMemorial={() => setModal({ type: 'memorial' })} onWorkshop={() => setModal({ type: 'workshop' })} memorialCount={state.memorial.length} />
    <Topbar state={state} saved={saved} onNotifications={() => setModal({ type: 'notifications' })} onCommand={() => setCmdOpen(true)} filling={phase === 'play' && openingBusy} />
    <main id="main-content" className={`app-main page-${page}`}>
      {page === 'dispatch' ? <>
        <PageHeading page={page}>
          <div className="heading-side">
            {/* v176：访谈面板常驻主页 —— 读档回来也不会消失，哪怕还没有播报。 */}
            <aside className="dispatch-news" id="dispatch-news" aria-label="城市新闻">
              <header>
                <Radio size={12} />
                <b>夜间访谈</b>
                <span>{state.cityNews ? `第 ${state.cityNews.day} 日 · ${state.cityNews.source === 'llm' ? '叙事者' : '本地快报'}` : newsEnabled ? '等待播报' : '已在数值里关闭'}</span>
                <button id="dispatch-news-refresh" type="button" disabled={newsBusy || !newsEnabled} onClick={() => void refreshCityNews('manual')}>{newsBusy ? '正在写' : '刷新'}</button>
              </header>
              <button
                id="dispatch-news-open"
                type="button"
                className="news-open"
                onClick={() => setModal({ type: 'news' })}
                title="点开看完整访谈，并在这里换主持人"
              >
                <h3>{state.cityNews?.headline ?? '今晚的节目还在准备。'}</h3>
              </button>
              {state.cityNews?.host && (
                <div className="news-host" id="dispatch-news-host-line">
                  <span className="news-host-badge">主持人</span>
                  <b>{state.cityNews.host.name}</b>
                  <small>{state.cityNews.host.title}</small>
                  <select
                    id="dispatch-news-host"
                    className="news-host-pick"
                    aria-label="换主持人"
                    value={state.cityNews.host.id}
                    onChange={input => changeNewsHost(input.target.value)}
                  >
                    {newsCastPool(state).map(person => <option key={person.id} value={person.id}>{person.name} · {person.title}</option>)}
                  </select>
                </div>
              )}
              {state.cityNews?.lines?.length ? (
                <NewsTicker news={state.cityNews} />
              ) : (
                <ul>
                  {(state.cityNews?.items ?? []).slice(0, 2).map((item, index) => <li key={`${item.tone}-${index}`} className={`tone-${item.tone}`}>{item.text}</li>)}
                  {!state.cityNews?.items.length && <li className="tone-street">{newsEnabled ? '节目还没开始，点开这一块，或者点右上角「刷新」。' : '城市新闻在「世界书 → 数值」里关掉了；打开后会重新播。'}</li>}
                </ul>
              )}
            </aside>
            <div className="shift-badge"><span className="signal-dot" /><span>夜班契约进行中</span><small>第 014 号值班席 · 灵魂天平</small></div>
          </div>
        </PageHeading>

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
                      <small>代表：{representativeNameOf(state, fid)}</small>
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
          <button
            id="dispatch-office-card"
            type="button"
            className="world-faction-card world-office-card tone-neutral"
            onClick={() => setModal({ type: 'office' })}
            title="打开事务所档案与玩家档案"
          >
            <div className="world-faction-top">
              <span className="world-faction-seal world-office-seal">所</span>
              <div>
                <strong>事务所档案</strong>
                <small>代表：{representativeOf(state)?.name ?? '尚未任命'}</small>
              </div>
              <span className="world-faction-attitude">中立</span>
            </div>
            <div className="world-office-bar"><Feather size={11} />编辑档案，写下理念与目标</div>
            <div className="world-faction-foot">
              <span>玩家 <b>{loadPlayerProfile().name.trim() || '未命名'}</b></span>
              <em>点击打开</em>
            </div>
          </button>
        </section>

        <TaskPanel state={state} onOpen={openTask} onNavigate={() => navigate('base')} />
        {state.blank && state.girls.length === 0 && (
          <div className="blank-hint" id="blank-hint" role="status">
            <b>这间事务所还空着。</b>
            <p>没有契约者，连灯都是别人替她点的。先从卡库挑一张，或者现场登记一位。</p>
            <div className="blank-hint-actions">
              <button id="blank-hint-cards" type="button" className="btn" onClick={() => setModal({ type: 'cardbox' })}>打开契约卡库</button>
              <button id="blank-hint-custom" type="button" className="btn ghost" onClick={() => setModal({ type: 'custom' })}>登记一位</button>
            </div>
          </div>
        )}

        <div className="dispatch-layout">
          <DispatchMap state={state} onMission={id => setModal({ type: 'mission', id })} onFront={id => setModal({ type: 'front', id })} onDropGirl={(girlId, id) => setModal({ type: 'mission', id, girlId })} />
          <div className="roster-slot">
            <Roster showPoints={girl => shouldShowPointBadge(girl, state.levelUpMode, pointsMuted)} state={state} onGirl={girl} onMarket={() => navigate('market')} />
          </div>
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
          onAcceptTask={(faction, girlId, hours, amount) => perform({ type: 'acceptFactionTask', faction, girlId, hours, amount })}
          onPreviewEnvoy={faction => setModal({ type: 'envoy', id: faction })}
            onBorrowStability={(faction, points) => perform({ type: 'borrowStability', faction, points })}
          onClinic={(girlId, mode, kink) => perform({ type: 'clinic', girlId, mode, kink })}
          onCare={(girlId, mode) => perform({ type: 'care', girlId, mode })}
          onAssistant={girlId => perform({ type: 'setAssistant', girlId })}
          onUseItem={(girlId, itemId) => perform({ type: 'useItem', girlId, itemId })}
          onCouncil={() => navigate('council')}
          onOffice={() => setModal({ type: 'office' })}
          onCraft={materials => perform({ type: 'craftEquipment', materials })}
          onRefine={target => perform({ type: 'refineEquipment', target })}
        />
        </>
      ) : page === 'worldbook' ? (
        <>
          <PageHeading page="worldbook" />
          <WorldbookView onOpenOffice={() => setModal({ type: 'office' })} />
        </>
      ) : page === 'council' ? (
        <CouncilView state={state} onDecide={(opinionId, decision) => perform({ type: 'decideOpinion', opinionId, decision })} onGirl={girl} onMeeting={() => setModal({ type: 'meeting-plan' })} onMeetingRecords={() => setModal({ type: 'meeting-records' })} onOpenMeeting={eventId => setModal({ type: 'event', id: eventId })} />
      ) : page === 'market' ? (
        <MarketView state={state} onGirl={girl} onHire={id => setModal({ type: 'hire', id })} onRemote={id => talk(id, true)} onImportCard={importCard} onRehire={id => perform({ type: 'rehire', girlId: id })} onBuyItem={(itemId, stockId) => perform({ type: 'buyItem', itemId, stockId })} onRenew={id => perform({ type: 'renewContract', girlId: id })} onUpgradeMarket={() => perform({ type: 'upgradeMarket' })} onAdvancedRecruit={level => void advancedRecruit(level)} onFillFromLibrary={() => void fillFromLibrary(3)} onCustom={() => setModal({ type: 'custom' })} onCardbox={() => setModal({ type: 'cardbox' })} />
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
    <div className="toast-region" role="status" aria-live="polite" aria-atomic="false">{toasts.slice(0, 3).map(entry => <div className={`game-toast ${entry.ok ? '' : 'warning'}`} key={entry.id}>{entry.ok ? <Check size={18} /> : <Info size={18} />}<p>{entry.message}</p><button id={`dismiss-toast-${entry.id}`} onClick={() => setToasts(list => dismissToast(list, entry.id))} aria-label="关闭提示"><X size={15} /></button></div>)}</div>
    {modal && modal.type !== 'event' && modal.type !== 'story-graph' && modal.type !== 'workshop' && modal.type !== 'battle-note' && modal.type !== 'starter' && <Dialog label={modalTitle} onClose={() => setModal(modal.type === 'expression' || modal.type === 'witch-form' ? { type: 'girl', id: modal.id } : null)} wide={modal.type === 'girl' || modal.type === 'talk' || modal.type === 'battle' || modal.type === 'codex' || modal.type === 'memorial' || modal.type === 'custom' || modal.type === 'chronicle' || modal.type === 'presets' || modal.type === 'wardrobe' || modal.type === 'expression' || modal.type === 'witch-form' || modal.type === 'faction' || modal.type === 'office' || modal.type === 'cardbox'}>
      {modal.type === 'girl' && selectedGirl && <CharacterDialog key={`girl-${selectedGirl.id}`} girl={selectedGirl} state={state} onCare={mode => perform({ type: 'care', girlId: selectedGirl.id, mode })} onTalk={() => talk(selectedGirl.id)} onAssign={() => setModal({ type: 'assign', id: selectedGirl.id })} onHire={() => setModal({ type: 'hire', id: selectedGirl.id })} onRetire={() => { if (perform({ type: 'retire', girlId: selectedGirl.id })) setModal(null); }} onClinic={(mode, kink) => perform({ type: 'clinic', girlId: selectedGirl.id, mode, kink })} onAssistant={() => perform({ type: 'setAssistant', girlId: state.assistantId === selectedGirl.id ? undefined : selectedGirl.id })} onRemote={() => talk(selectedGirl.id, true)} onRenew={() => perform({ type: 'renewContract', girlId: selectedGirl.id })} onRehire={() => perform({ type: 'rehire', girlId: selectedGirl.id })} onChangeOutfit={outfitId => perform({ type: 'changeOutfit', girlId: selectedGirl.id, outfitId })} onExpression={expression => perform({ type: 'setExpression', girlId: selectedGirl.id, expression })} onExpressionVariants={() => setModal({ type: 'expression', id: selectedGirl.id })} onWardrobe={() => setModal({ type: 'wardrobe', id: selectedGirl.id })} onStory={() => startStory(selectedGirl.id)} onStoryBlueprint={(slot?: number) => void generateBlueprint(selectedGirl.id, slot ?? 1)} onStoryRegenerate={(slot?: number) => { if (window.confirm('重新生成会覆盖这一段的蓝图，确定吗？')) void generateBlueprint(selectedGirl.id, slot ?? 1); }} onStoryGraph={(slot?: number) => { setStoryNotice(null); setModal({ type: 'story-graph', id: selectedGirl.id, slot: slot ?? 1 }); }} storyBusy={storyBusy === selectedGirl.id}
          onStoryMission={(missionId) => setModal({ type: 'mission', id: missionId })} onStoryChoice={(storylineId, beatId, choiceId) => perform({ type: 'decideStoryChoice', storylineId, beatId, choiceId })} onStoryPort={(storylineId, port) => perform({ type: 'chooseStoryPort', storylineId, port })} onEvent={() => void startEvent(selectedGirl.id)} onWitch={() => { if (selectedGirl.witch) perform({ type: 'setWitchForm', girlId: selectedGirl.id, outfit: null }); else if (selectedGirl.witchForm) perform({ type: 'setWitchForm', girlId: selectedGirl.id, outfit: selectedGirl.witchForm }); else setModal({ type: 'witch-form', id: selectedGirl.id }); }} onWitchForm={() => setModal({ type: 'witch-form', id: selectedGirl.id })} onWitchFile={file => setModal({ type: 'witch-form', id: selectedGirl.id, portraitFile: file })} onPersonality={text => perform({ type: 'setPersonality', girlId: selectedGirl.id, text })} onProfileText={(field, text) => perform({ type: 'setProfileText', girlId: selectedGirl.id, field, text })} memories={finishedSessionEvents(state, selectedGirl.id).map(event => ({ id: event.id, title: event.title, day: event.day, rounds: (event.turns ?? []).filter(turn => turn.role === 'player').length, summary: event.summary }))} onMemory={eventId => setModal({ type: 'event', id: eventId })} portraitBroken={portraitMissing(selectedGirl)}
            onOutfitDescription={(outfitId, text) => perform({ type: 'setOutfitDescription', girlId: selectedGirl.id, outfitId, description: text })}
            onWitchDescription={text => { const outfit = selectedGirl?.witchForm; if (!outfit) return; perform({ type: 'setWitchForm', girlId: selectedGirl.id, outfit: { ...outfit, description: text }, personality: selectedGirl.witchPersonality }); }} onPortraitFile={async file => {
        try {
          const dataUrl = await resizeImageFile(file);
          perform({ type: 'setPortrait', girlId: selectedGirl.id, portrait: dataUrl });
        } catch { notify('这张图读不出来：换一张 JPG / PNG。', false); }
      }} onAllocateMany={plan => perform({ type: 'allocateStats', girlId: selectedGirl.id, plan })} onMutePoints={() => mutePoints(selectedGirl.id, selectedGirl.unspentPoints ?? 0)} onEquip={(itemId, slot) => perform({ type: 'equipItem', girlId: selectedGirl.id, itemId, slot })} onUnequip={slot => perform({ type: 'unequipItem', girlId: selectedGirl.id, slot })} onUseItem={itemId => perform({ type: 'useItem', girlId: selectedGirl.id, itemId })} onExportCard={() => exportCard(selectedGirl.id)} />}
      {modal.type === 'wardrobe' && selectedGirl && <WardrobeDialog girl={selectedGirl} state={state} onImport={(outfits, mode) => perform({ type: 'importWardrobe', girlId: selectedGirl.id, outfits, mode })} onRemove={outfitId => perform({ type: 'removeOutfit', girlId: selectedGirl.id, outfitId })} onDescribe={describeOutfit} onDescribeSaved={(outfitId, description) => perform({ type: 'setOutfitDescription', girlId: selectedGirl.id, outfitId, description })} onClose={() => setModal({ type: 'girl', id: selectedGirl.id })} />}
      {modal.type === 'expression' && selectedGirl && <ExpressionVariantDialog key={`expression-${selectedGirl.id}`} girl={selectedGirl} onSave={(key, dataUrl) => perform({ type: 'setVariant', girlId: selectedGirl.id, key, dataUrl })} onSaveMany={variants => perform({ type: 'setVariants', girlId: selectedGirl.id, variants })} onRemove={key => perform({ type: 'deleteVariant', girlId: selectedGirl.id, key })} onClose={() => setModal({ type: 'girl', id: selectedGirl.id })} />}
      {modal.type === 'witch-form' && selectedGirl && <WitchFormDialog key={`witch-form-${selectedGirl.id}`} girl={selectedGirl} initialFile={modal.portraitFile} onSave={(outfit, personality) => perform({ type: 'setWitchForm', girlId: selectedGirl.id, outfit, personality, activate: false })} onDescribe={portrait => describeWitchForm(selectedGirl, portrait)} onRemove={() => perform({ type: 'clearWitchForm', girlId: selectedGirl.id })} onSuppress={() => perform({ type: 'suppressWitch', girlId: selectedGirl.id })} onClose={() => setModal({ type: 'girl', id: selectedGirl.id })} />}
      {modal.type === 'mission' && selectedMission && <MissionDialog key={`${modal.id}-${modal.girlId ?? ''}`} state={state} mission={selectedMission} initialGirlId={modal.girlId} onGirl={girl} onEnemy={id => setModal({ type: 'codex', id })} onBattle={id => setModal({ type: 'battle', id })} onDispatch={(girlIds, missionId) => { if (perform({ type: 'dispatch', girlIds, missionId })) setModal(null); }} />}
      {modal.type === 'talk' && selectedGirl && <Conversation key={`talk-${selectedGirl.id}`} girl={selectedGirl} state={state} remote={modal.remote} modelEnabled={llmHasKey()} onSend={text => sendTalk(selectedGirl.id, text, modal.remote)} />}
      {modal.type === 'assign' && <AssignmentPicker state={state} girlId={modal.id} onSelect={id => setModal({ type: 'mission', id, girlId: modal.id })} />}
      {modal.type === 'hire' && selectedGirl && <HireDialog girl={selectedGirl} state={state} onConfirm={() => { if (perform({ type: 'hire', girlId: selectedGirl.id })) setModal(null); }} />}
      {modal.type === 'build' && <BuildDialog state={state} initialRoom={modal.id} onConfirm={roomId => { if (perform({ type: 'build', roomId })) setModal(null); }} />}
      {modal.type === 'room' && <RoomDialog state={state} id={modal.id} onGirl={girl} onTalk={talk} onBuild={() => setModal({ type: 'build', id: modal.id })} onDecide={(opinionId, decision) => perform({ type: 'decideOpinion', opinionId, decision })} onStartExpedition={ids => perform({ type: 'startExpedition', memberIds: ids })} onRecall={id => perform({ type: 'recallExpedition', expeditionId: id })} onClinic={(girlId, mode, kink) => perform({ type: 'clinic', girlId, mode, kink })} onRest={girlId => perform({ type: 'care', girlId, mode: 'resting' })} onAcceptTask={faction => perform({ type: 'acceptFactionTask', faction })} />}
      {proposalError && (
        <div className="proposal-retry" role="alert" id="proposal-retry-panel">
          <span>{proposalError}</span>
          <button id="proposal-retry" type="button" className="btn small" onClick={() => void generateContent('manual')}>重新生成</button>
          <button type="button" className="llm-reset" aria-label="关闭" onClick={() => setProposalError(null)}>×</button>
        </div>
      )}
      {starterLoad && <StarterLoading done={starterLoad.done} total={starterLoad.total} note={starterLoad.note} />}
      {modal.type === 'battle' && selectedBattle && <BattleReport key={selectedBattle.id} battle={selectedBattle} girls={[...state.girls, ...state.candidates]} hasNote={Boolean(state.battleNotes?.some(note => note.battleId === selectedBattle.id))} onNote={() => openBattleNote(selectedBattle.id)} onClose={() => setModal(null)} />}
      {modal.type === 'codex' && <CodexDialog initialId={modal.id} extra={state.customMonsters} />}
      {modal.type === 'envoy' && <EnvoyPreviewDialog state={state} faction={modal.id} onAccept={(faction, girlId, hours, amount) => perform({ type: 'acceptFactionTask', faction, girlId, hours, amount })} onClose={() => setModal(null)} />}
      {modal.type === 'stories' && <StoryArchiveDialog onClose={() => setModal(null)} onWatch={story => void watchArchivedStory(story)} />}

      {/* v177：回看已保存的剧情 —— 读回立绘时给进度条，读完就用同一套演出界面（原文 / 舞台都能看）。 */}
      {replayLoad && <div className="story-overlay"><div className="standard-modal archive-load" id="story-replay-load" role="dialog" aria-modal="true" aria-label="正在读回这一段">
        <div className="modal-eyebrow">回看 · 正在读回这一段</div>
        <h2>{replayLoad.title}</h2>
        <div className="archive-load-track" role="progressbar" aria-valuenow={replayLoad.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${replayLoad.pct}%` }} /></div>
        <p className="muted">{replayLoad.note} · {replayLoad.pct}%</p>
        <div className="meeting-actions"><button id="story-replay-cancel" type="button" className="btn" onClick={() => setReplayLoad(null)}>取消</button></div>
      </div></div>}

      {storyReplay && <div className="story-overlay"><EventDialog
        vnStory={vnStory === 'on'}
        event={storyReplay.event}
        girl={storyPersonOf(state, storyReplay.event.girlId)?.girl}
        state={{ girls: state.girls, candidates: state.candidates }}
        castPool={storyReplay.castPool}
        readOnly
        onAdvance={() => {}}
        onChoose={() => {}}
        onTurn={async () => false}
        onRewrite={async () => false}
        onEditTurn={() => {}}
        onDeleteTurn={() => {}}
        onEnd={() => {}}
        onClose={() => setStoryReplay(null)}
      /></div>}
      {modal.type === 'news' && <NewsDialog state={state} news={state.cityNews} busy={newsBusy} presetName={boundPreset('news', presets, binding)?.name} onHost={changeNewsHost} onRefresh={() => void refreshCityNews('manual')} onClose={() => setModal(null)} />}
      {modal.type === 'meeting-plan' && <MeetingPlanDialog state={state} onStart={plan => {
        const before = new Set(state.events.map(event => event.id));
        const applied = act(state, { type: 'startMeeting', plan });
        if (!applied.ok) { notify(applied.message, false); return; }
        setState(applied.state);
        notify(applied.message, true);
        const made = applied.state.events.find(event => event.meeting && !before.has(event.id));
        setModal(made ? { type: 'event', id: made.id } : null);
      }} onClose={() => setModal(null)} />}
      {modal.type === 'meeting-records' && <MeetingRecordsDialog records={state.meetings ?? []} onReplay={eventId => {
        if (!state.events.some(event => event.id === eventId)) { notify('这一段剧情已经被存档裁剪掉了，只剩下这里的摘要。', false); return; }
        setModal({ type: 'event', id: eventId });
      }} onClose={() => setModal(null)} />}      {modal.type === 'faction' && <FactionDialog state={state} faction={modal.id} onHire={leaderId => perform({ type: 'hireLeader', leaderId })} onMeet={() => { const faction = modal.id; const existing = state.events.find(event => event.id === meetEventId(state, faction)); if (existing) { setModal({ type: 'event', id: existing.id }); return; } if (perform({ type: 'meetLeader', faction })) setModal({ type: 'event', id: meetEventId(state, faction) }); }} onOpenEvent={eventId => setModal({ type: 'event', id: eventId })} onBase={() => { setModal(null); navigate('base'); }} onClose={() => setModal(null)} />}
      {modal.type === 'office' && <OfficeDialog profile={state.office} girls={state.girls} assistantId={state.assistantId} onSave={profile => { if (perform({ type: 'setOfficeProfile', profile })) setModal(null); }} onAssistant={girlId => perform({ type: 'setAssistant', girlId })} onClose={() => setModal(null)} />}
      {modal.type === 'chronicle' && <ChronicleDialog state={state} />}
      {modal.type === 'memorial' && <MemorialDialog state={state} />}
      {modal.type === 'slots' && <SaveSlotsDialog boot={modal.boot} onSave={saveToSlot} onLoad={loadFromSlot} onDelete={deleteSlot} onRestart={restartGame} onLoadFile={loadLocalSave} onContinue={modal.boot && hadSave ? () => { setModal(null); enterPlay(); } : undefined} day={hadSave ? state.day : undefined} girls={hadSave ? state.girls.length : undefined} startersPicked={state.startersPicked} />}
      {modal.type === 'cardbox' && <CardLibraryDialog notify={notify} onImport={async (entries, onProgress) => {
        setStarterLoad({ done: 0, total: Math.max(1, entries.length), note: `正在读 ${entries.length} 张契约卡…` });
        const next = await importCardsInBatches(state, entries, (done, total) => {
          setStarterLoad({ done, total, note: `第 ${done} / ${total} 批读卡` });
          onProgress?.(done, total);
        });
        setStarterLoad(null);
        if (next === state) { notify('选中的卡都已经在名册里了。', false); return; }
        setState(next);
        setModal(null);
        notify(`已导入 ${entries.length} 张契约卡（分 ${planCardBatches(entries).length} 批读取）。`);
      }} />}
      {modal.type === 'custom' && <CustomGirlDialog onGenerate={draftGirlProfile} onCreate={draft => { if (perform({ type: 'createGirl', draft })) setModal(null); }} />}
      {modal.type === 'settings' && <SettingsDialog vnStory={vnStory} onVnStory={mode => { setVnStory(mode); saveVnStory(mode); }} boot={modal.boot} state={state} reduced={reduced} onReduced={setReduced} chime={chime} onChime={setChime} onExport={exportSave} onImport={importSave} onReset={() => setModal({ type: 'reset' })} onStarter={() => setModal({ type: 'starter' })} onCardbox={() => setModal({ type: 'cardbox' })} onSlots={() => setModal({ type: 'slots' })} onPoolLimit={(pool, value) => perform({ type: 'setPoolLimit', pool, value }, true)} onDeleteMission={missionId => perform({ type: 'deleteMission', missionId })} onDeleteCandidate={girlId => perform({ type: 'deleteCandidate', girlId })} onDeleteMonster={monsterId => perform({ type: 'deleteMonster', monsterId })} onGenerate={generateContent} autoGenerate={autoGenerate} onAutoGenerate={setAutoGenerate} onPresets={openPresetScope} levelUpMode={state.levelUpMode ?? 'auto'} onLevelUpMode={mode => perform({ type: 'setLevelUpMode', mode })} proposalCheck={proposalCheck} onProposalCheck={setProposalCheck} office={state.office} onOfficeProfile={profile => perform({ type: 'setOfficeProfile', profile })} />}
      {modal.type === 'presets' && <PresetDialog initialScope={modal.scope} initialPresetId={modal.presetId} presets={presets} binding={binding} onPresets={setPresets} onBinding={setBinding} onNotify={notify} />}
      {modal.type === 'help' && <HelpDialog />}{modal.type === 'notifications' && <NotificationsDialog state={state} />}{modal.type === 'reset' && <ResetDialog onConfirm={() => { perform({ type: 'reset' }); setAuto(false); setModal(null); }} />}
    </Dialog>}
      {modal?.type === 'battle-note' && selectedBattle && <BattleNoteDialog vnStory={vnStory === 'on'} battle={selectedBattle} note={selectedNote ?? null} girls={state.girls} busy={noteBusy} error={noteError} onGenerate={() => void writeBattleNote(selectedBattle)} onRegenerate={() => void writeBattleNote(selectedBattle)} onClose={() => { setModal({ type: 'battle', id: selectedBattle.id }); setNoteError(undefined); }} />}
      {modal?.type === 'story-graph' && selectedGirl && (
        <StoryGraphDialog
          girl={selectedGirl}
          slot={modal.slot ?? 1}
          incidents={library.incidents}
          roster={[...state.girls, ...state.candidates]}
          notice={storyNotice ?? undefined}
          onClose={() => { setStoryNotice(null); setModal({ type: 'girl', id: selectedGirl.id }); }}
          onSave={(graph, meta) => {
            const slot = modal.slot ?? 1;
            const base = planForSlot(selectedGirl, slot) ?? storyPlanTemplate(`${selectedGirl.name}的故事`, '');
            const plan: StoryPlan = { ...base, graph, ...(meta ?? {}) };
            if (!perform({ type: 'setStoryPlan', girlId: selectedGirl.id, plan, slot }, true)) return;
            setStoryNotice(null);
            setModal({ type: 'girl', id: selectedGirl.id });
            notify(`第 ${slot} 段蓝图已保存：${graph.nodes.length} 个节点、${graph.nodes.filter(node => node.kind === 'end').length} 个结局。`);
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
            setState(current => ({ ...current, marketStock: withCustomStock(current.marketStock), customBosses: next.bosses }));
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
    {/* 弹窗事件排队：对话框或开场演出还开着时先不弹，避免盖掉玩家正在做的事。 */}
    {!modal && state.prologueSeen && pendingIncident && <IncidentDialog incident={pendingIncident} state={state} onChoose={optionId => { perform({ type: 'resolveIncident', incidentId: pendingIncident.id, ...(optionId ? { optionId } : {}) }); setIncidentFocus(null); }} onDefer={blockingPending.length ? undefined : () => setDeferredIncidents(list => [...list, pendingIncident.id])} onGirl={girl} />}
    {modal?.type === 'event' && (() => {
      const target = state.events.find(event => event.id === modal.id);
      if (!target) return null;
      const factionCast = [
        ...(state.customFactionLeaders ?? []),
        ...(state.customFactionGirls ?? []),
      ];
      // v121：主角与在场的人统一走 storyPersonOf —— 契约者、候选、追悼、三方名册都能认，
      // 「登门拜访首领」这类事件的 girlId 就是名册里的首领。
      const subject = storyPersonOf(state, target.girlId)?.girl;
      const castPool = [...state.girls, ...state.candidates, ...factionCast];
      if (target.mode === 'story') return <div className="story-overlay"><StoryPlayerDialog vnStory={vnStory === 'on'} event={target} girl={subject} busy={arcBusy === target.id} onChoose={(eventId, choiceId) => perform({ type: 'chooseStoryPassage', eventId, choiceId })} onClose={() => setModal(null)} /></div>;
      const dialog = <EventDialog vnStory={vnStory === 'on'} event={target} girl={subject} state={{ girls: state.girls, candidates: state.candidates }} busy={storyBusyTurn || arcBusy === target.id} onAdvance={eventId => perform({ type: 'advanceEvent', eventId })} onChoose={(eventId, choiceId) => perform({ type: 'resolveEvent', eventId, choiceId })} onTurn={submitStoryTurn} onRewrite={rewriteStoryTurn} onEditTurn={editStoryTurn} onDeleteTurn={deleteStoryTurn} castPool={castPool} onEnd={eventId => void endStorySession(eventId)} onSeed={seedStoryOpening} onArchive={archiveStoryNow} branch={(() => { const choice = pendingChoiceOf(state, target.girlId); return choice ? { storylineId: choice.storylineId, options: choice.options } : undefined; })()} onBranch={port => { const choice = pendingChoiceOf(state, target.girlId); if (!choice) return; if (perform({ type: 'chooseStoryOption', eventId: target.id, storylineId: choice.storylineId, port })) setModal(null); }} readOnly={target.status === 'done'} onClose={() => setModal(null)} />;
      return target.mode === 'session' ? dialog : <div className="story-overlay">{dialog}</div>;
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
        <p className="muted">恢复会把当前进度替换为第 {pendingSave.day} 日、{pendingSave.girls.length} 位契约者、{pendingSave.gold.toLocaleString('zh-CN')} 星砂的存档。当前进度尚未自动备份，建议先取消并导出。</p>
        <div className="confirmation-facts">
          <span>目标日期<b>第 {pendingSave.day} 日</b></span>
          <span>契约者<b>{pendingSave.girls.length} 人</b></span>
          <span>星砂<b>{pendingSave.gold.toLocaleString('zh-CN')}</b></span>
        </div>
        <div className="settings-data-actions">
          <button id="import-save-confirm" className="btn primary" onClick={() => { const next = pendingSave; setState(next); setPendingSave(null); afterLoad(next); slimLoadedImages(next); notify(`已载入第 ${next.day} 日的存档。`); }}>确认覆盖并继续</button>
          <button id="import-save-cancel" className="btn" onClick={() => { setPendingSave(null); notify('已取消读取：当前进度没有变化，接下来存档会存这一局。', false); }}>取消读取（保留当前进度）</button>
        </div>
      </div>
    </Dialog>}
    {endingQueue[0] && <EndingDialog
      notice={endingQueue[0]}
      girlName={[...state.girls, ...state.candidates].find(girl => girl.id === endingQueue[0]!.girlId)?.name ?? '她'}
      onClose={() => setEndingQueue(queue => queue.slice(1))}
    />}
  </div>;
}
