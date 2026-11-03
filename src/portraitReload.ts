import type { Girl, GameState } from './types';

/** 存档瘦身会把立绘抹成空串；空串、外链占位都算「缺」。 */
export function portraitMissing(girl: Pick<Girl, 'portrait'>): boolean {
  const portrait = girl.portrait;
  if (typeof portrait !== 'string' || portrait.length === 0) return true;
  return !portrait.startsWith('data:');
}

/** 名册上缺立绘的人（候选人另算，他们本来可能还没图）。 */
export function girlsMissingPortrait(state: Pick<GameState, 'girls'>): Girl[] {
  return state.girls.filter(girl => !girl.dead && !girl.retired && portraitMissing(girl));
}

/** 重新载入后给一句可读的回执。 */
export function portraitReloadReport(name: string, ok: boolean): string {
  return ok ? `已重新载入 ${name} 的立绘。` : `${name} 的立绘没能载入：换一张图再试。`;
}
