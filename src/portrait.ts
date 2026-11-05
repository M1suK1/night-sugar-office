/**
 * 立绘来源的统一解析（v87）。
 *
 * 背景：契约卡导入时，卡面图被放进「衣柜第一套礼装」的 `portrait` 里，少女本体的
 * `girl.portrait` 是空的。大头像（`GirlPortrait`）会先看衣柜，所以有图；小头像
 * （`GirlThumb`）以前只看 `portrait`，于是同一张卡在大头像里能看见、在小头像里变成
 * 名字首字。这里把「用哪张图」收敛成一条规则，两边共用。
 *
 * 优先级（与 `GirlPortrait` 保持一致）：
 *   1. 魔女形态（`witch` + `witchForm`）
 *   2. 当前礼装的表情差分（`importedVariants['<outfitId>:<expression>']`）
 *   3. 当前礼装的 `portrait`
 *   4. 当前礼装的 `portraitAsset`（异步资产）
 *   5. 少女本体的 `portrait` / `portraitAsset`
 */
import { currentExpressionOutfitId, expressionOutfits, expressionVariantKey } from './expressions.ts';
import type { AssetId, Expression, Outfit } from './types.ts';

/** 只读立绘需要的最小形状：少女、势力人物、编成条目都能塞进来。 */
export interface PortraitSubjectLike {
  portrait?: string;
  portraitAsset?: AssetId;
  witch?: boolean;
  witchForm?: Outfit;
  wardrobe?: Outfit[];
  outfitId?: string;
  expression?: Expression;
  importedVariants?: Record<string, string>;
}

export interface PortraitSource {
  /** 内联的 data URL；为空时看 `asset`。 */
  portrait: string;
  /** 需要异步取的对象存储 id。 */
  asset?: AssetId;
}

const isImage = (value: string | undefined): value is string => typeof value === 'string' && value.startsWith('data:image/');

export function portraitSource(person: PortraitSubjectLike): PortraitSource {
  const outfitId = currentExpressionOutfitId(person);
  const outfit = expressionOutfits(person).find(item => item.id === outfitId);
  const expression = person.expression ?? 'calm';

  const variant = person.importedVariants?.[expressionVariantKey(outfitId, expression)];
  if (isImage(variant)) return { portrait: variant };
  if (isImage(outfit?.portrait)) return { portrait: outfit.portrait };
  if (outfit?.portraitAsset) return { portrait: '', asset: outfit.portraitAsset };
  if (isImage(person.portrait)) return { portrait: person.portrait, asset: person.portraitAsset };
  return { portrait: '', asset: person.portraitAsset };
}

/** 只要一个能直接塞进 `<img src>` 的字符串（不含资产解析），给非 React 的地方用。 */
export function portraitString(person: PortraitSubjectLike): string {
  return portraitSource(person).portrait || '';
}
