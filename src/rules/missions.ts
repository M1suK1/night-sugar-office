import { MAX_ENEMIES, ROUND_MINUTES } from '../combat.ts';
import { spawnBossMonster } from '../content/bosses.ts';
import { factionInfo } from '../content/items.ts';
import { customMissionTemplates } from '../content/library.ts';
import { suggestedLevel } from '../missionLevel.ts';
import { MIN_REWARD, MISSION_REWARD_VERSION, missionRewardFor } from '../missionReward.ts';
import { gradeOfEnemies, missionLevelFor } from '../missionTier.ts';
import { extraMissions } from '../content/missions-extra.ts';
import { monsters } from '../content/monsters.ts';
import { createSeedPack } from '../content/seed-pack.ts';
import type { DistrictId } from '../districts.ts';
import { applyPct, districtAt, districts } from '../districts.ts';
import { factionRepresentativeOf } from '../factions.ts';
import { clampPollution, difficultyWeights, mergeDistrictEffects, pollutionEffect, pollutionForecast } from '../pollution.ts';
import type { CommissionWindow } from '../shift.ts';
import { LONG_MAX_DAYS, LONG_MIN_DAYS, WAVE_AT, absoluteMinutes, deadlineFor, remainingLabel, shiftStartAt } from '../shift.ts';
import { FACTION_ORDER, factionEffect } from '../territories.ts';
import type { BossTemplate, FactionId, GameState, Mission, MissionTemplate, MonsterTemplate, StatKey } from '../types.ts';
import { weatherAt, weatherEffect } from '../weather.ts';
import { clone, hashText } from './core.ts';
import { rollEnemies } from './encounters.ts';
// v35 从 src/game.ts 拆出：委托生成、模板与投放。

export const factionTaskTitle: Record<FactionId, string> = { witch: '月蚀庭的夜间取样', association: '星灯协会的失联信号', government: '市役所的封锁线缺口' };

export const factionEnemies: Record<FactionId, string[]> = { witch: ['mirror-nun', 'echo-cat'], association: ['sugar-moth', 'night-tram'], government: ['candy-king', 'echo-cat'] };

export const factionReward: Record<FactionId, number> = { witch: 900, association: 760, government: 820 };

export function factionTask(state: GameState, faction: FactionId): Mission {
  const representative = factionRepresentativeOf(state, faction);
  return annotateMission(state, {
    id: `envoy-${faction}-${state.day}`, title: factionTaskTitle[faction], category: `${factionInfo[faction].short} · 首领委托`,
    description: `${representative.name}把一份没有编号的任务书推过桌面。「今晚只交给你们。」`,
    x: 30 + (hashText(faction) % 40), y: 30 + (hashText(faction + state.day) % 40), difficulty: '中危', duration: 60,
    reward: factionReward[faction], requirement: faction === 'witch' ? 'empathy' : faction === 'association' ? 'insight' : 'agility',
    target: 74, color: factionInfo[faction].color, status: 'open', squad: [], work: 'combat', enemyIds: factionEnemies[faction],
    rounds: 4, attempts: 0, recommendedLevel: 5, faction, envoy: true,
  });
}

/** 会客厅预览用：只算出首领今天会交什么，不写状态。 */

/** 会客厅预览用：只算出首领今天会交什么，不写状态。 */
export function previewFactionTask(state: GameState, faction: FactionId): Mission {
  return factionTask(state, faction);
}

/** 按 Boss 模板造一份常驻委托。血量不走 `enemyHpOverride`，而由 `state.boss.hp` 每场接续。 */

/** 按 Boss 模板造一份常驻委托。血量不走 `enemyHpOverride`，而由 `state.boss.hp` 每场接续。 */
export function makeBossMission(state: GameState, boss: BossTemplate): Mission {
  const monsterId = spawnBossMonster(state, boss);
  return annotateMission(state, {
    id: `boss-${boss.id}-${state.day}`, title: boss.name, category: '城市级威胁',
    description: boss.blurb,
    x: 50, y: 18, difficulty: '绝望', duration: boss.duration, reward: boss.reward, requirement: 'magic', target: 95, window: 'long',
    color: boss.color, status: 'open', squad: [], work: 'combat', enemyIds: [monsterId],
    rounds: Math.max(3, Math.round(boss.duration / ROUND_MINUTES)), attempts: 0, recommendedLevel: boss.recommendedLevel, boss: true,
  });
}

/** 给任何来源的委托补上辖区、时段与接取时限（旧存档、派系、Boss、LLM 都走这里）。 */

