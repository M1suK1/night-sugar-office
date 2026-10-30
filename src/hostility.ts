import type { FactionId, FactionPair, GameState, HostilityTier, HostilityTrack, Incident } from './types.ts';
import { factionName } from './territories.ts';
import { dirtiestDistrict, cityAveragePollution } from './pollution.ts';
import { territoryOwner } from './territories.ts';

/**
 * 三方之间两两一条敌意值。
 *
 * 敌人之间的火气不是掷骰子决定的：所有增减都写在这张表里，玩家看得见、也追得回。
 * 满 100 就一定会打起来（见 `src/fronts.ts` 的 `planFronts`）。
 */
export const HOSTILITY_PAIRS: FactionPair[] = ['association-government', 'association-witch', 'government-witch'];

export const HOSTILITY_TIERS: HostilityTier[] = ['calm', 'friction', 'standoff', 'brink'];

export const HOSTILITY_TIER_LABEL: Record<HostilityTier, string> = {
  calm: '平静',
  friction: '摩擦',
  standoff: '对峙',
  brink: '临战',
};

export const HOSTILITY_CALM_CEILING = 39;
export const HOSTILITY_FRICTION_CEILING = 69;
export const HOSTILITY_STANDOFF_CEILING = 89;
export const HOSTILITY_BRINK_CEILING = 99;
/** 开战后回落的水平：敌人之间的账不会因为打了一场就清掉。 */
export const HOSTILITY_AFTER_WAR = 25;
/** 同一对势力在这么多天内不会再打第二场。 */
export const HOSTILITY_WAR_COOLDOWN = 10;
/** 冷却期内又烧到满时的封顶值。 */
export const HOSTILITY_COOLDOWN_CAP = 95;

