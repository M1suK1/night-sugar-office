/**
 * 可调数值：世界书页的「数值」页签直接改这里，保存即生效。
 * 只放真正影响结算的数字；文案与提示仍写在各模块里。
 */
export interface BalanceRules {
  /** 诊所起步价。 */
  clinicBase: number;
  /** 每缺失 1 点血量的费用。 */
  clinicPerHp: number;
  /** 带治疗癖好的附加费用。 */
  clinicKinkFee: number;
  /** 治疗每小时恢复的血量。 */
  clinicHpPerHour: number;
  /** 宿舍每小时恢复的疲劳。 */
  dormFatiguePerHour: number;
  /** 侵蚀达到多少可以显形魔女化礼装。 */
  corruptionThreshold: number;
  /** 单次派遣最多几人。 */
  squadLimit: number;
  /** 单个势力最多占几块辖区。 */
  territoryLimit: number;
  /** 长期委托最短天数。 */
  longMinDays: number;
  /** 长期委托最长天数。 */
  longMaxDays: number;
}

export const BALANCE_KEY = 'night-sugar:balance';

export const DEFAULT_BALANCE: BalanceRules = {
  clinicBase: 120,
  clinicPerHp: 9,
  clinicKinkFee: 320,
  clinicHpPerHour: 12,
  dormFatiguePerHour: 8,
  corruptionThreshold: 40,
  squadLimit: 3,
  territoryLimit: 5,
  longMinDays: 2,
  longMaxDays: 7,
};

export interface BalanceField {
  key: keyof BalanceRules;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export const BALANCE_FIELDS: BalanceField[] = [
  { key: 'clinicBase', label: '诊所起步价', hint: '每次治疗的基础费用。', min: 0, max: 2000, step: 10, unit: '星砂' },
  { key: 'clinicPerHp', label: '每点血量费用', hint: '按缺失血量累加，越重的伤越贵。', min: 0, max: 60, step: 1, unit: '星砂' },
  { key: 'clinicKinkFee', label: '治疗癖好加价', hint: '选择带癖好的治疗时额外收取。', min: 0, max: 3000, step: 10, unit: '星砂' },
  { key: 'clinicHpPerHour', label: '治疗速度', hint: '每小时恢复的血量；决定治疗占用多久。', min: 1, max: 60, step: 1, unit: '血/小时' },
  { key: 'dormFatiguePerHour', label: '宿舍恢复', hint: '宿舍每小时恢复的疲劳；影响挂机节奏。', min: 1, max: 40, step: 1, unit: '疲劳/小时' },
  { key: 'corruptionThreshold', label: '魔女化阈值', hint: '侵蚀达到该值后解锁魔女化礼装。', min: 10, max: 100, step: 5, unit: '侵蚀' },
  { key: 'squadLimit', label: '派遣上限', hint: '单个委托最多派几人。', min: 1, max: 5, step: 1, unit: '人' },
  { key: 'territoryLimit', label: '势力辖区上限', hint: '单一势力最多能占几块辖区。', min: 1, max: 9, step: 1, unit: '块' },
  { key: 'longMinDays', label: '长期委托最短', hint: '长期委托的持续天数下限。', min: 1, max: 7, step: 1, unit: '天' },
  { key: 'longMaxDays', label: '长期委托最长', hint: '长期委托的持续天数上限。', min: 1, max: 7, step: 1, unit: '天' },
];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function sanitizeBalance(raw: unknown): BalanceRules {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const next = { ...DEFAULT_BALANCE };
  for (const field of BALANCE_FIELDS) next[field.key] = clampInt(value[field.key], field.min, field.max, DEFAULT_BALANCE[field.key]);
  if (next.longMaxDays < next.longMinDays) next.longMaxDays = next.longMinDays;
  return next;
}

let cache: BalanceRules | null = null;

export function loadBalance(): BalanceRules {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    cache = raw ? sanitizeBalance(JSON.parse(raw)) : { ...DEFAULT_BALANCE };
  } catch {
    cache = { ...DEFAULT_BALANCE };
  }
  return cache;
}

export function saveBalance(rules: BalanceRules): boolean {
  const clean = sanitizeBalance(rules);
  cache = clean;
  try {
    localStorage.setItem(BALANCE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function resetBalance(): BalanceRules {
  cache = { ...DEFAULT_BALANCE };
  try { localStorage.removeItem(BALANCE_KEY); } catch { /* ignore */ }
  return { ...DEFAULT_BALANCE };
}

export function clearBalanceCache() {
  cache = null;
}

export const rules = loadBalance;
