/**
 * 把叙事引擎的每次请求与响应落到 `data/llm-logs/YYYY-MM-DD.jsonl`。
 *
 * 走 `npm run dev` / `start.cmd` 时由本地接口写盘；纯静态部署没有这个接口，
 * fetch 会失败——安静吞掉，界面上的日志面板照旧可用。
 */
const ENDPOINT = '/api/logs';
const MAX_TEXT = 12_000;

export interface LlmLogEntry {
  scope: string;
  labels: string[];
  model?: string;
  provider?: string;
  params?: Record<string, unknown>;
  ok: boolean;
  finish?: string;
  usage?: unknown;
  messages: { role: string; content: string }[];
  response: string;
  /** 模型返回的思维链；不裁剪，整段写盘。 */
  reasoning?: string;
}

function clip(text: string, limit = MAX_TEXT): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}\n…（已截断，共 ${text.length} 字）`;
}

function today(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

type Sink = (entry: LlmLogEntry) => void;

let sink: Sink | null = null;

/** 由 App 在启动时挂上真正的写盘实现；没挂就说明这个环境不该落盘（测试、静态部署）。 */
export function setLlmLogSink(next: Sink | null): void {
  sink = next;
}

export function persistLlmLog(entry: LlmLogEntry): void {
  sink?.(entry);
}

/** 真正写盘的那一个：POST 到本地接口，失败就安静吞掉。 */
export function postLlmLog(entry: LlmLogEntry): void {
  if (typeof fetch !== 'function') return;
  const record = {
    at: new Date().toISOString(),
    ...entry,
    messages: entry.messages.map(message => ({ role: message.role, content: clip(message.content) })),
    response: clip(entry.response),
  };
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ day: today(), text: JSON.stringify(record) }),
  }).catch(() => { /* 静态部署没有本地接口，忽略。 */ });
}
