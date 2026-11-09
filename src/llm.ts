import { outfitLine } from './outfitBrief.ts';
import { closeTruncatedJson } from './jsonRepair.ts';
import { persistLlmLog } from './llmLog.ts';
import { describeVertexCredential, normalizeVertexModel, vertexChat, vertexLocation, vertexTarget } from './vertex.ts';
import { focusGirlOf, focusRoleOf, personOfEvent } from './storyFocus.ts';
import { factionSnapshotText } from './factionSnapshot.ts';
import { storyPersonOf, type StoryPerson } from './storySubject.ts';
import { dailyHistoryBlock } from './opinionHistory.ts';
import { recentMissionRuns } from './missionHistory.ts';

/** openai = 任意 OpenAI 兼容接口；vertex = Google Vertex AI（服务账号 JSON 或 Express 密钥）。 */
export type LlmProvider = 'openai' | 'vertex';

export type LlmAuthMode = 'bearer' | 'x-api-key' | 'api-key' | 'header' | 'query' | 'none';
export type LlmPathMode = 'auto' | 'openai' | 'azure' | 'custom';

/** 反向代理常用配置；全部可选，缺省时行为与旧版一致。 */
export interface LlmProxyOptions {
  authMode?: LlmAuthMode;
  /** authMode = header 时的头名，例如 X-Proxy-Token。 */
  headerName?: string;
  /** authMode = query 时的参数名。 */
  apiKeyQuery?: string;
  extraHeaders?: Record<string, string>;
  pathMode?: LlmPathMode;
  /** pathMode = custom 时的路径模板，支持 {model}。 */
  customPath?: string;
}

export interface LlmConfig extends LlmProxyOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  /** 缺省按 OpenAI 兼容接口处理，老配置不需要迁移。 */
  provider?: LlmProvider;
  /** 仅 Vertex 用：区域，例如 us-central1 / asia-east1；global 走无区域前缀的主机。 */
  location?: string;
}

const KEY = 'night-sugar:llm-config';
const LOG_KEY = 'night-sugar:llm-log';

/** 一次请求实际读到的内容；用于「叙事引擎」浮窗回放。 */
export interface LlmSlot { index: number; name: string; role: string; tokens: number; enabled: boolean; marker: boolean; }

export interface LlmRequestSnapshot {
  /** 这次用的是哪个预设：日志里要能对得上，不然不知道读的是哪份词条。 */
  preset?: string;
  sections: { label: string; text: string }[];
  slots?: LlmSlot[];
  params: Record<string, string | number | boolean>;
  messageCount: number;
  truncated?: boolean;
}

export interface LlmResponseSnapshot {
  /** 模型这次真正返回的正文；解析失败时最需要看的就是它。 */
  text?: string;
  /** 超过 RESPONSE_TEXT_LIMIT 时只留开头，避免把 localStorage 撑爆。 */
  textTruncated?: boolean;
  reasoning?: string;
  finish?: string;
  usage?: { prompt?: number; completion?: number; total?: number };
}

/** 统一收口返回正文；日志保留完整文本，由 localStorage 写入失败时自动淘汰旧记录。 */
function responseTextOf(text: string | undefined): { text?: string; textTruncated?: boolean } {
  if (typeof text !== 'string') return {};
  const trimmed = text.trim();
  if (!trimmed) return { text: '' };
  return { text: trimmed };
}

export interface LlmLogEntry {
  id: string;
  at: string;
  kind: string;
  ok: boolean;
  model: string;
  endpoint: string;
  status?: number;
  durationMs: number;
  message: string;
  detail?: string;
  request?: LlmRequestSnapshot;
  response?: LlmResponseSnapshot;
}

const LOG_LIMIT = 40;

export function loadLlmLog(): LlmLogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LlmLogEntry[];
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string').slice(0, LOG_LIMIT) : [];
  } catch {
    return [];
  }
}

export function clearLlmLog() {
  try { localStorage.removeItem(LOG_KEY); } catch { /* session only */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('night-sugar:llm-log', { detail: { cleared: true } }));
}

function endpointHost(endpoint: string): string {
  try { return new URL(endpoint).host; } catch { return endpoint.slice(0, 60); }
}

/** 日志里的请求保留完整分段；不再按字符预算裁剪。 */
function trimRequest(request?: LlmRequestSnapshot): LlmRequestSnapshot | undefined {
  return request;
}

type LlmFinishListener = (info: { kind: string; ok: boolean }) => void;
let llmFinishListener: LlmFinishListener | undefined;

/** 注册「一次叙事者操作结束」的回调（目前只用来播完成提示音）；返回注销函数。 */
export function onLlmFinished(listener: LlmFinishListener): () => void {
  llmFinishListener = listener;
  return () => { if (llmFinishListener === listener) llmFinishListener = undefined; };
}

function recordLlmLog(entry: Omit<LlmLogEntry, 'id' | 'at' | 'endpoint'> & { endpoint: string }): LlmLogEntry {
  const full: LlmLogEntry = {
    ...entry,
    id: `llm_${Date.now().toString(36)}_${Math.floor(Math.random() * 999).toString(36)}`,
    at: new Date().toISOString(),
    endpoint: endpointHost(entry.endpoint),
    detail: entry.detail?.replace(/\s+/g, ' ').slice(0, 600),
    request: trimRequest(entry.request),
    response: entry.response,
  };
  try { llmFinishListener?.({ kind: entry.kind, ok: entry.ok }); } catch { /* 提示音出错不该影响请求结果 */ }
  try {
    let next = [full, ...loadLlmLog()].slice(0, LOG_LIMIT);
    // 请求段不再裁剪后，日志可能撞到 localStorage 配额；优先保住最新一条完整记录。
    while (next.length) {
      try {
        localStorage.setItem(LOG_KEY, JSON.stringify(next));
        break;
      } catch {
        next = next.slice(0, -1);
      }
    }
  } catch { /* logging must never break generation */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('night-sugar:llm-log', { detail: { entry: full } }));
  return full;
}

/** 日志里的「接口」一栏：Vertex 显示真实端点，而不是留在配置里的 OpenAI 地址。 */
export function llmEndpointLabel(config: LlmConfig): string {
  if (config.provider !== 'vertex') return config.endpoint;
  const info = describeVertexCredential(config.apiKey);
  const account = info.kind === 'service-account' ? { projectId: info.projectId ?? '', clientEmail: info.clientEmail ?? '', privateKey: '', tokenUri: '' } : undefined;
  return vertexTarget({ model: config.model || 'gemini-2.5-pro', location: vertexLocation(config.location), expressKey: account ? undefined : config.apiKey }, account).display;
}

function statusOf(message: string): number | undefined {
  const match = message.match(/服务返回\s*(\d{3})/);
  return match ? Number(match[1]) : undefined;
}

const EMPTY_RUNTIME: PresetRuntime = {
  id: '', name: '', maxContext: 12_000, main: '', jailbreak: '', entries: [],
  wiFormat: '{0}', scenarioFormat: '{{scenario}}', personalityFormat: '{{personality}}', regex: [],
};

/**
 * 固定拼装顺序：共用词条 → 任务词条 → 场景/性格/世界书 → 代码输出契约。
 * 代码契约永远在最后，预设词条不能覆盖 JSON 字段与枚举。
 */
function composePrompt(contract: string, runtime: PresetRuntime, scope: PromptScope, extra: Record<string, string | undefined> = {}, context?: string, ctx: MacroContext = {}, appendix = '') {
  const world = resolvePresetWorld(runtime, scope, extra);
  const vars = promptVars({ ...extra, world, context });
  if (vars.scenario) vars.scenario = applyFormat(runtime.scenarioFormat, vars.scenario);
  if (vars.personality) vars.personality = applyFormat(runtime.personalityFormat, vars.personality);
  const contextParts = [
    vars.scenario ? `【场景】\n${vars.scenario}` : '',
    vars.personality ? `【角色性格】\n${vars.personality}` : '',
    vars.worldbook ? `【世界书】\n${applyFormat(runtime.wiFormat, vars.worldbook)}` : '',
    // 这一场的动态内容（在场的人、此前对话、玩家这一句）：它不属于契约，
    // 所以放在契约前面——玩家改契约词条时不会把这段一起替换掉。
    appendix.trim(),
  ].filter(Boolean);
  // 契约与上下文分开传：预设里覆盖契约时只替换契约那一段，不动这一场的正文。
  const composed = composeTaskSystem(contract.trim(), runtime, scope, vars, ctx, typeof extra?.contractId === 'string' ? extra.contractId : undefined, contextParts.join('\n\n'));
  return { system: composed.system, vars, world, composed };
}

function presetParams(preset?: PresetRuntime): LlmCallParams | undefined {
  if (!preset) return undefined;
  const params: LlmCallParams = {};
  if (preset.temperature !== undefined) params.temperature = preset.temperature;
  if (preset.topP !== undefined) params.topP = preset.topP;
  if (preset.maxTokens !== undefined) params.maxTokens = preset.maxTokens;
  if (preset.presencePenalty !== undefined) params.presencePenalty = preset.presencePenalty;
  if (preset.frequencyPenalty !== undefined) params.frequencyPenalty = preset.frequencyPenalty;
  return Object.keys(params).length > 0 ? params : undefined;
}

export async function testLlmConnection(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  const started = Date.now();
  const result = await testLlmConnectionCore(config);
  recordLlmLog({ kind: '连接测试', ok: result.ok, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, message: result.message, endpoint: llmEndpointLabel(config) });
  return result;
}

export async function generateDaily(config: LlmConfig, state: GameState, context?: string, preset?: PresetRuntime): Promise<{ ok: true; data: NightProposalV2; warnings: string[] } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const result = await generateDailyCore(config, state, context, preset, meta);
  recordLlmLog({
    kind: '每日提案', ok: result.ok, model: logModel(meta, config), status: result.ok ? 200 : statusOf(result.message),
    durationMs: Date.now() - started, endpoint: llmEndpointLabel(config),
    message: result.ok ? `生成成功：${result.data.opinions?.length ?? (result.data.opinion ? 1 : 0)} 份议题 / ${result.data.mission.title}${result.warnings.length ? `（${result.warnings.length} 条软修正）` : ''}` : result.message,
    detail: result.ok ? undefined : result.message,
    request: meta.request, response: meta.response,
  });
  return result;
}

/** 联网考据的日志：进「叙事引擎」面板，方便核对查了什么、有没有来源。 */
export function logResearchEvent(entry: { ok: boolean; model: string; message: string; durationMs: number; detail?: string }): void {
  recordLlmLog({ kind: '联网考据', endpoint: 'Vertex AI · googleSearch', model: entry.model, ok: entry.ok, message: entry.message, detail: entry.detail, durationMs: entry.durationMs });
}

export interface GirlResearch {
  summary: string;
  sources: { title: string; uri: string }[];
}

export async function generateGirlProfile(config: LlmConfig, portrait?: string, hint?: string, preset?: PresetRuntime, research?: GirlResearch): Promise<{ ok: true; data: GeneratedGirlProfile } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const result = await generateGirlProfileCore(config, portrait, hint, preset, meta, research);
  recordLlmLog({
    kind: '角色起草', ok: result.ok, model: logModel(meta, config), status: result.ok ? 200 : statusOf(result.message),
    durationMs: Date.now() - started, endpoint: llmEndpointLabel(config),
    message: result.ok ? `起草成功：${result.data.name} / ${result.data.codename}${portrait ? '（已读取立绘）' : '（无立绘）'}${research ? '（联网考据）' : ''}` : result.message,
    detail: result.ok ? undefined : result.message,
    request: meta.request, response: meta.response,
  });
  return result;
}

export interface DialogueContext {
  girl: Girl; state: GameState; text: string; remote?: boolean;
}

export interface DialogueParseLimits {
  maxLines?: number;
  perLine?: number;
  totalLimit?: number;
  actionLimit?: number;
}

const DIALOGUE_EXPRESSIONS: Expression[] = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'];
const EXPRESSION_WORDS: Record<string, Expression> = {
  平静: 'calm', 微笑: 'smile', 笑: 'smile', 惊讶: 'surprise', 吃惊: 'surprise',
  难过: 'sad', 伤心: 'sad', 生气: 'angry', 愤怒: 'angry', 害羞: 'shy', 脸红: 'shy',
};

function expressionOf(value: unknown): Expression {
  if (typeof value !== 'string') return 'calm';
  const key = value.trim().toLowerCase() as Expression;
  if (DIALOGUE_EXPRESSIONS.includes(key)) return key;
  const chinese = EXPRESSION_WORDS[value.trim()];
  if (chinese) return chinese;
  // 模型有时会把枚举示例原样抄成「calm|smile|surprise」；取第一个认得的，别整句判成平静。
  for (const token of value.split(/[|\/／、,，\s]+/).map(part => part.trim()).filter(Boolean)) {
    const lower = token.toLowerCase() as Expression;
    if (DIALOGUE_EXPRESSIONS.includes(lower)) return lower;
    const mapped = EXPRESSION_WORDS[token];
    if (mapped) return mapped;
  }
  return 'calm';
}

function cleanLine(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ').trim()
    : '';
}

/** 模型偶尔会把动作写成括号；只去掉最外层一对，不猜内容。 */
function cleanAction(value: unknown): string {
  return cleanLine(value).replace(/^[（(]|[）)]$/g, '').trim();
}

/**
 * 把模型输出解析成 1–3 条「台词 + 动作 + 表情」。
 *
 * 优先 JSON；拿不到 JSON 时按换行拆成纯文本台词，绝不把整段原文硬塞进动作字段。
 * 解析在客户端做，模型返回格式不稳定的情况不会直接变成空回复。
 */
export function parseDialogueReply(raw: string, limits: DialogueParseLimits = {}): DialogueLine[] {
  const maxLines = Math.max(1, Math.min(3, limits.maxLines ?? 3));
  const perLine = Math.max(20, limits.perLine ?? 120);
  const totalLimit = Math.max(perLine, limits.totalLimit ?? 420);
  const actionLimit = Math.max(10, limits.actionLimit ?? 60);
  const parsed = extractJsonObject(raw);
  const source = parsed ? (Array.isArray(parsed.lines) ? parsed.lines : Array.isArray(parsed.messages) ? parsed.messages : null) : null;
  let rows: unknown[] = source ?? [];
  if (!source && raw.trim()) {
    rows = raw.split(/\n+/).map(line => line.trim()).filter(Boolean).slice(0, maxLines)
      .map(text => ({ text, expression: 'calm' }));
  }
  const lines: DialogueLine[] = [];
  let used = 0;
  for (const row of rows) {
    if (lines.length >= maxLines) break;
    const item = typeof row === 'string' ? { text: row } : row && typeof row === 'object' ? row as Record<string, unknown> : null;
    if (!item) continue;
    let text = cleanLine(item.text);
    let action = cleanAction(item.action);
    if (!text && !action) continue;
    if (action === text) action = '';
    if (text.length > perLine) text = text.slice(0, perLine).trim();
    if (action.length > actionLimit) action = action.slice(0, actionLimit).trim();
    if (used + text.length > totalLimit) {
      const room = Math.max(0, totalLimit - used);
      text = text.slice(0, room).trim();
      if (!text && !action) break;
    }
    if (!text && !action) continue;
    lines.push({ text, action: action || undefined, expression: expressionOf(item.expression) });
    used += text.length + (action ? 1 : 0);
  }
  return lines;
}

export function dialogueReplyText(lines: DialogueLine[]): string {
  return lines.map(line => line.text).filter(Boolean).join('\n');
}

const DIALOGUE_FORMAT_HINT = dialogueContract();

/** 回复被截断（额度用完）：OpenAI 系给 length，Vertex 归一后也是 length，保险起见再认一次 max_tokens。 */
export function isTruncatedFinish(finish: string | undefined): boolean {
  return Boolean(finish && (finish.toLowerCase() === 'length' || finish.toLowerCase().includes('max_tokens')));
}

/** 截断后重试的额度：至少翻倍，且不低于 2400；封顶 32768。 */
export function truncatedRetryBudget(maxTokens: number | undefined): number {
  const base = Math.max(maxTokens ?? 0, 1200);
  return Math.min(32768, Math.max(2400, base * 2));
}

function missionMemory(state: GameState, girl: Girl, excludeMissionId?: string): string {
  const runs = recentMissionRuns(state, girl.id, 6).filter(run => run.missionId !== excludeMissionId).slice(0, 4);
  if (!runs.length) return '最近没有出勤记录。';
  return runs.map(run => {
    const peers = run.girlIds.filter(id => id !== girl.id).map(id => [...state.girls, ...state.candidates].find(entry => entry.id === id)?.name).filter(Boolean);
    const outcome = { victory: '胜利', defeat: '失败', repelled: '击退', draw: '平局', success: '调查成功', failure: '调查失败' }[run.outcome];
    const work = run.work === 'combat' ? '战斗' : '调查';
    return `第 ${run.day} 日「${run.title}」：${work} · ${run.district ? districts[run.district]?.name ?? run.district : '事务所周边'} · ${outcome}${peers.length ? `；同行 ${peers.join('、')}` : ''}。`;
  }).join('\n');
}


