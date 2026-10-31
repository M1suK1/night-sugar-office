import type { DistrictEffect, DistrictId } from './districts';
import type { CommissionWindow } from './shift';

export type StatKey = 'magic' | 'insight' | 'agility' | 'empathy';
export type Element = '星光系' | '糖霜系' | '月影系' | '梦境系' | '自然系' | '赤焰系' | '魔物';
export type Archetype = '输出' | '守护' | '控制' | '治愈' | '侦查' | '魔物';
export type GirlStatus = 'idle' | 'mission' | 'healing' | 'resting' | 'retired' | 'expedition' | 'left';

/** 主动离职的理由：心的位置变了、身体撑不住、或者契约款一直不到位。 */
export type LeftReason = 'bond' | 'fatigue' | 'pension';

/** 离职压力的连续天数计数器，开门时累加，条件消失就清零。 */
export interface GirlStrain { lowBondDays: number; highFatigueDays: number; }
export type WorkKind = 'combat' | 'investigation';
export type MissionStatus = 'open' | 'active' | 'done' | 'expired';
export type GoalKind = '战斗' | '调查' | '社交' | '生活' | '成长';
export type SkillResource = 'hp' | 'spirit';
export type SkillSide = 'enemy' | 'ally' | 'self';
export type SkillTier = 'basic' | 'signature' | 'ultimate' | 'boss';
export type EffectKind = 'dot' | 'stun' | 'shield' | 'buff' | 'debuff' | 'regen' | 'drain' | 'purify';
export type TraitPolarity = 'positive' | 'negative' | 'neutral';
export type Expression = 'calm' | 'smile' | 'surprise' | 'sad' | 'angry' | 'shy';
export type FactionId = 'witch' | 'association' | 'government';
/** 少女的出身，不是雇主。事务所收留任何出身的人，所以没有 `office` 这一种。 */
export type GirlFaction = 'association' | 'government' | 'witch' | 'none';
/** 事务所的自我介绍；唯一事实来源是 `GameState.office`，世界书条目由它生成。 */
/** 三方两两之间的一条敌意值。满 100 就一定会开战。 */
export type FactionPair = 'association-government' | 'association-witch' | 'government-witch';
export type HostilityTier = 'calm' | 'friction' | 'standoff' | 'brink';
export interface HostilityTrack {
  pair: FactionPair;
  /** 0–100，满 100 触发战线。 */
  value: number;
  updatedDay: number;
  /** 最后一次变动的原因，一句话。 */
  reason: string;
}
/** 开战记录：同一对势力短时间内不会再打。 */
export interface WarRecord { pair: FactionPair; day: number; }
/** 势力之间的一场仗。战线在辖区上打，玩家可以选边。 */
export interface FactionFront {
  id: string;
  pair: FactionPair;
  day: number;
  district: DistrictId;
  attacker: FactionId;
  defender: FactionId;
  startsAt: number;
  endsAt: number;
  attackerPower: number;
  defenderPower: number;
  status: 'open' | 'joined' | 'resolved' | 'expired';
  /** 开打那一刻的起因，结算文案要用它，不能事后被改。 */
  reason?: string;
  side?: 'attacker' | 'defender';
  squad?: string[];
  result?: 'attackerWin' | 'defenderWin' | 'stalemate';
  battleId?: string;
}

/**
 * 立绘在 IndexedDB `assets` 表里的键。
 *
 * 存进去的是**原始字节**（PNG 还是 PNG、1024 还是 1024），不再重编码。`state` 里只留这个键，
 * 所以存档体积与立绘数量解耦。
 */
export type AssetId = string;
/** 4:5 容器里的取景：缩放倍数与平移百分比，与立绘裁剪界面同一套手感。 */
export interface CropBox { zoom: number; x: number; y: number }

export interface OfficeProfile {
  background: string;
  philosophy: string;
  goal: string;
}
/** 势力首领：档案顶部的固定卡，不参与日常拦截。 */
export interface FactionLeader {
  id: string;
  faction: FactionId;
  name: string;
  title: string;
  portrait: string;
  portraitSpec?: PortraitSpec;
  color: string;
  quote: string;
  note: string;
  level: number;
  stats: Record<StatKey, number>;
  skillIds: string[];
  archetype: Archetype;
  /** 原属势力，只用于档案里的小字标注。 */
  origin: FactionId;
  /** 三套头衔，按现属势力取用。 */
  titles: Record<FactionId, string>;
  /** 覆灭后被雇佣，每次出勤的势力影响。 */
  duty: { faction: FactionId; note: string };
}

/** 某一方现存的首领与随从（可在开局编成里重新分配）。 */
export interface FactionRoster {
  leaderId: string;
  memberIds: string[];
}
/** 势力所属少女：静态名册，参与辖区拦截战，不进玩家契约池。 */
export interface FactionGirl {
  id: string;
  faction: FactionId;
  name: string;
  codename: string;
  title: string;
  portrait: string;
  portraitSpec?: PortraitSpec;
  color: string;
  level: number;
  stats: Record<StatKey, number>;
  skills: string[];
  /** 必须与 `faction` 一致。 */
  tag: FactionId;
  quote: string;
  note: string;
}
export type OutfitForm = 'normal' | 'witch';
export interface Outfit {
  id: string; name: string; description: string;
  palette: string[]; layerKey: string;
  /** 礼装形态：普通礼装或魔女形态。 */
  form?: OutfitForm;
  /** 这套衣服专属的立绘（data URL）。有它就不再走程序化立绘。 */
  portrait?: string;
  /** 立绘的 assets 键（原字节）；新数据只写这个。 */
  portraitAsset?: AssetId;
  portraitCrop?: CropBox;
  /** 与立绘同批生成的外形规格，用于头像/详情页。 */
  portraitSpec?: PortraitSpec;
  /** 来自角色卡或衣柜包，导出时原样带走。 */
  imported?: boolean;
  /** 自定义礼装：立绘沿用本人的 `girl.portrait`。 */
  custom?: boolean;
}
/** 装备阶级：1 最低、5 最高，越高越少，换更高的声望门槛。 */
export type EquipmentTier = 1 | 2 | 3 | 4 | 5;

