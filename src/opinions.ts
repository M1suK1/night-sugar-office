import type { FactionId, GameState, MissionTemplate, Opinion, OpinionChange, OpinionDialogueLine, OpinionOption, OpinionOutcome } from './types';
import { factionInfo, getItem } from './content/items.ts';
import { districts, type DistrictId } from './districts.ts';
import { absoluteMinutes, SHIFT_END } from './shift.ts';

export interface OpinionDefaultContext {
  authorId?: string;
  authorName?: string;
  faction?: FactionId;
  district?: DistrictId;
  request?: string;
}

export interface OpinionPreview {
  ok: boolean;
  missing: string[];
  /** 本次决议会推进的分钟数。 */
  minutes: number;
}

const factionLabel = (faction: FactionId) => factionInfo[faction]?.name ?? faction;
const signed = (value: number) => value > 0 ? `+${value}` : `−${Math.abs(value)}`;
const girlFieldLabels = { bond: '羁绊', fatigue: '疲劳', corruption: '侵蚀', hp: '生命' } as const;

function optionMission(district: DistrictId | undefined): MissionTemplate | undefined {
  if (!district) return undefined;
  const region = districts[district];
  return {
    id: `council-city-${district}`,
    title: `巡查${region.name}`,
    category: '议会专项',
    description: `议会把${region.name}的异常列进了今晚的优先事项。需要在街区彻底安静之前确认源头。`,
    difficulty: '中危',
    duration: 60,
    requirement: 'insight',
    target: 55,
    work: 'investigation',
    enemyIds: [],
    rounds: 3,
    recommendedLevel: 2,
    district,
    window: 'urgent',
    reward: 700,
    color: '#8fd3c6',
  };
}

/** 按议题主题生成默认的三项选择；数值全部在本地决定，模型只负责提出议题。 */
export function defaultOpinionOptions(topic: Opinion['topic'], context: OpinionDefaultContext = {}): OpinionOption[] {
  const { authorId, authorName = '提出者', faction, district } = context;
  const bond = (amount: number): OpinionChange[] => authorId ? [{ kind: 'girl', girlId: authorId, field: 'bond', amount }] : [];
  const factionChange = (amount: number): OpinionChange[] => faction ? [{ kind: 'faction', faction, amount }] : [];
  const fatigue = (amount: number): OpinionChange[] => authorId ? [{ kind: 'girl', girlId: authorId, field: 'fatigue', amount }] : [];
  const baseAccept: OpinionChange[] = [];
  const baseDefer: OpinionChange[] = [...bond(-1), ...factionChange(-2)];
  const baseReject: OpinionChange[] = [...bond(-2), ...factionChange(-4)];
  let accept: OpinionChange[] = [];
  let reject: OpinionChange[] = [...baseReject];
  let acceptOutcomes: OpinionOutcome[] = [];

  if (topic === '经费') {
    accept = [...baseAccept, { kind: 'gold', amount: -600 }, ...bond(3)];
    reject.push({ kind: 'gold', amount: -300 });
  } else if (topic === '排班') {
    accept = [...baseAccept, { kind: 'minutes', amount: 30 }, ...bond(3), ...fatigue(-4)];
    reject.push({ kind: 'minutes', amount: 30 }, ...fatigue(5));
  } else if (topic === '设施') {
    accept = [...baseAccept, { kind: 'gold', amount: -900 }, { kind: 'reputation', amount: 1 }, ...bond(3)];
    reject.push({ kind: 'gold', amount: -200 }, { kind: 'reputation', amount: -1 });
  } else if (topic === '同伴') {
    accept = [...baseAccept, { kind: 'gold', amount: -300 }, ...bond(3)];
    reject.push({ kind: 'gold', amount: -150 }, { kind: 'reputation', amount: -1 });
  } else if (topic === '城市') {
    const mission = optionMission(district);
    accept = [...baseAccept, { kind: 'minutes', amount: 60 }, ...factionChange(4), { kind: 'reputation', amount: 1 }, ...bond(3)];
    if (mission) acceptOutcomes.push({ kind: 'mission', template: mission });
    reject.push({ kind: 'minutes', amount: 30 }, ...factionChange(-2));
  } else {
    accept = [...baseAccept, { kind: 'minutes', amount: 120 }, ...bond(5), ...fatigue(-20)];
    reject.push({ kind: 'minutes', amount: 60 }, ...fatigue(5));
  }

  const acceptEffect = `批准后${authorName}的羁绊上升。`;
  const deferEffect = faction ? `羁绊下降，${factionLabel(faction)}的态度下降，留待下个议事日。` : '羁绊下降，留待下个议事日。';
  const rejectEffect = `驳回会降低羁绊${faction ? `与${factionLabel(faction)}的态度` : ''}，并扣掉相应资源。`;
  return [
    { id: 'accept', label: '批准', effect: acceptEffect, changes: accept, outcomes: acceptOutcomes },
    { id: 'defer', label: '暂缓', effect: deferEffect, changes: baseDefer },
    { id: 'reject', label: '驳回', effect: rejectEffect, changes: reject },
  ];
}