export async function generateDialogue(config: LlmConfig, { girl, state, text, remote }: DialogueContext, preset?: PresetRuntime): Promise<{ ok: true; text: string; lines: DialogueLine[] } | { ok: false; message: string }> {
  const started = Date.now();
  const runtime = preset ?? EMPTY_RUNTIME;
  const cfg = applyPresetApi(runtime, config);
  if (!hasCredentials(cfg)) {
    const message = '请先在设置中填写 API 密钥（本地接口可留空）。';
    recordLlmLog({ kind: '角色对话', ok: false, model: cfg.model.trim(), durationMs: 0, message, endpoint: llmEndpointLabel(cfg) });
    return { ok: false, message };
  }
  const history = (state.messages[girl.id] ?? []).map(message => ({
    role: message.role === 'player' ? 'user' as const : 'assistant' as const,
    content: message.action ? `${message.text}\n（${message.action}）` : message.text,
  }));
  // v49：她的档案与过往由 chat 分区的宏供给，这里只留这次见面的场景。
  const body = remote
    ? '你们正在通电话，她退役后住在城南家中；电话那头有很轻的电流声。'
    : `你们在事务所的${state.rooms.find(room => room.id === girl.roomId)?.name ?? '会客厅'}见面。（只作为语气与记忆参考；当前这次对话没有新的委托结算。）`;
  const MAX_CONTEXT = runtime.maxContext;
  const recentHistory: typeof history = [];
  const { system: baseSystem } = composePrompt(body, runtime, 'chat', { char: girlBrief(girl) }, '与委托人的对话', { state, focus: girl });
  let used = baseSystem.length + text.length;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    const clipped = message.content.slice(0, 1_200);
    if (used + clipped.length > MAX_CONTEXT) break;
    recentHistory.unshift({ ...message, content: clipped });
    used += clipped.length;
  }
  const omitted = history.length - recentHistory.length;
  const boundedSystem = omitted > 0 ? `${baseSystem}\n（更早的 ${omitted} 条对话因上下文预算省略，只保留最近的部分。）` : baseSystem;
  const dialogueSystem = `${boundedSystem}\n\n${DIALOGUE_FORMAT_HINT}`;
  const messages: ChatMessage[] = applyRegexToMessages([
    { role: 'system', content: dialogueSystem },
    ...recentHistory,
    { role: 'user', content: applyRegexScripts(text, runtime.regex, 'input', 'prompt') },
  ], runtime.regex);
  const params = presetParams(runtime);
  const labels = [
    '世界观与角色卡（含预设）',
    ...recentHistory.map((_, index) => `对话历史 ${index + 1}`),
    '玩家这句话',
  ];
  let request: LlmRequestSnapshot = { ...requestSnapshot(messages, requestParams(cfg, params), labels), slots: slotList(runtime) };
  let result = await chat(cfg, messages, { params });
  if (result.ok && isTruncatedFinish(result.finish)) {
    const retryParams = { ...params, maxTokens: truncatedRetryBudget(params?.maxTokens) };
    const retried = await chat(cfg, messages, { params: retryParams });
    if (retried.ok && retried.text.trim()) {
      result = retried;
      request = { ...requestSnapshot(messages, requestParams(cfg, retryParams), labels), slots: slotList(runtime) };
    }
  }
  const parsedLines = result.ok
    ? parseDialogueReply(result.text, { maxLines: 3, perLine: 120, totalLimit: 420, actionLimit: 60 })
      .map(line => ({
        ...line,
        text: applyRegexScripts(line.text, runtime.regex, 'output', 'display'),
        action: line.action ? applyRegexScripts(line.action, runtime.regex, 'output', 'display') : undefined,
      }))
      .filter(line => line.text || line.action)
    : [];
  const clean = dialogueReplyText(parsedLines);
  const final = parsedLines.length
    ? { ok: true as const, text: clean, lines: parsedLines }
    : { ok: false as const, message: result.ok ? '模型没有返回可用的对话内容。' : result.message };
  recordLlmLog({
    kind: '角色对话', ok: final.ok, model: cfg.model.trim(), status: final.ok ? 200 : statusOf(final.message),
    durationMs: Date.now() - started, endpoint: llmEndpointLabel(cfg),
    message: final.ok ? `与${girl.name}完成一次对话（${final.lines.length} 条）` : final.message,
    detail: final.ok ? undefined : final.message,
    request, response: { ...responseTextOf(result.ok ? result.text : undefined), reasoning: result.reasoning, usage: result.usage, finish: result.ok ? result.finish : undefined },
  });
  return final;
}

/** 灯下私语：让刚回来的她读着这一战的战报，主动写 2–3 句。 */
export async function generateWhisper(
  config: LlmConfig,
  state: GameState,
  job: WhisperJob,
  preset?: PresetRuntime,
): Promise<{ ok: true; text: string; lines: DialogueLine[] } | { ok: false; message: string }> {
  const started = Date.now();
  const runtime = preset ?? EMPTY_RUNTIME;
  const cfg = applyPresetApi(runtime, config);
  const girl = state.girls.find(entry => entry.id === job.girlId);
  if (!girl) return { ok: false, message: '找不到发消息的契约者。' };
  if (!hasCredentials(cfg)) {
    const message = '请先在设置中填写 API 密钥（本地接口可留空）。';
    recordLlmLog({ kind: '灯下私语', ok: false, model: cfg.model.trim(), durationMs: 0, message, endpoint: llmEndpointLabel(cfg) });
    return { ok: false, message };
  }
  const mission = state.missions.find(entry => entry.id === job.missionId);
  const battle = state.battles.find(entry => entry.id === job.battleId)
    ?? state.battles.find(entry => entry.missionId === job.missionId);
  const unitName = (uid: string) => battle?.units.find(unit => unit.uid === uid)?.name ?? uid;
  const events = (battle?.events ?? []).slice(0, 14).map(event =>
    `- 第 ${event.round} 回合：${unitName(event.actor)} 使用「${event.skillName}」${event.targets.length ? `对 ${event.targets.map(unitName).join('、')}` : ''}${event.amount !== undefined ? `，${event.hit ? '' : '未命中，'}数值 ${event.amount}` : ''}${event.hit === false ? '（未命中）' : ''}`,
  ).join('\n');
  const outcomeLabel = { victory: '胜利', defeat: '失败', success: '调查成功', failure: '调查失败' }[job.outcome];
  const recentWithActions = (state.messages[girl.id] ?? []).slice(-6).map(message => `${message.role === 'player' ? '所长' : girl.name}：${message.text}${message.action ? `（${message.action}）` : ''}`).join('\n') || '（还没有聊过）';
  const body = `【她】${girl.name}（${girl.title}）· ${girl.element}/${girl.archetype ?? '未定'} · Lv.${girl.level}
性格：${activePersonality(girl) || girl.personality || '安静'}。外貌：${girl.appearance ?? '不详'}。语气参考：${girl.quote ?? '没有留下出场白'}。
对所长（玩家）的羁绊：${girl.bond}/100${job.outcome === 'victory' || job.outcome === 'success' ? '。她刚打完这一场，还带着疲惫与一点侥幸。' : '。这一场没打好，她可能有点自责或嘴硬。'}

【这一次】${mission ? `${mission.title} · ${mission.work === 'combat' ? '战斗' : '调查'} · ${mission.difficulty} · ${mission.district ? districts[mission.district]?.name ?? mission.district : '事务所周边'}` : job.missionId}
结果：${outcomeLabel}${mission ? `；报酬 ${mission.reward} 星砂` : ''}
${battle ? `战斗共 ${battle.round}/${battle.rounds} 回合，结果 ${battle.outcome ?? '未知'}。` : '这次没有发生战斗，只有现场的线索与判断。'}
${events ? `【战报】
${events}` : ''}

【战后】生命 ${girl.hp}/${girl.maxHp}，疲劳 ${girl.fatigue}/100，侵蚀 ${girl.corruption ?? 0}/100${girl.scars?.length ? `，疤痕 ${girl.scars.length} 道` : ''}。
${job.outcome === 'victory' || job.outcome === 'success' ? '她赢了，但不想只报平安。' : '她没赢，可能想解释、道歉、或者嘴硬。'}

【最近参与】
${missionMemory(state, girl, job.missionId)}
【最近对话】
${recentWithActions}`;
  const { system } = composePrompt(body, runtime, 'whisper', { char: girlBrief(girl) }, '灯下私语', { state, focus: girl });
  const messages: ChatMessage[] = [
    { role: 'system', content: `${system}\n\n${DIALOGUE_FORMAT_HINT}` },
    { role: 'user', content: whisperUserHint() },
  ];
  const params = presetParams(runtime);
  let request = requestSnapshot(messages, requestParams(cfg, params), ['角色卡（含预设）', '战报与最近对话']);
  let result = await chat(cfg, messages, { params });
  // 灯下私语 / 角色对话不走 JSON 重试通道，截断时自己提额再来一次。
  if (result.ok && isTruncatedFinish(result.finish)) {
    const retryParams = { ...params, maxTokens: truncatedRetryBudget(params?.maxTokens) };
    const retried = await chat(cfg, messages, { params: retryParams });
    if (retried.ok && retried.text.trim()) {
      result = retried;
      request = requestSnapshot(messages, requestParams(cfg, retryParams), ['角色卡（含预设）', '战报与最近对话']);
    }
  }
  const parsedLines = result.ok
    ? parseDialogueReply(result.text, { maxLines: 3, perLine: 90, totalLimit: 300, actionLimit: 50 })
      .map(line => ({
        ...line,
        text: applyRegexScripts(line.text, runtime.regex, 'output', 'display'),
        action: line.action ? applyRegexScripts(line.action, runtime.regex, 'output', 'display') : undefined,
      }))
      .filter(line => line.text || line.action)
    : [];
  const text = dialogueReplyText(parsedLines);
  const final = parsedLines.length
    ? { ok: true as const, text, lines: parsedLines }
    : { ok: false as const, message: result.ok ? '模型没有返回可用的私语内容。' : result.message };
  recordLlmLog({
    kind: '灯下私语', ok: final.ok, model: cfg.model.trim(), status: final.ok ? 200 : statusOf(final.message),
    durationMs: Date.now() - started, endpoint: llmEndpointLabel(cfg),
    message: final.ok ? `${girl.name}的灯下私语已生成（${final.lines.length} 条）` : final.message,
    detail: final.ok ? undefined : final.message,
    request, response: { ...responseTextOf(result.ok ? result.text : undefined), reasoning: result.reasoning, usage: result.usage, finish: result.ok ? result.finish : undefined },
  });
  return final;
}

export const defaultLlmSettings: LlmSettings = {
  provider: 'openai',
  openai: { endpoint: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini', location: '' },
  vertex: { endpoint: '', apiKey: '', model: 'gemini-2.5-pro', location: 'us-central1' },
};

/** 设置页保存的形状：两份凭证并存，provider 只决定「默认用哪一个」。 */
export interface LlmSettings {
  provider: LlmProvider;
  openai: LlmCredential;
  vertex: LlmCredential;
}

/** 默认接口摊平后的配置；老代码直接用它当兜底。 */
export const defaultLlmConfig: LlmConfig = resolveLlm(defaultLlmSettings);

/** 一个接口自己的那份凭证；切换默认接口不会覆盖另一份。 */
export interface LlmCredential extends LlmProxyOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  location: string;
}

/** 输出预算：统一值之下，重 JSON 任务默认给更宽的口子，其余跟随统一值。 */
export const BUDGET_MIN = 256;
export const BUDGET_MAX = 32768;
export const BUDGET_UNIFIED_DEFAULT = 8000;
export const LLM_BUDGET_TASKS = [
  { key: 'chat', label: '角色对话' },
  { key: 'daily', label: '每日提案' },
  { key: 'news', label: '城市新闻' },
  { key: 'profile', label: '角色起草' },
  { key: 'storyline', label: '故事线起点' },
  { key: 'event', label: '故事事件' },
  { key: 'arc', label: '故事线蓝图' },
  { key: 'incident', label: '突发事件' },
  { key: 'outfit', label: '服装词条' },
  { key: 'battle', label: '战斗札记' },
  { key: 'whisper', label: '灯下私语' },
] as const;
export type LlmTaskKey = (typeof LLM_BUDGET_TASKS)[number]['key'];
export interface LlmBudget {
  /** 未单独指定的任务都用这个值。 */
  unified: number;
  tasks: Partial<Record<LlmTaskKey, number>>;
}
const BUDGET_KEY = 'night-sugar:llm-budget';
/**
 * 一次性输出整份长文的任务，单独给更宽的额度。
 *
 * v94：统一值抬到 8000；只有这三项（战斗札记 / 故事线蓝图 / 故事事件）单独给 24000，
 * 其余任务都跟随统一值，不再各自写一个比统一值还小的数。
 */
export const DEFAULT_TASK_BUDGETS: Partial<Record<LlmTaskKey, number>> = { battle: 24000, arc: 24000, event: 24000 };

function clampBudget(value: unknown, fallback: number): number {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, num));
}

export function defaultLlmBudget(): LlmBudget {
  return { unified: BUDGET_UNIFIED_DEFAULT, tasks: { ...DEFAULT_TASK_BUDGETS } };
}

export function loadLlmBudget(): LlmBudget {
  const base = defaultLlmBudget();
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<LlmBudget>;
    const tasks: Partial<Record<LlmTaskKey, number>> = {};
    for (const item of LLM_BUDGET_TASKS) {
      const raw = parsed.tasks?.[item.key];
      const num = Math.round(Number(raw));
      if (raw !== undefined && raw !== null && Number.isFinite(num) && num > 0) tasks[item.key] = clampBudget(num, base.unified);
    }
    return { unified: clampBudget(parsed.unified, base.unified), tasks };
  } catch {
    return base;
  }
}

export function saveLlmBudget(budget: LlmBudget) {
  try {
    localStorage.setItem(BUDGET_KEY, JSON.stringify({ unified: clampBudget(budget.unified, BUDGET_UNIFIED_DEFAULT), tasks: budget.tasks }));
  } catch { /* 隐私模式下忽略 */ }
}

export function budgetForTask(budget: LlmBudget, task?: LlmTaskKey): number {
  const own = task ? budget.tasks[task] : undefined;
  return clampBudget(own, clampBudget(budget.unified, BUDGET_UNIFIED_DEFAULT));
}

/**
 * 生成任务实际使用的运行时：预设提供采样参数与词条。
 *
 * 输出额度两个旋钮都算数：设置里的输出预算与预设自带的「最大输出」取**较大者**，
 * 再夹在 BUDGET_MAX 以内。改预设、改预算，哪个调高都能真的抬高上限。
 */
export function taskRuntime(preset: ChatPreset | undefined, task: LlmTaskKey): PresetRuntime {
  const runtime = presetRuntime(preset);
  const budget = budgetForTask(loadLlmBudget(), task);
  // 没绑定预设时不算预设那一份（否则会退化成内置预设的 8000，白白放宽所有任务）。
  const presetTokens = preset ? runtime.maxTokens ?? 0 : 0;
  return { ...runtime, maxTokens: Math.min(BUDGET_MAX, Math.max(budget, presetTokens)) };
}

function cloneSettings(settings: LlmSettings): LlmSettings {
  return { provider: settings.provider, openai: { ...settings.openai }, vertex: { ...settings.vertex } };
}

function mergeSlot(base: LlmCredential, raw: unknown): LlmCredential {
  if (!raw || typeof raw !== 'object') return { ...base };
  const value = raw as Partial<LlmCredential>;
  return {
    endpoint: typeof value.endpoint === 'string' ? value.endpoint : base.endpoint,
    apiKey: typeof value.apiKey === 'string' ? value.apiKey : base.apiKey,
    model: typeof value.model === 'string' && value.model.trim() ? value.model : base.model,
    location: typeof value.location === 'string' ? value.location : base.location,
    authMode: value.authMode ?? base.authMode,
    headerName: typeof value.headerName === 'string' ? value.headerName : base.headerName,
    apiKeyQuery: typeof value.apiKeyQuery === 'string' ? value.apiKeyQuery : base.apiKeyQuery,
    extraHeaders: value.extraHeaders && typeof value.extraHeaders === 'object' ? { ...value.extraHeaders } : base.extraHeaders,
    pathMode: value.pathMode ?? base.pathMode,
    customPath: typeof value.customPath === 'string' ? value.customPath : base.customPath,
  };
}

/** 把设置里某一份凭证摊平成请求用的配置。 */
export function resolveLlm(settings: LlmSettings, provider: LlmProvider = settings.provider): LlmConfig {
  const slot = provider === 'vertex' ? settings.vertex : settings.openai;
  return {
    provider,
    endpoint: slot.endpoint.trim(),
    apiKey: slot.apiKey,
    model: slot.model.trim(),
    location: slot.location.trim() || 'us-central1',
    authMode: slot.authMode,
    headerName: slot.headerName,
    apiKeyQuery: slot.apiKeyQuery,
    extraHeaders: slot.extraHeaders,
    pathMode: slot.pathMode,
    customPath: slot.customPath,
  };
}

/** 老存档只有一份扁平配置：按当时的 provider 放回对应槽位，另一份保持默认。 */
export function loadLlmSettings(): LlmSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return cloneSettings(defaultLlmSettings);
    const parsed = JSON.parse(raw) as Partial<LlmSettings> & Partial<LlmConfig>;
    if (parsed.openai || parsed.vertex) {
      return {
        provider: parsed.provider === 'vertex' ? 'vertex' : 'openai',
        openai: mergeSlot(defaultLlmSettings.openai, parsed.openai),
        vertex: mergeSlot(defaultLlmSettings.vertex, parsed.vertex),
      };
    }
    const provider: LlmProvider = parsed.provider === 'vertex' ? 'vertex' : 'openai';
    const legacy: LlmCredential = {
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : defaultLlmSettings.openai.endpoint,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : defaultLlmSettings[provider].model,
      location: typeof parsed.location === 'string' && parsed.location.trim() ? parsed.location : defaultLlmSettings.vertex.location,
    };
    return provider === 'vertex'
      ? { provider, openai: { ...defaultLlmSettings.openai }, vertex: legacy }
      : { provider, openai: legacy, vertex: { ...defaultLlmSettings.vertex } };
  } catch {
    return cloneSettings(defaultLlmSettings);
  }
}

export function saveLlmSettings(settings: LlmSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private windows; the form still works for this session.
  }
}

/** 当前默认接口摊平后的配置；所有请求入口都从这里取。 */
export function loadLlmConfig(): LlmConfig {
  return resolveLlm(loadLlmSettings());
}

