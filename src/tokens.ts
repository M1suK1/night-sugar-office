/** 估算 token：CJK 按 1、其余按 4 字符 1 token。 */
export function promptTokens(content: string): number {
  let cjk = 0;
  for (const char of content) if (/[\u3400-\u9fff\u3040-\u30ff]/.test(char)) cjk += 1;
  return Math.ceil(cjk + (content.length - cjk) / 4);
}
