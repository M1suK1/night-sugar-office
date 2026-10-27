/**
 * 对话补全预设：沿用 SillyTavern 的 ChatPreset 结构、字段名与 prompts[] 编排。
 *
 * 夜糖用到的子集：采样参数、提示词词条（可增删、可排序、可禁用、可引用变量）。
 * 世界书是独立模块（worldbook.ts），这里只负责把 {{worldbook}} 等变量替换掉。
 */
export type PromptRole = 'system' | 'user' | 'assistant';

export interface PromptEntry {
  id: string;
  name: string;
  content: string;
  role: PromptRole;
  enabled: boolean;
  /** SillyTavern 的分隔条目：只用于视觉分组，不发送内容。 */
  marker?: boolean;
  builtin?: boolean;
}

export interface PresetPromptOrderItem {
  identifier: string;
  enabled: boolean;
}

/** 单个预设自带的接口配置：三项齐全时优先于全局设置里的接口。 */
export interface PresetApi {
  endpoint?: string;
  apiKey?: string;
  model?: string;
}

export type RegexTarget = 'input' | 'output';

/** SillyTavern 正则脚本。prompt 侧改发给模型的文本，display 侧改界面/日志里显示的文本。 */
export interface RegexScript {
  id: string;
  name: string;
  find: string;
  replace: string;
  targets: RegexTarget[];
  enabled: boolean;
  promptOnly?: boolean;
  markdownOnly?: boolean;
}

export interface ChatPreset {
  id: string;
  name: string;
  description?: string;
  /** 原样保存 SillyTavern 预设的 settings 对象，便于无损导出。 */
  settings: Record<string, unknown>;
  /** 提示词词条；顺序即拼装顺序。旧预设没有这个字段时从 main / jailbreak 迁移。 */
  prompts?: PromptEntry[];
  /** SillyTavern 的 prompt_order：词的顺序与启停以它为准；缺省时退回数组顺序。 */
  promptOrder?: PresetPromptOrderItem[];
  /** 预设结构版本：2 起带 prompts / promptOrder / api / regex。 */
  schema?: number;
  /** 这个预设专用的接口；不填则用全局 LLM 设置。 */
  api?: PresetApi;
  /** 从 SillyTavern 的 extensions.regex_scripts 解析出来的正则。 */
  regex?: RegexScript[];
  createdAt: string;
  updatedAt: string;
  builtin?: boolean;
}

export interface PresetRuntime {
  id: string;
  name: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  maxContext: number;
  main: string;
  jailbreak: string;
  entries: PromptEntry[];
  /** SillyTavern 的世界书 / 场景 / 性格格式串，用于包裹注入内容。 */
  wiFormat: string;
  scenarioFormat: string;
  personalityFormat: string;
  regex: RegexScript[];
  api?: PresetApi;
}

export const PRESET_STORAGE = 'night-sugar:presets';
export const PRESET_BINDING = 'night-sugar:preset-binding';

export interface PromptVariable {
  key: string;
  label: string;
  hint: string;
}

export const PROMPT_VARIABLES: PromptVariable[] = [
  { key: 'world', label: '世界观', hint: '事务所的世界观底稿（含预设）' },
  { key: 'player', label: '玩家档案', hint: '设置里填写的委托人档案；未填时为空' },
  { key: 'char', label: '当前角色', hint: '本次对话/剧情的角色名与简介' },
  { key: 'story', label: '故事线', hint: '当前故事线的前提与目标；没有则为空' },
  { key: 'worldbook', label: '世界书', hint: '命中的世界书词条（M3 接入）' },
  { key: 'context', label: '本次任务', hint: '本次请求要完成的具体任务' },
  { key: 'history', label: '对话历史', hint: '最近若干轮对话；未启用时为空' },
];

export interface SamplingField {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  hint: string;
  /** OpenAI 兼容接口会真正发送的字段。 */
  applied: boolean;
  /** SillyTavern 两种导出风格的另一种键名（官方预设是 *_openai，直接导出的 settings 是平铺键）。 */
  aliases?: string[];
}