/** 老调用点只改「当前接口」：写回对应槽位，另一份原样保留。 */
export function saveLlmConfig(config: LlmConfig) {
  const settings = loadLlmSettings();
  const provider: LlmProvider = config.provider === 'vertex' ? 'vertex' : 'openai';
  const slot: LlmCredential = {
    endpoint: config.endpoint,
    apiKey: config.apiKey,
    model: config.model,
    location: config.location ?? settings[provider].location,
  };
  saveLlmSettings(provider === 'vertex' ? { ...settings, provider, vertex: slot } : { ...settings, provider, openai: slot });
}

/** 只改「默认接口」，两份凭证各走各的，绝不把当前这份的值抄进另一份。 */
export function setLlmProvider(provider: LlmProvider): LlmSettings {
  const settings = loadLlmSettings();
  const next: LlmSettings = { ...settings, provider: provider === 'vertex' ? 'vertex' : 'openai' };
  saveLlmSettings(next);
  return next;
}

/** 往某一份凭证里写字段。切接口、改地址、换密钥都只落在自己的槽位。 */
export function updateLlmSlot(provider: LlmProvider, patch: Partial<LlmCredential>): LlmSettings {
  const settings = loadLlmSettings();
  const key: 'openai' | 'vertex' = provider === 'vertex' ? 'vertex' : 'openai';
  const base = settings[key];
  const slot: LlmCredential = {
    endpoint: typeof patch.endpoint === 'string' ? patch.endpoint : base.endpoint,
    apiKey: typeof patch.apiKey === 'string' ? patch.apiKey : base.apiKey,
    model: typeof patch.model === 'string' && patch.model.trim() ? patch.model : base.model,
    location: typeof patch.location === 'string' ? patch.location : base.location,
  };
  const next: LlmSettings = { ...settings, [key]: slot };
  saveLlmSettings(next);
  return next;
}

/** 两份凭证里只要有一份能用，就允许发起生成；具体用哪份由预设或默认接口决定。 */
export function llmHasKey(): boolean {
  const settings = loadLlmSettings();
  const active = resolveLlm(settings);
  if (active.apiKey.trim() || isLocalEndpoint(active.endpoint)) return true;
  const other = resolveLlm(settings, active.provider === 'vertex' ? 'openai' : 'vertex');
  return Boolean(other.apiKey.trim()) || isLocalEndpoint(other.endpoint);
}

/**
 * 预设可以单独指定接口：它选 Vertex 时用设置里 Vertex 那份凭证，选 OpenAI 时用另一份。
 * 预设自己填了的字段（模型、区域、甚至整套 endpoint + key）优先，没填的沿用那份凭证。
 */
export function applyPresetApi(runtime: PresetRuntime | undefined, config: LlmConfig, settings?: LlmSettings): LlmConfig {
  const api = runtime?.api;
  const want: LlmProvider = api?.provider === 'vertex' ? 'vertex' : api?.provider === 'openai' ? 'openai' : (config.provider === 'vertex' ? 'vertex' : 'openai');
  const base = want === (config.provider === 'vertex' ? 'vertex' : 'openai') ? config : resolveLlm(settings ?? loadLlmSettings(), want);
  if (!api) return base;
  const model = api.model?.trim();
  const apiKey = api.apiKey?.trim();
  if (base.provider === 'vertex') {
    return { ...base, model: model || base.model, apiKey: apiKey || base.apiKey, location: api.location?.trim() || base.location };
  }
  const endpoint = api.endpoint?.trim();
  if (!endpoint) return { ...base, model: model || base.model, apiKey: apiKey || base.apiKey };
  const remote = !isLocalEndpoint(endpoint);
  if (remote && !apiKey && !base.apiKey) return { ...base, model: model || base.model };
  return { ...base, endpoint, model: model || base.model, apiKey: apiKey || base.apiKey };
}

/** Vertex 的「测试连接」会真的发一次极小的 generateContent：一次验证密钥、权限、区域和模型名。 */
async function testVertexConnection(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  const info = describeVertexCredential(config.apiKey);
  if (info.kind === 'empty') return { ok: false, message: '请先导入服务账号 JSON，或填写 Express 模式密钥。' };
  if (info.kind === 'invalid') return { ok: false, message: info.message };
  const model = normalizeVertexModel(config.model);
  if (!model) return { ok: false, message: '请先填写模型名称，例如 gemini-2.5-pro。' };
  // 探针不设输出上限：思维链模型会被 16 个 token 吃光额度，回一份空 candidates。
  const probe = await vertexChat(
    { model, location: config.location, secret: config.apiKey, timeoutMs: 40_000 },
    [{ role: 'user', content: '你好，请只回复 pong。' }],
    { temperature: 0 },
  );
  if (!probe.ok) return { ok: false, message: `${probe.message}（端点 ${llmEndpointLabel(config)}）` };
  const where = info.kind === 'service-account' ? `${info.projectId} · ${vertexLocation(config.location)}` : 'Express 模式';
  return { ok: true, message: `连接成功，模型「${model}」可用（${where}）。` };
}

async function testLlmConnectionCore(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  if (config.provider === 'vertex') return testVertexConnection(config);
  if (!config.apiKey.trim()) return { ok: false, message: '请先填写 API 密钥。' };
  if (!/^https?:\/\//.test(config.endpoint)) return { ok: false, message: '接口地址必须以 http:// 或 https:// 开头。' };
  const model = config.model.trim();
  if (!model) return { ok: false, message: '请先填写模型名称。' };
  try {
    const response = await fetch(buildApiUrl(config, 'models'), { headers: apiHeaders(config) });
    if (!response.ok) {
      const detail = await errorDetail(response);
      return { ok: false, message: `连接失败：服务返回 ${response.status}${detail ? `（${detail}）` : ''}。` };
    }
    const body = await response.json().catch(() => null) as { data?: { id?: string }[] } | null;
    const ids = body?.data?.map(item => item.id).filter(Boolean) ?? [];
    if (ids.length && !ids.includes(model)) {
      return { ok: false, message: `服务可以访问，但模型列表里没有「${model}」。请从设置中改成可用模型，例如 ${ids.slice(0, 3).join('、')}。` };
    }
    return { ok: true, message: ids.length ? `连接成功，模型「${model}」可用。` : '连接成功，模型服务可以访问。' };
  } catch {
    return { ok: false, message: '连接失败：浏览器无法访问该地址，或服务未允许跨域请求。' };
  }
}

/** 把接口地址拼成真正的请求地址：保留子路径与查询串，支持 Azure 与自定义路径模板。 */
export function buildApiUrl(config: Pick<LlmConfig, 'endpoint' | 'model' | 'authMode' | 'apiKey' | 'apiKeyQuery' | 'pathMode' | 'customPath'>, leaf: 'chat' | 'models' = 'chat'): string {
  const raw = config.endpoint.trim();
  const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  let path = parsed.pathname.replace(/\/+$/, '');
  const mode = config.pathMode ?? 'auto';
  if (mode === 'custom' && config.customPath?.trim()) {
    path = config.customPath.trim().replace(/^\/+/, '').replace(/\{model\}/g, encodeURIComponent(config.model));
    if (!path.startsWith('/')) path = `/${path}`;
  } else if (mode === 'azure') {
    path = `${path}/openai/deployments/${encodeURIComponent(config.model)}/chat/completions`;
  } else if (leaf === 'models') {
    path = path.replace(/\/chat\/completions$/i, '') + '/models';
  } else if (!/\/chat\/completions$/i.test(path)) {
    path = `${path}/chat/completions`;
  }
  parsed.pathname = path;
  if (config.authMode === 'query' && config.apiKey.trim()) parsed.searchParams.set(config.apiKeyQuery?.trim() || 'key', config.apiKey.trim());
  return parsed.toString();
}

/** 认证头：默认 Bearer；反代可换成 x-api-key / api-key / 自定义头 / 不认证。 */
export function apiHeaders(config: Pick<LlmConfig, 'apiKey' | 'authMode' | 'headerName' | 'extraHeaders'>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = config.apiKey.trim();
  const mode = config.authMode ?? 'bearer';
  if (key && mode === 'bearer') headers.Authorization = `Bearer ${key}`;
  if (key && mode === 'x-api-key') headers['x-api-key'] = key;
  if (key && mode === 'api-key') headers['api-key'] = key;
  if (key && mode === 'header') headers[(config.headerName ?? 'X-API-Key').trim() || 'X-API-Key'] = key;
  for (const [name, value] of Object.entries(config.extraHeaders ?? {})) {
    if (!name.trim() || name.toLowerCase() === 'content-type' || typeof value !== 'string') continue;
    headers[name.trim()] = value;
  }
  return headers;
}

async function errorDetail(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (!text) return '';
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
    const message = typeof body.error === 'string' ? body.error : body.error?.message ?? body.message;
    if (message) return String(message).slice(0, 220);
  } catch { /* fall through to raw text */ }
  return text.replace(/\s+/g, ' ').slice(0, 220);
}

type ChatPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string | ChatPart[] };

export interface LlmCallParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface LlmCallOptions {
  params?: LlmCallParams;
  timeoutMs?: number;
}

export type LlmCallResult =
  | { ok: true; text: string; reasoning?: string; finish?: string; usage?: LlmResponseSnapshot['usage'] }
  | { ok: false; message: string; reasoning?: string; status?: number; usage?: LlmResponseSnapshot['usage'] };

export function requestParams(config: LlmConfig, params?: LlmCallParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = { model: config.model.trim() };
  if (config.provider === 'vertex') {
    out.provider = 'vertex';
    out.location = vertexLocation(config.location);
  }
  if (params?.temperature !== undefined) out.temperature = params.temperature;
  if (params?.topP !== undefined) out.top_p = params.topP;
  if (params?.maxTokens !== undefined) out.max_tokens = params.maxTokens;
  // 日志里也只记真正会发出去的参数：Vertex 的请求体里没有 penalty。
  if (config.provider !== 'vertex') {
    if (params?.presencePenalty !== undefined) out.presence_penalty = params.presencePenalty;
    if (params?.frequencyPenalty !== undefined) out.frequency_penalty = params.frequencyPenalty;
  }
  return out;
}

export function slotList(runtime: PresetRuntime): LlmSlot[] {
  return (runtime.entries ?? []).map((entry, index) => ({
    index: index + 1, name: entry.name, role: entry.role, tokens: promptTokens(entry.content),
    enabled: entry.enabled, marker: Boolean(entry.marker),
  }));
}

export function requestSnapshot(messages: ChatMessage[], params: Record<string, string | number | boolean>, labels: string[], slots?: LlmSlot[], preset?: string): LlmRequestSnapshot {
  const sections = messages.map((message, index) => {
    const label = labels[index] ?? (message.role === 'system' ? 'system' : message.role === 'user' ? 'user' : 'assistant');
    if (typeof message.content === 'string') return { label, text: message.content };
    const parts = message.content.map(part => part.type === 'text' ? part.text : `[图片输入 ${Math.round((part.image_url.url.length * 3) / 4 / 1024)} KB]`);
    return { label, text: parts.join('\n') };
  });
  return slots?.length ? { sections, params, messageCount: messages.length, slots, preset } : { sections, params, messageCount: messages.length, preset };
}

function isLocalEndpoint(endpoint: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(endpoint.trim());
}

function hasCredentials(config: LlmConfig): boolean {
  // Vertex 的 endpoint 是拼出来的，只有密钥能代表「配置好了」。
  if (config.provider === 'vertex') return Boolean(config.apiKey.trim());
  return config.authMode === 'none' || Boolean(config.apiKey.trim()) || isLocalEndpoint(config.endpoint);
}

/** Vertex 走 generateContent，消息形状和 OpenAI 的 system/user/assistant 一一对应。 */
async function chatVertex(config: LlmConfig, messages: ChatMessage[], options: LlmCallOptions = {}): Promise<LlmCallResult> {
  const params = options.params ?? {};
  return vertexChat(
    { model: config.model, location: config.location, secret: config.apiKey, timeoutMs: options.timeoutMs },
    messages,
    {
      // Vertex 不接受 penalty 参数（部分模型会 400），这里不再透传。
      temperature: params.temperature ?? 0.9,
      topP: params.topP,
      maxTokens: params.maxTokens,
    },
  );
}

async function chat(config: LlmConfig, messages: ChatMessage[], options: LlmCallOptions = {}): Promise<LlmCallResult> {
  if (config.provider === 'vertex') return chatVertex(config, messages, options);
  if (!hasCredentials(config)) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  if (!/^https?:\/\//.test(config.endpoint)) return { ok: false, message: '接口地址必须以 http:// 或 https:// 开头。' };
  const model = config.model.trim();
  if (!model) return { ok: false, message: '请先在设置中填写模型名称。' };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 600_000);
  try {
    const url = buildApiUrl(config);
    const headers = apiHeaders(config);
    const reasoningModel = /^(o1|o3|o4|gpt-5)/i.test(model);
    const payload: Record<string, unknown> = { model, messages };
    if (reasoningModel) {
      // o 系列与 gpt-5 拒绝 temperature，只接受 max_completion_tokens。
      if (options.params?.maxTokens) payload.max_completion_tokens = options.params.maxTokens;
    } else {
      const params = options.params ?? {};
      payload.temperature = params.temperature ?? 0.9;
      if (params.topP !== undefined) payload.top_p = params.topP;
      if (params.maxTokens !== undefined) payload.max_tokens = params.maxTokens;
      if (params.presencePenalty !== undefined) payload.presence_penalty = params.presencePenalty;
      if (params.frequencyPenalty !== undefined) payload.frequency_penalty = params.frequencyPenalty;
    }
    const send = (body: Record<string, unknown>) => fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const retryable = (status: number) => status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    let response = await send(payload);
    if (!response.ok && retryable(response.status)) {
      await new Promise(resolve => setTimeout(resolve, 700));
      response = await send(payload);
    }
    if (!response.ok) {
      let detail = await errorDetail(response);
      // Some OpenAI-compatible gateways still reject temperature on models we cannot detect by name.
      if (response.status === 400 && /temperature/i.test(detail) && 'temperature' in payload) {
        const { temperature: _temperature, ...rest } = payload;
        response = await send(rest);
        if (!response.ok) detail = await errorDetail(response);
      }
      if (!response.ok) return { ok: false, message: `服务返回 ${response.status}${detail ? `：${detail}` : ''}`, status: response.status };
    }
    const body = await response.json() as {
      choices?: {
        message?: { content?: string | { type?: string; text?: string }[]; reasoning_content?: string; reasoning?: string };
        finish_reason?: string;
        reasoning?: string;
      }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const choice = body.choices?.[0];
    const raw = choice?.message?.content;
    const text = Array.isArray(raw) ? raw.map(part => typeof part?.text === 'string' ? part.text : '').join('') : raw ?? '';
    const reasoning = choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? choice?.reasoning;
    const usage = body.usage
      ? { prompt: body.usage.prompt_tokens, completion: body.usage.completion_tokens, total: body.usage.total_tokens }
      : undefined;
    if (!text.trim()) {
      return {
        ok: false,
        message: reasoning ? '模型只返回了思维链，没有给出最终文本。' : '模型没有返回文本内容。请确认该模型支持对话补全。',
        reasoning, usage,
      };
    }
    return { ok: true, text, reasoning, finish: choice?.finish_reason, usage };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, message: '请求超过 600 秒仍未返回，已中止。可以重试，或换一个更快的模型。' };
    const detail = error instanceof Error ? error.message : '';
    return { ok: false, message: `浏览器无法访问接口，或服务未允许跨域请求。${detail ? `（${detail}）` : ''}` };
  } finally {
    clearTimeout(timeout);
  }
}

const elements = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物'] as const;
const archetypes = ['输出', '守护', '治愈', '控制', '侦查'] as const;

interface LlmCallMeta {
  presetName?: string;
  request?: LlmRequestSnapshot;
  response?: LlmResponseSnapshot;
  slots?: LlmSlot[];
  /** 这一次真正发出去的模型名（预设专用接口会覆盖设置里的默认模型）。 */
  model?: string;
}

/**
 * 日志里该记哪个模型（v106）。
 *
 * 以前记的是「设置里的默认模型」，但预设可以单独指定模型——于是请求明明走了
 * 预设的 gemini-4a，面板上却写着默认的 gemini-3.8-flash，看着像没生效。
 */
function logModel(meta: LlmCallMeta, config: LlmConfig): string {
  return (meta.model ?? config.model).trim();
}

function captureCall(meta: LlmCallMeta | undefined, messages: ChatMessage[], labels: string[], config: LlmConfig, params: LlmCallParams | undefined, result: LlmCallResult) {
  if (!meta) return;
  meta.request = requestSnapshot(messages, requestParams(config, params), labels, meta.slots, meta.presetName);
  meta.response = { ...responseTextOf(result.ok ? result.text : undefined), reasoning: result.reasoning, usage: result.usage, finish: result.ok ? result.finish : undefined };
  // 同一条记录也落盘：data/llm-logs/YYYY-MM-DD.jsonl，方便直接 grep 与对照。
  persistLlmLog({
    scope: labels[labels.length - 1] ?? '叙事者',
    labels,
    model: config.model,
    provider: config.provider,
    params: requestParams(config, params) as unknown as Record<string, unknown>,
    ok: result.ok,
    finish: result.ok ? result.finish : undefined,
    usage: result.usage,
    messages: messages.map(message => ({
      role: message.role,
      content: typeof message.content === 'string' ? message.content : '[图像/结构化输入]',
    })),
    response: result.ok && typeof result.text === 'string' ? result.text : (result.ok ? '' : String(result.message ?? '')),
  });
}

const JSON_RETRY_MESSAGE = '上一次输出在写到 JSON 中途被截断了。这一次只输出完整的 JSON 对象，不要思维链、不要解释、不要 Markdown 代码块。';

