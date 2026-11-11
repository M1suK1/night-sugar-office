/**
 * 判断「思维链」是不是只是把正文原样打了一遍草稿（v256）。
 *
 * Gemini 2.5 在强 JSON 任务里常常先在思考里写出完整 JSON，最后再输出一份几乎相同的正文。
 * 这种重复对玩家没有信息量：界面上不再展开，日志里仍然保留原文。
 */
export function reasoningEcho(reasoning?: string, text?: string): boolean {
  const left = (reasoning ?? '').trim();
  const right = (text ?? '').trim();
  if (!left || !right) return false;
  if (left === right) return true;
  const a = squeeze(left);
  const b = squeeze(right);
  if (a && b) {
    if (a === b) return true;
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    // 只差排版、多几句收尾：长度接近且互相包含，就当同一段。
    if (shorter >= 120 && longer / shorter <= 1.35 && (a.includes(b) || b.includes(a))) return true;
  }
  const ja = asObject(left);
  const jb = asObject(right);
  if (ja && jb) {
    // JSON 任务：正文就是最终那块 narration，思考里写的是同一段，算重复。
    const na = typeof ja.narration === 'string' ? squeeze(ja.narration) : '';
    const nb = typeof jb.narration === 'string' ? squeeze(jb.narration) : '';
    if (na && na === nb) return true;
  }
  return false;
}

function squeeze(text: string): string {
  return text.replace(/\s+/g, '');
}

function asObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}
