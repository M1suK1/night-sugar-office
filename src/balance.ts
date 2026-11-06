/**
 * 可调数值：世界书页的「数值」页签直接改这里，保存即生效。
 * 只放真正影响结算的数字；文案与提示仍写在各模块里。
 */
export interface BalanceRules {
  /** 诊所起步价。 */
  clinicBase: number;
  /** 每缺失 1 点血量的费用。 */
  clinicPerHp: number;
  /** 带治疗癖好的附加费用。 */
  clinicKinkFee: number;
  /** 治疗每小时恢复的血量。 */
  clinicHpPerHour: number;
  /** 月光诊所每升 1 级，治疗速度额外 +多少血/小时。 */
  clinicHpPerHourPerLevel: number;
  /** 月光诊所每升 1 级，各项费用降低的百分点（治疗 / 重塑 / 清除 / 复制）。 */
  clinicCostDiscountPerLevel: number;
  /** 星象台每升 1 级，远行队伍人数上限 +几人。 */
  expeditionMembersPerLevel: number;
  /** 星象台每升 1 级，每人每小时的星砂收益 +多少。 */
  expeditionGoldPerLevel: number;
  /** 宿舍扩建价相对其它设施的折扣（百分点）：50 = 半价。 */
  dormBuildDiscountPct: number;
  /** 代表委托三种形态的权重（共建 / 破坏 / 借调）。 */
  envoyCoopWeight: number;
  envoyRaidWeight: number;
  envoyLoanWeight: number;
  /** 共建：完成 +好感、额外星砂百分比、失败扣好感。 */
  envoyCoopStandingGain: number;
  envoyCoopRewardPct: number;
  envoyCoopStandingLoss: number;
  /** v167：委托失败的违约金 —— 报酬的百分比，以及最低金额。 */
  missionFailurePenaltyPct: number;
  missionFailurePenaltyMin: number;
  /** 势力代表委托失败时，额外扣多少该势力好感。 */
  envoyFailureExtraStandingLoss: number;
  /** v168 事务所会议：场地费 + 每人单价，人数上下限，关系涨幅，时长与疲劳恢复。 */
  meetingBaseCost: number;
  meetingPerAttendee: number;
  meetingMinAttendees: number;
  meetingMaxAttendees: number;
  meetingRelationBase: number;
  meetingMinutes: number;
  meetingFatigueRelief: number;
  /** 破坏：被破坏方扣多少好感、额外星砂百分比、基础火气、失败时的火气。 */
  envoyRaidTargetStandingLoss: number;
  envoyRaidRewardPct: number;
  envoyRaidHostility: number;
  envoyRaidFailureHostility: number;
  /** 污染对魔物的增幅（每 100 点污染对应的百分比）。 */
  pollutionHpPct: number;
  pollutionPowerPct: number;
  pollutionTargetPct: number;
  pollutionRewardPct: number;
  /** 战斗委托：每多一只魔物，奖励额外提高的百分点。 */
  rewardPerExtraMonster: number;
  /** 索款：势力直接要钱，200–1000 星砂，每 200 换 1 点好感。 */
  envoyTributeWeight: number;
  envoyTributeMin: number;
  envoyTributeMax: number;
  envoyTributePerStanding: number;
  /** 借星砂：1 点安定换多少星砂、每天最多几点、每次扣多少好感。 */
  factionLoanPerPoint: number;
  factionLoanDailyCap: number;
  factionLoanStandingCost: number;
  /** 借调：好感与最长小时数。 */
  envoyLoanStandingGain: number;
  envoyLoanMaxHours: number;
  /** 宿舍每小时恢复的疲劳。 */
  /** 休息时每小时恢复多少疲劳。 */
  dormFatiguePerHour: number;
  /** 休息到疲劳不高于这个值就自动结束。 */
  dormRestExitFatigue: number;
  /** 一次休息平复多少侵蚀。 */
  dormRestCorruption: number;
  /** 侵蚀达到多少可以显形魔女化礼装。 */
  corruptionThreshold: number;
  /** 单次派遣最多几人。 */
  squadLimit: number;
  /** 单个势力最多占几块辖区。 */
  territoryLimit: number;
  /** 长期委托最短天数。 */
  longMinDays: number;
  /** 长期委托最长天数。 */
  longMaxDays: number;
  /** 委托成功后她主动私语的基础概率（百分比）。 */
/** 势力首领召见的日概率（百分比）：掷中才有人来请所长过去。 */
  leaderSummonChance: number;
  /** 同一位首领两次召见之间至少隔几天。 */
  leaderSummonCooldownDays: number;
    whisperVictoryPct: number;
  /** 击退或失败后的基础概率（她更想开口安慰）。 */
  whisperDefeatPct: number;
  /** 羁绊拉满时的额外加成上限（百分点）。 */
  whisperBondMaxPct: number;
  /** 正在走故事线的角色专用概率；100 表示必出。 */
  whisperStoryPct: number;
  /** 最终概率封顶。 */
  whisperMaxPct: number;
  /** 每晚最多入队几条私语。 */
  whisperDailyCap: number;
  /** 城市新闻开关：1 = 每天生成一条播报，0 = 关掉。 */
  cityNewsEnabled: number;
}