export const SAMPLING_FIELDS: SamplingField[] = [
  { key: 'temp_openai', label: '温度', min: 0, max: 2, step: 0.05, hint: '越高越发散；JSON 任务建议 0.2–0.5。', applied: true, aliases: ['temperature'] },
  { key: 'top_p_openai', label: 'Top P', min: 0, max: 1, step: 0.01, hint: '核采样阈值，和温度二选一调整。', applied: true, aliases: ['top_p'] },
  { key: 'openai_max_tokens', label: '最大输出', min: 64, max: 32768, step: 32, hint: '单次回复的 token 上限。', applied: true, aliases: ['max_tokens'] },
  { key: 'pres_pen_openai', label: '存在惩罚', min: -2, max: 2, step: 0.05, hint: '减少重复话题。', applied: true, aliases: ['presence_penalty'] },
  { key: 'freq_pen_openai', label: '频率惩罚', min: -2, max: 2, step: 0.05, hint: '减少重复用词。', applied: true, aliases: ['frequency_penalty'] },
  { key: 'openai_max_context', label: '上下文预算', min: 2000, max: 400000, step: 1000, hint: '本地裁剪对话历史的上限（字符近似）。', applied: false, aliases: ['max_context'] },
  { key: 'top_k_openai', label: 'Top K', min: 0, max: 200, step: 1, hint: 'SillyTavern / llama.cpp 参数，OpenAI 兼容接口不发送。', applied: false, aliases: ['top_k'] },
  { key: 'top_a_openai', label: 'Top A', min: 0, max: 1, step: 0.01, hint: 'SillyTavern 参数，OpenAI 兼容接口不发送。', applied: false, aliases: ['top_a'] },
  { key: 'min_p_openai', label: 'Min P', min: 0, max: 1, step: 0.01, hint: 'SillyTavern 参数，OpenAI 兼容接口不发送。', applied: false, aliases: ['min_p'] },
  { key: 'repetition_penalty_openai', label: '重复惩罚', min: 1, max: 2, step: 0.01, hint: 'SillyTavern 参数，OpenAI 兼容接口不发送。', applied: false, aliases: ['repetition_penalty'] },
];

const SAMPLING_DEFAULTS: Record<string, number> = {
  temp_openai: 0.9, top_p_openai: 1, openai_max_tokens: 640, pres_pen_openai: 0,
  freq_pen_openai: 0, openai_max_context: 12_000, top_k_openai: 0, top_a_openai: 0,
  min_p_openai: 0, repetition_penalty_openai: 1,
};

/** 读某个采样字段：本作键名优先，其次 SillyTavern 的平铺键名，最后回落默认值并夹取范围。 */
export function samplingValue(preset: ChatPreset, key: string): number {
  const field = SAMPLING_FIELDS.find(item => item.key === key);
  if (!field) return 0;
  const fallback = SAMPLING_DEFAULTS[key] ?? field.min;
  return pickNum(preset.settings ?? {}, [key, ...(field.aliases ?? [])], fallback, field.min, field.max);
}

export const IGNORED_SETTING_KEYS = [
  'wi_format', 'scenario_format', 'personality_format', 'nsfw',
  'stream_openai', 'max_context_unlocked', 'chat_completion_source', 'openai_model',
  'world_info', 'world_info_depth', 'world_info_budget', 'world_info_character_strategy',
  'group_nudge_prompt', 'impersonation_prompt', 'new_chat_prompt', 'new_group_chat_prompt',
  'new_example_chat_prompt', 'continue_nudge_prompt', 'bias_preset_selected', 'welcome_message',
];

const now = () => new Date().toISOString();

function presetId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) return `preset-${cryptoApi.randomUUID()}`;
  return `preset-${Date.now().toString(36)}-${Math.floor(Math.random() * 9999).toString(36)}`;
}

function text(settings: Record<string, unknown>, key: string): string {
  const value = settings[key];
  return typeof value === 'string' ? value : '';
}

/** 按「官方键 → 平铺键」的顺序取数；两种 ST 导出风格都认。 */
function pickNum(settings: Record<string, unknown>, keys: string[], fallback: number, min: number, max: number): number {
  for (const key of keys) {
    const value = settings[key];
    const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(parsed)) return Math.min(max, Math.max(min, parsed));
  }
  return fallback;
}

/** 去掉 ST 的 {{// 注释 }} 块（可跨行），再把 {{user}} / {{char}} 当成名字替换；变量宏按“不执行”处理。 */
export function expandPresetMacros(content: string, vars: Record<string, string | undefined> = {}): { text: string; used: string[] } {
  const used: string[] = [];
  let output = content.replace(/\{\{\/\/[\s\S]*?\}\}/g, '');
  // ST 变量系统（setvar/getvar/addvar）与多模型轮转在本作没有执行环境：整段去掉，避免把宏文本喂给模型。
  output = output.replace(/\{\{(?:setvar|getvar|addvar|incvar|decvar)::[^}]*\}\}/g, '');
  output = output.replace(/\{\{user\}\}/g, () => {
    used.push('user');
    return vars.user ?? '你';
  });
  output = output.replace(/\{\{char\}\}/g, () => {
    used.push('char');
    return vars.charName ?? (vars.char ? vars.char.split(/[（(，,：:\n]/)[0] : '');
  });
  return { text: output, used };
}

