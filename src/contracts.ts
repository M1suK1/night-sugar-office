import type { Girl } from './types';

export const CONTRACT_DAYS = 10;
export const REMOTE_CALL_COST = 40;

export function pensionFor(girl: Girl): number {
  return Math.round(240 + girl.level * 160);
}
export function renewalCost(girl: Girl): number {
  return Math.round(800 + girl.level * 220 + Math.max(0, girl.bond) * 8);
}
export function pensionArrears(girl: Girl): number {
  return Math.max(0, girl.pensionMissed) * pensionFor(girl);
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
