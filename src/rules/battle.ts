import { outcomeLabel, rewardRate, simulateBattle } from '../combat.ts';
import { findMonster } from '../content/monsters.ts';
import { grantBattleDrops } from '../materials.ts';
import { currentBoss, pickBoss } from '../content/bosses.ts';
import { items } from '../content/items.ts';
import { CONTRACT_DAYS } from '../contracts.ts';
import type { DistrictId } from '../districts.ts';
import { districtAt, districts } from '../districts.ts';
import { effectiveGuard, equipmentOf } from '../economy.ts';
import { canIntercept, factionGirlsOf, rosterMembers } from '../factions.ts';
import { openFrontIn } from '../fronts.ts';
import { recordMissionRun } from '../missionHistory.ts';
import { clampPollution, districtName, pollutionPenalty, pollutionRelief, pollutionSnapshotOf, pollutionTier, pollutionTierLabel, purifyTo } from '../pollution.ts';
import { recomputeMaxHp, missionExp } from '../progression.ts';
import { effectiveDistrictEffect, factionName } from '../territories.ts';
import { loadBalance } from '../balance.ts';
import { applyHostility, pairOf } from '../hostility.ts';
import type { BattleState, GameState, Girl, Interception, Mission, Monster, Scar, StatKey } from '../types.ts';
import { makeCandidate } from './candidate.ts';
import { addCondition, addCorruption, gainTrait } from './conditions.ts';
import { book, clone, dateLabel, findGirl, grantExpWithNotice, hashText, pushNotice, shiftTerritory } from './core.ts';
import { makeOpinion } from './opinion.ts';
import { capacity, seatsTaken } from './roster.ts';
import { completeStoryMission } from './storyRun.ts';
import { settleDefeat } from './missionDefeat.ts';
import { envoyRaidSquadIds } from './envoy.ts';
// v35 从 src/game.ts 拆出：战斗与调查的结算（不是 combat.ts）。

export function applyScar(state: GameState, girl: Girl, scar: Scar): void {
  girl.scars.push(scar);
  recomputeMaxHp(girl);
  girl.hp = Math.min(girl.hp, girl.maxHp);
  const effect = scar.effect;
  if (effect.kind === 'stat' && effect.stat) {
    const key = effect.stat as StatKey;
    girl.stats[key] = Math.max(20, girl.stats[key] + effect.amount);
  }
  if (effect.kind === 'maxSpirit') girl.maxSpirit = effectiveGuard(girl);
  state.logs.unshift({ id: `log-scar-${scar.id}`, time: dateLabel(state.day, state.minutes), kind: 'memorial', text: `${girl.name}留下了第 ${girl.scars.length} 道疤痕「${scar.name}」。${scar.condition}。` });
}

export function recordBattle(state: GameState, battle: BattleState): void {
  state.battles.unshift(battle);
  state.battles = state.battles.slice(0, 20);
  const kept = new Set(state.battles.map(item => item.id));
  state.battleNotes = (state.battleNotes ?? []).filter(note => kept.has(note.battleId)).slice(0, 20);
}
/**
 * 拦截战的结算分支。
 *
 * 只做「打完并作废原委托」这一件事：不发原委托的报酬与声望，不净化污染，不换辖区，
 * 也不推故事节点。战后的人物状态（HP、疲惫、侵蚀、疤痕、羁绊）仍由 `settleCombat`
 * 的公共收尾处理，这里不复制第二套。
 */

/**
 * 拦截战的结算分支。
 *
 * 只做「打完并作废原委托」这一件事：不发原委托的报酬与声望，不净化污染，不换辖区，
 * 也不推故事节点。战后的人物状态（HP、疲惫、侵蚀、疤痕、羁绊）仍由 `settleCombat`
 * 的公共收尾处理，这里不复制第二套。
 */
