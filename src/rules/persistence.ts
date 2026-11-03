import { FIRST_BOSS_DAY } from '../opening.ts';
import { bossTemplateOf } from '../content/bosses.ts';
import { normalizeGeneratedDay } from '../autoGenerate.ts';
import { sanitizeCityNews } from '../cityNews.ts';
import { validBattleNote, validGeneratedItem, validGirl } from '../rules/validate.ts';
import { getItem, items, registerItem } from '../content/items.ts';
import { createSeedPack } from '../content/seed-pack.ts';
import { extraMissions } from '../content/missions-extra.ts';

import { districtAt, districts } from '../districts.ts';
import { effectiveGuard } from '../economy.ts';
import { defaultFactionRoster } from '../factions.ts';
import { HOSTILITY_PAIRS, clampHostility, makeTrack } from '../hostility.ts';
import { tierFromPrice } from '../items.ts';
import { DEFAULT_OFFICE_PROFILE, sanitizeOfficeProfile } from '../office.ts';
import { resolveOpinionOptions } from '../opinions.ts';
import { repairPollution } from '../pollution.ts';
import { SHIFT_END, SHIFT_START, WAVE_AT, absoluteMinutes, deadlineFor, shiftStartAt } from '../shift.ts';
import type { TerritoryMap } from '../territories.ts';
import { FACTION_ORDER, repairTerritories } from '../territories.ts';
import type { BattleNote, ChronicleEntry, FactionGirl, FactionId, FactionLeader, FactionPair, GameState, Girl, HostilityTrack, MarketStockEntry, Mission } from '../types.ts';
import { defaultSkills, hydrate, sanitizeCustomGirl, sanitizeCustomLeader, sanitizeFactionRoster } from './candidate.ts';
import { clone, dateLabel } from './core.ts';
import { makeFactionStock, normalizeMarketWindow } from './market.ts';
import { createInitialState } from './state.ts';
// v35 从 src/game.ts 拆出：存档读写与旧档迁移。

