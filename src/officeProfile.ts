import type { OfficeProfile } from './types.ts';
import { DEFAULT_OFFICE_PROFILE, sanitizeOfficeProfile } from './office.ts';

/** 事务所档案的本地默认值：只给新开局用，不跟随单个存档。 */
export const OFFICE_PROFILE_KEY = 'night-sugar:office-profile';

export function loadOfficeProfile(): OfficeProfile {
  try {
    const raw = localStorage.getItem(OFFICE_PROFILE_KEY);
    if (!raw) return { ...DEFAULT_OFFICE_PROFILE };
    return sanitizeOfficeProfile(JSON.parse(raw) as Partial<OfficeProfile>);
  } catch {
    return { ...DEFAULT_OFFICE_PROFILE };
  }
}

export function saveOfficeProfile(profile: OfficeProfile): boolean {
  try {
    localStorage.setItem(OFFICE_PROFILE_KEY, JSON.stringify(sanitizeOfficeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}
