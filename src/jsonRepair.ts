/**
 * 把被截断的 JSON 补成能解析的形状。
 *
 * 叙事者的蓝图动辄几千字，一旦被 length 截在最后一个数组里，模型给出的其实是
 * 「只差几个收尾括号」的完整内容，却因为解析失败整份作废。这里做的只有一件事：
 * 按括号栈把缺的 `}` / `]` 补上、把没结尾的字符串补一个引号，
 * 然后交给 JSON.parse 去判断到底能不能用。
 *
 * 它不猜内容、不补字段——补不出来的（例如截在键名中间）仍然返回 null。
 */
export function closeTruncatedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  const body = text.slice(start);
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const char of body) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') {
      if (stack.pop() !== char) return null;
    }
  }
  let out = body;
  if (inString) out += '"';
  // 截在「半个键值」上时先抹掉尾巴：保留到最后一个完整的逗号之前。
  out = out.replace(/[,:]\s*$/, '').replace(/,\s*$/, '');
  while (stack.length) out += stack.pop();
  try {
    JSON.parse(out);
    return out;
  } catch {
    return null;
  }
}