export interface Equipment {
  id: string; name: string; faction: FactionId; slot: 'weapon' | 'charm' | 'consumable';
  price: number; standingReq: number; description: string;
  /** 阶级；旧数据、内容包与 LLM 装备可能没有，读入时由 `tierOf()` 按价格推断。 */
  tier?: EquipmentTier;
  stats?: Partial<Record<StatKey, number>>;
  passive?: string; skillId?: string; corruptionPerBattle?: number;
  maxHpBonus?: number; /** 旧字段：绝对心防加成，读入时折算成百分比后不再使用。 */ spiritBonus?: number;
  /** 心防上限的百分比加成（0–60）。 */ spiritBonusPct?: number;
  damageBonus?: number; initiativeBonus?: number;
  effect?: 'drug' | 'heal' | 'purify' | 'contractDiscount' | 'taxRefund';
  amount?: number;
}
/** 精英化：不改魔物模板，按这套倍率与被动现场套一层。 */
export interface EliteBuff {
  id: string; name: string; blurb: string; color: string;
  /** 图鉴对策：玩家该怎么打它。 */
  counter: string;
  /** 血量倍率，1.4–1.9。 */
  hpMul: number;
  /** 四项属性倍率，1.05–1.30。 */
  statMul: number;
  /** 共情单独再乘一次：精英的压迫感主要来自这里。 */
  empathyMul: number;
  /** 额外挂上的被动技能（必须已在技能表里）。 */
  skillIds: string[];
  /** 额外挂上的魔物规则。 */
  rules?: MonsterRule[];
}

/** Boss 的一个阶段：血量掉到 `atHpPct` 以下就换这套技能。 */
export interface BossPhase {
  /** 进入该阶段的血量比例（0–1），第一阶段固定 1。 */
  atHpPct: number;
  skillIds: string[];
  /** 阶段开场把这几只普通魔物拉进场。 */
  addIds?: string[];
  /** 阶段台词，写进战斗日志。 */
  line: string;
}

export interface BossTemplate {
  id: string; name: string; title: string; blurb: string;
  /** 主体魔物的模板 id。 */
  monsterId: string;
  maxHp: number;
  /** 心防由 `stats.empathy` 推出（见 v25），这里不再单独写。 */
  stats: Partial<Record<StatKey, number>>;
  phases: BossPhase[];
  reward: number;
  duration: number;
  recommendedLevel: number;
  color: string;
  /** 首只登场日；之后每 `defeatGapDays` 天来一次。 */
  firstDay: number;
  defeatGapDays: number;
  /** Boss 在场时，每天给九区各加的污染。 */
  pollutionPressure: number;
}

export interface BossState {
  id: string; appearedDay: number; lastTick: number; deadline: number;
  missionId: string; defeated?: boolean;
  /** 是哪只 Boss；旧存档缺省补首只的 id。 */
  template?: string;
  /** 这一轮里它还剩多少血：每场战斗后写回，下次接着打。 */
  hp?: number;
  maxHp?: number;
}
export interface DraftTrait {
  name: string;
  description: string;
  polarity: TraitPolarity;
}
export interface GirlDraft {
  name: string; codename: string; title: string; element: Element; archetype: Archetype;
  color: string; quote: string; goal: string;
  appearance: string; personality: string; outfitDescription: string;
  stats: Record<StatKey, number>; skillIds: string[]; traits: DraftTrait[];
  portrait?: string; portraitCrop?: CropBox; appearanceSpec?: PortraitSpec; portraitHint?: string;
  wardrobe?: Outfit[]; outfitId?: string; importedVariants?: Record<string, string>; witchForm?: Outfit;
  /** 出身；留空时由名字确定性生成。 */
  factionTag?: GirlFaction;
}

export interface GirlCard {
  format: 'night-sugar/girl-card'; version: 1; exportedAt: string; sourceDay: number; packHash?: string;
  girl: {
    name: string; codename: string; title: string; element: Element; archetype?: Archetype;
    color: string; quote?: string; goal: string; appearance: string; personality: string; outfitDescription: string;
    level: number; stats: Record<StatKey, number>; skillIds: string[]; traitIds: string[];
    /** 特性的完整定义。自定义特性（`custom-trait-*`）不在全局目录里，只能靠这份定义还原。 */
    traits?: Trait[];
    /** 只在导入时算出来：有多少条特性没能还原。导出不会写这个字段。 */
    skippedTraits?: number;
    portrait?: string; portraitSpec?: PortraitSpec; wardrobe?: Outfit[]; outfitId?: string; expression?: Expression;
    portraitHint?: string; witchForm?: Outfit; witchPersonality?: string; storyPlan?: StoryPlan; importedVariants?: Record<string, string>;
    /** 出身；旧卡没有时按名字确定性补齐。 */
    factionTag?: GirlFaction;
  };
}

export interface Trait {
  id: string; name: string; polarity: TraitPolarity; tags: string[];
  description: string; gainedAt?: string;
}
export interface Condition {
  id: string; name: string; kind: 'buff' | 'debuff'; source: string;
  description: string; remaining: number; removable: boolean;
  stat?: StatKey; amount?: number;
}
/** 议会决议的一项数值变化；负数表示需要支付或承受惩罚。 */
export type OpinionChange =
  | { kind: 'gold'; amount: number }
  | { kind: 'reputation'; amount: number }
  | { kind: 'faction'; faction: FactionId; amount: number }
  | { kind: 'item'; itemId: string; amount: number }
  | { kind: 'girl'; girlId: string; field: 'bond' | 'fatigue' | 'corruption' | 'hp'; amount: number }
  /** 推进时钟的分钟数；正数表示跳过/消耗这段时间。 */
  | { kind: 'minutes'; amount: number };

/** 议会决议的结构性结果；与数值变化分开，便于界面明确展示不可逆后果。 */
export type OpinionOutcome =
  | { kind: 'territory'; district: DistrictId; faction: FactionId }
  | { kind: 'mission'; template: MissionTemplate }
  | { kind: 'join'; level: number }
  | { kind: 'leave'; girlId: string };

