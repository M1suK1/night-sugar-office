export interface PlayerProfile {
  name: string;
  alias: string;
  pronoun: string;
  appearance: string;
  personality: string;
  background: string;
  relation: string;
}

export const PLAYER_KEY = 'night-sugar:player-profile';

export const EMPTY_PLAYER: PlayerProfile = {
  name: '', alias: '', pronoun: '', appearance: '', personality: '', background: '', relation: '',
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
