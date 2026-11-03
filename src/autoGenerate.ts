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
  /** 开局编成是否定下（`startersPicked`）；空白档没有编成这一步。 */
  startersPicked?: boolean;
  blank?: boolean;
}

/**
 * 该不该自动补一次提案。
 *
 * 除了「换日了」之外还有两道闸，挡的都是「初始化没结束」：
 *  - 序章没看完：那时还在播开场，玩家连人是谁都没认全。
 *  - 编成没定下（`startersPicked`）：那时手上的还是默认名册/卡库池，
 *    让叙事者照着它写提案，写出来的是一份错人的提案。空白档没有编成这一步，直接放行。
 *
 * 两道闸都过了之后，首夜也可以照常补——玩家已经认过人了，没必要再等一夜。
 */
export function shouldAutoGenerate(state: AutoGenerateState, enabled: boolean): boolean {
  if (!enabled) return false;
  if (state.prologueSeen === false) return false;
  if (!state.startersPicked && !state.blank) return false;
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