/** 估算 token：CJK 按 1、其余按 4 字符 1 token。 */
export function promptTokens(content: string): number {
  let cjk = 0;
  for (const char of content) if (/[\u3400-\u9fff\u3040-\u30ff]/.test(char)) cjk += 1;
  return Math.ceil(cjk + (content.length - cjk) / 4);
}

function entryId(index: number): string {
  return `entry-${Date.now().toString(36)}-${index}-${Math.floor(Math.random() * 999)}`;
}

function sanitizeEntry(raw: unknown, index: number): PromptEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const content = typeof value.content === 'string'
    ? value.content
    : typeof value.system_prompt === 'string'
      ? String(value.system_prompt)
      : '';
  const marker = Boolean(value.marker);
  if (!content.trim() && !marker) return null;
  const identifier = typeof value.identifier === 'string' ? value.identifier : '';
  return {
    id: identifier || (typeof value.id === 'string' && value.id ? value.id : entryId(index)),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 40) : (marker ? '—— 分隔 ——' : `词条 ${index + 1}`),
    content: content.slice(0, 8000),
    role: value.role === 'user' ? 'user' : value.role === 'assistant' ? 'assistant' : 'system',
    enabled: value.enabled === false ? false : value.disable !== true,
    marker,
    builtin: Boolean(value.builtin),
  };
}

/** 旧预设的主提示 / 收尾约束 → 两条系统词条；始终至少给一条可编辑的语气词条。 */
function migratePrompts(settings: Record<string, unknown>): PromptEntry[] {
  const legacy: PromptEntry[] = [];
  const main = text(settings, 'main').trim();
  const jailbreak = text(settings, 'jailbreak').trim();
  if (main) legacy.push({ id: 'main', name: '主提示（main）', content: main, role: 'system', enabled: true, builtin: true });
  if (jailbreak) legacy.push({ id: 'jailbreak', name: '收尾约束（jailbreak）', content: jailbreak, role: 'system', enabled: true, builtin: true });
  if (!legacy.length) {
    legacy.push({
      id: 'tone', name: '叙事语气', role: 'system', enabled: true, builtin: true,
      content: '用克制、具体的笔触叙述。多写动作、环境与停顿，少解释心理；不要替玩家做决定。',
    });
  }
  return legacy;
}

export function presetPrompts(preset: ChatPreset | undefined): PromptEntry[] {
  if (!preset) return [];
  if (Array.isArray(preset.prompts) && preset.prompts.length) return preset.prompts;
  const fromSettings = Array.isArray(preset.settings.prompts)
    ? preset.settings.prompts.map((item, index) => sanitizeEntry(item, index)).filter((item): item is PromptEntry => Boolean(item))
    : [];
  if (fromSettings.length) return fromSettings;
  return migratePrompts(preset.settings);
}

/** 实际参与拼装的词条：按 prompt_order 的顺序与启停；不在 order 里的词条不注入。 */
export function activePrompts(preset: ChatPreset | undefined): PromptEntry[] {
  const all = presetPrompts(preset);
  const order = preset?.promptOrder;
  if (!order?.length) return all;
  const byId = new Map(all.map(entry => [entry.id, entry]));
  const ordered: PromptEntry[] = [];
  for (const item of order) {
    const entry = byId.get(item.identifier);
    if (!entry) continue;
    ordered.push({ ...entry, enabled: item.enabled });
    byId.delete(item.identifier);
  }
  return ordered;
}

export function builtinPresets(): ChatPreset[] {
  const stamp = '2026-01-01T00:00:00.000Z';
  return [
    {
      id: 'builtin-balanced', name: '均衡叙事', description: '默认选项：温度略高，适合日常对话与叙事提案。', createdAt: stamp, updatedAt: stamp, builtin: true,
      settings: { temp_openai: 0.85, top_p_openai: 0.95, openai_max_tokens: 640, openai_max_context: 12000, pres_pen_openai: 0.2, freq_pen_openai: 0.2, main: '', jailbreak: '' },
      prompts: [
        { id: 'player', name: '委托人档案', role: 'system', enabled: true, builtin: true, content: '{{player}}' },
        { id: 'tone', name: '叙事语气', role: 'system', enabled: true, builtin: true, content: '用克制、具体的笔触叙述。少解释心理，让动作与对白说话。' },
        { id: 'task', name: '本次任务', role: 'system', enabled: true, builtin: true, content: '{{context}}' },
      ],
    },
    {
      id: 'builtin-strict', name: '严格 JSON', description: '低温、短输出，给每日提案与角色起草用。', createdAt: stamp, updatedAt: stamp, builtin: true,
      settings: { temp_openai: 0.35, top_p_openai: 0.8, openai_max_tokens: 1400, openai_max_context: 12000, pres_pen_openai: 0, freq_pen_openai: 0, main: '只输出合法的 JSON 对象，不要 Markdown、不要解释、不要在 JSON 前后加任何文字。', jailbreak: '' },
      prompts: [
        { id: 'json', name: 'JSON 约束', role: 'system', enabled: true, builtin: true, content: '只输出合法的 JSON 对象，不要 Markdown、不要解释、不要在 JSON 前后加任何文字。' },
      ],
    },
    {
      id: 'builtin-restrained', name: '克制夜谈', description: '更冷、更慢的对话：压低温度，附一段语气约束。', createdAt: stamp, updatedAt: stamp, builtin: true,
      settings: { temp_openai: 0.65, top_p_openai: 0.9, openai_max_tokens: 420, openai_max_context: 9000, pres_pen_openai: 0.1, freq_pen_openai: 0.35, main: '', jailbreak: '保持克制：少用感叹号，不写大段独白，情绪藏在动作与停顿里。每次只说 1–3 句。' },
      prompts: [
        { id: 'restraint', name: '克制约束', role: 'system', enabled: true, builtin: true, content: '保持克制：少用感叹号，不写大段独白，情绪藏在动作与停顿里。每次只说 1–3 句。' },
      ],
    },
  ];
}

