import { ROUND_MINUTES } from '../combat.ts';
import { bosses } from '../content/bosses.ts';
import { createSeedPack } from '../content/seed-pack.ts';
import { applyPct, districtAt, districts } from '../districts.ts';
import { defaultFactionRoster } from '../factions.ts';
import { initialHostility } from '../hostility.ts';
import { DEFAULT_OFFICE_PROFILE, sanitizeOfficeProfile } from '../office.ts';
import { initialPollution } from '../pollution.ts';
import type { CommissionWindow } from '../shift.ts';
import { SHIFT_START, deadlineFor, shiftStartAt } from '../shift.ts';
import { assignTerritories } from '../territories.ts';
import type { ContentPack, GameState, Log } from '../types.ts';
import { hydrate, sampleDays } from './candidate.ts';
import { clone } from './core.ts';
import { makeMarketStock } from './market.ts';
import { ensureMissionPools, ensureMonsterPool } from './pools.ts';
import { syncShift } from './time.ts';
// v35 从 src/game.ts 拆出：开局状态构造。

export function createInitialState(pack: ContentPack = createSeedPack(), seed = pack.hash): GameState {
  const all = pack.girls.map(girl => hydrate(girl));
  const hired = all.filter(g => g.id !== 'lu');
  const candidates = all.filter(g => g.id === 'lu');
  if (candidates[0]) candidates[0] = { ...candidates[0], level: 6, cost: 3200, status: 'idle' };
  const rooms = [
    { id: 'lounge', name: '会客厅', type: 'lounge' as const, level: 2, capacity: 0, description: '铺着旧地毯的会客厅，窗外正对樱雾市的河。' },
    { id: 'clinic', name: '月光诊所', type: 'clinic' as const, level: 1, capacity: 0, description: '栀子管理的诊所，空气里有晒干的花和酒精味。' },
    { id: 'dorm', name: '晚安宿舍', type: 'dorm' as const, level: 3, capacity: 6, description: '每个床位都有一盏可以调到最暗的小灯。' },
    { id: 'observatory', name: '星象台', type: 'observatory' as const, level: 1, capacity: 0, description: '零青常常在这里收听城市上空的杂音。' },
  ];
  const spawnAt = shiftStartAt(14);
  const missions = clone(pack.missions).map((m, index) => {
    const district = m.district ?? districtAt(m.x, m.y);
    const region = districts[district];
    const window: CommissionWindow = index % 2 === 0 ? 'long' : 'urgent';
    const longDays = window === 'long' ? 3 : undefined;
    return {
      ...m, squad: m.squad ?? [], attempts: m.attempts ?? 0, recommendedLevel: m.recommendedLevel ?? 3,
      rounds: m.rounds ?? Math.max(2, Math.floor(m.duration / ROUND_MINUTES)),
      district, window, longDays, wave: 0, spawnedAt: spawnAt,
      deadlineAt: deadlineFor(window, 14, spawnAt, longDays),
      target: applyPct(m.target, region.effect.targetPct), reward: applyPct(m.reward, region.effect.rewardPct),
    };
  });
  const logs: Log[] = [
    { id: 'l-1', time: '第 14 日 · 20:05', kind: 'story', text: '樱雾市进入夜间结界维护时段，事务所开始第十三夜的值班。' },
    { id: 'l-2', time: '第 14 日 · 20:20', kind: 'base', text: '晚安宿舍完成本月第三次床品更换，砂糖在每张床上放了一颗糖。' },
    { id: 'l-3', time: '第 14 日 · 20:40', kind: 'finance', text: '收到上月委托尾款，星砂储备补充。', delta: 480 },
  ];
  const state: GameState = {
    version: 20, day: 14, minutes: SHIFT_START, gold: 12840, reputation: 76,
    prologueSeen: false,
    openingFilledAt: 0,
    levelUpMode: 'manual',
    notices: [],
    factionRoster: defaultFactionRoster(),
    customFactionLeaders: [],
    customFactionGirls: [],
    startersPicked: false,
    girls: hired, candidates, missions, rooms, logs, samples: sampleDays(), completed: [],
    messages: {}, memorial: [], battles: [], battleNotes: [], packHash: pack.hash,
    opinions: [], expeditions: [], councilDay: 14, pensionDebt: 0,
    factions: { witch: { standing: 50, stockDay: 14, envoyDay: 14 }, association: { standing: 50, stockDay: 14, envoyDay: 14 }, government: { standing: 50, stockDay: 14, envoyDay: 14 } },
    inventory: {}, marketStock: makeMarketStock(14, { marketLevel: 1, standing: 50 }), marketLevel: 1, marketDay: 14, marketWindow: [], marketSold: [], whisperQueue: [], whisperUnread: {}, lastWhisperDay: {}, truceUntil: {}, boss: null, bossCycle: 0, nextBossDay: Math.max(bosses[0].firstDay, 14 + 2), cycleStartDay: 14, customSkills: [], customMonsters: [], customBosses: [], generatedItems: [], chronicle: [],
    poolLimits: { missions: 12, monsters: 50, candidates: 20, combatMissions: 0, investigationMissions: 0 }, removedMonsters: [],
    shift: { day: 14, wave: 0 },
    territories: assignTerritories(seed), territoryLog: [], incidents: [], incidentPool: [], incidentSeq: 0, incidentCooldowns: {}, storylines: [], events: [], treatments: [],
    pollution: initialPollution(), hostility: initialHostility(), fronts: [], warHistory: [], office: sanitizeOfficeProfile(DEFAULT_OFFICE_PROFILE),
  };
  syncShift(state);
  ensureMissionPools(state);
  ensureMonsterPool(state);
  return state;
}

