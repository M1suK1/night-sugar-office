/**
 * 代表委托的预览（v167）。
 *
 * 会客厅的卡片原来只摊开一行摘要，玩家看不出「这条街现在多脏、会不会被当主拦下、
 * 办砸了赔多少」。这里把判断所需的四段信息算成一个结构，交给预览弹窗渲染；
 * 代价那一行直接调 `missionPenalty`，**与结算同源**，不会预览一套、结算另一套。
 */
import { loadBalance } from '../balance.ts';
import { factionInfo } from '../content/items.ts';
import { districtOrder, districts } from '../districts.ts';
import type { DistrictId } from '../districts.ts';
import { factionAttitude } from '../economy.ts';
import { canIntercept, factionRepresentativeOf } from '../factions.ts';
import { failurePenaltyFor, failurePenaltyText } from '../missionPenalty.ts';
import { pollutionForecast, pollutionTierLabel } from '../pollution.ts';
import type { EnvoyKind, FactionId, GameState, StatKey } from '../types.ts';
import { envoyOfferOf } from './envoy.ts';

const STAT_LABEL: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };

export interface EnvoyPreview {
  faction: FactionId;
  factionName: string;
  kind: EnvoyKind;
  representative: { id: string; name: string; title: string };
  /** 席位空缺：这一方还没有派人来。 */
  vacant: boolean;
  vacantNote: string;
  /** 今天已经接过这一方的委托。 */
  done: boolean;
  mission?: {
    title: string;
    workLabel: string;
    difficulty: string;
    duration: number;
    districtName: string;
    recommendedLevel: number;
    requirementLabel: string;
    target: number;
    reward: number;
    boss: boolean;
  };
  raid?: { targetName: string; squadNames: string[]; hostility: number; standingLoss: number };
  tribute?: { amount: number; standing: number; maxAmount: number };
  loan?: { hours: number; rate: number; pay: number; candidates: { id: string; name: string; level: number; statusLabel: string }[] };
  field: { districtName: string; pollution: number; pollutionLabel: string; dailyRise: number; ownerName: string; attitudeLabel: string; attitudeNote: string; intercept: string };
  /** 接了这一单能得到什么。 */
  gains: string[];
  /** 办砸了要付什么（与结算同一套算法）。 */
  cost: string;
  note: string;
}

const STATUS_LABEL: Record<string, string> = {
  idle: '空闲', expedition: '出勤中', healing: '治疗中', injured: '受伤', rest: '休息', training: '训练',
};

