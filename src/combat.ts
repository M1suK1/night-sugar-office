import type { ActiveEffect, BattleEvent, BattleState, BattleUnit, Girl, Mission, Scar, Skill, StatKey } from './types';
import { getSkill } from './content/skills.ts';
import { getMonster } from './content/monsters.ts';

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
  return hashText(`${mission.id}|${girls.map(g => g.id).sort().join(',')}|${day}|${minutes}|${mission.attempts}`);
}
export function addClock(day: number, minutes: number, add: number): { day: number; minutes: number } {
  const total = minutes + add;
  return { day: day + Math.floor(total / 1440), minutes: ((total % 1440) + 1440) % 1440 };
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
function initiativeOf(unit: BattleUnit, roll: number): number {
  const bonus = unit.effects.reduce((sum, e) => sum + (e.stat === 'initiative' && e.kind === 'buff' ? e.amount : 0), 0);
  return statOf(unit, 'insight') + roll + bonus;
}
function unitFromGirl(girl: Girl, _index: number): BattleUnit {
  const maxSpirit = spiritMax(girl);
  return {
    uid: `ally-${girl.id}`, side: 'ally', name: girl.name, portrait: girl.portrait, color: girl.color,
    hp: clamp(0, girl.maxHp, girl.hp), maxHp: girl.maxHp, spirit: maxSpirit, maxSpirit,
    stats: { ...girl.stats }, skills: [...girl.skills], cooldown: {}, effects: [], down: false,
    insightRoll: 0, scarHit: girl.scars.reduce((s, scar) => s + (scar.effect.kind === 'hit' ? scar.effect.amount : 0), 0),
    dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
  };
}
function unitFromMonster(id: string, index: number, wounded: boolean): BattleUnit {
  const monster = getMonster(id);
  const scale = wounded ? 0.8 : 1;
  const maxHp = Math.round(monster.maxHp * scale);
  return {
    uid: `enemy-${index}-${monster.id}`, side: 'enemy', name: monster.name, portrait: monster.id, color: monster.color,
    hp: maxHp, maxHp, spirit: Math.round(monster.maxSpirit * scale), maxSpirit: Math.round(monster.maxSpirit * scale),
    stats: { ...monster.stats }, skills: [...monster.skillIds], cooldown: {}, effects: [], down: false,
    insightRoll: 0, scarHit: 0, dealt: 0, taken: 0, healed: 0, controlled: 0, kills: 0,
  };
}
function alive(units: BattleUnit[], side: 'ally' | 'enemy'): BattleUnit[] {
  return units.filter(u => u.side === side && !u.down && u.hp > 0 && u.spirit > 0);
}
function pickSkill(unit: BattleUnit, round: number, rng: () => number): Skill {
  const usable = unit.skills.map(getSkill).filter(s => (unit.cooldown[s.id] ?? 0) <= 0 && (s.tier !== 'ultimate' || round >= 2));
  const pool = usable.length ? usable : unit.skills.map(getSkill).filter(s => s.tier !== 'ultimate');
  const finalPool = pool.length ? pool : [getSkill(unit.skills[0])];
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
}
export function simulateBattle(setup: BattleSetup): BattleState {
  const { mission, girls, day, minutes } = setup;
  const seed = battleSeed(mission, girls, day, minutes);
  const rng = seededRandom(seed);
  const rounds = mission.rounds ?? Math.max(2, Math.floor(mission.duration / ROUND_MINUTES));
  const units = [
    ...girls.map(unitFromGirl),
    ...(mission.enemyIds ?? []).map((id, index) => unitFromMonster(id, index, setup.woundedEnemies ?? false)),
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
      // 魔物特性：糖王再生、空月越伤越强、末班车逐轮加速。
      if (unit.portrait === 'candy-king' && unit.hp > 0 && unit.hp < unit.maxHp) {
        const heal = Math.min(6, unit.maxHp - unit.hp);
        unit.hp += heal;
        log({ round, actor: unit.name, skillId: 'trait', skillName: '糖分再生', targets: [unit.name], hit: true, resource: 'hp', amount: heal, note: `王座补给了 ${heal} 点血量` });
      }
      if (unit.portrait === 'hollow-moon' && unit.hp < unit.maxHp / 2) {
        addEffect(unit, { kind: 'buff', stat: 'magic', amount: 8, duration: 99, source: '空月' });
      }
      if (unit.portrait === 'night-tram' && round > 1 && !unit.effects.some(e => e.kind === 'stun') && unit.stats.agility < 140) {
        unit.stats.agility += 4;
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
        const hit = skill.side !== 'enemy' || rng() * 100 <= clamp(15, 95, 50 + statOf(unit, 'agility') - statOf(target, 'agility') + hitBonus(unit));
        if (!hit) {
          log({ round, actor: unit.name, skillId: skill.id, skillName: skill.name, targets: [target.name], hit: false, note: '攻击落空' });
          continue;
        }
        if (skill.side === 'enemy') {
          const amount = Math.max(1, Math.round(statOf(unit, 'magic') * skill.power * (0.9 + rng() * 0.2) * (target.portrait === 'mirror-nun' ? 0.85 : 1)));
          const dealt = skill.resource === 'spirit' ? Math.min(target.spirit, amount) : Math.min(target.hp, absorb(target, amount));
          if (skill.resource === 'spirit') target.spirit -= dealt;
          else {
            target.hp -= dealt;
            target.taken += dealt;
            unit.dealt += dealt;
          }
          log({ round, actor: unit.name, skillId: skill.id, skillName: skill.name, targets: [target.name], hit: true, resource: skill.resource, amount: dealt, note: `${target.name}的${skill.resource === 'hp' ? '血量' : '共情值'} ${dealt}` });
          if (target.portrait === 'echo-cat') addEffect(unit, { kind: 'debuff', stat: 'hit', amount: 4, duration: 2, source: '回声' });
          if (target.portrait === 'sugar-moth') addEffect(unit, { kind: 'dot', amount: 6, duration: 1, source: '鳞粉' });
          if (target.hp <= 0 || target.spirit <= 0) {
            target.down = true;
            unit.kills += 1;
          }
        } else {
          const heal = Math.round(statOf(unit, 'magic') * skill.power * 0.5);
          const real = Math.min(target.maxHp - target.hp, heal);
          target.hp += real;
          unit.healed += real;
          if (real > 0) log({ round, actor: unit.name, skillId: skill.id, skillName: skill.name, targets: [target.name], hit: true, resource: 'hp', amount: real, note: `为 ${target.name} 恢复 ${real} 点血量` });
        }
        for (const effect of skill.effects) {
          if (effect.chance && rng() > effect.chance) continue;
          if (effect.kind === 'stun' && target.portrait === 'hollow-moon') continue;
          if (skill.side === 'enemy' && target.down && effect.kind !== 'dot') continue;
          addEffect(target, { ...effect, source: skill.name, remaining: effect.duration });
          effectNotes.push(effect.kind);
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
