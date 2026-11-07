import type {
  Equipment,
  EquipmentSetId,
  EquipmentTier,
  GameState,
  MaterialId,
} from './types.ts';
import { findMaterial } from './content/materials.ts';
import { findEquipmentSet } from './content/sets.ts';
import { items, registerItem } from './content/items.ts';
import { book, dateLabel, hashText } from './rules/core.ts';

export const CRAFT_MIN_MATERIALS = 2;
export const CRAFT_MAX_MATERIALS = 20;
export const CRAFT_GOLD_PER_MATERIAL = 120;

export function craftGoldCost(totalMaterials: number): number {
  return totalMaterials * CRAFT_GOLD_PER_MATERIAL;
}

export interface CraftOddsResult {
  ok: true;
  totalMaterials: number;
  costGold: number;
  tierOdds: Record<EquipmentTier, number>;
  setOdds: Record<EquipmentSetId, number>;
}

export type CraftOddsOutcome = CraftOddsResult | { ok: false; message: string };

/**
 * 计算当前投料的阶级与套装概率分布（v181 纯函数）。
 */
export function craftOdds(input: Partial<Record<MaterialId, number>>): CraftOddsOutcome {
  let total = 0;
  const setCounts: Record<EquipmentSetId, number> = {
    'set-starlight': 0,
    'set-frosting': 0,
    'set-moonlight': 0,
    'set-dream': 0,
    'set-nature': 0,
    'set-cinder': 0,
  };

  for (const [matId, count] of Object.entries(input)) {
    const amount = Math.max(0, Math.floor(count ?? 0));
    if (amount <= 0) continue;
    const mat = findMaterial(matId);
    if (!mat) continue;
    total += amount;
    setCounts[mat.setId] += amount;
  }

  if (total < CRAFT_MIN_MATERIALS) {
    return { ok: false, message: `炼制至少需要投入 ${CRAFT_MIN_MATERIALS} 份材料。` };
  }
  if (total > CRAFT_MAX_MATERIALS) {
    return { ok: false, message: `单次炼制最多只能投入 ${CRAFT_MAX_MATERIALS} 份材料。` };
  }

  let tierOdds: Record<EquipmentTier, number>;
  if (total <= 4) {
    tierOdds = { 1: 0.75, 2: 0.25, 3: 0, 4: 0, 5: 0 };
  } else if (total <= 8) {
    tierOdds = { 1: 0.3, 2: 0.55, 3: 0.15, 4: 0, 5: 0 };
  } else if (total <= 13) {
    tierOdds = { 1: 0, 2: 0.3, 3: 0.5, 4: 0.2, 5: 0 };
  } else if (total <= 18) {
    tierOdds = { 1: 0, 2: 0.1, 3: 0.4, 4: 0.4, 5: 0.1 };
  } else {
    tierOdds = { 1: 0, 2: 0, 3: 0.2, 4: 0.55, 5: 0.25 };
  }

  const setOdds: Record<EquipmentSetId, number> = {
    'set-starlight': setCounts['set-starlight'] / total,
    'set-frosting': setCounts['set-frosting'] / total,
    'set-moonlight': setCounts['set-moonlight'] / total,
    'set-dream': setCounts['set-dream'] / total,
    'set-nature': setCounts['set-nature'] / total,
    'set-cinder': setCounts['set-cinder'] / total,
  };

  return {
    ok: true,
    totalMaterials: total,
    costGold: craftGoldCost(total),
    tierOdds,
    setOdds,
  };
}

/** 随机掷骰选择命中的阶级与套装。 */
function rollFromOdds<T extends string | number>(odds: Record<T, number>, rollPct: number): T {
  let accum = 0;
  const entries = Object.entries(odds) as [T, number][];
  for (const [key, prob] of entries) {
    accum += prob;
    if (rollPct <= accum) return (typeof key === 'number' ? Number(key) : key) as T;
  }
  return entries[entries.length - 1]![0];
}

/**
 * 执行星象炼制（纯逻辑与状态结算，v181）。
 */
