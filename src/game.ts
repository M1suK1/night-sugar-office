import type { ActionResult, BattleState, ContentPack, GameAction, GameState, Girl, Log, Mission, Sample, Scar, StatKey } from './types';
import { createSeedPack } from './content/seed-pack.ts';
import { getSkill } from './content/skills.ts';
import { simulateBattle, spiritMax, outcomeLabel, ROUND_MINUTES } from './combat.ts';

export const SAVE_KEY = 'night-sugar-office:v1';
export const statLabels: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };
export const statusLabels: Record<string, string> = { idle: '待命', mission: '派遣中', healing: '治疗中', resting: '休息中', retired: '已退役' };
export const workLabels = { combat: '战斗', investigation: '调查' } as const;
export const workDescriptions = { combat: '与魔物交战，按 15 分钟一轮自动结算。', investigation: '调查灵异现象，以队伍最高相关能力判定。' } as const;
export const stageLabels = ['厌恶', '疏离', '戒备', '平常', '亲近', '依恋', '爱意'] as const;
export const stageHints = ['她不想与你共处一室。', '她保持礼貌，也保持距离。', '她在观察你，尚未决定是否信任。', '日常相处，不近不远。', '她开始主动分享一些小事。', '她把你放进了自己的未来。', '她愿意把最脆弱的部分交给你。'] as const;
export function relationshipStage(score: number): number {
  const value = Math.max(0, Math.min(100, score));
  if (value < 10) return 0;
  if (value < 25) return 1;
  if (value < 40) return 2;
  if (value < 55) return 3;
  if (value < 70) return 4;
  if (value < 85) return 5;
  return 6;
}
export function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
export function dateLabel(day: number, minutes: number): string {
  return `第 ${day} 日 · ${clock(minutes)}`;
}
export function capacity(state: GameState): number {
  return state.rooms.filter(r => r.type === 'dorm').reduce((sum, room) => sum + room.capacity, 0);
}
export function buildCost(room: { level: number }): number {
  return 2400 * Math.max(1, room.level);
}
export function chance(girl: Girl, mission: Mission): number {
  return Math.max(35, Math.min(99, Math.round(70 + (girl.stats[mission.requirement] - mission.target) * 0.65 - girl.fatigue * 0.15)));
}
export function squadLimit(mission: Mission): number {
  return mission.work === 'combat' ? 3 : 2;
}
export function squadChance(girls: Girl[], mission: Mission): number {
  if (!girls.length) return 0;
  const best = Math.max(...girls.map(g => g.stats[mission.requirement]));
  const bonus = (girls.length - 1) * 4;
  const fatigue = Math.round(girls.reduce((sum, g) => sum + g.fatigue, 0) / girls.length * 0.15);
  return Math.max(20, Math.min(99, Math.round(55 + (best + bonus - mission.target) * 0.9 - fatigue)));
}
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function defaultSkills(id: string): string[] {
  const map: Record<string, string[]> = {
    yue: ['glimmer-spear', 'peach-ward', 'starlight-fall'], tang: ['sugar-needle', 'goodnight-candy', 'white-night-frost'],
    ling: ['frequency-prick', 'silent-band', 'moon-phase'], wu: ['dream-touch', 'sheep-nebula', 'deep-dream-fall'],
    zhi: ['flower-thorn', 'flower-prescription', 'spring-growth'], lu: ['drumbeat', 'finale-firework', 'crimson-encore'],
  };
  return map[id] ?? ['glimmer-spear'];
}
function hydrate(girl: Girl): Girl {
  const g = clone(girl);
  g.baseMaxHp ??= g.maxHp;
  g.skills ??= defaultSkills(g.id);
  g.scars ??= [];
  g.relationships ??= {};
  g.exp ??= 0;
  g.maxHp = Math.max(40, Math.round(g.baseMaxHp * Math.max(0.4, 1 - g.scars.length * 0.08)));
  g.hp = Math.min(g.hp, g.maxHp);
  g.maxSpirit = spiritMax(g);
  g.spirit = Math.min(g.spirit ?? g.maxSpirit, g.maxSpirit);
  g.skill = getSkill(g.skills[g.skills.length - 1] ?? 'glimmer-spear').name;
  return g;
}
function sampleDays(): GameState['samples'] {
  return Array.from({ length: 14 }, (_, index) => {
    const day = index + 1;
    const wave = Math.sin(index * 0.9) * 180 + Math.cos(index * 0.37) * 120;
    return { day, income: Math.round(640 + index * 28 + wave), expense: Math.round(300 + index * 12 - wave * 0.25), reputation: Math.max(48, Math.min(82, Math.round(62 + index * 1.1 + Math.sin(index) * 4))) };
  });
}
function sampleFor(state: GameState, day: number): Sample {
  let sample = state.samples.find(s => s.day === day);
  if (!sample) {
    sample = { day, income: 0, expense: 0, reputation: state.reputation };
    state.samples.push(sample);
    state.samples.sort((a, b) => a.day - b.day);
    if (state.samples.length > 60) state.samples.shift();
  }
  return sample;
}
function book(state: GameState, day: number, money: number): void {
  const sample = sampleFor(state, day);
  if (money > 0) sample.income += money;
  if (money < 0) sample.expense += -money;
  sample.reputation = state.reputation;
}
export function createInitialState(pack: ContentPack = createSeedPack()): GameState {
  const hired = pack.girls.slice(0, 4).map(hydrate);
  const candidates = pack.girls.slice(4).map(hydrate);
  const rooms = [
    { id: 'lounge', name: '会客厅', type: 'lounge' as const, level: 2, capacity: 0, description: '铺着旧地毯的会客厅，窗外正对樱雾市的河。' },
    { id: 'clinic', name: '月光诊所', type: 'clinic' as const, level: 1, capacity: 0, description: '栀子管理的诊所，空气里有晒干的花和酒精味。' },
    { id: 'dorm', name: '晚安宿舍', type: 'dorm' as const, level: 3, capacity: 6, description: '每个床位都有一盏可以调到最暗的小灯。' },
    { id: 'observatory', name: '星象台', type: 'observatory' as const, level: 1, capacity: 0, description: '零青常常在这里收听城市上空的杂音。' },
  ];
  const missions = clone(pack.missions).map(m => ({ ...m, squad: m.squad ?? [], attempts: m.attempts ?? 0, rounds: m.rounds ?? Math.max(2, Math.floor(m.duration / ROUND_MINUTES)) }));
  const logs: Log[] = [
    { id: 'l-1', time: '第 14 日 · 20:05', kind: 'story', text: '樱雾市进入夜间结界维护时段，事务所开始第十三夜的值班。' },
    { id: 'l-2', time: '第 14 日 · 20:40', kind: 'base', text: '晚安宿舍完成本月第三次床品更换，砂糖在每张床上放了一颗糖。' },
    { id: 'l-3', time: '第 14 日 · 21:10', kind: 'finance', text: '收到上月委托尾款，星砂储备补充。', delta: 480 },
  ];
  return {
    version: 3, day: 14, minutes: 21 * 60 + 40, gold: 12840, reputation: 76,
    girls: hired, candidates, missions, rooms, logs, samples: sampleDays(), completed: [],
    messages: {}, memorial: [], battles: [], packHash: pack.hash,
  };
}
export function createInitialFromPack(pack: ContentPack): GameState {
  return createInitialState(pack);
}

