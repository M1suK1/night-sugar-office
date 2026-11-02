import type { DistrictId } from '../districts.ts';
import type { GameState, Mission, MissionTemplate } from '../types.ts';
import { createSeedPack } from '../content/seed-pack.ts';
import { customMissionTemplates } from '../content/library.ts';
import { extraMissions } from '../content/missions-extra.ts';
import { spawnableMonsters } from './encounters.ts';
import { deployMissionTemplate, districtOrderFor } from './missions.ts';
// v35 从 src/game.ts 拆出：委托池与魔物池的维护。

export function missionKey(mission: Pick<Mission, 'title' | 'description'>): string {
  return `${mission.title}\u0000${mission.description}`.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function missionKeyTaken(state: GameState, mission: Pick<Mission, 'title' | 'description'>): boolean {
  const key = missionKey(mission);
  return state.missions.some(existing => missionKey(existing) === key);
}

/** 地图上同时存在的委托总数：固定 12；做完或超时就从模板补回来。 */
export const MISSION_POOL_SIZE = 12;

/**
 * 把地图上的委托补到 12 条。
 *
 * 只从真实模板里拿（种子包 + `missions-extra` + 自制委托），**不再复制编号**：
 * 以前那种 `标题 · 辖区记录017` 只是把同一个模板换个名字，玩家两天就看穿了。
 * 同一个模板在同一时间最多出现一次；模板用完了就让它少几条，也不造假。
 */
export function ensureMissionPools(state: GameState): number {
  const cap = MISSION_POOL_SIZE;
  const liveCount = state.missions.filter(mission => mission.status === 'open' || mission.status === 'active').length;
  if (liveCount >= cap) {
    state.poolLimits.missions = cap;
    return 0;
  }
  const taken = new Set(state.missions
    .filter(mission => mission.status === 'open' || mission.status === 'active')
    .map(mission => mission.templateId ?? mission.id));
  // 真实模板：种子包 + 自制委托。种子包里的模板可能没写敌人，补一只池子里的魔物兜底。
  const fallbackEnemy = spawnableMonsters(state)[0]?.id;
  const templates = [...createSeedPack().missions.filter(template => !template.boss), ...extraMissions, ...customMissionTemplates()]
    .filter(template => !(template as { storylineId?: string }).storylineId && !taken.has(template.id))
    .map(template => ({
      ...template,
      enemyIds: template.enemyIds?.length ? template.enemyIds : fallbackEnemy ? [fallbackEnemy] : [],
      rounds: template.rounds ?? 3,
      recommendedLevel: template.recommendedLevel ?? 3,
    })) as unknown as MissionTemplate[];
  let added = 0;
  for (const template of templates) {
    if (liveCount + added >= cap) break;
    const district = (template.district ?? districtOrderFor(state.day, state.shift.wave, added)) as DistrictId;
    const mission = deployMissionTemplate(state, template, { district, fromPool: true });
    if (state.missions.some(existing => existing.id === mission.id)) continue;
    state.missions.push(mission);
    added += 1;
  }
  state.poolLimits.missions = cap;
  return added;
}

/** 新增 LLM 委托后压回容量：板上始终只留 12 条，超出的自动生成委托先淘汰。 */
export function trimMissionPools(state: GameState): void {
  const live = state.missions.filter(mission => mission.status === 'open' || mission.status === 'active');
  let excess = live.length - MISSION_POOL_SIZE;
  if (excess <= 0) return;
  // 从最旧的开始淘汰：新生成的委托（使者、提案）刚 push 到末尾，不能被自己挤掉。
  for (const mission of [...live]) {
    if (excess <= 0) break;
    if (mission.status !== 'open' || !mission.generated || mission.sourcePack === 'story') continue;
    state.missions = state.missions.filter(item => item.id !== mission.id);
    excess -= 1;
  }
}

/**
 * 魔物池：只认真实魔物，不再复制。
 *
 * v32 会把基础魔物轮流复制成 `名字·3`、`档案第 3 号` 来凑到 50 只——那是占位不是内容。
 * 现在只清理这些旧副本；真正的魔物来自 `content/monsters` 与内容工坊，缺了就该补内容而不是编号。
 */
export function ensureMonsterPool(state: GameState): number {
  const before = (state.customMonsters ?? []).length;
  state.customMonsters = (state.customMonsters ?? []).filter(monster => !/^pool-mon-/.test(monster.id));
  // 魔物池容量跟着真实内容走：有几只算几只，不拿编号副本把数字撑到 50。
  const real = spawnableMonsters(state).length;
  state.poolLimits.monsters = Math.min(state.poolLimits.monsters ?? real, real);
  return before - state.customMonsters.length;
}

/** 地图只保留未完成、或当天刚完成的委托；换日后旧完成记录退回档案。 */

/** 地图只保留未完成、或当天刚完成的委托；换日后旧完成记录退回档案。 */
export function missionVisibleOnMap(mission: Mission, day: number): boolean {
  return mission.status !== 'done' || (mission.completedDay ?? 0) >= day;
}
/** 真正占床位的在册成员：退役转文职、离队与死亡都不再占席位。 */
