import { effectiveMaxHp, effectiveMaxSpirit } from '../economy.ts';
import { factionStanding, itemPrice } from '../rules/market.ts';
import { factionInfo, getItem } from '../content/items.ts';
import { book, clone, dateLabel, findGirl } from '../rules/core.ts';
import { executeCraft } from '../crafting.ts';
import { executeRefine } from '../refine.ts';
import { reconcileWitch, useMoonDrug } from './conditions.ts';
import type { ActionResult, GameAction, GameState } from '../types.ts';
// v35 从 src/game.ts 拆出：动作处理器。

/** 用安定度换抑制剂的价码与库存上限（v244）。 */
export const DRUG_STABILITY_COST = 10;
export const DRUG_STOCK_MAX = 5;

/** tradeStabilityDrug：10 点城市安定度换 1 支月蚀抑制剂。 */
export function applyTradeStabilityDrug(state: GameState): ActionResult {
  const next = clone(state);
  const stock = next.inventory['moon-drug'] ?? 0;
  if (stock >= DRUG_STOCK_MAX) return { state, ok: false, message: `抑制剂最多囤积 ${DRUG_STOCK_MAX} 支。` };
  if (next.reputation < DRUG_STABILITY_COST) return { state, ok: false, message: `城市安定度不足：换一支需要 ${DRUG_STABILITY_COST} 点，当前 ${next.reputation}。` };
  next.reputation -= DRUG_STABILITY_COST;
  next.inventory['moon-drug'] = stock + 1;
  next.logs.unshift({
    id: `log-trade-drug-${next.day}-${Date.now()}`,
    time: dateLabel(next.day, next.minutes),
    kind: 'clinic',
    text: `用 ${DRUG_STABILITY_COST} 点城市安定度向协会换了一支「月蚀抑制剂」（库存 ${stock + 1} 支）。`,
    delta: -DRUG_STABILITY_COST,
  });
  return { state: next, ok: true, message: `用 ${DRUG_STABILITY_COST} 点安定度换到一支月蚀抑制剂，库存 ${stock + 1} 支。` };
}

/** buyItem 的动作处理器（v35 从 act 拆出）。 */
export function applyBuyItem(state: GameState, action: Extract<GameAction, { type: 'buyItem' }>): ActionResult {
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

/** equipItem 的动作处理器（v35 从 act 拆出）。 */
export function applyEquipItem(state: GameState, action: Extract<GameAction, { type: 'equipItem' }>): ActionResult {
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

/** unequipItem 的动作处理器（v35 从 act 拆出）。 */
export function applyUnequipItem(state: GameState, action: Extract<GameAction, { type: 'unequipItem' }>): ActionResult {
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

/** useItem 的动作处理器（v35 从 act 拆出）。 */
export function applyUseItem(state: GameState, action: Extract<GameAction, { type: 'useItem' }>): ActionResult {
      const next = clone(state); const girl = findGirl(next, action.girlId); const item = getItem(action.itemId);
      if (!girl || !item) return { state, ok: false, message: '找不到对应的契约者或物资。' };
      if ((next.inventory[item.id] ?? 0) <= 0) return { state, ok: false, message: '仓库里没有这件物资。' };
      if (item.effect === 'drug') {
        // v252：诊所用抑制剂——魔女形态下注射，没越过 70 就立刻退出魔女化、换回普通立绘；
        // 越过 70 只续命（形态仍是魔女）；已经压住的则只把压制期往后推。
        const suppressed = (girl.drugUntilDay ?? 0) > next.day;
        if (!girl.witch && !suppressed) return { state, ok: false, message: `${girl.name}既没有魔女化，也不在压制期内，不需要抑制剂。` };
        const result = useMoonDrug(next, girl);
        if (!result.ok) return { state, ok: false, message: result.message };
        next.logs.unshift({
          id: `log-use-drug-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic',
          text: result.unlocked
            ? `${girl.name}注射了一支月蚀抑制剂，魔女化被压了回去，立绘恢复成普通形态。药效维持至第 ${girl.drugUntilDay} 日（剩 ${result.stock} 支）。`
            : `${girl.name}注射了一支月蚀抑制剂，断药状态结束，药效维持至第 ${girl.drugUntilDay} 日（剩 ${result.stock} 支）。`,
        });
        return {
          state: next, ok: true,
          message: result.unlocked
            ? `${girl.name}退出了魔女化，药效维持至第 ${girl.drugUntilDay} 日，抑制剂剩 ${result.stock} 支。`
            : `${girl.name}的断药状态已解除，药效维持至第 ${girl.drugUntilDay} 日，抑制剂剩 ${result.stock} 支。`,
        };
      }
      if (item.effect === 'heal') {
        next.inventory[item.id] -= 1;
        girl.hp = Math.min(effectiveMaxHp(girl), girl.hp + (item.amount ?? 40));
        return { state: next, ok: true, message: `${girl.name}恢复了 ${item.amount ?? 40} 点生命。` };
      }
      if (item.effect === 'purify') {
        next.inventory[item.id] -= 1;
        girl.corruption = Math.max(0, girl.corruption - (item.amount ?? 8));
        // v252：侵蚀掉回阈值以下时，立绘也要跟着回到普通形态。
        const unlocked = girl.witch && !reconcileWitch(next, girl);
        return { state: next, ok: true, message: unlocked ? `${girl.name}完成净化课程，侵蚀降到线下，立绘恢复成普通形态。` : `${girl.name}完成净化课程，侵蚀度下降。` };
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

/** craftEquipment 的动作处理器（v181）。 */
export function applyCraftEquipment(state: GameState, action: Extract<GameAction, { type: 'craftEquipment' }>): ActionResult {
  const next = clone(state);
  const outcome = executeCraft(next, action.materials);
  if (!outcome.ok) return { state, ok: false, message: outcome.message };
  return {
    state: next,
    ok: true,
    message: `炼制成功！获得「${outcome.item.name}」（阶级 ${outcome.tier}）。`,
  };
}

/** refineEquipment 的动作处理器（v182）。 */
export function applyRefineEquipment(state: GameState, action: Extract<GameAction, { type: 'refineEquipment' }>): ActionResult {
  const next = clone(state);
  const outcome = executeRefine(next, action.target);
  if (!outcome.ok) return { state, ok: false, message: outcome.message };
  return {
    state: next,
    ok: true,
    message: `精炼成功！「${outcome.item.name}」获得了【${outcome.affix.name}】。`,
  };
}