function sanitizePreset(raw: unknown): ChatPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<ChatPreset>;
  const settings = value.settings && typeof value.settings === 'object' && !Array.isArray(value.settings) ? value.settings as Record<string, unknown> : null;
  if (!settings) return null;
  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 40) : '导入的预设';
  const prompts = Array.isArray(value.prompts)
    ? value.prompts.map((item, index) => sanitizeEntry(item, index)).filter((item): item is PromptEntry => Boolean(item))
    : undefined;
  const promptOrder = Array.isArray(value.promptOrder)
    ? value.promptOrder
      .filter((item): item is PresetPromptOrderItem => Boolean(item) && typeof item === 'object' && typeof (item as PresetPromptOrderItem).identifier === 'string')
      .map(item => ({ identifier: item.identifier, enabled: item.enabled !== false }))
    : undefined;
  const apiRaw = value.api && typeof value.api === 'object' ? value.api as Partial<PresetApi> : null;
  const api: PresetApi | undefined = apiRaw
    ? {
      endpoint: typeof apiRaw.endpoint === 'string' ? apiRaw.endpoint.slice(0, 200) : undefined,
      apiKey: typeof apiRaw.apiKey === 'string' ? apiRaw.apiKey.slice(0, 400) : undefined,
      model: typeof apiRaw.model === 'string' ? apiRaw.model.slice(0, 120) : undefined,
    }
    : undefined;
  const regex: RegexScript[] | undefined = Array.isArray(value.regex)
    ? value.regex.map((item, index): RegexScript | null => {
      if (!item || typeof item !== 'object') return null;
      const script = item as Partial<RegexScript>;
      if (typeof script.find !== 'string' || !parseFindRegex(script.find)) return null;
      const targets = Array.isArray(script.targets) ? script.targets.filter((target): target is RegexTarget => target === 'input' || target === 'output') : [];
      if (!targets.length) return null;
      return {
        id: typeof script.id === 'string' && script.id ? script.id : `regex-${index}`,
        name: typeof script.name === 'string' ? script.name.slice(0, 40) : `正则 ${index + 1}`,
        find: script.find,
        replace: typeof script.replace === 'string' ? script.replace : '',
        targets,
        enabled: script.enabled !== false,
        promptOnly: script.promptOnly === true,
        markdownOnly: script.markdownOnly === true,
      };
    }).filter((item): item is RegexScript => Boolean(item))
    : undefined;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : presetId(),
    schema: 2,
    name,
    description: typeof value.description === 'string' ? value.description.slice(0, 160) : undefined,
    settings,
    prompts: prompts?.length ? prompts : undefined,
    promptOrder: promptOrder?.length ? promptOrder : undefined,
    api,
    regex: regex?.length ? regex : undefined,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now(),
    builtin: false,
  };
}

export function loadPresets(): ChatPreset[] {
  const builtins = builtinPresets();
  try {
    const raw = localStorage.getItem(PRESET_STORAGE);
    if (!raw) return builtins;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return builtins;
    const custom = parsed.map(sanitizePreset).filter((preset): preset is ChatPreset => Boolean(preset));
    return [...builtins, ...custom];
  } catch {
    return builtins;
  }
}

export function savePresets(presets: ChatPreset[]): boolean {
  try {
    const custom = presets.filter(preset => !preset.builtin).map(preset => ({ ...preset, builtin: undefined }));
    localStorage.setItem(PRESET_STORAGE, JSON.stringify(custom.slice(0, 40)));
    return true;
  } catch {
    return false;
  }
}

