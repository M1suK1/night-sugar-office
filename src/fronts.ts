import type { FactionFront, FactionId, FactionPair, GameState } from './types.ts';
import type { DistrictId } from './districts.ts';
import { factionGirlsOf } from './factions.ts';
import { factionName, ownedDistricts, territoryOwner } from './territories.ts';
import { districts } from './districts.ts';
const pollutionAt = (state: Pick<GameState, 'pollution'>, district: DistrictId): number => state.pollution?.[district] ?? 0;
import {
  HOSTILITY_AFTER_WAR, HOSTILITY_COOLDOWN_CAP,
  clampHostility, pairLabel, pairMembers, trackOf, warCoolingDown,
} from './hostility.ts';

/**
 * 战线：敌意满 100 之后，两个势力在某个辖区真的打起来。
 *
 * 这里不掷骰子、不调模型：生成条件只有一条——某一对敌意 `>= 100`
 * 且这一对没有未结束的战线、也不在冷却期。
 */

/** 进攻方 = 这一对里态度更低的一方。 */
export function attackerOf(state: Pick<GameState, 'factions'>, pair: FactionPair): FactionId {
  const [a, b] = pairMembers(pair);
  return state.factions[a].standing <= state.factions[b].standing ? a : b;
}

/** 势力在这一带能压上多少力量：声望、污染、麾下少女都算。 */
export function frontPower(state: GameState, faction: FactionId, district: DistrictId): number {
  const girls = factionGirlsOf(faction).length;
  const raw = 30 + state.factions[faction].standing * 0.3 + pollutionAt(state, district) / 2 + girls * 6;
  return Math.max(10, Math.min(95, Math.round(raw)));
}

/** 防守方名下污染最高的辖区：脏的地方值得抢，也最容易出事。 */
export function frontDistrict(state: GameState, defender: FactionId): DistrictId {
  const owned = ownedDistricts(state.territories, defender);
  const pool = owned.length ? owned : (Object.keys(districts) as DistrictId[]);
  return pool.slice().sort((left, right) => pollutionAt(state, right) - pollutionAt(state, left))[0];
}

export function openFrontIn(state: Pick<GameState, 'fronts'>, district: DistrictId): FactionFront | undefined {
  return (state.fronts ?? []).find(front => front.district === district && (front.status === 'open' || front.status === 'joined'));
}

export function openFrontOfPair(state: Pick<GameState, 'fronts'>, pair: FactionPair): FactionFront | undefined {
  return (state.fronts ?? []).find(front => front.pair === pair && (front.status === 'open' || front.status === 'joined'));
}

/** 记一条战线日志与战史。 */
function recordWar(state: GameState, front: FactionFront, note: string): void {
  state.warHistory = [...(state.warHistory ?? []), { pair: front.pair, day: front.day }];
  state.logs.unshift({
    id: `log-war-${front.id}`,
    time: '',
    kind: 'territory',
    text: note,
  });
}

/**
 * 当日开门时检查三条曲线：满 100 就生成战线，并把这一对压回 25。
 *
 * 冷却期内又烧满的，夹在 95 并记一句「双方都在等一个借口」。
 */
