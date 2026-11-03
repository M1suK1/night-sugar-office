import { outcomeLabel } from '../combat.ts';
import { bossTemplateOf, pickBoss } from '../content/bosses.ts';
import type { DistrictId } from '../districts.ts';
import { districts } from '../districts.ts';
import { effectiveMaxHp, effectiveMaxSpirit } from '../economy.ts';
import { planFronts, resolveDueFronts } from '../fronts.ts';
import { applyHostility, hostilityGain } from '../hostility.ts';
import { blockingIncidents, deployDueIncident, expireIncidents, markIncidentCooldown, topUpFromFallback } from '../incidents.ts';
import { clampPollution, pollutionDailyRise, pollutionFloor, pollutionTier, pollutionTierLabel } from '../pollution.ts';
import { applyResignations, tickStrain } from '../resignations.ts';
import { SHIFT_END, SHIFT_START, WAVE_AT, WAVE_SIZES, absoluteMinutes, dayOf, minutesOf, shiftStartAt } from '../shift.ts';
import type { ActionResult, BattleState, FactionId, GameState, Girl, Mission } from '../types.ts';
import { interceptionFor, settleCombat } from './battle.ts';
import { accruePension, addCorruption, drugTick, gainTrait, tickConditions } from './conditions.ts';
import { book, clone, dateLabel, findGirl, grantExpWithNotice, hashText } from './core.ts';
import { careRecovery } from './dailyOps.ts';
import { applyIncidentEffect, rollPoolIncident } from './incidentOps.ts';
import { settleInvestigation } from './investigation.ts';
import { makeFactionStock, refreshMarket } from './market.ts';
import { makeBossMission, makeCommission } from './missions.ts';
import { trimOpinions } from './opinion.ts';
import { MISSION_POOL_SIZE, ensureMissionPools, ensureMonsterPool } from './pools.ts';
import { resolveStoryWait } from './storyRun.ts';
// v35 从 src/game.ts 拆出：时钟、换日、打烊与赌场账本。

/**
 * Boss 不撤离：`deadline` 字段留着给旧存档读，但不再参与判定。
 * 它在场就一直扣声望，直到被清掉——这是「拖延要付账」的唯一来源。
 */
export function bossTick(state: GameState, elapsed: number): void {
  if (!state.boss) return;
  state.boss.lastTick += elapsed;
  while (state.boss.lastTick >= 180) {
    state.boss.lastTick -= 180;
    state.reputation = Math.max(0, state.reputation - 1);
  }
}

/**
 * 击败 Boss：这一轮结束。
 *
 * 三件事一起做——九区污染清零、循环起点挪到今天、下一次登场排在 `defeatGapDays` 之后。
 * 污染地板是跟着 `cycleStartDay` 走的，所以清零之后城市会从干净开始重新爬。
 */

/**
 * 生成一条议题；`variant` 让同一个时段也能补出不同的议题（首夜连补三条时用）。
 * 返回是否真的加了一条：同一个议题标题还挂在待议里就不再重复提。
 */
export function settleExpedition(state: GameState, expeditionId: string, at: { day: number; minutes: number }): void {
  const expedition = state.expeditions.find(e => e.id === expeditionId);
  if (!expedition) return;
  const members = expedition.memberIds.map(id => findGirl(state, id)).filter((g): g is Girl => Boolean(g));
  if (!members.length) { state.expeditions = state.expeditions.filter(e => e.id !== expeditionId); return; }
  const seed = hashText(`${expedition.id}:${expedition.cyclesDone}:${at.day}:${at.minutes}`);
  const gain = 60 + (seed % 121);
  const found = seed % 10 < 6;
  state.gold += gain;
  book(state, at.day, gain);
  expedition.cyclesDone += 1;
  expedition.lastSettledDay = at.day;
  expedition.lastSettledMinutes = at.minutes;
  for (const girl of members) {
    girl.fatigue = Math.min(100, girl.fatigue + 5);
    girl.bond = Math.min(100, girl.bond + 1);
    grantExpWithNotice(state, girl, 2);
    if (found) gainTrait(state, girl, '星象台远行', 0.12);
  }
  state.logs.unshift({ id: `log-exp-${expedition.id}-${expedition.cyclesDone}`, time: dateLabel(at.day, at.minutes), kind: 'expedition', text: `星象台远行第 ${expedition.cyclesDone} 轮：${members.map(g => g.name).join('、')}带回 ${gain} 星砂${found ? '和一段可以写进档案的见闻' : '，但没有发现异常'}。`, delta: gain });
  if (members.some(girl => girl.fatigue >= 95)) {
    for (const girl of members) { if (girl.status === 'expedition') { girl.status = 'idle'; girl.roomId = 'lounge'; girl.remaining = 0; } }
    state.expeditions = state.expeditions.filter(item => item.id !== expeditionId);
    state.logs.unshift({ id: `log-exp-tired-${expedition.id}`, time: dateLabel(at.day, at.minutes), kind: 'expedition', text: `远行队因疲劳达到极限自动返回。${members.map(g => g.name).join('、')}需要休息。` });
  }
}