export function createPreset(name = '新的预设'): ChatPreset {
  return {
    id: presetId(), name, description: '', createdAt: now(), updatedAt: now(),
    settings: { temp_openai: 0.8, top_p_openai: 0.95, openai_max_tokens: 600, openai_max_context: 12000, pres_pen_openai: 0.2, freq_pen_openai: 0.2, main: '', jailbreak: '' },
    prompts: migratePrompts({}),
  };
}

export interface PresetUnsupportedEntry {
  id: string;
  name: string;
  reason: string;
}

export interface PresetImportResult {
  ok: boolean;
  message: string;
  preset?: ChatPreset;
  ignored: string[];
  warnings: string[];
  unsupported: PresetUnsupportedEntry[];
}

function emptyImport(ok: boolean, message: string): PresetImportResult {
  return { ok, message, ignored: [], warnings: [], unsupported: [] };
}

/** ST 的 prompt_order 是按角色分开的块；聊天用 character_id=100001，没有就取项数最多的。 */
function pickPromptOrder(settings: Record<string, unknown>): PresetPromptOrderItem[] | undefined {
  const blocks = settings.prompt_order;
  if (!Array.isArray(blocks)) return undefined;
  const parsed = blocks
    .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === 'object')
    .map(block => ({
      characterId: typeof block.character_id === 'number' ? block.character_id : -1,
      order: Array.isArray(block.order) ? block.order : [],
    }))
    .filter(block => block.order.length);
  if (!parsed.length) return undefined;
  const chat = parsed.find(block => block.characterId === 100001)
    ?? parsed.slice().sort((a, b) => b.order.length - a.order.length)[0];
  const items: PresetPromptOrderItem[] = [];
  for (const raw of chat.order) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.identifier !== 'string' || !item.identifier) continue;
    items.push({ identifier: item.identifier, enabled: item.enabled !== false });
  }
  return items.length ? items : undefined;
}

function parseFindRegex(source: string): { pattern: string; flags: string } | null {
  if (!source) return null;
  if (source.startsWith('/')) {
    const last = source.lastIndexOf('/');
    if (last > 0) {
      const pattern = source.slice(1, last);
      const flags = source.slice(last + 1).replace(/[^gimsuy]/g, '');
      try {
        new RegExp(pattern, flags);
        return { pattern, flags };
      } catch {
        return null;
      }
    }
  }
  try {
    new RegExp(source);
    return { pattern: source, flags: '' };
  } catch {
    return null;
  }
}

function parseRegexScript(raw: unknown, index: number): RegexScript | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Record<string, unknown>;
  const find = typeof item.findRegex === 'string' ? item.findRegex : typeof item.find === 'string' ? item.find : '';
  if (!find || !parseFindRegex(find)) return null;
  const placement = Array.isArray(item.placement) ? item.placement.filter(value => typeof value === 'number') : [];
  const targets: RegexTarget[] = [];
  if (!placement.length || placement.includes(1)) targets.push('input');
  if (!placement.length || placement.includes(2)) targets.push('output');
  if (!targets.length) return null;
  return {
    id: typeof item.id === 'string' && item.id ? item.id : `regex-${index}`,
    name: typeof item.scriptName === 'string' ? item.scriptName.slice(0, 40) : typeof item.name === 'string' ? item.name.slice(0, 40) : `正则 ${index + 1}`,
    find,
    replace: typeof item.replaceString === 'string' ? item.replaceString : '',
    targets,
    enabled: item.disabled !== true,
    promptOnly: item.promptOnly === true,
    markdownOnly: item.markdownOnly === true,
  };
}

export function pickRegexScripts(settings: Record<string, unknown>): RegexScript[] {
  const extensions = settings.extensions && typeof settings.extensions === 'object' ? settings.extensions as Record<string, unknown> : null;
  const scripts = extensions && Array.isArray(extensions.regex_scripts) ? extensions.regex_scripts : [];
  return scripts.map((raw, index) => parseRegexScript(raw, index)).filter((item): item is RegexScript => Boolean(item));
}

/** 按 ST 语义跑正则：input 改玩家输入，output 改模型输出；prompt/display 决定改哪一侧。 */
export function applyRegexScripts(text: string, scripts: RegexScript[] | undefined, target: RegexTarget, destination: 'prompt' | 'display'): string {
  if (!scripts?.length) return text;
  let output = text;
  for (const script of scripts) {
    if (!script.enabled || !script.targets.includes(target)) continue;
    if (destination === 'prompt' && script.markdownOnly) continue;
    if (destination === 'display' && script.promptOnly) continue;
    const parsed = parseFindRegex(script.find);
    if (!parsed) continue;
    try {
      output = output.replace(new RegExp(parsed.pattern, parsed.flags || 'g'), script.replace);
    } catch {
      // 单条脚本失败不影响其余脚本
    }
  }
  return output;
}