export function settleInterception(state: GameState, mission: Mission, interception: Interception, battle: BattleState, at: { day: number; minutes: number }): void {
  const win = battle.outcome === 'victory';
  interception.outcome = win ? 'win' : 'loss';
  mission.status = 'expired';
  mission.squad = [];
  mission.girlId = undefined;
  const faction = interception.faction;
  const drop = win ? 4 : 2;
  state.factions[faction].standing = Math.max(0, state.factions[faction].standing - drop);
  const name = factionName[faction];
  state.logs.unshift({
    id: `log-intercept-${mission.id}`,
    time: dateLabel(at.day, at.minutes),
    kind: 'battle',
    text: win
      ? `拦截战：我们在${districtOfMission(mission).name}打退了${name}的人，「${mission.title}」就此作废。他们不会忘记这笔账（${name}声望 −${drop}）。`
      : `拦截战：${name}在${districtOfMission(mission).name}拦下了「${mission.title}」，原委托作废（${name}声望 −${drop}）。`,
  });
  state.reputation = Math.max(0, state.reputation - 1);
  book(state, at.day, 0);
}
/**
 * 月蚀庭委托的连带声望：帮他们一次，另外两方各记一笔。
 *
 * 只在成功结算之后调用（战斗胜利 / 调查成功），失败不额外扣。
 */

/**
 * 月蚀庭委托的连带声望：帮他们一次，另外两方各记一笔。
 *
 * 只在成功结算之后调用（战斗胜利 / 调查成功），失败不额外扣。
 */
export function applyWitchBounty(state: GameState): void {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  state.factions.association.standing = clamp(state.factions.association.standing - 2);
  state.factions.government.standing = clamp(state.factions.government.standing - 2);
  state.factions.witch.standing = clamp(state.factions.witch.standing + 3);
}

/**
 * 判断这次委托会不会被辖区当主拦下；命中时把拦截编队写进 `mission.interception`。
 *
 * `canIntercept` 是唯一判定入口：委托详情里的红色预警也调它，所以不会出现
 * 「UI 说要被拦、结算却放过」的谎报。
 */

/**
 * 判断这次委托会不会被辖区当主拦下；命中时把拦截编队写进 `mission.interception`。
 *
 * `canIntercept` 是唯一判定入口：委托详情里的红色预警也调它，所以不会出现
 * 「UI 说要被拦、结算却放过」的谎报。
 */