/** 从 start 处的 { 找到配对的 }：字符串里的括号与转义引号不计数。 */
function matchBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) escape = false;
      else if (char === '\\') escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function parseJsonObject(candidate: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/**
 * 从回复里找出 JSON。
 * 模型常会先说一句、包一层代码块，或者把同一个对象写两遍；这里按「配对括号」逐个候选试，
 * 而不是从第一个 { 直接切到最后一个 }——那会把两段 JSON 连同中间的说明一起交给 JSON.parse。
 */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/^\uFEFF/, '').trim();
  for (let start = cleaned.indexOf('{'); start >= 0; start = cleaned.indexOf('{', start + 1)) {
    const end = matchBrace(cleaned, start);
    if (end < 0) {
      // 括号没闭合，多半是被 length 截断了。先试着按括号栈补上收尾（通常只差几个 } ]），
      // 补不出来再让解析器试一次——这样「只差收尾」的蓝图能救回来，而不是整份作废。
      const repaired = closeTruncatedJson(cleaned.slice(start));
      const salvaged = repaired ? parseJsonObject(repaired) : null;
      if (salvaged) return salvaged;
      // 这里不能继续往内层找 {——截断的回复里内层的选项对象是完整的，
      // 滑过去就会返回一个语法合法、内容残缺的对象（表现成「没有给出可用的条目」）。
      return parseJsonObject(cleaned.slice(start));
    }
    const parsed = parseJsonObject(cleaned.slice(start, end + 1));
    if (parsed) return parsed;
  }
  return null;
}

