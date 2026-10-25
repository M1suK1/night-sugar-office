import type { ActionResult, BattleState, ContentPack, Equipment, FactionId, GameAction, GameState, Girl, Log, MarketStockEntry, Mission, Opinion, Sample, Scar, StatKey } from './types';
import { createSeedPack } from './content/seed-pack.ts';
import { getSkill } from './content/skills.ts';
import { simulateBattle, spiritMax, outcomeLabel, ROUND_MINUTES } from './combat.ts';
import { pickTraits, traitById } from './content/traits.ts';
import { battleExp, grantExp, investigationExp } from './progression.ts';
import { CONTRACT_DAYS, REMOTE_CALL_COST, pensionFor, renewalCost, pensionArrears } from './contracts.ts';
import { factionInfo, getItem, items } from './content/items.ts';
import { monsters } from './content/monsters.ts';
import { advancedCost, corruptionStage, effectiveMaxHp, effectiveMaxSpirit, effectiveStats, equipmentOf, factionPrice, marketSize, marketUpgradeCost } from './economy.ts';

export const SAVE_KEY = 'night-sugar-office:v1';
export const statLabels: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };
export const statusLabels: Record<string, string> = { idle: '待命', mission: '派遣中', healing: '治疗中', resting: '休息中', retired: '已退役', expedition: '远行中' };
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
  const stats = effectiveStats(girl);
  return Math.max(35, Math.min(99, Math.round(70 + (stats[mission.requirement] - mission.target) * 0.65 - girl.fatigue * 0.15)));
}
export function squadLimit(mission: Mission): number {
  return mission.work === 'combat' ? 3 : 2;
}
export function squadChance(girls: Girl[], mission: Mission): number {
  if (!girls.length) return 0;
  const best = Math.max(...girls.map(g => effectiveStats(g)[mission.requirement]));
  const bonus = (girls.length - 1) * 4;
  const fatigue = Math.round(girls.reduce((sum, g) => sum + g.fatigue, 0) / girls.length * 0.15);
  return Math.max(20, Math.min(99, Math.round(55 + (best + bonus - mission.target) * 0.9 - fatigue)));
}
export function drugDaysLeft(girl: Girl, day: number): number {
  return Math.max(0, (girl.drugUntilDay ?? 0) - day);
}
export function inWithdrawal(girl: Girl): boolean {
  return Boolean(girl.witch && (girl.withdrawalDays ?? 0) > 0);
}
export function marketPool(state: GameState): Girl[] {
  return state.candidates;
}
export function factionStanding(state: GameState, faction: FactionId): number {
  return state.factions[faction]?.standing ?? 0;
}
export function marketUpgrade(state: GameState): { cost: number | null; size: number } {
  return { cost: marketUpgradeCost(state.marketLevel), size: marketSize(state.marketLevel) };
}
export function itemPrice(state: GameState, item: Equipment): number {
  const standing = factionStanding(state, item.faction);
  const rebate = state.inventory['permit'] ? 0.9 : 1;
  return Math.round(factionPrice(item, standing) * rebate);
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
  g.baseStats ??= { ...g.stats };
  g.skills ??= defaultSkills(g.id);
  g.scars ??= [];
  g.relationships ??= {};
  g.exp ??= 0;
  g.goal ??= '在城市的夜里，找到一件值得反复去做的事。';
  g.goalKind ??= '生活';
  g.traits ??= [];
  g.conditions ??= [];
  g.contractEndDay ??= 24;
  g.contractDays ??= CONTRACT_DAYS;
  g.contractRenewals ??= 0;
  g.pensionMissed ??= 0;
  g.status ??= 'idle';
  g.appearance ??= '她的轮廓在夜灯下显得很安静。';
  g.personality ??= '安静，习惯把心事留到天亮。';
  g.outfitDescription ??= '事务所配发的深色值夜制服。';
  g.wardrobe ??= [
    { id: 'uniform', name: '值夜制服', description: '事务所统一配发的夜间制服，便于行动。', palette: [g.color, '#17141c', '#f7e9f1'], layerKey: 'uniform' },
    { id: 'casual', name: '私服', description: '下班后才会穿的衣服，袖口仍留着一点夜里的冷气。', palette: [g.color, '#241d2b', '#d9c9e2'], layerKey: 'casual' },
    { id: 'formal', name: '礼装', description: '在需要被城市记住的场合穿的那一套。', palette: [g.color, '#0e0c14', '#ffe4ef'], layerKey: 'formal' },
  ];
  g.outfitId ??= 'uniform';
  g.expression ??= 'calm';
  g.corruption ??= 0;
  g.equipment ??= {};
  g.importedVariants ??= {};
  g.maxHp = Math.max(40, effectiveMaxHp(g));
  g.hp = Math.min(g.hp, g.maxHp);
  g.maxSpirit = Math.max(30, g.maxSpirit ?? spiritMax(g));
  g.spirit = Math.min(g.spirit ?? g.maxSpirit, effectiveMaxSpirit(g));
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
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}
const candidateNames = ['南枝', '莉莉安', '灰原灯', '白栖', '苏糖', '森野眠', '折原凛', '秋山杏', '柚木澪', '花笼', '小鸟游雪', '雨森', '桐谷真昼', '叶月', '猫田铃', '白石萤'];
const candidateColors = ['#F49ABD', '#C7A7E8', '#9CC9D2', '#B9D8A8', '#D98A94', '#E8C7A7'];
const elements = ['星光系', '糖霜系', '月影系', '梦境系', '自然系', '赤焰系'] as const;
const archetypes = ['输出', '守护', '控制', '治愈', '侦查'] as const;

function makeCandidate(state: GameState, level: number, salt = 0): Girl {
  const seed = hashText(`${state.day}:${state.marketDay}:${state.candidates.length}:${level}:${salt}`);
  const pick = <T,>(list: readonly T[], shift: number): T => list[(seed >>> shift) % list.length];
  const element = pick(elements, 0);
  const archetype = pick(archetypes, 4);
  const name = candidateNames[seed % candidateNames.length];
  const id = `g_${seed.toString(16).padStart(8, '0')}`;
  const stat = (shift: number) => 42 + ((seed >>> shift) % 45) + (level - 1) * 3;
  const stats = { magic: stat(3), insight: stat(7), agility: stat(11), empathy: stat(15) };
  const color = candidateColors[seed % candidateColors.length];
  const skills = archetype === '治愈' ? ['flower-thorn', 'flower-prescription', 'spring-growth'] : archetype === '控制' ? ['frequency-prick', 'silent-band', 'moon-phase'] : archetype === '守护' ? ['sugar-needle', 'goodnight-candy', 'white-night-frost'] : ['glimmer-spear', 'peach-ward', 'starlight-fall'];
  const baseMaxHp = Math.round(96 + stats.empathy * 0.3) + level * 4;
  return hydrate({
    id, name, codename: `${element.slice(0, 2)}协奏`, title: '刚刚递交契约的魔法少女', element, color, portrait: '',
    level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 80 + level * 2, maxSpirit: 80 + level * 2,
    fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
    skill: '', skills, description: '她的档案还很薄，只有一页训练记录和一张没有署名的推荐信。', cost: 1800 + level * 400 + Math.round((stats.magic + stats.insight + stats.agility + stats.empathy) * 4),
    scars: [], relationships: {}, archetype, quote: '请多指教。我会努力不拖后腿的。',
    goal: '证明自己可以独立完成一次委托。', goalKind: '成长', traits: [], conditions: [], contractEndDay: 24, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
    appearance: pick(['浅色短发，发梢有一点不听话的卷。', '黑发扎成低马尾，耳后别着一枚旧发卡。', '亚麻色长发，眼睛比制服的颜色更浅。'], 6),
    personality: pick(['认真、容易紧张，被夸奖时会短暂地失去语言。', '看起来冷淡，其实很怕给别人添麻烦。', '好奇心旺盛，总在记录本上画看不懂的符号。'], 9),
    outfitDescription: '见习契约者的简化制服，袖口还没有绣上事务所的标记。',
    wardrobe: [], outfitId: 'uniform', expression: 'calm', corruption: 0, equipment: {}, candidateUntilDay: state.day + (salt % 2 === 0 ? 1 : 3),
  });
}

function refreshMarket(state: GameState): void {
  state.candidates = state.candidates.filter(g => g.custom || (g.candidateUntilDay ?? 0) > state.day);
  const target = marketSize(state.marketLevel);
  let guard = 0;
  while (state.candidates.filter(g => !g.custom).length < target && state.candidates.length < 6 && guard < 8) {
    const level = hashText(`${state.day}:${state.marketDay}:${guard}`) % 10 < 7 ? 1 : 2;
    const girl = makeCandidate(state, level, state.marketDay * 10 + guard);
    if (!state.candidates.some(g => g.id === girl.id)) state.candidates.push(girl);
    guard += 1;
  }
  state.marketDay = state.day;
}