/** 议会开场对白的一段；表情供后续立绘变化使用。 */
export interface OpinionDialogueLine {
  speakerId?: string;
  speaker: string;
  text: string;
  expression?: Expression;
}
export interface OpinionOption {
  id: 'accept' | 'defer' | 'reject'; label: string; effect: string;
  /** 批准的成本、驳回的惩罚，或通过后的收益。负数表示支付。 */
  changes?: OpinionChange[];
  /** 改变辖区、追加委托、新契约者入职或契约者离队。 */
  outcomes?: OpinionOutcome[];
  /** 接受这条提案会把哪个辖区交给哪个势力。 */
  shift?: { district: DistrictId; faction: FactionId };
}
export interface Opinion {
  id: string; day: number; authorId: string; topic: '经费' | '排班' | '设施' | '同伴' | '城市' | '私人心愿';
  title: string; text: string; request: string; status: 'pending' | 'accepted' | 'deferred' | 'rejected' | 'expired';
  options: OpinionOption[]; assistantNote?: string; storylineId?: string;
  /** 提出者的逐段对白；旧议题没有时按主题生成默认对白。 */
  dialogue?: OpinionDialogueLine[];
  /** 议题所属势力；暂缓与驳回会同步影响它的态度。 */
  faction?: FactionId;
  /** 暂缓后重新回到议事桌的日期。 */
  revisitDay?: number;
}
export interface Expedition {
  id: string; roomId: string; memberIds: string[];
  startedDay: number; startedMinutes: number; cyclesDone: number;
  lastSettledDay: number; lastSettledMinutes: number;
}

export interface StoryEffect {
  gold?: number; reputation?: number; bond?: number; corruption?: number;
  trait?: { name: string; description: string };
  /** 奖励技能：id 来自 content/skills。 */
  skill?: { id: string; name: string };
  /** 数值增长：直接加到少女的能力值上。 */
  growth?: Partial<Record<StatKey, number>>;
  /** 临时增益，落地为一条带剩余天数的 Condition。 */
  buff?: { name: string; description?: string; stat?: StatKey; amount?: number; days?: number };
  trigger?: StoryTrigger;
}
export interface StoryChoice {
  id: string; label: string; intent: string; effect: StoryEffect;
}
/** 故事线每一幕必须给出的委托目标；App 会据此生成特殊委托。 */
export interface StoryCompanion {
  name: string; codename: string; element: Element; archetype?: Archetype;
  appearance: string; personality: string; outfitDescription: string;
  color?: string; quote?: string;
}
export interface StoryMissionSpec {
  title: string; goal: string; category: string; difficulty: string;
  duration: number; district?: DistrictId; requirement?: StatKey; target?: number;
  /** 需先缔结契约、且必须编入小队的少女；给了 `companion` 会先落一位新候选者。 */
  requiredGirlId?: string;
  companion?: StoryCompanion;
  /** 这条委托会把它们登记进图鉴并作为对手。 */
  monsters?: MonsterTemplate[];
  /** 完成时发放的专属装备。 */
  rewardEquipment?: Equipment;
  /** 完成时立刻摆到桌上的强制事件。 */
  followUpIncident?: Incident;
  /** 完成时额外交付的角色事件钩子（排在常规剧情事件之后）。 */
  followUpEvent?: { title: string; hook: string };
}
export interface StoryBeat {
  id: string; index: number; title: string; summary: string; scene: string;
  hook: string; choices: StoryChoice[];
  resolvedChoiceId?: string; resolvedAt?: string;
  /** 这一幕要完成的委托；缺失时该幕按纯剧情推进。 */
  mission?: StoryMissionSpec;
  /** 已为该幕发出的委托 id。 */
  missionId?: string;
  /** 委托是否完成、剧情事件是否已生成。 */
  status?: 'locked' | 'open' | 'done';
  eventId?: string;
}
export interface Storyline {
  id: string; girlId: string; title: string; premise: string; tone: string;
  beats: StoryBeat[]; stage: number; status: 'active' | 'done' | 'abandoned';
  createdAt: string; day: number; source: 'llm' | 'template' | 'manual';
  /** 第几段故事（1 起，最多 3 段）。 */
  slot?: number;
  /** 上一段的 id：门禁靠它判断能不能开新的一段。 */
  requires?: string;
  /** 实际走到的结局标签，写进编年史。 */
  ending?: string;
  graph?: StoryGraph;
  run?: StoryRun;
}

export type StoryNodeKind =
  | 'start' | 'scene' | 'choice' | 'mission' | 'incident'
  | 'opinion' | 'event' | 'reward' | 'wait' | 'end';

export interface StoryIncidentSpec {
  kind: Incident['kind'];
  title: string; body: string;
  /** 从内容工坊的弹窗卡导入时记录来源；运行时优先按卡结算，找不到再回退手填内容。 */
  cardId?: string;
  faction?: FactionId; district?: DistrictId;
  options: { label: string; hint: string; effect: IncidentEffect }[];
}
export interface StoryOpinionSpec {
  topic: Opinion['topic']; title: string; text: string; request: string;
  options: { id: 'accept' | 'defer' | 'reject'; label: string; effect: string; shift?: { district: DistrictId; faction: FactionId } }[];
}

export type StoryNodeData =
  | { kind: 'start' }
  | { kind: 'scene'; narration: string; lines: { speaker: string; tone?: string; text: string }[] }
  | { kind: 'choice'; prompt?: string; options: { id: string; label: string; intent?: string; effect?: StoryEffect }[] }
  | { kind: 'mission'; spec: StoryMissionSpec }
  | { kind: 'incident'; spec: StoryIncidentSpec }
  | { kind: 'opinion'; spec: StoryOpinionSpec }
  | { kind: 'event'; title: string; hook: string }
  | { kind: 'reward'; effect: StoryEffect; equipmentId?: string; trait?: { name: string; description: string } }
  | { kind: 'wait'; days?: number; minutes?: number }
  | { kind: 'end'; summary?: string; ending?: string };

export interface StoryNode {
  id: string;
  kind: StoryNodeKind;
  x: number; y: number;
  title: string;
  note?: string;
  data: StoryNodeData;
}

export interface StoryEdge {
  id: string;
  from: string; fromPort: string;
  to: string;
}