export function clampHostility(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** 由数值推导档位；档位不单独存，避免两份真相打架。 */
export function hostilityTier(value: number): HostilityTier {
  if (value > HOSTILITY_BRINK_CEILING) return 'brink';
  if (value > HOSTILITY_STANDOFF_CEILING) return 'brink';
  if (value > HOSTILITY_FRICTION_CEILING) return 'standoff';
  if (value > HOSTILITY_CALM_CEILING) return 'friction';
  return 'calm';
}

export function hostilityTierLabel(value: number): string {
  return HOSTILITY_TIER_LABEL[hostilityTier(value)];
}

export function pairMembers(pair: FactionPair): [FactionId, FactionId] {
  if (pair === 'association-government') return ['association', 'government'];
  if (pair === 'association-witch') return ['association', 'witch'];
  return ['government', 'witch'];
}

export function pairOf(a: FactionId, b: FactionId): FactionPair | undefined {
  if (a === b) return undefined;
  const [x, y] = pairMembers('association-government');
  void x; void y;
  const key = [a, b].sort().join('-');
  const found = HOSTILITY_PAIRS.find(pair => pairMembers(pair).slice().sort().join('-') === key);
  return found;
}

export function pairLabel(pair: FactionPair): string {
  const [a, b] = pairMembers(pair);
  return `${factionName[a]} 与 ${factionName[b]}`;
}

export function makeTrack(pair: FactionPair, value = 0, reason = '旧账还没算清'): HostilityTrack {
  return { pair, value: clampHostility(value), updatedDay: 1, reason };
}

export function emptyHostility(): Record<FactionPair, HostilityTrack> {
  return HOSTILITY_PAIRS.reduce((map, pair) => {
    map[pair] = makeTrack(pair, 0);
    return map;
  }, {} as Record<FactionPair, HostilityTrack>);
}

/** 三方初始就带着一点旧账，不至于从 0 开始显得假。 */
export function initialHostility(): Record<FactionPair, HostilityTrack> {
  const seed: Record<FactionPair, [number, string]> = {
    'association-government': [28, '灯油配额谈了三次，一次都没谈拢'],
    'association-witch': [36, '协会烧了她们一本名录'],
    'government-witch': [32, '市役所的编号名单上还留着没销的案子'],
  };
  return HOSTILITY_PAIRS.reduce((map, pair) => {
    const [value, reason] = seed[pair];
    map[pair] = makeTrack(pair, value, reason);
    return map;
  }, {} as Record<FactionPair, HostilityTrack>);
}

export function trackOf(state: Pick<GameState, 'hostility'>, pair: FactionPair): HostilityTrack {
  return state.hostility?.[pair] ?? makeTrack(pair, 0);
}

export function hostilityValue(state: Pick<GameState, 'hostility'>, pair: FactionPair): number {
  return trackOf(state, pair).value;
}

export function hostilityTierOf(state: Pick<GameState, 'hostility'>, pair: FactionPair): HostilityTier {
  return hostilityTier(hostilityValue(state, pair));
}

/** 该势力与另外两方的两条曲线，供势力档案与任务面板取用。 */
export function hostilityOf(state: Pick<GameState, 'hostility'>, faction: FactionId): { pair: FactionPair; other: FactionId; track: HostilityTrack }[] {
  return HOSTILITY_PAIRS
    .filter(pair => pairMembers(pair).includes(faction))
    .map(pair => {
      const [a, b] = pairMembers(pair);
      return { pair, other: a === faction ? b : a, track: trackOf(state, pair) };
    })
    .sort((left, right) => right.track.value - left.track.value);
}

/** 火气最大的那一对；没事的时候是平静，返回 undefined。 */
export function hottestPair(state: Pick<GameState, 'hostility'>): { pair: FactionPair; track: HostilityTrack } | undefined {
  let best: { pair: FactionPair; track: HostilityTrack } | undefined;
  for (const pair of HOSTILITY_PAIRS) {
    const track = trackOf(state, pair);
    if (track.value <= HOSTILITY_CALM_CEILING) continue;
    if (!best || track.value > best.track.value) best = { pair, track };
  }
  return best;
}

export interface HostilityChange {
  pair: FactionPair;
  delta: number;
  reason: string;
}

/**
 * 每夜自然积累：城市自己在磨。到了对峙之后磨得更快。
 *
 * 只算自然项；弹窗、委托、易主、拦截战这些都由对应动作自己调 `applyHostility`。
 */
export function hostilityGain(state: GameState): HostilityChange[] {
  const changes: HostilityChange[] = [];
  for (const pair of HOSTILITY_PAIRS) {
    const track = trackOf(state, pair);
    const tier = hostilityTier(track.value);
    if (tier === 'brink') continue;
    const delta = tier === 'calm' ? 1 : tier === 'friction' ? 1 : 2;
    changes.push({ pair, delta, reason: '城市自己的火气，一夜一点' });
  }
  return changes;
}

/** 把一次或多次变动落进状态：夹值、记日子、记原因，并在日志里留一句话。 */
export function applyHostility(state: GameState, changes: HostilityChange[]): void {
  for (const change of changes) {
    if (!change.delta) continue;
    const track = trackOf(state, change.pair);
    const next = clampHostility(track.value + change.delta);
    if (next === track.value) continue;
    state.hostility = state.hostility ?? emptyHostility();
    state.hostility[change.pair] = { ...track, value: next, updatedDay: state.day, reason: change.reason };
    const sign = next > track.value ? '升高' : '下降';
    state.logs.unshift({
      id: `log-hostility-${change.pair}-${state.day}-${next}-${state.logs.length}`,
      time: '',
      kind: 'territory',
      text: `${pairLabel(change.pair)}的火气${sign}到 ${next}/100：${change.reason}。`,
    });
  }
}

/** 弹窗选项推的敌意：模型生成的一律夹在 ±3，内置模板最多 ±9。 */
export function incidentHostility(pair: FactionPair, delta: number, capped = false): HostilityChange {
  const limit = capped ? 3 : 9;
  return { pair, delta: Math.max(-limit, Math.min(limit, Math.round(delta))), reason: '一张摆在桌上的事' };
}

/** 触发开战的那一对是不是还在冷却里。 */
export function warCoolingDown(state: Pick<GameState, 'warHistory' | 'day'>, pair: FactionPair): boolean {
  const last = (state.warHistory ?? []).filter(record => record.pair === pair).map(record => record.day);
  if (!last.length) return false;
  return state.day - Math.max(...last) < HOSTILITY_WAR_COOLDOWN;
}

// —— 文案 ——

export function hostilityFlavor(state: GameState, pair: FactionPair): string {
  const [a, b] = pairMembers(pair);
  const value = hostilityValue(state, pair);
  const tier = hostilityTier(value);
  const owner = territoryOwner(state, dirtiestDistrict(state).id);
  void cityAveragePollution;
  const dirtyLine = owner === a || owner === b ? `脏得最厉害的那片现在归${factionName[owner]}，另一头一直在看着。` : '';
  if (tier === 'calm') return `两边都还端着，街上暂时看不到他们的人撞在一起。`;
  if (tier === 'friction') return `巡夜的人开始互相记名字了。${dirtyLine}`;
  if (tier === 'standoff') return `两条街各站一排人，谁也不先走。${dirtyLine}`;
  return `只差一句话，两边就会动手。${dirtyLine}`;
}

export function hostilityLines(state: GameState): { pair: FactionPair; label: string; value: number; tier: HostilityTier; reason: string }[] {
  return HOSTILITY_PAIRS.map(pair => {
    const track = trackOf(state, pair);
    return { pair, label: pairLabel(pair), value: track.value, tier: hostilityTier(track.value), reason: track.reason };
  }).sort((left, right) => right.value - left.value);
}

// —— 与弹窗/委托的接口 ——

/** 预兆弹窗用的模板 id：friction 看到街面小摩擦，standoff 起升级。 */
export function warSignalTemplateId(state: GameState, pair: FactionPair): string {
  const tier = hostilityTierOf(state, pair);
  if (tier === 'brink' || tier === 'standoff') return 'war-signal-patrol';
  return 'war-signal-street';
}

/** 挑一对今晚还在低谷的势力，给弹窗一个不重复的起手。 */
export function quietestPair(state: Pick<GameState, 'hostility'>): FactionPair {
  return HOSTILITY_PAIRS.slice().sort((left, right) => hostilityValue(state, left) - hostilityValue(state, right))[0];
}

export function hostilityNote(incident: Incident): string {
  if (!incident.options?.length) return '';
  return '两边的人都在等一个态度。';
}