/** 按议题主题生成一段简短的提出者独白；数值仍由选项决定。 */
export function defaultOpinionDialogue(topic: Opinion['topic'], context: OpinionDefaultContext = {}): OpinionDialogueLine[] {
  const { authorId, authorName = '提出者', faction, district, request } = context;
  const districtName = district ? districts[district].name : '城里';
  const script: Record<Opinion['topic'], { opening: string; reason: string; expression: OpinionDialogueLine['expression'] }> = {
    经费: { opening: '会客厅的灯，我想换很久了。', reason: '不是嫌它旧。只是夜里回来，白光会让人以为自己还在诊所。', expression: 'calm' },
    排班: { opening: '昨晚点名的时候，有人站着就睡着了。', reason: '我不是想少做事。只是再这样排下去，下一次出任务，她们可能连跑都跑不动。', expression: 'sad' },
    设施: { opening: '星象台的裂缝又大了。', reason: '风声灌进来的时候，我会把求救听成别的东西。', expression: 'sad' },
    同伴: { opening: '新来的人今天一直站在门口。', reason: '她没有说，但我知道她在等有人先开口。', expression: 'smile' },
    城市: { opening: `${districtName}昨晚又出现了异常。`, reason: '我想去看看。不是以事务所的名义，是以住在那条街上的人的名义。', expression: 'calm' },
    私人心愿: { opening: '这件事和事务所没有关系。', reason: '但我还是想问你。', expression: 'shy' },
  };
  const picked = script[topic] ?? script.私人心愿;
  const lines: OpinionDialogueLine[] = [
    { speakerId: authorId, speaker: authorName, text: picked.opening, expression: picked.expression },
    { speakerId: authorId, speaker: authorName, text: picked.reason, expression: picked.expression },
  ];
  if (faction && topic !== '私人心愿') {
    lines.push({ speakerId: authorId, speaker: authorName, text: `这件事，${factionLabel(faction)}也在等一个答复。`, expression: 'calm' });
  }
  if (request?.trim()) lines.push({ speakerId: authorId, speaker: authorName, text: request.trim(), expression: picked.expression });
  return lines;
}

/** 取议题自带对白；旧存档、故事蓝图或缺失字段时按主题补默认演出。 */
export function resolveOpinionDialogue(state: GameState, opinion: Opinion): OpinionDialogueLine[] {
  const author = state.girls.find(girl => girl.id === opinion.authorId) ?? state.memorial.find(entry => entry.girl.id === opinion.authorId)?.girl;
  const fallback = defaultOpinionDialogue(opinion.topic, {
    authorId: opinion.authorId,
    authorName: author?.name ?? '提出者',
    faction: opinion.faction,
    request: opinion.request,
  });
  if (!Array.isArray(opinion.dialogue)) return fallback;
  const lines = opinion.dialogue
    .filter(line => line && typeof line.text === 'string' && line.text.trim())
    .slice(0, 8)
    .map(line => ({
      speakerId: typeof line.speakerId === 'string' ? line.speakerId : opinion.authorId,
      speaker: typeof line.speaker === 'string' && line.speaker.trim() ? line.speaker.trim().slice(0, 24) : author?.name ?? '提出者',
      text: line.text.trim().slice(0, 240),
      expression: line.expression,
    }));
  return lines.length ? lines : fallback;
}

/** 旧存档、故事蓝图或手写选项没有结构化数据时，用同主题的默认值补齐。 */
export function resolveOpinionOptions(state: GameState, opinion: Opinion): OpinionOption[] {
  const author = state.girls.find(girl => girl.id === opinion.authorId);
  const defaults = defaultOpinionOptions(opinion.topic, {
    authorId: opinion.authorId,
    authorName: author?.name ?? '提出者',
    faction: opinion.faction,
  });
  if (!opinion.options.length) return defaults;
  return opinion.options.map(option => {
    const fallback = defaults.find(entry => entry.id === option.id);
    return {
      ...fallback,
      ...option,
      changes: Array.isArray(option.changes) ? option.changes : fallback?.changes,
      outcomes: Array.isArray(option.outcomes) ? option.outcomes : fallback?.outcomes,
    };
  });
}

