import type { Outfit } from './types';
import { isExpressionVariantData, parseExpressionVariantKey, sanitizeExpressionVariants } from './expressions.ts';

export interface WardrobePackage {
  outfits: Outfit[];
  outfitId: string;
  importedVariants: Record<string, string>;
  witchForm?: Outfit;
  portrait?: string;
}

export type WardrobePackageResult = ({ ok: true } & WardrobePackage) | { ok: false; message: string };

export const WARDROBE_PACKAGE_LIMIT = 4;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function palette(value: unknown, fallback: string): string[] {
  const colors = Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.length <= 32).slice(0, 5)
    : [];
  return colors.length ? colors : [fallback, '#2a1e35', '#f4d9e5'];
}

function readOutfit(value: unknown, index: number, fallbackColor: string, witch = false): Outfit | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const id = text(raw.id, 40).replace(/[^a-zA-Z0-9_-]/g, '') || `import-${index + 1}`;
  const name = text(raw.name, 24) || (witch ? '魔女化 · 夜之形' : `导入服装 ${index + 1}`);
  const portrait = isExpressionVariantData(raw.portrait) ? raw.portrait : undefined;
  return {
    id,
    name,
    description: text(raw.description, 100) || (witch ? '从衣柜包带入的魔女形态。' : '从衣柜包带入的服装。'),
    palette: palette(raw.palette, fallbackColor),
    layerKey: text(raw.layerKey, 24) || id,
    form: witch ? 'witch' : 'normal',
    portrait,
    imported: true,
    custom: false,
  };
}

/** 读取自定义登记里的衣柜包；兼容外层包一层 `girl`，也兼容 `outfits` 写法。 */
export function readWardrobePackage(raw: unknown, fallbackColor = '#d98aa8'): WardrobePackageResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: '衣柜包需要是一个 JSON 对象。' };
  }
  const root = (raw as Record<string, unknown>).girl && typeof (raw as Record<string, unknown>).girl === 'object'
    ? (raw as Record<string, unknown>).girl as Record<string, unknown>
    : raw as Record<string, unknown>;
  const source = Array.isArray(root.wardrobe) ? root.wardrobe : Array.isArray(root.outfits) ? root.outfits : [];
  const outfits: Outfit[] = [];
  const seen = new Set<string>();
  for (const item of source.slice(0, WARDROBE_PACKAGE_LIMIT)) {
    const outfit = readOutfit(item, outfits.length, fallbackColor);
    if (!outfit) continue;
    let id = outfit.id;
    let suffix = 2;
    while (seen.has(id)) id = `${outfit.id.slice(0, 34)}-${suffix++}`;
    seen.add(id);
    outfits.push({ ...outfit, id });
  }
  if (!outfits.length) return { ok: false, message: '衣柜包里没有可用的服装。' };

  const witchForm = readOutfit(root.witchForm, 0, fallbackColor, true);
  const validIds = new Set(outfits.map(outfit => outfit.id));
  if (witchForm) {
    witchForm.id = 'witchform';
    validIds.add('witchform');
  }
  const importedVariants = Object.fromEntries(
    Object.entries(sanitizeExpressionVariants(root.importedVariants))
      .filter(([key]) => {
        const parsed = parseExpressionVariantKey(key);
        return Boolean(parsed && validIds.has(parsed.outfitId));
      }),
  );
  const requested = text(root.outfitId, 40);
  const outfitId = validIds.has(requested) && requested !== 'witchform' ? requested : outfits[0].id;
  const activeOutfit = outfits.find(outfit => outfit.id === outfitId);
  const portrait = isExpressionVariantData(root.portrait)
    ? root.portrait
    : activeOutfit?.portrait ?? outfits.find(outfit => outfit.portrait)?.portrait;
  return {
    ok: true,
    outfits,
    outfitId,
    importedVariants,
    witchForm: witchForm ? { ...witchForm, id: 'witchform', form: 'witch' } : undefined,
    portrait,
  };
}
