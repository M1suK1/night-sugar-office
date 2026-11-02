import { customIncidentCards } from '../content/library.ts';
import type { DistrictId } from '../districts.ts';
import { applyPct, districts } from '../districts.ts';
import { effectiveMaxSpirit } from '../economy.ts';
import { applyHostility, incidentHostility } from '../hostility.ts';
import { INCIDENT_PENDING_LIMIT, incidentPending } from '../incidents.ts';
import { FACTION_ORDER, factionName, ownedDistricts } from '../territories.ts';
import type { GameState, Incident, IncidentCard } from '../types.ts';
import { addCorruption } from './conditions.ts';
import { book, clamp100, dateLabel, findGirl, hashText, shiftTerritory } from './core.ts';
import { deployIncidentCard } from './encounters.ts';
// v35 从 src/game.ts 拆出：弹窗事件的运行时逻辑。

// ---------------------------------------------------------------- 强制事件
export function incidentId(state: GameState, prefix: string): string {
  return `inc-${prefix}-${state.day}-${state.minutes}-${state.incidents.length}`;
}

/** 规则兜底事件：势力施压、环境异常、角色状态。 */

/** 规则兜底事件：势力施压、环境异常、角色状态。 */
export function makeRuleIncident(state: GameState): Incident | null {
  if (incidentPending(state).length >= INCIDENT_PENDING_LIMIT) return null;
  const strained = state.girls.find(girl => !girl.retired && girl.status !== 'mission' && (girl.corruption >= 60 || girl.fatigue >= 90));
  if (strained) {
    return {
      id: incidentId(state, 'girl'), day: state.day, kind: 'girl', source: 'rule',
      title: `${strained.name}的状态不太对`, girlId: strained.id,
      body: strained.corruption >= 60
        ? `${strained.name}的手背上浮出一层不属于她的纹路。她坚持说没事，但杯子在她手里碎了一次。`
        : `${strained.name}已经连续几晚没有睡整觉，今晚出勤时在门口停了很久才推门进来。`,
      options: [
        { id: 'rest', label: '强制她休息一晚', hint: '损失一次出勤，状态回稳', effect: { girl: { fatigue: -40, corruption: -6, spirit: 12 } } },
        { id: 'clinic', label: '送去月光诊所', hint: '花费 900 星砂，压制侵蚀', effect: { gold: -900, girl: { fatigue: -28, corruption: -12 } } },
        { id: 'push', label: '照常出勤', hint: '保住今晚的人手，代价由她承担', effect: { girl: { fatigue: 6, corruption: 8 }, reputation: 1 } },
      ],
      status: 'pending',
    };
  }
  const weakest = FACTION_ORDER.map(id => ({ id, standing: state.factions[id].standing })).sort((a, b) => a.standing - b.standing)[0];
  if (weakest && weakest.standing < 35) {
    const faction = weakest.id;
    const target = ownedDistricts(state.territories, faction)[0] ?? Object.keys(state.territories)[0] as DistrictId;
    return {
      id: incidentId(state, 'faction'), day: state.day, kind: 'faction', source: 'rule', faction, district: target,
      title: `${factionName[faction]}要一个说法`,
      body: `${factionName[faction]}的联络人没有预约就坐进了会客厅。他把一张辖区地图推过来，指尖停在${districts[target].name}上：这里最近的事，事务所处理得太慢了。`,
      options: [
        { id: 'compensate', label: '赔付星砂并道歉', hint: '花费 800 星砂，关系回稳', effect: { gold: -800, faction: { id: faction, standing: 10 } } },
        { id: 'handover', label: `把${districts[target].name}的夜巡权交出去`, hint: '关系大幅改善，安定度受损', effect: { territory: { id: target, faction }, reputation: -3 } },
        { id: 'refuse', label: '拒绝，按事务所的节奏来', hint: '保住辖区，关系恶化', effect: { faction: { id: faction, standing: -12 }, reputation: 2 } },
      ],
      status: 'pending',
    };
  }
  if (state.shift.wave >= 1) {
    const pool = Object.keys(state.territories) as DistrictId[];
    const district = pool[hashText(`incident:${state.day}:${state.minutes}`) % pool.length];
    return {
      id: incidentId(state, 'env'), day: state.day, kind: 'environment', source: 'rule', district,
      title: `${districts[district].name}的结界出现了裂隙`,
      body: `巡检报告说${districts[district].name}边缘的结界薄了一层。雾从裂隙里渗出来，带着不属于这条街的气味。派人去补，还是先封住？`,
      options: [
        { id: 'repair', label: '立刻派人修补', hint: '花费 500 星砂，安定度上升', effect: { gold: -500, reputation: 2, district: { id: district, targetPct: -3, rewardPct: -5, untilDay: state.day + 1 } } },
        { id: 'seal', label: '先封街，明晚再说', hint: '损失一点安定度，挡住雾', effect: { reputation: -2, district: { id: district, targetPct: 4, rewardPct: -6, untilDay: state.day + 1 } } },
        { id: 'ignore', label: '维持原样', hint: '什么都不做，风险留给下一次', effect: { reputation: -1 } },
      ],
      status: 'pending',
    };
  }
  return null;
}