/** 给任何来源的委托补上辖区、时段与接取时限（旧存档、派系、Boss、LLM 都走这里）。 */
export function annotateMission(state: GameState, mission: Mission, wave = 0): Mission {
  const district = mission.district ?? districtAt(mission.x, mission.y);
  const spawnAt = mission.spawnedAt ?? absoluteMinutes(state.day, state.minutes);
  const window: CommissionWindow = mission.window ?? (mission.duration >= 90 ? 'long' : 'urgent');
  // v161：战斗委托的档位与推荐等级跟实际编成走；已经被污染抬过档的（scaledFrom）不重算。
  const graded = mission.work === 'combat' && !mission.boss && !mission.scaledFrom && (mission.enemyIds?.length ?? 0) > 0
    ? (() => {
      const grade = gradeOfEnemies(mission.enemyIds!);
      return { difficulty: grade.tier, recommendedLevel: missionLevelFor(grade.tier, grade.count) };
    })()
    : {};
  const base: Mission = {
    ...mission,
    ...graded,
    enemyIds: mission.enemyIds ? mission.enemyIds.slice(0, MAX_ENEMIES) : mission.enemyIds,
    district, window, wave: mission.wave ?? wave,
    spawnedAt: spawnAt, deadlineAt: mission.deadlineAt ?? deadlineFor(window, state.day, spawnAt),
  };
  // 已有快照的委托不再重算：发出去之后辖区易主或被人净化，不能回头改动这一单。
  if (mission.environment) return base;
  const special = Boolean(mission.boss || mission.faction || mission.envoy || mission.storylineId);
  const reward = special ? mission.reward : missionRewardFor({
    work: base.work, difficulty: base.difficulty, duration: base.duration,
    enemyCount: base.enemyIds?.length ?? 0, window: base.window,
    longDays: base.longDays ?? (base.window === 'long' ? LONG_MIN_DAYS : undefined),
  });
  const snapshot = missionSnapshot(state, district, mission.target, reward);
  return {
    ...base,
    rewardVersion: special ? base.rewardVersion : MISSION_REWARD_VERSION,
    ...snapshot,
    reward: special ? snapshot.reward : Math.max(MIN_REWARD, snapshot.reward),
  };
}

/**
 * 把辖区当前的环境、污染与当主冻结成委托快照。
 *
 * 目标与报酬只在这里应用一次，快照本身也留在这份数据里，所以详情面板、战斗与结算
 * 读到的都是同一份口径。
 */

/**
 * 把辖区当前的环境、污染与当主冻结成委托快照。
 *
 * 目标与报酬只在这里应用一次，快照本身也留在这份数据里，所以详情面板、战斗与结算
 * 读到的都是同一份口径。
 */
export function missionSnapshot(state: GameState, district: DistrictId, target: number, reward: number): Pick<Mission, 'environment' | 'pollutionAtSpawn' | 'ownerAtSpawn' | 'target' | 'reward'> {
  const owner = state.territories?.[district] ?? FACTION_ORDER[0];
  const level = pollutionForecast(state, district).level;
  // 天气和辖区、污染一样，在发出的那一刻冻进快照：之后的雨不该改写这一单。
  const weather = weatherAt(state.day, state.minutes);
  const environment = mergeDistrictEffects(districts[district].effect, factionEffect[owner], pollutionEffect(level), weatherEffect(weather));
  return {
    environment,
    pollutionAtSpawn: level,
    ownerAtSpawn: owner,
    target: applyPct(target, environment.targetPct),
    reward: applyPct(reward, environment.rewardPct),
  };
}

/**
 * Boss 不撤离：`deadline` 字段留着给旧存档读，但不再参与判定。
 * 它在场就一直扣声望，直到被清掉——这是「拖延要付账」的唯一来源。
 */

// 委托模板池：seed-pack 的 7 条 + v24 补的 9 条 = 战斗 10 + 调查 6。
export const baseCommissionPool = [...createSeedPack().missions.filter(m => !m.boss), ...extraMissions];

/** 把自制委托模板转成可进入轮转池的委托快照；坐标与时限由 makeCommission 再算。 */

/** 把自制委托模板转成可进入轮转池的委托快照；坐标与时限由 makeCommission 再算。 */
export function missionSeed(template: MissionTemplate): Mission {
  return {
    id: `custom-${template.id}`,
    title: template.title,
    category: template.category,
    description: template.description,
    x: 50,
    y: 50,
    difficulty: template.difficulty,
    duration: template.duration,
    reward: missionRewardFor({ work: template.work, difficulty: template.difficulty, duration: template.duration, enemyCount: template.enemyIds.length }),
    rewardVersion: MISSION_REWARD_VERSION,
    requirement: template.requirement,
    target: template.target,
    color: template.color,
    status: 'open',
    squad: [],
    work: template.work,
    enemyIds: [...template.enemyIds].slice(0, MAX_ENEMIES),
    rounds: template.rounds,
    attempts: 0,
    recommendedLevel: template.recommendedLevel,
    district: template.district,
    window: template.window,
    rewardEquipmentId: template.rewardEquipmentId,
    rewardGirlLevel: template.rewardGirlLevel,
    generated: false,
    sourcePack: 'workshop',
    templateId: template.id,
  };
}

