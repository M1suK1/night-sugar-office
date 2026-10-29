import { describeVertexCredential, normalizeVertexModel, vertexChat, vertexLocation } from './vertex.ts';

/** openai = 任意 OpenAI 兼容接口；vertex = Google Vertex AI（服务账号 JSON 或 Express 密钥）。 */
export type LlmProvider = 'openai' | 'vertex';

export interface LlmConfig {
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
  sections: { label: string; text: string }[];
  slots?: LlmSlot[];
  params: Record<string, string | number | boolean>;
  messageCount: number;
  truncated?: boolean;
}

export interface LlmResponseSnapshot {
  reasoning?: string;
  finish?: string;
  usage?: { prompt?: number; completion?: number; total?: number };
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
const SECTION_LIMIT = 1100;
const REASONING_LIMIT = 2400;

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

function trimRequest(request?: LlmRequestSnapshot): LlmRequestSnapshot | undefined {
  if (!request) return undefined;
  let budget = 3600;
  const sections = request.sections.slice(0, 14).map(section => {
    const text = section.text.replace(/\s+\n/g, '\n').slice(0, Math.min(SECTION_LIMIT, Math.max(0, budget)));
    budget -= text.length;
    return { label: section.label, text };
  }).filter(section => section.text.length > 0);
  return { ...request, sections, truncated: budget <= 0 || request.truncated };
}

function recordLlmLog(entry: Omit<LlmLogEntry, 'id' | 'at' | 'endpoint'> & { endpoint: string }): LlmLogEntry {
  const full: LlmLogEntry = {
    ...entry,
    id: `llm_${Date.now().toString(36)}_${Math.floor(Math.random() * 999).toString(36)}`,
    at: new Date().toISOString(),
    endpoint: endpointHost(entry.endpoint),
    detail: entry.detail?.replace(/\s+/g, ' ').slice(0, 600),
    request: trimRequest(entry.request),
    response: entry.response
      ? { ...entry.response, reasoning: entry.response.reasoning?.slice(0, REASONING_LIMIT) }
      : undefined,
  };
  try {
    const next = [full, ...loadLlmLog()].slice(0, LOG_LIMIT);
    localStorage.setItem(LOG_KEY, JSON.stringify(next));
  } catch { /* logging must never break generation */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('night-sugar:llm-log', { detail: { entry: full } }));
  return full;
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
function composePrompt(contract: string, runtime: PresetRuntime, scope: PromptScope, extra: Record<string, string | undefined> = {}, context?: string) {
  const world = resolvePresetWorld(runtime, scope, extra);
  const vars = promptVars({ ...extra, world, context });
  if (vars.scenario) vars.scenario = applyFormat(runtime.scenarioFormat, vars.scenario);
  if (vars.personality) vars.personality = applyFormat(runtime.personalityFormat, vars.personality);
  const contextParts = [
    vars.scenario ? `【场景】\n${vars.scenario}` : '',
    vars.personality ? `【角色性格】\n${vars.personality}` : '',
    vars.worldbook ? `【世界书】\n${applyFormat(runtime.wiFormat, vars.worldbook)}` : '',
  ].filter(Boolean);
  const fullContract = [...contextParts, contract.trim()].filter(Boolean).join('\n\n');
  const composed = composeTaskSystem(fullContract, runtime, scope, vars);
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
  recordLlmLog({ kind: '连接测试', ok: result.ok, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, message: result.message, endpoint: config.endpoint });
  return result;
}

export async function generateDaily(config: LlmConfig, state: GameState, context?: string, preset?: PresetRuntime): Promise<{ ok: true; data: NightProposalV2; warnings: string[] } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const result = await generateDailyCore(config, state, context, preset, meta);
  recordLlmLog({
    kind: '每日提案', ok: result.ok, model: config.model.trim(), status: result.ok ? 200 : statusOf(result.message),
    durationMs: Date.now() - started, endpoint: config.endpoint,
    message: result.ok ? `生成成功：${result.data.monster.name} / ${result.data.candidate.name} / ${result.data.mission.title}${result.warnings.length ? `（${result.warnings.length} 条软修正）` : ''}` : result.message,
    detail: result.ok ? undefined : result.message,
    request: meta.request, response: meta.response,
  });
  return result;
}

export async function generateGirlProfile(config: LlmConfig, portrait?: string, hint?: string, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedGirlProfile } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const result = await generateGirlProfileCore(config, portrait, hint, preset, meta);
  recordLlmLog({
    kind: '角色起草', ok: result.ok, model: config.model.trim(), status: result.ok ? 200 : statusOf(result.message),
    durationMs: Date.now() - started, endpoint: config.endpoint,
    message: result.ok ? `起草成功：${result.data.name} / ${result.data.codename}${portrait ? '（已读取立绘）' : '（无立绘）'}` : result.message,
    detail: result.ok ? undefined : result.message,
    request: meta.request, response: meta.response,
  });
  return result;
}

export interface DialogueContext {
  girl: Girl; state: GameState; text: string; remote?: boolean;
}