/**
 * 推进时间或换日之后调用：先让过期的委托退场，再把该出现的时段委托放上地图。
 * 返回本次变动条数，方便上层决定要不要提示。
 */
export function syncShift(state: GameState): number {
  const now = absoluteMinutes(state.day, state.minutes);
  let changed = 0;
  for (const mission of state.missions) {
    if (mission.storylineId) continue;
    if (mission.status !== 'open' || mission.deadlineAt === undefined) continue;
    if (now < mission.deadlineAt) continue;
    mission.status = 'expired';
    mission.squad = [];
    changed += 1;
    state.logs.unshift({ id: `log-expire-${mission.id}`, time: dateLabel(state.day, state.minutes), kind: 'dispatch', text: `「${mission.title}」超过接取时限，委托已自动撤销。` });
  }
  // 过期的位子立刻从模板补回来，板子上始终是 12 条。
  if (changed) ensureMissionPools(state);
  if (state.minutes < SHIFT_START) return changed;
  if (state.shift.day !== state.day) state.shift = { day: state.day, wave: 0 };
  while (state.shift.wave < WAVE_AT.length && now >= shiftStartAt(state.day) + WAVE_AT[state.shift.wave]) {
    const wave = state.shift.wave;
    const fresh: string[] = [];
    const liveMissions = () => state.missions.filter(mission => mission.status === 'open' || mission.status === 'active').length;
    for (let slot = 0; slot < WAVE_SIZES[wave]; slot++) {
      if (liveMissions() >= MISSION_POOL_SIZE) break;
      const mission = makeCommission(state, wave, slot);
      if (state.missions.some(existing => existing.id === mission.id)) continue;
      state.missions.unshift(mission);
      fresh.push(`${mission.title}（${mission.window === 'urgent' ? '紧急' : '长期'}）`);
      changed += 1;
    }
    state.shift.wave += 1;
    const waveIncident = deployDueIncident(state, 'wave', { day: state.day, minutes: state.minutes }, { wave });
    if (waveIncident) {
      state.incidents.unshift(waveIncident);
      markIncidentCooldown(state, waveIncident);
      state.logs.unshift({ id: `log-incident-wave-${waveIncident.id}`, time: dateLabel(state.day, state.minutes), kind: 'incident', text: `第 ${wave + 1} 时段，有人敲了敲窗：${waveIncident.title}。` });
    }
    if (fresh.length) {
      state.logs.unshift({ id: `log-wave-${state.day}-${wave}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: `第 ${wave + 1} 时段委托送达：${fresh.join('、')}。` });
    }
  }
  return changed;
}

/** 打烊后清掉上一晚没被接下的短委托；未到期的长期委托留在板上。 */

/** 打烊后清掉上一晚没被接下的短委托；未到期的长期委托留在板上。 */
export function closeShift(state: GameState): number {
  const now = absoluteMinutes(state.day, state.minutes);
  const before = state.missions.length;
  const longLeft = state.missions
    .filter(mission => mission.status === 'open' && mission.window === 'long' && (mission.deadlineAt ?? 0) > now)
    .sort((a, b) => (b.deadlineAt ?? 0) - (a.deadlineAt ?? 0))
    .slice(0, 8);
  const kept = new Set(longLeft.map(mission => mission.id));
  // Boss 委托没有接取时限，不能当普通短委托在打烊时清掉。
  state.missions = state.missions.filter(mission => mission.status === 'done' || mission.status === 'active' || kept.has(mission.id) || Boolean(mission.storylineId) || Boolean(mission.boss));
  // 打完的委托只留最近 30 条：`state.completed` 才是全量账本，事件池不该越滚越长。
  const done = state.missions.filter(mission => mission.status === 'done');
  if (done.length > 30) {
    const drop = new Set(done.slice(0, done.length - 30).map(mission => mission.id));
    state.missions = state.missions.filter(mission => !drop.has(mission.id));
  }
  return before - state.missions.length;
}

export function advanceClock(state: GameState, to: number): void {
  const now = state.day * 1440 + state.minutes;
  const elapsed = to - now;
  if (elapsed <= 0) return;
  const previousDay = state.day;
  // 营业夜从 20:00 起算：00:00–02:00 仍属于前一天的「第 N 日」，只是分钟数越过 1440。
  const nextDay = dayOf(to);
  state.day = nextDay;
  state.minutes = minutesOf(to, nextDay);
  const days = state.day - previousDay;
  if (days > 0) {
    accruePension(state, days);
    for (const girl of state.girls) tickConditions(girl, days);
    for (let i = 0; i < days; i++) processDay(state);
    ensureMonsterPool(state);
    for (const opinion of state.opinions) {
      if (opinion.status === 'deferred' && (opinion.revisitDay ?? Infinity) <= state.day) {
        opinion.status = 'pending';
        state.logs.unshift({ id: `log-op-revisit-${opinion.id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'council', text: `暂缓的议题「${opinion.title}」重新回到议事桌。` });
      }
    }
    if (state.day > state.councilDay) { state.councilDay = state.day; trimOpinions(state); }
  }
  bossTick(state, elapsed);
  for (const girl of state.girls) {
    if (girl.status === 'mission' || girl.status === 'healing' || girl.status === 'resting') girl.remaining = Math.max(0, girl.remaining - elapsed);
  }
  for (const story of [...state.storylines]) {
    if (story.status !== 'active' || story.run?.waiting?.kind !== 'wait') continue;
    const until = story.run.waiting.until;
    if (typeof until === 'number' && until <= to) resolveStoryWait(state, story.id, 'wait', story.run.waiting.ref);
  }
  settleTreatments(state, to);
}

