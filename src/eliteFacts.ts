import type { MonsterRule } from './types.ts';
import { findSkill } from './content/skills.ts';

const STAT_LABEL: Record<string, string> = {
  magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情', hit: '命中',
};

const statLabel = (stat?: string): string => STAT_LABEL[stat ?? 'magic'] ?? '状态';

/** 精英规则 → 图鉴里能读懂的一行。 */
export function eliteRuleText(rule: MonsterRule): string {
  const trigger = rule.trigger === 'roundStart' ? '每轮开始' : rule.trigger === 'hit' ? '被击中时' : '常驻';
  const lowHp = rule.belowHpPct !== undefined && rule.belowHpPct < 1 ? `生命低于 ${Math.round(rule.belowHpPct * 100)}% 时，` : '';
  const duration = rule.duration && rule.duration > 0 && rule.duration < 90 ? `，持续 ${rule.duration} 轮` : '';
  switch (rule.effect) {
    case 'heal': return `${trigger}回复 ${rule.amount ?? 0} 点生命`;
    case 'buff': return `${lowHp}${trigger}${statLabel(rule.stat)} +${rule.amount ?? 0}${duration}`;
    case 'haste': return '第 2 轮起每轮 +' + (rule.amount ?? 0) + ' 敏捷';
    case 'debuffAttacker': return `被击中时使攻击者${statLabel(rule.stat)} −${rule.amount ?? 0}${duration}`;
    case 'dot': return `${trigger}施加 ${rule.amount ?? 0} 点持续伤害${duration}`;
    case 'immuneStun': return '免疫眩晕';
    case 'damageReduce': return `受到的伤害降低 ${rule.amount ?? 0}%`;
    default: return rule.effect;
  }
}

/** 附带技能 → 技能名 + 一句说明；查不到时退回 id，不让图鉴空着。 */
export function eliteSkillText(id: string): string {
  const skill = findSkill(id);
  return skill ? `${skill.name}：${skill.description}` : id;
}