export function makeFactionStock(faction: FactionId, day: number): MarketStockEntry[] {
  const pool = items.filter(item => item.faction === faction);
  if (!pool.length) return [];
  const picked: typeof pool = [];
  for (let index = 0; index < 3; index++) {
    const roll = hashText(`${faction}:${day}:${index}`);
    const duplicate = index > 0 && roll % 100 < 32;
    picked.push(duplicate ? picked[index - 1] : pool[roll % pool.length]);
  }
  return picked.map((item, index) => ({ id: `stock-${faction}-${day}-${index}`, itemId: item.id, faction, sold: false }));
}
export function makeMarketStock(day: number): MarketStockEntry[] {
  return (Object.keys(factionInfo) as FactionId[]).flatMap(faction => makeFactionStock(faction, day));
}

function addCorruption(state: GameState, girl: Girl, amount: number): void {
  if (!amount || girl.dead || girl.retired) return;
  const before = corruptionStage(girl.corruption ?? 0);
  girl.corruption = Math.max(0, Math.min(100, Math.round((girl.corruption ?? 0) + amount)));
  const after = corruptionStage(girl.corruption);
  if (after > before) {
    state.logs.unshift({ id: `log-corrupt-${girl.id}-${girl.corruption}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}的侵蚀进入「${['澄明', '浅蚀', '深蚀', '魔女'][after]}」阶段。${after === 3 ? '她的影子长出了不属于人类的角。' : '她的共情正在被某种东西缓慢替换。'}` });
    if (after === 3) {
      girl.witch = true;
      girl.drugUntilDay = Math.max(girl.drugUntilDay ?? 0, state.day + 10);
      girl.withdrawalDays = 0;
    }
  }
}

function drugTick(state: GameState, girl: Girl): void {
  if (!girl.witch || girl.dead) return;
  if ((girl.drugUntilDay ?? 0) >= state.day) { girl.withdrawalDays = 0; return; }
  if ((state.inventory['moon-drug'] ?? 0) > 0) {
    state.inventory['moon-drug'] -= 1;
    girl.drugUntilDay = state.day + 10;
    girl.withdrawalDays = 0;
    state.logs.unshift({ id: `log-drug-${girl.id}-${state.day}`, time: dateLabel(state.day, 0), kind: 'clinic', text: `仓库中的月蚀抑制剂被用于${girl.name}，药效延长至第 ${girl.drugUntilDay} 日。` });
    return;
  }
  girl.withdrawalDays = (girl.withdrawalDays ?? 0) + 1;
  const step = girl.withdrawalDays;
  const damage = step <= 3 ? 8 : step <= 6 ? 14 : step <= 9 ? 22 : 40;
  girl.hp = Math.max(0, girl.hp - damage);
  if (step === 1) state.logs.unshift({ id: `log-withdraw-${girl.id}-${state.day}`, time: dateLabel(state.day, 0), kind: 'clinic', text: `${girl.name}断药了。她把自己锁在宿舍里，说只是需要一点时间。` });
  if (girl.hp <= 0 || step >= 10) {
    girl.hp = 0; girl.dead = true; girl.status = 'retired'; girl.retired = true; girl.diedAt = dateLabel(state.day, 0);
    state.memorial.unshift({ girl: clone(girl), diedAt: girl.diedAt, cause: '断药。月蚀侵蚀吞掉了最后一点自我。', epitaph: '她终于不必再数着药片过日子。', lastBattleId: '' });
    state.logs.unshift({ id: `log-death-drug-${girl.id}`, time: dateLabel(state.day, 0), kind: 'memorial', text: `${girl.name}在断药第 ${step} 日停止了呼吸。事务所为她保留了那盏调到最暗的灯。` });
    state.girls = state.girls.filter(g => g.id !== girl.id);
  }
}

const factionTaskTitle: Record<FactionId, string> = { witch: '月蚀庭的夜间取样', association: '星灯协会的失联信号', government: '市役所的封锁线缺口' };
const factionEnemies: Record<FactionId, string[]> = { witch: ['mirror-nun', 'echo-cat'], association: ['sugar-moth', 'night-tram'], government: ['candy-king', 'echo-cat'] };
const factionReward: Record<FactionId, number> = { witch: 900, association: 760, government: 820 };

function factionTask(state: GameState, faction: FactionId): Mission {
  return {
    id: `envoy-${faction}-${state.day}`, title: factionTaskTitle[faction], category: `${factionInfo[faction].short} · 代表委托`,
    description: `${factionInfo[faction].envoy}把一份没有编号的任务书推过桌面。「今晚只交给你们。」`,
    x: 30 + (hashText(faction) % 40), y: 30 + (hashText(faction + state.day) % 40), difficulty: '中危', duration: 60,
    reward: factionReward[faction], requirement: faction === 'witch' ? 'empathy' : faction === 'association' ? 'insight' : 'agility',
    target: 74, color: factionInfo[faction].color, status: 'open', squad: [], work: 'combat', enemyIds: factionEnemies[faction],
    rounds: 4, attempts: 0, recommendedLevel: 5, faction, envoy: true,
  };
}

function makeBossMission(day: number): Mission {
  return {
    id: `boss-${day}`, title: '空月降临', category: '城市级威胁', description: '钟楼上方的空月开始下坠。三个街区同时听见了没有来源的钟声。',
    x: 50, y: 18, difficulty: '绝望', duration: 90, reward: 8000, requirement: 'magic', target: 95,
    color: '#C9C4FF', status: 'open', squad: [], work: 'combat', enemyIds: ['hollow-moon', 'sugar-moth', 'echo-cat'],
    rounds: 6, attempts: 0, recommendedLevel: 8, boss: true,
  };
}