/** 诊所治疗按分钟线性回血；到点后恢复待命，带癖好的治疗在结束时留下痕迹。 */

/** 诊所治疗按分钟线性回血；到点后恢复待命，带癖好的治疗在结束时留下痕迹。 */
export function settleTreatments(state: GameState, to: number): void {
  if (!state.treatments.length) return;
  for (const treatment of [...state.treatments]) {
    const girl = state.girls.find(item => item.id === treatment.girlId);
    if (!girl || girl.dead) { state.treatments = state.treatments.filter(item => item.id !== treatment.id); continue; }
    const total = Math.max(1, treatment.endsAt - treatment.startedAt);
    const progress = Math.max(0, Math.min(1, (to - treatment.startedAt) / total));
    girl.hp = Math.min(treatment.hpTarget, Math.round(treatment.hpStart + (treatment.hpTarget - treatment.hpStart) * progress));
    if (to < treatment.endsAt) continue;
    state.treatments = state.treatments.filter(item => item.id !== treatment.id);
    girl.status = 'idle'; girl.remaining = 0;
    if (treatment.kink) {
      // 癖好护理只影响关系，不留下永久特性。
      girl.bond = Math.min(100, girl.bond + 4);
      girl.corruption = Math.min(100, (girl.corruption ?? 0) + 3);
    }
    state.logs.unshift({
      id: `log-treat-done-${girl.id}-${state.day}-${state.minutes}`, time: dateLabel(state.day, state.minutes), kind: 'clinic',
      text: `${girl.name}结束了这次治疗，血量恢复到 ${girl.hp}/${effectiveMaxHp(girl)}${treatment.kink ? '。离开时她没说下次还会不会受伤。' : '。'}`,
    });
  }
}

