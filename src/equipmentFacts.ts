import { findEquipmentSet } from './content/sets.ts';
import { tierOf } from './items.ts';
import { statLabels } from './rules/labels.ts';
import type { Affix, AffixKind, Equipment, StatKey } from './types.ts';

/** 精炼词条的方向 → 中文短标签。 */
export const AFFIX_KIND_LABELS: Record<AffixKind, string> = {
  magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情',
  damageReduce: '减伤', maxHp: '生命', initiative: '先手', damageBonus: '增伤',
};

export interface EquipmentFact { label: string; value: string }
export interface AffixFact { name: string; detail: string }

/** 装备的基础加成，一条一行：魔力 +3、生命 +12、增伤 +5%…… */
export function equipmentFacts(item: Equipment): EquipmentFact[] {
  const facts: EquipmentFact[] = [];
  for (const [key, value] of Object.entries(item.stats ?? {}) as [StatKey, number | undefined][]) {
    if (!value) continue;
    facts.push({ label: statLabels[key] ?? key, value: `+${value}` });
  }
  if (item.maxHpBonus) facts.push({ label: '生命', value: `+${item.maxHpBonus}` });
  if (item.spiritBonusPct) facts.push({ label: '心防', value: `+${item.spiritBonusPct}%` });
  if (item.damageBonus) facts.push({ label: '增伤', value: `+${item.damageBonus}%` });
  if (item.initiativeBonus) facts.push({ label: '先手', value: `+${item.initiativeBonus}` });
  return facts;
}

/** 一条词条怎么念：名称（含阶级）+ 加成。 */
export function affixFact(affix: Affix): AffixFact {
  const percent = affix.kind === 'damageReduce' || affix.kind === 'damageBonus';
  return {
    name: affix.name,
    detail: `${AFFIX_KIND_LABELS[affix.kind] ?? affix.kind} +${affix.amount}${percent ? '%' : ''}`,
  };
}

/** 装备所属套装；没有或认不出来就返回 undefined。 */
export function equipmentSetOf(item: Equipment) {
  return findEquipmentSet(item.setId);
}

/** 槽位与阶级的一行摘要：法器 · 四阶。 */
export function equipmentTierLabel(item: Equipment): string {
  const slot = item.slot === 'weapon' ? '法器' : item.slot === 'charm' ? '护符' : '物资';
  return `${slot} · ${['一', '二', '三', '四', '五'][tierOf(item) - 1]}阶`;
}
