import type {
  Affix,
  AffixKind,
  AffixTier,
  Equipment,
  EquipmentTier,
  GameState,
  MaterialId,
} from './types.ts';
import { findEquipmentSet } from './content/sets.ts';
import { findMaterial } from './content/materials.ts';
import { findItem, registerItem, rememberGeneratedItem } from './content/items.ts';
import { book, dateLabel, findGirl, hashText } from './rules/core.ts';
import { effectiveMaxHp, effectiveMaxSpirit } from './economy.ts';

export const MAX_AFFIXES_PER_ITEM = 3;

export interface AffixSpec {
  kind: AffixKind;
  name: string;
  description: string;
  amounts: Record<AffixTier, number>;
}

export const AFFIX_SPECS: AffixSpec[] = [
  {
    kind: 'magic',
    name: '锋锐',
    description: '引动魔力涡流，直接提升魔力属性。',
    amounts: { 1: 2, 2: 4, 3: 7, 4: 11, 5: 16 },
  },
  {
    kind: 'insight',
    name: '敏锐',
    description: '校准术式焦点，提升洞察属性。',
    amounts: { 1: 2, 2: 4, 3: 7, 4: 11, 5: 16 },
  },
  {
    kind: 'agility',
    name: '轻捷',
    description: '削减法术阻力，提升敏捷属性。',
    amounts: { 1: 2, 2: 4, 3: 7, 4: 11, 5: 16 },
  },
  {
    kind: 'empathy',
    name: '温存',
    description: '凝聚共鸣愿力，提升共情属性（并等比增加心防上限）。',
    amounts: { 1: 2, 2: 4, 3: 7, 4: 11, 5: 16 },
  },
  {
    kind: 'damageReduce',
    name: '坚毅',
    description: '构筑偏折护层，降低受到的全类型伤害百分比。',
    amounts: { 1: 2, 2: 4, 3: 7, 4: 11, 5: 16 },
  },
  {
    kind: 'maxHp',
    name: '生机',
    description: '滋养灵体生命力，提升生命上限。',
    amounts: { 1: 10, 2: 20, 3: 35, 4: 55, 5: 80 },
  },
  {
    kind: 'initiative',
    name: '先声',
    description: '加速术式展开，提升出手速度与先手值。',
    amounts: { 1: 2, 2: 4, 3: 6, 4: 9, 5: 12 },
  },
  {
    kind: 'damageBonus',
    name: '灼痕',
    description: '烙印破甲附魔，提升直接造成的伤害百分比。',
    amounts: { 1: 3, 2: 6, 3: 10, 4: 15, 5: 20 },
  },
];

const ROMAN_NUMERALS: Record<AffixTier, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
};

/**
 * 装备阶级严格决定精炼词条的最大阶级上限（v182）。
 */
export function rollAffixTierForEquipment(tier: EquipmentTier, seed: number): AffixTier {
  const rollPct = (seed % 100) + 1;
  switch (tier) {
    case 1:
      return 1;
    case 2:
      return rollPct <= 60 ? 1 : 2;
    case 3:
      if (rollPct <= 20) return 1;
      if (rollPct <= 70) return 2;
      return 3;
    case 4:
      if (rollPct <= 25) return 2;
      if (rollPct <= 75) return 3;
      return 4;
    case 5:
      if (rollPct <= 35) return 3;
      if (rollPct <= 80) return 4;
      return 5;
    default:
      return 1;
  }
}

/**
 * 为指定装备阶级掷骰抽取一条新词条（纯函数）。
 */
export function rollAffixForTier(
  equipTier: EquipmentTier,
  existingKinds: AffixKind[] = [],
  seedStr = 'refine-seed',
): Affix {
  const seed = Math.abs(hashText(seedStr));
  const affixTier = rollAffixTierForEquipment(equipTier, seed);

  const availableSpecs = AFFIX_SPECS.filter(s => !existingKinds.includes(s.kind));
  const pool = availableSpecs.length > 0 ? availableSpecs : AFFIX_SPECS;
  const spec = pool[seed % pool.length]!;

  const amount = spec.amounts[affixTier];
  const roman = ROMAN_NUMERALS[affixTier];
  const isPercent = spec.kind === 'damageReduce' || spec.kind === 'damageBonus';
  const displayAmount = isPercent ? `+${amount}%` : `+${amount}`;

  return {
    id: `affix-${spec.kind}-${affixTier}-${seed.toString(16).slice(0, 4)}`,
    name: `${spec.name} ${roman}`,
    kind: spec.kind,
    tier: affixTier,
    amount,
    description: `${spec.description}（${displayAmount}）`,
  };
}

export function refineCost(item: Equipment): {
  materialId: MaterialId;
  materialCount: number;
  gold: number;
} {
  const tier = item.tier ?? 1;
  const set = findEquipmentSet(item.setId);
  const materialId = set?.materialId ?? 'mat-stardust';
  const materialCount = tier;
  const gold = tier * 200;
  return { materialId, materialCount, gold };
}

export type RefineTarget =
  | { kind: 'inventory'; itemId: string }
  | { kind: 'girl'; girlId: string; slot: 'weapon' | 'charm' };

/**
 * 执行装备精炼（v182）。
 */