export function processDay(state: GameState): void {
  // 顺序本身就是可测行为：药物 → 疲劳侵蚀 → 污染日增 → 敌意值 → 势力库存/来使 → 市场 → BOSS → 战线。
  applyHostility(state, hostilityGain(state));
  for (const girl of [...state.girls]) {
    drugTick(state, girl);
    if (!girl.dead && girl.fatigue >= 80) addCorruption(state, girl, 2);
  }
  // 离职压力：条件连续成立几天才会开口；这里只累计与触发，不碰侵蚀度。
  tickStrain(state);
  applyResignations(state);
  // 污染只自然上涨，任何势力都不加也不减；三方只影响「完成委托后净化多少」。
  // 只在跨档时写日志，避免每天九条噪声。
  if (state.pollution) {
    // v24 的污染是一条循环：地板随时间抬高 → 自然上升 → Boss 在场时全城一起被压。
    // 顺序不能换：先抬地板，昨天擦干净的地方才会重新脏起来。
    const floor = pollutionFloor(state);
    const pressure = state.boss ? bossTemplateOf(state, state.boss.template)?.pollutionPressure ?? 0 : 0;
    for (const id of Object.keys(state.pollution) as DistrictId[]) {
      const level = clampPollution(Math.max(state.pollution[id], floor));
      const next = clampPollution(clampPollution(level + pollutionDailyRise(level)) + pressure);
      state.pollution[id] = next;
      if (pollutionTier(next) !== pollutionTier(level)) {
        state.logs.unshift({
          id: `log-pollution-${id}-${state.day}`, time: dateLabel(state.day, state.minutes), kind: 'territory',
          text: `${districts[id].name}的污染跨过了一个台阶：${level} → ${next}（${pollutionTierLabel(next)}）。`,
        });
      }
    }
  }
  for (const faction of Object.keys(state.factions) as FactionId[]) {
    if (state.factions[faction].stockDay < state.day) {
      state.factions[faction].stockDay = state.day;
      state.marketStock = state.marketStock.filter(entry => entry.faction !== faction)
        .concat(makeFactionStock(faction, state.day, { standing: state.factions[faction].standing, marketLevel: state.marketLevel }));
    }
    if (state.factions[faction].envoyDay < state.day) {
      state.factions[faction].envoyDay = state.day;
      state.factions[faction].envoyTaskId = undefined;
    }
  }
  if (state.marketDay < state.day) refreshMarket(state);
  if (state.day >= state.nextBossDay && !state.boss) {
    state.bossCycle += 1;
    const boss = pickBoss(state);
    const mission = makeBossMission(state, boss);
    state.missions.unshift(mission);
    // `nextBossDay` 只在击败时按 `defeatGapDays` 写，这里不写——它要一直挂着。
    state.boss = { id: `boss-${state.bossCycle}`, appearedDay: state.day, lastTick: 0, deadline: state.day * 1440, missionId: mission.id, template: boss.id, maxHp: boss.maxHp, hp: boss.maxHp };
    state.logs.unshift({ id: `log-boss-${state.bossCycle}`, time: dateLabel(state.day, state.minutes), kind: 'battle', text: `${boss.name}坐上了游乐场中央那把椅子。城市进入最高警戒，委托池新增城市级威胁。` });
  }
  // 敌意值满 100 就在这一天变成两条街上的战线；没人管的话到点自己打完。
  planFronts(state, { day: state.day, minutes: state.minutes });
  resolveDueFronts(state, { day: state.day, minutes: state.minutes });
}