export function applyRegexToMessages<T extends { role: string; content: unknown }>(messages: T[], scripts: RegexScript[] | undefined): T[] {
  if (!scripts?.length) return messages;
  return messages.map(message => {
    if (typeof message.content !== 'string') return message;
    const target: RegexTarget = message.role === 'assistant' ? 'output' : 'input';
    const content = applyRegexScripts(message.content, scripts, target, 'prompt');
    return content === message.content ? message : { ...message, content };
  });
}

export function applyFormat(template: string | undefined, value: string): string {
  if (!value) return '';
  if (!template) return value;
  if (template.includes('{0}')) return template.split('{0}').join(value);
  // ST 的默认格式串长这样：{{scenario}} / {{personality}}，它表示「原样放进来」，不是外层包装。
  if (/^\s*\{\{[a-zA-Z_]+\}\}\s*$/.test(template)) return value;
  return `${template}\n${value}`;
}

/** 预设自带接口优先；三项不全或远程缺 key 时退回全局接口。 */
export function resolvePresetConfig<T extends { endpoint: string; apiKey: string; model: string }>(preset: { api?: PresetApi } | undefined, fallback: T): T {
  const api = preset?.api;
  if (!api) return fallback;
  const endpoint = api.endpoint?.trim();
  const model = api.model?.trim();
  if (!endpoint || !model) return fallback;
  const remote = !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(endpoint);
  if (remote && !api.apiKey?.trim()) return fallback;
  return { ...fallback, endpoint, apiKey: api.apiKey?.trim() ?? '', model };
}

export function importPresetJson(source: string): PresetImportResult {
  let data: unknown;
  try {
    data = JSON.parse(source);
  } catch {
    return emptyImport(false, '不是合法的 JSON 文件。');
  }
  return importPresetObject(data);
}