export function interceptionFor(state: GameState, mission: Mission): Interception | undefined {
  if (mission.interception) return mission.interception;
  if (!canIntercept(state, mission)) return undefined;
  const owner = mission.district ? state.territories[mission.district] : undefined;
  if (!owner) return undefined;
  // 那条街上已经有两拨人在打了，今晚不会再有人来拦我们。
  if (mission.district && openFrontIn(state, mission.district)) return undefined;
  const roster = rosterMembers(state, owner).length ? rosterMembers(state, owner) : factionGirlsOf(owner);
  if (!roster.length) return undefined;
  const count = Math.max(1, Math.min(3, 1 + Math.floor(mission.recommendedLevel / 4)));
  const highest = [...roster].sort((a, b) => b.level - a.level)[0];
  const rest = roster.filter(girl => girl.id !== highest.id);
  const seed = hashText(`intercept:${mission.id}`);
  const picked = rest
    .map((girl, index) => ({ girl, key: hashText(`${seed}:${girl.id}:${index}`) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, Math.max(0, count - 1))
    .map(entry => entry.girl);
  mission.interception = { faction: owner, girlIds: [highest.id, ...picked.map(girl => girl.id)] };
  return mission.interception;
}

export function settleCombat(state: GameState, mission: Mission, squad: Girl[], at: { day: number; minutes: number }): BattleState {
  // v168：破坏行动永远打「对面的人」。旧档里漏写 interception 的破坏委托在这里补一份阵容，
  // 否则它会退回成打魔物 —— 那正是这条委托不该做的事。
  const interception = mission.interception
    ?? (mission.envoyKind === 'raid' && mission.envoyTarget
      ? { faction: mission.envoyTarget, girlIds: envoyRaidSquadIds(state, mission.envoyTarget, mission.spawnedAt ? Math.floor(mission.spawnedAt / 1440) : at.day) }
      : undefined);
  // 破坏行动也要打「人」，但它不是被人拦截：敌人取自 interception，结算走自己的分支。
  const raid = Boolean(mission.envoyKind === 'raid' && interception);
  const factionPool = rosterMembers(state, interception?.faction ?? 'association');
  const pool = factionPool.length ? factionPool : (interception ? factionGirlsOf(interception.faction) : []);
  const enemies = interception ? pool.filter(girl => interception.girlIds.includes(girl.id)) : [];
  const battle = simulateBattle({
    mission, girls: squad, day: at.day, minutes: at.minutes,
    // Boss 是消耗战：血量接着上一场剩的，所以「带伤 -20%」对它不生效。
    woundedEnemies: mission.boss ? false : mission.worsened, monsters: state.customMonsters,
    battleKind: interception ? 'interception' : 'commission',
    enemyGirls: interception ? enemies : undefined,
    enemyHpOverride: mission.boss && state.boss ? [state.boss.hp ?? state.boss.maxHp ?? 0] : undefined,
  });
  mission.attempts += 1;
  mission.lastOutcome = battle.outcome;
  const rewards = battle.rewards ?? { gold: 0, exp: 0, bond: 0 };
  if (interception && !raid) {
    settleInterception(state, mission, interception, battle, at);
  } else if (battle.outcome === 'victory') {
    state.gold += rewards.gold;
    state.reputation = Math.min(100, state.reputation + (mission.boss ? 8 : 2));
    book(state, at.day, rewards.gold);
    state.completed.push(mission.id);
    mission.status = 'done';
    mission.completedDay = at.day;
    completeStoryMission(state, mission);
    grantTemplateRewards(state, mission, at);
    const envoyBalance = loadBalance();
    if (mission.envoyKind === 'coop' && mission.envoyFaction) {
      // 共建：只涨自己这边的好感，不再按老规矩 +6。
      state.factions[mission.envoyFaction].standing = Math.min(100, state.factions[mission.envoyFaction].standing + envoyBalance.envoyCoopStandingGain);
    } else if (mission.envoyKind === 'raid' && mission.envoyFaction) {
      // 破坏：发起方好感不变；被破坏方掉好感，两势力火气上升。
      const target = mission.envoyTarget;
      if (target) {
        state.factions[target].standing = Math.max(0, state.factions[target].standing - envoyBalance.envoyRaidTargetStandingLoss);
      }
      const pair = target ? pairOf(mission.envoyFaction, target) : undefined;
      if (pair) {
        applyHostility(state, [{ pair, delta: mission.envoyHostility ?? envoyBalance.envoyRaidHostility, reason: '有人在他们的辖区里被打了一顿' }]);
      }
      state.reputation = Math.max(0, state.reputation - 1);
    } else if (mission.faction) {
      state.factions[mission.faction].standing = Math.min(100, state.factions[mission.faction].standing + 6);
      state.reputation = Math.max(0, Math.min(100, state.reputation + (mission.faction === 'witch' ? -2 : mission.faction === 'association' ? 2 : 1)));
      if (mission.faction === 'witch') applyWitchBounty(state);
    }
    if (mission.boss && state.boss) defeatBoss(state, at.day);
    const dropEnemies = (mission.enemyIds ?? []).map(id => state.customMonsters?.find(m => m.id === id) ?? findMonster(id)).filter((m): m is Monster => Boolean(m));
    if (dropEnemies.length) grantBattleDrops(state, mission, dropEnemies, squad, battle.outcome);
    state.logs.unshift({ id: `log-win-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `${outcomeLabel(battle.outcome, battle.partial === true)}：${mission.title}。${battle.partial ? '大部分魔物被清除，剩下的逃散了；事件同样移出委托池，报酬按 90% 结算。' : '魔物已被清除，事件移出委托池。'}${mission.boss ? '它终于从椅子上下来了。' : ''}`, delta: rewards.gold });
      pushNotice(state, { kind: 'mission', day: at.day, minutes: at.minutes, missionId: mission.id, title: `${battle.partial ? '委托达成' : '委托完成'} · ${mission.title}`, text: `${squad.map(girl => girl.name).join('、')}${battle.partial ? '把大部分魔物清了出去' : '打赢了这一场'}，报酬 ${rewards.gold} 星砂${battle.partial ? '（不完全胜利 · 90%）' : ''}。` });
  } else if (battle.outcome === 'defeat') {
    // v167：失败代价（违约金 / 额外好感 / 当天停单）在 missionDefeat 里单独实现。
    settleDefeat(state, mission, battle, at);
  } else {
    state.gold += rewards.gold;
    book(state, at.day, rewards.gold);
    mission.status = 'open';
    mission.worsened = true;
    mission.squad = [];
    mission.girlId = undefined;
    state.logs.unshift({ id: `log-repel-${battle.id}`, time: dateLabel(at.day, at.minutes), kind: 'battle', text: `${outcomeLabel(battle.outcome)}：${mission.title}。击败不足半数，获得 ${rewards.gold} 星砂（按 50% 结算），魔物带伤退去（下次血量 -20%）。`, delta: rewards.gold });
  }
  // 打完了就把 Boss 剩下的血记下来：下一场从这儿开打，失败也不白跑。
  if (mission.boss && state.boss) {
    const bossUnit = battle.units.find(u => u.side === 'enemy' && u.uid.startsWith('enemy-0-'));
    if (bossUnit) state.boss.hp = Math.max(0, Math.round(bossUnit.hp));
  }
  for (const unit of battle.units.filter(u => u.side === 'ally')) {
    const girl = findGirl(state, unit.uid.replace('ally-', ''));
    if (!girl) continue;
    girl.hp = Math.max(1, unit.hp);
    girl.spirit = effectiveGuard(girl);
    if (battle.outcome === 'victory' || battle.outcome === 'repelled') {
      // v115：经验与星砂共用一个收益系数——不完全胜利 ×0.9、击退 ×0.5。
      grantExpWithNotice(state, girl, Math.max(1, Math.round(missionExp(girl, mission) * rewardRate(battle.outcome, battle.partial === true))));
      girl.contractEndDay += mission.attempts % 2 === 0 ? 1 : 0;
    }
    girl.bond = Math.max(0, Math.min(100, girl.bond + rewards.bond));
    for (const peer of squad) {
      if (peer.id === girl.id) continue;
      const current = girl.relationships[peer.id] ?? 40;
      girl.relationships[peer.id] = Math.max(0, Math.min(100, current + (battle.outcome === 'victory' ? 2 : battle.outcome === 'defeat' ? -2 : 1)));
    }
    if (battle.outcome === 'victory' || battle.outcome === 'repelled') {
      girl.fatigue = Math.min(100, girl.fatigue + Math.round(mission.duration / 12) + 6);
    }
    const gearCorruption = equipmentOf(girl).reduce((sum, item) => sum + (item.corruptionPerBattle ?? 0), 0);
    // 污染造成的侵蚀只从快照读一份：`environment` 已经是地形 + 当主 + 污染的和。
    addCorruption(state, girl, 3 + gearCorruption + (mission.boss ? 6 : 0) + (battle.outcome === 'defeat' ? 2 : 0) + (mission.environment?.corruptionFlat ?? 0));
  }
  if (battle.outcome === 'defeat') {
    for (const scar of battle.scars ?? []) {
      const girl = state.girls.find(g => scar.id.startsWith(`scar-${g.id}-`));
      if (girl) {
        applyScar(state, girl, scar);
        if (scar.fatal) killGirl(state, girl, battle, mission);
      }
    }
  } else {
    for (const girl of squad) {
      if (girl.dead) continue;
      gainTrait(state, girl, mission.title, 0.35);
      if (battle.outcome === 'repelled') addCondition(state, girl, mission.title);
      if (autoOpinionRoll(battle.outcome, girl.id, mission.id, state.day)) {
        state.opinions.unshift(makeOpinion(state, girl, '同伴', `想再去一次「${mission.title}」`, `这次没有彻底解决。她认为下一次可以做得更好。`, '申请把该委托重新排入优先队列。'));
      }
    }
  }
  applySettleEnvironment(state, mission, squad.filter(girl => !girl.dead));
  // 疤痕会削共情，心防得跟着重算，战后再统一回满。
  for (const girl of squad) {
    if (girl.dead) continue;
    girl.maxSpirit = effectiveGuard(girl);
    girl.spirit = girl.maxSpirit;
  }
  // 拦截战不净化污染、也不换辖区：这不是完成委托，只是把那张单子打作废。
  if (!interception) {
    applyPollutionRelief(state, mission, battle.outcome === 'victory' ? 'win' : 'loss');
    if (battle.outcome === 'victory' && mission.faction && mission.district) {
      shiftTerritory(state, mission.district, mission.faction, '阵营委托完成');
    }
  }
  recordBattle(state, battle);
  if (!interception) maybeQueueWhisper(state, mission, squad.filter(girl => !girl.dead), battle.outcome === 'victory' ? 'victory' : 'defeat', battle.id);
  recordMissionRun(state, {
    id: `mission:${mission.id}:${state.day}:${state.minutes}:${mission.attempts}`,
    missionId: mission.id, title: mission.title, work: mission.work, category: mission.category,
    district: mission.district ?? districtAt(mission.x, mission.y),
    day: state.day, minutes: state.minutes, girlIds: squad.map(girl => girl.id),
    outcome: battle.outcome ?? 'draw', reward: rewards.gold, battleId: battle.id,
  });
  return battle;
}
/** 私语判定已抽到 `rules/whisper.ts`；这里只保留再导出，避免调用方改 import。 */
import { maybeQueueWhisper } from './whisper.ts';
export { whisperChance, WHISPER_TIRED_AT, WHISPER_HURT_CORRUPTION, WHISPER_HURT_HP_RATIO } from './whisper.ts';
export type { WhisperChanceInput } from './whisper.ts';
export { maybeQueueWhisper };

export function killGirl(state: GameState, girl: Girl, battle: BattleState, mission: Mission): void {
  if (girl.dead) return;
  girl.dead = true;
  girl.diedAt = dateLabel(state.day, state.minutes);
  girl.status = 'retired';
  girl.remaining = 0;
  girl.missionId = undefined;
  state.memorial.unshift({
    girl: clone(girl), diedAt: girl.diedAt, cause: `在「${mission.title}」中承受了第五道疤痕。`,
    epitaph: girl.quote ?? '愿她终于可以好好睡一觉。', lastBattleId: battle.id,
  });
  state.logs.unshift({ id: `log-death-${girl.id}-${Date.now()}`, time: girl.diedAt, kind: 'memorial', text: `${girl.name}的契约终止了。事务所为她保留了靠窗的位置。` });
  state.reputation = Math.max(0, state.reputation - 5);
  for (const other of state.girls) {
    if (other.id === girl.id) continue;
    const score = other.relationships[girl.id] ?? 40;
    if (score >= 55) other.relationships[girl.id] = Math.max(0, score - 3);
    if (score >= 70) other.bond = Math.max(0, other.bond - 3);
  }
  state.missions.forEach(m => { m.squad = m.squad.filter(id => id !== girl.id); });
  state.girls = state.girls.filter(g => g.id !== girl.id);
  state.messages[girl.id] = state.messages[girl.id] ?? [];
}

export function districtOfMission(mission: Mission) {
  return districts[mission.district ?? districtAt(mission.x, mission.y)];
}

/** 辖区环境在结算时的统一修正：疲劳、精神力。声望在各自分支里结算。 */
export function applySettleEnvironment(state: GameState, mission: Mission, squad: Girl[]): void {
  const region = districtOfMission(mission);
  // 有快照时只认快照：`mission.environment` 已经是「静态地形 + 当主 + 污染」的和，
  // 再读一次 terrain/territory 会把地形与当主的疲劳算两遍。
  const extraFatigue = mission.environment
    ? (mission.environment.fatigueFlat ?? 0)
    : (region.effect.fatigueFlat ?? 0) + (mission.district ? effectiveDistrictEffect(state.territories, mission.district).fatigueFlat ?? 0 : 0);
  // 同样只认快照：浓雾的每小时精神流失要和辖区的合在一起算，别把快照绕过去。
  const spiritPerHour = mission.environment ? (mission.environment.spiritPerHour ?? 0) : (region.effect.spiritPerHour ?? 0);
  const spiritDrain = spiritPerHour * Math.max(0, Math.round(mission.duration / 60));
  for (const girl of squad) {
    if (extraFatigue) girl.fatigue = Math.max(0, Math.min(100, girl.fatigue + extraFatigue));
    if (spiritDrain) girl.spirit = Math.max(0, girl.spirit + spiritDrain);
  }
}

/**
 * 委托结束后的污染变化。
 *
 * 完成降低、失败略升；势力只在这里影响数值（净化量），不影响每日自然上升。
 * 没有辖区的委托（城市级威胁等）不动污染。
 */

/**
 * 委托结束后的污染变化。
 *
 * 完成降低、失败略升；势力只在这里影响数值（净化量），不影响每日自然上升。
 * 没有辖区的委托（城市级威胁等）不动污染。
 */
export function applyPollutionRelief(state: GameState, mission: Mission, result: 'win' | 'loss'): number {
  const district = mission.district;
  // Boss 打完是整城清零（见 defeatBoss），这里再擦一下会把它重新顶回地板。
  if (!district || mission.boss) return 0;
  const before = clampPollution(state.pollution?.[district] ?? 0);
  const snapshot = pollutionSnapshotOf(state, mission);
  const relief = result === 'win' ? pollutionRelief(snapshot) : -pollutionPenalty(snapshot);
  // 擦不到地板以下：地板涨到 27 的那天，再怎么净化也只能拖慢一点点。
  const after = relief > 0 ? purifyTo(state, before, relief) : clampPollution(before - relief);
  state.pollution[district] = after;
  const ownerName = factionName[snapshot.owner] ?? snapshot.owner;
  state.logs.unshift({
    id: `log-pollution-${mission.id}-${state.day}-${state.minutes}-${result}`,
    time: dateLabel(state.day, state.minutes),
    kind: 'dispatch',
    text: `${districtName(district)}污染 ${before} → ${after}（${result === 'win' ? '完成' : '失败'}委托「${mission.title}」，${ownerName}净化 ${relief > 0 ? `+${relief}` : relief}）`,
  });
  if (pollutionTier(before) !== pollutionTier(after)) {
    state.logs.unshift({
      id: `log-pollution-tier-${district}-${state.day}-${after}`,
      time: dateLabel(state.day, state.minutes),
      kind: 'story',
      text: `${districtName(district)}从「${pollutionTierLabel(before)}」变为「${pollutionTierLabel(after)}」。`,
    });
  }
  return relief;
}

/** 工坊委托的额外报酬：装备进背包，契约者直接入职；席位不足时留作免费候选者。 */

/** 工坊委托的额外报酬：装备进背包，契约者直接入职；席位不足时留作免费候选者。 */
export function grantTemplateRewards(state: GameState, mission: Mission, at: { day: number; minutes: number }): void {
  if (!mission.templateId) return;
  if (mission.rewardEquipmentId) {
    const item = items.find(entry => entry.id === mission.rewardEquipmentId);
    if (item) {
      state.inventory[item.id] = (state.inventory[item.id] ?? 0) + 1;
      state.logs.unshift({ id: `log-mission-gear-${mission.id}`, time: dateLabel(at.day, at.minutes), kind: 'dispatch', text: `委托「${mission.title}」的额外报酬「${item.name}」已放进事务所背包。` });
    }
  }
  const rawLevel = Math.round(mission.rewardGirlLevel ?? 0);
  if (rawLevel <= 0) return;
  const level = Math.min(12, Math.max(1, rawLevel));
  let candidate: Girl | undefined;
  for (let attempt = 0; attempt < 24 && !candidate; attempt++) {
    const next = makeCandidate(state, level, hashText(`${mission.id}:girl-reward`) + attempt * 7919);
    if (!state.girls.some(girl => girl.id === next.id) && !state.candidates.some(girl => girl.id === next.id)) candidate = next;
  }
  if (!candidate) return;
  if (seatsTaken(state) < capacity(state)) {
    state.girls.push({
      ...candidate, cost: 0, status: 'idle', roomId: 'lounge', remaining: 0,
      contractEndDay: at.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0,
      pensionMissed: 0, retired: false, retiredReason: undefined, candidateUntilDay: undefined,
    });
    state.logs.unshift({ id: `log-mission-girl-${mission.id}`, time: dateLabel(at.day, at.minutes), kind: 'story', text: `委托「${mission.title}」带回了一位新的契约者「${candidate.name}」。她没有收下签约金，直接住进了宿舍。` });
  } else {
    state.candidates.push({ ...candidate, cost: 0, custom: true, candidateUntilDay: at.day + 7 });
    state.logs.unshift({ id: `log-mission-girl-${mission.id}`, time: dateLabel(at.day, at.minutes), kind: 'story', text: `委托「${mission.title}」带回了一位新的契约者「${candidate.name}」。宿舍已经住满，她暂时留在候选名册，签约金为 0。` });
  }
}

/**
 * 击败 Boss：这一轮结束。
 *
 * 三件事一起做——九区污染清零、循环起点挪到今天、下一次登场排在 `defeatGapDays` 之后。
 * 污染地板是跟着 `cycleStartDay` 走的，所以清零之后城市会从干净开始重新爬。
 */
export function defeatBoss(state: GameState, day: number): void {
  const boss = currentBoss(state) ?? pickBoss(state);
  state.boss = null;
  state.bossCycle += 1;
  state.cycleStartDay = day;
  state.nextBossDay = day + (boss.defeatGapDays ?? 10);
  for (const district of Object.keys(state.pollution) as DistrictId[]) state.pollution[district] = 0;
  state.logs.unshift({ id: `log-boss-defeat-${day}`, time: dateLabel(day, state.minutes), kind: 'battle', text: `${boss.name}倒了。整座城的糖味散了，九个街区的污染一起归零。` });
}

/**
 * 战后要不要替她递一条默认议题。
 *
 * 击退不算失败也不算胜利：委托还在池子里，报酬按八成结，她已经带着状态回来了。
 * 这种时候再自动递一条「想再去一次」，只会把议事日填满同义重复的条目
 * ——击退不再生成默认议题，想谈什么由玩家自己找她。
 */
export function autoOpinionRoll(
  outcome: 'victory' | 'defeat' | 'repelled' | 'draw' | undefined,
  girlId: string,
  missionId: string,
  day: number,
): boolean {
  if (outcome === 'repelled' || outcome === 'victory') return false;
  return hashText(`${girlId}:${missionId}:${day}`) % 100 < 28;
}