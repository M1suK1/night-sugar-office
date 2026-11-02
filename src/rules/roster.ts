import { loadBalance } from '../balance.ts';
import { effectiveMaxHp, effectiveStats } from '../economy.ts';
import type { GameState, Girl, Mission, Treatment } from '../types.ts';
// v35 从 src/game.ts 拆出：席位、派遣名额、门诊与记忆清除报价。

export function capacity(state: GameState): number {
  return state.rooms.filter(r => r.type === 'dorm').reduce((sum, room) => sum + room.capacity, 0);
}
/** 推一条提示到通知中心；只留最近 20 条，新的在前。 */

/** 真正占床位的在册成员：退役转文职、离队与死亡都不再占席位。 */
export function seatedGirls(state: GameState): Girl[] {
  return state.girls.filter(girl => !girl.dead && !girl.retired && !girl.left);
}

export function seatsTaken(state: GameState): number {
  return seatedGirls(state).length;
}

export function buildCost(room: { level: number }): number {
  return 2400 * Math.max(1, room.level);
}

export function chance(girl: Girl, mission: Mission): number {
  const stats = effectiveStats(girl);
  return Math.max(35, Math.min(99, Math.round(70 + (stats[mission.requirement] - mission.target) * 0.65 - girl.fatigue * 0.15)));
}

export function squadLimit(mission: Mission): number {
  const cap = loadBalance().squadLimit;
  return mission.work === 'combat' ? cap : Math.max(1, Math.min(cap, 2));
}

export function squadChance(girls: Girl[], mission: Mission): number {
  if (!girls.length) return 0;
  const best = Math.max(...girls.map(g => effectiveStats(g)[mission.requirement]));
  const bonus = (girls.length - 1) * 4;
  const fatigue = Math.round(girls.reduce((sum, g) => sum + g.fatigue, 0) / girls.length * 0.15);
  return Math.max(20, Math.min(99, Math.round(55 + (best + bonus - mission.target) * 0.9 - fatigue)));
}

export function drugDaysLeft(girl: Girl, day: number): number {
  return Math.max(0, (girl.drugUntilDay ?? 0) - day);
}

export function inWithdrawal(girl: Girl): boolean {
  return Boolean(girl.witch && (girl.withdrawalDays ?? 0) > 0);
}

/** 记忆清除：只清一条精神疤痕，不动等级。 */
export const MEMORY_CLEAR_COST = 1200;

export interface ClinicQuote { missing: number; cost: number; minutes: number; perHour: number; maxMinutes: number; kink: boolean }

/**
 * 诊所报价。
 * 普通治疗：按缺失血量收费，半小时一档向上取整（12 点/小时 → 30 分钟恢复 6 点），最长 5 小时。
 * 治疗癖好：与血量无关，固定 2 小时、单独收费。
 */

/**
 * 诊所报价。
 * 普通治疗：按缺失血量收费，半小时一档向上取整（12 点/小时 → 30 分钟恢复 6 点），最长 5 小时。
 * 治疗癖好：与血量无关，固定 2 小时、单独收费。
 */
export function clinicQuote(girl: Girl, kink = false): ClinicQuote {
  const balance = loadBalance();
  const missing = Math.max(0, effectiveMaxHp(girl) - girl.hp);
  if (kink) {
    return { missing, cost: balance.clinicKinkFee, minutes: 120, perHour: 0, maxMinutes: 120, kink: true };
  }
  const raw = Math.ceil((missing / Math.max(1, balance.clinicHpPerHour)) * 60);
  const minutes = Math.min(300, Math.max(30, Math.ceil(raw / 30) * 30));
  return { missing, cost: balance.clinicBase + missing * balance.clinicPerHp, minutes, perHour: balance.clinicHpPerHour, maxMinutes: 300, kink: false };
}
/** 正在进行的治疗；没有则返回 undefined。 */

/** 正在进行的治疗；没有则返回 undefined。 */
export function treatmentFor(state: GameState, girlId: string): Treatment | undefined {
  return state.treatments.find(item => item.girlId === girlId);
}
/** 辖区环境在结算时的统一修正：疲劳、精神力。声望在各自分支里结算。 */