export function executeRefine(
  state: GameState,
  target: RefineTarget,
  seedStr?: string,
):
  | {
      ok: true;
      item: Equipment;
      affix: Affix;
      cost: { materialId: MaterialId; materialCount: number; gold: number };
    }
  | { ok: false; message: string } {
  let currentItem: Equipment | undefined;
  let targetGirl = target.kind === 'girl' ? findGirl(state, target.girlId) : undefined;

  if (target.kind === 'inventory') {
    if ((state.inventory[target.itemId] ?? 0) <= 0) {
      return { ok: false, message: '仓库中没有该装备。' };
    }
    currentItem = findItem(target.itemId);
  } else {
    if (!targetGirl) return { ok: false, message: '找不到指定的契约者。' };
    const equippedId = targetGirl.equipment[target.slot];
    if (!equippedId) return { ok: false, message: '该槽位未穿戴任何装备。' };
    currentItem = findItem(equippedId);
  }

  if (!currentItem) return { ok: false, message: '找不到目标装备数据。' };
  if (currentItem.slot === 'consumable') return { ok: false, message: '消耗品无法进行精炼。' };

  const currentAffixes = currentItem.affixes ?? [];
  if (currentAffixes.length >= MAX_AFFIXES_PER_ITEM) {
    return { ok: false, message: `该装备已精炼达到上限（最多精炼 ${MAX_AFFIXES_PER_ITEM} 条词条）。` };
  }

  const cost = refineCost(currentItem);
  if ((state.inventory[cost.materialId] ?? 0) < cost.materialCount) {
    const matName = findMaterial(cost.materialId)?.name ?? cost.materialId;
    return {
      ok: false,
      message: `材料不足：精炼需要 ${cost.materialCount} 份「${matName}」，当前仅有 ${state.inventory[cost.materialId] ?? 0} 份。`,
    };
  }

  if (state.gold < cost.gold) {
    return {
      ok: false,
      message: `星砂不足：精炼需要 ${cost.gold} 星砂，当前仅有 ${state.gold}。`,
    };
  }

  // 扣除材料与星砂
  state.inventory[cost.materialId] = (state.inventory[cost.materialId] ?? 0) - cost.materialCount;
  state.gold -= cost.gold;
  book(state, state.day, -cost.gold);

  // 抽取新词条
  const seed = Math.abs(
    hashText(seedStr ?? `refine:${currentItem.id}:${state.day}:${state.minutes}:${currentAffixes.length}:${Date.now()}`),
  );
  const newAffix = rollAffixForTier(
    currentItem.tier ?? 1,
    currentAffixes.map(a => a.kind),
    seed.toString(),
  );

  const updatedAffixes = [...currentAffixes, newAffix];

  // 复制/折算属性到新实例
  const isInstance = currentItem.id.startsWith('refine-') || currentItem.id.startsWith('craft-');
  const instanceId = isInstance
    ? currentItem.id
    : `refine-${currentItem.setId ?? 'item'}-${currentItem.id.slice(0, 10)}-${seed.toString(16).slice(0, 6)}`;

  const updatedStats = { ...(currentItem.stats ?? {}) };
  if (newAffix.kind === 'magic' || newAffix.kind === 'insight' || newAffix.kind === 'agility' || newAffix.kind === 'empathy') {
    updatedStats[newAffix.kind] = (updatedStats[newAffix.kind] ?? 0) + newAffix.amount;
  }

  const newItem: Equipment = registerItem({
    ...currentItem,
    id: instanceId,
    stats: updatedStats,
    affixes: updatedAffixes,
    maxHpBonus: (currentItem.maxHpBonus ?? 0) + (newAffix.kind === 'maxHp' ? newAffix.amount : 0),
    damageBonus: (currentItem.damageBonus ?? 0) + (newAffix.kind === 'damageBonus' ? newAffix.amount : 0),
    initiativeBonus: (currentItem.initiativeBonus ?? 0) + (newAffix.kind === 'initiative' ? newAffix.amount : 0),
  });

  // 更新仓库或少女身上装备引用
  if (target.kind === 'inventory') {
    if (currentItem.id !== newItem.id) {
      state.inventory[currentItem.id] = (state.inventory[currentItem.id] ?? 0) - 1;
      if (state.inventory[currentItem.id] <= 0) delete state.inventory[currentItem.id];
      state.inventory[newItem.id] = (state.inventory[newItem.id] ?? 0) + 1;
    }
  } else if (targetGirl) {
    targetGirl.equipment[target.slot] = newItem.id;
    targetGirl.maxHp = effectiveMaxHp(targetGirl);
    targetGirl.hp = Math.min(targetGirl.hp, targetGirl.maxHp);
    targetGirl.maxSpirit = effectiveMaxSpirit(targetGirl);
    targetGirl.spirit = Math.min(targetGirl.spirit, targetGirl.maxSpirit);
  }

  // 记入 generatedItems 保证读档不丢（上限与读档共用，见 GENERATED_ITEM_LIMIT）
  state.generatedItems = rememberGeneratedItem(state, newItem);

  state.logs.unshift({
    id: `log-refine-${Date.now()}-${seed}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'finance',
    text: `星象工坊为「${newItem.name}」完成精炼，赋予【${newAffix.name}】（消耗 ${cost.materialCount} 份材料与 ${cost.gold} 星砂）。`,
    delta: -cost.gold,
  });

  return {
    ok: true,
    item: newItem,
    affix: newAffix,
    cost,
  };
}
