import { contractPriceFor } from './rules/roster.ts';
import type { Girl } from './types';

export const CONTRACT_DAYS = 10;
export const REMOTE_CALL_COST = 40;

/** 退休金整体倍率：v185 从 1 下调到 0.5，日划拨、欠缴与续签共用这一个口径。 */
const PENSION_SCALE = 0.5;

export function pensionFor(girl: Girl): number {
  return Math.round((240 + girl.level * 160) * PENSION_SCALE);
}
/** 每日退休金划拨与欠约单价：pensionFor 是每 10 日总额，日单价统一折算为 1/10。 */
export function dailyPensionFor(girl: Girl): number {
  return Math.max(1, Math.round(pensionFor(girl) / 10));
}
/**
 * 续约价：契约总价的一半（含技能溢价），下限 150 星砂。
 * 契约价改过之后这里必须跟着走，否则续约比重新签还贵。
 */
export function renewalCost(girl: Girl): number {
  return Math.max(150, Math.round(contractPriceFor(girl) / 2));
}
export function pensionArrears(girl: Girl): number {
  return Math.max(0, girl.pensionMissed) * dailyPensionFor(girl);
}
export function contractLabel(girl: Girl, day: number): string {
  if (girl.retired) return '退休中';
  const left = girl.contractEndDay - day;
  if (left < 0) return `欠约 ${-left} 日`;
  if (left === 0) return '今日到期';
  return `剩余 ${left} 日`;
}
export function contractStatus(girl: Girl, day: number): 'active' | 'expiring' | 'expired' {
  if (girl.contractEndDay - day < 0) return 'expired';
  if (girl.contractEndDay - day <= 2) return 'expiring';
  return 'active';
}
export function appliedTraits(girl: Girl): string[] {
  return girl.traits.map(trait => trait.name);
}
