import type { ActiveEffect, BattleEvent, BattleState, BattleUnit, Girl, Mission, MonsterRule, MonsterTemplate, Scar, Skill, StatKey } from './types';
import { effectKindLabels, findSkill, getSkill } from './content/skills.ts';
import { findMonster } from './content/monsters.ts';
import { effectiveMaxHp, effectiveMaxSpirit, effectiveStats, equipmentOf } from './economy.ts';
import { districtAt, districts } from './districts.ts';
import { SHIFT_START } from './shift.ts';

export const ROUND_MINUTES = 15;
const clamp = (min: number, max: number, v: number) => Math.max(min, Math.min(max, v));

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
export function battleSeed(mission: Mission, girls: Girl[], day: number, minutes: number): number {
  // 不把具体分钟算进种子：同一夜、同一编队、同一份委托不应因为几点出发而变成另一场战斗。
  void minutes;
  return hashText(`${mission.id}|${girls.map(g => g.id).sort().join(',')}|${day}|${mission.attempts}`);
}
export function addClock(day: number, minutes: number, add: number): { day: number; minutes: number } {
  const to = day * 1440 + minutes + add;
  const nextDay = Math.floor((to - SHIFT_START) / 1440);
  return { day: nextDay, minutes: to - nextDay * 1440 };
}
export function spiritMax(girl: Girl): number {
  const scarPenalty = girl.scars.reduce((sum, s) => sum + (s.effect.kind === 'maxSpirit' ? Math.abs(s.effect.amount) : 0), 0);
  return clamp(40, 160, Math.round(60 + girl.stats.empathy * 0.6 - girl.fatigue * 0.2) - scarPenalty);
}

