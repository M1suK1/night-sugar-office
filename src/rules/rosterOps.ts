import { effectiveGuard, effectiveMaxHp } from '../economy.ts';
import { absoluteMinutes } from '../shift.ts';
import { statusLabels } from '../rules/labels.ts';
import { MEMORY_CLEAR_COST, capacity, clinicQuote, inWithdrawal, seatsTaken, treatmentFor } from '../rules/roster.ts';
import { DEFAULT_OFFICE_PROFILE, sanitizeOfficeProfile } from '../office.ts';
import { factionInfo } from '../content/items.ts';
import { factionCollapsed, leaderById, leaderTitle, rosterLeader } from '../factions.ts';
import { normalizeMarketWindow } from '../rules/market.ts';
import { LEADER_HIRE_COST, hydrate, sanitizeCustomGirl, sanitizeCustomLeader, sanitizeFactionRoster } from '../rules/candidate.ts';
import { FACTION_ORDER } from '../territories.ts';
import { makeOpinion, trimOpinions } from '../rules/opinion.ts';
import { OPENING_INCIDENTS } from '../opening.ts';
import { topUpFromFallback } from '../incidents.ts';
import { CONTRACT_DAYS, pensionArrears, renewalCost } from '../contracts.ts';
import { book, clone, dateLabel, findGirl, hashText } from '../rules/core.ts';
import type { ActionResult, FactionGirl, FactionId, FactionLeader, GameAction, GameState, Girl } from '../types.ts';
// v35 从 src/game.ts 拆出：动作处理器。

/** renewContract 的动作处理器（v35 从 act 拆出）。 */
export function applyRenewContract(state: GameState, action: Extract<GameAction, { type: 'renewContract' }>): ActionResult {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.retired) return { state, ok: false, message: `${girl.name}已经退役，请使用返聘。` };
      const cost = renewalCost(girl) + pensionArrears(girl);
      if (next.gold < cost) return { state, ok: false, message: `续签需要 ${cost} 星砂（含欠缴退休金 ${pensionArrears(girl)}）。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.contractEndDay = Math.max(next.day, girl.contractEndDay) + girl.contractDays;
      girl.contractRenewals += 1; girl.pensionMissed = 0;
      girl.bond = Math.min(100, girl.bond + 3);
      next.logs.unshift({ id: `log-renew-${girl.id}-${girl.contractRenewals}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${girl.name}续签 ${girl.contractDays} 日契约（第 ${girl.contractRenewals} 次续签），并结清退休金欠款。`, delta: -cost });
      return { state: next, ok: true, message: `${girl.name}的契约延长至第 ${girl.contractEndDay} 日。` };
}

/** rehire 的动作处理器（v35 从 act 拆出）。 */
export function applyRehire(state: GameState, action: Extract<GameAction, { type: 'rehire' }>): ActionResult {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (!girl.retired || girl.retiredReason !== 'contract') return { state, ok: false, message: '只有因欠约退休的契约者可以返聘。' };
      const cost = 600 + girl.level * 120;
      if (next.gold < cost) return { state, ok: false, message: `返聘需要 ${cost} 星砂。` };
      next.gold -= cost; book(next, next.day, -cost);
      girl.retired = false; girl.retiredReason = undefined; girl.status = 'idle'; girl.contractEndDay = next.day + CONTRACT_DAYS; girl.pensionMissed = 0;
      girl.bond = Math.max(0, girl.bond - 5);
      next.logs.unshift({ id: `log-rehire-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `${girl.name}接受返聘，重新回到夜班名册。` });
      return { state: next, ok: true, message: `${girl.name}已返聘，契约重新生效。` };
}