export const SAVE_KEY = 'night-sugar-office:v1';
/** 衣柜上限：三套制式 + 一格自定义礼装。 */
export function migrate(raw: Record<string, unknown>): GameState | null {
  if (raw.version !== 1) return null;
  try {
    const pack = createSeedPack();
    const base = createInitialState(pack);
    const oldGirls = Array.isArray(raw.girls) ? raw.girls as Girl[] : [];
    const girls = oldGirls.length ? oldGirls.map(g => {
      const seed = pack.girls.find(s => s.id === g.id);
      return hydrate({ ...(seed ?? base.girls[0]), ...g, skills: seed?.skills ?? defaultSkills(g.id), scars: [], relationships: seed?.relationships ?? {}, baseMaxHp: g.maxHp, spirit: seed?.spirit ?? 0, maxSpirit: seed?.maxSpirit ?? 0, exp: 0 });
    }) : base.girls;
    const missions = base.missions.map(m => {
      const old = (raw.missions as Mission[] | undefined)?.find(x => x.id === m.id);
      return old ? { ...m, status: old.status, girlId: old.girlId, squad: old.girlId ? [old.girlId] : [], attempts: old.status === 'done' ? 1 : 0 } : m;
    });
    return { ...base, day: Number(raw.day) || 14, minutes: Number(raw.minutes) || 0, gold: Number(raw.gold) || 0, reputation: Number(raw.reputation) || 50, girls, missions, logs: Array.isArray(raw.logs) ? raw.logs.slice(0, 300) : base.logs, completed: Array.isArray(raw.completed) ? raw.completed.filter(x => typeof x === 'string') : [], samples: Array.isArray(raw.samples) ? raw.samples.slice(-60) : base.samples, messages: {}, memorial: [], battles: [] };
  } catch { return null; }
}
export function loadState(raw: string | null): GameState {
  if (!raw) return createInitialState();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return createInitialState(); }
  if (!parsed || typeof parsed !== 'object') return createInitialState();
  const value = parsed as Record<string, unknown>;
  if (value.version === 1) return migrate(value) ?? createInitialState();
  if (![3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(value.version as number)) return createInitialState();
  try {
    const blankSave = value.blank === true;
    if (!Array.isArray(value.girls) || (!value.girls.length && !blankSave) || !value.girls.every(validGirl)) return createInitialState();
    const ids = new Set<string>();
    for (const girl of value.girls) {
      if (ids.has(girl.id)) return createInitialState();
      ids.add(girl.id);
      if (girl.scars && !Array.isArray(girl.scars)) return createInitialState();
      if (girl.relationships && (typeof girl.relationships !== 'object' || Array.isArray(girl.relationships))) return createInitialState();
    }
    if (!Array.isArray(value.rooms) || value.rooms.length < 1 || value.rooms.length > 4) return createInitialState();
    if (!Array.isArray(value.missions)) return createInitialState();
    for (const mission of value.missions as Mission[]) {
      if (!mission || typeof mission.id !== 'string' || !['open', 'active', 'done', 'expired'].includes(mission.status)) return createInitialState();
      if (!Array.isArray(mission.squad)) return createInitialState();
      if (mission.status === 'active') {
        if (!mission.squad.length) return createInitialState();
        for (const id of mission.squad) {
          const girl = (value.girls as Girl[]).find(g => g.id === id);
          if (!girl || girl.status !== 'mission' || girl.missionId !== mission.id) return createInitialState();
        }
      }
    }
    if (!Array.isArray(value.logs) || value.logs.length > 300) return createInitialState();
    if (!Array.isArray(value.samples) || value.samples.length > 60) return createInitialState();
    const messages = value.messages && typeof value.messages === 'object' && !Array.isArray(value.messages) ? value.messages as Record<string, unknown> : {};
    for (const [key, list] of Object.entries(messages)) {
      if (!ids.has(key)) return createInitialState();
      if (!Object.hasOwn(messages, key) || !Array.isArray(list) || list.length > 60) return createInitialState();
      for (const m of list) if (!m || typeof m !== 'object' || !['girl', 'player', 'system'].includes((m as { role: string }).role) || typeof (m as { text: unknown }).text !== 'string') return createInitialState();
    }
    const state = clone(value) as unknown as GameState;
    const previousVersion = Number(value.version);
    state.version = 20;
    // 老存档不该被开场打断：只有本版之后新建的档才可能没看过。
    state.prologueSeen = previousVersion >= 15 ? value.prologueSeen !== false : true;
    // 阵容：老存档直接沿用静态名册，编成保持“已完成”，不再逼老玩家重选。
    const savedCustom = value as Partial<GameState>;
    const rawCustomLeaders: FactionLeader[] = Array.isArray(savedCustom.customFactionLeaders) ? savedCustom.customFactionLeaders : [];
    const rawCustomGirls: FactionGirl[] = Array.isArray(savedCustom.customFactionGirls) ? savedCustom.customFactionGirls : [];
    state.customFactionLeaders = rawCustomLeaders
      .map(raw => {
        const faction = FACTION_ORDER.find(f => f === raw?.faction);
        const id = typeof raw?.id === 'string' ? raw.id : '';
        return faction && id ? sanitizeCustomLeader(raw, faction, id) : null;
      })
      .filter((leader): leader is FactionLeader => Boolean(leader));
    state.customFactionGirls = rawCustomGirls
      .map(raw => {
        const faction = FACTION_ORDER.find(f => f === raw?.faction);
        const id = typeof raw?.id === 'string' ? raw.id : '';
        return faction && id ? sanitizeCustomGirl(raw, faction, id) : null;
      })
      .filter((girl): girl is FactionGirl => Boolean(girl));
    const loadedRoster = sanitizeFactionRoster(state.factionRoster, state.customFactionLeaders, state.customFactionGirls);
    state.factionRoster = loadedRoster?.roster ?? defaultFactionRoster();
    state.customFactionLeaders = loadedRoster?.leaders ?? [];
    state.customFactionGirls = loadedRoster?.girls ?? [];
    state.startersPicked = previousVersion >= 16 ? value.startersPicked === true : true;
    const rawHostility = (state.hostility ?? {}) as Partial<Record<FactionPair, HostilityTrack>>;
    state.hostility = HOSTILITY_PAIRS.reduce((map, pair) => {
      const saved = rawHostility[pair];
      map[pair] = makeTrack(pair, typeof saved?.value === 'number' ? clampHostility(saved.value) : 0, saved?.reason ?? '旧账还没算清');
      return map;
    }, {} as Record<FactionPair, HostilityTrack>);
    state.fronts = (Array.isArray(state.fronts) ? state.fronts : [])
      .filter(front => front && typeof front.id === 'string' && Boolean(districts[front.district]) && HOSTILITY_PAIRS.includes(front.pair))
      .slice(-8);
    state.warHistory = (Array.isArray(state.warHistory) ? state.warHistory : [])
      .filter(record => record && HOSTILITY_PAIRS.includes(record.pair) && Number.isFinite(record.day))
      .slice(-40);
    state.girls = state.girls.map(girl => hydrate(girl));
    state.candidates = Array.isArray(state.candidates) ? state.candidates.map(girl => hydrate(girl)).slice(0, Math.max(6, state.poolLimits?.candidates ?? 20)) : [];
    state.whisperQueue = Array.isArray(state.whisperQueue) ? state.whisperQueue.filter(job => job && typeof job.id === 'string' && typeof job.girlId === 'string').slice(0, 12) : [];
    state.missionRuns = Array.isArray(state.missionRuns)
      ? state.missionRuns.filter(run => run && typeof run.id === 'string' && Array.isArray(run.girlIds) && Number.isFinite(run.day)).slice(0, 120)
      : [];
    // v50：城市新闻是可选字段；坏数据直接丢掉，读档后换日会重写。
    state.cityNews = sanitizeCityNews(state.cityNews, state.day);
    // v33：旧档没有这套成长设置时按自动加点读，不追溯退点。
    state.levelUpMode = state.levelUpMode === 'manual' ? 'manual' : 'auto';
    state.notices = Array.isArray(state.notices)
      ? state.notices.filter(notice => notice && typeof notice.id === 'string' && typeof notice.title === 'string').slice(0, 20)
      : [];
    for (const girl of state.girls) girl.unspentPoints = Math.max(0, Math.min(999, Number.isFinite(girl.unspentPoints) ? Number(girl.unspentPoints) : 0));
    // v89：旧档没有 generatedDay 时记成今天，否则每日提案永远不会自动补。
    state.generatedDay = normalizeGeneratedDay(state.day, state.generatedDay);
    state.whisperUnread = state.whisperUnread && typeof state.whisperUnread === 'object' ? state.whisperUnread : {};
    state.lastWhisperDay = state.lastWhisperDay && typeof state.lastWhisperDay === 'object' ? state.lastWhisperDay : {};
    state.truceUntil = state.truceUntil && typeof state.truceUntil === 'object' ? state.truceUntil : {};
    // 旧档没有窗口快照：按池子顺序补一份，别把整池都摆到界面上。
    state.marketSold = Array.isArray(state.marketSold) ? state.marketSold.filter(id => typeof id === 'string') : [];
    normalizeMarketWindow(state, true);
    if (previousVersion < 8 && (state.minutes < SHIFT_START || state.minutes >= SHIFT_END)) {
      state.minutes = SHIFT_START;
      state.logs.unshift({ id: `log-shift-migrate-${Date.now()}`, time: dateLabel(state.day, state.minutes), kind: 'story', text: '事务所改为 20:00–次日 02:00 营业，午夜之后仍算同一夜。今晚重新开门。' });
    }
    const shiftSpawn = shiftStartAt(state.day);
    state.missions.forEach(m => {
      m.attempts ??= 0; m.squad ??= m.girlId ? [m.girlId] : []; m.recommendedLevel ??= 3;
      m.district ??= districtAt(m.x, m.y);
      m.window ??= m.duration >= 90 ? 'long' : 'urgent';
      if (m.window === 'long') m.longDays = Math.max(2, Math.min(7, m.longDays ?? 2));
      m.wave ??= 0;
      m.spawnedAt ??= shiftSpawn;
      m.deadlineAt ??= deadlineFor(m.window, state.day, m.spawnedAt, m.longDays);
    });
    state.shift ??= { day: state.day, wave: previousVersion < 7 ? WAVE_AT.length : 0 };
    if (state.shift.day !== state.day) state.shift = { day: state.day, wave: 0 };
    state.territories = repairTerritories((state.territories ?? {}) as Partial<TerritoryMap>, `${state.packHash ?? createSeedPack().hash}:${previousVersion}`);
    // 污染在旧档里整段缺失：按九区初始值补齐，已有数值只做 0–100 收敛，不重置玩家清理过的辖区。
    state.pollution = repairPollution(state.pollution);
    state.office = sanitizeOfficeProfile(state.office ?? DEFAULT_OFFICE_PROFILE);
    state.territoryLog = Array.isArray(state.territoryLog) ? state.territoryLog.slice(0, 60) : [];
    state.incidents = Array.isArray(state.incidents) ? state.incidents.filter(item => item && typeof item.id === 'string' && Array.isArray(item.options)).slice(0, 8) : [];
    for (const incident of state.incidents) {
      if (incident.status === 'resolved' || incident.status === 'expired') continue;
      if (typeof incident.expiresAt !== 'number') incident.expiresAt = (state.day * 1440 + state.minutes) + (incident.ttlMinutes ?? 240);
    }
    state.storylines = Array.isArray(state.storylines) ? state.storylines.filter(item => item && typeof item.id === 'string' && Array.isArray(item.beats)).slice(0, 12) : [];
    state.events = Array.isArray(state.events) ? state.events.filter(item => item && typeof item.id === 'string' && Array.isArray(item.scenes)).slice(0, 12) : [];
    state.treatments = Array.isArray(state.treatments) ? state.treatments.filter(item => {
      if (!item || typeof item.id !== 'string' || typeof item.girlId !== 'string') return false;
      const girl = state.girls.find(g => g.id === item.girlId);
      return Boolean(girl) && Number.isFinite(item.endsAt) && item.endsAt > absoluteMinutes(state.day, state.minutes);
    }).slice(0, 6) : [];
    if (previousVersion < 10) {
      for (const girl of state.girls) {
        if (girl.status === 'healing' || girl.status === 'resting') { girl.status = 'idle'; girl.remaining = 0; }
      }
    }
    if (previousVersion < 17) migrateGuardFields(state);
    if (previousVersion < 18) migrateTierFields(state);
    // v27：市场池改由卡库补货，容量抬到 20，装得下开局那批卡；之后仍可在设置里调。
    if (previousVersion < 20) {
      state.poolLimits ??= { missions: 140, monsters: 50, candidates: 20, combatMissions: 120, investigationMissions: 20 };
      state.poolLimits.candidates = Math.max(state.poolLimits.candidates, 20);
    }
    // v38：委托池固定 12 条，做完/超时由模板补回；不再用编号副本凑数。
    state.poolLimits.missions = 12;
    state.poolLimits.combatMissions = 0;
    state.poolLimits.investigationMissions = 0;
    state.poolLimits.monsters = Math.max(50, state.poolLimits.monsters ?? 50);
    stripPoolPadding(state);
    // v26：首夜空缺补记；老档一律视为没补过，进游戏后补一次。
    state.openingFilledAt = Number.isFinite(state.openingFilledAt) ? state.openingFilledAt : 0;
    state.blank = value.blank === true;
    state.memorial ??= []; state.battles = Array.isArray(state.battles) ? state.battles.slice(0, 20) : [];
    const battleIds = new Set(state.battles.map(battle => battle.id));
    const seenNotes = new Set<string>();
    const notes: BattleNote[] = [];
    for (const note of Array.isArray(state.battleNotes) ? state.battleNotes : []) {
      if (!validBattleNote(note) || !battleIds.has(note.battleId) || seenNotes.has(note.battleId)) continue;
      seenNotes.add(note.battleId);
      notes.push(note);
    }
    state.battleNotes = notes.slice(0, 20);
    state.packHash ??= createSeedPack().hash;
    state.opinions = Array.isArray(state.opinions) ? state.opinions.filter(opinion => opinion && typeof opinion.id === 'string' && Array.isArray(opinion.options)).slice(0, 30) : [];
    for (const opinion of state.opinions) {
      opinion.options = resolveOpinionOptions(state, opinion);
      if (opinion.status === 'deferred' && typeof opinion.revisitDay !== 'number') opinion.revisitDay = state.day + 1;
    }
    state.expeditions = Array.isArray(state.expeditions) ? state.expeditions.slice(0, 1) : [];
    state.councilDay ??= state.day; state.pensionDebt ??= 0;
    state.incidentPool = Array.isArray(state.incidentPool) ? state.incidentPool.filter(item => item && typeof item.id === 'string' && Array.isArray(item.options)).slice(0, 10) : [];
    state.incidentSeq = Number.isFinite(Number(state.incidentSeq)) ? Number(state.incidentSeq) : 0;
    state.incidentCooldowns = state.incidentCooldowns && typeof state.incidentCooldowns === 'object' ? state.incidentCooldowns : {};
    // 极端旧档连 `factions` 都没有时按 50 补齐；有存档的声望一律原样保留，不重置进度。
    state.factions ??= { witch: { standing: 50, stockDay: state.day, envoyDay: state.day }, association: { standing: 50, stockDay: state.day, envoyDay: state.day }, government: { standing: 50, stockDay: state.day, envoyDay: state.day } };
    for (const faction of Object.keys(state.factions) as FactionId[]) {
      const f = state.factions[faction];
      f.standing = Math.max(0, Math.min(100, Number(f.standing) || 0));
      f.stockDay ??= state.day; f.envoyDay ??= state.day;
    }
    state.inventory = state.inventory && typeof state.inventory === 'object' ? state.inventory : {};
    state.generatedItems = Array.isArray(state.generatedItems) ? state.generatedItems.filter(validGeneratedItem).slice(0, 40) : [];
    for (const item of state.generatedItems) registerItem(item);
    const rawStock = Array.isArray(state.marketStock) ? state.marketStock : [];
    state.marketStock = rawStock.filter((entry): entry is MarketStockEntry => {
      if (!entry || typeof entry !== 'object') return false;
      const candidate = entry as MarketStockEntry;
      const item = getItem(candidate.itemId);
      return typeof candidate.id === 'string' && Boolean(item) && item!.faction === candidate.faction && typeof candidate.sold === 'boolean';
    }).slice(0, 24);
    for (const faction of Object.keys(state.factions) as FactionId[]) {
      if (!state.marketStock.some(entry => entry.faction === faction)) {
        state.marketStock = state.marketStock.concat(makeFactionStock(faction, state.day, { standing: state.factions[faction].standing, marketLevel: state.marketLevel }));
      }
    }
    state.marketStock = state.marketStock.filter((entry, index, list) => list.findIndex(other => other.id === entry.id) === index);
    state.marketLevel = Math.max(1, Math.min(4, Number(state.marketLevel) || 1));
    state.marketDay ??= state.day;
    state.boss ??= null; state.bossCycle ??= 0;
    // v96：首轮空月推迟到第 24 夜。还没开打的旧档从 16 日被顺延到这里，别让玩家点开档就被空月堵门。
    const firstCycle = !state.boss && !state.bossCycle && (state.cycleStartDay ?? state.day) <= 14;
    state.nextBossDay = firstCycle ? Math.max(Number(state.nextBossDay) || 0, FIRST_BOSS_DAY) : (Number(state.nextBossDay) || state.day + 2);
    state.customSkills ??= [];
    state.customMonsters ??= [];
    state.poolLimits ??= { missions: 140, monsters: 50, candidates: 20, combatMissions: 120, investigationMissions: 20 };
    state.poolLimits.combatMissions ??= 120;
    state.poolLimits.investigationMissions ??= 20;
    state.removedMonsters ??= [];
    state.chronicle = Array.isArray(state.chronicle)
      ? state.chronicle.filter((entry): entry is ChronicleEntry => Boolean(entry) && typeof entry.id === 'string' && typeof entry.title === 'string' && typeof entry.summary === 'string' && Number.isFinite(entry.day)).slice(0, 200)
      : [];
    return state;
  } catch { return createInitialState(); }
}