export function commissionPool(): Mission[] {
  return [...baseCommissionPool, ...customMissionTemplates().map(missionSeed)];
}

/** 蓝图「阶段委托」可以一键套用的现有委托模板。 */

/** 蓝图「阶段委托」可以一键套用的现有委托模板。 */
export interface MissionTemplateOption {
  id: string; title: string; category: string; description: string;
  difficulty: string; duration: number; requirement: StatKey; target: number;
  work: 'combat' | 'investigation'; monsters: MonsterTemplate[];
}

export function missionTemplates(): MissionTemplateOption[] {
  return commissionPool().map(template => ({
    id: template.id,
    title: template.title,
    category: template.category,
    description: template.description,
    difficulty: template.difficulty,
    duration: template.duration,
    requirement: template.requirement,
    target: template.target,
    work: template.work,
    monsters: (template.enemyIds ?? [])
      .map(id => monsters.find(monster => monster.id === id))
      .filter((monster): monster is MonsterTemplate => Boolean(monster)),
  }));
}

/** 地图像素尺寸：由辖区多边形顶点推出来，避免和 districts.ts 里的常量各写一份。 */
const mapScale = (() => {
  let w = 0;
  let h = 0;
  for (const region of Object.values(districts)) {
    for (const pair of region.points.trim().split(/\s+/)) {
      const [x, y] = pair.split(',').map(Number);
      if (Number.isFinite(x)) w = Math.max(w, x);
      if (Number.isFinite(y)) h = Math.max(h, y);
    }
  }
  return { w: w || 1100, h: h || 780 };
})();

/**
 * 把辖区标签换算成委托坐标。
 *
 * v38 之前是在辖区**标签点**附近抖 ±2%：一张地图上同一辖区的委托全挤成一小团。
 * 现在按多边形外接框做拒绝采样（落在别区就重抽），委托才会均匀铺在自己那一片里。
 */
export function districtPin(districtId: DistrictId, salt: string): { x: number; y: number } {
  const region = districts[districtId];
  const points = region.points.trim().split(/\s+/).map(pair => pair.split(',').map(Number));
  const xs = points.map(([x]) => (x / mapScale.w) * 100);
  const ys = points.map(([, y]) => (y / mapScale.h) * 100);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  for (let attempt = 0; attempt < 32; attempt++) {
    const seedX = hashText(`${districtId}:${salt}:x:${attempt}`);
    const seedY = hashText(`${districtId}:${salt}:y:${attempt}`);
    const x = Math.max(2, Math.min(98, minX + ((seedX % 4096) / 4096) * (maxX - minX)));
    const y = Math.max(3, Math.min(97, minY + ((seedY % 4096) / 4096) * (maxY - minY)));
    if (districtAt(x, y) === districtId) return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  }
  const baseX = (region.label.x / mapScale.w) * 100;
  const baseY = (region.label.y / mapScale.h) * 100;
  return { x: Math.round(baseX * 10) / 10, y: Math.round(baseY * 10) / 10 };
}

/** 随机抽取用的魔物池：剧情专属与 Boss 本体不进池，工坊删掉的也不算。 */

/** 污染度决定难度档：辖区越脏，高危与绝望越多。 */
export type DifficultyTier = '低危' | '中危' | '高危' | '绝望';

export function pickDifficulty(state: GameState, district: DistrictId, missionId: string, baseline?: DifficultyTier): DifficultyTier {
  const level = clampPollution(state.pollution?.[district] ?? 0);
  const weights: Record<DifficultyTier, number> = difficultyWeights(level);
  const order: DifficultyTier[] = ['低危', '中危', '高危', '绝望'];
  // 模板写的档位是锚点：辖区污染只在这一档上下浮动一档。
  // 不带锚点时才按旧行为全区间抽——「高危模板在干净辖区变成低危」正是这里缺了锚点。
  const anchor = baseline ? order.indexOf(baseline) : -1;
  const usable = order.map((tier, index) => ({ tier, weight: anchor < 0 || Math.abs(index - anchor) <= 1 ? weights[tier] : 0 }));
  const total = usable.reduce((sum, entry) => sum + entry.weight, 0);
  if (total <= 0) return baseline ?? '低危';
  let roll = hashText(`${missionId}:difficulty`) % total;
  for (const entry of usable) {
    roll -= entry.weight;
    if (roll < 0) return entry.tier;
  }
  return baseline ?? '低危';
}

