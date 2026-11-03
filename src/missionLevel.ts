/**
 * 委托模板的推荐等级该写多少。
 *
 * 工坊新建模板时一律写死 3，于是整库模板都是「推荐等级 3」，与危险度、
 * 魔物数量都对不上。这里按危险度起底，再按魔物数量加档：
 *   · 2 只及以内不加档（大多数战斗委托就是这个量）
 *   · 每多一只加一档，最多加两档
 * 蓝图用的「简单 / 常规 / 棘手 / 危险」也认，方便故事图谱那边直接套。
 */
export const MISSION_LEVEL_BASE: Record<string, number> = {
  低危: 2, 中危: 3, 高危: 5, 绝望: 7,
  简单: 2, 常规: 3, 棘手: 5, 危险: 7,
};

export function suggestedLevel(difficulty: string | undefined, monsterCount = 0): number {
  const base = MISSION_LEVEL_BASE[(difficulty ?? '').trim()] ?? 3;
  const extra = Math.min(2, Math.max(0, (Number.isFinite(monsterCount) ? Math.round(monsterCount) : 0) - 2));
  return Math.max(1, Math.min(10, base + extra));
}