export function planFronts(state: GameState, at: { day: number; minutes: number }): FactionFront[] {
  const created: FactionFront[] = [];
  state.fronts = state.fronts ?? [];
  state.warHistory = state.warHistory ?? [];
  for (const pair of ['association-government', 'association-witch', 'government-witch'] as FactionPair[]) {
    const track = trackOf(state, pair);
    if (track.value < 100) continue;
    if (openFrontOfPair(state, pair)) continue;
    if (warCoolingDown({ warHistory: state.warHistory, day: at.day }, pair)) {
      state.hostility[pair] = { ...track, value: HOSTILITY_COOLDOWN_CAP, reason: '双方都在等一个借口' };
      state.logs.unshift({ id: `log-war-cooldown-${pair}-${at.day}`, time: '', kind: 'territory', text: `${pairLabel(pair)}又烧到了临战线，但两边都还记得上一场。` });
      continue;
    }
    const attacker = attackerOf(state, pair);
    const defender = pairMembers(pair).find(id => id !== attacker) ?? pairMembers(pair)[1];
    const district = frontDistrict(state, defender);
    const startsAt = at.day * 1440 + 20 * 60 + 60;
    const front: FactionFront = {
      id: `front-${at.day}-${district}`,
      pair,
      day: at.day,
      district,
      attacker,
      defender,
      startsAt,
      endsAt: startsAt + 240,
      attackerPower: frontPower(state, attacker, district),
      defenderPower: frontPower(state, defender, district),
      status: 'open',
      reason: track.reason,
    };
    state.fronts.push(front);
    state.hostility[pair] = { ...track, value: HOSTILITY_AFTER_WAR, updatedDay: at.day, reason: '打起来了，账先记着' };
    recordWar(state, front, `${pairLabel(pair)}在${districts[district].name}动上了手：${factionName[attacker]}压过去，${factionName[defender]}守着。`);
    created.push(front);
  }
  return created;
}

/** 没人管就直接结算：按双方力量与一点运气比大小。 */
export function autoResolveFront(state: GameState, front: FactionFront, at: { day: number; minutes: number }): 'attackerWin' | 'defenderWin' | 'stalemate' {
  const total = front.attackerPower + front.defenderPower;
  const swing = (state.day * 37 + front.district.length * 11) % 30;
  const attackerScore = front.attackerPower * 1.1 + swing;
  const defenderScore = front.defenderPower * 1.1 + (total - swing);
  const result: 'attackerWin' | 'defenderWin' | 'stalemate' = Math.abs(attackerScore - defenderScore) < 6
    ? 'stalemate'
    : attackerScore > defenderScore ? 'attackerWin' : 'defenderWin';
  settleFront(state, front, result, undefined, at);
  return result;
}

/** 玩家派过去的人能给这一边加多少分。 */
export function squadPower(state: GameState, front: FactionFront): number {
  return (front.squad ?? [])
    .map(id => state.girls.find(girl => girl.id === id))
    .filter((girl): girl is GameState['girls'][number] => Boolean(girl && !girl.dead))
    .reduce((sum, girl) => sum + Math.round((girl.stats.magic + girl.stats.agility) / 2) + girl.level * 2, 0);
}

/** 战线收场后把人放回去，顺带记一笔疲劳。 */
function releaseSquad(state: GameState, front: FactionFront): void {
  for (const id of front.squad ?? []) {
    const girl = state.girls.find(item => item.id === id);
    if (!girl || girl.dead) continue;
    girl.fatigue = Math.min(100, girl.fatigue + 12);
    girl.remaining = 0;
    if (girl.status !== 'resting') girl.status = 'idle';
  }
}

/** 到点还没人处理就自己打完；我们参了战就按参战算。 */
export function resolveDueFronts(state: GameState, at: { day: number; minutes: number }): FactionFront[] {
  const now = at.day * 1440 + at.minutes;
  const due = (state.fronts ?? []).filter(front => (front.status === 'open' || front.status === 'joined') && now >= front.endsAt);
  for (const front of due) {
    if (!front.side) { autoResolveFront(state, front, at); continue; }
    const swing = (state.day * 37 + front.district.length * 11) % 30;
    const attackerScore = front.attackerPower * 0.9 + (front.side === 'attacker' ? squadPower(state, front) : 0) + swing;
    const defenderScore = front.defenderPower * 0.9 + (front.side === 'defender' ? squadPower(state, front) : 0) + (10 - swing);
    const result: 'attackerWin' | 'defenderWin' | 'stalemate' = Math.abs(attackerScore - defenderScore) < 6
      ? 'stalemate'
      : attackerScore > defenderScore ? 'attackerWin' : 'defenderWin';
    settleFront(state, front, result, front.side, at);
    releaseSquad(state, front);
  }
  return due;
}

