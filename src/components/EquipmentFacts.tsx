import { findEquipmentSet } from '../content/sets';
import { affixFact, equipmentFacts, equipmentTierLabel } from '../equipmentFacts';
import type { Equipment } from '../types';

/**
 * 一件装备在角色档案里该露出来的东西（v196）。
 *
 * 以前这里只写「名字 + 一句 passive 或属性」，套装和精炼词条都看不见，
 * 玩家得去工坊才知道自己穿的是什么。现在统一成：阶级与套装 → 基础加成 → 词条。
 */
export function EquipmentFacts({ item, showPassive = false }: { item: Equipment; showPassive?: boolean }) {
  const set = findEquipmentSet(item.setId);
  const facts = equipmentFacts(item);
  const affixes = item.affixes ?? [];
  return (
    <span className="gear-facts">
      <span className="gear-facts-head">
        <em>{equipmentTierLabel(item)}</em>
        {set && <b className="gear-facts-set" style={{ color: set.color, borderColor: set.color }}>{set.name.replace('套装', '')}套</b>}
      </span>
      {facts.length > 0 && (
        <span className="gear-facts-row">
          {facts.map(fact => <i key={fact.label}>{fact.label}<b>{fact.value}</b></i>)}
        </span>
      )}
      {affixes.length > 0 && (
        <span className="gear-facts-row gear-facts-affixes">
          {affixes.map(affix => {
            const fact = affixFact(affix);
            return <i key={affix.id} title={affix.description}>{fact.name}<b>{fact.detail}</b></i>;
          })}
        </span>
      )}
      {!affixes.length && <span className="gear-facts-empty">未精炼</span>}
      {showPassive && item.passive && <small className="gear-facts-passive">{item.passive}</small>}
    </span>
  );
}