function statOf(unit: BattleUnit, key: StatKey): number {
  let value = unit.stats[key] ?? 0;
  for (const effect of unit.effects) {
    if (effect.stat !== key) continue;
    if (effect.kind === 'buff') value += effect.amount;
    if (effect.kind === 'debuff') value -= effect.amount;
  }
  return clamp(0, 220, value);
}
function hitBonus(unit: BattleUnit): number {
  return unit.scarHit + unit.effects.reduce((sum, e) => sum + (e.stat === 'hit' && e.kind === 'buff' ? e.amount : 0) - (e.stat === 'hit' && e.kind === 'debuff' ? e.amount : 0), 0);
}
export function initiativeOf(unit: BattleUnit, roll: number): number {
  const bonus = unit.effects.reduce((sum, e) => sum + (e.stat === 'initiative' ? (e.kind === 'buff' ? e.amount : e.kind === 'debuff' ? -e.amount : 0) : 0), 0);
  return statOf(unit, 'insight') + roll + bonus + (unit.initiativeBonus ?? 0);
}
function unitFromGirl(girl: Girl, _index: number): BattleUnit {
  const maxSpirit = effectiveMaxSpirit(girl);
  const gear = equipmentOf(girl);
  const extraSkills = gear.map(item => item.skillId).filter((id): id is string => Boolean(id));
  return {
    uid: `ally-${girl.id}`, side: 'ally', name: girl.name, portrait: girl.portrait, color: girl.color,
    girlId: girl.id, codename: girl.codename, expression: girl.expression, portraitSpec: girl.portraitSpec,
    hp: clamp(0, effectiveMaxHp(girl), girl.hp), maxHp: effectiveMaxHp(girl), spirit: maxSpirit, maxSpirit,
    stats: effectiveStats(girl), skills: [...new Set([...girl.skills, ...extraSkills])], cooldown: {}, effects: [], down: false,
    insightRoll: 0, scarHit: girl.scars.reduce((s, scar) => s + (scar.effect.kind === 'hit' ? scar.effect.amount : 0), 0),
    dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
    damageBonus: gear.reduce((sum, item) => sum + (item.damageBonus ?? 0), 0),
    initiativeBonus: gear.reduce((sum, item) => sum + (item.initiativeBonus ?? 0), 0),
  };
}
function unitFromMonster(id: string, index: number, wounded: boolean, pool: MonsterTemplate[] = [], hpPct = 0): BattleUnit {
  const monster = pool.find(m => m.id === id) ?? findMonster(id);
  const scale = (wounded ? 0.8 : 1) * Math.max(0.4, 1 + hpPct / 100);
  if (!monster) {
    // 内容被删掉或存档引用了不存在的魔物：显示为残影，而不是冒充第一只魔物。
    return {
      uid: `enemy-${index}-missing`, side: 'enemy', name: `未知魔物（${id}）`, portrait: id, color: '#6f6678',
      hp: 1, maxHp: 1, spirit: 1, maxSpirit: 1,
      stats: { magic: 10, insight: 10, agility: 10, empathy: 10 }, skills: ['monster-claw'],
      cooldown: {}, effects: [], down: false, insightRoll: 0, scarHit: 0,
      dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
    };
  }
  const maxHp = Math.round(monster.maxHp * scale);
  return {
    uid: `enemy-${index}-${monster.id}`, side: 'enemy', name: monster.name, portrait: monster.id, color: monster.color,
    hp: maxHp, maxHp, spirit: Math.round(monster.maxSpirit * scale), maxSpirit: Math.round(monster.maxSpirit * scale),
    stats: { ...monster.stats }, skills: [...monster.skillIds], cooldown: {}, effects: [], down: false,
    insightRoll: 0, scarHit: 0, dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0, monster,
  };
}
function alive(units: BattleUnit[], side: 'ally' | 'enemy'): BattleUnit[] {
  return units.filter(u => u.side === side && !u.down && u.hp > 0 && u.spirit > 0);
}
function pickSkill(unit: BattleUnit, round: number, rng: () => number): Skill {
  const known = unit.skills.map(findSkill).filter((skill): skill is Skill => Boolean(skill));
  const usable = known.filter(s => (unit.cooldown[s.id] ?? 0) <= 0 && (s.tier !== 'ultimate' || round >= 2));
  const pool = usable.length ? usable : known.filter(s => s.tier !== 'ultimate');
  const finalPool = pool.length ? pool : [known[0] ?? getSkill(unit.skills[0] ?? 'monster-claw')];
  const weights = finalPool.map(s => s.tier === 'basic' ? 55 : s.tier === 'signature' ? 30 : 15);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < finalPool.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return finalPool[i];
  }
  return finalPool[finalPool.length - 1];
}
function pickTargets(actor: BattleUnit, skill: Skill, units: BattleUnit[], rng: () => number): BattleUnit[] {
  if (skill.side === 'self') return [actor];
  if (skill.side === 'ally') {
    const pool = alive(units, actor.side).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    return pool.slice(0, Math.min(skill.targets, pool.length));
  }
  const pool = alive(units, actor.side === 'ally' ? 'enemy' : 'ally');
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(skill.targets, pool.length));
}
function absorb(unit: BattleUnit, amount: number): number {
  let left = amount;
  for (const effect of unit.effects) {
    if (effect.kind !== 'shield' || left <= 0) continue;
    const used = Math.min(effect.amount, left);
    effect.amount -= used;
    left -= used;
  }
  unit.effects = unit.effects.filter(e => e.kind !== 'shield' || e.amount > 0);
  return left;
}
function addEffect(unit: BattleUnit, effect: Omit<ActiveEffect, 'remaining'> & { remaining?: number }): void {
  const existing = unit.effects.find(e => e.kind === effect.kind && e.stat === effect.stat && e.source === effect.source);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, effect.remaining ?? effect.duration);
    existing.amount = Math.max(existing.amount, effect.amount);
    return;
  }
  unit.effects.push({ ...effect, remaining: effect.remaining ?? effect.duration });
}
function rulesOf(unit: BattleUnit): MonsterRule[] {
  return unit.monster?.rules ?? [];
}
function damageReduction(unit: BattleUnit): number {
  const pct = rulesOf(unit)
    .filter(rule => rule.trigger === 'always' && rule.effect === 'damageReduce')
    .reduce((sum, rule) => sum + (rule.amount ?? 0), 0);
  return clamp(0, 0.9, pct / 100);
}
export const scarCatalog: Omit<Scar, 'id' | 'gainedAt' | 'missionId' | 'maxHpLoss' | 'fatal'>[] = [
  { name: '创伤后夜惊', kind: 'mental', condition: '每晚惊醒三次以上', description: '她不再关灯睡觉。城市的任何一声汽笛，都会让她先摸向枕边的武器。', effect: { kind: 'fatigueRecovery', amount: -8 } },
  { name: '幻听', kind: 'mental', condition: '持续听见不存在的委托提示音', description: '有时她会突然停下，侧耳听很久，然后说「没什么」。', effect: { kind: 'stat', stat: 'insight', amount: -7 } },
  { name: '失语', kind: 'mental', condition: '情绪激动时无法说话', description: '她把想说的话写在便签上，贴在冰箱门。最多的一张写了十七遍「对不起」。', effect: { kind: 'stat', stat: 'empathy', amount: -8 } },
  { name: '解离', kind: 'mental', condition: '战斗中短暂失去现实感', description: '她说那几秒像隔着一层玻璃看自己。手还在动，但不知道是谁在动。', effect: { kind: 'initiative', amount: -8 } },
  { name: '强迫性清点', kind: 'mental', condition: '反复确认人数与门锁', description: '出勤前要点三次名。如果少一个，她会把整栋楼找一遍。', effect: { kind: 'stat', stat: 'agility', amount: -6 } },
  { name: '跛行', kind: 'physical', condition: '左膝旧伤，长距离移动受限', description: '阴雨天会更明显。她坚持说自己只是走得慢一点。', effect: { kind: 'stat', stat: 'agility', amount: -9 } },
  { name: '陈旧性骨折', kind: 'physical', condition: '肋骨愈合不良，不能长时间战斗', description: '影像片上有一道没对齐的缝。她把片子折起来，夹进乐谱。', effect: { kind: 'maxSpirit', amount: -10 } },
  { name: '手部震颤', kind: 'physical', condition: '精细动作与瞄准受影响', description: '她开始用双手握杯。没人问，她也就不解释。', effect: { kind: 'stat', stat: 'magic', amount: -7 } },
  { name: '视力受损', kind: 'physical', condition: '右眼视野缺损', description: '她把站位固定成左侧朝敌。说是习惯，其实是看不见右边。', effect: { kind: 'hit', amount: -9 } },
  { name: '耳鸣', kind: 'physical', condition: '高频听力永久下降', description: '安静的时候最响。她学会了看别人的口型。', effect: { kind: 'stat', stat: 'insight', amount: -6 } },
];
export function makeScar(girl: Girl, mission: Mission, rng: () => number, at: string, fatal: boolean): Scar {
  const base = scarCatalog[Math.floor(rng() * scarCatalog.length)];
  return {
    id: `scar-${girl.id}-${Date.now().toString(36)}-${Math.floor(rng() * 9999).toString(36)}`,
    name: base.name, kind: base.kind, condition: base.condition, description: base.description,
    effect: { ...base.effect }, maxHpLoss: Math.round(girl.baseMaxHp * 0.08),
    gainedAt: at, missionId: mission.id, fatal,
  };
}

