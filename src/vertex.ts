/**
 * Vertex AI 接入层。
 *
 * 两种凭证都从这个文件走：
 *  - 服务账号 JSON（project_id / client_email / private_key）：本地签 RS256 断言，
 *    去 https://oauth2.googleapis.com/token 换 access token，再打 aiplatform 的区域端点。
 *  - Express 模式密钥（AIza 开头）：直接当 `?key=` 用，走 global 端点。
 *
 * 这里刻意不 import llm.ts：调用方把消息按同样的形状传进来，避免循环依赖。
 */

export interface VertexServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  tokenUri: string;
}

export type VertexPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
export type VertexMessage = { role: 'system' | 'user' | 'assistant'; content: string | VertexPart[] };

export interface VertexParams {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export type VertexCallResult =
  | { ok: true; text: string; reasoning?: string; finish?: string; usage?: { prompt?: number; completion?: number; total?: number } }
  | { ok: false; message: string; reasoning?: string; status?: number; usage?: { prompt?: number; completion?: number; total?: number } };

export const DEFAULT_VERTEX_LOCATION = 'us-central1';
export const VERTEX_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

export interface VertexCredential {
  kind: 'service-account' | 'express-key';
  serviceAccount?: VertexServiceAccount;
}

/** 只认 JSON 里的三个关键字，缺一个就不当成服务账号。 */
export function parseVertexServiceAccount(text: string): VertexServiceAccount | null {
  const raw = text.trim();
  if (!raw.startsWith('{')) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  const projectId = typeof record.project_id === 'string' ? record.project_id.trim() : '';
  const clientEmail = typeof record.client_email === 'string' ? record.client_email.trim() : '';
  const privateKey = typeof record.private_key === 'string' ? record.private_key.trim() : '';
  if (!projectId || !clientEmail || !privateKey) return null;
  const tokenUri = typeof record.token_uri === 'string' && record.token_uri.trim() ? record.token_uri.trim() : DEFAULT_TOKEN_URI;
  return { projectId, clientEmail, privateKey, tokenUri };
}

export function isVertexServiceAccount(text: string): boolean {
  return parseVertexServiceAccount(text) !== null;
}

/** 判断这串密钥该怎么用；看不懂就当普通密钥交给调用方报错。 */
export function readVertexCredential(secret: string): VertexCredential | null {
  const text = secret.trim();
  if (!text) return null;
  const serviceAccount = parseVertexServiceAccount(text);
  if (serviceAccount) return { kind: 'service-account', serviceAccount };
  if (text.startsWith('{')) return null;
  return { kind: 'express-key' };
}

export function vertexLocation(location?: string): string {
  const value = (location ?? '').trim();
  return value || DEFAULT_VERTEX_LOCATION;
}

/** 允许直接粘 `publishers/google/models/gemini-x`、`models/gemini-x` 或 `google/gemini-x`。 */
export function normalizeVertexModel(model: string): string {
  return model
    .trim()
    .replace(/^https?:\/\/[^/]+\/v1\//i, '')
    .replace(/^projects\/[^/]+\/locations\/[^/]+\/publishers\/google\/models\//i, '')
    .replace(/^publishers\/google\/models\//i, '')
    .replace(/^models\//i, '')
    .replace(/^google\//i, '')
    .replace(/:(generateContent|streamGenerateContent)$/i, '');
}

export interface VertexTarget {
  url: string;
  model: string;
  /** 面板上展示用，不含密钥。 */
  display: string;
}

/** 新模型偶尔只挂在 v1beta1 上，404 时会用它再试一次。 */
export type VertexVersion = 'v1' | 'v1beta1';

/** Express 模式固定走 global；服务账号按 location 拼区域主机。 */
export function vertexTarget(input: { model: string; location?: string; expressKey?: string; version?: VertexVersion }, serviceAccount?: VertexServiceAccount): VertexTarget {
  const model = normalizeVertexModel(input.model);
  const version = input.version ?? 'v1';
  if (serviceAccount) {
    const location = vertexLocation(input.location);
    const host = location === 'global' ? 'aiplatform.googleapis.com' : `${location}-aiplatform.googleapis.com`;
    const path = `/${version}/projects/${serviceAccount.projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    return { url: `https://${host}${path}`, model, display: `https://${host}${path}` };
  }
  const path = `/${version}/publishers/google/models/${model}:generateContent`;
  const key = input.expressKey?.trim();
  return {
    url: `https://aiplatform.googleapis.com${path}${key ? `?key=${encodeURIComponent(key)}` : ''}`,
    model,
    display: `https://aiplatform.googleapis.com${path}`,
  };
}

function base64Url(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlText(text: string): string {
  return base64Url(new TextEncoder().encode(text));
}

function pemToBytes(pem: string): Uint8Array<ArrayBuffer> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function signAssertion(serviceAccount: VertexServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64UrlText(JSON.stringify({
    iss: serviceAccount.clientEmail,
    scope: VERTEX_SCOPE,
    aud: serviceAccount.tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`));
  return `${header}.${claims}.${base64Url(new Uint8Array(signature as ArrayBuffer))}`;
}

interface CachedToken { key: string; token: string; expiresAt: number; }
let cachedToken: CachedToken | null = null;

/** 方便测试和「换密钥」时清掉缓存。 */
export function clearVertexToken() {
  cachedToken = null;
}

export async function vertexAccessToken(serviceAccount: VertexServiceAccount, timeoutMs = 20_000): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const cacheKey = `${serviceAccount.clientEmail}|${serviceAccount.projectId}`;
  if (cachedToken && cachedToken.key === cacheKey && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.token };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const assertion = await signAssertion(serviceAccount);
    const response = await fetch(serviceAccount.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${encodeURIComponent(assertion)}`,
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;
    if (!response.ok || !body?.access_token) {
      const detail = body?.error_description ?? body?.error ?? '';
      const hint = /invalid_grant/i.test(`${body?.error ?? ''}${detail}`)
        ? '私钥可能已经轮换、时钟偏差过大，或该服务账号已被停用。'
        : response.status === 400
          ? '请确认这份 JSON 来自「服务账号」密钥，而不是 OAuth 客户端。'
          : '';
      return { ok: false, message: `换取访问令牌失败（${response.status}）${detail ? `：${detail}` : '。'}${hint}` };
    }
    const ttl = Number(body.expires_in ?? 3600);
    cachedToken = { key: cacheKey, token: body.access_token, expiresAt: Date.now() + Math.max(60, ttl - 60) * 1000 };
    return { ok: true, token: body.access_token };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, message: '换取访问令牌超时，请检查网络后重试。' };
    const detail = error instanceof Error ? error.message : '';
    if (/importKey|DataError|OperationError/i.test(detail)) {
      return { ok: false, message: `私钥无法解析（${detail}）。请重新导出完整的服务账号 JSON。` };
    }
    return { ok: false, message: `无法连接 Google 认证服务${detail ? `（${detail}）` : ''}。请检查网络或代理。` };
  } finally {
    clearTimeout(timer);
  }
}

function dataUrlToInline(url: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(url);
  if (!match) return null;
  const mimeType = match[1] || 'image/png';
  const data = match[2] ?? '';
  return { mimeType, data };
}

function toContents(messages: VertexMessage[]): { systemText: string; contents: { role: 'user' | 'model'; parts: unknown[] }[] } {
  const systemParts: string[] = [];
  const contents: { role: 'user' | 'model'; parts: unknown[] }[] = [];
  for (const message of messages) {
    if (message.role === 'system') {
      systemParts.push(typeof message.content === 'string' ? message.content : message.content.map(part => part.type === 'text' ? part.text : '').join('\n'));
      continue;
    }
    const role = message.role === 'assistant' ? 'model' : 'user';
    const parts: unknown[] = typeof message.content === 'string'
      ? [{ text: message.content }]
      : message.content.map(part => {
        if (part.type === 'text') return { text: part.text };
        const inline = dataUrlToInline(part.image_url.url);
        return inline ? { inlineData: inline } : { fileData: { fileUri: part.image_url.url } };
      });
    contents.push({ role, parts });
  }
  return { systemText: systemParts.join('\n\n'), contents };
}

interface VertexResponseBody {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
    finishMessage?: string;
  }[];
  promptFeedback?: { blockReason?: string; blockReasonMessage?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  error?: { code?: number; message?: string; status?: string };
}

function finishOf(reason?: string): string | undefined {
  if (!reason) return undefined;
  if (reason === 'STOP') return 'stop';
  if (reason === 'MAX_TOKENS') return 'length';
  if (reason === 'SAFETY' || reason === 'PROHIBITED_CONTENT' || reason === 'RECITATION') return 'content_filter';
  return reason.toLowerCase();
}

function errorMessage(status: number, body: VertexResponseBody | null, detail: string): string {
  const raw = body?.error?.message ?? detail;
  const hint = status === 400
    ? '模型名、区域或请求体不被接受。'
    : status === 401 || status === 403
      ? '凭证没有权限：请在 Cloud 控制台确认已启用 Vertex AI API，并为该服务账号授予 roles/aiplatform.user。'
      : status === 404
        ? '找不到该模型或区域：请确认模型名（如 gemini-2.5-pro）与区域（如 us-central1）在项目里可用。'
        : status === 429
          ? '配额或速率已满，稍后再试。'
          : '';
  return `Vertex AI 返回 ${status}${raw ? `：${raw}` : ''}${hint ? `（${hint}）` : ''}`;
}

/**
 * 发一次 generateContent。失败信息都写成人话，方便在设置里直接看到原因。
 */
export async function vertexChat(
  input: { model: string; location?: string; secret: string; timeoutMs?: number },
  messages: VertexMessage[],
  params: VertexParams = {},
): Promise<VertexCallResult> {
  const credential = readVertexCredential(input.secret);
  if (!credential) return { ok: false, message: '密钥为空或不是有效的服务账号 JSON。' };
  if (!input.model.trim()) return { ok: false, message: '请先填写模型名称，例如 gemini-2.5-pro。' };

  const serviceAccount = credential.serviceAccount;
  let token: string | undefined;
  if (serviceAccount) {
    const result = await vertexAccessToken(serviceAccount);
    if (!result.ok) return { ok: false, message: result.message };
    token = result.token;
  }
  const { systemText, contents } = toContents(messages);
  const generationConfig: Record<string, unknown> = {};
  if (params.temperature !== undefined) generationConfig.temperature = params.temperature;
  if (params.topP !== undefined) generationConfig.topP = params.topP;
  if (params.maxTokens !== undefined) generationConfig.maxOutputTokens = params.maxTokens;
  if (params.presencePenalty !== undefined) generationConfig.presencePenalty = params.presencePenalty;
  if (params.frequencyPenalty !== undefined) generationConfig.frequencyPenalty = params.frequencyPenalty;
  const payload: Record<string, unknown> = { contents };
  if (systemText) payload.systemInstruction = { parts: [{ text: systemText }] };
  if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;

  const model = normalizeVertexModel(input.model);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 60_000);
  /** 发一次请求；404 时换 v1beta1 再试，别让新模型卡在版本上。 */
  const send = async (version: VertexVersion): Promise<{ ok: true; body: VertexResponseBody } | { ok: false; failure: { message: string; status?: number } }> => {
    const target = vertexTarget({ model, location: input.location, expressKey: serviceAccount ? undefined : input.secret, version }, serviceAccount);
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let body: VertexResponseBody | null = null;
      try { body = JSON.parse(text) as VertexResponseBody; } catch { /* 保持原文 */ }
      return { ok: false, failure: { status: response.status, message: errorMessage(response.status, body, text.replace(/\s+/g, ' ').slice(0, 220)) } };
    }
    const body = await response.json().catch(() => null) as VertexResponseBody | null;
    if (!body || typeof body !== 'object') return { ok: false, failure: { message: 'Vertex AI 返回了无法解析的响应体，可能被代理或网关改写了。' } };
    return { ok: true, body };
  };
  try {
    let attempt = await send('v1');
    if (!attempt.ok && attempt.failure.status === 404) attempt = await send('v1beta1');
    if (!attempt.ok) return { ok: false, status: attempt.failure.status, message: attempt.failure.message };
    const body = attempt.body;
    const candidate = body.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const text = parts.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text as string).join('');
    const reasoning = parts.filter(part => part.thought && typeof part.text === 'string').map(part => part.text as string).join('') || undefined;
    const usage = body.usageMetadata
      ? { prompt: body.usageMetadata.promptTokenCount, completion: body.usageMetadata.candidatesTokenCount, total: body.usageMetadata.totalTokenCount }
      : undefined;
    if (!text.trim()) {
      const blocked = body.promptFeedback?.blockReason;
      const reason = candidate?.finishReason;
      const snippet = JSON.stringify(body).replace(/\s+/g, ' ').slice(0, 220);
      if (blocked) return { ok: false, message: `请求被安全策略拦截（${blocked}）${body.promptFeedback?.blockReasonMessage ? `：${body.promptFeedback.blockReasonMessage}` : '。'}`, reasoning, usage };
      if (reason === 'MAX_TOKENS') return { ok: false, message: '输出额度在写出正文前就用完了（finishReason: MAX_TOKENS）。思维链会先吃掉额度，请把「最大输出」调高，或换一个非思维链模型。', reasoning, usage };
      if (reason && reasoning) return { ok: false, message: '模型只返回了思维链，没有给出最终文本。', reasoning, usage };
      const detail = [
        reason ? `finishReason: ${reason}` : '响应里没有 candidates',
        candidate?.finishMessage,
        `原始响应：${snippet}`,
      ].filter(Boolean).join('；');
      return { ok: false, message: `模型没有返回文本内容（${detail}）。请确认该模型支持 generateContent，并检查模型名与区域。`, reasoning, usage };
    }
    return { ok: true, text, reasoning, finish: finishOf(candidate?.finishReason), usage };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, message: '请求超时仍未返回，已中止。可以重试，或换一个更快的模型。' };
    const detail = error instanceof Error ? error.message : '';
    return { ok: false, message: `浏览器无法访问 Vertex AI，或网络被拦截。${detail ? `（${detail}）` : ''}` };
  } finally {
    clearTimeout(timer);
  }
}

/** 设置页的诊断信息：不发请求，只解析密钥。 */
export function describeVertexCredential(secret: string): { kind: 'empty' | 'service-account' | 'express-key' | 'invalid'; projectId?: string; clientEmail?: string; message: string } {
  const text = secret.trim();
  if (!text) return { kind: 'empty', message: '尚未导入密钥。' };
  const serviceAccount = parseVertexServiceAccount(text);
  if (serviceAccount) {
    return { kind: 'service-account', projectId: serviceAccount.projectId, clientEmail: serviceAccount.clientEmail, message: '服务账号 JSON 已就绪。' };
  }
  if (text.startsWith('{')) return { kind: 'invalid', message: 'JSON 缺少 project_id、client_email 或 private_key，可能不是服务账号密钥。' };
  return { kind: 'express-key', message: '按 Express 模式密钥处理（走 global 端点，不需要服务账号）。' };
}
