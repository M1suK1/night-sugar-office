import { useMemo, useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import type { Equipment, EquipmentSetId, GameState, MaterialId } from '../types';
import { materials, findMaterial } from '../content/materials';
import { equipmentSets, findEquipmentSet } from '../content/sets';
import { findItem } from '../content/items';
import { craftOdds, craftGoldCost, CRAFT_MAX_MATERIALS } from '../crafting';
import { refineCost, MAX_AFFIXES_PER_ITEM } from '../refine';

interface WorkshopProps {
  state: GameState;
  subTab: 'warehouse' | 'workshop';
  onSubTab?: (tab: 'warehouse' | 'workshop') => void;
  onCraft?: (materials: Partial<Record<MaterialId, number>>) => void;
  onRefine?: (target: { kind: 'inventory'; itemId: string } | { kind: 'girl'; girlId: string; slot: 'weapon' | 'charm' }) => void;
  onGirl?: (id: string) => void;
}

export function ObservatoryWorkshop({ state, subTab, onSubTab, onCraft, onRefine, onGirl: _onGirl }: WorkshopProps) {
  // 工坊内子模式：炼制 / 精炼
  const [forgeMode, setForgeMode] = useState<'craft' | 'refine'>('craft');

  // 炼制投料状态
  const [craftInputs, setCraftInputs] = useState<Partial<Record<MaterialId, number>>>({});

  // 仓库筛选条件
  const [slotFilter, setSlotFilter] = useState<'all' | 'weapon' | 'charm'>('all');
  const [tierFilter, setTierFilter] = useState<number | 'all'>('all');
  const [setFilter, setSetFilter] = useState<EquipmentSetId | 'all'>('all');

  // 精炼目标
  const [selectedRefineKey, setSelectedRefineKey] = useState<string>('');

  // 收集所有可精炼的装备（仓库 + 少女身上）
  const allGearTargets = useMemo(() => {
    const list: { key: string; item: Equipment; target: { kind: 'inventory'; itemId: string } | { kind: 'girl'; girlId: string; slot: 'weapon' | 'charm' }; ownerName?: string }[] = [];
    // 仓库装备
    for (const [id, count] of Object.entries(state.inventory)) {
      if (!count || count <= 0) continue;
      const it = findItem(id);
      if (!it || (it.slot !== 'weapon' && it.slot !== 'charm')) continue;
      list.push({
        key: `inv-${id}`,
        item: it,
        target: { kind: 'inventory', itemId: id },
      });
    }
    // 少女装备
    for (const girl of state.girls) {
      if (girl.dead || girl.retired) continue;
      if (girl.equipment.weapon) {
        const it = findItem(girl.equipment.weapon);
        if (it) {
          list.push({
            key: `girl-${girl.id}-weapon`,
            item: it,
            target: { kind: 'girl', girlId: girl.id, slot: 'weapon' },
            ownerName: girl.name,
          });
        }
      }
      if (girl.equipment.charm) {
        const it = findItem(girl.equipment.charm);
        if (it) {
          list.push({
            key: `girl-${girl.id}-charm`,
            item: it,
            target: { kind: 'girl', girlId: girl.id, slot: 'charm' },
            ownerName: girl.name,
          });
        }
      }
    }
    return list;
  }, [state.inventory, state.girls]);

  // 精炼选中的目标对象
  const activeRefineTarget = useMemo(() => {
    return allGearTargets.find(t => t.key === selectedRefineKey) ?? allGearTargets[0];
  }, [allGearTargets, selectedRefineKey]);

  // 计算炼制实时概率
  const odds = useMemo(() => craftOdds(craftInputs), [craftInputs]);
  const totalCraftMaterials = useMemo(() => {
    return Object.values(craftInputs).reduce((sum, n) => (sum ?? 0) + (n ?? 0), 0) ?? 0;
  }, [craftInputs]);

  // 投料加减方法
  const adjustMaterial = (id: MaterialId, delta: number) => {
    const owned = state.inventory[id] ?? 0;
    setCraftInputs(prev => {
      const cur = prev[id] ?? 0;
      const nextVal = Math.max(0, Math.min(owned, cur + delta));
      const next = { ...prev, [id]: nextVal };
      if (nextVal <= 0) delete next[id];
      return next;
    });
  };

  const setMaterialMax = (id: MaterialId) => {
    const owned = state.inventory[id] ?? 0;
    const curOther = totalCraftMaterials - (craftInputs[id] ?? 0);
    const maxCanTake = Math.max(0, Math.min(owned, CRAFT_MAX_MATERIALS - curOther));
    setCraftInputs(prev => ({ ...prev, [id]: maxCanTake }));
  };

  const clearCraftInputs = () => setCraftInputs({});

  // 过滤仓库展示装备
  const filteredGear = useMemo(() => {
    return allGearTargets.filter(({ item }) => {
      if (slotFilter !== 'all' && item.slot !== slotFilter) return false;
      if (tierFilter !== 'all' && item.tier !== tierFilter) return false;
      if (setFilter !== 'all' && item.setId !== setFilter) return false;
      return true;
    });
  }, [allGearTargets, slotFilter, tierFilter, setFilter]);

  const jumpToRefine = (key: string) => {
    setSelectedRefineKey(key);
    setForgeMode('refine');
    onSubTab?.('workshop');
  };

  return (
    <div className="av-obs-workshop-root">
      {/* 顶部 6 种材料常驻库存栏 */}
      <div className="av-material-bar" role="group" aria-label="六系材料库存">
        {materials.map(mat => {
          const count = state.inventory[mat.id] ?? 0;
          return (
            <div key={mat.id} className="av-mat-chip" title={mat.description}>
              <i className="av-mat-dot" style={{ backgroundColor: mat.color }} />
              <span className="av-mat-name">{mat.name}</span>
              <b className={`av-mat-count ${count > 0 ? 'has-stock' : 'no-stock'}`}>{count}</b>
            </div>
          );
        })}
      </div>

      {subTab === 'warehouse' && (
        <div className="av-module-panel av-warehouse-panel">
          {/* 筛选栏 */}
          <div className="av-warehouse-filters">
            <div className="av-filter-group">
              <span>部位</span>
              <button type="button" className={`vn-chip ${slotFilter === 'all' ? 'on' : ''}`} onClick={() => setSlotFilter('all')}>全部</button>
              <button type="button" className={`vn-chip ${slotFilter === 'weapon' ? 'on' : ''}`} onClick={() => setSlotFilter('weapon')}>法器</button>
              <button type="button" className={`vn-chip ${slotFilter === 'charm' ? 'on' : ''}`} onClick={() => setSlotFilter('charm')}>护符</button>
            </div>
            <div className="av-filter-group">
              <span>阶级</span>
              <button type="button" className={`vn-chip ${tierFilter === 'all' ? 'on' : ''}`} onClick={() => setTierFilter('all')}>全部</button>
              {[1, 2, 3, 4, 5].map(t => (
                <button key={t} type="button" className={`vn-chip ${tierFilter === t ? 'on' : ''}`} onClick={() => setTierFilter(t)}>T{t}</button>
              ))}
            </div>
            <div className="av-filter-group">
              <span>套装</span>
              <button type="button" className={`vn-chip ${setFilter === 'all' ? 'on' : ''}`} onClick={() => setSetFilter('all')}>全部</button>
              {equipmentSets.map(s => (
                <button key={s.id} type="button" className={`vn-chip ${setFilter === s.id ? 'on' : ''}`} onClick={() => setSetFilter(s.id)} style={{ borderColor: setFilter === s.id ? s.color : undefined }}>
                  {s.name.replace('套装', '')}
                </button>
              ))}
            </div>
          </div>

          {/* 装备卡片网格 */}
          {filteredGear.length ? (
            <div className="av-gear-grid">
              {filteredGear.map(({ key, item, ownerName }) => {
                const setInfo = findEquipmentSet(item.setId);
                const affixes = item.affixes ?? [];
                return (
                  <article key={key} className="av-gear-card">
                    <header className="av-gear-card-head">
                      <div className="av-gear-tags">
                        <span className="av-gear-tier">阶级 {item.tier ?? 1}</span>
                        <span className="av-gear-slot">{item.slot === 'weapon' ? '法器' : '护符'}</span>
                        {setInfo && <span className="av-gear-set" style={{ color: setInfo.color, borderColor: setInfo.color }}>{setInfo.name}</span>}
                      </div>
                      <h4>{item.name}</h4>
                      {ownerName && <small className="av-gear-owner">穿戴中 · {ownerName}</small>}
                    </header>
                    <p className="av-gear-desc">{item.description}</p>
                    {/* 基础数值 */}
                    <div className="av-gear-stats">
                      {item.stats && Object.entries(item.stats).map(([k, v]) => (
                        <span key={k}><i>{k === 'magic' ? '魔力' : k === 'insight' ? '洞察' : k === 'agility' ? '敏捷' : '共情'}</i> +{v}</span>
                      ))}
                      {item.maxHpBonus ? <span><i>生命</i> +{item.maxHpBonus}</span> : null}
                      {item.damageBonus ? <span><i>增伤</i> +{item.damageBonus}%</span> : null}
                      {item.initiativeBonus ? <span><i>先手</i> +{item.initiativeBonus}</span> : null}
                    </div>
                    {/* 精炼词条 */}
                    <div className="av-gear-affixes">
                      <div className="av-affixes-label">精炼词条 ({affixes.length}/3)</div>
                      {affixes.length ? (
                        <ul>
                          {affixes.map(aff => (
                            <li key={aff.id}><b>{aff.name}</b><small>{aff.description}</small></li>
                          ))}
                        </ul>
                      ) : (
                        <small className="av-empty-affixes">暂无词条（可在工坊精炼）</small>
                      )}
                    </div>
                    <footer className="av-gear-card-foot">
                      <button id={`av-warehouse-refine-${item.id}`} type="button" className="btn full" onClick={() => jumpToRefine(key)}>
                        <Wand2 size={12} />放入工坊精炼
                      </button>
                    </footer>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="av-op-empty">当前没有符合筛选条件的装备。去星象工坊炼制一批新装备吧。</p>
          )}
        </div>
      )}

      {subTab === 'workshop' && (
        <div className="av-module-panel av-workshop-panel">
          {/* 模式双核切换 */}
          <div className="av-forge-modes" role="tablist">
            <button id="av-forge-tab-craft" type="button" className={`btn ${forgeMode === 'craft' ? 'primary' : 'ghost'}`} onClick={() => setForgeMode('craft')}>
              <Sparkles size={13} />星象炼制 (混合材料投料)
            </button>
            <button id="av-forge-tab-refine" type="button" className={`btn ${forgeMode === 'refine' ? 'primary' : 'ghost'}`} onClick={() => setForgeMode('refine')}>
              <Wand2 size={13} />装备精炼 (分阶词条附魔)
            </button>
          </div>

          {forgeMode === 'craft' && (
            <div className="av-craft-body">
              <p className="av-module-hint">
                星象炼制：投入 <b>2–20</b> 份材料，材料总数越多出现高级装备（Tier 2–5）的概率越高。可混合多种材料，产出的套装概率严格取决于各材料的相对比例。
              </p>

              {/* 投料槽位 */}
              <div className="av-craft-inputs">
                {materials.map(mat => {
                  const owned = state.inventory[mat.id] ?? 0;
                  const current = craftInputs[mat.id] ?? 0;
                  const setInfo = findEquipmentSet(mat.setId);
                  return (
                    <div key={mat.id} className="av-craft-row">
                      <div className="av-craft-mat-info">
                        <i className="av-mat-dot" style={{ backgroundColor: mat.color }} />
                        <strong>{mat.name}</strong>
                        <small style={{ color: setInfo?.color }}>{setInfo?.name}</small>
                        <span>库存 {owned}</span>
                      </div>
                      <div className="av-craft-ctrls">
                        <button type="button" className="btn ghost btn-sm" disabled={current <= 0} onClick={() => adjustMaterial(mat.id, -5)}>-5</button>
                        <button type="button" className="btn ghost btn-sm" disabled={current <= 0} onClick={() => adjustMaterial(mat.id, -1)}>-1</button>
                        <b className="av-craft-val">{current}</b>
                        <button type="button" className="btn ghost btn-sm" disabled={current >= owned || totalCraftMaterials >= CRAFT_MAX_MATERIALS} onClick={() => adjustMaterial(mat.id, 1)}>+1</button>
                        <button type="button" className="btn ghost btn-sm" disabled={current >= owned || totalCraftMaterials >= CRAFT_MAX_MATERIALS} onClick={() => adjustMaterial(mat.id, 5)}>+5</button>
                        <button type="button" className="btn ghost btn-sm" disabled={owned <= 0} onClick={() => setMaterialMax(mat.id)}>最大</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 实时概率预估面板 */}
              <div className="av-craft-preview">
                <div className="av-craft-summary">
                  <span>总投入材料: <b>{totalCraftMaterials} / {CRAFT_MAX_MATERIALS} 份</b></span>
                  <span>消耗星砂: <b>{craftGoldCost(totalCraftMaterials).toLocaleString()}</b> (持有: {state.gold.toLocaleString()})</span>
                  <button type="button" className="vn-chip" disabled={totalCraftMaterials <= 0} onClick={clearCraftInputs}>清空投料</button>
                </div>

                {odds.ok ? (
                  <div className="av-craft-odds-box">
                    <div className="av-odds-section">
                      <h5>阶级概率预估 (Tier 1–5)</h5>
                      <div className="av-tier-bars">
                        {([1, 2, 3, 4, 5] as const).map(t => {
                          const pct = Math.round(odds.tierOdds[t] * 100);
                          return (
                            <div key={t} className="av-tier-bar-row">
                              <span>T{t}</span>
                              <div className="av-tier-track"><i style={{ width: `${pct}%` }} /></div>
                              <em>{pct}%</em>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="av-odds-section">
                      <h5>产出套装倾向 (按投入比率决定)</h5>
                      <div className="av-set-ratios">
                        {equipmentSets.map(set => {
                          const pct = Math.round(odds.setOdds[set.id] * 100);
                          if (pct <= 0) return null;
                          return (
                            <span key={set.id} className="av-set-ratio-chip" style={{ color: set.color, borderColor: set.color }}>
                              {set.name}: <b>{pct}%</b>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="small-note">{odds.message}</p>
                )}

                <button
                  id="av-craft-submit"
                  type="button"
                  className="btn primary full"
                  disabled={!odds.ok || state.gold < (odds.ok ? odds.costGold : 0)}
                  onClick={() => {
                    if (odds.ok && onCraft) onCraft(craftInputs);
                  }}
                >
                  <Sparkles size={14} />启动星象炼制
                </button>
              </div>
            </div>
          )}

          {forgeMode === 'refine' && (
            <div className="av-refine-body">
              <p className="av-module-hint">
                装备精炼：每件装备最多可附加 <b>3</b> 条额外精炼词条。<b>词条阶级上限严格由装备自身阶级决定</b>（一阶装备最高精炼出 Rank I 词条，五阶装备可精炼出 Rank V 顶阶词条）。精炼消耗同套装材料与星砂。
              </p>

              {allGearTargets.length > 0 ? (
                <div className="av-refine-layout">
                  {/* 左侧目标装备选择 */}
                  <div className="av-refine-pick-list">
                    <h5>选择精炼目标</h5>
                    <div className="av-refine-scroll">
                      {allGearTargets.map(({ key, item, ownerName }) => {
                        const setInfo = findEquipmentSet(item.setId);
                        const isSelected = activeRefineTarget?.key === key;
                        const affCount = item.affixes?.length ?? 0;
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`av-refine-pick-item ${isSelected ? 'active' : ''}`}
                            onClick={() => setSelectedRefineKey(key)}
                          >
                            <div className="av-refine-item-title">
                              <b>{item.name}</b>
                              <span className="av-refine-tier-tag">T{item.tier ?? 1}</span>
                            </div>
                            <div className="av-refine-item-sub">
                              <span style={{ color: setInfo?.color }}>{setInfo?.name}</span>
                              <small>词条 {affCount}/3 {ownerName ? `· ${ownerName}` : ''}</small>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 右侧精炼炉操作台 */}
                  {activeRefineTarget && (() => {
                    const item = activeRefineTarget.item;
                    const setInfo = findEquipmentSet(item.setId);
                    const cost = refineCost(item);
                    const mat = findMaterial(cost.materialId);
                    const ownedMat = state.inventory[cost.materialId] ?? 0;
                    const affixes = item.affixes ?? [];
                    const maxReached = affixes.length >= MAX_AFFIXES_PER_ITEM;
                    const matLack = ownedMat < cost.materialCount;
                    const goldLack = state.gold < cost.gold;

                    return (
                      <div className="av-refine-furnace">
                        <header className="av-furnace-head">
                          <span className="modal-eyebrow">星象精炼炉 · 阶级 {item.tier ?? 1}</span>
                          <h3>{item.name}</h3>
                          <div className="av-furnace-badges">
                            <span className="av-gear-slot">{item.slot === 'weapon' ? '法器' : '护符'}</span>
                            {setInfo && <span className="av-gear-set" style={{ color: setInfo.color, borderColor: setInfo.color }}>{setInfo.name}</span>}
                            <span className="av-affix-limit-note">词条上限: Rank {['I','II','III','IV','V'][(item.tier ?? 1) - 1]}</span>
                          </div>
                        </header>

                        <div className="av-furnace-affixes">
                          <h5>已有精炼词条 ({affixes.length}/3)</h5>
                          {affixes.length ? (
                            <ul className="av-affix-list">
                              {affixes.map(aff => (
                                <li key={aff.id}>
                                  <strong>{aff.name}</strong>
                                  <span>{aff.description}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="av-empty-affixes">该装备尚未附魔任何词条。</p>
                          )}
                        </div>

                        <div className="av-furnace-cost">
                          <h5>精炼消耗</h5>
                          <div className="av-cost-row">
                            <span>
                              {mat?.name ?? '材料'}: <b>{ownedMat}</b> / {cost.materialCount} 份
                              {matLack && <small className="lack-warn">（材料不足）</small>}
                            </span>
                            <span>
                              星砂: <b>{cost.gold.toLocaleString()}</b> (持有: {state.gold.toLocaleString()})
                              {goldLack && <small className="lack-warn">（星砂不足）</small>}
                            </span>
                          </div>
                        </div>

                        <button
                          id="av-refine-submit"
                          type="button"
                          className="btn primary full"
                          disabled={maxReached || matLack || goldLack}
                          onClick={() => {
                            if (onRefine) onRefine(activeRefineTarget.target);
                          }}
                        >
                          <Wand2 size={14} />{maxReached ? '已达词条上限 (3/3)' : '注入星象精炼'}
                        </button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="av-op-empty">仓库中尚无可精炼的法器或护符。先去炼制一批新装备吧。</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