/**
 * 从内容工坊的「随机池」弹窗里抽一张。
 * roll 取 0–1，保留纯函数以便测试；oncePerDay 会排除当天已经出现过的卡。
 */

/**
 * 从内容工坊的「随机池」弹窗里抽一张。
 * roll 取 0–1，保留纯函数以便测试；oncePerDay 会排除当天已经出现过的卡。
 */
export function pickPoolIncidentCard(cards: IncidentCard[], incidents: Incident[], day: number, roll: number): IncidentCard | undefined {
  const pool = cards.filter(card => card.trigger === 'pool' && (!card.oncePerDay || !incidents.some(incident => incident.day === day && incident.cardId === card.id)));
  if (!pool.length) return undefined;
  const total = pool.reduce((sum, card) => sum + Math.max(1, card.weight), 0);
  let point = Math.max(0, Math.min(0.999999, roll)) * total;
  for (const card of pool) {
    point -= Math.max(1, card.weight);
    if (point < 0) return card;
  }
  return pool[pool.length - 1];
}

/** 打烊开门时给随机池一次抽选机会；没配置池卡时什么都不做。 */

/** 打烊开门时给随机池一次抽选机会；没配置池卡时什么都不做。 */
export function rollPoolIncident(state: GameState): Incident | undefined {
  const cards = customIncidentCards();
  const pool = cards.filter(card => card.trigger === 'pool');
  if (!pool.length || incidentPending(state).length >= INCIDENT_PENDING_LIMIT) return undefined;
  const chance = Math.min(80, 25 + pool.length * 15);
  if (hashText(`pool-chance:${state.day}`) % 100 >= chance) return undefined;
  const card = pickPoolIncidentCard(cards, state.incidents, state.day, (hashText(`pool-roll:${state.day}`) % 10000) / 10000);
  return card ? deployIncidentCard(state, card) : undefined;
}

/** 应用事件选项的效果。 */
/** 某位契约者是不是已经站在某条还没打完的战线上。 */

/** 应用事件选项的效果。 */
/** 某位契约者是不是已经站在某条还没打完的战线上。 */
export function girlInFront(state: GameState, girlId: string): boolean {
  return (state.fronts ?? []).some(front => (front.status === 'open' || front.status === 'joined') && (front.squad ?? []).includes(girlId));
}

export function applyIncidentEffect(state: GameState, incident: Incident, effect: Incident['options'][number]['effect']): void {
  if (effect.gold) {
    state.gold = Math.max(0, state.gold + effect.gold);
    book(state, state.day, effect.gold);
  }
  if (effect.reputation) state.reputation = clamp100(state.reputation + effect.reputation);
  if (effect.faction) {
    const record = state.factions[effect.faction.id];
    record.standing = clamp100(record.standing + effect.faction.standing);
  }
  const girl = incident.girlId ? findGirl(state, incident.girlId) : undefined;
  if (girl && effect.girl) {
    if (effect.girl.fatigue) girl.fatigue = clamp100(girl.fatigue + effect.girl.fatigue);
    if (effect.girl.spirit) girl.spirit = Math.max(0, Math.min(effectiveMaxSpirit(girl), girl.spirit + effect.girl.spirit));
    if (effect.girl.bond) girl.bond = clamp100(girl.bond + effect.girl.bond);
    if (effect.girl.corruption) {
      if (effect.girl.corruption > 0) addCorruption(state, girl, effect.girl.corruption);
      else girl.corruption = clamp100(girl.corruption + effect.girl.corruption);
    }
  }
  if (effect.territory) shiftTerritory(state, effect.territory.id, effect.territory.faction, `事件「${incident.title}」`);
  if (effect.hostility) {
    applyHostility(state, [incidentHostility(effect.hostility.pair, effect.hostility.delta, incident.source === 'llm')]);
  }
  if (effect.district) {
    // 临时修正直接落到该辖区还没接的委托上，省掉一层状态。
    for (const mission of state.missions) {
      if (mission.status !== 'open' || (mission.district ?? '') !== effect.district.id) continue;
      if (effect.district.targetPct) mission.target = Math.max(10, applyPct(mission.target, effect.district.targetPct));
      if (effect.district.rewardPct) mission.reward = Math.max(0, applyPct(mission.reward, effect.district.rewardPct));
    }
  }
  state.logs.unshift({ id: `log-incident-${incident.id}`, time: dateLabel(state.day, state.minutes), kind: 'incident', text: `「${incident.title}」已决：${incident.options.find(option => option.id === incident.choiceId)?.label ?? '维持现状'}。` });
}

// ---------------------------------------------------------------- 故事线