export function advance(state: GameState, minutes: number): ActionResult {
  if (!Number.isFinite(minutes) || minutes < 1) return { state, ok: false, message: '推进时间需要至少一分钟。' };
  if (minutes > 180) return { state, ok: false, message: '一次最多推进 180 分钟，请分段安排夜晚。' };
  if (blockingIncidents(state).length > 0) return { state, ok: false, message: '桌上还有必须立刻决定的事，先处理它。' };
  const nowAbs = absoluteMinutes(state.day, state.minutes);
  const closeAbs = absoluteMinutes(state.day, SHIFT_END);
  if (nowAbs >= closeAbs || state.minutes < SHIFT_START) return { state, ok: false, message: '今晚已经打烊，前往下一天继续营业。' };
  const step = Math.min(minutes, closeAbs - nowAbs);
  const next = clone(state);
  syncShift(next);
  // 战斗/调查刚结算完的位子，同一次推进里就补回模板。
  ensureMissionPools(next);
  const end = next.day * 1440 + next.minutes + step;
  let lastBattle: BattleState | undefined;
  for (let guard = 0; guard < 24; guard++) {
    const events: { at: number; mission?: Mission; girl?: Girl; expedition?: GameState['expeditions'][number] }[] = [];
    for (const mission of next.missions) {
      if (mission.status !== 'active') continue;
      const squad = mission.squad.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g && g.status === 'mission'));
      if (!squad.length) continue;
      const remaining = Math.min(...squad.map(g => g.remaining));
      events.push({ at: next.day * 1440 + next.minutes + remaining, mission });
    }
    for (const girl of next.girls) {
      if (girl.status === 'healing' || girl.status === 'resting') events.push({ at: next.day * 1440 + next.minutes + girl.remaining, girl });
    }
    for (const expedition of next.expeditions) {
      const last = expedition.lastSettledDay * 1440 + expedition.lastSettledMinutes;
      const nextAt = last + 60;
      if (nextAt <= end) events.push({ at: nextAt, expedition });
    }
    const due = events.filter(e => e.at <= end).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    advanceClock(next, due.at);
    if (due.mission) {
      const mission = next.missions.find(m => m.id === due.mission!.id)!;
      const squad = mission.squad.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
      // 先判拦截再分流：被拦下的调查委托也打成一场战斗，而不是先结算调查再补一场。
      const intercept = interceptionFor(next, mission);
      if (intercept) lastBattle = settleCombat(next, mission, squad, { day: next.day, minutes: next.minutes });
      else if (mission.work === 'combat' && mission.enemyIds?.length) lastBattle = settleCombat(next, mission, squad, { day: next.day, minutes: next.minutes });
      else settleInvestigation(next, mission, squad, { day: next.day, minutes: next.minutes });
      for (const girl of squad) { girl.status = 'idle'; girl.remaining = 0; girl.missionId = undefined; }
      if (mission.status === 'done' || mission.status === 'expired') {
        mission.squad = [];
        mission.girlId = undefined;
      }
      const settledIncident = deployDueIncident(next, 'missionDone', { day: next.day, minutes: next.minutes }, { work: mission.work, wave: next.shift.wave });
      if (settledIncident) {
        next.incidents.unshift(settledIncident);
        markIncidentCooldown(next, settledIncident);
        next.logs.unshift({ id: `log-incident-mission-${settledIncident.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `委托收尾时，有人等在门口：${settledIncident.title}。` });
      }
    } else if (due.girl) {
      const girl = findGirl(next, due.girl.id);
      if (girl) careRecovery(girl, 'resting');
    } else if (due.expedition) {
      settleExpedition(next, due.expedition.id, { day: next.day, minutes: next.minutes });
    }
  }
  advanceClock(next, end);
  syncShift(next);
  for (const girl of next.girls) {
    if (girl.dead || girl.retired || girl.status === 'mission' || girl.status === 'expedition') continue;
    if (next.day > girl.contractEndDay && girl.pensionMissed >= 15) {
      girl.retired = true; girl.retiredReason = 'contract'; girl.status = 'retired'; girl.remaining = 0;
      next.logs.unshift({ id: `log-contract-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}的契约已欠约 ${girl.pensionMissed} 日，事务所为她办理了强制退休。她仍会按月领取退休金。` });
    }
  }
  const closed = next.minutes >= SHIFT_END;
  return { state: next, ok: true, message: closed ? '打烊时间到了。接下今晚的账，明晚再开张。' : lastBattle ? `${outcomeLabel(lastBattle.outcome)}：${lastBattle.missionTitle}` : `时间推进 ${step} 分钟。`, battle: lastBattle };
}

/** 结算今晚：把剩余时间走完、撤回未接委托、休整，然后开门进入下一天 20:00。 */
/** 打烊前先给过期弹窗结账：没人处理就掉一点安定度，然后让它们退出桌面。 */

/** 结算今晚：把剩余时间走完、撤回未接委托、休整，然后开门进入下一天 20:00。 */
/** 打烊前先给过期弹窗结账：没人处理就掉一点安定度，然后让它们退出桌面。 */
export function settleExpiredIncidents(state: GameState): GameState {
  if (!expireIncidents({ ...state, incidents: state.incidents.map(item => ({ ...item })) } as GameState, { day: state.day, minutes: state.minutes }).length) return state;
  const next = clone(state);
  for (const expired of expireIncidents(next, { day: next.day, minutes: next.minutes })) {
    applyIncidentEffect(next, expired, { reputation: -1 });
    // 蓝图里的弹窗超时也要把剧情放过去，否则一条故事线会永远卡在这张卡上。
    if (expired.storylineId) resolveStoryWait(next, expired.storylineId, 'incident', expired.id, 'failure');
    next.logs.unshift({ id: `log-incident-expire-${expired.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `「${expired.title}」没有人处理，就这样过去了。夜里少了一点信任。` });
  }
  return next;
}

