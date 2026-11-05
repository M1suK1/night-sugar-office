/**
 * 她此刻穿着什么（v95）。
 *
 * 提示词里一直只有「外貌」，衣服的描述从没进过模型。档案页现在把这段文字存进
 * 当前那套礼装（或魔女形态）里，所以这里统一取一次：
 *  - 魔女形态：优先 `witchForm.description`，没有就退回普通服装描述；
 *  - 普通形态：`outfitDescription`（换装时已同步成当前那套）。
 */
import type { Girl } from './types.ts';

type OutfitLike = Pick<Girl, 'witch' | 'witchForm' | 'outfitDescription'>;

export function outfitBrief(girl: OutfitLike): string {
  const witch = Boolean(girl.witch);
  const witchText = witch ? (girl.witchForm?.description ?? '').trim() : '';
  const worn = (girl.outfitDescription ?? '').trim();
  const text = witch ? witchText || worn : worn;
  return text.slice(0, 200);
}

/** 给提示词用的一行：`魔女形态：…` / `装扮：…`；没有内容时返回空串。 */
export function outfitLine(girl: OutfitLike): string {
  const text = outfitBrief(girl);
  if (!text) return '';
  return `${girl.witch ? '魔女形态' : '装扮'}：${text}`;
}
