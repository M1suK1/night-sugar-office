/**
 * 角色起草的联网考据（只给同人角色用）。
 *
 * 不把搜索塞进 JSON 生成：先单独发一次纯文本的 googleSearch 请求，把摘要与来源
 * 拿回来，再作为「参考资料」注入到角色起草的提示词里。这样 JSON 契约、枚举与
 * 本地校验都不受影响，搜索失败也只是退回无资料起草。
 *
 * 目前只支持 Vertex / Gemini 的 googleSearch grounding：OpenAI 兼容网关对
 * web_search 的透传很不一致，硬接会变成「有的网关能用、有的 400」。
 */
import { vertexChat } from './vertex.ts';
import { logResearchEvent } from './llm.ts';

export const RESEARCH_STORAGE_KEY = 'night-sugar:research';
/** 同一条查询 30 分钟内复用，避免自动补全把额度烧光。 */
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_SUMMARY_CHARS = 2400;
const MAX_SOURCES = 6;

export interface ResearchPrefs {
  enabled: boolean;
}

export function loadResearchPrefs(): ResearchPrefs {
  try {
    return { enabled: localStorage.getItem(RESEARCH_STORAGE_KEY) === 'on' };
  } catch {
    return { enabled: false };
  }
}

export function saveResearchPrefs(prefs: ResearchPrefs): void {
  try {
    localStorage.setItem(RESEARCH_STORAGE_KEY, prefs.enabled ? 'on' : 'off');
  } catch {
    /* 偏好存不下就按关闭处理。 */
  }
}

export interface CharacterResearch {
  summary: string;
  sources: { title: string; uri: string }[];
  queries: string[];
}

export type ResearchOutcome =
  | { ok: true; data: CharacterResearch; cached: boolean }
  | { ok: false; message: string };

export interface ResearchConfig {
  provider?: 'openai' | 'vertex';
  apiKey: string;
  model: string;
  location?: string;
}

const cache = new Map<string, { at: number; data: CharacterResearch }>();

function cacheKey(config: ResearchConfig, query: string): string {
  return `${config.model.trim()}::${query}`;
}

/** 只留可读的短句：去掉多余空行、列表符号与 Markdown 强调。 */
function tidy(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/^[ \t]*[-*•]\s+/gm, '· ')
    .replace(/[*_`#]+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeResearchQuery(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, 160);
}

/**
 * 查一次公开资料。调用方只在「角色起草」里用，并且已经确认开关打开。
 */
export async function researchCharacter(config: ResearchConfig, rawQuery: string): Promise<ResearchOutcome> {
  const started = Date.now();
  const query = normalizeResearchQuery(rawQuery);
  if (!query) return { ok: false, message: '没有填写要考据的角色或出处。' };
  if (config.provider !== 'vertex') {
    return { ok: false, message: '联网考据目前只支持 Vertex AI / Gemini 的 googleSearch；当前接口不支持。' };
  }
  const key = cacheKey(config, query);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ok: true, data: hit.data, cached: true };

  const result = await vertexChat(
    { model: config.model, location: config.location, secret: config.apiKey, timeoutMs: 30_000 },
    [
      {
        role: 'system',
        content: '你是同人角色的资料考据助手。只用公开资料核对：作品名、角色名、身份、外貌关键词、能力与标志性台词。输出 3–6 条要点，每条一行、不超过 100 字；查不到就直说查不到，不要编造。',
      },
      { role: 'user', content: `请查一下这个同人角色的公开资料：${query}` },
    ],
    { temperature: 0.2, maxTokens: 1600, tools: [{ googleSearch: {} }] },
  );
  if (!result.ok) {
    logResearchEvent({ ok: false, model: config.model, message: result.message, durationMs: Date.now() - started });
    return { ok: false, message: result.message };
  }

  const summary = tidy(result.text).slice(0, MAX_SUMMARY_CHARS);
  if (!summary) {
    logResearchEvent({ ok: false, model: config.model, message: '没有返回可用的资料摘要。', durationMs: Date.now() - started });
    return { ok: false, message: '模型没有返回可用的资料摘要。' };
  }
  const sources = (result.grounding?.sources ?? [])
    .filter((source, index, list) => list.findIndex(other => other.uri === source.uri) === index)
    .slice(0, MAX_SOURCES);
  const queries = (result.grounding?.queries ?? []).slice(0, 6);
  const data: CharacterResearch = { summary, sources, queries };
  cache.set(key, { at: Date.now(), data });
  logResearchEvent({
    ok: true,
    model: config.model,
    message: `考据完成：${summary.length} 字，${sources.length} 条来源`,
    detail: sources.map(source => (source.title ? `${source.title}\n${source.uri}` : source.uri)).join('\n\n'),
    durationMs: Date.now() - started,
  });
  return { ok: true, data, cached: false };
}

/** 测试用：清掉内存缓存。 */
export function clearResearchCache(): void {
  cache.clear();
}
