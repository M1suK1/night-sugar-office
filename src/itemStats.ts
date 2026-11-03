import { skillById } from './content/skills.ts';
import { statLabel } from './progression.ts';
import type { Equipment, StatKey } from './types.ts';

/** 一行数值：label 是它改变什么，value 是改多少。 */
export interface ItemStatLine { label: string; value: string; tone?: 'good' | 'bad' }

const EFFECT_LABEL: Record<NonNullable<Equipment['effect']>, string> = {
  drug: '成瘾度',
  heal: '恢复生命',
  purify: '净化侵蚀',
  contractDiscount: '契约金折扣',
  taxRefund: '返还星砂',
};

const STAT_KEYS: StatKey[] = ['magic', 'insight', 'agility', 'empathy'];

function signed(value: number, suffix = ''): string {
  return `${value > 0 ? '+' : ''}${value}${suffix}`;
}

/**
 * 装备到底改变了什么。顺序固定：先数字（四项属性 → 心防 → 伤害 → 先手 → 效果），
 * 再被动，最后技能名——商店里最该先看到的是数字。
 */
export function itemStatLines(item: Equipment): ItemStatLine[] {
  const lines: ItemStatLine[] = [];
  for (const key of STAT_KEYS) {
    const value = item.stats?.[key];
    if (typeof value === 'number' && value !== 0) {
      lines.push({ label: statLabel[key], value: signed(value), tone: value > 0 ? 'good' : 'bad' });
    }
  }
  if (item.maxHpBonus) lines.push({ label: '生命上限', value: signed(item.maxHpBonus), tone: item.maxHpBonus > 0 ? 'good' : 'bad' });
  if (item.spiritBonusPct) lines.push({ label: '心防上限', value: signed(item.spiritBonusPct, '%'), tone: item.spiritBonusPct > 0 ? 'good' : 'bad' });
  if (item.damageBonus) lines.push({ label: '伤害', value: signed(item.damageBonus, '%'), tone: item.damageBonus > 0 ? 'good' : 'bad' });
  if (item.initiativeBonus) lines.push({ label: '先手', value: signed(item.initiativeBonus), tone: item.initiativeBonus > 0 ? 'good' : 'bad' });
  if (item.effect) {
    const amount = typeof item.amount === 'number' ? item.amount : undefined;
    const suffix = item.effect === 'contractDiscount' ? '%' : '';
    lines.push({ label: EFFECT_LABEL[item.effect], value: amount === undefined ? '——' : signed(amount, suffix), tone: item.effect === 'drug' ? 'bad' : 'good' });
  }
  if (item.corruptionPerBattle) {
    lines.push({ label: '每战侵蚀', value: signed(item.corruptionPerBattle), tone: item.corruptionPerBattle > 0 ? 'bad' : 'good' });
  }
  if (item.skillId) {
    lines.push({ label: '附带技能', value: skillById.get(item.skillId)?.name ?? item.skillId });
  }
  return lines;
}

/** 卡片标题右边那一行短摘要；没有数值就返回空串。 */
export function itemEffectSummary(item: Equipment): string {
  const lines = itemStatLines(item).filter(line => line.label !== '附带技能');
  if (!lines.length) return '';
  return lines.slice(0, 3).map(line => `${line.label} ${line.value}`).join(' · ') + (lines.length > 3 ? ' …' : '');
}
