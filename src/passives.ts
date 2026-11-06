import type { BattleUnit, PassiveSpec, Skill, StatKey } from './types';
import { findAnySkill } from './skills.ts';
import { GUARD_PER_EMPATHY } from './spirit.ts';

/** 从一组技能 id 里找出被动；最多 1 条，先到先得。 */
export function passiveSkillOf(ids: readonly string[]): Skill | undefined {
  for (const id of ids) {
    const skill = findAnySkill(id);
    if (skill?.tier === 'passive' && skill.passive) return skill;
  }
  return undefined;
}

const STAT_LABELS: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };

/** 常驻修正在建单位时结算一次：生命、心防、属性。命中/速度/伤害在战斗里按条件查。 */
export function attachPassive(unit: BattleUnit, ids: readonly string[]): void {
  const skill = passiveSkillOf(ids);
  if (!skill?.passive) return;
  unit.passive = skill;
  const always = skill.passive.always;
  if (!always) return;
  if (always.maxHpPct) {
    const mul = 1 + always.maxHpPct / 100;
    const maxHp = Math.round(unit.maxHp * mul);
    unit.hp = Math.min(maxHp, Math.round(unit.hp * mul));
    unit.maxHp = maxHp;
  }
  if (always.guardPct) {
    const mul = 1 + always.guardPct / 100;
    const maxSpirit = Math.round(unit.maxSpirit * mul);
    unit.spirit = Math.min(maxSpirit, Math.round(unit.spirit * mul));
    unit.maxSpirit = maxSpirit;
  }
  if (always.stats) {
    for (const key of Object.keys(always.stats) as StatKey[]) unit.stats[key] += always.stats[key] ?? 0;
    // 共情就是心防：加共情时把上限与当前值一起抬起来，否则这项数值等于没加。
    const empathy = always.stats.empathy ?? 0;
    if (empathy) {
      const gain = empathy * GUARD_PER_EMPATHY;
      unit.maxSpirit += gain;
      unit.spirit = Math.min(unit.maxSpirit, unit.spirit + gain);
    }
  }
}

function alwaysOf(unit: BattleUnit): PassiveSpec['always'] | undefined {
  return unit.passive?.passive?.always;
}

/** 命中修正（百分比点）。 */
export function passiveHitBonus(unit: BattleUnit): number {
  return alwaysOf(unit)?.hit ?? 0;
}

/** 先手修正，加在速度上。 */
export function passiveInitiativeBonus(unit: BattleUnit): number {
  return alwaysOf(unit)?.initiative ?? 0;
}

/** 伤害加成（百分比），困兽这种低血量条件在这里判断。 */
export function passiveDamageBonus(unit: BattleUnit): number {
  const always = alwaysOf(unit);
  if (!always?.damageBonus) return 0;
  if (always.belowHpPct !== undefined && unit.hp >= unit.maxHp * always.belowHpPct) return 0;
  return always.damageBonus;
}

/** 减伤（百分比转 0–1），与魔物特性叠加时由调用方夹紧。 */
export function passiveDamageReduction(unit: BattleUnit): number {
  return (alwaysOf(unit)?.damageReduce ?? 0) / 100;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

/** 档案里那一行看得懂的效果说明，和 flavor 文案分开。 */
export function passiveText(skill: Skill): string {
  const spec = skill.passive;
  if (!spec) return '';
  const parts: string[] = [];
  const always = spec.always;
  if (always) {
    if (always.hit) parts.push(`命中 ${signed(always.hit)}`);
    if (always.initiative) parts.push(`速度 ${signed(always.initiative)}`);
    if (always.damageBonus) parts.push(`伤害 ${signed(always.damageBonus)}%`);
    if (always.damageReduce) parts.push(`减伤 ${always.damageReduce}%`);
    if (always.maxHpPct) parts.push(`生命上限 +${always.maxHpPct}%`);
    if (always.guardPct) parts.push(`心防上限 +${always.guardPct}%`);
    if (always.stats) {
      for (const key of Object.keys(always.stats) as StatKey[]) {
        const amount = always.stats[key];
        if (amount) parts.push(`${STAT_LABELS[key]} ${signed(amount)}`);
      }
    }
    if (always.belowHpPct !== undefined) parts.push(`血量低于 ${Math.round(always.belowHpPct * 100)}% 时`);
  }
  const trigger = spec.trigger;
  if (trigger) {
    const when = { battleStart: '开场', roundStart: '每轮开始', onHit: '命中时', onHurt: '受击时', onKill: '击杀时' }[trigger.on];
    const who = { self: '自身', allies: '我方全员', attacker: '攻击者', target: '目标' }[trigger.target];
    const effect = trigger.effect;
    const amount = effect.amount ? ` ${effect.amount}` : '';
    const duration = effect.duration ? `，${effect.duration} 轮` : '';
    const stat = effect.stat ? (effect.stat === 'hit' ? '命中' : effect.stat === 'initiative' ? '速度' : STAT_LABELS[effect.stat]) : '';
    const verb = effect.kind === 'shield' ? '获得护盾'
      : effect.kind === 'regen' ? '回复'
      : effect.kind === 'dot' ? '获得持续伤害'
      : effect.kind === 'stun' ? '眩晕'
      : effect.kind === 'debuff' ? `降低${stat}`
      : effect.kind === 'buff' ? `提升${stat}`
      : '受到影响';
    parts.push(`${when}：${who}${verb}${amount}${duration}`);
    if (trigger.belowHpPct !== undefined) parts.push(`血量低于 ${Math.round(trigger.belowHpPct * 100)}% 时`);
    if (trigger.maxUses === 1) parts.push('每场 1 次');
    else if (trigger.maxUses) parts.push(`每场 ${trigger.maxUses} 次`);
    else if (trigger.oncePerRound) parts.push('每轮 1 次');
  }
  return parts.join(' · ');
}