/** 解析失败时给一段可判断的说明：长度、括号数量、首尾片段。 */
function jsonDigest(text: string | undefined): string {
  if (!text) return '这次响应是空的';
  const clean = text.replace(/```(?:json)?/gi, '').trim();
  const open = (clean.match(/\{/g) ?? []).length;
  const close = (clean.match(/\}/g) ?? []).length;
  const head = clean.slice(0, 36).replace(/\s+/g, ' ');
  const tail = clean.slice(-36).replace(/\s+/g, ' ');
  return `响应 ${text.length} 字，{ ×${open} / } ×${close}，开头「${head}」结尾「${tail}」`;
}

interface JsonCallOutcome {
  result: LlmCallResult;
  raw: Record<string, unknown> | null;
  maxTokens?: number;
  truncated: boolean;
  attempts: number;
}

/**
 * 请求一个 JSON 回复。推理模型的思维链也计入 max_tokens，
 * 预设里偏小的上限很容易把正文 JSON 截断，所以识别到 length 时自动放大额度重试一次。
 * 没选预设时也显式给一个额度：交给服务端默认值（常见 4096）会截断较长的提案与蓝图。
 */
const DEFAULT_TOKEN_BUDGET = 8000;

/**
 * 每种生成的最低输出预算。
 *
 * 推理模型的思维链也吃这份额度：几千字的蓝图、几条长台词的事件，很容易被截在
 * 最后一个括号上，然后整份作废、只能重 roll。这里按「这一项平均要写多少字」给下限，
 * 调用方传更小的值会被抬到这里；预设里配得更小也同样被抬。
 */
export const SCOPE_TOKEN_FLOOR: Record<string, number> = {
  storyline: 32000,
  arc: 24000,
  event: 24000,
  battle: 24000,
  profile: 16000,
  incident: 12000,
  news: 12000,
  daily: 12000,
  outfit: 12000,
  dialogue: 8000,
};

export function tokenFloorFor(scope: string): number {
  return SCOPE_TOKEN_FLOOR[scope] ?? 0;
}
/** 截断重试的上限：低于这个额度都值得再试一次，再高就是上下文不够而不是额度不够。 */
const RETRY_TOKEN_CEILING = 32768;
/**
 * 正文的长度上限（v106）：这些只是「防止存档被撑爆」的保险，不是内容裁剪。
 * 以前交互剧情卡在 3000 字、开场 600 字、蓝图每段 900 字——预设要求写 1500–3000 字时，
 * 超出的部分被静默切掉，看起来就像「新写的剧情没显示」。
 */
const NARRATION_LIMIT = 12000;
const OPENING_LIMIT = 4000;
const PASSAGE_LIMIT = 6000;
/** 蓝图这类几千字的结构化输出：下限直接给 32000，别让思维链把正文挤掉。 */
const LONG_FORM_TOKEN_FLOOR = 32000;

async function chatJson(
  config: LlmConfig, preset: PresetRuntime | undefined, scope: PromptScope, body: string, user: ChatMessage['content'], labels: string[], meta: LlmCallMeta | undefined, extra?: Record<string, string>, tokenFloor = 0, ctx: MacroContext = {}, appendix = '',
): Promise<JsonCallOutcome> {
  const runtime = preset ?? EMPTY_RUNTIME;
  const cfg = applyPresetApi(runtime, config);
  // 记下真正发出去的模型：日志要显示「预设覆盖后」的那一个，不然看着像没生效。
  if (meta) { meta.slots = slotList(runtime); meta.model = cfg.model; meta.presetName = runtime.name; }
  let params: LlmCallParams = presetParams(runtime) ?? {};
  // 统一抬到这一用途的下限：调用方传 0 或很小的值都不再让正文被截断。
  tokenFloor = Math.max(tokenFloor, tokenFloorFor(scope));
  // 设置里的输出预算优先：预算比契约下限低就按预算来，截断后还有一次自动放大重试。
  if (runtime.maxTokens !== undefined) params = { ...params, maxTokens: Math.max(runtime.maxTokens, tokenFloor) };
  else if (params.maxTokens === undefined) params = { ...params, maxTokens: Math.max(tokenFloor, DEFAULT_TOKEN_BUDGET) };
  else if (tokenFloor > params.maxTokens) params = { ...params, maxTokens: tokenFloor };
  const { system } = composePrompt(body, runtime, scope, extra, undefined, ctx, appendix);
  let messages: ChatMessage[] = applyRegexToMessages([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], runtime.regex);
  let result = await chat(cfg, messages, { params });
  captureCall(meta, messages, labels, cfg, params, result);
  let raw = result.ok ? extractJsonObject(result.text) : null;
  let attempts = 1;
  let truncated = Boolean(result.ok && result.finish === 'length');
  const budget = params.maxTokens ?? DEFAULT_TOKEN_BUDGET;
  if (result.ok && (truncated || !raw) && budget < RETRY_TOKEN_CEILING) {
    const firstRaw = raw;
    const firstTruncated = truncated;
    attempts = 2;
    params = { ...params, maxTokens: Math.min(32768, Math.max(DEFAULT_TOKEN_BUDGET, budget * 2)) };
    messages = [...messages, { role: 'user', content: JSON_RETRY_MESSAGE }];
    result = await chat(cfg, messages, { params });
    captureCall(meta, messages, labels, cfg, params, result);
    const retryRaw = result.ok ? extractJsonObject(result.text) : null;
    // 上一次是被截断的就别拿它兜底：那半截数据交给调用方只会变成更难懂的报错。
    raw = retryRaw ?? (firstTruncated ? null : firstRaw);
    truncated = Boolean(result.ok && result.finish === 'length');
  }
  return { result, raw, maxTokens: params.maxTokens, truncated, attempts };
}

function jsonFailureMessage(prefix: string, outcome: JsonCallOutcome): string {
  if (outcome.truncated) {
    return `${prefix}输出被截断（finish_reason: length，上限 ${outcome.maxTokens ?? '?'} tokens）。推理模型的思维链会占用同一份额度，已自动放大额度重试仍失败。请到 设置 → 故事引擎 → 输出预算 把这一项的额度调高，或换用非推理模型。`;
  }
  return `${prefix}模型没有返回可解析的 JSON（${jsonDigest(outcome.result.ok ? outcome.result.text : undefined)}）。可以在叙事引擎面板里查看这次请求，再重试一次。`;
}

async function generateDailyCore(config: LlmConfig, state: GameState, context?: string, preset?: PresetRuntime, meta?: LlmCallMeta): Promise<{ ok: true; data: NightProposalV2; warnings: string[] } | { ok: false; message: string }> {
  if (!hasCredentials(applyPresetApi(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const system = dailyContract();
  // 提案历史要真的进模型视野：待议的 {{council}} 只有还没决议的，决议过的题目它一概不知。
  const history = dailyHistoryBlock(state);
  const user = [`请提交今晚的提案。${context ? `\n当前局势：${context}` : ''}`, history].filter(Boolean).join('\n\n');
  const outcome = await chatJson(config, preset, 'daily', system, user, ['共用词条 + 每日提案词条 + 今晚机制目录', '用户请求：今晚的提案'], meta, { context: '每日提案' }, 8000, { state });
  if (!outcome.result.ok) return { ok: false, message: `生成失败：${outcome.result.message}` };
  if (!outcome.raw) return { ok: false, message: jsonFailureMessage('生成失败：', outcome) };
  let validation = validateNightProposal(outcome.raw, state);
  let source = outcome;
  if (!validation.ok) {
    const repairBody = `${system}\n\n【上一次提案（未通过本地校验）】\n${JSON.stringify(outcome.raw)}\n\n【必须修正的问题】\n${validation.errors.map((entry, index) => `${index + 1}. ${entry}`).join('\n')}\n\n只输出修正后的完整 JSON。不要解释，不要省略任何字段；所有 id 必须来自上面的目录。`;
    const repaired = await chatJson(config, preset, 'daily', repairBody, '请只提交修正后的完整 JSON。', ['共用词条 + 每日提案词条 + 今晚机制目录', '修复上一次提案'], meta, { context: '修复今晚的提案' }, 8000, { state });
    if (!repaired.result.ok) return { ok: false, message: `提案未通过校验，修复请求失败：${repaired.result.message}` };
    if (!repaired.raw) return { ok: false, message: `提案未通过校验，且修复输出无法解析。${jsonFailureMessage('', repaired)}` };
    source = repaired;
    validation = validateNightProposal(repaired.raw, state);
  }
  if (!validation.ok || !validation.proposal) {
    return { ok: false, message: `提案未通过本地校验：${validation.errors.slice(0, 6).join('；')}` };
  }
  // 截断但结构通过：收下并提醒一次。补收尾的活儿交给 jsonRepair，别再逼玩家重 roll。
  if (source.truncated) validation.warnings.push('这次输出被截断过，本地已按括号补齐；若发现内容缺段，可以再生成一次。');
  return { ok: true, data: validation.proposal, warnings: validation.warnings };
}

const storyStatKeys: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];
const storyDistricts = ['candy', 'station', 'plaza', 'greenhouse', 'cathedral', 'crossroad', 'oldtown', 'clocktower', 'docks'] as const;
const storyDifficulties = ['简单', '常规', '棘手', '危险'];

/** 故事线每一幕的委托目标：标题与 goal 必填，其余给出安全默认值。 */
function parseStoryMission(raw: unknown): StoryMissionSpec {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 30) : '';
  const goal = typeof body.goal === 'string' ? body.goal.trim().slice(0, 160) : '';
  const difficulty = typeof body.difficulty === 'string' && storyDifficulties.includes(body.difficulty) ? body.difficulty : '常规';
  const duration = Number(body.duration);
  const requirement = typeof body.requirement === 'string' && storyStatKeys.includes(body.requirement as StatKey) ? body.requirement as StatKey : 'insight';
  const district = typeof body.district === 'string' && (storyDistricts as readonly string[]).includes(body.district) ? body.district as StoryMissionSpec['district'] : undefined;
  return {
    title, goal, difficulty, requirement, district,
    category: '故事委托',
    duration: Number.isFinite(duration) ? Math.max(60, Math.min(180, Math.round(duration))) : 90,
    requiredGirlId: typeof body.requiredGirlId === 'string' && /^[a-z0-9_-]{3,40}$/i.test(body.requiredGirlId) ? body.requiredGirlId : undefined,
    companion: parseStoryCompanion(body.companion),
    monsters: Array.isArray(body.monsters) ? body.monsters.map(parseStoryMonster).filter((item): item is MonsterTemplate => Boolean(item)).slice(0, 3) : undefined,
    rewardEquipment: parseStoryEquipment(body.rewardEquipment),
    followUpEvent: parseStoryFollowUp(body.followUpEvent),
  };
}

const storyElements: Element[] = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系'];
const storyHash = (value: string): number => { let h = 2166136261; for (let i = 0; i < value.length; i += 1) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const storyMonsterRanks = ['碎屑', '游荡', '灾厄', '王座'] as const;
const monsterRankBase: Record<(typeof storyMonsterRanks)[number], number> = { 碎屑: 60, 游荡: 92, 灾厄: 132, 王座: 180 };

function parseStoryCompanion(raw: unknown): StoryCompanion | undefined {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!body) return undefined;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 12) : '';
  if (!name) return undefined;
  const element = typeof body.element === 'string' && storyElements.includes(body.element as Element) ? body.element as Element : '月影系';
  return {
    name,
    codename: (typeof body.codename === 'string' ? body.codename.trim().slice(0, 10) : '') || '羁绊协奏',
    element,
    archetype: typeof body.archetype === 'string' ? (body.archetype.trim().slice(0, 4) as StoryCompanion['archetype']) : undefined,
    appearance: (typeof body.appearance === 'string' ? body.appearance.trim() : '她没有说自己从哪里来。').slice(0, 200),
    personality: (typeof body.personality === 'string' ? body.personality.trim() : '安静，只在提到那个人时多说两句。').slice(0, 160),
    outfitDescription: (typeof body.outfitDescription === 'string' ? body.outfitDescription.trim() : '和事务所制服不太一样的旧外套。').slice(0, 160),
    color: typeof body.color === 'string' && /^#[0-9a-f]{6}$/i.test(body.color) ? body.color : undefined,
    quote: typeof body.quote === 'string' ? body.quote.trim().slice(0, 40) : undefined,
  };
}

function parseStoryMonster(raw: unknown): MonsterTemplate | undefined {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!body) return undefined;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 12) : '';
  if (!name) return undefined;
  const rank = typeof body.rank === 'string' && (storyMonsterRanks as readonly string[]).includes(body.rank) ? body.rank as MonsterTemplate['rank'] : '游荡';
  const base = monsterRankBase[rank];
  const element = typeof body.element === 'string' && storyElements.includes(body.element as Element) ? body.element as Element : '梦境系';
  const id = `story-mon-${storyHash(name + rank).toString(16).padStart(6, '0')}`;
  return {
    id, name, epithet: (typeof body.epithet === 'string' ? body.epithet.trim() : '从她的故事里走出来的东西').slice(0, 20),
    rank, element, color: '#c9a2d8',
    maxHp: base * 3, maxSpirit: base,
    stats: { magic: base, insight: base - 8, agility: base, empathy: base - 12 },
    skillIds: ['paper-cut', 'static-veil'],
    trait: (typeof body.trait === 'string' ? body.trait.trim() : '它记得她没说出口的那句话。').slice(0, 40),
    description: (typeof body.description === 'string' ? body.description.trim() : '只在她的故事里出现过的魔物。').slice(0, 180),
    spec: {
      bodyPlan: 'moth', scale: 1, appendages: 6, core: '糖',
      palette: { body: '#3a2638', shade: '#241726', rim: '#f3aec9' },
      aura: '花瓣', motif: '糖',
    },
    codex: {
      habit: (typeof body.habit === 'string' ? body.habit.trim() : '沿着她走过的路来回飞。').slice(0, 80),
      weakness: (typeof body.weakness === 'string' ? body.weakness.trim() : '怕被叫出名字。').slice(0, 80),
    },
  };
}

function parseStoryEquipment(raw: unknown): Equipment | undefined {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!body) return undefined;
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 16) : '';
  if (!name) return undefined;
  const slot = body.slot === 'charm' ? 'charm' : 'weapon';
  const num = (value: unknown) => (Number.isFinite(Number(value)) ? Math.max(0, Math.min(40, Math.round(Number(value)))) : 0);
  return {
    id: `relic-${storyHash(name).toString(16).padStart(6, '0')}`,
    name, faction: 'witch', slot, price: 0, standingReq: 0,
    description: (typeof body.description === 'string' ? body.description.trim() : '从她的故事里留下来的东西。').slice(0, 160),
    stats: { magic: num(body.magic) || undefined, insight: num(body.insight) || undefined, agility: num(body.agility) || undefined, empathy: num(body.empathy) || undefined } as Equipment['stats'],
    passive: typeof body.passive === 'string' ? body.passive.trim().slice(0, 40) : undefined,
    damageBonus: num(body.damageBonus) || undefined,
    maxHpBonus: num(body.maxHpBonus) || undefined,
  };
}

function parseStoryFollowUp(raw: unknown): { title: string; hook: string } | undefined {
  const body = raw && typeof raw === 'object' ? raw as Record<string, unknown> : null;
  if (!body) return undefined;
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 30) : '';
  const hook = typeof body.hook === 'string' ? body.hook.trim().slice(0, 160) : '';
  return title && hook ? { title, hook } : undefined;
}
export interface GeneratedStorylineBeat {
  title: string; summary: string; scene: string; hook: string;
  mission: StoryMissionSpec;
  choices: { label: string; intent: string; effect: StoryEffect }[];
}
export interface GeneratedStoryline { title: string; premise: string; tone: string; beats: GeneratedStorylineBeat[] }
export interface GeneratedIncident { title: string; body: string; options: { label: string; hint: string; effect: IncidentEffect }[] }
export interface GeneratedEvent { title: string; hook: string; backdrop?: string; scenes: { title: string; narration: string; lines: { speaker: string; tone: string; text: string; after?: number }[] }[] }

function girlBrief(girl: Girl): string {
  const traitText = girl.traits.map(trait => `${trait.name}（${trait.polarity}）`).join('、') || '暂无';
  // v95：衣服（魔女形态时是形态描述）也进简报，模型才写得出她此刻的样子。
  const outfit = outfitLine(girl);
  // 出身与雇主必须分开写：出身只交代她来自哪一方，雇主永远是把她们收进名册的夜糖事务所。
  const voice = voiceLine(girl);
  return `姓名 ${girl.name}／代号 ${girl.codename}／称号 ${girl.title}／${girl.element}·${girl.archetype}；出身 ${factionTagLabel(girl.factionTag)}；雇主 ${EMPLOYER_LABEL}；性格：${activePersonality(girl)}${voice ? `；${voice}` : ''}；关系 ${girl.bond}/100；侵蚀 ${girl.corruption}/100；${outfit ? `${outfit}；` : ''}特性：${traitText}；目标：${girl.goal}`;
}

function parseEffect(raw: unknown): StoryEffect {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const effect: StoryEffect = {};
  if (Number.isFinite(item.gold)) effect.gold = Math.max(-3000, Math.min(3000, Math.round(Number(item.gold))));
  if (Number.isFinite(item.reputation)) effect.reputation = Math.max(-10, Math.min(10, Math.round(Number(item.reputation))));
  if (Number.isFinite(item.bond)) effect.bond = Math.max(-12, Math.min(12, Math.round(Number(item.bond))));
  if (Number.isFinite(item.corruption)) effect.corruption = Math.max(-10, Math.min(10, Math.round(Number(item.corruption))));
  if (typeof item.trait === 'string' && item.trait.trim()) effect.trait = { name: item.trait.trim().slice(0, 12), description: '' };
  const trigger = item.trigger && typeof item.trigger === 'object' ? item.trigger as Record<string, unknown> : null;
  if (trigger && typeof trigger.kind === 'string') {
    if (trigger.kind === 'dialogue' && typeof trigger.topic === 'string') effect.trigger = { kind: 'dialogue', topic: trigger.topic.slice(0, 24), prompt: typeof trigger.prompt === 'string' ? trigger.prompt.slice(0, 80) : '' };
    else if (trigger.kind === 'event' && typeof trigger.title === 'string') effect.trigger = { kind: 'event', title: trigger.title.slice(0, 24), hook: typeof trigger.hook === 'string' ? trigger.hook.slice(0, 60) : '' };
    else if (trigger.kind === 'mission' && typeof trigger.title === 'string') effect.trigger = { kind: 'mission', title: trigger.title.slice(0, 24), description: typeof trigger.description === 'string' ? trigger.description.slice(0, 80) : '', duration: Number.isFinite(trigger.duration) ? Math.max(30, Math.min(180, Number(trigger.duration))) : 60 };
    else if (trigger.kind === 'opinion' && typeof trigger.title === 'string') effect.trigger = { kind: 'opinion', topic: '同伴', title: trigger.title.slice(0, 24), text: typeof trigger.text === 'string' ? trigger.text.slice(0, 80) : '', request: typeof trigger.request === 'string' ? trigger.request.slice(0, 60) : '' };
    else if (trigger.kind === 'incident' && typeof trigger.title === 'string') effect.trigger = { kind: 'incident', incidentKind: 'girl', title: trigger.title.slice(0, 24), body: typeof trigger.body === 'string' ? trigger.body.slice(0, 90) : '', options: [] };
  }
  return effect;
}

function parseIncidentEffect(raw: unknown): IncidentEffect {
  const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const effect: IncidentEffect = {};
  if (Number.isFinite(item.gold)) effect.gold = Math.max(-3000, Math.min(3000, Math.round(Number(item.gold))));
  if (Number.isFinite(item.reputation)) effect.reputation = Math.max(-15, Math.min(15, Math.round(Number(item.reputation))));
  if (item.girl && typeof item.girl === 'object') {
    const girl = item.girl as Record<string, unknown>;
    const patch: NonNullable<IncidentEffect['girl']> = {};
    if (Number.isFinite(girl.fatigue)) patch.fatigue = Math.max(-40, Math.min(40, Math.round(Number(girl.fatigue))));
    if (Number.isFinite(girl.spirit)) patch.spirit = Math.max(-30, Math.min(30, Math.round(Number(girl.spirit))));
    if (Number.isFinite(girl.corruption)) patch.corruption = Math.max(-10, Math.min(10, Math.round(Number(girl.corruption))));
    if (Number.isFinite(girl.bond)) patch.bond = Math.max(-10, Math.min(10, Math.round(Number(girl.bond))));
    if (Object.keys(patch).length) effect.girl = patch;
  }
  return effect;
}

async function callJson(
  config: LlmConfig, preset: PresetRuntime | undefined, scope: PromptScope, body: string, user: string, labels: string[], meta: LlmCallMeta, extra?: Record<string, string>, ctx: MacroContext = {}, tokenFloor = 0, appendix = '',
): Promise<{ ok: true; raw: Record<string, unknown> } | { ok: false; message: string }> {
  const outcome = await chatJson(config, preset, scope, body, user, labels, meta, extra, tokenFloor, ctx, appendix);
  if (!outcome.result.ok) return { ok: false, message: outcome.result.message };
  if (!outcome.raw) return { ok: false, message: jsonFailureMessage('', outcome) };
  return { ok: true, raw: outcome.raw };
}

export async function generateStoryline(config: LlmConfig, girl: Girl, direction?: string, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedStoryline } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  // 结构契约走预设词条（storyline:start），正文只留档案与方向。
  const context = `先读她的档案：${girlBrief(girl)}
${direction?.trim() ? `玩家给的方向（必须遵守）：${direction.trim()}` : '玩家没有给方向，请从她的目标、特性与当前关系里找一个最小的裂缝开始。'}`;
  const body = storylineStartContract();
  const result = await callJson(config, preset, 'storyline', body, `请为${girl.name}写这条故事线。`, ['共用词条 + 故事线词条 + 结构契约', `档案：${girl.name}`], meta, {
    char: girlBrief(girl),
    personality: activePersonality(girl),
    scenario: direction?.trim() ?? '',
    contractId: 'storyline:start',
  }, { focus: girl }, 0, context);
  if (!result.ok) {
    recordLlmLog({ kind: '角色故事线', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const raw = result.raw;
  const beats = Array.isArray(raw.beats) ? raw.beats.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 4) : [];
  const parsed: GeneratedStorylineBeat[] = beats.map((beat, index) => {
    const choices = Array.isArray(beat.choices) ? beat.choices.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 3) : [];
    return {
      title: typeof beat.title === 'string' && beat.title.trim() ? beat.title.trim().slice(0, 20) : `第 ${index + 1} 幕`,
      summary: typeof beat.summary === 'string' ? beat.summary.trim().slice(0, 120) : '',
      scene: typeof beat.scene === 'string' ? beat.scene.trim().slice(0, 120) : '',
      hook: typeof beat.hook === 'string' ? beat.hook.trim().slice(0, 120) : '',
      mission: parseStoryMission(beat.mission),
      choices: choices.map((choice, at) => ({
        label: typeof choice.label === 'string' && choice.label.trim() ? choice.label.trim().slice(0, 18) : `选择 ${at + 1}`,
        intent: typeof choice.intent === 'string' ? choice.intent.trim().slice(0, 40) : '',
        effect: parseEffect(choice.effect),
      })),
    };
  });
  if (parsed.length < 4 || parsed.some(beat => beat.choices.length < 2)) {
    const message = '故事线返回的幕数或选项不足，已改用模板起草。';
    recordLlmLog({ kind: '角色故事线', ok: false, model: logModel(meta, config), status: statusOf(message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (parsed.some(beat => !beat.mission.title || !beat.mission.goal)) {
    const message = '故事线缺少明确的任务目标，已改用模板起草。';
    recordLlmLog({ kind: '角色故事线', ok: false, model: logModel(meta, config), status: statusOf(message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const data: GeneratedStoryline = {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 24) : `${girl.name}的未命名故事`,
    premise: typeof raw.premise === 'string' ? raw.premise.trim().slice(0, 160) : '',
    tone: typeof raw.tone === 'string' ? raw.tone.trim().slice(0, 24) : '克制',
    beats: parsed,
  };
  recordLlmLog({ kind: '角色故事线', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `故事线生成成功：${data.title}（4 幕）`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

export interface GeneratedStoryBlueprint {
  title: string;
  premise: string;
  tone: string;
  graph: StoryGraph;
}

const blueprintKinds: StoryNodeKind[] = ['start', 'choice', 'mission', 'event', 'incident', 'opinion', 'reward', 'wait', 'end'];

/** 城市态势那一行：首领名字按当前存档解析，绝不写死开局前的老首领。 */
export function blueprintFactionLine(state?: GameState): string {
  const parts = (['association', 'government', 'witch'] as const)
    // 没有存档时不写死名字，只说势力——写死就等于把开局前的内置首领塞回提示词。
    .map(faction => state
      ? `${factionInfo[faction].name}（现任首领 ${representativeNameOf(state, faction)}）`
      : factionInfo[faction].name)
    .join('、');
  return `樱雾市由${parts}三方拉扯；协会排斥克隆与抑制剂，市役所把量产少女当勤务编号，月蚀庭净血派与普通魔法少女敌对；夜糖事务所是重开的中立委托机构，收留三方与无所属的少女。辖区污染会改变委托与魔物。`;
}

/** 把模型的语义 JSON 收成 draft；ID 合并、连线和布局都交给 storygraph。 */
function parseStoryBlueprintDraft(raw: Record<string, unknown>): StoryGraphDraft {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
  if (!rawNodes.length) throw new Error('蓝图没有 nodes。');
  const nodes: StoryGraphDraftNode[] = rawNodes.slice(0, 80).map((item, index) => {
    // v46：模型偶尔还会写 scene——直接当成一张纯通报弹窗，不打断生成。
    if (item.kind === 'scene') {
      const data = (item.data ?? {}) as Record<string, unknown>;
      const lines = Array.isArray(data.lines)
        ? data.lines.map(line => (line ?? {}) as Record<string, unknown>)
          .map(line => `${typeof line.speaker === 'string' ? line.speaker : '旁白'}：${typeof line.text === 'string' ? line.text : ''}`)
          .join('\n')
        : '';
      return {
        id: typeof item.id === 'string' ? item.id : undefined,
        kind: 'incident' as StoryNodeKind,
        title: typeof item.title === 'string' ? item.title : undefined,
        note: typeof item.note === 'string' ? item.note : undefined,
        data: {
          kind: 'incident',
          spec: {
            kind: 'girl',
            title: typeof item.title === 'string' ? item.title.slice(0, 14) : '旧场景',
            body: [typeof data.narration === 'string' ? data.narration : '', lines].filter(Boolean).join('\n\n').slice(0, 400),
            options: [],
          },
        },
      };
    }
    const kind = typeof item.kind === 'string' && blueprintKinds.includes(item.kind as StoryNodeKind) ? item.kind as StoryNodeKind : null;
    if (!kind) throw new Error(`第 ${index + 1} 个节点的 kind 不在允许范围内。`);
    return {
      id: typeof item.id === 'string' ? item.id : undefined,
      kind,
      title: typeof item.title === 'string' ? item.title : undefined,
      note: typeof item.note === 'string' ? item.note : undefined,
      data: item.data,
    };
  });
  const rawEdges = Array.isArray(raw.edges) ? raw.edges.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
  const edges: StoryGraphDraftEdge[] = rawEdges.slice(0, GRAPH_MAX_EDGES).map(item => ({
    from: typeof item.from === 'string' ? item.from : undefined,
    fromPort: typeof item.fromPort === 'string' ? item.fromPort : undefined,
    to: typeof item.to === 'string' ? item.to : undefined,
  }));
  return { nodes, edges, entry: typeof raw.entry === 'string' ? raw.entry : undefined };
}

function parseStoryBlueprintGraph(raw: Record<string, unknown>): { graph: StoryGraph | null; errors: string[] } {
  try {
    const graph = buildGraphFromDraft(parseStoryBlueprintDraft(raw));
    const errors = blueprintIssues(graph).filter(issue => issue.level === 'error').map(issue => issue.message);
    return { graph, errors };
  } catch (error) {
    return { graph: null, errors: [error instanceof Error ? error.message : '蓝图结构无法解析。'] };
  }
}

/**
 * 让模型直接写一张完整故事蓝图。
 * 只允许一次修复；两次都不合格就返回失败，绝不写半张图到存档里。
 */
export async function generateStoryBlueprint(config: LlmConfig, girl: Girl, direction?: string, preset?: PresetRuntime, state?: GameState, options: { slot?: number } = {}): Promise<{ ok: true; data: GeneratedStoryBlueprint } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  if (!hasCredentials(applyPresetApi(preset ?? EMPTY_RUNTIME, config))) {
    return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  }
  // v49：结构、端口、节点写法与自检都在预设的 storyline 分区里；这里只留玩家方向与锁定契约。
  const body = storylineContract();
  const slot = Math.max(1, Math.min(3, Math.round(options.slot ?? 1)));
  // 第 2/3 段要先看上一段怎么收的：结局里的损失与承诺必须在下一段里继续生效。
  const prior = state ? priorSegmentBrief(state, girl.id, slot) : '';
  const context = [
    slot > 1 ? `这是${girl.name}的第 ${slot} 段故事。` : '',
    prior,
    direction?.trim() ? `玩家给的方向（必须遵守）：${direction.trim()}` : '',
  ].filter(Boolean).join('\n');
  const labels = ['共用词条 + 故事线词条 + 蓝图结构契约', `档案：${girl.name}`];
  const extra = { char: girlBrief(girl), personality: activePersonality(girl), scenario: direction?.trim() ?? '', story: direction?.trim() ?? '', contractId: 'storyline:contract' };
  const macroCtx: MacroContext = { state, focus: girl };
  const first = await chatJson(config, preset, 'storyline', body, `请为${girl.name}画一张故事蓝图。`, labels, meta, extra, LONG_FORM_TOKEN_FLOOR, macroCtx, context);
  if (!first.result.ok) {
    const message = `生成蓝图失败：${first.result.message}`;
    recordLlmLog({ kind: '角色蓝图', ok: false, model: logModel(meta, config), status: statusOf(first.result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (!first.raw) {
    const message = jsonFailureMessage('生成蓝图失败：', first);
    recordLlmLog({ kind: '角色蓝图', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (first.truncated) {
    const message = jsonFailureMessage('生成蓝图失败：', first);
    recordLlmLog({ kind: '角色蓝图', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }

  let source = first;
  let parsed = parseStoryBlueprintGraph(first.raw);
  let repaired = false;
  if (parsed.errors.length) {
    repaired = true;
    const repairBody = `${body}

【上一次蓝图（未通过本地校验）】
${JSON.stringify(first.raw)}

【必须修正的问题】
${parsed.errors.slice(0, 12).map((entry, index) => `${index + 1}. ${entry}`).join('\n')}

只输出修正后的完整 JSON。不要解释，不要省略节点。
按上面的规则逐条修正下列问题后再输出；若某条规则已经在【连线总则】里写过，以那边为准。`;
    const second = await chatJson(config, preset, 'storyline', repairBody, '请只输出修正后的完整故事蓝图 JSON。', ['共用词条 + 故事线词条 + 蓝图结构契约', '修复上一次蓝图'], meta, extra, LONG_FORM_TOKEN_FLOOR, macroCtx, context);
    if (!second.result.ok) {
      const message = `蓝图未通过校验，修复请求失败：${second.result.message}`;
      recordLlmLog({ kind: '角色蓝图', ok: false, model: logModel(meta, config), status: statusOf(second.result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    if (!second.raw) {
      const message = jsonFailureMessage('蓝图未通过校验，且修复输出无法解析。', second);
      recordLlmLog({ kind: '角色蓝图', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    if (second.truncated) {
      const message = jsonFailureMessage('蓝图未通过校验，且修复输出被截断。', second);
      recordLlmLog({ kind: '角色蓝图', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    source = second;
    parsed = parseStoryBlueprintGraph(second.raw);
  }
  if (!parsed.graph || parsed.errors.length) {
    const message = `蓝图未通过本地校验：${parsed.errors.slice(0, 6).join('；')}`;
    recordLlmLog({ kind: '角色蓝图', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const graph = parsed.graph;
  const data: GeneratedStoryBlueprint = {
    title: typeof source.raw?.title === 'string' && source.raw.title.trim() ? source.raw.title.trim().slice(0, 24) : `${girl.name}的未命名蓝图`,
    premise: typeof source.raw?.premise === 'string' ? source.raw.premise.trim().slice(0, 200) : '',
    tone: typeof source.raw?.tone === 'string' ? source.raw.tone.trim().slice(0, 24) : '克制',
    graph,
  };
  recordLlmLog({
    kind: '角色蓝图', ok: true, model: logModel(meta, config), status: 200,
    durationMs: Date.now() - started, endpoint: llmEndpointLabel(config),
    message: `蓝图生成成功：${data.title}（${graph.nodes.length} 节点 / ${graph.edges.length} 连线${repaired ? '，修复 1 次' : ''}）`,
    request: meta.request, response: meta.response,
  });
  return { ok: true, data };
}

export async function generateIncident(config: LlmConfig, state: GameState, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedIncident } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const girls = state.girls.filter(girl => !girl.dead).slice(0, 6).map(girl => `${girl.name}（关系 ${girl.bond}，侵蚀 ${girl.corruption}，疲劳 ${girl.fatigue}）`).join('；');
  const context = `现在是第 ${state.day} 日 ${Math.floor((state.minutes % 1440) / 60).toString().padStart(2, '0')}:${String(state.minutes % 60).padStart(2, '0')}，夜糖事务所正在营业。
在册契约者：${girls || '（还没有契约者）'}；安定度 ${state.reputation}；星砂 ${state.gold}。`;
  const result = await callJson(config, preset, 'incident', singleIncidentContract(), '请把这件事放到我的桌上。', ['共用词条 + 突发事件词条 + 结构契约', '当前局势'], meta, {
    scenario: `第 ${state.day} 日，事务所营业中`,
    contractId: 'incident:single',
  }, { state }, 0, context);
  if (!result.ok) {
    recordLlmLog({ kind: '强制事件', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const raw = result.raw;
  const options = Array.isArray(raw.options) ? raw.options.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 3) : [];
  if (options.length < 2) {
    const message = '事件选项不足，已改用规则事件。';
    recordLlmLog({ kind: '强制事件', ok: false, model: logModel(meta, config), status: statusOf(message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const data: GeneratedIncident = {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 22) : '桌上多了一件事',
    body: typeof raw.body === 'string' ? raw.body.trim().slice(0, 160) : '',
    options: options.map((option, index) => ({
      label: typeof option.label === 'string' && option.label.trim() ? option.label.trim().slice(0, 16) : `选项 ${index + 1}`,
      hint: typeof option.hint === 'string' ? option.hint.trim().slice(0, 40) : '',
      effect: parseIncidentEffect(option.effect),
    })),
  };
  recordLlmLog({ kind: '强制事件', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `事件生成成功：${data.title}`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

/** 每晚一条城市播报：势力、污染与安定度都由宏喂进去，模型只负责写成短讯。 */
export async function generateCityNews(config: LlmConfig, state: GameState, preset?: PresetRuntime): Promise<{ ok: true; data: CityNews } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  if (!hasCredentials(applyPresetApi(preset ?? EMPTY_RUNTIME, config))) {
    return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  }
  // v167：一档夜间访谈 —— 主持人与嘉宾由本地先选好，模型只负责写他们说的话。
  const host = pickNewsHost(state);
  const guests = pickNewsGuests(state, host?.id);
  const points = newsTalkingPoints(state);
  const castLines = [host, ...guests]
    .filter((person): person is NonNullable<typeof host> => Boolean(person))
    .map(person => {
      const head = `- id=${person.id} · ${person.name} · ${person.title}${person.id === host?.id ? '（主持人）' : '（嘉宾）'}`;
      const brief = newsSpeakerBrief(state, person);
      return brief ? `${head}\n  ${brief}` : head;
    })
    .join('\n');
  const castIds = [host, ...guests].filter((person): person is NonNullable<typeof host> => Boolean(person)).map(person => person.id);
  const memoryLines = castIds
    .map(id => {
      const girl = [...(state.girls ?? []), ...(state.candidates ?? [])].find(item => item.id === id);
      if (!girl) return '';
      const memory = newsGuestMemory(state, id);
      return memory ? `${girl.name}：\n${memory}` : '';
    })
    .filter(Boolean)
    .join('\n');
  const hint = [
    `请为第 ${state.day} 日的夜晚写这档访谈。提到所长时用他的名字「${loadPlayerProfile().name.trim() || '新任所长'}」，不要用「你」。`,
    '【今晚台上的人】',
    castLines || '（今晚没有人能上节目，写一段主持人独白）',
    '【今晚要谈的事】',
    `- 势力：${points.faction}`,
    `- 污染：${points.pollution}`,
    `- 安定：${points.stability}`,
    `- 街头：${points.street}`,
    '【她们最近做过的事】这是她们自己的经历；聊到时用她自己的口吻带一句，不要念数字、不要整段复述。',
    memoryLines || '（最近没有特别的事，聊眼前就好）',
    '每个人说话都要像她自己：照上面写的性格与说话方式，三个人不要一个腔调，也不要写成汇报或通报。',
    '上面的数字只是给你判断形势用的：台词里不要报数字、不要念读数，把它们变成具体的人、事、动作和情绪。',
  ].join('\n');
  const result = await callJson(config, preset, 'news', newsContract(), hint, ['共用词条 + 城市新闻词条 + 结构契约', '今晚的城市'], meta, { context: '城市新闻' }, { state });
  if (!result.ok) {
    recordLlmLog({ kind: '城市新闻', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const news = sanitizeCityNews({ ...result.raw, host, guests, day: state.day, generatedAt: new Date().toISOString(), source: 'llm' }, state.day);
  if (!news) {
    const message = '模型没有给出可用的播报，已改用本地快讯。';
    recordLlmLog({ kind: '城市新闻', ok: false, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  recordLlmLog({ kind: '城市新闻', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `城市新闻已生成：${news.headline}`, request: meta.request, response: meta.response });
  return { ok: true, data: news };
}

export async function generateEvent(config: LlmConfig, girl: Girl, storyline?: { title: string; premise: string }, preset?: PresetRuntime, state?: GameState): Promise<{ ok: true; data: GeneratedEvent } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const pastEvents = state ? recentEventSummaries(state, girl.id) : '';
  const context = `${storyline ? `所属故事线：${storyline.title}——${storyline.premise}。这段事件应当是那条线的一次具体落地，不要另起炉灶。` : '目前没有进行中的故事线，请写一段独立的日常事件。'}
${pastEvents ? `你们之前发生过的（只给摘要，别复述原文）：\n${pastEvents}` : ''}`;
  const result = await callJson(config, preset, 'event', eventContract(), eventUserHint(girl.name), ['共用词条 + 私人事件词条 + 结构契约', `角色：${girl.name}`], meta, {
    char: girlBrief(girl),
    personality: activePersonality(girl),
    scenario: storyline ? `${storyline.title}——${storyline.premise}` : '',
    story: storyline?.title ?? '',
    contractId: 'event:contract',
    }, { state, focus: girl }, 0, context);
  if (!result.ok) {
    recordLlmLog({ kind: '角色事件', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const raw = result.raw;
  const scenes = Array.isArray(raw.scenes) ? raw.scenes.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 3) : [];
  if (scenes.length < 2) {
    const message = '事件场次不足，已改用模板。';
    recordLlmLog({ kind: '角色事件', ok: false, model: logModel(meta, config), status: statusOf(message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const data: GeneratedEvent = {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 22) : `${girl.name}的一个晚上`,
    hook: typeof raw.hook === 'string' ? raw.hook.trim().slice(0, 100) : '',
    backdrop: isBackdropId(raw.backdrop) ? raw.backdrop : undefined,
    scenes: scenes.map((scene, index) => {
      const lines = Array.isArray(scene.lines) ? scene.lines.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 5) : [];
      return {
        title: typeof scene.title === 'string' && scene.title.trim() ? scene.title.trim().slice(0, 16) : `第 ${index + 1} 场`,
        narration: typeof scene.narration === 'string' ? scene.narration.trim().slice(0, 120) : '',
        lines: lines.map(line => ({
          speaker: typeof line.speaker === 'string' && line.speaker.trim() ? line.speaker.trim().slice(0, 12) : girl.name,
          tone: typeof line.tone === 'string' ? line.tone.trim().slice(0, 10) : '',
          text: typeof line.text === 'string' ? line.text.trim().slice(0, 120) : '',
          after: typeof line.after === 'number' && Number.isFinite(line.after) ? Math.max(0, Math.round(line.after)) : undefined,
        })).filter(line => line.text),
      };
    }),
  };
  recordLlmLog({ kind: '角色事件', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `事件生成成功：${data.title}`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

export interface GeneratedArcPassage {
  title: string;
  narration: string;
  lines: { speaker: string; tone: string; text: string; after?: number }[];
  choices: { label: string; intent: string; effect?: StoryEffect }[];
}

export interface GeneratedStoryArc {
  title: string;
  hook: string;
  summary: string;
  backdrop?: string;
  passages: GeneratedArcPassage[];
}

export interface StoryArcInput {
  storylineTitle?: string;
  premise?: string;
  beatTitle?: string;
  beatHook?: string;
  memory?: string;
}

const ARC_TARGETS = '至少 4 段，每段旁白 260–520 字、2–4 行对话、2–3 个选项；全文合计不少于 1200 字';

/** 分幕剧情：一次生成 4–5 段完整剧情，选项带明确后果。 */
export async function generateStoryArc(config: LlmConfig, girl: Girl, input: StoryArcInput, preset?: PresetRuntime, state?: GameState): Promise<{ ok: true; data: GeneratedStoryArc } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  // v54：写法要求在预设的「剧情·这一幕的写法」分区里，代码只留数据段与锁定契约。
  const body = [
    input.storylineTitle ? `故事线：${input.storylineTitle}${input.premise ? `——${input.premise}` : ''}` : '',
    input.beatTitle ? `这一幕：${input.beatTitle}${input.beatHook ? `——${input.beatHook}` : ''}` : '',
    input.memory ? `前情（必须与之一致，不要重复原文）：${input.memory.slice(0, 1600)}` : '',
    '【这一次】写这一段剧情的完整章节，不是开场白、也不是续写。',
    arcContract(ARC_TARGETS),
  ].filter(Boolean).join('\n');
  const result = await callJson(config, preset, 'arc', body, arcUserHint('beat', girl.name), ['共用词条 + 完整剧情词条 + 结构契约', `角色：${girl.name}`, '前情与这一幕'], meta, {
    char: girlBrief(girl),
    personality: activePersonality(girl),
    scenario: [input.premise, input.beatTitle, input.beatHook].filter(Boolean).join('\n'),
    story: input.storylineTitle ?? '',
    }, { state, focus: girl });
  if (!result.ok) {
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const raw = result.raw;
  const rawPassages = Array.isArray(raw.passages) ? raw.passages.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 5) : [];
  const passages: GeneratedArcPassage[] = rawPassages.map((passage, index) => {
    const lines = Array.isArray(passage.lines) ? passage.lines.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 4) : [];
    const choices = Array.isArray(passage.choices) ? passage.choices.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 3) : [];
    return {
      title: typeof passage.title === 'string' && passage.title.trim() ? passage.title.trim().slice(0, 18) : `第 ${index + 1} 段`,
      narration: typeof passage.narration === 'string' ? passage.narration.trim().slice(0, PASSAGE_LIMIT) : '',
      lines: lines.map(line => ({
        speaker: typeof line.speaker === 'string' && line.speaker.trim() ? line.speaker.trim().slice(0, 12) : girl.name,
        tone: typeof line.tone === 'string' ? line.tone.trim().slice(0, 10) : '',
        text: typeof line.text === 'string' ? line.text.trim().slice(0, 200) : '',
        after: typeof line.after === 'number' && Number.isFinite(line.after) ? Math.max(0, Math.round(line.after)) : undefined,
      })).filter(line => line.text),
      choices: choices.map((choice, at) => ({
        label: typeof choice.label === 'string' && choice.label.trim() ? choice.label.trim().slice(0, 30) : `选择 ${at + 1}`,
        intent: typeof choice.intent === 'string' ? choice.intent.trim().slice(0, 40) : '',
        effect: parseEffect(choice.effect),
      })),
    };
  }).filter(passage => passage.narration.length >= 80 && passage.choices.length >= 1);
  const total = passages.reduce((sum, passage) => sum + passage.narration.length, 0);
  if (passages.length < 3 || total < 900) {
    const message = '剧情段落或字数不足，已改用模板剧情。';
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: statusOf(message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const data: GeneratedStoryArc = {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 24) : input.beatTitle || `${girl.name}的一晚`,
    hook: typeof raw.hook === 'string' ? raw.hook.trim().slice(0, 120) : input.beatHook ?? '',
    summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim().slice(0, 300) : passages.map(passage => passage.title).join(' · '),
    backdrop: isBackdropId(raw.backdrop) ? raw.backdrop : undefined,
    passages,
  };
  recordLlmLog({ kind: '角色剧情', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `剧情生成成功：${data.title}（${total} 字 / ${passages.length} 段）`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

const STORY_EXPRESSIONS = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'] as const;

export interface StoryTurnDraft {
  narration: string;
  lines: StoryLine[];
  options: string[];
  bond: number;
}

function storyCast(state: GameState, event: CharacterEvent): { id: string; name: string; brief?: string }[] {
  const ids = (event.cast ?? []).filter(Boolean);
  const people = ids.flatMap(id => {
    const person = storyPersonOf(state, id);
    if (!person) return [];
    return [{ id: person.girl.id, name: person.girl.name, brief: castBriefOf(person) }];
  });
  if (!people.length) {
    const person = storyPersonOf(state, event.girlId);
    if (person) people.push({ id: person.girl.id, name: person.girl.name, brief: castBriefOf(person) });
  }
  return [...people, { id: 'player', name: '所长' }];
}

/** 在场的人写进提示词的一句简报：契约者用档案摘要，名册里的首领/随从带上她的位置。 */
function castBriefOf(person: StoryPerson): string {
  const girl = person.girl;
  if (person.role) {
    // v169：以前这里只有"名字 + 座位 + 一句出场白"，随从的外貌、性情、能力全丢了。
    // 名册里的人是投影出来的 Girl，bond 恒为 0，档案摘要会写出「对所长 0/100（厌恶）」，
    // 所以这里自己拼一份：身份 / 外形 / 性情 / 能力 / 立场。
    const statNames: Record<string, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };
    const stats = Object.entries(girl.stats).map(([key, value]) => `${statNames[key] ?? key} ${value}`).join(' / ');
    return [
      `身份：${girl.name}（${girl.id}）· 代号「${girl.codename}」· ${person.role}`,
      `外形：${girl.appearance?.trim() || '不详'}`,
      `性情：${girl.personality?.trim() || activePersonality(girl) || '安静'}；出场白：「${girl.quote?.trim() || '没有留下出场白'}」`,
      `能力：${girl.element} · Lv.${girl.level} · 四维 ${stats}`,
      `（她是${person.role}，不是你的契约者，也不听事务所调遣；说话按她自己的立场。）`,
    ].join('\n');
  }
  return storyCastBrief(girl, person.isAssistant === true);
}

function parseStoryLines(raw: unknown, cast: { id: string; name: string }[], limit = 8): StoryLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const line = item as Record<string, unknown>;
    const text = typeof line.text === 'string' ? line.text.trim().slice(0, 220) : '';
    if (!text) return [];
    const speakerId = typeof line.speakerId === 'string' ? line.speakerId.trim() : '';
    // 所长这一轮说了什么/做了什么，界面里已经有他自己的行动气泡；模型再写一遍就是两条一样的。
    if (speakerId === 'player') return [];
    const person = cast.find(entry => entry.id === speakerId);
    // 只有 cast 里的人与玩家能说话；其他人最多在旁白里被提到。
    if (!person) return [];
    const expression = STORY_EXPRESSIONS.includes(line.expression as typeof STORY_EXPRESSIONS[number])
      ? line.expression as Expression : 'calm';
    const after = typeof line.after === 'number' && Number.isFinite(line.after)
      ? Math.max(0, Math.round(line.after))
      : undefined;
    return [{ speakerId: person.id, speakerName: person.name, expression, text, mode: line.mode === 'thought' ? 'thought' as const : 'speech' as const, after }];
  }).slice(0, limit);
}

/** 测试用：把台词解析这一层单独露出来（它决定 after 能不能活着到渲染层）。 */
export function parseStoryLinesForTest(raw: unknown, cast: { id: string; name: string }[], limit = 8): StoryLine[] {
  return parseStoryLines(raw, cast, limit);
}

function storyHistory(turns: StoryTurn[], limit = 8): string {
  const kept = turns.slice(-limit);
  return kept.map(turn => turn.role === 'player'
    ? `所长：${turn.text}`
    : `${turn.text}${turn.lines?.length ? `\n${turn.lines.map(line => `${line.speakerName}：「${line.text}」`).join('\n')}` : ''}`).join('\n\n');
}

/** 模型没写摘要时的兜底：用标题、轮数、最后一次行动与最后一段正文拼一小段，够当「前情提要」用。 */
export function localSessionSummary(event: CharacterEvent, narration: string): string {
  const turns = event.turns ?? [];
  const lastPlayer = [...turns].reverse().find(turn => turn.role === 'player')?.text ?? '';
  const lastNarration = [...turns].reverse().find(turn => turn.role === 'narrator')?.text ?? '';
  const rounds = turns.filter(turn => turn.role === 'player').length;
  const ending = (narration || lastNarration).replace(/\s+/g, ' ');
  const parts = [
    `「${event.title}」${rounds ? `（${rounds} 轮）` : ''}`,
    lastPlayer ? `所长最后说：${lastPlayer.slice(0, 60)}` : '',
    ending ? `收束：${ending.slice(0, 180)}` : '',
  ].filter(Boolean);
  return parts.join('　').slice(0, 400);
}

/**
 * 她与所长最近发生过的剧情（v109）。
 *
 * 只引用收尾时写下的一段摘要，不回看原文——原文留在存档里给玩家翻，
 * 而提示词只需要「发生过什么」。
 */
function recentEventSummaries(state: GameState, girlId: string, limit = 4): string {
  return (state.events ?? [])
    // v176：会议对每位参会者都算「之前发生过的事」。
    .filter(event => event.status === 'done'
      && (event.girlId === girlId || (event.cast ?? []).includes(girlId) || Boolean(event.meeting?.attendeeIds.includes(girlId)))
      && (event.summary ?? '').trim())
    .slice(0, limit)
    .map(event => `· ${event.title}：${(event.summary ?? '').trim()}`)
    .join('\n');
}

/**
 * 台上的人最近真的做过什么（v179）：委托结果 + 已结束的剧情与会议。
 * 访谈要让人觉得她们在聊自己的事，就得把这段记忆一起递进去。
 */
function newsGuestMemory(state: GameState, girlId: string): string {
  const outcome: Record<string, string> = { victory: '打赢了', defeat: '没打下来', repelled: '被挡了回去', draw: '两败', success: '办成了', failure: '办砸了' };
  const runs = (state.missionRuns ?? [])
    .filter(run => run.girlIds.includes(girlId))
    .slice(-2)
    .reverse()
    .map(run => `· 第 ${run.day} 日「${run.title}」${run.district ? `（${districts[run.district].name}）` : ''}：${outcome[run.outcome] ?? run.outcome}`);
  const events = recentEventSummaries(state, girlId, 2).split('\n').filter(Boolean);
  return [...runs, ...events].slice(0, 4).join('\n');
}
function storyCastBrief(girl: Girl, isAssistant = false): string {
  // v176：助手在提示词里要有身份，不然模型只把她当普通契约者。
  return `${girl.name}（${girl.id}）${isAssistant ? ' · 所长的助手' : ''} · ${girl.title} · ${girl.element}/${girl.archetype ?? '未定'} · 羁绊 ${girl.bond}。性格：${activePersonality(girl) || girl.personality || '安静'}。外貌：${girl.appearance ?? '不详'}。${outfitLine(girl) ? `${outfitLine(girl)}。` : ''}`;
}

/**

/**
 * 剧情里那个 `{{scenario}}` 变量（v171）。
 *
 * 之前把 `event.hook` 直接当 scenario 传下去，预设里的【场景】词条就会把
 * 「你让人递了帖子。克拉拉回话：…」原样印进提示词 —— 约谈的开场又被定死了。
 * 现在约谈 / 传唤 / 会议这类事件把 `hookInPrompt` 设成 false，这里就回空串。
 */
export function storyScenarioOf(event: Pick<CharacterEvent, 'hook' | 'hookInPrompt'>): string {
  if (event.hookInPrompt === false) return '';
  return event.hook ?? '';
}

/**
 * 会议场景的上下文（v168）。
 *
 * 会议不是"约谈"：它有一条明确的议程（标题）、一个地点、一屋子彼此认识的人，
 * 还有一笔已经花掉的经费。采购只是背景道具，不要让模型把它写成主题。
 */
function meetingContext(state: GameState, event: CharacterEvent): string {
  const plan = event.meeting;
  if (!plan) return '';
  const people = plan.attendeeIds
    .map(id => state.girls.find(girl => girl.id === id))
    .filter((girl): girl is Girl => Boolean(girl))
    .map(girl => `${girl.name}（${girl.title}，疲劳 ${girl.fatigue}）`);
  const relations: string[] = [];
  for (let i = 0; i < plan.attendeeIds.length; i += 1) {
    for (let j = i + 1; j < plan.attendeeIds.length; j += 1) {
      const a = state.girls.find(girl => girl.id === plan.attendeeIds[i]);
      const b = state.girls.find(girl => girl.id === plan.attendeeIds[j]);
      if (!a || !b) continue;
      relations.push(`${a.name}×${b.name} ${a.relationships[b.id] ?? 40}`);
    }
  }
  const host = state.girls.find(girl => girl.id === state.assistantId);
  return [
    `【这是一场事务所会议】「${plan.title}」，地点：${plan.placeName}，${plan.at}`,
    `参会 ${people.length} 人：${people.join('、') || '（名单为空）'}`,
    relations.length ? `彼此关系（0–100）：${relations.join(' · ')}` : '',
    plan.buys ? `开会时买的东西：${plan.buys}（只是背景道具，最多在开头或中途各提一次，别当成会议主题）` : '开会没买什么，桌上只有水和纸。',
    host ? `主持人是助手 ${host.name}，她负责推进议程。` : '没有助手，会议由所长自己主持。',
    '这一段是内部会议：说话的是参会的人，不写旁白式的会议纪要；每人只代表自己的立场。',
  ].filter(Boolean).join('\n');
}

/** 交互剧情的开场白：250–350 字，把在场的人与此刻的场面交代清楚，然后停住。 */
/**
 * 开场提示词的上下文（v123）。
 *
 * 玩家写的那段话原样进来，并且明确要求模型沿用他给出的时间、地点、姿态，
 * 不另起炉灶——否则模型会把「我推门进去，外头在下雨」改写成另一种开场。
 */
export function openingContext(state: GameState, event: CharacterEvent, seed = ''): string {
  const cast = storyCast(state, event);
  const briefs = cast.filter(person => person.id !== 'player').map(person => person.brief ?? person.name).join('\n');
  const seedText = seed.trim().slice(0, 300);
  return [
    `【这一段剧情】${event.title}`,
    event.hookInPrompt === false ? '' : event.hook ? `引子：${event.hook}` : '',
    // v109：以前的剧情只以摘要形式出现，不回放原文。
    recentEventSummaries(state, event.girlId) ? `【你们之前发生过的】\n${recentEventSummaries(state, event.girlId)}` : '',
    factionSnapshotText(state, personOfEvent(state, event)?.seat?.faction),
    meetingContext(state, event),
    seedText ? `【所长的开场】${seedText}\n这一段会作为这一段剧情的第一句，由所长先说。你只写她听见之后的反应、场面与台词：不要替所长补话，也不要抢先替她寒暄；沿用他给出的时间、地点与姿态，不要另起炉灶、不要换场景。` : '',
    '【在场的人】',
    briefs || '只有她和你',
    '【你】所长（player），用「你」称呼，可以是说话人。',
    seedText ? '【这一次】接着所长写的那一段往下写第一轮，把话头交回给他。' : '【这一次】写这一幕的开场白，把话头留给所长。',
  ].filter(Boolean).join('\n');
}

/** 测试用：只看开场上下文，不真的调用模型。 */
export function storyOpeningContextForTest(state: GameState, event: CharacterEvent, seed = ''): string {
  return openingContext(state, event, seed);
}
export async function generateStoryOpening(config: LlmConfig, state: GameState, event: CharacterEvent, preset?: PresetRuntime, seed = ''): Promise<{ ok: true; narration: string; lines: StoryLine[]; options: string[]; backdrop?: string } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const cast = storyCast(state, event);
  const briefs = cast.filter(person => person.id !== 'player').map(person => person.brief ?? person.name).join('\n');
  // 契约单独给一份，正文另给 appendix：这样预设里改「蓝图开场 · 结构契约」才会生效，
  // 而且改契约不会顺手删掉在场的人和这一场的场面。
  const context = openingContext(state, event, (seed || event.playerSeed || '').trim());
  const body = arcOpeningContract();
  const result = await callJson(config, preset, 'arc', body, arcUserHint('opening'), ['共用词条 + 完整剧情词条 + 结构契约', `角色：${event.title}`], meta, {
    char: briefs, personality: '', scenario: storyScenarioOf(event), story: event.title, contractId: 'arc:opening',
    }, { state, focus: focusGirlOf(state, event), focusRole: focusRoleOf(state, event) }, 0, context);
  if (!result.ok) {
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const narration = typeof result.raw.narration === 'string' ? result.raw.narration.trim().slice(0, OPENING_LIMIT) : '';
  const lines = parseStoryLines(result.raw.lines, cast, 5);
  // v102：不再按字数判死。短就短，先让人看到画面与对话，要不要重来由玩家自己点。
  if (!narration && lines.length === 0) {
    const message = '叙事者什么都没写出来，可以再试一次。';
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const rawOptions = Array.isArray(result.raw.options) ? result.raw.options : [];
  const options = rawOptions.filter((item): item is string => typeof item === 'string').map(item => item.trim().slice(0, 24)).filter(Boolean).slice(0, 3);
  recordLlmLog({ kind: '角色剧情', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `开场白：${event.title}（${narration.length} 字）`, request: meta.request, response: meta.response });
  // v191：叙事者写这一段时顺手选的背景；认不出来就不用，交给辖区/房间的旧规则。
  return { ok: true, narration, lines, options, backdrop: isBackdropId(result.raw.backdrop) ? result.raw.backdrop : undefined };
}

/**
 * 交互剧情的收尾：玩家决定把这一段停在这里，由叙事者写出结局。
 *
 * 与续写共用同一个 arc 用途与在场的人，但不给 options——这一轮之后没有下一轮。
 */
export async function generateStoryEnding(
  config: LlmConfig,
  state: GameState,
  event: CharacterEvent,
  preset?: PresetRuntime,
  /** v188：所长点了结束、但输入框里还留着一句没发出去的话——收尾时当作引子。 */
  lead?: string,
  choice?: { options: { id: string; label: string }[] },
): Promise<{ ok: true; turn: { narration: string; lines: StoryLine[] }; summary: string; choice?: string } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const cast = storyCast(state, event);
  const briefs = cast.filter(person => person.id !== 'player').map(person => person.brief ?? person.name).join('\n');
  const rounds = (event.turns ?? []).filter(turn => turn.role === 'player').length;
  const choices = (choice?.options ?? []).slice(0, 4);
  const context = [
    `【这一段剧情】${event.title}`,
    event.opening ? `开场：${event.opening.slice(0, 1600)}` : event.hookInPrompt === false ? '' : event.hook ? `引子：${event.hook}` : '',
    recentEventSummaries(state, event.girlId) ? `【你们之前发生过的】\n${recentEventSummaries(state, event.girlId)}` : '',
    factionSnapshotText(state, personOfEvent(state, event)?.seat?.faction),
    meetingContext(state, event),
    '【在场的人】',
    briefs || '只有她和你',
    '【此前的对话】',
    storyHistory(event.turns ?? []) || '（这是第一轮）',
    choices.length ? `【这一段之后的岔路口】\n必须从这些选项里选一条，作为所长实际走的方向：\n${choices.map(option => `- ${option.id}：${option.label}`).join('\n')}\n只写 id，不要写效果数值。` : '',
    endingLeadBlock(lead),
    rounds ? `（这一夜你们来回说了 ${rounds} 轮。）` : '',
  ].filter(Boolean).join('\n');
  const ask = (extra = '') => callJson(config, preset, 'arc', arcEndingContract(choices), arcUserHint('ending'), ['共用词条 + 完整剧情词条 + 收尾契约', `角色：${event.title}`], meta, {
    char: briefs, personality: '', scenario: storyScenarioOf(event), story: event.title, contractId: 'arc:ending',
  }, { state, focus: focusGirlOf(state, event), focusRole: focusRoleOf(state, event) }, 0, extra ? `${context}\n\n${extra}` : context);
  let result = await ask();
  const allowed = choices.map(option => option.id);
  const pickedChoice = () => (result.ok && typeof result.raw.choice === 'string' ? result.raw.choice.trim() : '');
  if (result.ok && allowed.length && !allowed.includes(pickedChoice())) {
    const first = result;
    const repaired = await ask(`【上一次收尾没有落在蓝图分支上】\n${JSON.stringify(result.raw).slice(0, 1200)}\n\n【必须修正】choice 只能取：${allowed.join('、')}。只输出修正后的完整 JSON，保留 narration / lines / summary。`);
    // 返修失败也保留第一次的结局：分支留空，交给档案页手选。
    result = repaired.ok ? repaired : first;
  }
  if (!result.ok) {
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const narration = typeof result.raw.narration === 'string' ? result.raw.narration.trim() : '';
  const lines = parseStoryLines(result.raw.lines, cast, 5);
  // v102：收尾也不按字数卡；空到手上一句话都没有才算失败。
  if (!narration && lines.length === 0) {
    const message = '收尾什么都没写出来，可以再试一次。';
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const picked = pickedChoice();
  const choiceId = allowed.includes(picked) ? picked : undefined;
  recordLlmLog({ kind: '角色剧情', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `收尾：${event.title}（${narration.length} 字）`, request: meta.request, response: meta.response });
  // v109：收尾时顺手把整段压成摘要——之后的历史只引用它，原文留给人翻。
  const summary = typeof result.raw.summary === 'string' && result.raw.summary.trim()
    ? result.raw.summary.trim().slice(0, 800)
    : localSessionSummary(event, narration);
  return { ok: true, turn: { narration, lines }, summary, choice: choiceId };
}

/**
 * 交互剧情的一轮续写：读玩家这一句，写出她的反应、台词与下一轮的参考行动。
 *
 * `rewrite` 为真时要求换一种写法，用于「重写这一段」。
 */
export async function generateStoryTurn(
  config: LlmConfig,
  state: GameState,
  event: CharacterEvent,
  action: string,
  preset?: PresetRuntime,
  options: { rewrite?: boolean } = {},
): Promise<{ ok: true; turn: StoryTurnDraft } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const cast = storyCast(state, event);
  const briefs = cast.filter(person => person.id !== 'player').map(person => person.brief ?? person.name).join('\n');
  const turns = event.turns ?? [];
  const history = storyHistory(turns);
  const playerLine = action.trim().slice(0, 300);
  const context = [
    `【这一段剧情】${event.title}`,
    event.opening ? `开场：${event.opening.slice(0, 1600)}` : event.hookInPrompt === false ? '' : event.hook ? `引子：${event.hook}` : '',
    recentEventSummaries(state, event.girlId) ? `【你们之前发生过的】\n${recentEventSummaries(state, event.girlId)}` : '',
    factionSnapshotText(state, personOfEvent(state, event)?.seat?.faction),
    meetingContext(state, event),
    '【在场的人】',
    briefs || '只有她和你',
    '【此前的对话】',
    history || '（这是第一轮）',
    '【所长这一次的行动】',
    playerLine,
    options.rewrite ? '【要求】把上一轮的旁白与台词换一种写法重写：同样的局面、同样的结果，但换动作、换角度、换她说话的方式。不要复述原文句式。' : '',
    '【这一次】接着写下一轮，不要重写开场。',
  ].filter(Boolean).join('\n');
  const body = arcTurnContract();
  const result = await callJson(config, preset, 'arc', body, arcUserHint('turn'), ['共用词条 + 完整剧情词条 + 结构契约', `角色：${event.title}`, '此前对话与玩家行动'], meta, {
    char: briefs, personality: '', scenario: storyScenarioOf(event), story: event.title, contractId: 'arc:turn',
  }, { state, focus: focusGirlOf(state, event), focusRole: focusRoleOf(state, event) }, 0, context);
  if (!result.ok) {
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const narration = typeof result.raw.narration === 'string' ? result.raw.narration.trim() : '';
  const lines = parseStoryLines(result.raw.lines, cast, 8);
  // v102：不再因为「太短」把这一轮丢掉——先让玩家看到旁白与台词，觉得不够可以自己重写。
  if (!narration && lines.length === 0) {
    const message = '叙事者这一轮什么都没写出来，可以再试一次。';
    recordLlmLog({ kind: '角色剧情', ok: false, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const rawOptions = Array.isArray(result.raw.options) ? result.raw.options : [];
  const optionList = rawOptions
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 3);
  const bondRaw = Number(result.raw.bond);
  const bond = Number.isFinite(bondRaw) ? Math.max(-2, Math.min(2, Math.round(bondRaw))) : 0;
  const turn: StoryTurnDraft = { narration: narration.slice(0, NARRATION_LIMIT), lines, options: optionList, bond };
  recordLlmLog({ kind: '角色剧情', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `剧情续写：${event.title}（${turn.narration.length} 字 / ${lines.length} 句）`, request: meta.request, response: meta.response });
  return { ok: true, turn };
}

export interface GeneratedOutfit {
  name: string;
  description: string;
}

/** 看图写一条衣柜词条：套装名 + 50–90 字的材质/剪裁/配饰描述。 */
export async function generateOutfitDescription(config: LlmConfig, portrait: string, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedOutfit } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  if (!hasCredentials(applyPresetApi(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const body = outfitContract();
  const outcome = await chatJson(config, preset, 'outfit', body, [{ type: 'text', text: '请为这套服装写一条衣柜词条。' }, { type: 'image_url', image_url: { url: portrait } }], ['共用词条 + 服装词条 + 结构契约（含立绘）', '用户请求：补充服装描述'], meta);
  const result = outcome.result;
  if (!result.ok) {
    if (/image|vision|multimodal|图像|图片/i.test(result.message)) {
      recordLlmLog({ kind: '服装描述', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
      return { ok: false, message: `写描述失败：当前模型似乎不支持图像输入，请换用支持视觉的模型。原始错误：${result.message}` };
    }
    recordLlmLog({ kind: '服装描述', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return { ok: false, message: `写描述失败：${result.message}` };
  }
  if (!outcome.raw) {
    const message = jsonFailureMessage('写描述失败：', outcome);
    recordLlmLog({ kind: '服装描述', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const raw = outcome.raw;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 16) : '';
  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 160) : '';
  if (!name || !description) {
    const message = '模型没有给出可用的服装描述，可以重试一次。';
    recordLlmLog({ kind: '服装描述', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  recordLlmLog({ kind: '服装描述', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `服装词条：${name}`, request: meta.request, response: meta.response });
  return { ok: true, data: { name, description } };
}

export interface GeneratedWitchForm {
  name: string;
  description: string;
  personality: string;
}

/** 看魔女化立绘写形态名、形态描述与魔女化人格；只补文字，不改侵蚀与形态状态。 */
export async function generateWitchFormProfile(
  config: LlmConfig,
  input: { portrait: string; girlName: string; codename?: string; appearance?: string; personality: string },
  preset?: PresetRuntime,
): Promise<{ ok: true; data: GeneratedWitchForm } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  if (!hasCredentials(applyPresetApi(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const who = `她叫${input.girlName}${input.codename ? `（${input.codename}）` : ''}，原本的性格：${input.personality.trim() || '安静'}。${input.appearance ? `\n外貌：${input.appearance}` : ''}`;
  const outcome = await chatJson(config, preset, 'profile', witchFormContract(), [{ type: 'text', text: '请为这张魔女化立绘写形态名、形态描述与魔女化人格。' }, { type: 'image_url', image_url: { url: input.portrait } }], ['共用词条 + 角色起草词条 + 结构契约（含立绘）', '用户请求：魔女化形态'], meta, { contractId: 'profile:witch' }, 0, {}, who);
  const result = outcome.result;
  if (!result.ok) {
    const message = /image|vision|multimodal|图像|图片/i.test(result.message)
      ? `写魔女化形态失败：当前模型似乎不支持图像输入，请换用支持视觉的模型。原始错误：${result.message}`
      : `写魔女化形态失败：${result.message}`;
    recordLlmLog({ kind: '魔女化词条', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (!outcome.raw) {
    const message = jsonFailureMessage('写魔女化形态失败：', outcome);
    recordLlmLog({ kind: '魔女化词条', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const raw = outcome.raw;
  const pick = (key: string, limit: number) => (typeof raw[key] === 'string' ? (raw[key] as string).trim().slice(0, limit) : '');
  const name = pick('name', 24) || '魔女化 · 夜之形';
  const description = pick('description', 200);
  const personality = pick('personality', 600);
  if (!description || !personality) {
    const message = '模型没有给出可用的形态描述或人格，可以重试一次。';
    recordLlmLog({ kind: '魔女化词条', ok: false, model: logModel(meta, config), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  recordLlmLog({ kind: '魔女化词条', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `魔女化形态：${name}`, request: meta.request, response: meta.response });
  return { ok: true, data: { name, description, personality } };
}

/** 把一场已结算的战斗写成多人分场札记；只读，不改变任何战斗结果。 */
export async function generateBattleNote(config: LlmConfig, battle: BattleState, preset?: PresetRuntime, state?: GameState): Promise<{ ok: true; data: BattleNote } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const cfg = applyPresetApi(preset ?? EMPTY_RUNTIME, config);
  if (!hasCredentials(cfg)) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const cast = battleCast(battle);
  const castText = cast.length
    ? cast.map(actor => `${actor.side === 'ally' ? '我方' : '敌方'} ${actor.name}${actor.codename ? `（${actor.codename}）` : ''}｜speakerId=${actor.girlId}｜表情=${actor.expression}`).join('\n')
    : '（没有带姓名与立绘的参战魔法少女；本场只能写旁白）';
  // v53：场地 / 时间 / 我方 / 敌方 / 战报都作为变量注入，文字说明在预设的「札记·这一战的现场」分区里。
  const body = battleContract();
  const battleVars = {
    battlePlace: battlePlaceText(battle, state),
    battleTime: battleTimeText(battle),
    battleGirls: battleGirlText(battle, state),
    battleMonsters: battleMonsterText(battle),
    battleCast: castText,
    battleReport: battleStoryDigest(battle),
  };
  const outcome = await chatJson(config, preset, 'battle', body, '请把这场战斗写成札记。', ['共用词条 + 战斗札记词条 + 结构契约', `战斗：${battle.missionTitle}`], meta, {
    story: battle.missionTitle,
    context: `结果：${battle.outcome ?? '未结算'}；参战：${cast.map(actor => actor.name).join('、') || '无'}`,
    char: castText,
    ...battleVars,
  }, 14000, { state });
  if (!outcome.result.ok) {
    recordLlmLog({ kind: '战斗札记', ok: false, model: cfg.model.trim(), status: statusOf(outcome.result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: outcome.result.message, request: meta.request, response: meta.response });
    return { ok: false, message: `写札记失败：${outcome.result.message}` };
  }
  if (!outcome.raw) {
    const message = jsonFailureMessage('写札记失败：', outcome);
    recordLlmLog({ kind: '战斗札记', ok: false, model: cfg.model.trim(), durationMs: Date.now() - started, endpoint: llmEndpointLabel(cfg), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const normalized = normalizeBattleNoteDraft(outcome.raw);
  let validation = validateBattleNoteDraft(normalized, battle, { createdAt: new Date().toISOString(), model: config.model.trim(), presetId: preset?.id });
  let source = outcome;
  if (!validation.ok) {
    const repairBody = `${body}\n\n【上一次输出（未通过本地校验）】\n${JSON.stringify(outcome.raw)}\n\n【必须修正的问题】\n${validation.errors.map((entry, index) => `${index + 1}. ${entry}`).join('\n')}\n\n只输出修正后的完整 JSON。不要解释，不要省略场景或台词；speakerId 必须来自上面的可说话角色表。`;
    const repaired = await chatJson(config, preset, 'battle', repairBody, '请只输出修正后的完整 JSON。', ['共用词条 + 战斗札记词条 + 结构契约', '修复上一次札记'], meta, {
      story: battle.missionTitle,
      context: '修复札记',
      ...battleVars,
    }, 14000, { state });
    source = repaired;
    if (!repaired.result.ok) {
      recordLlmLog({ kind: '战斗札记', ok: false, model: cfg.model.trim(), status: statusOf(repaired.result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(cfg), message: repaired.result.message, request: meta.request, response: meta.response });
      return { ok: false, message: `札记未通过校验，修复请求失败：${repaired.result.message}` };
    }
    if (!repaired.raw) {
      const message = jsonFailureMessage('札记未通过校验，且修复输出无法解析。', repaired);
      recordLlmLog({ kind: '战斗札记', ok: false, model: cfg.model.trim(), durationMs: Date.now() - started, endpoint: llmEndpointLabel(cfg), message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    validation = validateBattleNoteDraft(normalizeBattleNoteDraft(repaired.raw), battle, { createdAt: new Date().toISOString(), model: cfg.model.trim(), presetId: preset?.id });
  }
  if (!validation.ok || !validation.note) {
    const message = `札记未通过校验：${validation.errors.join('；')}`;
    recordLlmLog({ kind: '战斗札记', ok: false, model: cfg.model.trim(), durationMs: Date.now() - started, endpoint: llmEndpointLabel(cfg), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const note = validation.note;
  recordLlmLog({ kind: '战斗札记', ok: true, model: cfg.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(cfg), message: `战斗札记：${battle.missionTitle}（${note.charCount} 字，${source.attempts} 次请求）`, request: meta.request, response: meta.response });
  return { ok: true, data: note };
}

export interface GeneratedGirlProfile {
  name: string; codename: string; title: string; element: Element; archetype: Archetype;
  quote: string; goal: string; appearance: string; personality: string; outfitDescription: string;
  /** 语料：说话方式、口头习惯、例话。 */
  voice?: GirlVoice;
  focus: StatKey; skillIds: string[]; traits: DraftTrait[];
  /** 代表色：让 LLM 一并给出，避免十张卡一个粉。 */
  color?: string;
}

async function generateGirlProfileCore(config: LlmConfig, portrait?: string, hint?: string, preset?: PresetRuntime, meta?: LlmCallMeta, research?: GirlResearch): Promise<{ ok: true; data: GeneratedGirlProfile } | { ok: false; message: string }> {
  if (!hasCredentials(applyPresetApi(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  // 只把主动列给模型：被动带不带由本地掷骰决定，不写在提示词里。
  const skillList = girlSkillPool().filter(skill => skill.tier !== 'passive').map(s => `${s.id}(${s.name}/${tierLabels[s.tier]}/${s.school})`).join('、');
  const schema = profileSchemaContract();
  const visualRule = portrait
    ? '先观察附带的立绘：发色与发型、瞳色、服装轮廓与配色、配饰、兽耳或尾巴、姿态与表情。appearance 必须具体描述这些可见特征；outfitDescription 必须写到颜色、材质与穿法；element、archetype、personality 和 title 都要从画面气质推断，不能与立绘冲突。'
    : '这次没有立绘，请只根据世界观与文字要求起草，不要假装看见图片。';
  const hintRule = hint?.trim() ? `\n玩家对画面的额外要求（优先满足）：${hint.trim()}` : '';
  // 联网资料只作考据：与立绘/玩家要求冲突时以后者为准，也允许模型说「查不到」。
  const researchRule = research?.summary
    ? `\n\n【联网资料（只作考据，可能不准确）】\n${research.summary.slice(0, 2000)}${research.sources.length ? `\n来源：${research.sources.map(source => source.title || source.uri).join('；')}` : ''}\n要求：只用来对齐作品设定、角色关键词与惯用称呼。与立绘或玩家要求冲突时，以立绘与玩家为准；不要照抄原文，不要写链接，不要编造资料里没有的设定。`
    : '';
  const outcome = await chatJson(config, preset, 'profile', schema, portrait
    ? [{ type: 'text', text: '请根据这张立绘起草这位新契约者，确保外貌、服装、元素与职阶都和画面一致。' }, { type: 'image_url', image_url: { url: portrait } }]
    : '请起草这位新契约者。', ['共用词条 + 角色起草词条 + 结构契约（含立绘）', '用户请求：起草新契约者'], meta, { contractId: 'profile:contract' }, 0, {}, `${visualRule}${hintRule}${researchRule}\n\n【可用主动技能】${skillList}`);
  const result = outcome.result;
  if (!result.ok) {
    if (portrait && /image|vision|multimodal|图像|图片/i.test(result.message)) {
      return { ok: false, message: `起草失败：当前模型似乎不支持图像输入，请换用支持视觉的模型。原始错误：${result.message}` };
    }
    return { ok: false, message: `起草失败：${result.message}` };
  }
  if (!outcome.raw) return { ok: false, message: jsonFailureMessage('起草失败：', outcome) };
  try {
    const raw = outcome.raw;
    const str = (key: string, fallback: string, limit = 160) => typeof raw[key] === 'string' && (raw[key] as string).trim() ? (raw[key] as string).trim().slice(0, limit) : fallback;
    const elementHint = str('element', '星光系', 12);
    const activePool = girlSkillPool().filter(skill => skill.tier !== 'passive');
    const pickedSkills = Array.isArray(raw.skillIds) ? raw.skillIds.filter((id): id is string => typeof id === 'string' && activePool.some(s => s.id === id)) : [];
    const skillIds = [...new Set(pickedSkills)].slice(0, 3);
    // 模型给漏了或写错了，也按元素抽三条主动，而不是永远补池子开头那几条。
    if (skillIds.length < 3) {
      for (const id of pickCandidateSkills([...((raw.name as string) ?? '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0), elementHint, false)) {
        if (skillIds.length >= 3) break;
        if (skillIds.includes(id)) continue;
        skillIds.push(id);
      }
    }
    // 带不带被动由本地掷骰决定，不跟着模型每次都给一条。
    const draftedSkills = rollPassiveSkill(skillIds, elementHint, Math.random);
    const picked = Array.isArray(raw.traits) ? raw.traits.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
    const draftTraits: DraftTrait[] = picked.slice(0, 3).map((item, index) => ({
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim().slice(0, 12) : `未命名特性${index + 1}`,
      description: typeof item.description === 'string' ? item.description.trim().slice(0, 60) : '',
      polarity: item.polarity === 'negative' ? 'negative' : item.polarity === 'neutral' ? 'neutral' : 'positive',
    }));
    while (draftTraits.length < 3) {
      const fallback = traits[draftTraits.length] ?? traits[0];
      draftTraits.push({ name: fallback.name, description: fallback.description, polarity: fallback.polarity });
    }
    const element = elements.includes(raw.element as typeof elements[number]) ? raw.element as Element : '星光系';
    const archetype = archetypes.includes(raw.archetype as typeof archetypes[number]) ? raw.archetype as Archetype : '治愈';
    const focus: StatKey = ['magic', 'insight', 'agility', 'empathy'].includes(raw.focus as string) ? raw.focus as StatKey : 'magic';
    return { ok: true, data: {
      name: str('name', '未命名'), codename: str('codename', '未命名契约'), title: str('title', '刚被城市记住的人'),
      element: element === ('魔物' as Element) ? '星光系' : element, archetype: archetype === ('魔物' as Archetype) ? '治愈' : archetype,
      quote: str('quote', '请多指教。'), goal: str('goal', '想找到一个可以回去的地方。'),
      appearance: str('appearance', '短发，发梢有一缕不合规矩的挑染。', 200), personality: str('personality', '安静，习惯先观察再开口。'),
      outfitDescription: str('outfitDescription', '事务所配发的值夜制服，袖口略长。'), voice: sanitizeVoice(raw.voice), focus, skillIds: draftedSkills, traits: draftTraits,
      color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color.trim()) ? raw.color.trim() : undefined,
    } };
  } catch {
    return { ok: false, message: '起草失败：浏览器无法访问接口，或返回内容不是合法 JSON。' };
  }
}

import { factionInfo } from './content/items.ts';
import { districts } from './districts.ts';
import { cityAveragePollution } from './pollution.ts';
import {
  applyFormat, applyRegexScripts, applyRegexToMessages, composeTaskSystem, presetRuntime, promptTokens, resolvePresetWorld, type ChatPreset, type PresetRuntime, type PromptScope,
} from './presets.ts';
import { loadPlayerProfile, playerSummary } from './player.ts';
import { worldbookContext } from './worldbook.ts';
import { EMPLOYER_LABEL, factionTagLabel, representativeNameOf } from './factions.ts';
import { tierLabels } from './content/skills.ts';
import { girlSkillPool, pickCandidateSkills, rollPassiveSkill } from './skills.ts';
import { sanitizeVoice, voiceLine } from './voice.ts';
import { traits } from './content/traits.ts';
import { validateNightProposal, type NightProposalV2 } from './llm-night.ts';
import { priorSegmentBrief } from './storyplan.ts';
import { isBackdropId } from './vn/backdrops.ts';
import { arcContract, arcEndingContract, arcOpeningContract, arcTurnContract, arcUserHint, battleContract, dailyContract, dialogueContract, endingLeadBlock, eventContract, eventUserHint, incidentBatchContract, newsContract, outfitContract, profileSchemaContract, singleIncidentContract, storylineContract, storylineStartContract, whisperUserHint, witchFormContract} from './promptSections.ts';
import { newsSpeakerBrief, newsTalkingPoints, pickNewsGuests, pickNewsHost, sanitizeCityNews } from './cityNews.ts';
import type { MacroContext } from './promptMacros.ts';
import { battleCast, battleGirlText, battleMonsterText, battlePlaceText, battleStoryDigest, battleTimeText, normalizeBattleNoteDraft, validateBattleNoteDraft } from './battleNote.ts';
import { activePersonality } from './personality.ts';
import { GRAPH_MAX_EDGES, blueprintIssues, buildGraphFromDraft, type StoryGraphDraft, type StoryGraphDraftEdge, type StoryGraphDraftNode } from './storygraph.ts';
import type { Archetype, BattleNote, BattleState, CharacterEvent, CityNews, DialogueLine, DraftTrait, GirlVoice, Element, Equipment, Expression, GameState, Girl, IncidentEffect, MonsterTemplate, StatKey, StoryCompanion, StoryEffect, StoryGraph, StoryLine, StoryMissionSpec, StoryNodeKind, StoryTurn, WhisperJob } from './types';

/** 预设词条可用的变量；玩家档案与命中的世界书词条会被一并注入。 */
export function promptVars(extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  const profile = loadPlayerProfile();
  const player = playerSummary(profile);
  const trigger = [player, extra.world, extra.char, extra.story, extra.context].filter(Boolean).join('\n');
  const book = worldbookContext(trigger);
  return {
    user: profile.name?.trim() || undefined,
    player: player || undefined,
    worldbook: book.text || undefined,
    ...extra,
  };
}

/**
 * 一次调用补一批还没摆上桌的弹窗（v20 §2）。
 * 只产出“条目”，进待用池由 game 侧洗数据、夹上限。
 */
/** 批量事件的回复常换壳子：entries / incidents / items / events / data.entries，偶尔干脆只给一条对象。 */
export function incidentEntriesFrom(raw: Record<string, unknown> | null | undefined): Record<string, unknown>[] {
  if (!raw || typeof raw !== 'object') return [];
  const keys = ['entries', 'incidents', 'items', 'events', 'list'];
  const found: unknown[] = [];
  const take = (box: Record<string, unknown>) => {
    for (const key of keys) {
      const value = box[key];
      if (Array.isArray(value)) found.push(...value);
    }
  };
  take(raw);
  const data = raw.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) take(data as Record<string, unknown>);
  const objects = found.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
  if (objects.length) return objects;
  // 没给数组：raw 本身像不像一条事件
  if (typeof raw.category === 'string' && (typeof raw.title === 'string' || typeof raw.body === 'string')) return [raw];
  return [];
}

export async function generateIncidentBatch(config: LlmConfig, state: GameState, preset?: PresetRuntime): Promise<{ ok: true; data: { entries: unknown[] } } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const factions = (['association', 'government', 'witch'] as const).map(id => `${factionInfo[id].name} 态度 ${state.factions[id].standing}`).join('；');
  const girls = state.girls.filter(girl => !girl.dead).slice(0, 5).map(girl => `${girl.name}（关系 ${girl.bond}，疲劳 ${girl.fatigue}）`).join('；');
  const used = state.incidentPool.map(item => item.title).concat(state.incidents.filter(item => item.status === 'pending').map(item => item.title)).slice(0, 12).join('、');
  const body = `第 ${state.day} 日，夜糖事务所。安定度 ${state.reputation}，星砂 ${state.gold}，城市平均污染 ${Math.round(cityAveragePollution(state))}。
三方态度：${factions}。在册契约者：${girls || '（暂无）'}。
最近已用过、不要重复的题目：${used || '（无）'}。
${incidentBatchContract()}`;
  const result = await callJson(config, preset, 'incident', body, '请把这几件事攒下来，留给以后的夜晚。', ['共用词条 + 突发事件词条 + 结构契约', '当前局势'], meta, {
    scenario: `第 ${state.day} 日，补充待用事件池`,
  }, { state }, 3000);
  if (!result.ok) {
    recordLlmLog({ kind: '突发事件', ok: false, model: logModel(meta, config), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const entries = incidentEntriesFrom(result.raw).slice(0, 3);
  if (entries.length === 0) {
    const message = '模型没有给出可用的事件条目（回复里既没有条目数组，也不像单条事件）。';
    recordLlmLog({ kind: '突发事件', ok: false, model: logModel(meta, config), status: statusOf(message), durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  recordLlmLog({ kind: '突发事件', ok: true, model: logModel(meta, config), status: 200, durationMs: Date.now() - started, endpoint: llmEndpointLabel(config), message: `待用事件入库：${entries.length} 条`, request: meta.request, response: meta.response });
  return { ok: true, data: { entries } };
}