export const BALANCE_KEY = 'night-sugar:balance';

export const DEFAULT_BALANCE: BalanceRules = {
  clinicBase: 120,
  clinicPerHp: 5,
  clinicKinkFee: 320,
  clinicHpPerHour: 30,
  clinicHpPerHourPerLevel: 10,
  clinicCostDiscountPerLevel: 5,
  expeditionMembersPerLevel: 1,
  expeditionGoldPerLevel: 50,
  dormBuildDiscountPct: 50,
  envoyCoopWeight: 45,
  envoyRaidWeight: 30,
  envoyLoanWeight: 25,
  envoyCoopStandingGain: 1,
  envoyCoopRewardPct: 10,
  envoyCoopStandingLoss: 1,
  missionFailurePenaltyPct: 20,
  missionFailurePenaltyMin: 50,
  envoyFailureExtraStandingLoss: 2,
  meetingBaseCost: 200,
  meetingPerAttendee: 120,
  meetingMinAttendees: 2,
  meetingMaxAttendees: 6,
  meetingRelationBase: 2,
  meetingMinutes: 60,
  meetingFatigueRelief: 10,
  envoyRaidTargetStandingLoss: 3,
  envoyRaidRewardPct: 50,
  envoyRaidHostility: 8,
  envoyRaidFailureHostility: 4,
  pollutionHpPct: 55,
  pollutionPowerPct: 38,
  pollutionTargetPct: 16,
  pollutionRewardPct: 22,
  rewardPerExtraMonster: 15,
  envoyTributeWeight: 20,
  envoyTributeMin: 200,
  envoyTributeMax: 1000,
  envoyTributePerStanding: 200,
  factionLoanPerPoint: 300,
  factionLoanDailyCap: 10,
  factionLoanStandingCost: 2,
  envoyLoanStandingGain: 1,
  envoyLoanMaxHours: 6,
  dormFatiguePerHour: 20,
  dormRestExitFatigue: 20,
  dormRestCorruption: 5,
  corruptionThreshold: 40,
  squadLimit: 3,
  territoryLimit: 5,
  longMinDays: 2,
  longMaxDays: 7,
  whisperVictoryPct: 30,
  leaderSummonChance: 40,
  leaderSummonCooldownDays: 3,
  whisperDefeatPct: 45,
  whisperBondMaxPct: 20,
  whisperStoryPct: 100,
  whisperMaxPct: 85,
  whisperDailyCap: 3,
  cityNewsEnabled: 1,
};

export interface BalanceField {
  key: keyof BalanceRules;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** 分组标题：相邻同组的字段会排在一起。 */
  group: string;
  /** toggle：0 / 1 的开关，界面上渲染成开关而不是数字框。 */
  kind?: 'number' | 'toggle';
}

export const BALANCE_GROUPS = ['运营与诊所', '灯下私语', '城市新闻'] as const;