export function executeCraft(
  state: GameState,
  input: Partial<Record<MaterialId, number>>,
  seedStr?: string,
):
  | {
      ok: true;
      item: Equipment;
      tier: EquipmentTier;
      setId: EquipmentSetId;
      costGold: number;
    }
  | { ok: false; message: string } {
  const oddsOutcome = craftOdds(input);
  if (!oddsOutcome.ok) return oddsOutcome;

  // 检查材料与星砂
  for (const [matId, count] of Object.entries(input)) {
    const required = Math.max(0, count ?? 0);
    if ((state.inventory[matId] ?? 0) < required) {
      const matName = findMaterial(matId)?.name ?? matId;
      return { ok: false, message: `材料不足：缺少「${matName}」。` };
    }
  }

  if (state.gold < oddsOutcome.costGold) {
    return { ok: false, message: `星砂不足：炼制需要 ${oddsOutcome.costGold} 星砂，当前仅有 ${state.gold}。` };
  }

  // 扣除材料与星砂
  for (const [matId, count] of Object.entries(input)) {
    const required = Math.max(0, count ?? 0);
    state.inventory[matId] = Math.max(0, (state.inventory[matId] ?? 0) - required);
  }
  state.gold -= oddsOutcome.costGold;
  book(state, state.day, -oddsOutcome.costGold);

  // 确定性随机掷骰
  const seed = Math.abs(
    hashText(seedStr ?? `craft:${state.day}:${state.minutes}:${oddsOutcome.totalMaterials}:${Date.now()}`),
  );
  const tierRoll = ((seed % 1000) + 1) / 1000;
  const setRoll = (((Math.floor(seed / 1000)) % 1000) + 1) / 1000;

  const rolledTier = Number(rollFromOdds(oddsOutcome.tierOdds, tierRoll)) as EquipmentTier;
  const rolledSet = rollFromOdds(oddsOutcome.setOdds, setRoll) as EquipmentSetId;

  // 寻找该套装该阶级的候选装备（法器或护符）
  const candidatePool = items.filter(
    item =>
      item.setId === rolledSet &&
      (item.tier ?? 1) === rolledTier &&
      (item.slot === 'weapon' || item.slot === 'charm'),
  );

  let outputItem: Equipment;
  if (candidatePool.length > 0) {
    const pickIndex = (Math.floor(seed / 1000000)) % candidatePool.length;
    outputItem = candidatePool[pickIndex]!;
  } else {
    // 降级兜底：查找该套装任意装备并适配阶级
    const setPool = items.filter(item => item.setId === rolledSet && (item.slot === 'weapon' || item.slot === 'charm'));
    const template = setPool.length > 0 ? setPool[seed % setPool.length]! : items[0]!;
    const setName = findEquipmentSet(rolledSet)?.name ?? '星象';
    const instanceId = `craft-${rolledSet}-t${rolledTier}-${seed.toString(16).slice(0, 6)}`;
    const baseStat = rolledTier * 3;
    outputItem = registerItem({
      ...template,
      id: instanceId,
      name: `${template.name.replace(/^[一二三四五]阶·?/, '')}`,
      tier: rolledTier,
      setId: rolledSet,
      price: rolledTier * 800 + 400,
      description: `由星象工坊融合炼制的${setName}专属法器，凝聚着星盘轨迹的微光。`,
      stats: { magic: baseStat, insight: Math.max(1, baseStat - 2) },
    });
  }

  // 入库与记日志
  state.inventory[outputItem.id] = (state.inventory[outputItem.id] ?? 0) + 1;
  const setInfo = findEquipmentSet(rolledSet);

  state.logs.unshift({
    id: `log-craft-${Date.now()}-${seed}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'finance',
    text: `星象工坊投入 ${oddsOutcome.totalMaterials} 份材料炼制出【${setInfo?.name ?? '专属'} · 阶级 ${rolledTier}】「${outputItem.name}」（消耗 ${oddsOutcome.costGold} 星砂）。`,
    delta: -oddsOutcome.costGold,
  });

  return {
    ok: true,
    item: outputItem,
    tier: rolledTier,
    setId: rolledSet,
    costGold: oddsOutcome.costGold,
  };
}