export interface StoryGraph {
  version: 1;
  nodes: StoryNode[];
  edges: StoryEdge[];
  entry: string;
}

export type StoryWaitKind = 'mission' | 'incident' | 'opinion' | 'event' | 'choice' | 'wait';
export interface StoryRun {
  cursor: string;
  waiting?: { kind: StoryWaitKind; ref: string; until?: number };
  visited: string[];
  steps: number;
  stalled?: boolean;
}

export interface StoryPlan {
  title: string; premise: string; tone: string; beats: StoryBeat[];
  graph?: StoryGraph;
}
export interface IncidentEffect {
  gold?: number; reputation?: number;
  faction?: { id: FactionId; standing: number };
  girl?: { fatigue?: number; spirit?: number; corruption?: number; bond?: number };
  district?: { id: DistrictId; targetPct?: number; rewardPct?: number; untilDay: number };
  territory?: { id: DistrictId; faction: FactionId };
  /** 两张桌上的事可以推动或冷却两条势力之间的火气（夹在 ±9，模型来的 ±3）。 */
  hostility?: { pair: FactionPair; delta: number };
  missionId?: string;
}
export interface IncidentOption {
  id: string; label: string; hint: string; effect: IncidentEffect;
}
/** 弹窗的三种形态：纯通报、要拿主意、一段剧情。 */
export type IncidentCategory = 'report' | 'decision' | 'scene';

export type IncidentConditionField = 'reputation' | 'gold' | 'faction' | 'pollution' | 'bond' | 'fatigue' | 'day' | 'girlCount';

export interface IncidentCondition {
  field: IncidentConditionField;
  op: '<' | '<=' | '>' | '>=' | '==';
  value: number;
  faction?: FactionId;
  district?: DistrictId;
  girlId?: string;
}

export type IncidentTrigger =
  | { kind: 'dayStart' }
  | { kind: 'wave'; wave: number }
  | { kind: 'missionDone'; work?: WorkKind; district?: DistrictId }
  | { kind: 'condition'; all: IncidentCondition[] };

export interface IncidentSceneLine { speakerId?: string; speaker: string; tone?: string; text: string }

export interface IncidentScene {
  title: string; narration: string;
  lines: IncidentSceneLine[];
  /** 看完剧情的收尾效果，可以是空的。 */
  effect?: IncidentEffect;
}

export interface Incident {
  id: string; day: number; kind: 'faction' | 'environment' | 'girl';
  source: 'llm' | 'rule' | 'custom'; title: string; body: string;
  faction?: FactionId; girlId?: string; district?: DistrictId;
  options: IncidentOption[]; status: 'pending' | 'resolved' | 'expired'; storylineId?: string;
  choiceId?: string; resolvedAt?: string; cardId?: string;
  category?: IncidentCategory;
  trigger?: IncidentTrigger;
  /** 存活时长，缺省 240 分钟。 */
  ttlMinutes?: number;
  /** 绝对分钟（day * 1440 + minutes），到了还没处理就是过期。 */
  expiresAt?: number;
  expiredBy?: 'time' | 'superseded';
  scene?: IncidentScene;
  /** 投放这一条的模板 id，用来算冷却。 */
  templateId?: string;
}

/** 内置事件的模板：id + 触发 + 文案 + 选项，投放时快照成 Incident。 */
export interface IncidentTemplate {
  id: string;
  category: IncidentCategory;
  trigger: IncidentTrigger;
  title: string;
  body: string;
  kind?: Incident['kind'];
  options: IncidentOption[];
  scene?: IncidentScene;
  ttlMinutes?: number;
  /** 同一条模板多少天内不重复，缺省 7。 */
  cooldownDays?: number;
  /** 优先级大的先投放；战争预兆用 10。 */
  priority?: number;
}

/** 内容工坊里的弹窗事件卡；投放时快照成 Incident，之后删卡不会破坏存档。 */
export interface IncidentCardEffect extends Omit<IncidentEffect, 'district'> {
  district?: { id: DistrictId; targetPct?: number; rewardPct?: number; days: number };
}
export interface IncidentCardOption {
  id: string; label: string; hint: string; effect: IncidentCardEffect;
}
export interface IncidentCard {
  id: string; title: string; body: string; kind: Incident['kind'];
  faction?: FactionId; district?: DistrictId; girlId?: string;
  options: IncidentCardOption[];
  trigger: 'manual' | 'pool'; weight: number; oncePerDay: boolean;
  source: 'custom';
}
export type StoryTrigger =
  | { kind: 'mission'; title: string; description: string; district?: DistrictId; duration?: number }
  | { kind: 'opinion'; topic: Opinion['topic']; title: string; text: string; request: string; shift?: { district: DistrictId; faction: FactionId } }
  | { kind: 'incident'; incidentKind: Incident['kind']; title: string; body: string; options: IncidentOption[] }
  | { kind: 'event'; title: string; hook: string }
  | { kind: 'dialogue'; topic: string; prompt: string }
  | { kind: 'territory'; district: DistrictId; faction: FactionId };

export interface EventLine { speaker: string; tone?: string; text: string }
export interface EventScene {
  id: string; title: string; narration: string;
  lines: EventLine[]; choices?: StoryChoice[];
}
export interface StoryPassage {
  id: string;
  title?: string;
  narration: string;
  lines: { speaker: string; tone?: string; text: string }[];
  choices: { id: string; label: string; intent?: string; effect?: StoryEffect }[];
}
export interface CharacterEvent {
  id: string; girlId: string; storylineId?: string;
  title: string; hook: string; scenes: EventScene[];
  stage: number; status: 'active' | 'done' | 'abandoned';
  day: number; source: 'llm' | 'template'; badge: boolean;
  /** scenes = 旧的逐场事件；story = 分幕剧情，按 passageIndex 推进。 */
  mode?: 'scenes' | 'story';
  passages?: StoryPassage[];
  passageIndex?: number;
  chosen?: string[];
  summary?: string;
  pending?: boolean;
  storyNodeId?: string;
}
export interface PendingTalk { topic: string; prompt: string; day: number }

