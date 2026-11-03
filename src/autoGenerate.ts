/**
 * 该不该自动补一次提案。
 *
 * 以前用 useRef(0) 记「上一次生成的日号」：页面一刷 ref 就归零，
 * 于是任何 day > 0 的存档在载入首帧都被判成「换日了」，立刻请求一次。
 * 现在这个日号跟着存档走（`state.generatedDay`），刷新、换设备、读档都不会重放。
 */
export interface AutoGenerateState {
  day: number;
  /** 最近一次自动生成发生在第几日的开门时。缺省按「就是今天」处理，避免读档补发。 */
  generatedDay?: number;
  /** 序章是否看完。没看完就是在初始化途中，这时候生成会拿默认名册起草。 */
  prologueSeen?: boolean;
}

/**
 * 该不该自动补一次提案。
 *
 * 除了「换日了」之外还有两道闸：
 *  - 开局那一夜（`openingDay`）不补：首夜由 `openingFill` 用本地内容摆好桌子，
 *    此时玩家还没走完序章、也还没挑人，让叙事者照着默认名册写提案只会写错人。
 *  - 序章没看完不补：那说明游戏还在初始化（编成 / 读档 / 建号途中）。
 */
export function shouldAutoGenerate(state: AutoGenerateState, enabled: boolean, openingDay = 0): boolean {
  if (!enabled) return false;
  if (state.prologueSeen === false) return false;
  if (state.day <= openingDay) return false;
  const generated = typeof state.generatedDay === 'number' ? state.generatedDay : state.day;
  return state.day > generated;
}

/**
 * 读档时把「最近一次自动生成」的日号收口。
 *
 * 旧档没有这个字段：以前 shouldAutoGenerate 把缺字段当成「就是今天」，
 * 于是那些存档永远不会自动补提案——无论过多少天。这里把它记成今天，
 * 读档当下不生成，下一次换日照旧触发。
 */
export function normalizeGeneratedDay(day: number, value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return day;
  return Math.max(1, Math.min(Math.round(day), Math.round(numeric)));
}