function findGirl(state: GameState, id: string): Girl | undefined {
  return state.girls.find(g => g.id === id);
}
function applyScar(state: GameState, girl: Girl, scar: Scar): void {
  girl.scars.push(scar);
  girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
  girl.hp = Math.min(girl.hp, girl.maxHp);
  const effect = scar.effect;
  if (effect.kind === 'stat' && effect.stat) {
    const key = effect.stat as StatKey;
    girl.stats[key] = Math.max(20, girl.stats[key] + effect.amount);
  }
  if (effect.kind === 'maxSpirit') girl.maxSpirit = Math.max(30, girl.maxSpirit + effect.amount);
  state.logs.unshift({ id: `log-scar-${scar.id}`, time: dateLabel(state.day, state.minutes), kind: 'memorial', text: `${girl.name}留下了第 ${girl.scars.length} 道疤痕「${scar.name}」。${scar.condition}。` });
}
function recordBattle(state: GameState, battle: BattleState): void {
  state.battles.unshift(battle);
  state.battles = state.battles.slice(0, 20);
}
function settleCombat(state: GameState, mission: Mission, squad: Girl[], at: { day: number; minutes: number }): BattleState {
  const battle = simulateBattle({ mission, girls: squad, day: at.day, minutes: at.minutes, woundedEnemies: mission.worsened });
  mission.attempts += 1;
  mission.lastOutcome = battle.outcome;
  const rewards = battle.rewards ?? { gold: 0, exp: 0, bond: 0 };
  if (battle.outcome === 'victory') {
    state.gold += rewards.gold;
    state.reputation = Math.min(100, state.reputation + 2);
    book(state, at.day, rewards.gold);
    state.completed.push(mission.id);
    mission.status = 'done';
    state.logs.unshift({ id: `log-win-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `战斗胜利：${mission.title}。魔物已被清除，事件移出委托池。`, delta: rewards.gold });
  } else if (battle.outcome === 'defeat') {
    state.reputation = Math.max(0, state.reputation - 3);
    book(state, at.day, 0);
    mission.status = 'open';
    mission.squad = [];
    mission.girlId = undefined;
    state.logs.unshift({ id: `log-lose-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `战斗失败：${mission.title}。全员失去行动能力，委托仍留在事件池中。` });
  } else {
    state.gold += rewards.gold;
    book(state, at.day, rewards.gold);
    mission.status = 'open';
    mission.worsened = true;
    mission.squad = [];
    mission.girlId = undefined;
    state.logs.unshift({ id: `log-repel-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `${outcomeLabel(battle.outcome)}：${mission.title}。获得 ${rewards.gold} 星砂，魔物带伤退去（下次血量 -20%）。`, delta: rewards.gold });
  }
  for (const unit of battle.units.filter(u => u.side === 'ally')) {
    const girl = findGirl(state, unit.uid.replace('ally-', ''));
    if (!girl) continue;
    girl.hp = Math.max(1, unit.hp);
    girl.spirit = Math.max(0, unit.spirit);
    if (battle.outcome !== 'defeat') girl.exp += rewards.exp;
    girl.bond = Math.max(0, Math.min(100, girl.bond + rewards.bond));
    for (const peer of squad) {
      if (peer.id === girl.id) continue;
      const current = girl.relationships[peer.id] ?? 40;
      girl.relationships[peer.id] = Math.max(0, Math.min(100, current + (battle.outcome === 'victory' ? 2 : battle.outcome === 'defeat' ? -2 : 1)));
    }
    if (battle.outcome === 'victory' || battle.outcome === 'repelled') {
      girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 12) + 6);
    }
  }
  if (battle.outcome === 'defeat') {
    for (const scar of battle.scars ?? []) {
      const girl = state.girls.find(g => scar.id.startsWith(`scar-${g.id}-`));
      if (girl) {
        applyScar(state, girl, scar);
        if (scar.fatal) killGirl(state, girl, battle, mission);
      }
    }
  }
  recordBattle(state, battle);
  return battle;
}
function killGirl(state: GameState, girl: Girl, battle: BattleState, mission: Mission): void {
  if (girl.dead) return;
  girl.dead = true;
  girl.diedAt = dateLabel(state.day, state.minutes);
  girl.status = 'retired';
  girl.remaining = 0;
  girl.missionId = undefined;
  state.memorial.unshift({
    girl: clone(girl), diedAt: girl.diedAt, cause: `在「${mission.title}」中承受了第五道疤痕。`,
    epitaph: girl.quote ?? '愿她终于可以好好睡一觉。', lastBattleId: battle.id,
  });
  state.logs.unshift({ id: `log-death-${girl.id}-${Date.now()}`, time: girl.diedAt, kind: 'memorial', text: `${girl.name}的契约终止了。事务所为她保留了靠窗的位置。` });
  state.reputation = Math.max(0, state.reputation - 5);
  for (const other of state.girls) {
    if (other.id === girl.id) continue;
    const score = other.relationships[girl.id] ?? 40;
    if (score >= 55) other.relationships[girl.id] = Math.max(0, score - 3);
    if (score >= 70) other.bond = Math.max(0, other.bond - 3);
  }
  state.missions.forEach(m => { m.squad = m.squad.filter(id => id !== girl.id); });
  state.girls = state.girls.filter(g => g.id !== girl.id);
  state.messages[girl.id] = state.messages[girl.id] ?? [];
}
function settleInvestigation(state: GameState, mission: Mission, squad: Girl[], at: { day: number; minutes: number }): void {
  const success = squadChance(squad, mission) >= 50 && Math.max(...squad.map(g => g.stats[mission.requirement])) + (squad.length - 1) * 4 >= mission.target;
  mission.attempts += 1;
  if (success) {
    state.gold += mission.reward;
    state.reputation = Math.min(100, state.reputation + 1);
    book(state, at.day, mission.reward);
    state.completed.push(mission.id);
    mission.status = 'done';
    state.logs.unshift({ id: `log-inv-${mission.id}-${mission.attempts}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `调查完成：${mission.title}。${squad.map(g => g.name).join('、')}带回了可以写进档案的答案。`, delta: mission.reward });
    for (const girl of squad) { girl.exp += 8; girl.bond = Math.min(100, girl.bond + 1); girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 15)); }
  } else {
    mission.status = 'open';
    mission.squad = [];
    mission.girlId = undefined;
    book(state, at.day, 0);
    state.logs.unshift({ id: `log-inv-fail-${mission.id}-${mission.attempts}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `调查受阻：${mission.title}。线索不足，委托仍在事件池中。` });
    for (const girl of squad) girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 10));
  }
  for (const girl of squad) {
    girl.status = 'idle'; girl.remaining = 0; girl.missionId = undefined;
  }
  if (success) { mission.squad = []; mission.girlId = undefined; }
}
function advanceClock(state: GameState, to: number): void {
  const now = state.day * 1440 + state.minutes;
  const elapsed = to - now;
  if (elapsed <= 0) return;
  state.day = Math.floor(to / 1440);
  state.minutes = to % 1440;
  for (const girl of state.girls) {
    if (girl.status === 'mission' || girl.status === 'healing' || girl.status === 'resting') girl.remaining = Math.max(0, girl.remaining - elapsed);
  }
}
function careRecovery(girl: Girl, mode: 'healing' | 'resting'): void {
  if (mode === 'healing') {
    girl.hp = girl.maxHp;
    girl.fatigue = Math.max(0, girl.fatigue - 10);
  } else {
    const penalty = girl.scars.reduce((sum, s) => sum + (s.effect.kind === 'fatigueRecovery' ? s.effect.amount : 0), 0);
    girl.fatigue = Math.max(0, girl.fatigue - Math.max(20, 60 + penalty));
  }
  girl.status = 'idle'; girl.remaining = 0;
}
function advance(state: GameState, minutes: number): ActionResult {
  if (!Number.isFinite(minutes) || minutes < 1) return { state, ok: false, message: '推进时间需要至少一分钟。' };
  if (minutes > 180) return { state, ok: false, message: '一次最多推进 180 分钟，请分段安排夜晚。' };
  const next = clone(state);
  const end = next.day * 1440 + next.minutes + minutes;
  let lastBattle: BattleState | undefined;
  for (let guard = 0; guard < 24; guard++) {
    const events: { at: number; mission?: Mission; girl?: Girl }[] = [];
    for (const mission of next.missions) {
      if (mission.status !== 'active') continue;
      const squad = mission.squad.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g && g.status === 'mission'));
      if (!squad.length) continue;
      const remaining = Math.min(...squad.map(g => g.remaining));
      events.push({ at: next.day * 1440 + next.minutes + remaining, mission });
    }
    for (const girl of next.girls) {
      if (girl.status === 'healing' || girl.status === 'resting') events.push({ at: next.day * 1440 + next.minutes + girl.remaining, girl });
    }
    const due = events.filter(e => e.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    advanceClock(next, due.at);
    if (due.mission) {
      const mission = next.missions.find(m => m.id === due.mission!.id)!;
      const squad = mission.squad.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
      if (mission.work === 'combat' && mission.enemyIds?.length) lastBattle = settleCombat(next, mission, squad, { day: next.day, minutes: next.minutes });
      else settleInvestigation(next, mission, squad, { day: next.day, minutes: next.minutes });
      for (const girl of squad) { girl.status = 'idle'; girl.remaining = 0; girl.missionId = undefined; }
      if (mission.work === 'combat' && mission.status === 'done') {
        mission.squad = [];
        mission.girlId = undefined;
      }
    } else if (due.girl) {
      const girl = findGirl(next, due.girl.id);
      if (girl) careRecovery(girl, girl.status === 'healing' ? 'healing' : 'resting');
    }
  }
  advanceClock(next, end);
  return { state: next, ok: true, message: lastBattle ? `${outcomeLabel(lastBattle.outcome)}：${lastBattle.missionTitle}` : `时间推进 ${minutes} 分钟。`, battle: lastBattle };
}
function dispatch(state: GameState, girlIds: string[], missionId: string): ActionResult {
  const next = clone(state);
  const mission = next.missions.find(m => m.id === missionId);
  if (!mission || mission.status !== 'open') return { state, ok: false, message: '这项委托当前无法接取。' };
  const squad = girlIds.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
  if (squad.length !== girlIds.length || !squad.length) return { state, ok: false, message: '请选择可出勤的契约者。' };
  if (squad.length > squadLimit(mission)) return { state, ok: false, message: `${workLabels[mission.work]}最多派遣 ${squadLimit(mission)} 人。` };
  for (const girl of squad) {
    if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}当前${statusLabels[girl.status]}，无法出勤。` };
    if (girl.hp < 25) return { state, ok: false, message: `${girl.name}的血量过低，请先治疗。` };
    if (girl.fatigue >= 80) return { state, ok: false, message: `${girl.name}的疲劳过高，请先休息。` };
  }
  mission.status = 'active';
  mission.squad = squad.map(g => g.id);
  mission.girlId = squad[0].id;
  for (const girl of squad) {
    girl.status = 'mission'; girl.remaining = mission.duration; girl.missionId = mission.id;
  }
  next.logs.unshift({ id: `log-dispatch-${mission.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'dispatch', text: `${squad.map(g => g.name).join('、')}已前往「${mission.title}」。${mission.work === 'combat' ? `魔物：${(mission.enemyIds ?? []).length} 体，预计 ${mission.rounds} 轮。` : '以调查与共情为主，不进入战斗。'}` });
  return { state: next, ok: true, message: `${squad.map(g => g.name).join('、')}已出发。` };
}
function care(state: GameState, girlId: string, mode: 'healing' | 'resting'): ActionResult {
  const next = clone(state); const girl = findGirl(next, girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}正在${statusLabels[girl.status]}，无法安排照顾。` };
  if (mode === 'healing') {
    if (girl.hp >= girl.maxHp) return { state, ok: false, message: `${girl.name}的血量已经满了。` };
    if (next.gold < 180) return { state, ok: false, message: '星砂不足，无法支付治疗费用。' };
    next.gold -= 180; book(next, next.day, -180); girl.status = 'healing'; girl.remaining = 60;
    next.logs.unshift({ id: `log-heal-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}前往月光诊所接受治疗（60 分钟）。`, delta: -180 });
    return { state: next, ok: true, message: `${girl.name}已送往治疗，60 分钟后恢复。` };
  }
  if (girl.fatigue === 0) return { state, ok: false, message: `${girl.name}现在并不疲惫。` };
  girl.status = 'resting'; girl.remaining = 90;
  next.logs.unshift({ id: `log-rest-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}回到晚安宿舍休息（90 分钟）。` });
  return { state: next, ok: true, message: `${girl.name}开始休息，90 分钟后恢复。` };
}
function talkResponse(girl: Girl, text: string, bond: number): string {
  const stage = relationshipStage(bond);
  if (girl.id === 'wu' && /猫|咪|尾巴/.test(text)) return '雾眠把帽子掀开一角——里面蜷着一只不属于任何品种的小猫。「帽子里的猫说，它记得你上次留下的脚步声。」';
  if (/累|休息|睡/.test(text)) return stage >= 4 ? '「有一点。不过你在这里的话，我可以再撑一会儿。」她把额头轻轻靠在桌沿。' : '「我还好。谢谢关心。」她点点头，没有再多说。';
  if (/星星|月|夜/.test(text)) return stage >= 4 ? '「今晚的月亮很像你说话时的停顿。」她望向窗外，耳尖有一点红。' : '「夜空很安静。适合工作。」她把视线移回档案。';
  if (/对不起|抱歉/.test(text)) return stage >= 5 ? '「不要为已经发生的事道歉。你还在，就够了。」' : '「没关系。真的。」她停了一下，又补了一句，「至少现在没关系。」';
  if (stage >= 6) return `「你来了。」${girl.name}没有抬头，却把身边的位置往你这边挪了挪，「今天也想听你说说话。」`;
  if (stage >= 5) return `「嗯。」${girl.name}把杯子推到你面前，「先喝点热的。剩下的，慢慢说。」`;
  if (stage >= 3) return `「我在听。」${girl.name}合上手里的档案，「不过，如果你只是路过，也没关系。」`;
  return `「……知道了。」${girl.name}的语气很轻，像是在确认自己是否应该继续这个话题。`;
}
function talk(state: GameState, girlId: string, text: string): ActionResult {
  const clean = text.trim();
  if (!clean) return { state, ok: false, message: '想说些什么，再按下发送。' };
  const next = clone(state); const girl = findGirl(next, girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (girl.status === 'mission') return { state, ok: false, message: `${girl.name}正在出勤，等她回来再聊吧。` };
  if (clean.length > 200) return { state, ok: false, message: '一次最多说 200 个字。' };
  const count = girl.lastTalkDay === next.day ? (girl.talksToday ?? 0) : 0;
  const gain = count < 3 ? 2 : 0;
  girl.lastTalkDay = next.day; girl.talksToday = count + 1;
  girl.bond = Math.min(100, girl.bond + gain);
  const messages = next.messages[girl.id] ?? [];
  messages.push({ role: 'player', text: clean });
  messages.push({ role: 'girl', text: talkResponse(girl, clean, girl.bond) });
  next.messages[girl.id] = messages.slice(-60);
  return { state: next, ok: true, message: gain ? `与${girl.name}的羁绊 +${gain}。` : '今晚已经聊得够多了，明天再继续吧。' };
}
export function act(state: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'advance': return advance(state, action.minutes);
    case 'dispatch': return dispatch(state, action.girlIds, action.missionId);
    case 'care': return care(state, action.girlId, action.mode);
    case 'talk': return talk(state, action.girlId, action.text);
    case 'hire': {
      const next = clone(state); const candidate = next.candidates.find(g => g.id === action.girlId);
      if (!candidate) return { state, ok: false, message: '这位候选者已经不在名册上。' };
      if (next.gold < candidate.cost) return { state, ok: false, message: `星砂不足，还需要 ${candidate.cost - next.gold}。` };
      const used = next.girls.filter(g => !g.dead).length;
      if (used >= capacity(next)) return { state, ok: false, message: '基地席位已满，请先扩建宿舍或让资深契约者退役。' };
      next.gold -= candidate.cost;
      book(next, next.day, -candidate.cost);
      next.girls.push({ ...candidate, status: 'idle', roomId: 'lounge', remaining: 0 });
      next.candidates = next.candidates.filter(g => g.id !== candidate.id);
      next.logs.unshift({ id: `log-hire-${candidate.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${candidate.name}缔结契约，事务所增加一位新的魔法少女。`, delta: -candidate.cost });
      return { state: next, ok: true, message: `${candidate.name}已加入夜糖事务所。` };
    }
    case 'build': {
      const next = clone(state); const room = next.rooms.find(r => r.id === (action.roomId ?? 'dorm')) ?? next.rooms.find(r => r.type === 'dorm')!;
      if (room.level >= 4) return { state, ok: false, message: '这个房间已经达到最高等级。' };
      const cost = buildCost(room);
      if (next.gold < cost) return { state, ok: false, message: `星砂不足，扩建需要 ${cost}。` };
      next.gold -= cost; room.level += 1;
      book(next, next.day, -cost);
      if (room.type === 'dorm') room.capacity += 2;
      next.logs.unshift({ id: `log-build-${room.id}-${room.level}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `${room.name}升至 ${room.level} 级${room.type === 'dorm' ? '，新增 2 个契约席位' : ''}。`, delta: -cost });
      return { state: next, ok: true, message: `${room.name}已升级${room.type === 'dorm' ? '，新增 2 个席位' : ''}。` };
    }
    case 'retire': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.status === 'mission') return { state, ok: false, message: '出勤中的契约者无法办理退役。' };
      if (girl.scars.length < 4) return { state, ok: false, message: '只有累积 4 道疤痕的契约者可以申请退役。' };
      girl.retired = true; girl.status = 'retired';
      next.logs.unshift({ id: `log-retire-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}办理了退役，转任事务所文职。她的席位仍留在基地。` });
      return { state: next, ok: true, message: `${girl.name}已转为文职，不再参与派遣。` };
    }
    case 'reset': return { state: createInitialState(), ok: true, message: '事务所已回到第 14 日的夜晚。' };
    default: return { state, ok: false, message: '未知操作。' };
  }
}

const characterIds = new Set(['yue', 'tang', 'ling', 'wu', 'zhi', 'lu']);
function safeId(id: unknown): id is string {
  return typeof id === 'string' && (characterIds.has(id) || /^g_[a-z0-9]{6,}$/.test(id));
}
function validGirl(value: unknown): value is Girl {
  if (!value || typeof value !== 'object') return false;
  const g = value as Girl;
  if (!safeId(g.id) || typeof g.name !== 'string' || !g.name) return false;
  if (!g.stats || typeof g.stats !== 'object') return false;
  for (const key of ['magic', 'insight', 'agility', 'empathy'] as StatKey[]) if (!Number.isFinite(g.stats[key])) return false;
  if (!['idle', 'mission', 'healing', 'resting', 'retired'].includes(g.status)) return false;
  if (!Number.isFinite(g.hp) || !Number.isFinite(g.maxHp) || !Number.isFinite(g.fatigue) || !Number.isFinite(g.bond)) return false;
  if (!Array.isArray(g.skills) || !g.skills.every(s => typeof s === 'string' && getSkill(s))) return false;
  return true;
}
function migrate(raw: Record<string, unknown>): GameState | null {
  if (raw.version !== 1) return null;
  try {
    const pack = createSeedPack();
    const base = createInitialState(pack);
    const oldGirls = Array.isArray(raw.girls) ? raw.girls as Girl[] : [];
    const girls = oldGirls.length ? oldGirls.map(g => {
      const seed = pack.girls.find(s => s.id === g.id);
      return hydrate({ ...(seed ?? base.girls[0]), ...g, skills: seed?.skills ?? defaultSkills(g.id), scars: [], relationships: seed?.relationships ?? {}, baseMaxHp: g.maxHp, spirit: seed?.spirit ?? 80, maxSpirit: seed?.maxSpirit ?? 80, exp: 0 });
    }) : base.girls;
    const missions = base.missions.map(m => {
      const old = (raw.missions as Mission[] | undefined)?.find(x => x.id === m.id);
      return old ? { ...m, status: old.status, girlId: old.girlId, squad: old.girlId ? [old.girlId] : [], attempts: old.status === 'done' ? 1 : 0 } : m;
    });
    return { ...base, day: Number(raw.day) || 14, minutes: Number(raw.minutes) || 0, gold: Number(raw.gold) || 0, reputation: Number(raw.reputation) || 50, girls, missions, logs: Array.isArray(raw.logs) ? raw.logs.slice(0, 300) : base.logs, completed: Array.isArray(raw.completed) ? raw.completed.filter(x => typeof x === 'string') : [], samples: Array.isArray(raw.samples) ? raw.samples.slice(-60) : base.samples, messages: {}, memorial: [], battles: [] };
  } catch { return null; }
}
export function loadState(raw: string | null): GameState {
  if (!raw) return createInitialState();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return createInitialState(); }
  if (!parsed || typeof parsed !== 'object') return createInitialState();
  const value = parsed as Record<string, unknown>;
  if (value.version === 1) return migrate(value) ?? createInitialState();
  if (value.version !== 3) return createInitialState();
  try {
    if (!Array.isArray(value.girls) || !value.girls.length || !value.girls.every(validGirl)) return createInitialState();
    const ids = new Set<string>();
    for (const girl of value.girls) {
      if (ids.has(girl.id)) return createInitialState();
      ids.add(girl.id);
      if (girl.scars && !Array.isArray(girl.scars)) return createInitialState();
      if (girl.relationships && (typeof girl.relationships !== 'object' || Array.isArray(girl.relationships))) return createInitialState();
    }
    if (!Array.isArray(value.rooms) || value.rooms.length !== 4) return createInitialState();
    if (!Array.isArray(value.missions)) return createInitialState();
    for (const mission of value.missions as Mission[]) {
      if (!mission || typeof mission.id !== 'string' || !['open', 'active', 'done'].includes(mission.status)) return createInitialState();
      if (!Array.isArray(mission.squad)) return createInitialState();
      if (mission.status === 'active') {
        if (!mission.squad.length) return createInitialState();
        for (const id of mission.squad) {
          const girl = (value.girls as Girl[]).find(g => g.id === id);
          if (!girl || girl.status !== 'mission' || girl.missionId !== mission.id) return createInitialState();
        }
      }
    }
    if (!Array.isArray(value.logs) || value.logs.length > 300) return createInitialState();
    if (!Array.isArray(value.samples) || value.samples.length > 60) return createInitialState();
    const messages = value.messages && typeof value.messages === 'object' && !Array.isArray(value.messages) ? value.messages as Record<string, unknown> : {};
    for (const [key, list] of Object.entries(messages)) {
      if (!ids.has(key)) return createInitialState();
      if (!Object.hasOwn(messages, key) || !Array.isArray(list) || list.length > 60) return createInitialState();
      for (const m of list) if (!m || typeof m !== 'object' || !['girl', 'player', 'system'].includes((m as { role: string }).role) || typeof (m as { text: unknown }).text !== 'string') return createInitialState();
    }
    const state = clone(value) as unknown as GameState;
    state.girls = state.girls.map(hydrate);
    state.missions.forEach(m => { m.attempts ??= 0; m.squad ??= m.girlId ? [m.girlId] : []; });
    state.memorial ??= []; state.battles = Array.isArray(state.battles) ? state.battles.slice(0, 20) : [];
    state.packHash ??= createSeedPack().hash;
    return state;
  } catch { return createInitialState(); }
}