export async function generateDialogue(config: LlmConfig, { girl, state, text, remote }: DialogueContext, preset?: PresetRuntime): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const started = Date.now();
  const runtime = preset ?? EMPTY_RUNTIME;
  const cfg = resolvePresetConfig(runtime, config);
  if (!hasCredentials(cfg)) {
    const message = '请先在设置中填写 API 密钥（本地接口可留空）。';
    recordLlmLog({ kind: '角色对话', ok: false, model: cfg.model.trim(), durationMs: 0, message, endpoint: cfg.endpoint });
    return { ok: false, message };
  }
  const history = (state.messages[girl.id] ?? []).map(message => ({ role: message.role === 'player' ? 'user' as const : 'assistant' as const, content: message.text }));
  const bondLabel = girl.bond >= 85 ? '爱意' : girl.bond >= 70 ? '依恋' : girl.bond >= 55 ? '亲近' : girl.bond >= 40 ? '平常' : girl.bond >= 25 ? '戒备' : '疏离';
  const stage = (value: number) => value >= 85 ? '爱意' : value >= 70 ? '依恋' : value >= 55 ? '亲近' : value >= 40 ? '平常' : value >= 25 ? '戒备' : '疏离';
  const allGirls = [...state.girls, ...state.candidates, ...state.memorial.map(entry => entry.girl)];
  const peers = Object.entries(girl.relationships ?? {}).map(([id, value]) => {
    const peer = allGirls.find(candidate => candidate.id === id);
    return peer ? `${peer.name}：${value}/100（${stage(value)}）` : '';
  }).filter(Boolean);
  const battles = state.battles.filter(battle => battle.units.some(unit => unit.uid === `ally-${girl.id}`)).slice(0, 5).map(battle => {
    const unit = battle.units.find(entry => entry.uid === `ally-${girl.id}`)!;
    const label = { victory: '胜利', repelled: '暂时击退', defeat: '失败', draw: '平局' }[battle.outcome ?? 'draw'];
    const scar = battle.scars?.length ? `；留下${battle.scars.length}道疤痕` : '';
    return `第${battle.startedAt.day}日「${battle.missionTitle}」：${label}，${battle.round}/${battle.rounds}轮；造成 ${unit.dealt} 伤害，承受 ${unit.taken}，治疗 ${unit.healed}${scar}。`;
  });
  const skillNames = girl.skills.map(id => skills.find(skill => skill.id === id)?.name).filter(Boolean).join('、');
  const traitText = girl.traits.map(trait => `${trait.name}（${trait.description}）`).join('；');
  const body = `身份：${girl.title}，代号「${girl.codename}」，${girl.element}，${girl.archetype ?? '未定职阶'}，等级 ${girl.level}。
外貌：${girl.appearance ?? '不详'}。性格：${activePersonality(girl) || '安静'}。服装：${girl.outfitDescription ?? '值夜制服'}。
登场台词：${girl.quote ?? '没有留下出场白'}。当前目标：${girl.goal ?? '没有写下来的愿望'}。特性：${traitText || '无'}。技能：${skillNames || '未记录'}。
对所长（玩家）的羁绊：${girl.bond}/100（${bondLabel}）。
与同伴的关系：${peers.join('；') || '还没有特别亲近的同伴'}。
经历的战斗：${battles.join(' ') || '还没有参加过战斗'}。
状态：生命 ${girl.hp}/${girl.maxHp}，疲劳 ${girl.fatigue}/100，侵蚀 ${girl.corruption ?? 0}/100${girl.scars?.length ? `，身上有 ${girl.scars.length} 道疤痕：${girl.scars.map(scar => scar.name).join('、')}` : ''}。
${remote ? '你们正在通电话，她退役后住在城南家中；电话那头有很轻的电流声。' : `你们在事务所的${state.rooms.find(room => room.id === girl.roomId)?.name ?? '会客厅'}见面。`}`;
  const MAX_CONTEXT = runtime.maxContext;
  const recentHistory: typeof history = [];
  const { system: baseSystem } = composePrompt(body, runtime, 'chat', { char: girlBrief(girl) }, '与委托人的对话');
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
  const messages: ChatMessage[] = applyRegexToMessages([
    { role: 'system', content: boundedSystem },
    ...recentHistory,
    { role: 'user', content: applyRegexScripts(text, runtime.regex, 'input', 'prompt') },
  ], runtime.regex);
  const params = presetParams(runtime);
  const request: LlmRequestSnapshot = { ...requestSnapshot(messages, requestParams(cfg, params), [
    '世界观与角色卡（含预设）',
    '世界观与角色卡（含预设）',
    ...recentHistory.map((_, index) => `对话历史 ${index + 1}`),
    '玩家这句话',
  ]), slots: slotList(runtime) };
  const result = await chat(cfg, messages, { params });
  const clean = result.ok ? applyRegexScripts(result.text.trim().replace(/^["“]|["”]$/g, '').slice(0, 400), runtime.regex, 'output', 'display') : '';
  const final = clean ? { ok: true as const, text: clean } : { ok: false as const, message: result.ok ? '模型没有返回可用的对话内容。' : result.message };
  recordLlmLog({
    kind: '角色对话', ok: final.ok, model: cfg.model.trim(), status: final.ok ? 200 : statusOf(final.message),
    durationMs: Date.now() - started, endpoint: cfg.endpoint,
    message: final.ok ? `与${girl.name}完成一次对话` : final.message,
    detail: final.ok ? undefined : final.message,
    request, response: { reasoning: result.reasoning, usage: result.usage, finish: result.ok ? result.finish : undefined },
  });
  return final;
}

export const defaultLlmConfig: LlmConfig = {
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  provider: 'openai',
  location: 'us-central1',
};

export function loadLlmConfig(): LlmConfig {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultLlmConfig };
    const parsed = JSON.parse(raw) as Partial<LlmConfig>;
    return {
      endpoint: typeof parsed.endpoint === 'string' ? parsed.endpoint : defaultLlmConfig.endpoint,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model : defaultLlmConfig.model,
      provider: parsed.provider === 'vertex' ? 'vertex' : 'openai',
      location: typeof parsed.location === 'string' && parsed.location.trim() ? parsed.location.trim() : defaultLlmConfig.location,
    };
  } catch {
    return { ...defaultLlmConfig };
  }
}

export function saveLlmConfig(config: LlmConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(config));
  } catch {
    // Storage can be unavailable in private windows; the form still works for this session.
  }
}

/** Vertex 的「测试连接」会真的发一次极小的 generateContent：一次验证密钥、权限、区域和模型名。 */
async function testVertexConnection(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  const info = describeVertexCredential(config.apiKey);
  if (info.kind === 'empty') return { ok: false, message: '请先导入服务账号 JSON，或填写 Express 模式密钥。' };
  if (info.kind === 'invalid') return { ok: false, message: info.message };
  const model = normalizeVertexModel(config.model);
  if (!model) return { ok: false, message: '请先填写模型名称，例如 gemini-2.5-pro。' };
  const probe = await vertexChat(
    { model, location: config.location, secret: config.apiKey, timeoutMs: 25_000 },
    [{ role: 'user', content: 'ping' }],
    { maxTokens: 16, temperature: 0 },
  );
  if (!probe.ok) return { ok: false, message: probe.message };
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
    const response = await fetch(`${apiBase(config.endpoint)}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey.trim()}` },
    });
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

function apiBase(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '').replace(/\/chat\/completions$/i, '');
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
  if (params?.presencePenalty !== undefined) out.presence_penalty = params.presencePenalty;
  if (params?.frequencyPenalty !== undefined) out.frequency_penalty = params.frequencyPenalty;
  return out;
}

export function slotList(runtime: PresetRuntime): LlmSlot[] {
  return (runtime.entries ?? []).map((entry, index) => ({
    index: index + 1, name: entry.name, role: entry.role, tokens: promptTokens(entry.content),
    enabled: entry.enabled, marker: Boolean(entry.marker),
  }));
}

export function requestSnapshot(messages: ChatMessage[], params: Record<string, string | number | boolean>, labels: string[], slots?: LlmSlot[]): LlmRequestSnapshot {
  const sections = messages.map((message, index) => {
    const label = labels[index] ?? (message.role === 'system' ? 'system' : message.role === 'user' ? 'user' : 'assistant');
    if (typeof message.content === 'string') return { label, text: message.content };
    const parts = message.content.map(part => part.type === 'text' ? part.text : `[图片输入 ${Math.round((part.image_url.url.length * 3) / 4 / 1024)} KB]`);
    return { label, text: parts.join('\n') };
  });
  return slots?.length ? { sections, params, messageCount: messages.length, slots } : { sections, params, messageCount: messages.length };
}