/**
 * 结算一场战线：赢家拿走辖区，参与方各记一笔声望，玩家选过边就更明显。
 *
 * `side` 只在玩家参战时传入；观战走 `autoResolveFront`。
 */
export function settleFront(
  state: GameState,
  front: FactionFront,
  result: 'attackerWin' | 'defenderWin' | 'stalemate',
  side: 'attacker' | 'defender' | undefined,
  at: { day: number; minutes: number },
): string {
  front.result = result;
  front.status = 'resolved';
  const winner = result === 'attackerWin' ? front.attacker : result === 'defenderWin' ? front.defender : undefined;
  const loser = result === 'attackerWin' ? front.defender : result === 'defenderWin' ? front.attacker : undefined;
  const district = districts[front.district].name;
  if (winner && territoryOwner(state, front.district) !== winner) {
    state.territories[front.district] = winner;
    state.territoryLog.unshift({ day: at.day, minutes: at.minutes, district: front.district, from: loser ?? front.defender, to: winner });
  }
  const bump = (faction: FactionId, delta: number) => {
    state.factions[faction].standing = clampHostility(state.factions[faction].standing + delta);
  };
  if (winner) {
    bump(winner, result === 'stalemate' ? 0 : 4);
    if (loser) bump(loser, -3);
  }
  if (side) {
    const backed = side === 'attacker' ? front.attacker : front.defender;
    const backWon = winner === backed;
    const other = side === 'attacker' ? front.defender : front.attacker;
    state.reputation = Math.max(0, Math.min(100, state.reputation + (backWon ? 6 : -4)));
    bump(backed, backWon ? 6 : -2);
    bump(other, backWon ? -4 : 2);
    state.logs.unshift({
      id: `log-front-${front.id}`,
      time: '',
      kind: 'battle',
      text: `战线结束：${district}。我们站在${factionName[backed]}这边，${backWon ? '赢了' : '没能翻过来'}（声望 ${backWon ? '+6' : '-4'}）。`,
    });
  } else {
    state.logs.unshift({
      id: `log-front-${front.id}`,
      time: '',
      kind: 'territory',
      text: `战线结束：${district}${winner ? `，${factionName[winner]}把对方压了回去` : '，两边谁也没占到便宜'}。`,
    });
  }
  // 战后那条街更脏，双方的火气都还在。
  state.pollution = { ...state.pollution, [front.district]: Math.min(100, pollutionAt(state, front.district) + 4) };
  state.chronicle.unshift({
    id: `chr-front-${front.id}`,
    day: at.day,
    at: '',
    kind: '辖区',
    title: `《${district}的夜战》`,
    summary: `${pairLabel(front.pair)}在${district}动了手。${winner ? `${factionName[winner]}把对方压了回去。` : '两边谁也没赢。'}${side ? `我们在旁边帮了${factionName[side === 'attacker' ? front.attacker : front.defender]}。` : '我们在门后看着。'}起因是：${front.reason ?? trackOf(state, front.pair).reason}。`,
  });
  state.chronicle = state.chronicle.slice(0, 200);
  return `${pairLabel(front.pair)}在${district}动了手。${winner ? `${factionName[winner]}赢了。` : '两边都没赢。'}${side ? `我们站在${factionName[side === 'attacker' ? front.attacker : front.defender]}这边。` : '我们在门后看着。'}原因是：${trackOf(state, front.pair).reason}。`;
}

export function frontLabel(front: FactionFront): string {
  return `${factionName[front.attacker]} 对 ${factionName[front.defender]} · ${districts[front.district].name}`;
}

export function frontRemaining(front: FactionFront, at: { day: number; minutes: number }): number {
  return Math.max(0, front.endsAt - (at.day * 1440 + at.minutes));
}

/** 玩家能派的人：在岗、没死、还有体力。 */
export function frontCandidates(state: GameState): GameState['girls'] {
  return state.girls.filter(girl => !girl.dead && !girl.retired && girl.hp > 0 && girl.status !== 'mission' && girl.status !== 'expedition');
}
