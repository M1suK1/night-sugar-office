export interface LlmConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

const KEY = 'night-sugar:llm-config';

export const defaultLlmConfig: LlmConfig = {
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
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

export async function testLlmConnection(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  if (!config.apiKey.trim()) return { ok: false, message: '请先填写 API 密钥。' };
  if (!/^https?:\/\//.test(config.endpoint)) return { ok: false, message: '接口地址必须以 http:// 或 https:// 开头。' };
  try {
    const response = await fetch(`${config.endpoint.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey.trim()}` },
    });
    if (!response.ok) return { ok: false, message: `连接失败：服务返回 ${response.status}。` };
    return { ok: true, message: '连接成功，模型服务可以访问。' };
  } catch {
    return { ok: false, message: '连接失败：浏览器无法访问该地址，或服务未允许跨域请求。' };
  }
}
