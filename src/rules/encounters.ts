import { MAX_ENEMIES } from '../combat.ts';
import { BOSS_MONSTER_PREFIX } from '../content/bosses.ts';
import { ELITE_IDS } from '../content/eliteBuffs.ts';
import { monsters } from '../content/monsters.ts';
import type { GameState, Incident, IncidentCard, IncidentEffect, MonsterTemplate } from '../types.ts';
import { hashText } from './core.ts';
// v35 从 src/game.ts 拆出：敌群与精英判定。

/** 随机抽取用的魔物池：剧情专属与 Boss 本体不进池，工坊删掉的也不算。 */
export function spawnableMonsters(state: GameState): MonsterTemplate[] {
  const removed = new Set(state.removedMonsters ?? []);
  const all = [...monsters, ...(state.customMonsters ?? [])];
  const seen = new Set<string>();
  return all.filter(monster => {
    if (!monster || !monster.id) return false;
    if (seen.has(monster.id)) return false;
    if (monster.storyOnly || monster.bossOnly) return false;
    if (monster.id.startsWith(BOSS_MONSTER_PREFIX)) return false;
    if (removed.has(monster.id)) return false;
    seen.add(monster.id);
    return true;
  });
}

/** 精英概率：低危 0，中危 8/15/25，高危 35/50/60（按污染 0 / ≥50 / ≥80）。 */

/** 精英概率：低危 0，中危 8/15/25，高危 35/50/60（按污染 0 / ≥50 / ≥80）。 */
export function eliteChance(difficulty: string, pollution: number): number {
  const tier = pollution >= 80 ? 2 : pollution >= 50 ? 1 : 0;
  if (difficulty === '中危') return [8, 15, 25][tier];
  if (difficulty === '高危') return [35, 50, 60][tier];
  if (difficulty === '绝望') return 100;
  return 0;
}

export interface SpawnedEnemies { ids: string[]; buffs: (string | null)[]; }

/**
 * 按难度与污染抽敌人。
 *
 * 全部走 `hashText(missionId + …)`：同一单在同一天刷新出的结果稳定，测试可以钉死，
 * 玩家重开也不会刷出另一批怪。
 */

/**
 * 按难度与污染抽敌人。
 *
 * 全部走 `hashText(missionId + …)`：同一单在同一天刷新出的结果稳定，测试可以钉死，
 * 玩家重开也不会刷出另一批怪。
 */
export function rollEnemies(state: GameState, opts: { count: number; difficulty: string; pollution: number; missionId: string }): SpawnedEnemies {
  const pool = spawnableMonsters(state);
  if (!pool.length) return { ids: [], buffs: [] };
  const count = Math.max(1, Math.min(MAX_ENEMIES, opts.count));
  const ids: string[] = [];
  const buffs: (string | null)[] = [];
  for (let index = 0; index < count; index++) {
    const seed = hashText(`${opts.missionId}:enemy:${index}:${opts.difficulty}`);
    // 同一单里尽量避免重复：先按 seed 取，撞了就往后挪一格。
    let pick = pool[seed % pool.length];
    for (let attempt = 0; attempt < pool.length && ids.includes(pick.id); attempt++) {
      pick = pool[(seed + attempt + 1) % pool.length];
    }
    ids.push(pick.id);
    buffs.push(null);
  }
  // 每次最多一只精英：Boss 战不挂（阶段添怪已经是普通怪，再叠容易爆）。
  const chance = eliteChance(opts.difficulty, opts.pollution);
  if (chance > 0 && hashText(`${opts.missionId}:buff-roll`) % 100 < chance) {
    const slot = hashText(`${opts.missionId}:buff-slot`) % ids.length;
    buffs[slot] = ELITE_IDS[hashText(`${opts.missionId}:buff-pick`) % ELITE_IDS.length];
  }
  return { ids, buffs };
}

/** 污染度决定难度档：辖区越脏，高危与绝望越多。 */

/** 把工坊里的弹窗事件卡快照成当前夜晚的 Incident；之后删卡不会破坏已有存档。 */
export function deployIncidentCard(state: GameState, card: IncidentCard): Incident {
  return {
    id: `incident-${card.id}-${state.day}-${state.minutes}-${state.incidents.length}`,
    cardId: card.id,
    day: state.day,
    kind: card.kind,
    source: 'custom',
    title: card.title,
    body: card.body,
    faction: card.faction,
    girlId: card.girlId,
    district: card.district,
    options: card.options.map((option, index) => {
      const { district, ...rest } = option.effect;
      const effect: IncidentEffect = { ...rest };
      if (district) {
        effect.district = {
          id: district.id,
          targetPct: district.targetPct,
          rewardPct: district.rewardPct,
          untilDay: state.day + district.days,
        };
      }
      return { id: `opt-${index + 1}`, label: option.label, hint: option.hint, effect };
    }),
    status: 'pending',
  };
}