export function importPresetObject(data: unknown): PresetImportResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return emptyImport(false, '预设必须是一个 JSON 对象。');
  const raw = data as Record<string, unknown>;
  // SillyTavern 导出格式：{ name, settings } 或直接把 settings 平铺在顶层。
  const nested = raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings);
  const settings = { ...((nested ? raw.settings : raw) as Record<string, unknown>) };
  const incomingApi = settings.api;
  const importedApi = incomingApi && typeof incomingApi === 'object'
    ? {
      endpoint: typeof (incomingApi as PresetApi).endpoint === 'string' ? String((incomingApi as PresetApi).endpoint).slice(0, 200) : undefined,
      model: typeof (incomingApi as PresetApi).model === 'string' ? String((incomingApi as PresetApi).model).slice(0, 120) : undefined,
    }
    : undefined;
  delete settings.api;
  delete settings.apiKey;
  const name = typeof raw.name === 'string' ? raw.name : typeof raw.preset === 'string' ? raw.preset : typeof settings.name === 'string' ? settings.name : '导入的预设';
  const prompts = Array.isArray(settings.prompts)
    ? settings.prompts.map((item, index) => sanitizeEntry(item, index)).filter((item): item is PromptEntry => Boolean(item))
    : [];
  const promptOrder = pickPromptOrder(settings);
  const regex = pickRegexScripts(settings);
  const rawRegexCount = (() => {
    const ext = settings.extensions;
    if (!ext || typeof ext !== 'object') return 0;
    const list = (ext as Record<string, unknown>).regex_scripts;
    return Array.isArray(list) ? list.length : 0;
  })();
  const preset: ChatPreset = {
    id: presetId(), name: String(name).slice(0, 40) || '导入的预设',
    description: typeof raw.description === 'string' ? raw.description.slice(0, 160) : `从 SillyTavern 预设导入（${Object.keys(settings).length} 个字段）`,
    settings, api: importedApi, prompts: prompts.length ? prompts : undefined, promptOrder,
    regex: regex.length ? regex : undefined,
    createdAt: now(), updatedAt: now(),
  };

  const warnings: string[] = [];
  const unsupported: PresetUnsupportedEntry[] = [];
  const maxTokensRaw = Number(settings.openai_max_tokens ?? settings.max_tokens ?? 0);
  if (Number.isFinite(maxTokensRaw) && maxTokensRaw > 32768) {
    warnings.push(`最大输出 ${maxTokensRaw} tokens 超过本作上限 32768，已按 32768 使用。`);
  }
  if (prompts.length && !promptOrder) {
    warnings.push('这个预设没有 prompt_order，词条会按数组顺序拼装；顺序可能和 SillyTavern 里看到的不同。');
  }
  if (prompts.some(entry => /\{\{(?:setvar|getvar|addvar|incvar|decvar)::/.test(entry.content))) {
    warnings.push('检测到 ST 变量宏（setvar/getvar）：本作不执行变量系统，这些宏会在拼装时被移除。');
  }
  if (prompts.some(entry => /two models take turns|多模型|輪替|轮转/i.test(entry.content))) {
    warnings.push('这个预设包含多模型轮转的提示段：本作只调用一个模型，相关段落会原样留在提示词里，可能影响语气。');
  }
  if (rawRegexCount > regex.length) {
    warnings.push(`${rawRegexCount - regex.length} 条正则无法解析（表达式非法的跳过），只有 ${regex.length} 条可用。`);
  }
  if (raw.api || settings.api) {
    warnings.push('预设里带有接口配置：为避免密钥随文件传播，导入时不读取 API，请在「接口与正则」页单独填写。');
  }
  if (settings.extensions && typeof settings.extensions === 'object') {
    const ext = settings.extensions as Record<string, unknown>;
    if (ext.SPreset) warnings.push('检测到 SPreset 扩展数据：本作不执行 SPreset 的注入与变量处理。');
    if (ext.tavern_helper) warnings.push('检测到 Tavern Helper 扩展数据：本作不执行它的脚本与正则绑定。');
  }
  for (const entry of prompts) {
    if (!entry.enabled || entry.marker) continue;
    if (/game_content|<output_method>/i.test(entry.content)) {
      unsupported.push({ id: entry.id, name: entry.name, reason: '要求工具调用（game_content），本作没有函数调用通道' });
    }
  }
  if (unsupported.length) {
    warnings.push(`有 ${unsupported.length} 条词条要求工具调用，建议在词条页手动停用，否则模型可能输出无法解析的工具调用。`);
  }

  const ignored = IGNORED_SETTING_KEYS.filter(key => key in settings);
  return {
    ok: true,
    message: `已导入「${preset.name}」${prompts.length ? `，${prompts.length} 条提示词词条` : ''}${promptOrder ? `，${promptOrder.length} 项顺序` : ''}${ignored.length ? `，忽略 ${ignored.length} 个用不到的字段` : ''}。`,
    preset, ignored, warnings, unsupported,
  };
}

export function exportPresetJson(preset: ChatPreset): string {
  // 与 SillyTavern 的 importPreset 兼容：settings 平铺 + name/description + prompts[] + prompt_order。
  const prompts = presetPrompts(preset).map(entry => ({
    identifier: entry.id,
    name: entry.name,
    content: entry.content,
    role: entry.role,
    system_prompt: entry.role === 'system' ? entry.content : '',
    marker: Boolean(entry.marker),
    disable: !entry.enabled,
  }));
  const promptOrder = (preset.promptOrder ?? presetPrompts(preset).map(entry => ({ identifier: entry.id, enabled: entry.enabled })))
    .map(item => ({ ...item }));
  const extensions = preset.settings.extensions && typeof preset.settings.extensions === 'object'
    ? { ...(preset.settings.extensions as Record<string, unknown>) }
    : {};
  if (preset.regex?.length) {
    extensions.regex_scripts = preset.regex.map(script => ({
      id: script.id, scriptName: script.name, findRegex: script.find, replaceString: script.replace,
      placement: script.targets.map(target => (target === 'input' ? 1 : 2)),
      disabled: !script.enabled, markdownOnly: script.markdownOnly ?? false, promptOnly: script.promptOnly ?? false,
    }));
  }
  const settings: Record<string, unknown> = { ...preset.settings, prompts, extensions };
  delete settings.api;
  if (preset.api?.endpoint || preset.api?.model) {
    settings.api = { endpoint: preset.api.endpoint ?? '', model: preset.api.model ?? '' };
  }
  return JSON.stringify({
    schema: 2, ...settings, name: preset.name, description: preset.description ?? '',
    prompt_order: [{ character_id: 100001, order: promptOrder }],
  }, null, 2);
}

export function presetRuntime(preset: ChatPreset | undefined): PresetRuntime {
  const settings = preset?.settings ?? builtinPresets()[0].settings;
  return {
    id: preset?.id ?? 'builtin-balanced',
    name: preset?.name ?? '均衡叙事',
    temperature: pickNum(settings, ['temp_openai', 'temperature'], 0.85, 0, 2),
    topP: pickNum(settings, ['top_p_openai', 'top_p'], 0.95, 0, 1),
    maxTokens: Math.round(pickNum(settings, ['openai_max_tokens', 'max_tokens'], 640, 64, 32768)),
    presencePenalty: pickNum(settings, ['pres_pen_openai', 'presence_penalty'], 0, -2, 2),
    frequencyPenalty: pickNum(settings, ['freq_pen_openai', 'frequency_penalty'], 0, -2, 2),
    maxContext: Math.round(pickNum(settings, ['openai_max_context', 'max_context'], 12000, 2000, 400000)),
    main: text(settings, 'main'),
    jailbreak: text(settings, 'jailbreak'),
    entries: activePrompts(preset),
    wiFormat: text(settings, 'wi_format') || '{0}',
    scenarioFormat: text(settings, 'scenario_format') || '{{scenario}}',
    personalityFormat: text(settings, 'personality_format') || '{{personality}}',
    regex: preset?.regex ?? [],
    api: preset?.api,
  };
}

/** 把预设词条的变量替换掉；返回系统段、缺失变量与命中变量。 */
export function renderPresetSystem(entries: PromptEntry[], vars: Record<string, string | undefined>): { system: string; used: string[]; missing: string[]; tokens: number } {
  const used = new Set<string>();
  const missing = new Set<string>();
  const parts: string[] = [];
  for (const entry of entries) {
    if (!entry.enabled || entry.marker) continue;
    const expanded = expandPresetMacros(entry.content, vars);
    expanded.used.forEach(key => used.add(key));
    const content = expanded.text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      used.add(key);
      const value = vars[key];
      if (!value) { missing.add(key); return ''; }
      return value;
    });
    if (content.trim()) parts.push(entry.role === 'system' ? content.trim() : `【${entry.role}】\n${content.trim()}`);
  }
  const system = parts.join('\n\n');
  return { system, used: [...used], missing: [...missing], tokens: promptTokens(system) };
}