function isLocalEndpoint(endpoint: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(endpoint.trim());
}

function hasCredentials(config: LlmConfig): boolean {
  return Boolean(config.apiKey.trim()) || isLocalEndpoint(config.endpoint);
}

/** Vertex 走 generateContent，消息形状和 OpenAI 的 system/user/assistant 一一对应。 */
async function chatVertex(config: LlmConfig, messages: ChatMessage[], options: LlmCallOptions = {}): Promise<LlmCallResult> {
  const params = options.params ?? {};
  return vertexChat(
    { model: config.model, location: config.location, secret: config.apiKey, timeoutMs: options.timeoutMs },
    messages,
    {
      temperature: params.temperature ?? 0.9,
      topP: params.topP,
      maxTokens: params.maxTokens,
      presencePenalty: params.presencePenalty,
      frequencyPenalty: params.frequencyPenalty,
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
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 60_000);
  try {
    const url = `${apiBase(config.endpoint)}/chat/completions`;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey.trim()}` };
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
    if (controller.signal.aborted) return { ok: false, message: '请求超过 60 秒仍未返回，已中止。可以重试，或换一个更快的模型。' };
    const detail = error instanceof Error ? error.message : '';
    return { ok: false, message: `浏览器无法访问接口，或服务未允许跨域请求。${detail ? `（${detail}）` : ''}` };
  } finally {
    clearTimeout(timeout);
  }
}

const elements = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系', '魔物'] as const;
const archetypes = ['输出', '守护', '治愈', '控制', '侦查'] as const;

interface LlmCallMeta {
  request?: LlmRequestSnapshot;
  response?: LlmResponseSnapshot;
  slots?: LlmSlot[];
}

function captureCall(meta: LlmCallMeta | undefined, messages: ChatMessage[], labels: string[], config: LlmConfig, params: LlmCallParams | undefined, result: LlmCallResult) {
  if (!meta) return;
  meta.request = requestSnapshot(messages, requestParams(config, params), labels, meta.slots);
  meta.response = { reasoning: result.reasoning, usage: result.usage, finish: result.ok ? result.finish : undefined };
}

const JSON_RETRY_MESSAGE = '上一次输出在写到 JSON 中途被截断了。这一次只输出完整的 JSON 对象，不要思维链、不要解释、不要 Markdown 代码块。';

/** 从回复里找出 JSON；推理模型常在 JSON 前写一段说明，偶尔还会在代码块里包一层。 */
function extractJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  const end = cleaned.lastIndexOf('}');
  const candidates = end > start ? [cleaned.slice(start, end + 1), cleaned.slice(start)] : [cleaned.slice(start)];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch { /* 可能被 length 截断，下面尝试补齐 */ }
  }
  return null;
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
/** 截断重试的上限：低于这个额度都值得再试一次，再高就是上下文不够而不是额度不够。 */
const RETRY_TOKEN_CEILING = 16384;

async function chatJson(
  config: LlmConfig, preset: PresetRuntime | undefined, scope: PromptScope, body: string, user: ChatMessage['content'], labels: string[], meta: LlmCallMeta | undefined, extra?: Record<string, string>, tokenFloor = 0,
): Promise<JsonCallOutcome> {
  const runtime = preset ?? EMPTY_RUNTIME;
  const cfg = resolvePresetConfig(runtime, config);
  if (meta) meta.slots = slotList(runtime);
  let params: LlmCallParams = presetParams(runtime) ?? {};
  if (params.maxTokens === undefined) params = { ...params, maxTokens: Math.max(tokenFloor, DEFAULT_TOKEN_BUDGET) };
  else if (tokenFloor > params.maxTokens) params = { ...params, maxTokens: tokenFloor };
  const { system } = composePrompt(body, runtime, scope, extra, typeof user === 'string' ? user.slice(0, 240) : '图像输入');
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
  if (!raw && result.ok && (truncated || !result.text.trim()) && budget < RETRY_TOKEN_CEILING) {
    attempts = 2;
    params = { ...params, maxTokens: Math.min(32768, Math.max(DEFAULT_TOKEN_BUDGET, budget * 2)) };
    messages = [...messages, { role: 'user', content: JSON_RETRY_MESSAGE }];
    result = await chat(cfg, messages, { params });
    captureCall(meta, messages, labels, cfg, params, result);
    raw = result.ok ? extractJsonObject(result.text) : null;
    truncated = Boolean(result.ok && result.finish === 'length');
  }
  return { result, raw, maxTokens: params.maxTokens, truncated, attempts };
}

function jsonFailureMessage(prefix: string, outcome: JsonCallOutcome): string {
  if (outcome.truncated) {
    return `${prefix}输出被截断（finish_reason: length，上限 ${outcome.maxTokens ?? '?'} tokens）。推理模型的思维链会占用同一份额度，已自动放大额度重试仍失败。请到 设置 → 对话补全预设 把「最大输出 token」调到 8000 以上，或换用非推理模型。`;
  }
  return `${prefix}模型没有返回可解析的 JSON。可以在叙事引擎面板里查看这次请求，再重试一次。`;
}

async function generateDailyCore(config: LlmConfig, state: GameState, context?: string, preset?: PresetRuntime, meta?: LlmCallMeta): Promise<{ ok: true; data: NightProposalV2; warnings: string[] } | { ok: false; message: string }> {
  if (!hasCredentials(resolvePresetConfig(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const system = buildNightPrompt(state);
  const user = `请提交今晚的提案。${context ? `\n当前局势：${context}` : ''}`;
  const outcome = await chatJson(config, preset, 'daily', system, user, ['共用词条 + 每日提案词条 + 今晚机制目录', '用户请求：今晚的提案'], meta, { context: '每日提案' }, 8000);
  if (!outcome.result.ok) return { ok: false, message: `生成失败：${outcome.result.message}` };
  if (!outcome.raw) return { ok: false, message: jsonFailureMessage('生成失败：', outcome) };
  let validation = validateNightProposal(outcome.raw, state);
  let source = outcome;
  if (!validation.ok) {
    const repairBody = `${system}\n\n【上一次提案（未通过本地校验）】\n${JSON.stringify(outcome.raw)}\n\n【必须修正的问题】\n${validation.errors.map((entry, index) => `${index + 1}. ${entry}`).join('\n')}\n\n只输出修正后的完整 JSON。不要解释，不要省略任何字段；所有 id 必须来自上面的目录。`;
    const repaired = await chatJson(config, preset, 'daily', repairBody, '请只提交修正后的完整 JSON。', ['共用词条 + 每日提案词条 + 今晚机制目录', '修复上一次提案'], meta, { context: '修复今晚的提案' }, 8000);
    if (!repaired.result.ok) return { ok: false, message: `提案未通过校验，修复请求失败：${repaired.result.message}` };
    if (!repaired.raw) return { ok: false, message: `提案未通过校验，且修复输出无法解析。${jsonFailureMessage('', repaired)}` };
    source = repaired;
    validation = validateNightProposal(repaired.raw, state);
  }
  if (!validation.ok || !validation.proposal) {
    return { ok: false, message: `提案未通过本地校验：${validation.errors.slice(0, 6).join('；')}` };
  }
  if (source.truncated) return { ok: false, message: jsonFailureMessage('生成失败：', source) };
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
    appearance: (typeof body.appearance === 'string' ? body.appearance.trim() : '她没有说自己从哪里来。').slice(0, 160),
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
export interface GeneratedEvent { title: string; hook: string; scenes: { title: string; narration: string; lines: { speaker: string; tone: string; text: string }[] }[] }

function girlBrief(girl: Girl): string {
  const traitText = girl.traits.map(trait => `${trait.name}（${trait.polarity}）`).join('、') || '暂无';
  // 出身与雇主必须分开写：出身只交代她来自哪一方，雇主永远是把她们收进名册的夜糖事务所。
  return `姓名 ${girl.name}／代号 ${girl.codename}／称号 ${girl.title}／${girl.element}·${girl.archetype}；出身 ${factionTagLabel(girl.factionTag)}；雇主 ${EMPLOYER_LABEL}；性格：${activePersonality(girl)}；关系 ${girl.bond}/100；侵蚀 ${girl.corruption}/100；特性：${traitText}；目标：${girl.goal}`;
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
  config: LlmConfig, preset: PresetRuntime | undefined, scope: PromptScope, body: string, user: string, labels: string[], meta: LlmCallMeta, extra?: Record<string, string>,
): Promise<{ ok: true; raw: Record<string, unknown> } | { ok: false; message: string }> {
  const outcome = await chatJson(config, preset, scope, body, user, labels, meta, extra);
  if (!outcome.result.ok) return { ok: false, message: outcome.result.message };
  if (!outcome.raw) return { ok: false, message: jsonFailureMessage('', outcome) };
  return { ok: true, raw: outcome.raw };
}

export async function generateStoryline(config: LlmConfig, girl: Girl, direction?: string, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedStoryline } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const body = `先读她的档案：${girlBrief(girl)}
${direction?.trim() ? `玩家给的方向（必须遵守）：${direction.trim()}` : '玩家没有给方向，请从她的目标、特性与当前关系里找一个最小的裂缝开始。'}
只输出一个 JSON 对象，不要 Markdown 代码块：
{"title":"","premise":"","tone":"","beats":[{"title":"","summary":"","scene":"","hook":"","mission":{"title":"","goal":"","difficulty":"简单|常规|棘手|危险","duration":90,"district":"candy|station|plaza|greenhouse|cathedral|crossroad|oldtown|clocktower|docks","requirement":"magic|insight|agility|empathy"},"choices":[{"label":"","intent":"","effect":{"gold":0,"reputation":0,"bond":0,"corruption":0,"trait":"","trigger":{"kind":"dialogue|event|mission|opinion|incident"}}}]}]}
要求：恰好 4 幕；每一幕都必须给出 mission（明确的委托目标），goal 写清"她要在这场委托里做到什么"，不能是空泛的情绪；duration 60–180 分钟；difficulty 只能从四个值里选；district 必须从上面九个 id 里选一个；requirement 决定用哪项属性判定。每幕 2 个选项，选项要真的不同（一个靠近、一个退开）；effect 只填有变化的字段，数值幅度小。`;
  const result = await callJson(config, preset, 'storyline', body, `请为${girl.name}写这条故事线。`, ['共用词条 + 故事线词条 + 结构契约', `档案：${girl.name}`], meta, {
    char: girlBrief(girl),
    personality: activePersonality(girl),
    scenario: direction?.trim() ?? '',
  });
  if (!result.ok) {
    recordLlmLog({ kind: '角色故事线', ok: false, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: result.message, request: meta.request, response: meta.response });
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
    recordLlmLog({ kind: '角色故事线', ok: false, model: config.model.trim(), status: statusOf(message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (parsed.some(beat => !beat.mission.title || !beat.mission.goal)) {
    const message = '故事线缺少明确的任务目标，已改用模板起草。';
    recordLlmLog({ kind: '角色故事线', ok: false, model: config.model.trim(), status: statusOf(message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const data: GeneratedStoryline = {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 24) : `${girl.name}的未命名故事`,
    premise: typeof raw.premise === 'string' ? raw.premise.trim().slice(0, 160) : '',
    tone: typeof raw.tone === 'string' ? raw.tone.trim().slice(0, 24) : '克制',
    beats: parsed,
  };
  recordLlmLog({ kind: '角色故事线', ok: true, model: config.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: config.endpoint, message: `故事线生成成功：${data.title}（4 幕）`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

export interface GeneratedStoryBlueprint {
  title: string;
  premise: string;
  tone: string;
  graph: StoryGraph;
}

const blueprintKinds: StoryNodeKind[] = ['start', 'scene', 'choice', 'mission', 'event', 'reward', 'wait', 'end'];

/** 把模型的语义 JSON 收成 draft；ID 合并、连线和布局都交给 storygraph。 */
function parseStoryBlueprintDraft(raw: Record<string, unknown>): StoryGraphDraft {
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object') : [];
  if (!rawNodes.length) throw new Error('蓝图没有 nodes。');
  const nodes: StoryGraphDraftNode[] = rawNodes.slice(0, 80).map((item, index) => {
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
export async function generateStoryBlueprint(config: LlmConfig, girl: Girl, direction?: string, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedStoryBlueprint } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  if (!hasCredentials(resolvePresetConfig(preset ?? EMPTY_RUNTIME, config))) {
    return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  }
  const body = `先读她的档案：${girlBrief(girl)}
樱雾市由星灯协会、市役所、月蚀庭三方拉扯；协会会长白鹭千秋保守并排斥克隆与抑制剂，市役所课长雨宫澄把量产少女当勤务编号，月蚀庭净血派领袖夜枭政变后与普通魔法少女敌对；夜糖事务所是重开的中立委托机构，收留三方与无所属的少女。辖区污染会改变委托与魔物。
${direction?.trim() ? `玩家给的方向（必须遵守）：${direction.trim()}` : '玩家没有给方向，请从她的目标、特性与当前关系里找一个最小的裂缝开始。'}
请直接写一张「故事蓝图」（StoryGraph），不是四幕手稿。只输出一个 JSON 对象，不要 Markdown 代码块：
{"title":"","premise":"","tone":"","nodes":[{"id":"n1","kind":"start","title":"开始","data":{"kind":"start"}}],"edges":[{"from":"n1","fromPort":"out","to":"n2"}]}
节点 kind 只能用：start、scene、choice、mission、event、reward、wait、end。
硬性结构：8–16 个节点；恰好 1 个 start；1–3 个 end；1–2 个 choice；1–2 个 mission；至少 1 个 scene。
连线必须是有向无环图：从 start 能到达每个节点，每条路径最终都能到 end；不允许回环、自环或悬空连线。
每个非 end 节点都要有出口。choice 的每个选项都要有一条 fromPort 等于该选项 id 的线；mission 必须恰有一条 fromPort="success" 和一条 fromPort="failure" 的线；start 只有一条 fromPort="out" 的线。
节点的 data 按 kind 填写：
- start: {"kind":"start"}
- scene: {"kind":"scene","narration":"120–260字，写具体地点、动作和她没说出口的话","lines":[{"speaker":"旁白|角色名","text":"一句台词"}]}
- choice: {"kind":"choice","prompt":"她在等你怎么回应","options":[{"id":"a","label":"选项","intent":"这个选择意味着什么","effect":{"bond":2}},{"id":"b","label":"另一个选项","intent":"","effect":{"corruption":1}}]}，2–4 个选项，id 短且唯一
- mission: {"kind":"mission","spec":{"title":"","goal":"她要在这场委托里做到什么，写具体","category":"故事委托","difficulty":"简单|常规|棘手|危险","duration":90,"requirement":"magic|insight|agility|empathy"}}
- event: {"kind":"event","title":"","hook":"一句能触发角色事件的话"}
- reward: {"kind":"reward","effect":{"bond":2,"gold":0}}
- wait: {"kind":"wait","days":0,"minutes":60}
- end: {"kind":"end","summary":"这条结局收在哪里"}
不要生成 incident 或 opinion 节点；不要给 x、y、边 id、颜色或额外字段。`;
  const labels = ['共用词条 + 故事线词条 + 蓝图结构契约', `档案：${girl.name}`];
  const extra = { char: girlBrief(girl), personality: activePersonality(girl), scenario: direction?.trim() ?? '' };
  const first = await chatJson(config, preset, 'storyline', body, `请为${girl.name}画一张故事蓝图。`, labels, meta, extra, 8000);
  if (!first.result.ok) {
    const message = `生成蓝图失败：${first.result.message}`;
    recordLlmLog({ kind: '角色蓝图', ok: false, model: config.model.trim(), status: statusOf(first.result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (!first.raw) {
    const message = jsonFailureMessage('生成蓝图失败：', first);
    recordLlmLog({ kind: '角色蓝图', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (first.truncated) {
    const message = jsonFailureMessage('生成蓝图失败：', first);
    recordLlmLog({ kind: '角色蓝图', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
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

只输出修正后的完整 JSON。不要解释，不要省略节点；保持 8–16 个节点，并让每条路径都能走到 end。`;
    const second = await chatJson(config, preset, 'storyline', repairBody, '请只输出修正后的完整故事蓝图 JSON。', ['共用词条 + 故事线词条 + 蓝图结构契约', '修复上一次蓝图'], meta, extra, 8000);
    if (!second.result.ok) {
      const message = `蓝图未通过校验，修复请求失败：${second.result.message}`;
      recordLlmLog({ kind: '角色蓝图', ok: false, model: config.model.trim(), status: statusOf(second.result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    if (!second.raw) {
      const message = jsonFailureMessage('蓝图未通过校验，且修复输出无法解析。', second);
      recordLlmLog({ kind: '角色蓝图', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    if (second.truncated) {
      const message = jsonFailureMessage('蓝图未通过校验，且修复输出被截断。', second);
      recordLlmLog({ kind: '角色蓝图', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    source = second;
    parsed = parseStoryBlueprintGraph(second.raw);
  }
  if (!parsed.graph || parsed.errors.length) {
    const message = `蓝图未通过本地校验：${parsed.errors.slice(0, 6).join('；')}`;
    recordLlmLog({ kind: '角色蓝图', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
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
    kind: '角色蓝图', ok: true, model: config.model.trim(), status: 200,
    durationMs: Date.now() - started, endpoint: config.endpoint,
    message: `蓝图生成成功：${data.title}（${graph.nodes.length} 节点 / ${graph.edges.length} 连线${repaired ? '，修复 1 次' : ''}）`,
    request: meta.request, response: meta.response,
  });
  return { ok: true, data };
}

export async function generateIncident(config: LlmConfig, state: GameState, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedIncident } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const girls = state.girls.filter(girl => !girl.dead).slice(0, 6).map(girl => `${girl.name}（关系 ${girl.bond}，侵蚀 ${girl.corruption}，疲劳 ${girl.fatigue}）`).join('；');
  const body = `现在是第 ${state.day} 日 ${Math.floor((state.minutes % 1440) / 60).toString().padStart(2, '0')}:${String(state.minutes % 60).padStart(2, '0')}，夜糖事务所正在营业。
在册契约者：${girls || '（还没有契约者）'}；安定度 ${state.reputation}；星砂 ${state.gold}。
只输出一个 JSON 对象，不要 Markdown 代码块：
{"title":"","body":"","options":[{"label":"","hint":"","effect":{"gold":0,"reputation":0,"girl":""}}]}
要求：恰好 3 个选项，代价与收益各不相同（一个付钱、一个付人情、一个硬扛）；body 60–120 字，写出具体的人、地点与时间压力；不要出现需要额外数值系统的效果。`;
  const result = await callJson(config, preset, 'incident', body, '请把这件事放到我的桌上。', ['共用词条 + 突发事件词条 + 结构契约', '当前局势'], meta, {
    scenario: `第 ${state.day} 日，事务所营业中`,
  });
  if (!result.ok) {
    recordLlmLog({ kind: '强制事件', ok: false, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const raw = result.raw;
  const options = Array.isArray(raw.options) ? raw.options.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 3) : [];
  if (options.length < 2) {
    const message = '事件选项不足，已改用规则事件。';
    recordLlmLog({ kind: '强制事件', ok: false, model: config.model.trim(), status: statusOf(message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
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
  recordLlmLog({ kind: '强制事件', ok: true, model: config.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: config.endpoint, message: `事件生成成功：${data.title}`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

export async function generateEvent(config: LlmConfig, girl: Girl, storyline?: { title: string; premise: string }, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedEvent } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const body = `角色：${girlBrief(girl)}
${storyline ? `所属故事线：${storyline.title}——${storyline.premise}。这段事件应当是那条线的一次具体落地，不要另起炉灶。` : '目前没有进行中的故事线，请写一段独立的日常事件。'}
只输出一个 JSON 对象，不要 Markdown 代码块：
{"title":"","hook":"","scenes":[{"title":"","narration":"","lines":[{"speaker":"","tone":"","text":""}]}]}
要求：恰好 2 场；speaker 只能是角色名或「你」；tone 是「轻声」「停顿」「笑」这类表演提示；每场 2–4 行。`;
  const result = await callJson(config, preset, 'event', body, `请写下${girl.name}的这段事件。`, ['共用词条 + 私人事件词条 + 结构契约', `角色：${girl.name}`], meta, {
    char: girlBrief(girl),
    personality: activePersonality(girl),
    scenario: storyline ? `${storyline.title}——${storyline.premise}` : '',
    story: storyline?.title ?? '',
  });
  if (!result.ok) {
    recordLlmLog({ kind: '角色事件', ok: false, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const raw = result.raw;
  const scenes = Array.isArray(raw.scenes) ? raw.scenes.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 3) : [];
  if (scenes.length < 2) {
    const message = '事件场次不足，已改用模板。';
    recordLlmLog({ kind: '角色事件', ok: false, model: config.model.trim(), status: statusOf(message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const data: GeneratedEvent = {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 22) : `${girl.name}的一个晚上`,
    hook: typeof raw.hook === 'string' ? raw.hook.trim().slice(0, 100) : '',
    scenes: scenes.map((scene, index) => {
      const lines = Array.isArray(scene.lines) ? scene.lines.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 5) : [];
      return {
        title: typeof scene.title === 'string' && scene.title.trim() ? scene.title.trim().slice(0, 16) : `第 ${index + 1} 场`,
        narration: typeof scene.narration === 'string' ? scene.narration.trim().slice(0, 120) : '',
        lines: lines.map(line => ({
          speaker: typeof line.speaker === 'string' && line.speaker.trim() ? line.speaker.trim().slice(0, 12) : girl.name,
          tone: typeof line.tone === 'string' ? line.tone.trim().slice(0, 10) : '',
          text: typeof line.text === 'string' ? line.text.trim().slice(0, 120) : '',
        })).filter(line => line.text),
      };
    }),
  };
  recordLlmLog({ kind: '角色事件', ok: true, model: config.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: config.endpoint, message: `事件生成成功：${data.title}`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

export interface GeneratedArcPassage {
  title: string;
  narration: string;
  lines: { speaker: string; tone: string; text: string }[];
  choices: { label: string; intent: string; effect?: StoryEffect }[];
}

export interface GeneratedStoryArc {
  title: string;
  hook: string;
  summary: string;
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
export async function generateStoryArc(config: LlmConfig, girl: Girl, input: StoryArcInput, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedStoryArc } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  const body = `角色：${girlBrief(girl)}
${input.storylineTitle ? `故事线：${input.storylineTitle}${input.premise ? `——${input.premise}` : ''}` : ''}
${input.beatTitle ? `这一幕：${input.beatTitle}${input.beatHook ? `——${input.beatHook}` : ''}` : ''}
${input.memory ? `前情（必须与之一致，不要重复原文）：${input.memory.slice(0, 1600)}` : ''}
只输出一个 JSON 对象，不要 Markdown 代码块：
{"title":"","hook":"","summary":"","passages":[{"title":"","narration":"","lines":[{"speaker":"","tone":"","text":""}],"choices":[{"label":"","intent":"","effect":{"bond":2}}]}]}
要求：${ARC_TARGETS}；speaker 只能是角色名或「你」；tone 是「轻声」「停顿」这类表演提示；effect 只能用 bond / corruption / gold / reputation，数值绝对值不超过 6；summary 用 60–120 字概括这一段剧情。`;
  const result = await callJson(config, preset, 'arc', body, `请写下${girl.name}的这段剧情。`, ['共用词条 + 完整剧情词条 + 结构契约', `角色：${girl.name}`, '前情与这一幕'], meta, {
    char: girlBrief(girl),
    personality: activePersonality(girl),
    scenario: [input.premise, input.beatTitle, input.beatHook].filter(Boolean).join('\n'),
    story: input.storylineTitle ?? '',
  });
  if (!result.ok) {
    recordLlmLog({ kind: '角色剧情', ok: false, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: result.message, request: meta.request, response: meta.response });
    return result;
  }
  const raw = result.raw;
  const rawPassages = Array.isArray(raw.passages) ? raw.passages.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 5) : [];
  const passages: GeneratedArcPassage[] = rawPassages.map((passage, index) => {
    const lines = Array.isArray(passage.lines) ? passage.lines.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 4) : [];
    const choices = Array.isArray(passage.choices) ? passage.choices.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').slice(0, 3) : [];
    return {
      title: typeof passage.title === 'string' && passage.title.trim() ? passage.title.trim().slice(0, 18) : `第 ${index + 1} 段`,
      narration: typeof passage.narration === 'string' ? passage.narration.trim().slice(0, 900) : '',
      lines: lines.map(line => ({
        speaker: typeof line.speaker === 'string' && line.speaker.trim() ? line.speaker.trim().slice(0, 12) : girl.name,
        tone: typeof line.tone === 'string' ? line.tone.trim().slice(0, 10) : '',
        text: typeof line.text === 'string' ? line.text.trim().slice(0, 200) : '',
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
    recordLlmLog({ kind: '角色剧情', ok: false, model: config.model.trim(), status: statusOf(message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const data: GeneratedStoryArc = {
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 24) : input.beatTitle || `${girl.name}的一晚`,
    hook: typeof raw.hook === 'string' ? raw.hook.trim().slice(0, 120) : input.beatHook ?? '',
    summary: typeof raw.summary === 'string' && raw.summary.trim() ? raw.summary.trim().slice(0, 300) : passages.map(passage => passage.title).join(' · '),
    passages,
  };
  recordLlmLog({ kind: '角色剧情', ok: true, model: config.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: config.endpoint, message: `剧情生成成功：${data.title}（${total} 字 / ${passages.length} 段）`, request: meta.request, response: meta.response });
  return { ok: true, data };
}

export interface GeneratedOutfit {
  name: string;
  description: string;
}

/** 看图写一条衣柜词条：套装名 + 50–90 字的材质/剪裁/配饰描述。 */
export async function generateOutfitDescription(config: LlmConfig, portrait: string, preset?: PresetRuntime): Promise<{ ok: true; data: GeneratedOutfit } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  if (!hasCredentials(resolvePresetConfig(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const body = `只输出一个 JSON 对象，不要 Markdown 代码块：
{"name":"","description":""}
要求：name 是 4–10 个汉字的套装名，像「莓色夜巡」「糖纸披风」；description 50–90 字，写颜色、材质、剪裁、配饰与整体气质，用夜糖事务所的口吻，不要出现现实品牌、地名或数值。`;
  const outcome = await chatJson(config, preset, 'outfit', body, [{ type: 'text', text: '请为这套服装写一条衣柜词条。' }, { type: 'image_url', image_url: { url: portrait } }], ['共用词条 + 服装词条 + 结构契约（含立绘）', '用户请求：补充服装描述'], meta);
  const result = outcome.result;
  if (!result.ok) {
    if (/image|vision|multimodal|图像|图片/i.test(result.message)) {
      recordLlmLog({ kind: '服装描述', ok: false, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: result.message, request: meta.request, response: meta.response });
      return { ok: false, message: `写描述失败：当前模型似乎不支持图像输入，请换用支持视觉的模型。原始错误：${result.message}` };
    }
    recordLlmLog({ kind: '服装描述', ok: false, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: result.message, request: meta.request, response: meta.response });
    return { ok: false, message: `写描述失败：${result.message}` };
  }
  if (!outcome.raw) {
    const message = jsonFailureMessage('写描述失败：', outcome);
    recordLlmLog({ kind: '服装描述', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const raw = outcome.raw;
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 16) : '';
  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 160) : '';
  if (!name || !description) {
    const message = '模型没有给出可用的服装描述，可以重试一次。';
    recordLlmLog({ kind: '服装描述', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  recordLlmLog({ kind: '服装描述', ok: true, model: config.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: config.endpoint, message: `服装词条：${name}`, request: meta.request, response: meta.response });
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
  if (!hasCredentials(resolvePresetConfig(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const who = `她叫${input.girlName}${input.codename ? `（${input.codename}）` : ''}，原本的性格：${input.personality.trim() || '安静'}。${input.appearance ? `\n外貌：${input.appearance}` : ''}`;
  const body = `${who}
只输出一个 JSON 对象，不要 Markdown 代码块：
{"name":"","description":"","personality":""}
要求：name 以「魔女化 · 」开头，后面接 2–6 个汉字的形态核心词；description 40–90 字，只写这张立绘上看得见的东西——轮廓、材质、光、可动的部件与它给人的压迫感，不写数值、技能或战斗规则；personality 120–260 字，是她在魔女化状态下的人格：保留原本的执念，但把它扭曲成占有、多疑与不肯放手，写清她说话的方式与对所长提出的要求，不要变成另一个人。`;
  const outcome = await chatJson(config, preset, 'profile', body, [{ type: 'text', text: '请为这张魔女化立绘写形态名、形态描述与魔女化人格。' }, { type: 'image_url', image_url: { url: input.portrait } }], ['共用词条 + 角色起草词条 + 结构契约（含立绘）', '用户请求：魔女化形态'], meta);
  const result = outcome.result;
  if (!result.ok) {
    const message = /image|vision|multimodal|图像|图片/i.test(result.message)
      ? `写魔女化形态失败：当前模型似乎不支持图像输入，请换用支持视觉的模型。原始错误：${result.message}`
      : `写魔女化形态失败：${result.message}`;
    recordLlmLog({ kind: '魔女化词条', ok: false, model: config.model.trim(), status: statusOf(result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  if (!outcome.raw) {
    const message = jsonFailureMessage('写魔女化形态失败：', outcome);
    recordLlmLog({ kind: '魔女化词条', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const raw = outcome.raw;
  const pick = (key: string, limit: number) => (typeof raw[key] === 'string' ? (raw[key] as string).trim().slice(0, limit) : '');
  const name = pick('name', 24) || '魔女化 · 夜之形';
  const description = pick('description', 200);
  const personality = pick('personality', 600);
  if (!description || !personality) {
    const message = '模型没有给出可用的形态描述或人格，可以重试一次。';
    recordLlmLog({ kind: '魔女化词条', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  recordLlmLog({ kind: '魔女化词条', ok: true, model: config.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: config.endpoint, message: `魔女化形态：${name}`, request: meta.request, response: meta.response });
  return { ok: true, data: { name, description, personality } };
}

/** 把一场已结算的战斗写成多人分场札记；只读，不改变任何战斗结果。 */
export async function generateBattleNote(config: LlmConfig, battle: BattleState, preset?: PresetRuntime): Promise<{ ok: true; data: BattleNote } | { ok: false; message: string }> {
  const started = Date.now();
  const meta: LlmCallMeta = {};
  if (!hasCredentials(resolvePresetConfig(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const total = totalBattleRounds(battle);
  const cast = battleCast(battle);
  const castText = cast.length
    ? cast.map(actor => `${actor.side === 'ally' ? '我方' : '敌方'} ${actor.name}${actor.codename ? `（${actor.codename}）` : ''}｜speakerId=${actor.girlId}｜表情=${actor.expression}`).join('\n')
    : '（没有带姓名与立绘的参战魔法少女；本场只能写旁白）';
  const body = `战斗记录：\n${battleDigest(battle)}
可说话角色（speakerId 必须原样使用，且只能从这张表里选）：
${castText}
只输出一个 JSON 对象，不要 Markdown 代码块：
{"title":"","hook":"","summary":"","scenes":[{"roundFrom":1,"roundTo":2,"title":"","narration":"","lines":[{"round":1,"speakerSide":"ally|enemy","speakerId":"","expression":"calm|smile|surprise|sad|angry|shy","text":"","mode":"speech|thought"}]}]}
要求：3–5 场；第一场 roundFrom=1，相邻场景回合连续，最后一场 roundTo=${total}；每场旁白 2–4 段，写清战况、谁救了谁、谁退缩了；台词只给上表里的角色，必须带 speakerSide、speakerId、六种表情之一；倒下的角色不能在倒下后的回合继续说话；魔物没有立绘和名字，只能出现在旁白里。全文 1200–1800 字，不改胜负、伤害、奖励、疤痕或角色状态，不替玩家做决定，不写未发生的事。`;
  const outcome = await chatJson(config, preset, 'battle', body, '请把这场战斗写成札记。', ['共用词条 + 战斗札记词条 + 结构契约', `战斗：${battle.missionTitle}`], meta, {
    story: battle.missionTitle,
    context: `结果：${battle.outcome ?? '未结算'}；共 ${total} 回合；参战：${cast.map(actor => actor.name).join('、') || '无'}`,
    char: castText,
  }, 3600);
  if (!outcome.result.ok) {
    recordLlmLog({ kind: '战斗札记', ok: false, model: config.model.trim(), status: statusOf(outcome.result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: outcome.result.message, request: meta.request, response: meta.response });
    return { ok: false, message: `写札记失败：${outcome.result.message}` };
  }
  if (!outcome.raw) {
    const message = jsonFailureMessage('写札记失败：', outcome);
    recordLlmLog({ kind: '战斗札记', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const normalized = normalizeBattleNoteDraft(outcome.raw);
  let validation = validateBattleNoteDraft(normalized, battle, { createdAt: new Date().toISOString(), model: config.model.trim(), presetId: preset?.id });
  let source = outcome;
  if (!validation.ok) {
    const repairBody = `${body}\n\n【上一次输出（未通过本地校验）】\n${JSON.stringify(outcome.raw)}\n\n【必须修正的问题】\n${validation.errors.map((entry, index) => `${index + 1}. ${entry}`).join('\n')}\n\n只输出修正后的完整 JSON。不要解释，不要省略场景或台词；speakerId 必须来自上面的可说话角色表。`;
    const repaired = await chatJson(config, preset, 'battle', repairBody, '请只输出修正后的完整 JSON。', ['共用词条 + 战斗札记词条 + 结构契约', '修复上一次札记'], meta, {
      story: battle.missionTitle,
      context: `修复札记；共 ${total} 回合`,
    }, 3600);
    source = repaired;
    if (!repaired.result.ok) {
      recordLlmLog({ kind: '战斗札记', ok: false, model: config.model.trim(), status: statusOf(repaired.result.message), durationMs: Date.now() - started, endpoint: config.endpoint, message: repaired.result.message, request: meta.request, response: meta.response });
      return { ok: false, message: `札记未通过校验，修复请求失败：${repaired.result.message}` };
    }
    if (!repaired.raw) {
      const message = jsonFailureMessage('札记未通过校验，且修复输出无法解析。', repaired);
      recordLlmLog({ kind: '战斗札记', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
      return { ok: false, message };
    }
    validation = validateBattleNoteDraft(normalizeBattleNoteDraft(repaired.raw), battle, { createdAt: new Date().toISOString(), model: config.model.trim(), presetId: preset?.id });
  }
  if (!validation.ok || !validation.note) {
    const message = `札记未通过校验：${validation.errors.join('；')}`;
    recordLlmLog({ kind: '战斗札记', ok: false, model: config.model.trim(), durationMs: Date.now() - started, endpoint: config.endpoint, message, request: meta.request, response: meta.response });
    return { ok: false, message };
  }
  const note = validation.note;
  recordLlmLog({ kind: '战斗札记', ok: true, model: config.model.trim(), status: 200, durationMs: Date.now() - started, endpoint: config.endpoint, message: `战斗札记：${battle.missionTitle}（${note.charCount} 字，${source.attempts} 次请求）`, request: meta.request, response: meta.response });
  return { ok: true, data: note };
}

export interface GeneratedGirlProfile {
  name: string; codename: string; title: string; element: Element; archetype: Archetype;
  quote: string; goal: string; appearance: string; personality: string; outfitDescription: string;
  focus: StatKey; skillIds: string[]; traits: DraftTrait[];
}

async function generateGirlProfileCore(config: LlmConfig, portrait?: string, hint?: string, preset?: PresetRuntime, meta?: LlmCallMeta): Promise<{ ok: true; data: GeneratedGirlProfile } | { ok: false; message: string }> {
  if (!hasCredentials(resolvePresetConfig(preset ?? EMPTY_RUNTIME, config))) return { ok: false, message: '请先在设置中填写 API 密钥（本地接口可留空）。' };
  const skillList = skills.filter(s => s.school !== 'monster').map(s => `${s.id}(${s.name})`).join('、');
  const schema = `只输出一个 JSON 对象，不要 Markdown 代码块。字段：
{"name":"","codename":"","title":"","element":"星光系|糖霜系|月影系|梦境系|自然系|赤焰系","archetype":"输出|守护|治愈|控制|侦查","quote":"","goal":"","appearance":"","personality":"","outfitDescription":"","focus":"magic|insight|agility|empathy","skillIds":["","",""],"traits":[{"name":"","description":"","polarity":"positive|negative|neutral"}]}
skillIds 只能从以下 ID 中选三个：${skillList}
traits 必须由你自己写满三条：每条 2–6 个字的名称 + 一句 20–40 字的行为解释，必须与立绘和气质吻合；不要从任何现成列表里挑，也不要重复已有的常见词。`;
  const visualRule = portrait
    ? '先观察附带的立绘：发色与发型、瞳色、服装轮廓与配色、配饰、兽耳或尾巴、姿态与表情。appearance 必须具体描述这些可见特征；outfitDescription 必须写到颜色、材质与穿法；element、archetype、personality 和 title 都要从画面气质推断，不能与立绘冲突。'
    : '这次没有立绘，请只根据世界观与文字要求起草，不要假装看见图片。';
  const hintRule = hint?.trim() ? `\n玩家对画面的额外要求（优先满足）：${hint.trim()}` : '';
  const outcome = await chatJson(config, preset, 'profile', `${visualRule}${hintRule}\n\n${schema}`, portrait
    ? [{ type: 'text', text: '请根据这张立绘起草这位新契约者，确保外貌、服装、元素与职阶都和画面一致。' }, { type: 'image_url', image_url: { url: portrait } }]
    : '请起草这位新契约者。', ['共用词条 + 角色起草词条 + 结构契约（含立绘）', '用户请求：起草新契约者'], meta);
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
    const str = (key: string, fallback: string) => typeof raw[key] === 'string' && (raw[key] as string).trim() ? (raw[key] as string).trim().slice(0, 160) : fallback;
    const knownSkills = skills.filter(s => s.school !== 'monster');
    const pickedSkills = Array.isArray(raw.skillIds) ? raw.skillIds.filter((id): id is string => typeof id === 'string' && knownSkills.some(s => s.id === id)) : [];
    const skillIds = [...new Set(pickedSkills)].slice(0, 3);
    for (const skill of knownSkills) { if (skillIds.length >= 3) break; if (!skillIds.includes(skill.id)) skillIds.push(skill.id); }
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
      appearance: str('appearance', '短发，发梢有一缕不合规矩的挑染。'), personality: str('personality', '安静，习惯先观察再开口。'),
      outfitDescription: str('outfitDescription', '事务所配发的值夜制服，袖口略长。'), focus, skillIds, traits: draftTraits,
    } };
  } catch {
    return { ok: false, message: '起草失败：浏览器无法访问接口，或返回内容不是合法 JSON。' };
  }
}

import {
  applyFormat, applyRegexScripts, applyRegexToMessages, composeTaskSystem, promptTokens, resolvePresetConfig, resolvePresetWorld, type PresetRuntime, type PromptScope,
} from './presets.ts';
import { loadPlayerProfile, playerSummary } from './player.ts';
import { worldbookContext } from './worldbook.ts';
import { EMPLOYER_LABEL, factionTagLabel } from './factions.ts';
import { skills } from './content/skills.ts';
import { traits } from './content/traits.ts';
import { buildNightPrompt, validateNightProposal, type NightProposalV2 } from './llm-night.ts';
import { battleCast, battleDigest, normalizeBattleNoteDraft, totalBattleRounds, validateBattleNoteDraft } from './battleNote.ts';
import { activePersonality } from './personality.ts';
import { GRAPH_MAX_EDGES, blueprintIssues, buildGraphFromDraft, type StoryGraphDraft, type StoryGraphDraftEdge, type StoryGraphDraftNode } from './storygraph.ts';
import type { Archetype, BattleNote, BattleState, DraftTrait, Element, Equipment, GameState, Girl, IncidentEffect, MonsterTemplate, StatKey, StoryCompanion, StoryEffect, StoryGraph, StoryMissionSpec, StoryNodeKind } from './types';

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