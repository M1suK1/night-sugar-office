import type {
  BattleOutcome,
  Element,
  GameState,
  Girl,
  MaterialId,
  Mission,
  Monster,
} from './types.ts';
import { materials } from './content/materials.ts';
import { dateLabel, hashText } from './rules/core.ts';

const ELEMENT_TO_MATERIAL: Record<Element, MaterialId> = {
  '星光系': 'mat-stardust',
  '糖霜系': 'mat-frosting',
  '月影系': 'mat-moonlight',
  '梦境系': 'mat-dream',
  '自然系': 'mat-nature',
  '赤焰系': 'mat-cinder',
  '魔物': 'mat-stardust',
};

function baseAmountForRank(rank?: Monster['rank']): number {
  switch (rank) {
    case '王座':
      return 3;
    case '灾厄':
      return 2;
    case '游荡':
    case '碎屑':
    default:
      return 1;
  }
}

/**
 * 战后材料掉落纯计算函数（v180）。
 *
 * 挂钩小队人数（1–4 人分别对应 1.0x / 1.25x / 1.5x / 1.75x 搜刮倍率），
 * 且每位出勤少女根据自身元素系别进行共鸣拾取判定（40% 几率额外带回 1 份同属性材料）。
 */
export function calculateBattleDrops(
  enemies: Monster[],
  squad: Girl[],
  outcome: BattleOutcome,
  seed: string,
): Record<MaterialId, number> {
  if (outcome === 'defeat' || outcome === 'repelled') return {} as Record<MaterialId, number>;
  const drops: Partial<Record<MaterialId, number>> = {};
  const isPartial = outcome === 'draw' || outcome === 'failure';

  const squadCount = Math.max(1, Math.min(4, squad.length));
  const squadMultiplier = 1 + (squadCount - 1) * 0.25;

  for (const enemy of enemies) {
    const matId = ELEMENT_TO_MATERIAL[enemy.element] ?? 'mat-stardust';
    let amount = baseAmountForRank(enemy.rank);
    if ((enemy as { elite?: boolean }).elite) amount += 1;
    drops[matId] = (drops[matId] ?? 0) + amount;
  }

  // 结算人数系数加成与部分胜利折半
  for (const key of Object.keys(drops) as MaterialId[]) {
    const raw = drops[key]!;
    const scaled = Math.floor(raw * squadMultiplier);
    drops[key] = isPartial ? Math.max(0, Math.floor(scaled / 2)) : scaled;
  }

  // 参战队员系别共鸣额外拾取（确定性种子）
  squad.forEach((girl, index) => {
    const hash = Math.abs(hashText(`${seed}:resonance:${girl.id}:${index}`));
    if (hash % 100 < 40) {
      const matId = ELEMENT_TO_MATERIAL[girl.element];
      if (matId) {
        drops[matId] = (drops[matId] ?? 0) + 1;
      }
    }
  });

  const result: Partial<Record<MaterialId, number>> = {};
  for (const [k, v] of Object.entries(drops)) {
    if (v && v > 0) result[k as MaterialId] = v;
  }
  return result as Record<MaterialId, number>;
}

/**
 * 战后发放材料并记入仓库与日志（v180）。
 */
export function grantBattleDrops(
  state: GameState,
  mission: Mission,
  enemies: Monster[],
  squad: Girl[],
  outcome: BattleOutcome,
): Record<MaterialId, number> {
  const seed = `drop:${mission.id}:${state.day}:${state.minutes}`;
  const drops = calculateBattleDrops(enemies, squad, outcome, seed);
  const entries = Object.entries(drops);
  if (!entries.length) return {} as Record<MaterialId, number>;

  for (const [matId, count] of entries) {
    state.inventory[matId] = (state.inventory[matId] ?? 0) + count;
  }

  const matNames = entries
    .map(([id, count]) => {
      const m = materials.find(item => item.id === id);
      return `${m?.name ?? id} ×${count}`;
    })
    .join('、');

  state.logs.unshift({
    id: `log-drop-${mission.id}-${state.day}-${state.minutes}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'battle',
    text: `在「${mission.title}」战场搜集到材料：${matNames}（已收入装备仓库）。`,
  });

  return drops;
}