function bossTick(state: GameState, elapsed: number): void {
  if (!state.boss) return;
  const now = state.day * 1440 + state.minutes;
  if (now >= state.boss.deadline) {
    state.reputation = Math.max(0, state.reputation - 6);
    state.boss.defeated = true;
    state.boss = null;
    state.missions = state.missions.filter(m => m.id !== `boss-${state.bossCycle}`);
    state.logs.unshift({ id: `log-boss-timeout-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'battle', text: '空月自行离开了城市上空。没有人感到轻松，安定度仍然下降了。' });
    return;
  }
  state.boss.lastTick += elapsed;
  while (state.boss.lastTick >= 180) {
    state.boss.lastTick -= 180;
    state.reputation = Math.max(0, state.reputation - 1);
  }
}

const conditionCatalog = [  { name: '夜惊', kind: 'debuff' as const, description: '连续几晚在同一个时刻惊醒，白天会下意识避开钟声。', stat: 'insight' as StatKey, amount: -3 },
  { name: '手部震颤', kind: 'debuff' as const, description: '握笔时手指会轻轻发抖，写下的字比平时更用力。', stat: 'agility' as StatKey, amount: -4 },
  { name: '幻听', kind: 'debuff' as const, description: '在安静的房间里，偶尔会听见并不存在的汽笛。', stat: 'empathy' as StatKey, amount: -3 },
  { name: '过度警觉', kind: 'buff' as const, description: '很难真正放松，但危险靠近时她总是第一个察觉。', stat: 'insight' as StatKey, amount: 4 },
  { name: '甜食安抚', kind: 'buff' as const, description: '随身带着糖，情绪低落时会好得快一点。', stat: 'empathy' as StatKey, amount: 2 },
];
function addCondition(state: GameState, girl: Girl, source: string): void {
  const seed = hashText(girl.id + state.day + source);
  const base = conditionCatalog[seed % conditionCatalog.length];
  girl.conditions.push({ id: `cond-${girl.id}-${seed.toString(16)}`, name: base.name, kind: base.kind, source, description: base.description, remaining: 3, removable: true, stat: base.stat, amount: base.amount });
  state.logs.unshift({ id: `log-cond-${girl.id}-${seed}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}在「${source}」之后出现了「${base.name}」。${base.description}` });
}
function gainTrait(state: GameState, girl: Girl, source: string, chance = 0.35): void {
  if (!girl.traits || girl.dead) return;
  const seed = hashText(`${girl.id}:${state.day}:${state.minutes}:${source}:${girl.traits.length}`);
  if (seed % 100 >= chance * 100) return;
  const [trait] = pickTraits(seed, 1, girl.traits.map(t => t.id));
  if (!trait) return;
  girl.traits.push({ ...trait, gainedAt: dateLabel(state.day, state.minutes) });
  state.logs.unshift({ id: `log-trait-${girl.id}-${trait.id}-${seed}`, time: dateLabel(state.day, state.minutes), kind: 'relationship', text: `${girl.name}在「${source}」之后显露出新的特性「${trait.name}」。${trait.description}` });
}
function tickConditions(girl: Girl, days: number): void {
  for (const condition of girl.conditions) condition.remaining -= days;
  girl.conditions = girl.conditions.filter(condition => condition.remaining > 0);
}
function accruePension(state: GameState, days: number): void {
  let paid = 0;
  let missing = 0;
  for (const girl of state.girls) {
    if (girl.dead || !girl.retired) continue;
    for (let i = 0; i < days; i++) {
      const daily = Math.max(1, Math.round(pensionFor(girl) / 10));
      if (state.gold - paid - daily >= 0) paid += daily;
      else missing += daily;
    }
  }
  if (paid) { state.gold -= paid; book(state, state.day, -paid); }
  if (missing) {
    state.pensionDebt += missing;
    state.logs.unshift({ id: `log-pension-${state.day}-${state.pensionDebt}`, time: dateLabel(state.day, state.minutes), kind: 'finance', text: `退休金账户出现 ${missing} 星砂缺口，已记入事务所欠款。`, delta: -missing });
  }
  for (const girl of state.girls) {
    if (girl.dead || girl.retired) continue;
    if (state.day > girl.contractEndDay) girl.pensionMissed = Math.min(60, girl.pensionMissed + days);
  }
}
function makeOpinion(state: GameState, author: Girl, topic: Opinion['topic'], title: string, text: string, request: string): Opinion {
  return {
    id: `op-${state.day}-${hashText(author.id + title + state.minutes)}`, day: state.day, authorId: author.id, topic,
    title, text, request, status: 'pending',
    options: [
      { id: 'accept', label: '批准', effect: '消耗少量星砂，羁绊提升' },
      { id: 'defer', label: '暂缓', effect: '不消耗资源，维持现状' },
      { id: 'reject', label: '驳回', effect: '节省资源，羁绊下降' },
    ],
    assistantNote: state.assistantId === author.id ? `${author.name}亲自提交，附了一份写得很短的预算。` : undefined,
  };
}
function generateOpinions(state: GameState): void {
  if (state.opinions.filter(opinion => opinion.status === 'pending').length >= 6) return;
  const pool = state.girls.filter(girl => !girl.dead && girl.status !== 'mission');
  if (!pool.length) return;
  const author = pool[hashText(`${state.day}:${state.minutes}`) % pool.length];
  const topics: { topic: Opinion['topic']; title: string; text: string; request: string }[] = [
    { topic: '经费', title: '想把会客厅的灯换暖一点', text: '现在的白光太像诊所。夜里回来的人，应该看见一点偏黄的光。', request: '申请 600 星砂更换会客厅灯具。' },
    { topic: '排班', title: '下周的夜班可以少排一个人吗', text: '连续出勤之后，大家的恢复速度明显变慢了。', request: '下一周期战斗委托最多接两件。' },
    { topic: '设施', title: '星象台的窗需要修', text: '上次的异常让它裂了一道缝，零青说风声会干扰收听。', request: '申请 900 星砂维修星象台。' },
    { topic: '同伴', title: '给新来的人办一场欢迎会', text: '不必很大，只要有糖和一张写着名字的卡片。', request: '申请 300 星砂筹办小型欢迎会。' },
    { topic: '城市', title: '糖果街的灯又灭了', text: '居民说不是电的问题。她们想再去看看。', request: '把糖果街的调查优先级提前。' },
    { topic: '私人心愿', title: '想请半天假', text: '不是去玩。只是想去看看城南那棵还没开的树。', request: '批准半天个人时间，不扣羁绊。' },
  ];
  const pick = topics[hashText(`${author.id}:${state.day}`) % topics.length];
  state.opinions.unshift(makeOpinion(state, author, pick.topic, pick.title, pick.text, pick.request));
  state.logs.unshift({ id: `log-op-${author.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'council', text: `${author.name}向事务所提交了议题「${pick.title}」。` });
}
function settleExpedition(state: GameState, expeditionId: string, at: { day: number; minutes: number }): void {
  const expedition = state.expeditions.find(e => e.id === expeditionId);
  if (!expedition) return;
  const members = expedition.memberIds.map(id => findGirl(state, id)).filter((g): g is Girl => Boolean(g));
  if (!members.length) { state.expeditions = state.expeditions.filter(e => e.id !== expeditionId); return; }
  const seed = hashText(`${expedition.id}:${expedition.cyclesDone}:${at.day}:${at.minutes}`);
  const gain = 60 + (seed % 121);
  const found = seed % 10 < 6;
  state.gold += gain;
  book(state, at.day, gain);
  expedition.cyclesDone += 1;
  expedition.lastSettledDay = at.day;
  expedition.lastSettledMinutes = at.minutes;
  for (const girl of members) {
    girl.fatigue = Math.min(100, girl.fatigue + 5);
    girl.bond = Math.min(100, girl.bond + 1);
    grantExp(girl, 2);
    if (found) gainTrait(state, girl, '星象台远行', 0.12);
  }
  state.logs.unshift({ id: `log-exp-${expedition.id}-${expedition.cyclesDone}`, time: dateLabel(at.day, at.minutes), kind: 'expedition', text: `星象台远行第 ${expedition.cyclesDone} 轮：${members.map(g => g.name).join('、')}带回 ${gain} 星砂${found ? '和一段可以写进档案的见闻' : '，但没有发现异常'}。`, delta: gain });
  if (members.some(girl => girl.fatigue >= 95)) {
    for (const girl of members) { if (girl.status === 'expedition') { girl.status = 'idle'; girl.roomId = 'lounge'; girl.remaining = 0; } }
    state.expeditions = state.expeditions.filter(item => item.id !== expeditionId);
    state.logs.unshift({ id: `log-exp-tired-${expedition.id}`, time: dateLabel(at.day, at.minutes), kind: 'expedition', text: `远行队因疲劳达到极限自动返回。${members.map(g => g.name).join('、')}需要休息。` });
  }
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
  const all = pack.girls.map(hydrate);
  const zhiIndex = all.findIndex(g => g.id === 'zhi');
  if (zhiIndex >= 0) {
    const zhi = all[zhiIndex];
    zhi.retired = true; zhi.retiredReason = 'contract'; zhi.status = 'retired';
    zhi.contractEndDay = 14; zhi.pensionMissed = 0;
  }
  const hired = all.filter(g => g.id !== 'lu');
  const candidates = all.filter(g => g.id === 'lu');
  if (candidates[0]) candidates[0] = { ...candidates[0], level: 6, cost: 3200, status: 'idle' };
  const rooms = [
    { id: 'lounge', name: '会客厅', type: 'lounge' as const, level: 2, capacity: 0, description: '铺着旧地毯的会客厅，窗外正对樱雾市的河。' },
    { id: 'clinic', name: '月光诊所', type: 'clinic' as const, level: 1, capacity: 0, description: '栀子管理的诊所，空气里有晒干的花和酒精味。' },
    { id: 'dorm', name: '晚安宿舍', type: 'dorm' as const, level: 3, capacity: 6, description: '每个床位都有一盏可以调到最暗的小灯。' },
    { id: 'observatory', name: '星象台', type: 'observatory' as const, level: 1, capacity: 0, description: '零青常常在这里收听城市上空的杂音。' },
  ];
  const missions = clone(pack.missions).map(m => ({ ...m, squad: m.squad ?? [], attempts: m.attempts ?? 0, recommendedLevel: m.recommendedLevel ?? 3, rounds: m.rounds ?? Math.max(2, Math.floor(m.duration / ROUND_MINUTES)) }));
  const logs: Log[] = [
    { id: 'l-1', time: '第 14 日 · 20:05', kind: 'story', text: '樱雾市进入夜间结界维护时段，事务所开始第十三夜的值班。' },
    { id: 'l-2', time: '第 14 日 · 20:40', kind: 'base', text: '晚安宿舍完成本月第三次床品更换，砂糖在每张床上放了一颗糖。' },
    { id: 'l-3', time: '第 14 日 · 21:10', kind: 'finance', text: '收到上月委托尾款，星砂储备补充。', delta: 480 },
  ];
  return {
    version: 6, day: 14, minutes: 21 * 60 + 40, gold: 12840, reputation: 76,
    girls: hired, candidates, missions, rooms, logs, samples: sampleDays(), completed: [],
    messages: {}, memorial: [], battles: [], packHash: pack.hash,
    opinions: [{ id: 'op-seed-14', day: 14, authorId: 'ling', topic: '设施', title: '星象台的窗需要修', text: '上次的异常让它裂了一道缝。风声会干扰收听，我不想在关键的时候漏掉一段求救。', request: '申请 900 星砂维修星象台。', status: 'pending', options: [{ id: 'accept', label: '批准', effect: '消耗 900 星砂，零青羁绊提升' }, { id: 'defer', label: '暂缓', effect: '不消耗资源，维持现状' }, { id: 'reject', label: '驳回', effect: '节省资源，零青羁绊下降' }], assistantNote: '零青把裂缝的位置画在了便签背面。' }], expeditions: [], councilDay: 14, pensionDebt: 0,
    factions: { witch: { standing: 20, stockDay: 14, envoyDay: 14 }, association: { standing: 50, stockDay: 14, envoyDay: 14 }, government: { standing: 45, stockDay: 14, envoyDay: 14 } },
    inventory: {}, marketStock: makeMarketStock(14), marketLevel: 1, marketDay: 14, boss: null, bossCycle: 0, nextBossDay: 16, customSkills: [], customMonsters: [],
    poolLimits: { missions: 12, monsters: 8, candidates: 6 }, removedMonsters: [],
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
  const battle = simulateBattle({ mission, girls: squad, day: at.day, minutes: at.minutes, woundedEnemies: mission.worsened, monsters: state.customMonsters });
  mission.attempts += 1;
  mission.lastOutcome = battle.outcome;
  const rewards = battle.rewards ?? { gold: 0, exp: 0, bond: 0 };
  if (battle.outcome === 'victory') {
    state.gold += rewards.gold;
    state.reputation = Math.min(100, state.reputation + (mission.boss ? 8 : 2));
    book(state, at.day, rewards.gold);
    state.completed.push(mission.id);
    mission.status = 'done';
    if (mission.faction) {
      state.factions[mission.faction].standing = Math.min(100, state.factions[mission.faction].standing + 6);
      state.reputation = Math.max(0, Math.min(100, state.reputation + (mission.faction === 'witch' ? -2 : mission.faction === 'association' ? 2 : 1)));
    }
    if (mission.boss && state.boss) { state.boss = null; state.bossCycle += 1; }
    state.logs.unshift({ id: `log-win-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `战斗胜利：${mission.title}。魔物已被清除，事件移出委托池。${mission.boss ? '空月退去，城市恢复呼吸。' : ''}`, delta: rewards.gold });
  } else if (battle.outcome === 'defeat') {
    state.reputation = Math.max(0, state.reputation - 3);
    if (mission.faction) state.factions[mission.faction].standing = Math.max(0, state.factions[mission.faction].standing - 3);
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
    if (battle.outcome === 'victory' || battle.outcome === 'repelled') {
      grantExp(girl, battleExp(mission.recommendedLevel));
      girl.contractEndDay += mission.attempts % 2 === 0 ? 1 : 0;
    }
    girl.bond = Math.max(0, Math.min(100, girl.bond + rewards.bond));
    for (const peer of squad) {
      if (peer.id === girl.id) continue;
      const current = girl.relationships[peer.id] ?? 40;
      girl.relationships[peer.id] = Math.max(0, Math.min(100, current + (battle.outcome === 'victory' ? 2 : battle.outcome === 'defeat' ? -2 : 1)));
    }
    if (battle.outcome === 'victory' || battle.outcome === 'repelled') {
      girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 12) + 6);
    }
    const gearCorruption = equipmentOf(girl).reduce((sum, item) => sum + (item.corruptionPerBattle ?? 0), 0);
    addCorruption(state, girl, 3 + gearCorruption + (mission.boss ? 6 : 0) + (battle.outcome === 'defeat' ? 2 : 0));
  }
  if (battle.outcome === 'defeat') {
    for (const scar of battle.scars ?? []) {
      const girl = state.girls.find(g => scar.id.startsWith(`scar-${g.id}-`));
      if (girl) {
        applyScar(state, girl, scar);
        if (scar.fatal) killGirl(state, girl, battle, mission);
      }
    }
  } else {
    for (const girl of squad) {
      if (girl.dead) continue;
      gainTrait(state, girl, mission.title, 0.35);
      if (battle.outcome === 'repelled') addCondition(state, girl, mission.title);
      if (hashText(`${girl.id}:${mission.id}:${state.day}`) % 100 < 28) {
        state.opinions.unshift(makeOpinion(state, girl, '同伴', `想再去一次「${mission.title}」`, `这次没有彻底解决。她认为下一次可以做得更好。`, '申请把该委托重新排入优先队列。'));
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
    for (const girl of squad) {
      grantExp(girl, investigationExp(mission.recommendedLevel));
      girl.bond = Math.min(100, girl.bond + 1);
      girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 15));
      girl.contractEndDay += mission.attempts % 2 === 0 ? 1 : 0;
      gainTrait(state, girl, mission.title, 0.3);
    }
    if (hashText(`${mission.id}:${state.day}`) % 100 < 22) {
      const author = squad[0];
      if (author) state.opinions.unshift(makeOpinion(state, author, '城市', '关于下一次调查的路线', '她想把糖果街和旧钟楼的线索并在一起看。', '申请一次不消耗星砂的线索整理时间。'));
    }
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
  const previousDay = state.day;
  state.day = Math.floor(to / 1440);
  state.minutes = to % 1440;
  const days = state.day - previousDay;
  if (days > 0) {
    accruePension(state, days);
    for (const girl of state.girls) tickConditions(girl, days);
    for (let i = 0; i < days; i++) processDay(state);
    if (state.day > state.councilDay) { state.councilDay = state.day; generateOpinions(state); }
  }
  bossTick(state, elapsed);
  for (const girl of state.girls) {
    if (girl.status === 'mission' || girl.status === 'healing' || girl.status === 'resting') girl.remaining = Math.max(0, girl.remaining - elapsed);
  }
}
function processDay(state: GameState): void {
  for (const girl of [...state.girls]) {
    drugTick(state, girl);
    if (!girl.dead && girl.fatigue >= 80) addCorruption(state, girl, 2);
  }
  for (const faction of Object.keys(state.factions) as FactionId[]) {
    if (state.factions[faction].stockDay < state.day) {
      state.factions[faction].stockDay = state.day;
      state.marketStock = state.marketStock.filter(entry => entry.faction !== faction).concat(makeFactionStock(faction, state.day));
    }
    if (state.factions[faction].envoyDay < state.day) {
      state.factions[faction].envoyDay = state.day;
      state.factions[faction].envoyTaskId = undefined;
    }
  }
  if (state.marketDay < state.day) refreshMarket(state);
  if (state.day >= state.nextBossDay && !state.boss) {
    state.bossCycle += 1;
    const mission = makeBossMission(state.day);
    state.missions.unshift(mission);
    state.boss = { id: `boss-${state.bossCycle}`, appearedDay: state.day, lastTick: 0, deadline: state.day * 1440 + 48 * 60, missionId: mission.id };
    state.nextBossDay = state.day + 3;
    state.logs.unshift({ id: `log-boss-${state.bossCycle}`, time: dateLabel(state.day, state.minutes), kind: 'battle', text: '空月出现在钟楼上空。城市进入最高警戒，委托池新增城市级威胁。' });
  }
}
function careRecovery(girl: Girl, mode: 'healing' | 'resting'): void {
  if (girl.clinicRest) {
    girl.hp = effectiveMaxHp(girl); girl.spirit = effectiveMaxSpirit(girl); girl.fatigue = 0; girl.clinicRest = false;
  } else if (mode === 'healing') {
    girl.hp = effectiveMaxHp(girl);
    girl.fatigue = Math.max(0, girl.fatigue - 10);
  } else {
    const penalty = girl.scars.reduce((sum, s) => sum + (s.effect.kind === 'fatigueRecovery' ? s.effect.amount : 0), 0);
    girl.fatigue = Math.max(0, girl.fatigue - Math.max(20, 60 + penalty));
    girl.corruption = Math.max(0, (girl.corruption ?? 0) - 5);
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
    const events: { at: number; mission?: Mission; girl?: Girl; expedition?: GameState['expeditions'][number] }[] = [];
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
    for (const expedition of next.expeditions) {
      const last = expedition.lastSettledDay * 1440 + expedition.lastSettledMinutes;
      const nextAt = last + 60;
      if (nextAt <= end) events.push({ at: nextAt, expedition });
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
    } else if (due.expedition) {
      settleExpedition(next, due.expedition.id, { day: next.day, minutes: next.minutes });
    }
  }
  advanceClock(next, end);
  for (const girl of next.girls) {
    if (girl.dead || girl.retired || girl.status === 'mission' || girl.status === 'expedition') continue;
    if (next.day > girl.contractEndDay && girl.pensionMissed >= 15) {
      girl.retired = true; girl.retiredReason = 'contract'; girl.status = 'retired'; girl.remaining = 0;
      next.logs.unshift({ id: `log-contract-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}的契约已欠约 ${girl.pensionMissed} 日，事务所为她办理了强制退休。她仍会按月领取退休金。` });
    }
  }
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
    if (inWithdrawal(girl)) return { state, ok: false, message: `${girl.name}正在断药期，无法出勤。请先使用月蚀抑制剂。` };
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
  next.logs.unshift({ id: `log-rest-${girl.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'care', text: `${girl.name}回到晚安宿舍休息（90 分钟）。${girl.corruption ? '宿舍的安静让侵蚀暂时退了一点。' : ''}` });
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
function talk(state: GameState, girlId: string, text: string, remote = false): ActionResult {
  const clean = text.trim();
  if (!clean) return { state, ok: false, message: '想说些什么，再按下发送。' };
  const next = clone(state); const girl = findGirl(next, girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
  if (clean.length > 200) return { state, ok: false, message: '一次最多说 200 个字。' };
  if (remote) {
    if (!girl.retired) return { state, ok: false, message: `${girl.name}还没有退役，直接去会客厅找她吧。` };
    if (next.gold < REMOTE_CALL_COST) return { state, ok: false, message: `远程联络需要 ${REMOTE_CALL_COST} 星砂，当前不足。` };
    next.gold -= REMOTE_CALL_COST; book(next, next.day, -REMOTE_CALL_COST);
    const firstToday = girl.lastTalkDay !== next.day;
    const gain = firstToday ? 1 : 0;
    girl.lastTalkDay = next.day; girl.talksToday = firstToday ? 1 : (girl.talksToday ?? 0) + 1;
    girl.bond = Math.min(100, girl.bond + gain);
    const messages = next.messages[girl.id] ?? [];
    messages.push({ role: 'player', text: clean });
    messages.push({ role: 'girl', text: `（电话那头有很轻的电流声）${talkResponse(girl, clean, girl.bond)}` });
    next.messages[girl.id] = messages.slice(-60);
    next.logs.unshift({ id: `log-call-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'relationship', text: `与退休在家的${girl.name}通了一次电话（${REMOTE_CALL_COST} 星砂）。`, delta: -REMOTE_CALL_COST });
    return { state: next, ok: true, message: gain ? `电话接通了。与${girl.name}的羁绊 +1。` : `电话接通了，但今晚已经聊过很久。` };
  }
  if (girl.retired) return { state, ok: false, message: `${girl.name}已经退役，改用远程联络吧。` };
  if (girl.status === 'mission') return { state, ok: false, message: `${girl.name}正在出勤，等她回来再聊吧。` };
  if (girl.status === 'expedition') return { state, ok: false, message: `${girl.name}正在星象台远行，暂时联络不上。` };
  const count = girl.lastTalkDay === next.day ? (girl.talksToday ?? 0) : 0;
  const assistantBonus = next.assistantId === girl.id ? 1 : 0;
  const gain = count < 3 ? 2 + assistantBonus : 0;
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
    case 'talk': return talk(state, action.girlId, action.text, action.remote);
    case 'renewContract': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.retired) return { state, ok: false, message: `${girl.name}已经退役，请使用返聘。` };
      const cost = renewalCost(girl) + pensionArrears(girl);
      if (next.gold < cost) return { state, ok: false, message: `续签需要 ${cost} 星砂（含欠缴退休金 ${pensionArrears(girl)}）。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.contractEndDay = Math.max(next.day, girl.contractEndDay) + girl.contractDays;
      girl.contractRenewals += 1; girl.pensionMissed = 0;
      girl.bond = Math.min(100, girl.bond + 3);
      next.logs.unshift({ id: `log-renew-${girl.id}-${girl.contractRenewals}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${girl.name}续签 ${girl.contractDays} 日契约（第 ${girl.contractRenewals} 次续签），并结清退休金欠款。`, delta: -cost });
      return { state: next, ok: true, message: `${girl.name}的契约延长至第 ${girl.contractEndDay} 日。` };
    }
    case 'rehire': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.retired || girl.retiredReason !== 'contract') return { state, ok: false, message: '只有因欠约退休的契约者可以返聘。' };
      const cost = 600 + girl.level * 120;
      if (next.gold < cost) return { state, ok: false, message: `返聘需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.retired = false; girl.retiredReason = undefined; girl.status = 'idle'; girl.contractEndDay = next.day + CONTRACT_DAYS; girl.pensionMissed = 0;
      girl.bond = Math.max(0, girl.bond - 5);
      next.logs.unshift({ id: `log-rehire-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `${girl.name}接受返聘，重新回到夜班名册。` });
      return { state: next, ok: true, message: `${girl.name}已返聘，契约重新生效。` };
    }
    case 'setAssistant': {
      const next = clone(state);
      if (!action.girlId) { next.assistantId = undefined; return { state: next, ok: true, message: '已取消值班助理。' }; }
      const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.bond < 40) return { state, ok: false, message: `${girl.name}还需要更多信任（羁绊 40）才能担任值班助理。` };
      next.assistantId = action.girlId;
      next.logs.unshift({ id: `log-assistant-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}开始担任值班助理，会替你整理议题与排班。` });
      return { state: next, ok: true, message: `${girl.name}成为值班助理。` };
    }
    case 'decideOpinion': {
      const next = clone(state); const opinion = next.opinions.find(o => o.id === action.opinionId);
      if (!opinion || opinion.status !== 'pending') return { state, ok: false, message: '这项议题已经处理过了。' };
      const author = findGirl(next, opinion.authorId);
      if (action.decision === 'accept') {
        const cost = opinion.topic === '经费' ? 600 : opinion.topic === '设施' ? 900 : opinion.topic === '同伴' ? 300 : 0;
        if (next.gold < cost) return { state, ok: false, message: `批准这项议题需要 ${cost} 星砂。` };
        next.gold -= cost; if (cost) book(next, next.day, -cost);
        opinion.status = 'accepted';
        if (author) author.bond = Math.min(100, author.bond + 3);
        next.logs.unshift({ id: `log-decide-${opinion.id}`, time: dateLabel(next.day, next.minutes), kind: 'council', text: `批准议题「${opinion.title}」。${cost ? `支出 ${cost} 星砂。` : '未产生额外支出。'}`, delta: -cost });
      } else if (action.decision === 'reject') {
        opinion.status = 'rejected';
        if (author) author.bond = Math.max(0, author.bond - 2);
        next.logs.unshift({ id: `log-decide-${opinion.id}`, time: dateLabel(next.day, next.minutes), kind: 'council', text: `驳回议题「${opinion.title}」。提出者没有当场说什么。` });
      } else {
        opinion.status = 'deferred';
        next.logs.unshift({ id: `log-decide-${opinion.id}`, time: dateLabel(next.day, next.minutes), kind: 'council', text: `议题「${opinion.title}」暂时搁置，留待下个议事日。` });
      }
      return { state: next, ok: true, message: `已处理「${opinion.title}」。` };
    }
    case 'startExpedition': {
      const next = clone(state);
      if (next.expeditions.length >= 1) return { state, ok: false, message: '星象台一次只能支持一支远行队伍。' };
      const observatory = next.rooms.find(r => r.type === 'observatory');
      if (!observatory) return { state, ok: false, message: '需要先建造星象台。' };
      if (action.memberIds.length < 1 || action.memberIds.length > 2) return { state, ok: false, message: '远行队伍需要 1–2 人。' };
      const members = action.memberIds.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
      if (members.length !== action.memberIds.length) return { state, ok: false, message: '队伍成员无效。' };
      for (const girl of members) {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}当前无法参加远行。` };
        if (inWithdrawal(girl)) return { state, ok: false, message: `${girl.name}正在断药期，无法远行。请先使用月蚀抑制剂。` };
        if (girl.pensionMissed >= 15) return { state, ok: false, message: `${girl.name}的契约欠约过久，请先续签。` };
        girl.status = 'expedition'; girl.roomId = observatory.id;
      }
      next.expeditions.push({ id: `exp-${next.day}-${next.minutes}-${next.expeditions.length}`, roomId: observatory.id, memberIds: members.map(g => g.id), startedDay: next.day, startedMinutes: next.minutes, cyclesDone: 0, lastSettledDay: next.day, lastSettledMinutes: next.minutes });
      next.logs.unshift({ id: `log-exp-start-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: `${members.map(g => g.name).join('、')}进入星象台远行，每 60 分钟结算一次观测结果。` });
      return { state: next, ok: true, message: '远行开始，星象台将每小时回报一次。' };
    }
    case 'recallExpedition': {
      const next = clone(state); const expedition = next.expeditions.find(e => e.id === action.expeditionId);
      if (!expedition) return { state, ok: false, message: '这支远行队伍已经结束。' };
      for (const id of expedition.memberIds) { const girl = findGirl(next, id); if (girl && girl.status === 'expedition') girl.status = 'idle'; }
      next.expeditions = next.expeditions.filter(e => e.id !== expedition.id);
      next.logs.unshift({ id: `log-exp-recall-${expedition.id}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: '星象台远行队伍提前返回，最后一轮观测未结算。' });
      return { state: next, ok: true, message: '远行队伍已返回。' };
    }
    case 'clinic': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.dead) return { state, ok: false, message: '她已不在名册上。' };
      if (action.mode === 'heal') {
        if (girl.status !== 'idle' && girl.status !== 'retired') return { state, ok: false, message: `${girl.name}当前无法接受治疗。` };
        if (next.gold < 240) return { state, ok: false, message: '快速治疗需要 240 星砂。' };
        next.gold -= 240; book(next, next.day, -240);
        girl.hp = girl.maxHp; girl.spirit = girl.maxSpirit; girl.fatigue = Math.min(100, girl.fatigue + 6);
        next.logs.unshift({ id: `log-clinic-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}在诊所接受快速治疗，血量与共情值恢复，但疲劳略有增加。`, delta: -240 });
        return { state: next, ok: true, message: `${girl.name}已完成快速治疗。` };
      }
      if (action.mode === 'rest') {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}正在忙，无法开始深度疗养。` };
        if (next.gold < 360) return { state, ok: false, message: '三天深度疗养需要 360 星砂。' };
        next.gold -= 360; book(next, next.day, -360);
        girl.status = 'resting'; girl.remaining = 3 * 1440; girl.clinicRest = true;
        next.logs.unshift({ id: `log-clinic-rest-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}开始为期三天的深度疗养，期间无法出勤。`, delta: -360 });
        return { state: next, ok: true, message: `${girl.name}开始深度疗养，三天后恢复。` };
      }
      if (action.mode === 'wipe') {
        if (girl.status === 'mission' || girl.status === 'expedition') return { state, ok: false, message: '出勤中的契约者无法进行记忆重塑。' };
        if (next.gold < 4000) return { state, ok: false, message: '记忆重塑需要 4,000 星砂。' };
        const oldLevel = girl.level;
        next.gold -= 4000; book(next, next.day, -4000);
        girl.level = 1; girl.exp = 0;
        girl.stats = { ...girl.baseStats };
        girl.baseMaxHp = Math.max(40, girl.baseMaxHp - (oldLevel - 1) * 4);
        girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
        girl.hp = girl.maxHp;
        girl.maxSpirit = Math.max(30, girl.maxSpirit - (oldLevel - 1) * 2);
        girl.spirit = girl.maxSpirit;
        girl.status = 'idle'; girl.remaining = 0; girl.conditions = [];
        next.logs.unshift({ id: `log-wipe-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}接受了记忆重塑。等级与能力回到起点，疤痕仍在。`, delta: -4000 });
        return { state: next, ok: true, message: `${girl.name}的能力已重塑至 1 级。` };
      }
      if (action.mode === 'clone') {
        if (girl.cloneOf || girl.generation) return { state, ok: false, message: '复制体不能再次被复制。' };
        if (girl.level < 3) return { state, ok: false, message: '只有 3 级以上的契约者可以进行复制。' };
        if (next.gold < 18000) return { state, ok: false, message: '复制契约需要 18,000 星砂。' };
        if (next.girls.filter(g => !g.dead).length >= capacity(next)) return { state, ok: false, message: '没有空余席位安置复制体。' };
        next.gold -= 18000; book(next, next.day, -18000);
        const seed = hashText(`${girl.id}:${next.day}:${next.minutes}`).toString(16).padStart(8, '0');
        const copy: Girl = {
          ...clone(girl), id: `g_${seed}`, name: `${girl.name}·复制体`, codename: `${girl.codename} II`, level: 1, exp: 0,
          stats: { ...girl.baseStats }, hp: girl.baseMaxHp, maxHp: girl.baseMaxHp, baseMaxHp: girl.baseMaxHp,
          spirit: Math.max(30, girl.maxSpirit - (girl.level - 1) * 2), maxSpirit: Math.max(30, girl.maxSpirit - (girl.level - 1) * 2),
          fatigue: 0, bond: 20, status: 'idle', roomId: 'lounge', remaining: 0, scars: [], conditions: [],
          relationships: {}, retired: false, dead: false, retiredReason: undefined, cloneOf: girl.id, generation: (girl.generation ?? 0) + 1,
          contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, missionId: undefined,
        };
        next.girls.push(copy);
        next.logs.unshift({ id: `log-clone-${copy.id}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `以${girl.name}为原体完成复制契约。复制体「${copy.name}」从 1 级开始。`, delta: -18000 });
        return { state: next, ok: true, message: `${copy.name}已加入名册。` };
      }
      return { state, ok: false, message: '未知的诊所项目。' };
    }
    case 'hire': {
      const next = clone(state); const candidate = next.candidates.find(g => g.id === action.girlId);
      if (!candidate) return { state, ok: false, message: '这位候选者已经不在名册上。' };
      if (next.gold < candidate.cost) return { state, ok: false, message: `星砂不足，还需要 ${candidate.cost - next.gold}。` };
      const used = next.girls.filter(g => !g.dead).length;
      if (used >= capacity(next)) return { state, ok: false, message: '基地席位已满，请先扩建宿舍或让资深契约者退役。' };
      next.gold -= candidate.cost;
      book(next, next.day, -candidate.cost);
      next.girls.push({ ...candidate, status: 'idle', roomId: 'lounge', remaining: 0, contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, retired: false, retiredReason: undefined });
      next.candidates = next.candidates.filter(g => g.id !== candidate.id);
      next.logs.unshift({ id: `log-hire-${candidate.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${candidate.name}缔结契约，事务所增加一位新的魔法少女。`, delta: -candidate.cost });
      next.opinions.unshift(makeOpinion(next, next.girls[next.girls.length - 1], '同伴', `欢迎${candidate.name}`, '新契约者已经住进宿舍。她想为对方准备一点什么。', '申请 300 星砂筹办一次小型欢迎会。'));
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
      girl.retired = true; girl.status = 'retired'; girl.retiredReason = 'injury';
      next.logs.unshift({ id: `log-retire-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}办理了退役，转任事务所文职。她的席位仍留在基地，并将按月领取退休金。` });
      return { state: next, ok: true, message: `${girl.name}已转为文职，不再参与派遣。` };
    }
    case 'changeOutfit': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.wardrobe.some(o => o.id === action.outfitId)) return { state, ok: false, message: '衣柜里没有这套服装。' };
      const key = `${action.outfitId}:${girl.expression ?? 'calm'}`;
      if (girl.importedVariants && Object.keys(girl.importedVariants).length && !girl.importedVariants[key] && girl.portrait?.startsWith('data:')) return { state, ok: false, message: '这套服装与当前表情的组合还没有导入立绘。' };
      girl.outfitId = action.outfitId;
      return { state: next, ok: true, message: `${girl.name}换上了「${girl.wardrobe.find(o => o.id === action.outfitId)?.name}」。` };
    }
    case 'setExpression': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      girl.expression = action.expression;
      return { state: next, ok: true, message: `${girl.name}的表情已切换。` };
    }
    case 'buyItem': {
      const next = clone(state);
      const entry = action.stockId
        ? next.marketStock.find(stock => stock.id === action.stockId)
        : next.marketStock.find(stock => !stock.sold && stock.itemId === action.itemId);
      if (!entry) return { state, ok: false, message: '今日货架已经售罄，明天会重新进货。' };
      if (entry.sold) return { state, ok: false, message: '这个货位今天已经售出，明天会刷新。' };
      const item = getItem(entry.itemId);
      if (!item) return { state, ok: false, message: '货架上没有这件物资。' };
      const standing = factionStanding(next, item.faction);
      if (standing < item.standingReq) return { state, ok: false, message: `${factionInfo[item.faction].name}声望需要 ${item.standingReq}，当前 ${standing}。` };
      if (item.id === 'tax-voucher' && (next.inventory['tax-voucher'] ?? 0) > 0) return { state, ok: false, message: '税补券每 7 日只能兑换一张。' };
      if (item.id === 'moon-drug' && (next.inventory['moon-drug'] ?? 0) >= 5) return { state, ok: false, message: '抑制剂最多囤积 5 支。' };
      const price = itemPrice(next, item);
      if (next.gold < price) return { state, ok: false, message: `购买需要 ${price} 星砂。` };
      next.gold -= price; book(next, next.day, -price);
      entry.sold = true;
      next.inventory[item.id] = (next.inventory[item.id] ?? 0) + 1;
      next.logs.unshift({ id: `log-buy-${entry.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `从${factionInfo[item.faction].name}购入「${item.name}」。`, delta: -price });
      return { state: next, ok: true, message: `已购入「${item.name}」，放入事务所仓库。` };
    }
    case 'equipItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId); const item = getItem(action.itemId);
      if (!girl || !item) return { state, ok: false, message: '找不到对应的契约者或装备。' };
      if (item.slot !== action.slot) return { state, ok: false, message: '这件物资不能装备到这个槽位。' };
      if ((next.inventory[item.id] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有这件装备。' };
      const previous = girl.equipment[action.slot];
      if (previous) next.inventory[previous] = (next.inventory[previous] ?? 0) + 1;
      next.inventory[item.id] -= 1;
      girl.equipment[action.slot] = item.id;
      girl.maxHp = effectiveMaxHp(girl); girl.hp = Math.min(girl.hp, girl.maxHp);
      girl.maxSpirit = effectiveMaxSpirit(girl); girl.spirit = Math.min(girl.spirit, girl.maxSpirit);
      return { state: next, ok: true, message: `${girl.name}装备了「${item.name}」。` };
    }
    case 'unequipItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到对应的契约者。' };
      const previous = girl.equipment[action.slot];
      if (!previous) return { state, ok: false, message: '这个槽位没有装备。' };
      next.inventory[previous] = (next.inventory[previous] ?? 0) + 1;
      delete girl.equipment[action.slot];
      girl.maxHp = effectiveMaxHp(girl); girl.hp = Math.min(girl.hp, girl.maxHp);
      girl.maxSpirit = effectiveMaxSpirit(girl); girl.spirit = Math.min(girl.spirit, girl.maxSpirit);
      return { state: next, ok: true, message: `${girl.name}卸下了「${getItem(previous)?.name ?? '装备'}」。` };
    }
    case 'useItem': {
      const next = clone(state); const girl = findGirl(next, action.girlId); const item = getItem(action.itemId);
      if (!girl || !item) return { state, ok: false, message: '找不到对应的契约者或物资。' };
      if ((next.inventory[item.id] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有这件物资。' };
      if (item.effect === 'drug') {
        if (!girl.witch) return { state, ok: false, message: '只有魔女需要月蚀抑制剂。' };
        next.inventory[item.id] -= 1;
        girl.drugUntilDay = next.day + 10; girl.withdrawalDays = 0; girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + 20);
        next.logs.unshift({ id: `log-use-drug-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}使用了月蚀抑制剂。断药状态结束，药效维持至第 ${girl.drugUntilDay} 日。` });
        return { state: next, ok: true, message: `${girl.name}的断药状态已解除。` };
      }
      if (item.effect === 'heal') {
        next.inventory[item.id] -= 1;
        girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + (item.amount ?? 40));
        return { state: next, ok: true, message: `${girl.name}恢复了 ${item.amount ?? 40} 点生命。` };
      }
      if (item.effect === 'purify') {
        next.inventory[item.id] -= 1;
        girl.corruption = Math.max(0, girl.corruption - (item.amount ?? 8));
        return { state: next, ok: true, message: `${girl.name}完成净化课程，侵蚀度下降。` };
      }
      if (item.effect === 'taxRefund') {
        next.inventory[item.id] -= 1;
        next.gold += item.amount ?? 1500; book(next, next.day, item.amount ?? 1500);
        return { state: next, ok: true, message: `税补券兑换为 ${item.amount ?? 1500} 星砂。` };
      }
      if (item.effect === 'contractDiscount') {
        next.inventory[item.id] = (next.inventory[item.id] ?? 1) - 1;
        next.inventory['permit'] = 1;
        return { state: next, ok: true, message: '执勤许可已激活，下一次签约金降低 10%。' };
      }
      return { state, ok: false, message: '这件物资需要在对应界面使用。' };
    }
    case 'acceptFactionTask': {
      const next = clone(state); const faction = action.faction; const info = next.factions[faction];
      if (!info) return { state, ok: false, message: '未知势力。' };
      if (info.envoyTaskId) return { state, ok: false, message: '今天已经接下这位代表的委托了。' };
      const mission = factionTask(next, faction);
      next.missions.unshift(mission);
      info.envoyTaskId = mission.id;
      next.logs.unshift({ id: `log-envoy-${faction}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'council', text: `接下${factionInfo[faction].name}代表${factionInfo[faction].envoy}的委托「${mission.title}」。` });
      return { state: next, ok: true, message: `${factionInfo[faction].envoy}把任务书推了过来。` };
    }
    case 'upgradeMarket': {
      const next = clone(state); const cost = marketUpgradeCost(next.marketLevel);
      if (!cost || next.marketLevel >= 4) return { state, ok: false, message: '市场已经达到最高等级。' };
      if (next.gold < cost) return { state, ok: false, message: `市场升级需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost); next.marketLevel += 1;
      refreshMarket(next);
      next.logs.unshift({ id: `log-market-${next.marketLevel}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `市场扩建至 ${next.marketLevel} 级，每日名册增加至 ${marketSize(next.marketLevel)} 位。`, delta: -cost });
      return { state: next, ok: true, message: `市场升至 ${next.marketLevel} 级。` };
    }
    case 'advancedRecruit': {
      const next = clone(state); const level = action.level;
      if (!Number.isInteger(level) || level < 1 || level > 6) return { state, ok: false, message: '高级招聘只能指定 1–6 级。' };
      if (level > next.marketLevel + 2) return { state, ok: false, message: `当前市场等级最多指定 ${next.marketLevel + 2} 级。` };
      if (next.advancedDay === next.day) return { state, ok: false, message: '今天已经进行过一次高级招聘。' };
      const cost = advancedCost(level);
      if (next.gold < cost.gold) return { state, ok: false, message: `高级招聘需要 ${cost.gold} 星砂。` };
      if (next.reputation < cost.stability) return { state, ok: false, message: `城市安定度不足，需要 ${cost.stability}。` };
      if (next.candidates.length >= 6) return { state, ok: false, message: '候选名册已满，请先签约或等待刷新。' };
      next.gold -= cost.gold; next.reputation -= cost.stability; book(next, next.day, -cost.gold);
      next.advancedDay = next.day;
      const girl = makeCandidate(next, level, next.day + level * 31);
      girl.candidateUntilDay = next.day + 3;
      next.candidates.push(girl);
      next.logs.unshift({ id: `log-advanced-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'dispatch', text: `通过协会渠道指定招募 ${level} 级候选者「${girl.name}」，城市安定度 -${cost.stability}。`, delta: -cost.gold });
      return { state: next, ok: true, message: `${girl.name}已加入候选名册，保留 3 天。` };
    }
    case 'createGirl': {
      const next = clone(state); const draft = action.draft;
      if (next.gold < 300) return { state, ok: false, message: '发布自定义契约需要 300 星砂登记费。' };
      if (next.candidates.length >= 6) return { state, ok: false, message: '候选名册已满。' };
      if (next.reputation < 40) return { state, ok: false, message: '城市安定度需要达到 40 才能撰写新契约。' };
      const stats = draft.stats;
      const sum = stats.magic + stats.insight + stats.agility + stats.empathy;
      if (Object.values(stats).some(v => !Number.isFinite(v) || v < 40 || v > 90) || sum !== 260) return { state, ok: false, message: '四维每项需在 40–90，且总和必须为 260。' };
      if (draft.skillIds.length !== 3 || new Set(draft.skillIds).size !== 3) return { state, ok: false, message: '请选择三个不同的技能。' };
      if (draft.traits.length > 3) return { state, ok: false, message: '最多选择三个特性。' };
      const baseMaxHp = Math.round(96 + stats.empathy * 0.3);
      const extra = draft.skillIds.reduce((acc, id) => acc + (getSkill(id).tier === 'ultimate' ? 700 : getSkill(id).tier === 'signature' ? 300 : 0), 0);
      const id = `g_${hashText(`${draft.name}:${next.day}:${next.minutes}:${next.candidates.length}`).toString(16).padStart(8, '0')}`;
      const girl = hydrate({
        id, name: draft.name, codename: draft.codename, title: draft.title, element: draft.element, color: draft.color,
        portrait: draft.portrait ?? '', level: 1, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp, spirit: 80, maxSpirit: 80,
        fatigue: 0, bond: 20, exp: 0, stats, baseStats: { ...stats }, status: 'idle', roomId: 'lounge', remaining: 0,
        skill: getSkill(draft.skillIds[2]).name, skills: draft.skillIds, description: draft.appearance, cost: 1800 + Math.max(0, sum - 260) * 40 + extra,
        scars: [], relationships: {}, archetype: draft.archetype, quote: draft.quote,
        goal: draft.goal, goalKind: '成长', traits: draft.traits.map(t => traitById.get(t)).filter((t): t is NonNullable<typeof t> => Boolean(t)), conditions: [],
        contractEndDay: next.day + 17, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: draft.appearance, personality: draft.personality, outfitDescription: draft.outfitDescription,
        wardrobe: [], outfitId: 'uniform', expression: 'calm', corruption: 0, equipment: {}, custom: true, candidateUntilDay: next.day + 7,
      });
      next.gold -= 300; book(next, next.day, -300);
      next.candidates.push(girl);
      next.logs.unshift({ id: `log-custom-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `新契约「${girl.name}」已发布到候选名册，保留 7 天。登记费 300 星砂。`, delta: -300 });
      return { state: next, ok: true, message: `${girl.name}已进入候选名册。` };
    }
    case 'setVariant': {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.portrait?.startsWith('data:')) return { state, ok: false, message: '只有导入立绘可以管理变体。' };
      if (!girl.importedVariants) girl.importedVariants = {};
      if (!girl.importedVariants[action.key] && Object.keys(girl.importedVariants).length >= 6) return { state, ok: false, message: '每名导入角色最多保存 6 张变体，请先删除旧变体。' };
      girl.importedVariants[action.key] = action.dataUrl;
      return { state: next, ok: true, message: '变体立绘已保存。' };
    }
    case 'reset': return { state: createInitialState(), ok: true, message: '事务所已回到第 14 日的夜晚。' };
    case 'setPoolLimit': {
      const next = clone(state);
      const value = Math.max(1, Math.min(40, Math.round(action.value)));
      next.poolLimits[action.pool] = value;
      return { state: next, ok: true, message: `${action.pool === 'missions' ? '事件池' : action.pool === 'monsters' ? '魔物池' : '市场池'}上限已设为 ${value}。` };
    }
    case 'deleteMission': {
      const target = state.missions.find(m => m.id === action.missionId);
      if (!target) return { state, ok: false, message: '没有找到这条事件。' };
      if (target.status === 'active') return { state, ok: false, message: '委托进行中，不能从事件池移除。' };
      const next = clone(state);
      next.missions = next.missions.filter(m => m.id !== action.missionId);
      next.logs.unshift({ id: `log-pool-${action.missionId}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `从事件池移除了「${target.title}」。` });
      return { state: next, ok: true, message: '事件已从池中移除。' };
    }
    case 'deleteCandidate': {
      const target = state.candidates.find(g => g.id === action.girlId);
      if (!target) return { state, ok: false, message: '没有找到这位候选者。' };
      const next = clone(state);
      next.candidates = next.candidates.filter(g => g.id !== action.girlId);
      return { state: next, ok: true, message: `${target.name} 的候选档案已移除。` };
    }
    case 'deleteMonster': {
      const target = monsters.find(m => m.id === action.monsterId);
      if (!target) return { state, ok: false, message: '没有找到这只魔物。' };
      if ((state.removedMonsters ?? []).includes(action.monsterId)) return { state, ok: false, message: '这只魔物已经离开魔物池。' };
      const next = clone(state);
      next.removedMonsters = [...(next.removedMonsters ?? []), action.monsterId];
      next.customMonsters = (next.customMonsters ?? []).filter(m => m.id !== action.monsterId);
      const affected = next.missions.filter(m => m.enemyIds?.includes(action.monsterId));
      next.missions = next.missions.filter(m => !m.enemyIds?.includes(action.monsterId) || m.status === 'active');
      for (const m of affected) if (m.status !== 'active') next.logs.unshift({ id: `log-pool-${m.id}-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'battle', text: `「${m.title}」因魔物被移出池而消散。` });
      return { state: next, ok: true, message: `${target.name} 已从魔物池移除。` };
    }
    case 'addGeneratedContent': {
      const open = state.missions.filter(m => m.status !== 'done').length;
      if (open >= state.poolLimits.missions) return { state, ok: false, message: '事件池已满，先移除一条事件再生成。' };
      if (state.candidates.length >= state.poolLimits.candidates) return { state, ok: false, message: '市场池已满，先移除一位候选者再生成。' };
      if (state.customMonsters.length + monsters.length - state.removedMonsters.length >= state.poolLimits.monsters) return { state, ok: false, message: '魔物池已满，先移除一只魔物再生成。' };
      if (state.missions.some(m => m.id === action.mission.id) || state.candidates.some(g => g.id === action.girl.id) || state.customMonsters.some(m => m.id === action.monster.id)) return { state, ok: false, message: '生成内容与现有条目重复。' };
      const next = clone(state);
      next.customMonsters.push(action.monster);
      next.candidates.push(action.girl);
      next.missions.push({ ...action.mission, generated: true, sourcePack: 'llm' });
      next.logs.unshift({ id: `log-gen-${Date.now()}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `叙事者提交了新的夜班提案：「${action.mission.title}」。市场里也出现了一位新候选者 ${action.girl.name}。` });
      return { state: next, ok: true, message: '新的委托已出现在地图上，候选者也已进入市场。' };
    }
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
  if (!['idle', 'mission', 'healing', 'resting', 'retired', 'expedition'].includes(g.status)) return false;
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
  if (value.version !== 3 && value.version !== 4 && value.version !== 5 && value.version !== 6) return createInitialState();
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
    state.version = 6;
    state.girls = state.girls.map(hydrate);
    state.candidates = Array.isArray(state.candidates) ? state.candidates.map(hydrate).slice(0, 6) : [];
    state.missions.forEach(m => { m.attempts ??= 0; m.squad ??= m.girlId ? [m.girlId] : []; m.recommendedLevel ??= 3; });
    state.memorial ??= []; state.battles = Array.isArray(state.battles) ? state.battles.slice(0, 20) : [];
    state.packHash ??= createSeedPack().hash;
    state.opinions = Array.isArray(state.opinions) ? state.opinions.slice(0, 30) : [];
    state.expeditions = Array.isArray(state.expeditions) ? state.expeditions.slice(0, 1) : [];
    state.councilDay ??= state.day; state.pensionDebt ??= 0;
    state.factions ??= { witch: { standing: 20, stockDay: state.day, envoyDay: state.day }, association: { standing: 50, stockDay: state.day, envoyDay: state.day }, government: { standing: 45, stockDay: state.day, envoyDay: state.day } };
    for (const faction of Object.keys(state.factions) as FactionId[]) {
      const f = state.factions[faction];
      f.standing = Math.max(0, Math.min(100, Number(f.standing) || 0));
      f.stockDay ??= state.day; f.envoyDay ??= state.day;
    }
    state.inventory = state.inventory && typeof state.inventory === 'object' ? state.inventory : {};
    const rawStock = Array.isArray(state.marketStock) ? state.marketStock : [];
    state.marketStock = rawStock.filter((entry): entry is MarketStockEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as MarketStockEntry;
      const item = getItem(candidate.itemId);
      return typeof candidate.id === 'string' && Boolean(item) && item!.faction === candidate.faction && typeof candidate.sold === 'boolean';
    }).slice(0, 24);
    for (const faction of Object.keys(state.factions) as FactionId[]) {
      if (!state.marketStock.some(entry => entry.faction === faction)) state.marketStock = state.marketStock.concat(makeFactionStock(faction, state.day));
    }
    state.marketStock = state.marketStock.filter((entry, index, list) => list.findIndex(other => other.id === entry.id) === index);
    state.marketLevel = Math.max(1, Math.min(4, Number(state.marketLevel) || 1));
    state.marketDay ??= state.day;
    state.boss ??= null; state.bossCycle ??= 0; state.nextBossDay ??= state.day + 2;
    state.customSkills ??= [];
    state.customMonsters ??= [];
    state.poolLimits ??= { missions: 12, monsters: 8, candidates: 6 };
    state.removedMonsters ??= [];
    return state;
  } catch { return createInitialState(); }
}
