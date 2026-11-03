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
}

export function shouldAutoGenerate(state: AutoGenerateState, enabled: boolean): boolean {
  if (!enabled) return false;
  const generated = typeof state.generatedDay === 'number' ? state.generatedDay : state.day;
  return state.day > generated;
}