/** 实际危险度与模板基线不同时给界面一句说明；一致时不显示。 */
export function missionBaselineNote(mission: Pick<Mission, 'difficulty' | 'scaledFrom'>): string | undefined {
  if (!mission.scaledFrom || mission.scaledFrom === mission.difficulty) return undefined;
  return `模板基线 ${mission.scaledFrom}`;
}

/** 抽到的难度反向缩放模板：低危更短更便宜，绝望更长更贵、目标更高。 */

/** 抽到的难度反向缩放模板：低危更短更便宜，绝望更长更贵、目标更高。 */
export const DIFFICULTY_SCALE: Record<DifficultyTier, { duration: number; reward: number; target: number; enemies: number[] }> = {
  低危: { duration: 0.85, reward: 0.75, target: 0.90, enemies: [2] },
  中危: { duration: 1.00, reward: 1.00, target: 1.00, enemies: [2, 3] },
  高危: { duration: 1.25, reward: 1.40, target: 1.10, enemies: [3] },
  绝望: { duration: 1.50, reward: 1.90, target: 1.20, enemies: [3, 4] },
};

export const TARGET_CEILING = 96;

/** 按辖区环境生成一份夜间委托。 */

export function makeCommission(state: GameState, wave: number, slot: number): Mission {
  const pool = commissionPool();
  // 同一时间还在板上的模板不再重复抽：先把没用过的用完，实在没有了才回到全部模板。
  const liveTemplates = new Set(state.missions
    .filter(mission => mission.status === 'open' || mission.status === 'active')
    .map(mission => mission.templateId ?? mission.id));
  const fresh = pool.filter(template => !liveTemplates.has(template.id));
  const source = fresh.length ? fresh : pool;
  const template = source[hashText(`${state.day}:${wave}:${slot}:${districts[districtOrderFor(state.day, wave, slot)].id}`) % source.length];
  const regionId = template.district ?? districtOrderFor(state.day, wave, slot);
  const region = districts[regionId];
  const window: CommissionWindow = template.window ?? (slot === 0 ? 'long' : 'urgent');
  const spawnAt = shiftStartAt(state.day) + WAVE_AT[wave];
  const pin = districtPin(regionId, `${state.day}-${wave}-${slot}`);
  const longDays = window === 'long'
    ? LONG_MIN_DAYS + (hashText(`long:${state.day}:${wave}:${slot}`) % (LONG_MAX_DAYS - LONG_MIN_DAYS + 1))
    : undefined;
  const id = `c-${state.day}-${wave}-${slot}-${template.id}`;
  // v24：难度由这一片辖区自己的污染度抽，再反向缩放模板；
  // 但模板写的 `difficulty` 是锚点——辖区污染只能在它上下浮动一档，
  // 否则同一张「高危」模板会在干净辖区变成「低危」，地图与工坊里看到的是两个数。
  const baseline = DIFFICULTY_SCALE[template.difficulty as DifficultyTier] ? template.difficulty as DifficultyTier : undefined;
  const difficulty = template.storylineId ? baseline ?? '中危' : pickDifficulty(state, regionId, id, baseline);
  const scale = DIFFICULTY_SCALE[difficulty] ?? DIFFICULTY_SCALE['中危'];
  const duration = Math.round(template.duration * scale.duration);
  // 战斗委托的具体敌人也在这里抽：模板只写了要几只。
  const count = template.work === 'combat'
    ? ((template.enemyIds?.length ?? 0) > 0 && template.storylineId ? (template.enemyIds ?? []).length : (template.enemyCount ?? scale.enemies[hashText(`${id}:count`) % scale.enemies.length] ?? 2))
    : 0;
  const baseTarget = Math.round(template.target * scale.target);
  const baseReward = missionRewardFor({ work: template.work, difficulty, duration, enemyCount: count, window, longDays });
  const snapshot = missionSnapshot(state, regionId, baseTarget, baseReward);
  const target = Math.min(TARGET_CEILING, snapshot.target + (longDays ? (longDays - 2) * 2 : 0));
  const reward = Math.max(MIN_REWARD, snapshot.reward);
  const spawned = template.work === 'combat' ? rollEnemies(state, { count, difficulty, pollution: snapshot.pollutionAtSpawn ?? 0, missionId: id }) : { ids: [], buffs: [] };
  const enemyIds = template.storylineId ? template.enemyIds : spawned.ids;
  return {
    ...clone(template),
    id,
    difficulty,
    scaledFrom: template.storylineId ? undefined : template.difficulty,
    enemyIds,
    enemyBuffs: enemyIds?.length ? spawned.buffs : undefined,
    enemyCount: undefined,
    duration,
    recommendedLevel: template.storylineId
      ? template.recommendedLevel
      : Math.max(1, Math.min(10, Math.max(template.recommendedLevel ?? 0, suggestedLevel(difficulty, enemyIds?.length ?? count)))),
    district: regionId,
    window,
    wave,
    longDays,
    spawnedAt: spawnAt,
    deadlineAt: deadlineFor(window, state.day, spawnAt, longDays),
    x: pin.x,
    y: pin.y,
    target,
    reward,
    rewardVersion: MISSION_REWARD_VERSION,
    environment: snapshot.environment,
    pollutionAtSpawn: snapshot.pollutionAtSpawn,
    ownerAtSpawn: snapshot.ownerAtSpawn,
    color: template.templateId ? template.color : `rgb(${region.tint})`,
    category: `${region.name} · ${template.category}`,
    status: 'open',
    squad: [],
    girlId: undefined,
    attempts: 0,
    rounds: template.rounds ?? Math.max(2, Math.floor(template.duration / ROUND_MINUTES)),
    generated: false,
    sourcePack: 'shift',
  };
}