export interface PresetBinding {
  chat: string;
  generate: string;
  story: string;
}

const DEFAULT_BINDING: PresetBinding = { chat: 'builtin-balanced', generate: 'builtin-strict', story: 'builtin-balanced' };

export function loadBinding(): PresetBinding {
  try {
    const raw = localStorage.getItem(PRESET_BINDING);
    if (!raw) return { ...DEFAULT_BINDING };
    const parsed = JSON.parse(raw) as Partial<PresetBinding>;
    return {
      chat: typeof parsed.chat === 'string' ? parsed.chat : DEFAULT_BINDING.chat,
      generate: typeof parsed.generate === 'string' ? parsed.generate : DEFAULT_BINDING.generate,
      story: typeof parsed.story === 'string' ? parsed.story : DEFAULT_BINDING.story,
    };
  } catch {
    return { ...DEFAULT_BINDING };
  }
}

export function saveBinding(binding: PresetBinding) {
  try { localStorage.setItem(PRESET_BINDING, JSON.stringify(binding)); } catch { /* session only */ }
}

export function boundPreset(kind: 'chat' | 'generate' | 'story', presets = loadPresets(), binding = loadBinding()): ChatPreset {
  const wanted = binding[kind];
  const fallbackId = kind === 'generate' ? 'builtin-strict' : 'builtin-balanced';
  return presets.find(preset => preset.id === wanted)
    ?? presets.find(preset => preset.id === fallbackId)
    ?? presets[0];
}

/** 把预设词条拼到系统提示词之后；旧预设的 main / jailbreak 也在这里兜底。 */
export function withPresetPrompts(system: string, runtime: PresetRuntime, vars: Record<string, string | undefined> = {}): { system: string; used: string[]; missing: string[] } {
  const parts = [system.trim()];
  const entries = runtime.entries?.length ? runtime.entries : [];
  if (entries.length) {
    const rendered = renderPresetSystem(entries, vars);
    if (rendered.system) parts.push(`【预设词条】\n${rendered.system}`);
    return { system: parts.filter(Boolean).join('\n\n'), used: rendered.used, missing: rendered.missing };
  }
  const main = (runtime.main ?? '').trim();
  const jailbreak = (runtime.jailbreak ?? '').trim();
  if (main) parts.push(`【预设·主提示】\n${main}`);
  if (jailbreak) parts.push(`【预设·越狱/收尾约束】\n${jailbreak}`);
  return { system: parts.filter(Boolean).join('\n\n'), used: [], missing: [] };
}

export const DEFAULT_PROMPTS: PromptEntry[] = [
  { id: 'world', name: '世界观', role: 'system', enabled: true, content: '{{world}}' },
  { id: 'player', name: '委托人档案', role: 'system', enabled: true, content: '{{player}}' },
  { id: 'tone', name: '叙事语气', role: 'system', enabled: true, content: '用克制、具体的笔触叙述。少解释心理，让动作与对白说话。' },
  { id: 'task', name: '本次任务', role: 'system', enabled: true, content: '{{context}}' },
];

export { now as presetNow, presetId as newPresetId, entryId as newEntryId };