/** 诊所的一次治疗：按小时线性回血，期间不能派遣。 */
export interface Treatment {
  id: string; girlId: string;
  startedAt: number; endsAt: number;
  hpStart: number; hpTarget: number;
  paid: number; kink: boolean;
}

/** 技能效果的展示种类，只用于筛选与说明，不影响战斗结算。 */
export type EffectCategory = 'offense' | 'defense' | 'speed' | 'mind' | 'control' | 'sustain';
export interface SkillEffect {
  kind: EffectKind;
  stat?: StatKey | 'hit' | 'initiative';
  amount: number;
  duration: number;
  chance?: number;
  /** 套用的状态模板 id；手调效果可以没有。 */
  preset?: string;
  /** 状态模板的显示名，例如「锋芒增幅」。 */
  label?: string;
  /** 状态模板的种类，用于技能编辑器的筛选。 */
  category?: EffectCategory;
}
export interface Skill {
  id: string; name: string; school: string; resource: SkillResource; power: number;
  targets: number; side: SkillSide; cooldown: number; tier: SkillTier;
  effects: SkillEffect[]; description: string;
  /** 基础命中率（%）：不写就按目标数推导，见 `defaultSkillAccuracy`。 */
  accuracy?: number;
  /** 施放代价：按上限的百分比扣自己的资源，不会把自己扣死。 */
  selfCost?: { resource: SkillResource; pct: number } | null;
  /** 施放成功后挂到自己身上的效果，绕过命中判定。 */
  selfEffects?: SkillEffect[] | null;
}
export interface ActiveEffect extends SkillEffect {
  source: string; remaining: number;
}
export interface MonsterSpec {
  bodyPlan: 'moth' | 'feline' | 'humanoid' | 'machine' | 'swarm' | 'orb';
  scale: number; appendages: number; core: '眼' | '心' | '钟' | '糖' | '月';
  palette: { body: string; shade: string; rim: string };
  aura: '静电' | '余烬' | '花瓣' | '故障';
  motif: '猫' | '糖' | '星' | '月' | '蝶' | '钟';
}
export type MonsterRuleTrigger = 'roundStart' | 'hit' | 'always';
export type MonsterRuleEffect = 'heal' | 'buff' | 'haste' | 'debuffAttacker' | 'dot' | 'immuneStun' | 'damageReduce';
/** 魔物特性：把过去写死在战斗代码里的行为变成可编辑的数据。 */
export interface MonsterRule {
  trigger: MonsterRuleTrigger;
  effect: MonsterRuleEffect;
  amount?: number;
  stat?: StatKey | 'hit';
  duration?: number;
  /** 触发条件：血量低于该比例（0–1）。 */
  belowHpPct?: number;
  /** 本回合受到共情伤害时不触发。 */
  unlessEmpathyDamage?: boolean;
}
export interface MonsterTemplate {
  id: string; name: string; epithet: string; rank: '碎屑' | '游荡' | '灾厄' | '王座';
  element: Element; color: string; maxHp: number;
  /** v25 起由 `stats.empathy × 2` 算出，战斗只读共情；字段保留兼容旧存档与新内容包。 */
  maxSpirit: number;
  stats: Record<StatKey, number>; skillIds: string[];
  trait: string; description: string; spec: MonsterSpec;
  codex: { habit: string; weakness: string };
  rules?: MonsterRule[];
  /** 剧情专属：只在被显式引用时出场，不进随机抽取。 */
  storyOnly?: boolean;
  /** Boss 本体：只由 Boss 战引用，不进随机抽取。 */
  bossOnly?: boolean;
  /** Boss 技能组：第一阶段（hp ≥ 50%）用这组，缺省退回 skillIds。 */
  bossSkillIds?: string[];
  /** Boss 半血后换上的技能组。 */
  bossPhaseSkillIds?: string[];
  /** 完整的多阶段技能组（Boss 副本专用，战斗日志读阶段台词）。 */
  bossPhases?: BossPhase[];
}
export interface PortraitSpec {
  palette: { hair: string; hairShade: string; eye: string; cloth: string; clothShade: string; accent: string };
  hair: { style: number; length: 'short' | 'medium' | 'long'; bangs: number; ahoge: boolean; sideLocks: boolean };
  eyes: { shape: number; highlights: number; lash: number };
  outfit: { silhouette: number; collar: number; sleeve: number; ribbon: number; pattern: number };
  accessory: { head: number; ear: number; neck: number };
  expression: number; motif: '猫' | '糖' | '星' | '月' | '蝶' | '钟'; seed: number;
}
export interface Scar {
  id: string; name: string; kind: 'mental' | 'physical'; condition: string;
  description: string; effect: { kind: 'stat' | 'maxSpirit' | 'fatigueRecovery' | 'hit' | 'initiative'; stat?: StatKey; amount: number };
  maxHpLoss: number; gainedAt: string; missionId: string; fatal?: boolean;
}
export interface Girl {
  id: string; name: string; codename: string; title: string; element: Element; color: string; portrait: string;
  level: number; hp: number; maxHp: number; baseMaxHp: number; spirit: number; maxSpirit: number;
  fatigue: number; bond: number; exp: number;
  stats: Record<StatKey, number>; baseStats: Record<StatKey, number>; status: GirlStatus; roomId: string; remaining: number; missionId?: string;
  skill: string; skills: string[]; description: string; cost: number;
  scars: Scar[]; relationships: Record<string, number>; portraitSpec?: PortraitSpec;
  /** 立绘的 assets 键；有它就不必再背 dataURL。 */
  portraitAsset?: AssetId;
  /** 显示取景，缺省居中、zoom 1。 */
  portraitCrop?: CropBox;
  retired?: boolean; dead?: boolean; diedAt?: string; archetype?: Archetype; quote?: string;
  lastTalkDay?: number; talksToday?: number;
  goal: string; goalKind: GoalKind; traits: Trait[]; conditions: Condition[]; storyPlan?: StoryPlan;
  cloneOf?: string; generation?: number;
  clinicRest?: boolean;
  contractEndDay: number; contractDays: number; contractRenewals: number;
  retiredReason?: 'contract' | 'injury'; pensionMissed: number;
  /** 主动离职（与强制退休互斥）。 */
  left?: boolean; leftReason?: LeftReason; strain?: GirlStrain;
  /** 「再想想」给的宽限日：到了这一天还在状态里就直接走。 */
  graceUntilDay?: number;
  appearance: string; personality: string; outfitDescription: string;
  /** 魔女化后的性格记录；普通形态仍保留原性格。 */
  witchPersonality?: string;
  wardrobe: Outfit[]; outfitId: string; expression: Expression;
  /** 魔女形态礼装；独立于四格衣柜。 */
  witchForm?: Outfit;
  /** 立绘生成时的一句话参考。 */
  portraitHint?: string;
  /** 有进行中的特殊角色事件。 */
  eventBadge?: string;
  /** 故事线触发的「有话想说」。 */
  pendingTalk?: PendingTalk;
  corruption: number; witch?: boolean; drugUntilDay?: number; withdrawalDays?: number;
  equipment: { weapon?: string; charm?: string };
  importedVariants?: Record<string, string>;
  candidateUntilDay?: number; custom?: boolean; cardId?: string;
  /** 由覆灭势力雇佣来的首领。 */
  leader?: boolean;
  /** 开局编成时被选中的原班人马。 */
  starter?: boolean;
  /** 出身（协会/市役所/月蚀庭/无所属）；雇主固定是夜糖事务所，不记在这里。 */
  factionTag: GirlFaction;
}
export interface Memorial {
  girl: Girl; diedAt: string; cause: string; epitaph: string; lastBattleId: string;
}
export interface Mission {
  id: string; title: string; category: string; description: string; x: number; y: number;
  difficulty: string; duration: number; reward: number; requirement: StatKey; target: number;
  color: string; status: MissionStatus; girlId?: string; squad: string[];
  work: WorkKind; enemyIds?: string[]; rounds?: number; attempts: number; worsened?: boolean;
  lastOutcome?: 'victory' | 'repelled' | 'defeat' | 'draw'; generated?: boolean; sourcePack?: string;
  recommendedLevel: number; faction?: FactionId; envoy?: boolean; boss?: boolean;
  /** 所属辖区；缺省时由坐标反推。 */
  district?: DistrictId;
  /** 接受时限：紧急（短）或长期（整晚）。 */
  window?: CommissionWindow;
  /** 第几个时段放出（0 起）。 */
  wave?: number;
  /** 放出时刻与截止时刻，均为「日 × 1440 + 分钟」的绝对分钟。 */
  spawnedAt?: number;
  deadlineAt?: number;
  /** 长期委托跨几个业务日（2–7）。 */
  longDays?: number;
  /** 由角色故事线生成的委托。 */
  storylineId?: string;
  /** 对应故事线的具体一幕。 */
  storyBeatId?: string;
  /** 这一幕要达成的目标，显示在委托详情里。 */
  storyGoal?: string;
  /** 必须编入小队的少女（故事线指定同行者）。 */
  requiredGirlId?: string;
  /** 完成后发放的专属装备 id（已登记进物品表）。 */
  rewardEquipmentId?: string;
  /** 完成后免费加入事务所的契约者等级；0 或未设置表示没有这项奖励。 */
  rewardGirlLevel?: number;
  /** 由内容工坊的委托模板生成时，记录来源模板 id，便于删除前检查引用。 */
  templateId?: string;
  /** 派遣时冻结的环境修正：静态地形 + 当主效果 + 污染。之后易主不再改变。 */
  environment?: DistrictEffect;
  /** 派遣时的污染度，用于详情与战报显示。 */
  pollutionAtSpawn?: number;
  /** 派遣时的辖区当主；净化口径与拦截判定都用它，不用当前当主。 */
  ownerAtSpawn?: FactionId;
  /** 结算时被辖区当主的所属少女拦截。 */
  interception?: Interception;
  /** 与 `enemyIds` 下标对齐的精英 buff；null 表示这只不是精英。 */
  enemyBuffs?: (string | null)[];
  /** 与 `enemyIds` 下标对齐的血量覆盖（Boss 消耗战续血）。 */
  enemyHpOverride?: number[];
  /** 难度由辖区污染度抽出来时，记下模板原本的档位，方便工坊与战报回看。 */
  scaledFrom?: string;
  /** 战斗模板只写要几只敌人，具体是哪些由 `rollEnemies` 按辖区与难度抽。 */
  enemyCount?: number;
}
/** 辖区拦截战：辖区当主态度为「戒备」时，普通委托会被自己的少女截下。 */
export interface Interception {
  faction: FactionId;
  girlIds: string[];
  outcome?: 'win' | 'loss';
}
/** 内容工坊里的干净委托模板；注册时再转成带坐标与时限的委托快照。 */
export interface MissionTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  difficulty: '低危' | '中危' | '高危' | '绝望';
  duration: number;
  requirement: StatKey;
  target: number;
  work: WorkKind;
  enemyIds: string[];
  rounds: number;
  recommendedLevel: number;
  district?: DistrictId;
  window?: CommissionWindow;
  reward: number;
  /** 额外报酬：完成时发放的装备 id；空表示没有。 */
  rewardEquipmentId?: string;
  /** 额外报酬：完成时免费加入的契约者等级；0 或未设置表示没有。 */
  rewardGirlLevel?: number;
  color: string;
}
export interface Room { id: string; name: string; type: 'lounge' | 'clinic' | 'dorm' | 'observatory'; level: number; capacity: number; description: string }
export interface Log { id: string; time: string; kind: 'dispatch' | 'finance' | 'care' | 'story' | 'base' | 'battle' | 'relationship' | 'memorial' | 'council' | 'expedition' | 'clinic' | 'incident' | 'territory'; text: string; delta?: number }
export interface Sample { day: number; income: number; expense: number; reputation: number }
export interface Message { role: 'girl' | 'player' | 'system'; text: string }