export function envoyPreviewOf(state: GameState, faction: FactionId): EnvoyPreview {
  const rules = loadBalance();
  const offer = envoyOfferOf(state, faction);
  const representative = factionRepresentativeOf(state, faction);
  const info = state.factions[faction];
  const attitude = factionAttitude(info?.standing ?? 0);
  const mission = offer.mission;
  const district: DistrictId = mission?.district ?? districtOrder[0]!;
  const forecast = pollutionForecast(state, district, mission);
  const owner = state.territories?.[district];
  const idle = state.girls.filter(girl => !girl.dead && !girl.retired && !girl.left && girl.status === 'idle' && !girl.loan);

  const gains: string[] = [];
  if (offer.kind === 'coop') {
    gains.push(`完成：势力好感 +${rules.envoyCoopStandingGain}`, `报酬高 ${rules.envoyCoopRewardPct}%`, `额外净化 −${forecast.estimatedRelief ?? 0} 污染`);
  } else if (offer.kind === 'raid') {
    gains.push(`完成：${factionInfo[faction].name}好感不变`, `被破坏方好感 −${rules.envoyRaidTargetStandingLoss}`, `报酬高 ${rules.envoyRaidRewardPct}%`);
  } else if (offer.kind === 'tribute') {
    gains.push(`付出即得：势力好感 +${offer.amount ? Math.floor(offer.amount / Math.max(1, rules.envoyTributePerStanding)) : 0}`);
  } else {
    gains.push(`借调期间拿钱，不涨疲劳`, `势力好感 +${rules.envoyLoanStandingGain}`);
  }

  if (representative.vacant) {
    // 席位空缺时不要拿模板凑一份假委托出来。
    return {
      faction,
      factionName: factionInfo[faction].name,
      kind: offer.kind,
      representative: { id: representative.id, name: representative.name, title: representative.title },
      vacant: true,
      vacantNote: '这一方还没有派人来。契约卡不足时三方名册只能空着：到契约卡库导入卡片，或在开局编成里把人安排到对应位置。',
      done: Boolean(info?.envoyTaskId),
      field: {
        districtName: districts[district].name,
        pollution: forecast.level,
        pollutionLabel: pollutionTierLabel(forecast.level),
        dailyRise: forecast.dailyRise,
        ownerName: owner ? factionInfo[owner].name : '无主',
        attitudeLabel: attitude.label,
        attitudeNote: attitude.discount,
        intercept: '没有人会来接这单',
      },
      gains: [],
      cost: '这一方没有代表，也就没有失败代价。',
      note: '先补上这一方的代表，再来谈委托。',
    };
  }

  return {
    faction,
    factionName: factionInfo[faction].name,
    kind: offer.kind,
    representative: { id: representative.id, name: representative.name, title: representative.title },
    vacant: Boolean(representative.vacant),
    vacantNote: representative.vacant
      ? '这一方还没有派人来。契约卡不足时三方名册只能空着：到契约卡库导入卡片，或在开局编成里把人安排到对应位置。'
      : '',
    done: Boolean(info?.envoyTaskId),
    mission: mission ? {
      title: mission.title,
      workLabel: mission.work === 'combat' ? '战斗' : '调查',
      difficulty: mission.difficulty,
      duration: mission.duration,
      districtName: districts[district].name,
      recommendedLevel: mission.recommendedLevel,
      requirementLabel: STAT_LABEL[mission.requirement] ?? mission.requirement,
      target: mission.target,
      reward: mission.reward,
      boss: Boolean(mission.boss),
    } : undefined,
    raid: offer.kind === 'raid' && mission ? {
      targetName: offer.target ? factionInfo[offer.target].name : '对方',
      squadNames: (mission.interception?.girlIds ?? []).map(id => id),
      hostility: offer.hostility ?? rules.envoyRaidHostility,
      standingLoss: rules.envoyRaidTargetStandingLoss,
    } : undefined,
    tribute: offer.kind === 'tribute' ? {
      amount: offer.amount ?? 0,
      standing: Math.floor((offer.amount ?? 0) / Math.max(1, rules.envoyTributePerStanding)),
      maxAmount: Math.max(rules.envoyTributeMin, rules.envoyTributeMax),
    } : undefined,
    loan: offer.kind === 'loan' ? {
      hours: offer.hours ?? 1,
      rate: offer.rate ?? 0,
      pay: (offer.hours ?? 1) * (offer.rate ?? 0),
      candidates: idle.slice(0, 6).map(girl => ({ id: girl.id, name: girl.name, level: girl.level, statusLabel: STATUS_LABEL[girl.status] ?? girl.status })),
    } : undefined,
    field: {
      districtName: mission ? districts[district].name : '事务所会客厅（不出勤）',
      pollution: forecast.level,
      pollutionLabel: pollutionTierLabel(forecast.level),
      dailyRise: forecast.dailyRise,
      ownerName: owner ? factionInfo[owner].name : '无主',
      attitudeLabel: attitude.label,
      attitudeNote: attitude.discount,
      intercept: mission && canIntercept(state, mission) ? `可能被${owner ? factionInfo[owner].name : '辖区当主'}拦截` : '不会有人来拦',
    },
    gains,
    cost: mission ? failurePenaltyText(failurePenaltyFor(state, mission, rules)) : '这一单不需要出勤，失败代价只在出勤时结算。',
    note: offer.note,
  };
}
