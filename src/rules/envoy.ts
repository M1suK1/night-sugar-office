/**
 * 势力代表委托（v84）：共建 / 破坏 / 借调。
 *
 * 从 missions.ts 拆出来，一是那边已经接近 450 行上限，二是这三件事本来就不是
 * 「生成一条模板委托」那么简单——它要挑辖区、挑目标势力、挑人手，还要把火气算进来。
 */
import { loadBalance } from '../balance.ts';
import { factionInfo } from '../content/items.ts';
import { districts } from '../districts.ts';
import type { DistrictId } from '../districts.ts';
import { expeditionGoldPerHour } from '../expedition.ts';
import { factionGirlsOf, factionRepresentativeOf, rosterMembers } from '../factions.ts';
import { FACTION_ORDER } from '../territories.ts';
import type { EnvoyKind, EnvoyOffer, FactionId, GameState, Mission } from '../types.ts';
import { hashText } from './core.ts';
import { annotateMission, baseCommissionPool } from './missions.ts';

/**
 * v84：代表委托的三种形态。
 *
 * 纯函数：同一天同一势力永远算出同一份，接不接由玩家决定。
 *  - coop：在该势力**自己的辖区**上完成一条模板委托，好感 +1、星砂 +10%；
 *  - raid：去**别的势力辖区**打一场魔法少女对战（对方 1–3 人），被破坏方好感 −3、星砂 +50%、
 *          两势力火气按对方辖区污染与安定加权；
 *  - loan：把已契约的少女借给该势力 1–6 小时，好感 +1、收益等同星象台同期。
 * 做不了的形态会自己退到可做的那个，不会给出接不了的单子。
 */
export function envoyOfferOf(state: GameState, faction: FactionId): EnvoyOffer {
  const balance = loadBalance();
  const seed = hashText(`envoy:${state.day}:${faction}`);
  const owned = (Object.keys(state.territories) as DistrictId[]).filter(id => state.territories[id] === faction);
  const targets = FACTION_ORDER
    .filter(other => other !== faction)
    .map(other => ({ faction: other, districts: (Object.keys(state.territories) as DistrictId[]).filter(id => state.territories[id] === other) }))
    .filter(entry => entry.districts.length > 0 && envoyRaidSquad(state, entry.faction, seed).length > 0);
  const idle = state.girls.filter(girl => !girl.dead && !girl.retired && !girl.left && girl.status === 'idle' && !girl.loan);

  const kinds: EnvoyKind[] = [];
  if (owned.length) kinds.push('coop');
  if (targets.length) kinds.push('raid');
  if (idle.length) kinds.push('loan');
  if (!kinds.length) kinds.push('coop');

  const weights: Record<EnvoyKind, number> = {
    coop: Math.max(1, balance.envoyCoopWeight),
    raid: Math.max(1, balance.envoyRaidWeight),
    loan: Math.max(1, balance.envoyLoanWeight),
  };
  const total = kinds.reduce((sum, kind) => sum + weights[kind], 0);
  let roll = seed % total;
  let kind: EnvoyKind = kinds[kinds.length - 1]!;
  for (const candidate of kinds) {
    roll -= weights[candidate];
    if (roll < 0) { kind = candidate; break; }
  }

  if (kind === 'coop') {
    const district = owned.length ? owned[seed % owned.length] : undefined;
    const template = baseCommissionPool[seed % baseCommissionPool.length]!;
    const mission = envoyMission(state, template, faction, 'coop', district, Math.round(template.reward * (1 + balance.envoyCoopRewardPct / 100)));
    return {
      kind: 'coop', faction, mission,
      note: `在${districts[mission.district ?? district ?? 'candy'].name}完成这单，好感 +${balance.envoyCoopStandingGain}，报酬高 ${balance.envoyCoopRewardPct}%。`,
    };
  }

  if (kind === 'raid') {
    const pickTarget = targets[seed % targets.length]!;
    const district = pickTarget.districts[seed % pickTarget.districts.length]!;
    const squad = envoyRaidSquad(state, pickTarget.faction, seed);
    const template = baseCommissionPool[(seed + 7) % baseCommissionPool.length]!;
    const hostility = envoyRaidHostility(state, district);
    const mission = envoyMission(state, template, faction, 'raid', district, Math.round(template.reward * (1 + balance.envoyRaidRewardPct / 100)), {
      target: pickTarget.faction, squad, hostility,
    });
    return {
      kind: 'raid', faction, mission, target: pickTarget.faction, hostility,
      note: `去${districts[district].name}打${factionInfo[pickTarget.faction].short}的人（${squad.length} 人）：对方好感 -${balance.envoyRaidTargetStandingLoss}，两方火气 +${hostility}，报酬高 ${balance.envoyRaidRewardPct}%。`,
    };
  }

  const rate = expeditionGoldPerHour(state);
  const hours = 1 + (seed % Math.max(1, Math.round(balance.envoyLoanMaxHours)));
  return {
    kind: 'loan', faction, hours, rate,
    note: `借调一名少女 ${hours} 小时：按星象台同期每小时 ${rate} 星砂结算（共 ${rate * hours}），好感 +${balance.envoyLoanStandingGain}、不加疲劳。`,
  };
}