function formatChanges(changes: OpinionChange[], state?: GameState): string[] {
  return changes.map(change => {
    if (change.kind === 'gold') return `${signed(change.amount)} 星砂`;
    if (change.kind === 'reputation') return `${signed(change.amount)} 安定度`;
    if (change.kind === 'faction') return `${signed(change.amount)} ${factionLabel(change.faction)}态度`;
    if (change.kind === 'item') return `${signed(change.amount)} ${getItem(change.itemId)?.name ?? change.itemId}`;
    if (change.kind === 'minutes') return `推进 ${change.amount} 分钟`;
    const girl = state?.girls.find(entry => entry.id === change.girlId);
    return `${girl?.name ?? '契约者'} ${girlFieldLabels[change.field]} ${signed(change.amount)}`;
  });
}

export function opinionOptionTags(option: OpinionOption, state?: GameState): string[] {
  const tags = formatChanges(option.changes ?? [], state);
  for (const outcome of option.outcomes ?? []) {
    if (outcome.kind === 'territory') tags.push(`${districts[outcome.district].name} → ${factionLabel(outcome.faction)}`);
    if (outcome.kind === 'mission') tags.push(`+1 特殊委托「${outcome.template.title}」`);
    if (outcome.kind === 'join') tags.push(`+1 免费契约者 Lv.${outcome.level}`);
    if (outcome.kind === 'leave') tags.push(`−1 契约者 ${state?.girls.find(girl => girl.id === outcome.girlId)?.name ?? ''}`);
  }
  if (option.shift && !(option.outcomes ?? []).some(outcome => outcome.kind === 'territory')) {
    tags.push(`${districts[option.shift.district].name} → ${factionLabel(option.shift.faction)}`);
  }
  return Array.from(new Set(tags));
}

/** 校验选项所需的资源。暂缓是没有资源门槛的保底选项。 */
export function previewOpinionOption(state: GameState, _opinion: Opinion, option: OpinionOption): OpinionPreview {
  const missing: string[] = [];
  if (option.id === 'defer') return { ok: true, missing, minutes: 0 };
  let minutes = 0;
  for (const change of option.changes ?? []) {
    if (change.kind === 'gold' && change.amount < 0 && state.gold + change.amount < 0) {
      missing.push(`星砂还差 ${Math.abs(state.gold + change.amount).toLocaleString('zh-CN')}`);
    }
    if (change.kind === 'reputation' && change.amount < 0 && state.reputation + change.amount < 0) {
      missing.push(`安定度还差 ${Math.abs(state.reputation + change.amount)}`);
    }
    if (change.kind === 'faction' && change.amount < 0 && (state.factions[change.faction]?.standing ?? 0) + change.amount < 0) {
      missing.push(`${factionLabel(change.faction)}态度还差 ${Math.abs((state.factions[change.faction]?.standing ?? 0) + change.amount)}`);
    }
    if (change.kind === 'item' && change.amount < 0 && (state.inventory[change.itemId] ?? 0) + change.amount < 0) {
      missing.push(`仓库缺少 ${Math.abs((state.inventory[change.itemId] ?? 0) + change.amount)} 件「${getItem(change.itemId)?.name ?? change.itemId}」`);
    }
    if (change.kind === 'minutes') minutes += Math.max(0, change.amount);
  }
  for (const outcome of option.outcomes ?? []) {
    if (outcome.kind !== 'leave') continue;
    const girl = state.girls.find(entry => entry.id === outcome.girlId);
    if (!girl) missing.push('离队对象已不在名册上');
    else if (girl.dead || girl.retired) missing.push(`${girl.name}已经不在值夜名册上`);
    else if (girl.status === 'mission' || girl.status === 'expedition') missing.push(`${girl.name}正在${girl.status === 'mission' ? '委托' : '远行'}中，无法离队`);
  }
  if (minutes > 0) {
    if (minutes > 180) missing.push('一次最多推进 180 分钟');
    if (state.incidents.some(incident => incident.status === 'pending')) missing.push('先处理桌上的待决议事件');
    const left = absoluteMinutes(state.day, SHIFT_END) - absoluteMinutes(state.day, state.minutes);
    if (minutes > left) missing.push(`今晚只剩 ${Math.max(0, left)} 分钟`);
  }
  return { ok: missing.length === 0, missing, minutes };
}
