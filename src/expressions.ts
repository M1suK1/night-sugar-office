import type { Expression, Outfit } from './types';

/** 表情的固定顺序：档案、差分管理与导入文件名映射共用。 */
export const EXPRESSIONS: Expression[] = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'];

export const EXPRESSION_META: Record<Expression, { label: string; note: string; aliases: string[] }> = {
  calm: { label: '平静', note: '呼吸放轻，目光稳定', aliases: ['normal', 'neutral', '平静', '普通', '常态'] },
  smile: { label: '微笑', note: '嘴角抬起，眼里有光', aliases: ['happy', '微笑', '笑'] },
  surprise: { label: '惊讶', note: '眼睛睁大，动作停住', aliases: ['shock', '惊讶', '吃惊'] },
  sad: { label: '低落', note: '视线垂下，声音变轻', aliases: ['sorrow', '低落', '悲伤', '难过'] },
  angry: { label: '生气', note: '眉峰压低，语气变硬', aliases: ['anger', '生气', '愤怒'] },
  shy: { label: '害羞', note: '偏开视线，耳尖发红', aliases: ['blush', '害羞', '脸红'] },
};

/** 每套服装最多保存六张差分，正好覆盖六种表情；不同服装各自计数。 */
export const EXPRESSION_VARIANT_LIMIT = EXPRESSIONS.length;

/** 单张差分的数据上限，避免 localStorage 被几张原图挤爆。 */
export const EXPRESSION_VARIANT_MAX_CHARS = 1_600_000;

export function isExpression(value: unknown): value is Expression {
  return typeof value === 'string' && (EXPRESSIONS as string[]).includes(value);
}

/** 表情差分可以管理的服装：普通衣柜 + 已保存的魔女化立绘。 */
export function expressionOutfits(girl: { wardrobe?: Outfit[]; witchForm?: Outfit }): Outfit[] {
  const list = [...(girl.wardrobe ?? [])];
  if (girl.witchForm) list.push({ ...girl.witchForm, id: 'witchform', form: 'witch' });
  return list;
}

/** 当前实际显示的是哪一套；魔女化优先于普通衣柜。 */
export function currentExpressionOutfitId(girl: { witch?: boolean; witchForm?: Outfit; outfitId?: string }): string {
  return girl.witch && girl.witchForm ? 'witchform' : girl.outfitId ?? 'custom';
}

export function expressionLabel(expression: Expression): string {
  return EXPRESSION_META[expression].label;
}

/** 差分按服装隔离，避免换装后沿用另一套衣服的表情图。 */
export function expressionVariantKey(outfitId: string, expression: Expression): string {
  return `${outfitId}:${expression}`;
}

export function parseExpressionVariantKey(key: string): { outfitId: string; expression: Expression } | null {
  const split = key.lastIndexOf(':');
  if (split <= 0) return null;
  const outfitId = key.slice(0, split).trim();
  const expression = key.slice(split + 1);
  if (!outfitId || outfitId.length > 80 || !isExpression(expression)) return null;
  return { outfitId, expression };
}

export function isExpressionVariantData(value: unknown): value is string {
  return typeof value === 'string'
    && value.startsWith('data:image/')
    && value.length <= EXPRESSION_VARIANT_MAX_CHARS;
}

/** 清洗存档、契约卡和导入包里的差分，丢掉坏键、坏图与单套服装的超额项。 */
export function sanitizeExpressionVariants(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const cleaned: Record<string, string> = {};
  const perOutfit = new Map<string, number>();
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseExpressionVariantKey(key);
    if (!parsed || !isExpressionVariantData(value)) continue;
    const used = perOutfit.get(parsed.outfitId) ?? 0;
    if (used >= EXPRESSION_VARIANT_LIMIT) continue;
    cleaned[key] = value;
    perOutfit.set(parsed.outfitId, used + 1);
  }
  return cleaned;
}

/** 批量导入时从文件名里认表情；认不出就跳过，不猜。 */
export function expressionFromFileName(name: string): Expression | undefined {
  const base = name.replace(/\.[^.]+$/, '').toLowerCase();
  return EXPRESSIONS.find(expression => {
    const meta = EXPRESSION_META[expression];
    return [expression, ...meta.aliases].some(alias => base.includes(alias.toLowerCase()));
  });
}