/** 全空档案：只有启动资金、一间会客厅和城里的九片辖区。 */

/** 全空档案：只有启动资金、一间会客厅和城里的九片辖区。 */
export function createBlankState(pack: ContentPack = createSeedPack(), seed = `${pack.hash}:${Math.random()}`): GameState {
  const state: GameState = {
    version: 20, day: 14, minutes: SHIFT_START, gold: 6000, reputation: 0, blank: true,
    prologueSeen: false,
    openingFilledAt: 0,
    levelUpMode: 'manual',
    notices: [],
    factionRoster: defaultFactionRoster(),
    customFactionLeaders: [],
    customFactionGirls: [],
    startersPicked: false,
    girls: [], candidates: [], missions: [], completed: [],
    rooms: [{ id: 'lounge', name: '会客厅', type: 'lounge', level: 1, capacity: 0, description: '刚租下的会客厅，只有一张桌子、一盏灯和一把多余的椅子。' }],
    logs: [
      { id: 'l-1', time: '第 14 日 · 20:00', kind: 'story', text: '钥匙插进锁孔的时候，门牌还是空的。第十三夜，樱雾市多了一间没有名字的事务所。' },
      { id: 'l-2', time: '第 14 日 · 20:01', kind: 'base', text: '账上只有 6000 星砂，没有契约者，也没有委托。今晚先从认识这座城开始。' },
    ],
    samples: sampleDays(), messages: {}, memorial: [], battles: [], battleNotes: [], packHash: pack.hash,
    opinions: [], expeditions: [], councilDay: 14, pensionDebt: 0,
    factions: { witch: { standing: 50, stockDay: 14, envoyDay: 14 }, association: { standing: 50, stockDay: 14, envoyDay: 14 }, government: { standing: 50, stockDay: 14, envoyDay: 14 } },
    inventory: {}, marketStock: makeMarketStock(14, { marketLevel: 1, standing: 50 }), marketLevel: 1, marketDay: 14, marketWindow: [], marketSold: [], whisperQueue: [], whisperUnread: {}, lastWhisperDay: {}, truceUntil: {}, boss: null, bossCycle: 0, nextBossDay: Math.max(bosses[0].firstDay, 14 + 2), cycleStartDay: 14, customSkills: [], customMonsters: [], customBosses: [], generatedItems: [], chronicle: [],
    poolLimits: { missions: 12, monsters: 50, candidates: 20, combatMissions: 0, investigationMissions: 0 }, removedMonsters: [],
    shift: { day: 14, wave: 0 },
    territories: assignTerritories(seed), territoryLog: [], incidents: [], incidentPool: [], incidentSeq: 0, incidentCooldowns: {}, storylines: [], events: [], treatments: [],
    pollution: initialPollution(), hostility: initialHostility(), fronts: [], warHistory: [], office: sanitizeOfficeProfile(DEFAULT_OFFICE_PROFILE),
  };
  syncShift(state);
  ensureMissionPools(state);
  ensureMonsterPool(state);
  return state;
}

export function createInitialFromPack(pack: ContentPack): GameState {
  return createInitialState(pack);
}
