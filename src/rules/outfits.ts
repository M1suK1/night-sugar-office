import { parseExpressionVariantKey } from '../expressions.ts';
import type { Girl, Outfit } from '../types.ts';
import { hashText } from './core.ts';
// v35 从 src/game.ts 拆出：衣柜、立绘与表情外观。

export function sanitizeOutfit(outfit: Outfit, color: string): Outfit | null {
  if (!outfit || typeof outfit !== 'object' || typeof outfit.name !== 'string' || !outfit.name.trim()) return null;
  const portrait = typeof outfit.portrait === 'string' && outfit.portrait.startsWith('data:image/') ? outfit.portrait : undefined;
  return {
    id: typeof outfit.id === 'string' && outfit.id ? outfit.id.slice(0, 40) : `outfit-${hashText(outfit.name).toString(16)}`,
    name: outfit.name.trim().slice(0, 24),
    description: typeof outfit.description === 'string' ? outfit.description.slice(0, 200) : '',
    palette: Array.isArray(outfit.palette) && outfit.palette.length ? outfit.palette.filter(c => typeof c === 'string').slice(0, 4) : [color, '#17141c', '#f7e9f1'],
    layerKey: typeof outfit.layerKey === 'string' && outfit.layerKey ? outfit.layerKey : 'uniform',
    portrait,
    portraitSpec: outfit.portraitSpec,
    imported: Boolean(outfit.imported),
    custom: Boolean(outfit.custom),
    form: outfit.form === 'witch' ? 'witch' : undefined,
  };
}
/** 自定义礼装占衣柜的第一格，立绘沿用本人。 */

/** 自定义礼装占衣柜的第一格，立绘沿用本人。 */
export function customOutfitFor(source: { color: string; outfitDescription?: string; portrait?: string; portraitSpec?: Girl['portraitSpec'] }): Outfit {
  return {
    id: 'custom',
    name: '契约礼装',
    description: source.outfitDescription?.trim() || '为她单独缝制的那一套，只有这一件。',
    palette: [source.color, '#17141c', '#ffe4ef'],
    layerKey: 'formal',
    portrait: source.portrait?.startsWith('data:image/') ? source.portrait : undefined,
    portraitSpec: source.portraitSpec,
    custom: true,
  };
}

/** 魔女化的立绘单独一格；没有上传立绘时退回程序化剪影的魔女配色。 */

/** 魔女化的立绘单独一格；没有上传立绘时退回程序化剪影的魔女配色。 */
export function witchOutfitFor(girl: Pick<Girl, 'color' | 'portrait' | 'portraitSpec'>): Outfit {
  return {
    id: 'witchform',
    name: '魔女化',
    description: '侵蚀越过临界点之后，她偶尔会以另一副样子站在镜子里。',
    palette: ['#2a1524', '#c478b8', '#f3aec9'],
    layerKey: 'formal',
    form: 'witch',
    portrait: girl.portrait?.startsWith('data:image/') ? girl.portrait : undefined,
    portraitSpec: girl.portraitSpec,
  };
}
/**
 * 读档与建档的统一入口。
 *
 * 入参允许缺 `factionTag`（旧存档、外部导入的契约卡、种子包），所以这里收成
 * `GirlInput`；返回值一定是完整的 `Girl`，其余模块不必再判空。
 */

/** 服装被移除后，不再保留这套衣服的表情差分。 */
export function pruneOrphanVariants(girl: Girl): void {
  if (!girl.importedVariants) return;
  const outfitIds = new Set([...girl.wardrobe.map(outfit => outfit.id), 'witchform']);
  for (const key of Object.keys(girl.importedVariants)) {
    const parsed = parseExpressionVariantKey(key);
    if (!parsed || !outfitIds.has(parsed.outfitId)) delete girl.importedVariants[key];
  }
}
