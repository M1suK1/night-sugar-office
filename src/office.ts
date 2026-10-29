/**
 * 夜糖事务所的自我介绍。
 *
 * 它不是第四个势力：不占辖区、不参与易主、没有声望与净化加成。
 * 它是一个存在于三方之间、收留任何出身的夜班机构——所以「在事务所工作」不是出身。
 *
 * 这里只放纯函数与默认值；世界书的读写留在 `worldbook.ts`，
 * 避免 `office.ts` 反过来依赖存储层或产生循环 import。
 */
import type { GameState, Girl, OfficeProfile } from './types.ts';
import { factionTagLabel } from './factions.ts';

export const OFFICE_LIMITS = { background: 180, philosophy: 120, goal: 120 } as const;

export const DEFAULT_OFFICE_PROFILE: OfficeProfile = {
  background: '夜糖事务所曾在一次没有结果的夜事后关门，直到你重新把灯点亮。它不属于任何一方，收留三方与无所属的魔法少女。',
  philosophy: '不替任何一方站队，只给愿意值夜的人一盏灯；进门以后，先问她叫什么，不问她从哪来。',
  goal: '把事务所重新开成樱雾市的中立落脚点：接委托、养伤、记录名字，也让三方愿意坐到同一张桌前。',
};

function cleanText(value: unknown, fallback: string, limit: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return fallback;
  return text.slice(0, limit);
}

/** 逐字段 trim + 限长；空串或非法类型回退该字段默认值。 */
export function sanitizeOfficeProfile(raw?: Partial<OfficeProfile> | null): OfficeProfile {
  return {
    background: cleanText(raw?.background, DEFAULT_OFFICE_PROFILE.background, OFFICE_LIMITS.background),
    philosophy: cleanText(raw?.philosophy, DEFAULT_OFFICE_PROFILE.philosophy, OFFICE_LIMITS.philosophy),
    goal: cleanText(raw?.goal, DEFAULT_OFFICE_PROFILE.goal, OFFICE_LIMITS.goal),
  };
}

/** 对外代表就是值班助理；死人或已离职的人不能继续当代表。 */
export function representativeOf(state: Pick<GameState, 'assistantId' | 'girls'>): Girl | undefined {
  if (!state.assistantId) return undefined;
  const girl = state.girls.find(g => g.id === state.assistantId);
  if (!girl || girl.dead || girl.retired) return undefined;
  return girl;
}

/** 世界书条目的正文；纯文本，不带 markdown。 */
export function officeWorldbookContent(profile: OfficeProfile, representative?: Girl): string {
  const clean = sanitizeOfficeProfile(profile);
  const lines = [
    '夜糖事务所是三方之外的中立委托机构：关闭多年后由玩家重开，收留星灯协会、市役所、月蚀庭与无所属的魔法少女。它不占辖区，不参与辖区易主，也没有声望或净化加成。',
    `背景：${clean.background}`,
    `理念：${clean.philosophy}`,
    `目标：${clean.goal}`,
  ];
  if (representative) {
    lines.push(`对外代表：${representative.name}（${representative.codename}，出身${factionTagLabel(representative.factionTag)}）；代表由值班助理兼任。`);
  } else {
    lines.push('尚未任命对外代表。');
  }
  return lines.join('\n');
}

export const OFFICE_WORLDBOOK_ID = 'office-profile';