/**
 * 把一份模板变成当前夜晚可接的委托。
 *
 * `options.district` 用来轮换辖区（池子补货时按顺序铺开）；
 * `options.fromPool` 标记这条是本地池子补的，不是工坊投放的测试件。
 */
export function deployMissionTemplate(state: GameState, template: MissionTemplate, options: { district?: DistrictId; fromPool?: boolean } = {}): Mission {
  const regionId = options.district ?? template.district ?? districtOrderFor(state.day, state.shift.wave, 0);
  const region = districts[regionId];
  const pin = districtPin(regionId, `pool-${template.id}-${state.day}-${state.minutes}-${state.missions.length}`);
  const window = template.window ?? 'urgent';
  const spawnAt = absoluteMinutes(state.day, state.minutes);
  const longDays = window === 'long' ? LONG_MIN_DAYS : undefined;
  const seeded = missionSeed(template);
  const baseReward = missionRewardFor({
    work: template.work, difficulty: template.difficulty, duration: template.duration,
    enemyCount: template.enemyIds.length, window, longDays,
  });
  // 投放测试的委托同样要冻结环境：否则工坊里看到的数值和玩家接到的不是一份。
  const snapshot = missionSnapshot(state, regionId, seeded.target, baseReward);
  return {
    ...seeded,
    target: snapshot.target,
    reward: Math.max(MIN_REWARD, snapshot.reward),
    rewardVersion: MISSION_REWARD_VERSION,
    environment: snapshot.environment,
    pollutionAtSpawn: snapshot.pollutionAtSpawn,
    ownerAtSpawn: snapshot.ownerAtSpawn,
    id: `w-${state.day}-${state.minutes}-${state.missions.length}-${template.id}`,
    district: regionId,
    window,
    longDays,
    spawnedAt: spawnAt,
    deadlineAt: deadlineFor(window, state.day, spawnAt, longDays),
    x: pin.x,
    y: pin.y,
    category: `${region.name} · ${template.category}`,
    status: 'open',
    squad: [],
    girlId: undefined,
    attempts: 0,
    rounds: template.rounds,
    ...(options.fromPool ? { generated: true, sourcePack: 'pool' as const } : {}),
  };
}

/** 把工坊里的弹窗事件卡快照成当前夜晚的 Incident；之后删卡不会破坏已有存档。 */

export const districtRotation = ['candy', 'station', 'plaza', 'greenhouse', 'cathedral', 'crossroad', 'oldtown', 'clocktower', 'docks'] as const;

export function districtOrderFor(day: number, wave: number, slot: number): DistrictId {
  return districtRotation[(day * 3 + wave * 4 + slot * 7) % districtRotation.length];
}

/**
 * 推进时间或换日之后调用：先让过期的委托退场，再把该出现的时段委托放上地图。
 * 返回本次变动条数，方便上层决定要不要提示。
 */

export function missionDeadlineLabel(mission: Mission, state: GameState): string {
  if (mission.deadlineAt === undefined) return '';
  return remainingLabel(mission.deadlineAt, absoluteMinutes(state.day, state.minutes));
}

// ---------------------------------------------------------------- 辖区易主