/**
 * v25 迁移：共情值从「第二条血条」变成「心防」。
 *
 * 旧存档里 `maxSpirit` / `spiritBonus` / `spiritBonusPct` 三种写法都有，
 * 统一折成「共情 × 2 + 百分比」：绝对值按 ×1.5 折算，然后一律清空。
 */

/**
 * v25 迁移：共情值从「第二条血条」变成「心防」。
 *
 * 旧存档里 `maxSpirit` / `spiritBonus` / `spiritBonusPct` 三种写法都有，
 * 统一折成「共情 × 2 + 百分比」：绝对值按 ×1.5 折算，然后一律清空。
 */
export function migrateGuardFields(state: GameState): void {
  const equipment = [...items, ...(state.generatedItems ?? [])];
  for (const item of equipment) {
    if (!item) continue;
    if (typeof item.spiritBonus === 'number' && item.spiritBonus > 0) {
      item.spiritBonusPct = Math.max(item.spiritBonusPct ?? 0, Math.round(item.spiritBonus * 1.5));
    }
    delete item.spiritBonus;
    if (item.spiritBonusPct !== undefined) item.spiritBonusPct = Math.max(0, Math.min(60, Math.round(item.spiritBonusPct)));
  }
  for (const girl of state.girls) {
    girl.maxSpirit = effectiveGuard(girl);
    // 旧值 82–100 在新口径下没有意义，读档一律视为满值。
    girl.spirit = girl.maxSpirit;
  }
}