/** 破坏行动能叫来的对方人手：最高级的那个 + 按种子挑的 1–2 个。 */
function envoyRaidSquad(state: GameState, target: FactionId, seed: number): string[] {
  const roster = rosterMembers(state, target).length ? rosterMembers(state, target) : factionGirlsOf(target);
  if (!roster.length) return [];
  const sorted = [...roster].sort((a, b) => b.level - a.level);
  const size = 1 + (seed % 3);
  const rest = sorted.slice(1);
  const picked = rest
    .map((girl, index) => ({ girl, key: hashText(`${seed}:${girl.id}:${index}`) }))
    .sort((a, b) => a.key - b.key)
    .slice(0, Math.max(0, size - 1))
    .map(entry => entry.girl.id);
  return [sorted[0]!.id, ...picked];
}

/** 破坏行动的火气：基础值 + 污染档位，再按该辖区所在的安定度放大，夹在 4–20。 */
export function envoyRaidHostility(state: GameState, district: DistrictId): number {
  const balance = loadBalance();
  const pollution = state.pollution?.[district] ?? 0;
  const tier = Math.min(3, Math.floor(pollution / 25));
  const stable = Math.max(0, Math.min(100, state.reputation));
  const raw = (balance.envoyRaidHostility + tier * 2) * (1 + (60 - stable) / 60);
  return Math.max(4, Math.min(20, Math.round(raw)));
}

/** 按形态拼一条委托：共建/破坏共用模板，区别在报酬、目标辖区与对面是谁的人。 */
function envoyMission(
  state: GameState,
  template: Mission,
  faction: FactionId,
  kind: 'coop' | 'raid',
  district: DistrictId | undefined,
  reward: number,
  extra: { target?: FactionId; squad?: string[]; hostility?: number } = {},
): Mission {
  const representative = factionRepresentativeOf(state, faction);
  const label = kind === 'coop' ? '共建委托' : '破坏行动';
  return annotateMission(state, {
    ...template,
    id: `envoy-${kind}-${faction}-${state.day}`,
    title: kind === 'coop' ? template.title : `破坏·${template.title}`,
    category: `${factionInfo[faction].short} · ${label}`,
    description: kind === 'coop'
      ? `${representative.name}把一份盖了章的委托推过来：「这一片是我们的地，别让人今晚出事。」`
      : `${representative.name}没抬头：「${extra.target ? factionInfo[extra.target].short : '对面'}的人今晚在那边很碍事。去让他们记住这一夜。」`,
    district,
    reward,
    status: 'open', squad: [], attempts: 0,
    work: 'combat',
    envoy: true,
    envoyKind: kind,
    envoyFaction: faction,
    envoyTarget: extra.target,
    envoyHostility: extra.hostility,
    interception: kind === 'raid' && extra.target && extra.squad?.length
      ? { faction: extra.target, girlIds: extra.squad }
      : undefined,
  });
}