/** setAssistant 的动作处理器（v35 从 act 拆出）。 */
export function applySetAssistant(state: GameState, action: Extract<GameAction, { type: 'setAssistant' }>): ActionResult {
      const next = clone(state);
      if (!action.girlId) { next.assistantId = undefined; return { state: next, ok: true, message: '已取消值班助理。' }; }
      const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.bond < 40) return { state, ok: false, message: `${girl.name}还需要更多信任（羁绊 40）才能担任值班助理。` };
      next.assistantId = action.girlId;
      next.logs.unshift({ id: `log-assistant-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: `${girl.name}开始担任值班助理，会替你整理议题与排班。` });
      return { state: next, ok: true, message: `${girl.name}成为值班助理。` };
}

/** seenPrologue 的动作处理器（v35 从 act 拆出）。 */
export function applySeenPrologue(state: GameState, _action: Extract<GameAction, { type: 'seenPrologue' }>): ActionResult {
      if (state.prologueSeen) return { state, ok: true, message: '' };
      const next = clone(state);
      next.prologueSeen = true;
      return { state: next, ok: true, message: '' };
}

/** openingFill 的动作处理器（v35 从 act 拆出）。 */
export function applyOpeningFill(state: GameState, _action: Extract<GameAction, { type: 'openingFill' }>): ActionResult {
      if (state.openingFilledAt === state.day) return { state, ok: true, message: '今夜已经补过了。' };
      const next = clone(state);
      const addedIncidents = topUpFromFallback(next, { day: next.day, minutes: next.minutes }, OPENING_INCIDENTS).length;
      next.openingFilledAt = next.day;
      trimOpinions(next);
      if (addedIncidents > 0) {
        next.logs.unshift({
          id: `log-opening-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'council',
          text: `今夜补充了 ${addedIncidents} 个待用事件；议题等待叙事者提交。`,
        });
      }
      return { state: next, ok: true, message: addedIncidents ? `补齐了 ${addedIncidents} 个待用事件。` : '今夜该有的都有了。' };
}