/**
 * v24：装备补阶级、Boss 补模板与血量、污染循环补起始日。
 * 一律只补字段，不重写既有委托与既有 Boss 委托。
 */

/**
 * v24：装备补阶级、Boss 补模板与血量、污染循环补起始日。
 * 一律只补字段，不重写既有委托与既有 Boss 委托。
 */
export function migrateTierFields(state: GameState): void {
  const equipment = [...items, ...(state.generatedItems ?? [])];
  for (const item of equipment) {
    if (!item) continue;
    if (item.tier === undefined) item.tier = tierFromPrice(item.price);
  }
  // 老档没有循环起点：从今天算起，地板从 3 开始涨，而不是一进来就顶到 30。
  state.cycleStartDay = state.cycleStartDay ?? state.day;
  state.customBosses = Array.isArray(state.customBosses) ? state.customBosses : [];
  state.generatedItems = Array.isArray(state.generatedItems) ? state.generatedItems : [];
  if (state.boss) {
    state.boss.template = state.boss.template ?? 'boss-candy-throne';
    state.boss.maxHp = state.boss.maxHp ?? bossTemplateOf(state, state.boss.template)?.maxHp ?? 2400;
    state.boss.hp = state.boss.hp ?? state.boss.maxHp;
  }
  for (const mission of state.missions) {
    if (!mission.boss) continue;
    if (!mission.enemyBuffs) mission.enemyBuffs = (mission.enemyIds ?? []).map(() => null);
  }
}

