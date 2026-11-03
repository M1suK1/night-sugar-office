import { isExpressionVariantData } from './expressions.ts';
import { sanitizePortraitSrc } from './image.ts';
import type { Expression } from './types.ts';

export interface PlayerProfile {
  name: string;
  alias: string;
  pronoun: string;
  appearance: string;
  personality: string;
  background: string;
  relation: string;
  /** 所长的立绘：存在本机（localStorage），不进存档，避免几张原图把存档撑大。 */
  portrait: string;
  /** 立绘取景，与少女立绘同一套手感。 */
  portraitCrop?: { zoom: number; x: number; y: number };
  /** 六种表情各一张；缺的那格回落到 portrait。 */
  expressions: Partial<Record<Expression, string>>;
}

export const PLAYER_KEY = 'night-sugar:player-profile';

export const EMPTY_PLAYER: PlayerProfile = {
  name: '', alias: '', pronoun: '', appearance: '', personality: '', background: '', relation: '',
  portrait: '', expressions: {},
};

export function loadPlayerProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    if (!raw) return { ...EMPTY_PLAYER };
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, 24) : '',
      alias: typeof parsed.alias === 'string' ? parsed.alias.slice(0, 24) : '',
      pronoun: typeof parsed.pronoun === 'string' ? parsed.pronoun.slice(0, 8) : '',
      appearance: typeof parsed.appearance === 'string' ? parsed.appearance.slice(0, 400) : '',
      personality: typeof parsed.personality === 'string' ? parsed.personality.slice(0, 400) : '',
      background: typeof parsed.background === 'string' ? parsed.background.slice(0, 600) : '',
      relation: typeof parsed.relation === 'string' ? parsed.relation.slice(0, 400) : '',
      portrait: sanitizePortraitSrc((parsed as Partial<PlayerProfile>).portrait) ?? '',
      portraitCrop: readCrop((parsed as Partial<PlayerProfile>).portraitCrop),
      expressions: readExpressions((parsed as Partial<PlayerProfile>).expressions),
    };
  } catch {
    return { ...EMPTY_PLAYER };
  }
}

export function savePlayerProfile(profile: PlayerProfile): boolean {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

export function playerFilled(profile: PlayerProfile): boolean {
  return Boolean(profile.name || profile.alias || profile.appearance || profile.personality || profile.background || profile.relation);
}

/** 单段式档案，供 {{player}} 与系统提示词兜底使用。 */
export function playerSummary(profile: PlayerProfile = loadPlayerProfile()): string {
  if (!playerFilled(profile)) return '';
  const lines: string[] = [];
  const title = profile.alias ? `${profile.name || '委托人'}（${profile.alias}）` : (profile.name || '委托人');
  lines.push(`委托人：${title}${profile.pronoun ? `，称呼「${profile.pronoun}」` : ''}`);
  if (profile.appearance) lines.push(`外貌：${profile.appearance}`);
  if (profile.personality) lines.push(`性格：${profile.personality}`);
  if (profile.background) lines.push(`背景：${profile.background}`);
  if (profile.relation) lines.push(`与事务所的关系：${profile.relation}`);
  return lines.join('\n');
}

function readCrop(raw: unknown): { zoom: number; x: number; y: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const crop = raw as Record<string, unknown>;
  const zoom = Number(crop.zoom);
  const x = Number(crop.x);
  const y = Number(crop.y);
  if (![zoom, x, y].every(value => Number.isFinite(value))) return undefined;
  return { zoom: Math.min(4, Math.max(0.5, zoom)), x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

function readExpressions(raw: unknown): Partial<Record<Expression, string>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<Expression, string>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isExpression(key) || !isExpressionVariantData(value)) continue;
    out[key] = value;
  }
  return out;
}

function isExpression(value: string): value is Expression {
  return (EXPRESSIONS_FOR_PLAYER as readonly string[]).includes(value);
}

const EXPRESSIONS_FOR_PLAYER = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'] as const;

/** 给定表情该显示哪张图：没这张差分就回落到主立绘，再没有就空串（界面上画剪影）。 */
export function directorPortraitOf(profile: PlayerProfile, expression?: Expression): string {
  if (expression && profile.expressions?.[expression]) return profile.expressions[expression]!;
  if (profile.portrait) return profile.portrait;
  return expression ? profile.expressions?.['calm'] ?? '' : '';
}

/** 所长缺图（连主立绘都没有）。 */
export function playerPortraitMissing(profile: PlayerProfile = loadPlayerProfile()): boolean {
  if (profile.portrait) return false;
  return !Object.values(profile.expressions ?? {}).some(Boolean);
}

/** 该显示的称呼：别名优先，默认「所长」。 */
export function directorLabel(profile: PlayerProfile = loadPlayerProfile()): string {
  const alias = profile.alias?.trim();
  if (alias) return alias;
  return profile.name?.trim() ? profile.name.trim() : '所长';
}