/** setStarters 的动作处理器（v35 从 act 拆出）。 */
export function applySetStarters(state: GameState, action: Extract<GameAction, { type: 'setStarters' }>): ActionResult {
      const ids = Array.isArray(action.girlIds) ? [...new Set(action.girlIds)] : [];
      if (ids.length < 2 || ids.length > 6) return { state, ok: false, message: '开局编成至少 2 人、最多 6 人。' };
      const pool = new Set<string>([
        ...state.candidates.map(girl => girl.id),
        ...state.girls.filter(girl => !girl.retired).map(girl => girl.id),
      ]);
      if (ids.some(id => !pool.has(id))) return { state, ok: false, message: '有一位少女不在候选里。' };
      const rawLeaders = Array.isArray(action.customLeaders) ? action.customLeaders : [];
      const rawGirls = Array.isArray(action.customGirls) ? action.customGirls : [];
      const pickFaction = (value: unknown): FactionId | undefined => FACTION_ORDER.find(faction => faction === value);
      const pickId = (value: unknown): string => (typeof value === 'string' ? value.trim().slice(0, 64) : '');
      const customLeaders = rawLeaders
        .map(raw => {
          const faction = pickFaction((raw as FactionLeader | undefined)?.faction);
          const id = pickId((raw as FactionLeader | undefined)?.id);
          return faction && id ? sanitizeCustomLeader(raw, faction, id) : null;
        })
        .filter((leader): leader is FactionLeader => Boolean(leader));
      const customGirls = rawGirls
        .map(raw => {
          const faction = pickFaction((raw as FactionGirl | undefined)?.faction);
          const id = pickId((raw as FactionGirl | undefined)?.id);
          return faction && id ? sanitizeCustomGirl(raw, faction, id) : null;
        })
        .filter((girl): girl is FactionGirl => Boolean(girl));
      const parsed = sanitizeFactionRoster(action.roster, customLeaders, customGirls);
      if (!parsed) return { state, ok: false, message: '三方阵容不合法：每方 1 位首领、1–4 位随从，同一个人不能占两个位置。' };
      const roster = parsed.roster;
      const drafted = ids.map(id => {
        const existing = [...state.candidates, ...state.girls].find(girl => girl.id === id);
        return existing;
      }).filter((girl): girl is Girl => Boolean(girl));
      if (drafted.length !== ids.length) return { state, ok: false, message: '有一位少女不在候选里。' };
      const rostered = new Set(FACTION_ORDER.flatMap(faction => [roster[faction].leaderId, ...roster[faction].memberIds]));
      if (drafted.some(girl => rostered.has(girl.id))) return { state, ok: false, message: '已经进入名册的少女不能再进事务所名册。' };
      const next = clone(state);
      const starters = drafted.map(girl => hydrate({ ...girl, candidateUntilDay: 0, status: 'idle', remaining: 0, roomId: 'lounge' }));
      const starterIds = new Set(starters.map(girl => girl.id));
      // 没被选中的原班人马直接离开事务所，不回市场；但已经退役或故去的留在档案里，编成不该抹掉她们。
      next.girls = [...starters, ...state.girls.filter(girl => girl.retired || girl.dead)];
      // 编进事务所或势力的人不再挂牌；剩下的人还在市场里等活儿，编成不该清空候选池。
      next.candidates = next.candidates.filter(girl => !starterIds.has(girl.id) && !rostered.has(girl.id));
      normalizeMarketWindow(next, true);
      next.factionRoster = roster;
      next.customFactionLeaders = parsed.leaders;
      next.customFactionGirls = parsed.girls;
      next.startersPicked = true;
      next.logs.unshift({ id: `log-starters-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'base', text: `开局编成完成：${starters.length} 位契约少女，三方阵容已定。` });
      return { state: next, ok: true, message: '编成已确认。' };
}

/** hireLeader 的动作处理器（v35 从 act 拆出）。 */
export function applyHireLeader(state: GameState, action: Extract<GameAction, { type: 'hireLeader' }>): ActionResult {
      const leader = leaderById(action.leaderId);
      if (!leader) return { state, ok: false, message: '没有这位首领。' };
      const owner = FACTION_ORDER.find(faction => rosterLeader(state, faction).id === leader.id);
      if (!owner) return { state, ok: false, message: '她现在已经不在任何一方了。' };
      if (!factionCollapsed(state, owner)) return { state, ok: false, message: '她还有辖区要守。' };
      if (state.girls.some(girl => girl.id === leader.id && !girl.retired)) return { state, ok: false, message: '她已经在名册里。' };
      if (state.gold < LEADER_HIRE_COST) return { state, ok: false, message: `星砂不足（需要 ${LEADER_HIRE_COST}）。` };
      const next = clone(state);
      next.gold -= LEADER_HIRE_COST;
      next.factions[owner].standing = 0;
      for (const faction of FACTION_ORDER) if (faction !== owner) next.factions[faction].standing = Math.min(100, next.factions[faction].standing + 3);
      const baseMaxHp = Math.round(96 + leader.stats.empathy * 0.3) + leader.level * 4;
      next.girls.unshift(hydrate({
        id: leader.id, name: leader.name, codename: leaderTitle(leader, owner), title: leaderTitle(leader, owner),
        element: (owner === 'association' ? '星光系' : owner === 'government' ? '糖霜系' : '月影系') as Girl['element'], color: leader.color, portrait: '', portraitSpec: leader.portraitSpec,
        level: leader.level, hp: baseMaxHp, maxHp: baseMaxHp, baseMaxHp,
        spirit: 0, maxSpirit: 0,
        fatigue: 0, bond: 40, exp: 0, stats: { ...leader.stats }, baseStats: { ...leader.stats },
        status: 'idle', roomId: 'lounge', remaining: 0, skill: '', skills: [...leader.skillIds],
        description: leader.note, cost: 0, scars: [], relationships: {}, archetype: leader.archetype,
        quote: leader.quote, goal: '找一个不需要再替谁守门的位置。', goalKind: '成长', traits: [], conditions: [],
        contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0,
        appearance: '', personality: '', outfitDescription: '', wardrobe: [], outfitId: 'uniform', expression: 'calm',
        corruption: 0, equipment: {}, factionTag: leader.origin, leader: true, starter: false,
      }));
      next.chronicle.unshift({ id: `chr-hire-${leader.id}-${next.day}`, at: dateLabel(next.day, next.minutes), day: next.day, kind: '登记', title: `${leader.name} 并入事务所`, summary: `${factionInfo[owner].name} 名下已无辖区，${leader.name} 签下了契约。` });
      next.logs.unshift({ id: `log-hire-${leader.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `${leader.name} 成为事务所的契约者（−${LEADER_HIRE_COST} 星砂）。` });
      return { state: next, ok: true, message: `${leader.name} 已加入。` };
}

/** setOfficeProfile 的动作处理器（v35 从 act 拆出）。 */
export function applySetOfficeProfile(state: GameState, action: Extract<GameAction, { type: 'setOfficeProfile' }>): ActionResult {
      const next = clone(state);
      const profile = sanitizeOfficeProfile(action.profile);
      const before = state.office ?? DEFAULT_OFFICE_PROFILE;
      if (profile.background === before.background && profile.philosophy === before.philosophy && profile.goal === before.goal) {
        return { state, ok: false, message: '事务所档案没有变化。' };
      }
      next.office = profile;
      next.logs.unshift({ id: `log-office-profile-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'story', text: '事务所档案已更新：背景、理念与目标写进了世界书。' });
      return { state: next, ok: true, message: '事务所档案已写入世界书。' };
}

/** startExpedition 的动作处理器（v35 从 act 拆出）。 */
export function applyStartExpedition(state: GameState, action: Extract<GameAction, { type: 'startExpedition' }>): ActionResult {
      const next = clone(state);
      if (next.expeditions.length >= 1) return { state, ok: false, message: '星象台一次只能支持一支远行队伍。' };
      const observatory = next.rooms.find(r => r.type === 'observatory');
      if (!observatory) return { state, ok: false, message: '需要先建造星象台。' };
      if (action.memberIds.length < 1 || action.memberIds.length > 2) return { state, ok: false, message: '远行队伍需要 1–2 人。' };
      const members = action.memberIds.map(id => findGirl(next, id)).filter((g): g is Girl => Boolean(g));
      if (members.length !== action.memberIds.length) return { state, ok: false, message: '队伍成员无效。' };
      for (const girl of members) {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}当前无法参加远行。` };
        if (inWithdrawal(girl)) return { state, ok: false, message: `${girl.name}正在断药期，无法远行。请先使用月蚀抑制剂。` };
        if (girl.pensionMissed >= 15) return { state, ok: false, message: `${girl.name}的契约欠约过久，请先续签。` };
        girl.status = 'expedition'; girl.roomId = observatory.id;
      }
      next.expeditions.push({ id: `exp-${next.day}-${next.minutes}-${next.expeditions.length}`, roomId: observatory.id, memberIds: members.map(g => g.id), startedDay: next.day, startedMinutes: next.minutes, cyclesDone: 0, lastSettledDay: next.day, lastSettledMinutes: next.minutes });
      next.logs.unshift({ id: `log-exp-start-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: `${members.map(g => g.name).join('、')}进入星象台远行，每 60 分钟结算一次观测结果。` });
      return { state: next, ok: true, message: '远行开始，星象台将每小时回报一次。' };
}

/** recallExpedition 的动作处理器（v35 从 act 拆出）。 */
export function applyRecallExpedition(state: GameState, action: Extract<GameAction, { type: 'recallExpedition' }>): ActionResult {
      const next = clone(state); const expedition = next.expeditions.find(e => e.id === action.expeditionId);
      if (!expedition) return { state, ok: false, message: '这支远行队伍已经结束。' };
      for (const id of expedition.memberIds) { const girl = findGirl(next, id); if (girl && girl.status === 'expedition') girl.status = 'idle'; }
      next.expeditions = next.expeditions.filter(e => e.id !== expedition.id);
      next.logs.unshift({ id: `log-exp-recall-${expedition.id}`, time: dateLabel(next.day, next.minutes), kind: 'expedition', text: '星象台远行队伍提前返回，最后一轮观测未结算。' });
      return { state: next, ok: true, message: '远行队伍已返回。' };
}

/** clinic 的动作处理器（v35 从 act 拆出）。 */
export function applyClinic(state: GameState, action: Extract<GameAction, { type: 'clinic' }>): ActionResult {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.dead) return { state, ok: false, message: '她已不在名册上。' };
      if (action.mode === 'treat') {
        if (girl.status !== 'idle') return { state, ok: false, message: `${girl.name}正在${statusLabels[girl.status]}，现在不能开始治疗。` };
        if (treatmentFor(next, girl.id)) return { state, ok: false, message: `${girl.name}已经在治疗台上了。` };
        const quote = clinicQuote(girl, Boolean(action.kink));
        if (!quote.kink && quote.missing <= 0) return { state, ok: false, message: `${girl.name}没有需要处理的伤口。` };
        if (next.gold < quote.cost) return { state, ok: false, message: `这次治疗需要 ${quote.cost} 星砂，当前不足。` };
        const startedAt = absoluteMinutes(next.day, next.minutes);
        next.gold -= quote.cost; book(next, next.day, -quote.cost);
        girl.status = 'healing'; girl.remaining = quote.minutes;
        next.treatments.push({
          id: `treat-${girl.id}-${next.day}-${next.minutes}`, girlId: girl.id,
          startedAt, endsAt: startedAt + quote.minutes,
          hpStart: girl.hp, hpTarget: quote.kink ? girl.hp : effectiveMaxHp(girl), paid: quote.cost, kink: Boolean(action.kink),
        });
        next.logs.unshift({
          id: `log-treat-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'clinic',
          text: quote.kink
            ? `${girl.name}预约了一次癖好护理（120 分钟，${quote.cost} 星砂）。诊所把灯调暗了一档。`
            : `${girl.name}躺上诊所的治疗台（${quote.minutes} 分钟，${quote.cost} 星砂）。`,
          delta: -quote.cost,
        });
        return { state: next, ok: true, message: `${girl.name}开始治疗，约 ${quote.minutes} 分钟后结束。` };
      }
      if (action.mode === 'wipe') {
        if (girl.status === 'mission' || girl.status === 'expedition') return { state, ok: false, message: '出勤中的契约者无法进行记忆重塑。' };
        if (next.gold < 4000) return { state, ok: false, message: '记忆重塑需要 4,000 星砂。' };
        const oldLevel = girl.level;
        next.gold -= 4000; book(next, next.day, -4000);
        girl.level = 1; girl.exp = 0;
        girl.stats = { ...girl.baseStats };
        girl.baseMaxHp = Math.max(40, girl.baseMaxHp - (oldLevel - 1) * 4);
        girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
        girl.hp = girl.maxHp;
        girl.maxSpirit = effectiveGuard(girl);
        girl.spirit = girl.maxSpirit;
        girl.status = 'idle'; girl.remaining = 0; girl.conditions = [];
        next.logs.unshift({ id: `log-wipe-${girl.id}-${next.day}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `${girl.name}接受了记忆重塑。等级与能力回到起点，疤痕仍在。`, delta: -4000 });
        return { state: next, ok: true, message: `${girl.name}的能力已重塑至 1 级。` };
      }
      if (action.mode === 'clear') {
        if (girl.status === 'mission' || girl.status === 'expedition') return { state, ok: false, message: '出勤中的契约者无法进行记忆清除。' };
        const mental = girl.scars.filter(scar => scar.kind === 'mental');
        if (!mental.length) return { state, ok: false, message: `${girl.name}没有可清除的精神疤痕。` };
        if (next.gold < MEMORY_CLEAR_COST) return { state, ok: false, message: `记忆清除需要 ${MEMORY_CLEAR_COST.toLocaleString('en-US')} 星砂。` };
        const target = mental.find(scar => scar.id === action.clearScarId) ?? mental[0];
        next.gold -= MEMORY_CLEAR_COST; book(next, next.day, -MEMORY_CLEAR_COST);
        girl.scars = girl.scars.filter(scar => scar.id !== target.id);
        // 疤痕少了，上限跟着回来：血量按剩余疤痕重算，心防按当前共情重算。
        girl.maxHp = Math.max(40, Math.round(girl.baseMaxHp * Math.max(0.4, 1 - girl.scars.length * 0.08)));
        girl.hp = Math.min(girl.hp, girl.maxHp);
        girl.maxSpirit = effectiveGuard(girl);
        girl.spirit = girl.maxSpirit;
        next.logs.unshift({
          id: `log-clear-${girl.id}-${next.day}-${next.minutes}`, time: dateLabel(next.day, next.minutes), kind: 'clinic',
          text: `${girl.name}做了一次记忆清除。「${target.name}」被折好收进档案袋，等级与能力没有动。`,
          delta: -MEMORY_CLEAR_COST,
        });
        return { state: next, ok: true, message: `${girl.name}的精神疤痕「${target.name}」已被清除。` };
      }
      if (action.mode === 'clone') {
        if (girl.cloneOf || girl.generation) return { state, ok: false, message: '复制体不能再次被复制。' };
        if (girl.level < 3) return { state, ok: false, message: '只有 3 级以上的契约者可以进行复制。' };
        if (next.gold < 18000) return { state, ok: false, message: '复制契约需要 18,000 星砂。' };
        if (seatsTaken(next) >= capacity(next)) return { state, ok: false, message: '没有空余席位安置复制体。' };
        next.gold -= 18000; book(next, next.day, -18000);
        const seed = hashText(`${girl.id}:${next.day}:${next.minutes}`).toString(16).padStart(8, '0');
        const copy: Girl = {
          ...clone(girl), id: `g_${seed}`, name: `${girl.name}·复制体`, codename: `${girl.codename} II`, level: 1, exp: 0,
          stats: { ...girl.baseStats }, hp: girl.baseMaxHp, maxHp: girl.baseMaxHp, baseMaxHp: girl.baseMaxHp,
          spirit: 0, maxSpirit: 0,
          fatigue: 0, bond: 20, status: 'idle', roomId: 'lounge', remaining: 0, scars: [], conditions: [],
          relationships: {}, retired: false, dead: false, retiredReason: undefined, cloneOf: girl.id, generation: (girl.generation ?? 0) + 1,
          contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, missionId: undefined,
        };
        next.girls.push(copy);
        next.logs.unshift({ id: `log-clone-${copy.id}`, time: dateLabel(next.day, next.minutes), kind: 'clinic', text: `以${girl.name}为原体完成复制契约。复制体「${copy.name}」从 1 级开始。`, delta: -18000 });
        return { state: next, ok: true, message: `${copy.name}已加入名册。` };
      }
      return { state, ok: false, message: '未知的诊所项目。' };
}

/** hire 的动作处理器（v35 从 act 拆出）。 */
export function applyHire(state: GameState, action: Extract<GameAction, { type: 'hire' }>): ActionResult {
      const next = clone(state); const candidate = next.candidates.find(g => g.id === action.girlId);
      if (!candidate) return { state, ok: false, message: '这位候选者已经不在名册上。' };
      if (next.gold < candidate.cost) return { state, ok: false, message: `星砂不足，还需要 ${candidate.cost - next.gold}。` };
      const used = seatsTaken(next);
      if (used >= capacity(next)) return { state, ok: false, message: '基地席位已满，请先扩建宿舍或让资深契约者退役。' };
      next.gold -= candidate.cost;
      book(next, next.day, -candidate.cost);
      next.girls.push({ ...candidate, status: 'idle', roomId: 'lounge', remaining: 0, contractEndDay: next.day + CONTRACT_DAYS, contractDays: CONTRACT_DAYS, contractRenewals: 0, pensionMissed: 0, retired: false, retiredReason: undefined });
      normalizeMarketWindow(next, true);
      next.candidates = next.candidates.filter(g => g.id !== candidate.id);
      next.marketSold = Array.from(new Set([...(next.marketSold ?? []), candidate.id]));
      normalizeMarketWindow(next);
      next.logs.unshift({ id: `log-hire-${candidate.id}`, time: dateLabel(next.day, next.minutes), kind: 'finance', text: `与${candidate.name}缔结契约，事务所增加一位新的魔法少女。`, delta: -candidate.cost });
      next.opinions.unshift(makeOpinion(next, next.girls[next.girls.length - 1], '同伴', `欢迎${candidate.name}`, '新契约者已经住进宿舍。她想为对方准备一点什么。', '申请 300 星砂筹办一次小型欢迎会。'));
      return { state: next, ok: true, message: `${candidate.name}已加入夜糖事务所。` };
}

/** retire 的动作处理器（v35 从 act 拆出）。 */
export function applyRetire(state: GameState, action: Extract<GameAction, { type: 'retire' }>): ActionResult {
      const next = clone(state); const girl = findGirl(next, action.girlId);
      if (!girl) return { state, ok: false, message: '找不到这位契约者。' };
      if (girl.status === 'mission') return { state, ok: false, message: '出勤中的契约者无法办理退役。' };
      if (girl.scars.length < 4) return { state, ok: false, message: '只有累积 4 道疤痕的契约者可以申请退役。' };
      girl.retired = true; girl.status = 'retired'; girl.retiredReason = 'injury';
      next.logs.unshift({ id: `log-retire-${girl.id}`, time: dateLabel(next.day, next.minutes), kind: 'memorial', text: `${girl.name}办理了退役，转任事务所文职。她的席位仍留在基地，并将按月领取退休金。` });
      return { state: next, ok: true, message: `${girl.name}已转为文职，不再参与派遣。` };
}