export const BALANCE_FIELDS: BalanceField[] = [
  { key: 'clinicBase', label: '诊所起步价', hint: '每次治疗的基础费用。', min: 0, max: 2000, step: 10, unit: '星砂', group: '运营与诊所' },
  { key: 'clinicPerHp', label: '每点血量费用', hint: '按缺失血量累加，越重的伤越贵。', min: 0, max: 60, step: 1, unit: '星砂', group: '运营与诊所' },
  { key: 'clinicKinkFee', label: '治疗癖好加价', hint: '选择带癖好的治疗时额外收取。', min: 0, max: 3000, step: 10, unit: '星砂', group: '运营与诊所' },
  { key: 'clinicHpPerHour', label: '治疗速度', hint: '每小时恢复的血量；决定治疗占用多久。', min: 1, max: 60, step: 1, unit: '血/小时', group: '运营与诊所' },
  { key: 'clinicHpPerHourPerLevel', label: '诊所每级加速', hint: '诊所升 1 级，治疗速度再加这么多血/小时。', min: 0, max: 40, step: 1, unit: '血/小时', group: '基地设施' },
  { key: 'clinicCostDiscountPerLevel', label: '诊所每级折扣', hint: '诊所升 1 级，治疗 / 重塑 / 清除 / 复制费用降这么多百分点。', min: 0, max: 25, step: 1, unit: '%', group: '基地设施' },
  { key: 'expeditionMembersPerLevel', label: '星象台每级人数', hint: '星象台升 1 级，远行队伍人数上限加几人。', min: 0, max: 3, step: 1, unit: '人', group: '基地设施' },
  { key: 'expeditionGoldPerLevel', label: '星象台每级收益', hint: '星象台升 1 级，每人每小时多带回多少星砂。', min: 0, max: 500, step: 10, unit: '星砂', group: '基地设施' },
  { key: 'dormBuildDiscountPct', label: '宿舍扩建折扣', hint: '宿舍扩建价相对其它设施的折扣，50 表示半价。', min: 0, max: 90, step: 5, unit: '%', group: '基地设施' },
  { key: 'envoyCoopWeight', label: '共建权重', hint: '代表委托里「在自己辖区干活」的比例。', min: 0, max: 100, step: 5, unit: '', group: '势力代表' },
  { key: 'envoyRaidWeight', label: '破坏权重', hint: '代表委托里「去别人辖区打一场」的比例。', min: 0, max: 100, step: 5, unit: '', group: '势力代表' },
  { key: 'envoyLoanWeight', label: '借调权重', hint: '代表委托里「借人」的比例。', min: 0, max: 100, step: 5, unit: '', group: '势力代表' },
  { key: 'envoyCoopStandingGain', label: '共建好感', hint: '在自己辖区完成势力委托，涨多少势力好感。', min: 0, max: 10, step: 1, unit: '', group: '势力代表' },
  { key: 'envoyCoopRewardPct', label: '共建额外星砂', hint: '共建委托的星砂加成百分比。', min: 0, max: 200, step: 5, unit: '%', group: '势力代表' },
  { key: 'envoyCoopStandingLoss', label: '共建失败扣好感', hint: '共建委托失败时扣多少势力好感。', min: 0, max: 10, step: 1, unit: '', group: '势力代表' },
  { key: 'missionFailurePenaltyPct', label: '失败违约金', hint: '委托失败时按报酬的百分比赔钱。', min: 0, max: 100, step: 5, unit: '%', group: '势力代表' },
  { key: 'missionFailurePenaltyMin', label: '违约金下限', hint: '违约金最少赔多少星砂（手头不够就赔到 0）。', min: 0, max: 2000, step: 50, unit: '星砂', group: '势力代表' },
  { key: 'envoyFailureExtraStandingLoss', label: '代表委托失败', hint: '势力代表委托失败时，额外扣多少该势力好感。', min: 0, max: 10, step: 1, unit: '', group: '势力代表' },
  { key: 'meetingBaseCost', label: '会议场地费', hint: '开一场会议的固定开销。', min: 0, max: 5000, step: 50, unit: '星砂', group: '事务所会议' },
  { key: 'meetingPerAttendee', label: '会议每人', hint: '每多一位参会者加多少星砂。', min: 0, max: 2000, step: 20, unit: '星砂', group: '事务所会议' },
  { key: 'meetingMinAttendees', label: '会议最少人', hint: '少于这个人数就开不成会。', min: 1, max: 6, step: 1, unit: '人', group: '事务所会议' },
  { key: 'meetingMaxAttendees', label: '会议最多人', hint: '参会人数上限。', min: 2, max: 10, step: 1, unit: '人', group: '事务所会议' },
  { key: 'meetingRelationBase', label: '会议关系', hint: '会后参会者两两上涨的关系值。', min: 0, max: 10, step: 1, unit: '', group: '事务所会议' },
  { key: 'meetingMinutes', label: '会议时长', hint: '开一场会议消耗多少分钟。', min: 15, max: 240, step: 5, unit: '分钟', group: '事务所会议' },
  { key: 'meetingFatigueRelief', label: '会议恢复疲劳', hint: '每位参会者会后恢复多少疲劳。', min: 0, max: 50, step: 1, unit: '', group: '事务所会议' },
  { key: 'envoyRaidTargetStandingLoss', label: '破坏扣好感', hint: '被破坏势力扣多少好感。', min: 0, max: 20, step: 1, unit: '', group: '势力代表' },
  { key: 'envoyRaidRewardPct', label: '破坏额外星砂', hint: '破坏行动的星砂加成百分比。', min: 0, max: 300, step: 10, unit: '%', group: '势力代表' },
  { key: 'envoyRaidHostility', label: '破坏基础火气', hint: '破坏行动给两势力加多少火气（再按对方辖区污染与安定加权）。', min: 0, max: 40, step: 1, unit: '', group: '势力代表' },
  { key: 'envoyRaidFailureHostility', label: '破坏失败火气', hint: '破坏失败时仍然加多少火气。', min: 0, max: 40, step: 1, unit: '', group: '势力代表' },
  { key: 'pollutionHpPct', label: '污染·魔物血量', hint: '每 100 点污染让魔物血量加成多少百分比。', min: 0, max: 150, step: 5, unit: '%', group: '污染与难度' },
  { key: 'pollutionPowerPct', label: '污染·魔物伤害', hint: '每 100 点污染让魔物伤害加成多少百分比。', min: 0, max: 120, step: 5, unit: '%', group: '污染与难度' },
  { key: 'pollutionTargetPct', label: '污染·判定难度', hint: '每 100 点污染让委托目标值加成多少百分比。', min: 0, max: 60, step: 2, unit: '%', group: '污染与难度' },
  { key: 'pollutionRewardPct', label: '污染·报酬加成', hint: '每 100 点污染让委托报酬加成多少百分比。', min: 0, max: 80, step: 2, unit: '%', group: '污染与难度' },
  { key: 'rewardPerExtraMonster', label: '多怪奖励加成（4 只起）', hint: '战斗委托超过 3 只后，每多一只魔物，奖励额外提高多少百分比。', min: 0, max: 60, step: 5, unit: '%', group: '污染与难度' },
  { key: 'envoyTributeWeight', label: '索款权重', hint: '势力代表直接索要星砂的权重。', min: 0, max: 80, step: 5, group: '势力代表' },
  { key: 'envoyTributeMin', label: '索款下限', hint: '一次索款最少要多少星砂。', min: 100, max: 1000, step: 100, unit: '星砂', group: '势力代表' },
  { key: 'envoyTributeMax', label: '索款上限', hint: '一次索款最多要多少星砂。', min: 200, max: 2000, step: 100, unit: '星砂', group: '势力代表' },
  { key: 'envoyTributePerStanding', label: '索款每档', hint: '每多少星砂换 1 点好感。', min: 100, max: 500, step: 50, unit: '星砂', group: '势力代表' },
  { key: 'factionLoanPerPoint', label: '借星砂单价', hint: '向势力借 1 点安定能换多少星砂。', min: 100, max: 800, step: 50, unit: '星砂', group: '势力代表' },
  { key: 'factionLoanDailyCap', label: '借星砂每日上限', hint: '一天最多能借出多少点安定。', min: 1, max: 40, step: 1, unit: '点', group: '势力代表' },
  { key: 'factionLoanStandingCost', label: '借星砂好感代价', hint: '每次借星砂扣该势力多少好感。', min: 0, max: 10, step: 1, unit: '好感', group: '势力代表' },
  { key: 'envoyLoanStandingGain', label: '借调好感', hint: '把少女借给势力，涨多少好感。', min: 0, max: 10, step: 1, unit: '', group: '势力代表' },
  { key: 'envoyLoanMaxHours', label: '借调最长小时', hint: '一次最多借几个小时。', min: 1, max: 12, step: 1, unit: '小时', group: '势力代表' },
  { key: 'dormFatiguePerHour', label: '休息恢复速度', hint: '休息时每小时恢复多少疲劳。', min: 5, max: 40, step: 1, unit: '疲劳/小时', group: '运营与诊所' },
  { key: 'dormRestExitFatigue', label: '休息结束阈值', hint: '疲劳降到这个值以下就自动结束休息。', min: 0, max: 60, step: 1, unit: '疲劳', group: '运营与诊所' },
  { key: 'dormRestCorruption', label: '休息平复侵蚀', hint: '一次休息平复多少侵蚀。', min: 0, max: 30, step: 1, unit: '点', group: '运营与诊所' },
  { key: 'corruptionThreshold', label: '魔女化阈值', hint: '侵蚀达到该值后解锁魔女化礼装。', min: 10, max: 100, step: 5, unit: '侵蚀', group: '运营与诊所' },
  { key: 'squadLimit', label: '派遣上限', hint: '单个委托最多派几人。', min: 1, max: 5, step: 1, unit: '人', group: '运营与诊所' },
  { key: 'territoryLimit', label: '势力辖区上限', hint: '单一势力最多能占几块辖区。', min: 1, max: 9, step: 1, unit: '块', group: '运营与诊所' },
  { key: 'longMinDays', label: '长期委托最短', hint: '长期委托的持续天数下限。', min: 1, max: 7, step: 1, unit: '天', group: '运营与诊所' },
  { key: 'longMaxDays', label: '长期委托最长', hint: '长期委托的持续天数上限。', min: 1, max: 7, step: 1, unit: '天', group: '运营与诊所' },
  { key: 'whisperVictoryPct', label: '胜利基准', hint: '委托成功后她主动发消息的基础概率。', min: 0, max: 100, step: 5, unit: '%', group: '灯下私语' },
  { key: 'whisperDefeatPct', label: '失败基准', hint: '击退或失败后的基础概率；通常会比胜利高一点。', min: 0, max: 100, step: 5, unit: '%', group: '灯下私语' },
  { key: 'whisperBondMaxPct', label: '羁绊加成上限', hint: '羁绊拉满时额外增加的概率。', min: 0, max: 50, step: 5, unit: '%', group: '灯下私语' },
  { key: 'whisperStoryPct', label: '故事线角色', hint: '正在走故事线的角色专用概率；填 100 表示只要出勤就必发。', min: 0, max: 100, step: 5, unit: '%', group: '灯下私语' },
  { key: 'whisperMaxPct', label: '概率封顶', hint: '算上加成之后允许的最高概率。', min: 10, max: 100, step: 5, unit: '%', group: '灯下私语' },
  { key: 'whisperDailyCap', label: '每晚上限', hint: '一晚最多入队几条，避免一次刷满。', min: 1, max: 6, step: 1, unit: '条', group: '灯下私语' },
  { key: 'cityNewsEnabled', label: '每日城市新闻', hint: '每天换日时让叙事者按势力、污染与安定度写一条播报；关掉后派遣页不再显示这一块。', min: 0, max: 1, step: 1, group: '城市新闻', kind: 'toggle' },
];

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function sanitizeBalance(raw: unknown): BalanceRules {
  const value = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const next = { ...DEFAULT_BALANCE };
  for (const field of BALANCE_FIELDS) next[field.key] = clampInt(value[field.key], field.min, field.max, DEFAULT_BALANCE[field.key]);
  if (next.longMaxDays < next.longMinDays) next.longMaxDays = next.longMinDays;
  return next;
}

let cache: BalanceRules | null = null;

export function loadBalance(): BalanceRules {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(BALANCE_KEY);
    cache = raw ? sanitizeBalance(JSON.parse(raw)) : { ...DEFAULT_BALANCE };
  } catch {
    cache = { ...DEFAULT_BALANCE };
  }
  return cache;
}

export function saveBalance(rules: BalanceRules): boolean {
  const clean = sanitizeBalance(rules);
  cache = clean;
  try {
    localStorage.setItem(BALANCE_KEY, JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

export function resetBalance(): BalanceRules {
  cache = { ...DEFAULT_BALANCE };
  try { localStorage.removeItem(BALANCE_KEY); } catch { /* ignore */ }
  return { ...DEFAULT_BALANCE };
}

export function clearBalanceCache() {
  cache = null;
}

export const rules = loadBalance;
