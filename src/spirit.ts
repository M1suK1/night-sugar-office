/**
 * 共情值 = 心防条。
 *
 * 规则（v25）：
 * - 心防上限 = 面板共情 × 2（+ 装备百分比）。高共情的守护型少女因此显著更抗。
 * - 心防在：受到的血量伤害 ×0.7；共情伤害只扣心防，不碰血量。
 * - 心防归零：眩晕 1 回合，本场不再恢复；此后血量伤害回到 100%，共情伤害 ×0.7 转成血量伤害。
 * - 全队眩晕或血量归零才判负——共情归零本身不会让她倒下。
 *
 * 这里只放常量和访问器，战斗里不再各写一份判断。
 */
export const GUARD_PER_EMPATHY = 2;
export const GUARD_HP_MUL = 0.7;
export const BROKEN_SPIRIT_MUL = 0.7;
/** 心防崩了以后，护持散掉，挨打更实：血量伤害 ×1.4。 */
export const BROKEN_TAKEN_MUL = 1.4;
export const GUARD_STUN_ROUNDS = 1;
/** 装备能给到的心防百分比上限。 */
export const GUARD_BONUS_PCT_MAX = 60;

export interface GuardSubject {
  spirit: number;
  spiritBroken?: boolean;
}

/** 心防上限：共情 × 2，再按装备百分比放大。 */
export function guardMax(subject: { stats: { empathy: number } }, bonusPct = 0): number {
  const empathy = Math.max(0, subject.stats?.empathy ?? 0);
  const pct = Math.max(0, Math.min(200, bonusPct));
  return Math.max(1, Math.round(empathy * GUARD_PER_EMPATHY * (1 + pct / 100)));
}

/** 心防还在（没被打穿）。 */
export function isGuarded(subject: GuardSubject): boolean {
  return !subject.spiritBroken && subject.spirit > 0;
}

/** 血量伤害的系数：心防在 0.7，破了 1。 */
export function guardHpMul(subject: GuardSubject): number {
  return isGuarded(subject) ? GUARD_HP_MUL : 1;
}

/** 心防破了之后，共情伤害转成血量伤害的数值。 */
export function brokenSpiritDamage(raw: number): number {
  return Math.max(1, Math.round(raw * BROKEN_SPIRIT_MUL));
}

/** UI 用：心防条的状态词。 */
export function guardState(subject: GuardSubject): 'guarded' | 'broken' {
  return isGuarded(subject) ? 'guarded' : 'broken';
}

export function guardStateLabel(subject: GuardSubject): string {
  return isGuarded(subject) ? '护持中（血量伤害 −30%）' : '心防已破（血量伤害 100%）';
}