/** Strict import used by the save importer: malformed files must not silently reset progress. */

/** Strict import used by the save importer: malformed files must not silently reset progress. */
export function importState(raw: string): GameState | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const value = parsed as Record<string, unknown>;
  if (![1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].includes(Number(value.version))) return null;
  if (!Array.isArray(value.girls) || (!value.girls.length && value.blank !== true)) return null;
  if (!value.girls.every(validGirl)) return null;
  if (!Number.isFinite(value.day) || !Number.isFinite(value.gold)) return null;
  return loadState(raw);
}

/**
 * v38：清掉 v32 用编号副本凑出来的委托与魔物。
 *
 * 委托：标题形如「旧钟楼的未寄信 · 糖果公园记录015」，描述里带「第 15 次现场记录」；
 * 魔物：id 形如 `pool-mon-<day>-<index>`，名字后缀「·3」、称号带「档案第 3 号」。
 * 这些不是内容，是占位。真实模板留在种子包与自制内容库里。
 */
export function stripPoolPadding(state: GameState): number {
  const before = state.missions.length;
  state.missions = state.missions.filter(mission => !/ · .+记录\d{3}$/.test(mission.title) && !/第 \d+ 次现场记录/.test(mission.description));
  state.customMonsters = (state.customMonsters ?? []).filter(monster => !/^pool-mon-\d+-\d+$/.test(monster.id));
  // 留存下来的内置未完成委托，自动刷新为最新的完整叙事简报，避免老档依然显示过去的一句话硬译。
  const templates = [...createSeedPack().missions, ...extraMissions];
  const templateMap = new Map(templates.map(m => [m.id, m]));
  for (const m of state.missions) {
    if (m.status !== 'open' && m.status !== 'active') continue;
    const baseId = m.templateId ?? m.id.split('-').pop() ?? m.id;
    const fresh = templateMap.get(baseId) ?? templateMap.get(m.id);
    if (fresh && fresh.description && fresh.description.length > m.description.length) {
      m.description = fresh.description;
    }
  }
  return before - state.missions.length;
}
