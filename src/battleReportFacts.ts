import type { ActiveEffect } from './types.ts';
import { findMaterial } from './content/materials.ts';

const STAT_LABEL: Record<string, string> = {
  magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情', hit: '命中', initiative: '先手',
};

/** 战斗单位卡上，状态徽章后面的数值：增益 +6、减益 −4、持续伤害 3、护盾 12。 */
export function effectValueText(effect: Pick<ActiveEffect, 'kind' | 'stat' | 'amount'>): string {
  const stat = effect.stat ? ` ${STAT_LABEL[effect.stat] ?? effect.stat}` : '';
  if (effect.kind === 'stun') return '';
  const amount = effect.kind === 'buff' ? ` +${effect.amount}` : effect.kind === 'debuff' ? ` −${effect.amount}` : ` ${effect.amount}`;
  return `${stat}${amount}`.trim();
}

export interface ReportMaterialEntry {
  id: string;
  name: string;
  color: string;
  count: number;
}

/** 战报里的材料奖励：查得到名字就用名字，查不到退回 id，不让一整块空着。 */
export function materialEntries(materials?: Record<string, number>): ReportMaterialEntry[] {
  return Object.entries(materials ?? {}).map(([id, count]) => {
    const material = findMaterial(id);
    return { id, name: material?.name ?? id, color: material?.color ?? '#d9b68a', count };
  });
}
