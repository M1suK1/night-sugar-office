/**
 * 三方势力的所属少女。
 *
 * v85：静态名册已废弃——三方名册的每一个人都必须来自契约卡库（`cardLibrary` → 编成 →
 * `customFactionGirls`）。这里刻意留空：任何「回退到内置随从」的路径都不该再存在，
 * 卡库不够时由界面提示「契约卡不足，需要导入」。
 */
import type { FactionGirl } from '../types.ts';

export const factionGirls: FactionGirl[] = [];

export function girlsOfFaction(_faction: 'association' | 'government' | 'witch'): FactionGirl[] {
  return [];
}
