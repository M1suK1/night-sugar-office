import { BOSS_MONSTER_PREFIX } from '../content/bosses.ts';
import { monsters } from '../content/monsters.ts';
import { createSeedPack } from '../content/seed-pack.ts';
import type { DistrictId } from '../districts.ts';
import { districts } from '../districts.ts';
import type { GameState, Mission, MissionTemplate, MonsterTemplate } from '../types.ts';
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

/** 把地图委托补到战斗/调查各自的容量；只补缺口，标题与描述必须唯一。 */

/** 把地图委托补到战斗/调查各自的容量；只补缺口，标题与描述必须唯一。 */
export function ensureMissionPools(state: GameState): number {
  const combatCap = state.poolLimits.combatMissions ?? 120;
  const investigationCap = state.poolLimits.investigationMissions ?? 20;
  const initialKeys = new Set<string>();
  for (const mission of state.missions) {
    let key = missionKey(mission);
    if (initialKeys.has(key)) {
      mission.title = `${mission.title} · 档案补记`;
      mission.description = `${mission.description}（同名委托的另一份档案。）`;
      key = missionKey(mission);
    }
    initialKeys.add(key);
  }
  const live = (work: 'combat' | 'investigation') => state.missions.filter(mission => mission.work === work && (mission.status === 'open' || mission.status === 'active')).length;
  const templates = createSeedPack().missions;
  const used = new Set(state.missions.map(missionKey));
  let added = 0;
  for (const [work, cap] of [['combat', combatCap], ['investigation', investigationCap]] as const) {
    const pool = templates.filter(template => template.work === work);
    if (!pool.length) continue;
    let count = live(work);
    let variant = 0;
    while (count < cap && variant < cap * 4) {
      const base = pool[variant % pool.length] as unknown as MissionTemplate;
      const regionId = (base.district ?? districtOrderFor(state.day, state.shift.wave, variant)) as DistrictId;
      const region = districts[regionId];
      const title = `${base.title} · ${region.name}记录${String(variant + 1).padStart(3, '0')}`;
      const description = `${base.description}（${region.name}的第 ${variant + 1} 次现场记录。）`;
      const key = missionKey({ title, description });
      variant += 1;
      if (used.has(key)) continue;
      const seedMonster = spawnableMonsters(state)[variant % Math.max(1, spawnableMonsters(state).length)]?.id;
      const mission = deployMissionTemplate(state, {
        id: base.id,
        title,
        category: base.category,
        description,
        difficulty: base.difficulty as MissionTemplate['difficulty'],
        color: base.color,
        duration: base.duration,
        requirement: base.requirement,
        target: base.target,
        work: base.work,
        enemyIds: base.enemyIds?.length ? base.enemyIds : seedMonster ? [seedMonster] : [],
        rounds: base.rounds ?? 3,
        recommendedLevel: base.recommendedLevel ?? 3,
        district: regionId,
        window: base.window,
        reward: base.reward,
        rewardEquipmentId: base.rewardEquipmentId,
        rewardGirlLevel: base.rewardGirlLevel ?? 0,
      });
      mission.generated = true;
      mission.sourcePack = 'pool';
      state.missions.push(mission);
      used.add(key);
      count += 1;
      added += 1;
    }
  }
  state.poolLimits.missions = Math.max(state.poolLimits.missions ?? 0, combatCap + investigationCap);
  return added;
}

/** 新增 LLM 委托后压回容量；只淘汰自动生成、未派遣的旧委托。 */

/** 新增 LLM 委托后压回容量；只淘汰自动生成、未派遣的旧委托。 */
export function trimMissionPools(state: GameState): void {
  for (const [work, cap] of [['combat', state.poolLimits.combatMissions ?? 120], ['investigation', state.poolLimits.investigationMissions ?? 20]] as const) {
    let live = state.missions.filter(mission => mission.work === work && (mission.status === 'open' || mission.status === 'active'));
    while (live.length > cap) {
      const victim = live.find(mission => mission.status === 'open' && mission.generated && mission.sourcePack !== 'story');
      if (!victim) break;
      state.missions = state.missions.filter(mission => mission.id !== victim.id);
      live = live.filter(mission => mission.id !== victim.id);
    }
  }
}

/** 魔物池由本地变体补到容量；不再依赖每日 LLM 产怪。 */

/** 魔物池由本地变体补到容量；不再依赖每日 LLM 产怪。 */
export function ensureMonsterPool(state: GameState): number {
  const cap = state.poolLimits.monsters ?? 50;
  const removed = new Set(state.removedMonsters ?? []);
  const existing = new Set((state.customMonsters ?? []).map(monster => monster.id));
  const bases = monsters.filter(monster => !monster.storyOnly && !monster.bossOnly && !monster.id.startsWith(BOSS_MONSTER_PREFIX) && !removed.has(monster.id));
  if (!bases.length) return 0;
  let index = 0;
  let added = 0;
  while ((state.customMonsters ?? []).filter(monster => !monster.id.startsWith(BOSS_MONSTER_PREFIX)).length < cap && index < cap * 3) {
    const base = bases[index % bases.length];
    const id = `pool-mon-${state.day}-${index}`;
    index += 1;
    if (existing.has(id) || removed.has(id)) continue;
    const copy: MonsterTemplate = {
      ...base,
      id,
      name: `${base.name}·${index}`,
      epithet: `${base.epithet}（档案第 ${index} 号）`,
      description: `${base.description} 这是事务所档案中编号 ${index} 的同类记录。`,
      spec: { ...base.spec },
      rules: [...(base.rules ?? [])],
    };
    state.customMonsters = [...(state.customMonsters ?? []), copy];
    existing.add(id);
    added += 1;
  }
  return added;
}
/** 地图只保留未完成、或当天刚完成的委托；换日后旧完成记录退回档案。 */

/** 地图只保留未完成、或当天刚完成的委托；换日后旧完成记录退回档案。 */
export function missionVisibleOnMap(mission: Mission, day: number): boolean {
  return mission.status !== 'done' || (mission.completedDay ?? 0) >= day;
}
/** 真正占床位的在册成员：退役转文职、离队与死亡都不再占席位。 */