export interface BattleUnit {
  uid: string; side: 'ally' | 'enemy'; name: string; portrait: string; color: string;
  hp: number; maxHp: number; spirit: number; maxSpirit: number;
  stats: Record<StatKey, number>; skills: string[]; cooldown: Record<string, number>;
  effects: ActiveEffect[]; down: boolean; insightRoll: number; scarHit: number;
  dealt: number; taken: number; healed: number; controlled: number; kills: number;
  damageBonus?: number; initiativeBonus?: number;
  monster?: MonsterTemplate;
  /** 有名字、可成为叙事说话者的角色；敌方魔法少女也会带这个字段。 */
  girlId?: string;
  /** Boss 阶段：1 是开场那套招式，2 是半血后换上来的那套。 */
  phase?: number;
  codename?: string;
  expression?: Expression;
  portraitSpec?: PortraitSpec;
  /** 心防已被打穿：本场不再恢复，共情伤害转成血量伤害。 */
  spiritBroken?: boolean;
}
export interface BattleCalc {
  hit?: { base: number; agility: number; targetAgility: number; bonus: number; chance: number; roll: number };
  damage?: { magic: number; power: number; variance: number; mitigation: number; raw: number; shield: number; dealt: number };
  heal?: { magic: number; power: number; raw: number; capped: number };
}
export interface BattleEvent {
  round: number; at: { day: number; minutes: number }; actor: string; skillId: string; skillName: string;
  targets: string[]; hit: boolean; resource?: SkillResource; amount?: number; effects?: string[]; note?: string; calc?: BattleCalc;
}
export interface BattleState {
  id: string; missionId: string; missionTitle: string; seed: number;
  startedAt: { day: number; minutes: number };
  round: number; rounds: number; units: BattleUnit[]; initiative: string[];
  events: BattleEvent[]; outcome?: 'victory' | 'repelled' | 'defeat' | 'draw';
  /** 判负的原因：`stunned` 是全队被打得踉跄，`wounded` 是血量归零。疤痕取法不同。 */
  defeatReason?: 'stunned' | 'wounded';
  frames?: { round: number; units: BattleUnit[]; initiative: string[] }[];
  rewards?: { gold: number; exp: number; bond: number };
  scars?: Scar[]; fatal?: string[]; createdAt: string;
  /** 这一战发生时辖区的污染等级，只用于战报摘要；旧战报没有这一项。 */
  pollution?: number;
}
export interface BattleNoteLine {
  round: number;
  speakerSide: 'ally' | 'enemy';
  speakerId: string;
  expression: Expression;
  text: string;
  mode?: 'speech' | 'thought';
}
export interface BattleNoteScene {
  id: string;
  roundFrom: number;
  roundTo: number;
  title: string;
  narration: string;
  lines: BattleNoteLine[];
}
export interface BattleNote {
  battleId: string;
  title: string;
  hook: string;
  summary: string;
  scenes: BattleNoteScene[];
  source: 'llm' | 'template';
  charCount: number;
  createdAt: string;
  model?: string;
  presetId?: string;
}
export interface ContentPack {
  id: string; hash: string; schemaVersion: 3; promptVersion: string; source: 'seed' | 'generated';
  createdAt: string; palette: { ink: string; rose: string; blush: string; mist: string; frost: string };
  girls: Girl[]; monsters: MonsterTemplate[]; skills: Skill[]; missions: Mission[];
  traits?: Trait[];
  notes: string;
}
export interface FactionState {
  standing: number; stockDay: number; envoyDay: number; envoyTaskId?: string;
}
export interface MarketStockEntry {
  id: string; itemId: string; faction: FactionId; sold: boolean;
}
export interface ChronicleEntry {
  id: string; day: number; at: string; kind: '魔物' | '少女' | '事件' | '议程' | '代表' | '登记' | '辖区' | '关系';
  title: string; summary: string;
}
export interface TerritoryShift { day: number; minutes: number; district: DistrictId; from: FactionId; to: FactionId }
export interface ShiftState { day: number; wave: number }
/** 九区污染度，0–100。 */
export type PollutionMap = Record<DistrictId, number>;
export interface GameState {
  version: 18; day: number; minutes: number; gold: number; reputation: number;
  girls: Girl[]; candidates: Girl[]; missions: Mission[]; rooms: Room[];
  logs: Log[]; samples: Sample[]; completed: string[]; messages: Record<string, Message[]>;
  memorial: Memorial[]; battles: BattleState[]; battleNotes?: BattleNote[]; packHash: string;
  assistantId?: string; opinions: Opinion[]; expeditions: Expedition[]; councilDay: number;
  pensionDebt: number;
  factions: Record<FactionId, FactionState>; inventory: Record<string, number>;
  marketStock: MarketStockEntry[];
  poolLimits: { missions: number; monsters: number; candidates: number }; removedMonsters: string[];
  marketLevel: number; marketDay: number; advancedDay?: number;
  boss: BossState | null; bossCycle: number; nextBossDay: number;
  /** 本轮循环的起始日：Boss 被击败当天重置，污染地板按 day − cycleStartDay 算。 */
  cycleStartDay: number;
  customSkills: Skill[];
  customMonsters: MonsterTemplate[];
  /** 内容工坊自建的 Boss 模板。 */
  customBosses: BossTemplate[];
  /** 故事引擎一次性生成并持久化的装备；读档时重新登记进物品表。 */
  generatedItems: Equipment[];
  chronicle: ChronicleEntry[];
  /** 当晚委托时段已经放到第几个。 */
  shift: ShiftState;
  /** 九辖区归属；每格必须有主。 */
  territories: Record<DistrictId, FactionId>;
  /** 最近 10 次易主。 */
  territoryLog: TerritoryShift[];
  incidents: Incident[];
  /** 叙事者提前写好、还没投放的弹窗。 */
  incidentPool: Incident[];
  /** 弹窗编号自增，保证 id 不撞。 */
  incidentSeq: number;
  /** 模板 id → 上次投放的 day，用来算冷却。 */
  incidentCooldowns: Record<string, number>;
  storylines: Storyline[];
  events: CharacterEvent[];
  /** 进行中的诊所治疗。 */
  treatments: Treatment[];
  /** 空白档案开局。 */
  blank?: boolean;
  /** 九区污染度，0–100；每天自然上升，完成委托下降。 */
  pollution: PollutionMap;
  /** 三方两两之间的敌意值。 */
  hostility: Record<FactionPair, HostilityTrack>;
  /** 正在打或打过的战线。 */
  fronts: FactionFront[];
  /** 开战史：同一对 10 天内不再打。 */
  warHistory: WarRecord[];
  /** 事务所档案：玩家可改的背景/理念/目标。 */
  office: OfficeProfile;
  /** 开场三幕是否已经看过；跳过也算看过，否则每次刷新都会再弹。 */
  prologueSeen: boolean;
  /** 三方阵容：每方现任首领与随从，开局编成时确定。 */
  factionRoster: Record<FactionId, FactionRoster>;
  /** 被编进势力的自定义首领快照；与 `factionRoster` 只存 id 相对，这里存全量数据。 */
  customFactionLeaders: FactionLeader[];
  /** 被编进势力的自定义随从快照。 */
  customFactionGirls: FactionGirl[];
  /** 开局编成是否已完成。 */
  startersPicked: boolean;
}
export type GameAction =
  | { type: 'dispatch'; girlIds: string[]; missionId: string }
  | { type: 'care'; girlId: string; mode: 'resting' }
  | { type: 'advance'; minutes: number }
  | { type: 'hire'; girlId: string }
  | { type: 'build'; roomId?: string }
  | { type: 'talk'; girlId: string; text: string; remote?: boolean; reply?: string }
  | { type: 'retire'; girlId: string }
  | { type: 'renewContract'; girlId: string }
  | { type: 'rehire'; girlId: string }
  | { type: 'setAssistant'; girlId?: string }
  | { type: 'setOfficeProfile'; profile: OfficeProfile }
  | { type: 'seenPrologue' }
  | {
      type: 'setStarters';
      girlIds: string[];
      roster: Record<FactionId, FactionRoster>;
      /** 编进势力的自定义少女快照（契约卡库/名册里的人也可以被编成）。 */
      customLeaders?: FactionLeader[];
      customGirls?: FactionGirl[];
    }
  | { type: 'hireLeader'; leaderId: string }
  | { type: 'joinFront'; frontId: string; side: 'attacker' | 'defender'; girlIds: string[] }
  | { type: 'decideOpinion'; opinionId: string; decision: 'accept' | 'defer' | 'reject' }
  | { type: 'startExpedition'; memberIds: string[] }
  | { type: 'recallExpedition'; expeditionId: string }
  | { type: 'clinic'; girlId: string; mode: 'treat' | 'wipe' | 'clone' | 'clear'; kink?: boolean; clearScarId?: string }
  | { type: 'changeOutfit'; girlId: string; outfitId: string }
  | { type: 'setExpression'; girlId: string; expression: Expression }
  | { type: 'setPersonality'; girlId: string; text: string }
  | { type: 'buyItem'; itemId?: string; stockId?: string }
  | { type: 'setPoolLimit'; pool: 'missions' | 'monsters' | 'candidates'; value: number }
  | { type: 'deleteMission'; missionId: string }
  | { type: 'deleteCandidate'; girlId: string }
  | { type: 'deleteMonster'; monsterId: string }
  | { type: 'addGeneratedContent'; monster: MonsterTemplate; girl: Girl; mission: Mission; opinion?: Opinion; envoyMission?: Mission; items?: Equipment[] }
  | { type: 'equipItem'; girlId: string; itemId: string; slot: 'weapon' | 'charm' }
  | { type: 'unequipItem'; girlId: string; slot: 'weapon' | 'charm' }
  | { type: 'useItem'; girlId: string; itemId: string }
  | { type: 'acceptFactionTask'; faction: FactionId }
  | { type: 'upgradeMarket' }
  | { type: 'advancedRecruit'; level: number }
  | { type: 'createGirl'; draft: GirlDraft }
  | { type: 'importCard'; card: GirlCard }
  /** 卡库一次交上来一叠，逐张走 importCard 的登记逻辑。 */
  | { type: 'importCards'; cards: GirlCard[] }
  | { type: 'setVariant'; girlId: string; key: string; dataUrl: string }
  | { type: 'setVariants'; girlId: string; variants: Record<string, string> }
  | { type: 'deleteVariant'; girlId: string; key: string }
  | { type: 'endNight' }
  | { type: 'importWardrobe'; girlId: string; outfits: Outfit[]; outfitId?: string; mode?: 'merge' | 'replace'; source?: string }
  | { type: 'removeOutfit'; girlId: string; outfitId: string }
  | { type: 'renameOutfit'; girlId: string; outfitId: string; name: string; description?: string }
  | { type: 'setOutfitDescription'; girlId: string; outfitId: string; description: string }
  | { type: 'setWitchForm'; girlId: string; outfit: Outfit | null; activate?: boolean; personality?: string }
  | { type: 'clearWitchForm'; girlId: string }
  | { type: 'addIncident'; incident: Incident }
  /** 模型生成的一批弹窗，进待用池（由 game 侧洗数据）。 */
  | { type: 'mergeIncidentPool'; entries: unknown[] }
  | { type: 'resolveIncident'; incidentId: string; optionId?: string }
  | { type: 'startStoryline'; girlId: string; direction?: string }
  | { type: 'setStoryPlan'; girlId: string; plan: StoryPlan | null }
  | { type: 'addStoryline'; storyline: Storyline }
  | { type: 'decideStoryChoice'; storylineId: string; beatId: string; choiceId: string }
  | { type: 'advanceStoryline'; storylineId: string }
  | { type: 'addCharacterEvent'; event: CharacterEvent }
  | { type: 'startCharacterEvent'; eventId: string }
  | { type: 'advanceEvent'; eventId: string }
  | { type: 'beginStoryEvent'; eventId: string; passages: StoryPassage[]; summary?: string }
  | { type: 'chooseStoryPassage'; eventId: string; choiceId: string }
  | { type: 'chooseStoryPort'; storylineId: string; port: string }
  | { type: 'resolveEvent'; eventId: string; choiceId: string }
  | { type: 'saveBattleNote'; note: BattleNote }
  | { type: 'deleteBattleNote'; battleId: string }
  | { type: 'reset'; mode?: 'standard' | 'blank' };
export interface ActionResult { state: GameState; ok: boolean; message: string; battle?: BattleState }
