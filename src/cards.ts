import type { Expression, Girl, GirlCard, Outfit, StatKey } from './types';
import { sanitizeStoryPlan } from './storyplan.ts';
import { EXPRESSIONS, sanitizeExpressionVariants } from './expressions.ts';
import { skillById } from './content/skills.ts';
import { traitById } from './content/traits.ts';

const STAT_KEYS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function girlCardHash(card: GirlCard): string {
  const g = card.girl;
  const variants = Object.entries(g.importedVariants ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${hash(value)}`)
    .join('|');
  return hash([g.name, g.codename, g.level, g.skillIds.join('|'), g.traitIds.join('|'), g.portrait?.length ?? 0, g.witchForm?.name ?? '', g.witchForm?.portrait?.length ?? 0, hash(g.witchPersonality ?? ''), variants].join(':'));
}

export function buildGirlCard(girl: Girl, state: { day: number; packHash?: string }): GirlCard {
  return {
    format: 'night-sugar/girl-card', version: 1, exportedAt: new Date().toISOString(), sourceDay: state.day, packHash: state.packHash,
    girl: {
      name: girl.name, codename: girl.codename, title: girl.title, element: girl.element, archetype: girl.archetype,
      color: girl.color, quote: girl.quote, goal: girl.goal, appearance: girl.appearance, personality: girl.personality,
      witchPersonality: girl.witchPersonality?.trim() || undefined,
      outfitDescription: girl.outfitDescription, level: girl.level, storyPlan: girl.storyPlan ? { ...girl.storyPlan, beats: girl.storyPlan.beats.map(beat => ({ ...beat })) } : undefined,
      stats: { ...girl.stats }, skillIds: [...girl.skills], traitIds: girl.traits.map(trait => trait.id),
      portrait: girl.portrait || undefined, portraitSpec: girl.portraitSpec,
      wardrobe: girl.wardrobe?.map(outfit => ({ ...outfit })), outfitId: girl.outfitId, expression: girl.expression,
      importedVariants: girl.importedVariants && Object.keys(girl.importedVariants).length ? { ...girl.importedVariants } : undefined,
      witchForm: girl.witchForm ? { ...girl.witchForm, id: 'witchform', form: 'witch' } : undefined,
    },
  };
}

export function girlCardFileName(card: GirlCard): string {
  return `夜糖事务所-契约卡-${card.girl.name.replace(/[\\/:*?"<>|]/g, '')}.json`;
}

export function parseGirlCard(raw: string): { ok: true; card: GirlCard } | { ok: false; message: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return { ok: false, message: '这不是有效的 JSON 文件。' }; }
  if (!parsed || typeof parsed !== 'object') return { ok: false, message: '卡片内容为空。' };
  const card = parsed as Partial<GirlCard>;
  if (card.format !== 'night-sugar/girl-card' || card.version !== 1) return { ok: false, message: '不是夜糖事务所的契约卡，或版本不受支持。' };
  const g = card.girl;
  if (!g || typeof g !== 'object') return { ok: false, message: '卡片缺少角色资料。' };
  const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
  if (!text(g.name, 12) || !text(g.codename, 16) || !text(g.title, 40)) return { ok: false, message: '名字、称号或代号不完整。' };
  if (typeof g.element !== 'string' || typeof g.color !== 'string') return { ok: false, message: '元素或代表色缺失。' };
  if (!Number.isInteger(g.level) || g.level < 1 || g.level > 10) return { ok: false, message: '等级必须在 1–10 之间。' };
  if (!g.stats || typeof g.stats !== 'object') return { ok: false, message: '能力值缺失。' };
  for (const key of STAT_KEYS) {
    const value = (g.stats as Record<string, unknown>)[key];
    if (!Number.isFinite(value) || (value as number) < 40 || (value as number) > 150) return { ok: false, message: `能力值 ${key} 超出 40–150。` };
  }
  if (!Array.isArray(g.skillIds) || g.skillIds.length !== 3 || new Set(g.skillIds).size !== 3 || g.skillIds.some(id => !skillById.has(id))) return { ok: false, message: '技能必须是三个不同的已知技能。' };
  if (!Array.isArray(g.traitIds) || g.traitIds.length > 6 || new Set(g.traitIds).size !== g.traitIds.length || g.traitIds.some(id => !traitById.has(id))) return { ok: false, message: '特性数量或标识无效。' };
  const portraitOk = !g.portrait || (typeof g.portrait === 'string' && ((g.portrait.startsWith('/art/') && g.portrait.length < 200) || (/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(g.portrait) && g.portrait.length <= 2_800_000)));
  if (!portraitOk) return { ok: false, message: '立绘必须是小于约 2MB 的 PNG、JPEG、WebP 或内置 SVG。' };
  const wardrobe: Outfit[] | undefined = Array.isArray(g.wardrobe) ? g.wardrobe.filter(outfit => outfit && typeof outfit.id === 'string' && typeof outfit.name === 'string').slice(0, 4) : undefined;
  const rawWitch = (g as Record<string, unknown>).witchForm;
  const witchPortraitOk = (value: unknown): value is string => typeof value === 'string'
    && ((value.startsWith('/art/') && value.length < 200) || (/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(value) && value.length <= 2_800_000));
  const witchForm: Outfit | undefined = rawWitch && typeof rawWitch === 'object' && !Array.isArray(rawWitch)
    ? (() => {
      const raw = rawWitch as Record<string, unknown>;
      return {
        id: 'witchform' as const,
        form: 'witch' as const,
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 24) : '魔女化 · 夜之形',
        description: typeof raw.description === 'string' ? raw.description.slice(0, 100) : '从契约卡带入的魔女形态。',
        palette: Array.isArray(raw.palette) ? raw.palette.filter((color): color is string => typeof color === 'string').slice(0, 5) : [],
        layerKey: typeof raw.layerKey === 'string' ? raw.layerKey.slice(0, 24) : 'witch',
        portrait: witchPortraitOk(raw.portrait) ? raw.portrait : undefined,
        imported: true,
      };
    })()
    : undefined;
  const normalized: GirlCard = {
    format: 'night-sugar/girl-card', version: 1, exportedAt: typeof card.exportedAt === 'string' ? card.exportedAt : new Date().toISOString(),
    sourceDay: typeof card.sourceDay === 'number' ? card.sourceDay : 1, packHash: typeof card.packHash === 'string' ? card.packHash : undefined,
    girl: {
      name: g.name!.trim(), codename: g.codename!.trim(), title: g.title!.trim(), element: g.element as GirlCard['girl']['element'],
      archetype: g.archetype, color: g.color, quote: typeof g.quote === 'string' ? g.quote.slice(0, 200) : undefined,
      goal: typeof g.goal === 'string' ? g.goal.slice(0, 160) : '还没有写下来的愿望。',
      appearance: typeof g.appearance === 'string' ? g.appearance.slice(0, 240) : '没有留下外貌描述。',
      personality: typeof g.personality === 'string' ? g.personality.slice(0, 240) : '安静。',
      witchPersonality: typeof g.witchPersonality === 'string' && g.witchPersonality.trim() ? g.witchPersonality.trim().slice(0, 600) : undefined,
      outfitDescription: typeof g.outfitDescription === 'string' ? g.outfitDescription.slice(0, 240) : '值夜制服。',
      level: g.level, stats: Object.fromEntries(STAT_KEYS.map(key => [key, Math.round((g.stats as Record<string, number>)[key])])) as Record<StatKey, number>,
      skillIds: [...g.skillIds], traitIds: [...g.traitIds], portrait: g.portrait || undefined, portraitSpec: g.portraitSpec,
      wardrobe, outfitId: typeof g.outfitId === 'string' ? g.outfitId : 'uniform',
      expression: EXPRESSIONS.includes(g.expression as Expression) ? g.expression : 'calm',
      importedVariants: sanitizeExpressionVariants(g.importedVariants),
      witchForm,
      storyPlan: sanitizeStoryPlan((g as Record<string, unknown>).storyPlan) ?? undefined,
    },
  };
  return { ok: true, card: normalized };
}