export function endNight(state: GameState): ActionResult {
  if (blockingIncidents(state).length > 0) return { state, ok: false, message: '还有必须立刻决定的事。处理完才能打烊。' };
  let current = settleExpiredIncidents(state);
  let battle: BattleState | undefined;
  for (let guard = 0; guard < 4; guard++) {
    const now = absoluteMinutes(current.day, current.minutes);
    const close = absoluteMinutes(current.day, SHIFT_END);
    if (now >= close) break;
    const result = advance(current, Math.min(180, close - now));
    if (!result.ok) break;
    current = result.state;
    battle = result.battle ?? battle;
  }
  const next = clone(current);
  const dismissed = closeShift(next);
  for (const girl of next.girls) {
    if (girl.dead || girl.retired || girl.status === 'mission' || girl.status === 'expedition') continue;
    girl.fatigue = Math.max(0, girl.fatigue - 12);
    girl.spirit = Math.min(effectiveMaxSpirit(girl), girl.spirit + 20);
  }
  // 打烊一律挪到下一夜开门。旧写法只在 minutes 落在「门外」时 +1，
  // 于是这一夜被弹窗拦住、停在 00:00–02:00 之间再打烊时，目标时间反而比现在早，
  // advanceClock 静默 return，day 原地不动——看起来像「午夜重开」。
  const closedDay = next.minutes >= SHIFT_START ? next.day + 1 : next.day;
  advanceClock(next, absoluteMinutes(closedDay, SHIFT_START));
  next.shift = { day: next.day, wave: 0 };
  syncShift(next);
  ensureMissionPools(next);
  const openingIncident = deployDueIncident(next, 'dayStart', { day: next.day, minutes: next.minutes }, { wave: 0 });
  if (openingIncident) {
    next.incidents.unshift(openingIncident);
    markIncidentCooldown(next, openingIncident);
    next.logs.unshift({ id: `log-incident-night-${openingIncident.id}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `第 ${next.day} 日开门前，有人把一件事放在了桌上：${openingIncident.title}。` });
  }
  topUpFromFallback(next, { day: next.day, minutes: next.minutes }, 3);
  const poolIncident = rollPoolIncident(next);
  if (poolIncident) {
    next.incidents.unshift(poolIncident);
    next.logs.unshift({ id: `log-incident-pool-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'incident', text: `随机事件池抽中了「${poolIncident.title}」。${poolIncident.body.slice(0, 40)}` });
  }
  next.logs.unshift({ id: `log-night-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `打烊。${dismissed ? `${dismissed} 份没被接下的委托被撤回。` : '没有未接的委托。'}夜色退去，第 ${next.day} 日 20:00，事务所重新开门。` });
  return { state: next, ok: true, message: `第 ${next.day} 日开门，新的委托已经贴上告示板。`, battle };
}