export interface BattleSetup {
  mission: Mission;
  girls: Girl[];
  day: number;
  minutes: number;
  woundedEnemies?: boolean;
  monsters?: MonsterTemplate[];
}
export function simulateBattle(setup: BattleSetup): BattleState {
  const { mission, girls, day, minutes } = setup;
  const seed = battleSeed(mission, girls, day, minutes);
  const rng = seededRandom(seed);
  const rounds = mission.rounds ?? Math.max(2, Math.floor(mission.duration / ROUND_MINUTES));
  const region = districts[mission.district ?? districtAt(mission.x, mission.y)];
  const env = region.effect;
  const units = [
    ...girls.map(unitFromGirl),
    ...(mission.enemyIds ?? []).map((id, index) => unitFromMonster(id, index, setup.woundedEnemies ?? false, setup.monsters ?? [], env.enemyHpPct ?? 0)),
  ];
  const startedAt = { day, minutes };
  const state: BattleState = {
    id: `b-${mission.id}-${day}-${minutes}-${seed.toString(16)}`, missionId: mission.id, missionTitle: mission.title, seed,
    startedAt, round: 0, rounds, units, initiative: [], events: [], createdAt: new Date().toISOString(),
  };
  const log = (event: Omit<BattleEvent, 'at'>) => state.events.push({ ...event, at: addClock(day, minutes, (event.round - 1) * ROUND_MINUTES) });
  const snapshot = () => {
    (state.frames ??= []).push({
      round: state.round, initiative: [...state.initiative],
      units: units.map(u => ({ ...u, stats: { ...u.stats }, skills: [...u.skills], cooldown: { ...u.cooldown }, effects: u.effects.map(e => ({ ...e })) })),
    });
  };
  const outcomeNow = (): BattleState['outcome'] | undefined => {
    if (!alive(units, 'enemy').length) return 'victory';
    if (!alive(units, 'ally').length) return 'defeat';
    return undefined;
  };
  let empathyPrev = new Set<string>();
  let empathyThisRound = new Set<string>();
  for (let round = 1; round <= rounds; round++) {
    state.round = round;
    for (const unit of units) {
      if (unit.down) continue;
      for (const effect of unit.effects) {
        if (effect.kind === 'dot') {
          const amount = Math.min(unit.hp, effect.amount);
          unit.hp -= amount;
          unit.taken += amount;
          log({ round, actor: effect.source, skillId: 'dot', skillName: '持续伤害', targets: [unit.name], hit: true, resource: 'hp', amount, note: `受到 ${amount} 点持续伤害` });
        }
        if (effect.kind === 'regen') {
          const amount = Math.min(unit.maxHp - unit.hp, effect.amount);
          if (amount > 0) {
            unit.hp += amount;
            unit.healed += amount;
            log({ round, actor: unit.name, skillId: 'regen', skillName: '持续恢复', targets: [unit.name], hit: true, resource: 'hp', amount, note: `恢复 ${amount} 点血量` });
          }
        }
      }
      // 魔物特性：由 MonsterRule 驱动，内置魔物与自制魔物走同一条路径。
      for (const rule of rulesOf(unit)) {
        if (rule.trigger !== 'roundStart') continue;
        if (rule.unlessEmpathyDamage && empathyPrev.has(unit.uid)) continue;
        if (rule.effect === 'heal') {
          const heal = Math.min(rule.amount ?? 0, unit.maxHp - unit.hp);
          if (heal > 0) {
            unit.hp += heal;
            unit.healed += heal;
            log({ round, actor: unit.name, skillId: 'trait', skillName: '特性 · 再生', targets: [unit.name], hit: true, resource: 'hp', amount: heal, note: `特性恢复了 ${heal} 点血量` });
          }
        }
        if (rule.effect === 'buff' && unit.hp < unit.maxHp * (rule.belowHpPct ?? 1)) {
          addEffect(unit, { kind: 'buff', stat: rule.stat ?? 'magic', amount: rule.amount ?? 0, duration: 99, source: unit.name });
        }
        if (rule.effect === 'haste' && round > 1 && !unit.effects.some(e => e.kind === 'stun') && unit.stats.agility < 140) {
          unit.stats.agility += rule.amount ?? 0;
        }
      }
      for (const effect of unit.effects) if (effect.kind !== 'stun') effect.remaining -= 1;
      unit.effects = unit.effects.filter(e => e.kind === 'stun' || e.remaining > 0);
      if (unit.hp <= 0 || unit.spirit <= 0) unit.down = true;
    }
    const living = units.filter(u => !u.down);
    for (const unit of living) {
      unit.insightRoll = Math.floor(rng() * 21);
      (unit as BattleUnit & { initiative?: number }).initiative = initiativeOf(unit, unit.insightRoll);
    }
    const order = [...living].sort((a, b) => ((b as BattleUnit & { initiative?: number }).initiative ?? 0) - ((a as BattleUnit & { initiative?: number }).initiative ?? 0));
    state.initiative = order.map(u => u.uid);
    for (const unit of order) {
      if (unit.down) continue;
      const stun = unit.effects.find(e => e.kind === 'stun' && e.remaining > 0);
      if (stun) {
        stun.remaining -= 1;
        unit.effects = unit.effects.filter(e => e.remaining > 0);
        unit.controlled += 1;
        log({ round, actor: unit.name, skillId: 'stunned', skillName: '眩晕', targets: [unit.name], hit: true, note: '眩晕中，本轮无法行动' });
        continue;
      }
      const skill = pickSkill(unit, round, rng);
      unit.cooldown[skill.id] = skill.cooldown;
      const targets = pickTargets(unit, skill, units, rng);
      const effectNotes: string[] = [];
      for (const target of targets) {
        if (target.down && skill.side === 'enemy') continue;
        const agility = statOf(unit, 'agility');
        const targetAgility = statOf(target, 'agility');
        const bonus = hitBonus(unit);
        const chance = clamp(15, 95, 50 + agility - targetAgility + bonus);
        const roll = skill.side === 'enemy' ? rng() * 100 : 0;
        const hit = skill.side !== 'enemy' || roll <= chance;
        const hitCalc = { base: 50, agility, targetAgility, bonus, chance, roll };
        if (!hit) {
          log({ round, actor: unit.name, skillId: skill.id, skillName: skill.name, targets: [target.name], hit: false, note: '攻击落空', calc: { hit: hitCalc } });
          continue;
        }
        if (skill.side === 'enemy') {
          const magic = statOf(unit, 'magic');
          const variance = 0.9 + rng() * 0.2;
          const mitigation = 1 - damageReduction(target);
          // 辖区环境：本区魔物护甲、夜色加成与街道地形都会改变伤害。
          const terrain = unit.side === 'ally' ? 1 + (env.damageDealtPct ?? 0) / 100 : 1 + (env.damageTakenPct ?? 0) / 100;
          const gear = 1 + Math.max(-50, Math.min(200, unit.damageBonus ?? 0)) / 100;
          const raw = Math.max(1, Math.round(magic * skill.power * variance * mitigation * terrain * gear));
          const shield = skill.resource === 'spirit' ? 0 : Math.min(target.effects.reduce((sum, e) => sum + (e.kind === 'shield' ? e.amount : 0), 0), raw);
          const dealt = skill.resource === 'spirit' ? Math.min(target.spirit, raw) : Math.min(target.hp, absorb(target, raw));
          if (skill.resource === 'spirit') {
            target.spirit -= dealt;
            empathyThisRound.add(target.uid);
          } else {
            target.hp -= dealt;
            target.taken += dealt;
            unit.dealt += dealt;
          }
          log({ round, actor: unit.name, skillId: skill.id, skillName: skill.name, targets: [target.name], hit: true, resource: skill.resource, amount: dealt, note: `${target.name}的${skill.resource === 'hp' ? '血量' : '共情值'} ${dealt}`, calc: { hit: hitCalc, damage: { magic, power: skill.power, variance, mitigation, raw, shield, dealt } } });
          for (const rule of rulesOf(target)) {
            if (rule.trigger !== 'hit') continue;
            if (rule.effect === 'debuffAttacker') addEffect(unit, { kind: 'debuff', stat: rule.stat ?? 'hit', amount: rule.amount ?? 0, duration: rule.duration ?? 1, source: target.name });
            if (rule.effect === 'dot') addEffect(unit, { kind: 'dot', amount: rule.amount ?? 0, duration: rule.duration ?? 1, source: target.name });
          }
          if (target.hp <= 0 || target.spirit <= 0) {
            target.down = true;
            unit.kills += 1;
          }
        } else {
          const magic = statOf(unit, 'magic');
          const heal = Math.round(magic * skill.power * 0.5);
          const real = Math.min(target.maxHp - target.hp, heal);
          target.hp += real;
          unit.healed += real;
          if (real > 0) log({ round, actor: unit.name, skillId: skill.id, skillName: skill.name, targets: [target.name], hit: true, resource: 'hp', amount: real, note: `为 ${target.name} 恢复 ${real} 点血量`, calc: { heal: { magic, power: skill.power, raw: heal, capped: real } } });
        }
        for (const effect of skill.effects) {
          if (effect.chance && rng() > effect.chance) continue;
          if (effect.kind === 'stun' && rulesOf(target).some(rule => rule.effect === 'immuneStun')) continue;
          if (skill.side === 'enemy' && target.down && effect.kind !== 'dot') continue;
          addEffect(target, { ...effect, source: skill.name, remaining: effect.duration });
          effectNotes.push(effect.label ?? effectKindLabels[effect.kind]);
        }
      }
      if (effectNotes.length) {
        state.events.push({ round, at: addClock(day, minutes, (round - 1) * ROUND_MINUTES), actor: unit.name, skillId: skill.id, skillName: skill.name, targets: targets.map(t => t.name), hit: true, note: `附加效果：${[...new Set(effectNotes)].join('、')}` });
      }
      for (const u of units) if (!u.down && (u.hp <= 0 || u.spirit <= 0)) u.down = true;
      const early = outcomeNow();
      if (early) {
        state.outcome = early;
        break;
      }
    }
    empathyPrev = empathyThisRound;
    empathyThisRound = new Set<string>();
    snapshot();
    if (state.outcome) break;
    for (const unit of units) for (const id of Object.keys(unit.cooldown)) unit.cooldown[id] = Math.max(0, unit.cooldown[id] - 1);
  }
  state.outcome ??= 'repelled';  const outcome = state.outcome;
  const goldRate = outcome === 'victory' ? 1 : outcome === 'repelled' ? 0.8 : outcome === 'draw' ? 0.6 : 0;
  const exp = outcome === 'victory' ? 24 + rounds * 3 : outcome === 'repelled' ? 10 : outcome === 'draw' ? 6 : 0;
  state.rewards = { gold: Math.round(mission.reward * goldRate), exp, bond: outcome === 'victory' ? 3 : outcome === 'defeat' ? -4 : 0 };
  if (outcome === 'defeat') {
    const at = `${day} 日 ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    state.scars = [];
    for (const girl of girls) {
      const fatal = girl.scars.length + 1 >= 5;
      const scar = makeScar(girl, mission, rng, at, fatal);
      state.scars.push(scar);
      if (fatal) (state.fatal ??= []).push(girl.id);
    }
  }
  return state;
}
export function outcomeLabel(outcome?: BattleState['outcome']): string {
  return outcome === 'victory' ? '战斗胜利' : outcome === 'repelled' ? '暂时击退' : outcome === 'defeat' ? '战斗失败' : outcome === 'draw' ? '僵持收场' : '进行中';
}
export function battleSummary(state: BattleState): string {
  const enemies = state.units.filter(u => u.side === 'enemy');
  const allies = state.units.filter(u => u.side === 'ally');
  return `${allies.map(u => u.name).join('、')} 对阵 ${enemies.map(u => u.name).join('、')}，共 ${state.round} 轮。`;
}
