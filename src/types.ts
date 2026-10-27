import type { DistrictId } from './districts';
import type { CommissionWindow } from './shift';

export type StatKey = 'magic' | 'insight' | 'agility' | 'empathy';
export type Element = '星光系' | '糖霜系' | '月影系' | '梦境系' | '自然系' | '赤焰系' | '魔物';
export type Archetype = '输出' | '守护' | '控制' | '治愈' | '侦查' | '魔物';
export type GirlStatus = 'idle' | 'mission' | 'healing' | 'resting' | 'retired' | 'expedition';
export type WorkKind = 'combat' | 'investigation';
export type MissionStatus = 'open' | 'active' | 'done' | 'expired';
export type GoalKind = '战斗' | '调查' | '社交' | '生活' | '成长';
export type SkillResource = 'hp' | 'spirit';
export type SkillSide = 'enemy' | 'ally' | 'self';
export type SkillTier = 'basic' | 'signature' | 'ultimate';
export type EffectKind = 'dot' | 'stun' | 'shield' | 'buff' | 'debuff' | 'regen';
export type TraitPolarity = 'positive' | 'negative' | 'neutral';
export type Expression = 'calm' | 'smile' | 'surprise' | 'sad' | 'angry' | 'shy';
export type FactionId = 'witch' | 'association' | 'government';
export type OutfitForm = 'normal' | 'witch';
export interface Outfit {
  id: string; name: string; description: string;
  palette: string[]; layerKey: string;
  /** 礼装形态：普通礼装或魔女形态。 */
  form?: OutfitForm;
  /** 这套衣服专属的立绘（data URL）。有它就不再走程序化立绘。 */
  portrait?: string;
  /** 与立绘同批生成的外形规格，用于头像/详情页。 */
  portraitSpec?: PortraitSpec;
  /** 来自角色卡或衣柜包，导出时原样带走。 */
  imported?: boolean;
  /** 自定义礼装：立绘沿用本人的 `girl.portrait`。 */
  custom?: boolean;
}
export interface Equipment {
  id: string; name: string; faction: FactionId; slot: 'weapon' | 'charm' | 'consumable';
  price: number; standingReq: number; description: string;
  stats?: Partial<Record<StatKey, number>>;
  passive?: string; skillId?: string; corruptionPerBattle?: number;
  maxHpBonus?: number; spiritBonus?: number; damageBonus?: number; initiativeBonus?: number;
  effect?: 'drug' | 'heal' | 'purify' | 'contractDiscount' | 'taxRefund';
  amount?: number;
}
export interface BossState {
  id: string; appearedDay: number; lastTick: number; deadline: number;
  missionId: string; defeated?: boolean;
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
  portrait?: string; appearanceSpec?: PortraitSpec; portraitHint?: string;
}

export interface GirlCard {
  format: 'night-sugar/girl-card'; version: 1; exportedAt: string; sourceDay: number; packHash?: string;
  girl: {
    name: string; codename: string; title: string; element: Element; archetype?: Archetype;
    color: string; quote?: string; goal: string; appearance: string; personality: string; outfitDescription: string;
    level: number; stats: Record<StatKey, number>; skillIds: string[]; traitIds: string[];
    portrait?: string; portraitSpec?: PortraitSpec; wardrobe?: Outfit[]; outfitId?: string; expression?: Expression;
    portraitHint?: string; witchForm?: Outfit; storyPlan?: StoryPlan;
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
export interface OpinionOption {
  id: 'accept' | 'defer' | 'reject'; label: string; effect: string;
  /** 接受这条提案会把哪个辖区交给哪个势力。 */
  shift?: { district: DistrictId; faction: FactionId };
}
export interface Opinion {
  id: string; day: number; authorId: string; topic: '经费' | '排班' | '设施' | '同伴' | '城市' | '私人心愿';
  title: string; text: string; request: string; status: 'pending' | 'accepted' | 'deferred' | 'rejected' | 'expired';
  options: OpinionOption[]; assistantNote?: string; storylineId?: string;
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
  graph?: StoryGraph;
  run?: StoryRun;
}

export type StoryNodeKind =
  | 'start' | 'scene' | 'choice' | 'mission' | 'incident'
  | 'opinion' | 'event' | 'reward' | 'wait' | 'end';

export interface StoryIncidentSpec {
  kind: Incident['kind'];
  title: string; body: string;
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
  | { kind: 'end'; summary?: string };

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
  missionId?: string;
}
export interface IncidentOption {
  id: string; label: string; hint: string; effect: IncidentEffect;
}
export interface Incident {
  id: string; day: number; kind: 'faction' | 'environment' | 'girl';
  source: 'llm' | 'rule' | 'custom'; title: string; body: string;
  faction?: FactionId; girlId?: string; district?: DistrictId;
  options: IncidentOption[]; status: 'pending' | 'resolved'; storylineId?: string;
  choiceId?: string; resolvedAt?: string; cardId?: string;
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

export interface SkillEffect {
  kind: EffectKind;
  stat?: StatKey | 'hit' | 'initiative';
  amount: number;
  duration: number;
  chance?: number;
}
export interface Skill {
  id: string; name: string; school: string; resource: SkillResource; power: number;
  targets: number; side: SkillSide; cooldown: number; tier: SkillTier;
  effects: SkillEffect[]; description: string;
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
  element: Element; color: string; maxHp: number; maxSpirit: number;
  stats: Record<StatKey, number>; skillIds: string[];
  trait: string; description: string; spec: MonsterSpec;
  codex: { habit: string; weakness: string };
  rules?: MonsterRule[];
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
  retired?: boolean; dead?: boolean; diedAt?: string; archetype?: Archetype; quote?: string;
  lastTalkDay?: number; talksToday?: number;
  goal: string; goalKind: GoalKind; traits: Trait[]; conditions: Condition[]; storyPlan?: StoryPlan;
  cloneOf?: string; generation?: number;
  clinicRest?: boolean;
  contractEndDay: number; contractDays: number; contractRenewals: number;
  retiredReason?: 'contract' | 'injury'; pensionMissed: number;
  appearance: string; personality: string; outfitDescription: string;
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
  /** 由内容工坊的委托模板生成时，记录来源模板 id，便于删除前检查引用。 */
  templateId?: string;
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
  monster?: MonsterTemplate;
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
  frames?: { round: number; units: BattleUnit[]; initiative: string[] }[];
  rewards?: { gold: number; exp: number; bond: number };
  scars?: Scar[]; fatal?: string[]; createdAt: string;
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
export interface GameState {
  version: 10; day: number; minutes: number; gold: number; reputation: number;
  girls: Girl[]; candidates: Girl[]; missions: Mission[]; rooms: Room[];
  logs: Log[]; samples: Sample[]; completed: string[]; messages: Record<string, Message[]>;
  memorial: Memorial[]; battles: BattleState[]; packHash: string;
  assistantId?: string; opinions: Opinion[]; expeditions: Expedition[]; councilDay: number;
  pensionDebt: number;
  factions: Record<FactionId, FactionState>; inventory: Record<string, number>;
  marketStock: MarketStockEntry[];
  poolLimits: { missions: number; monsters: number; candidates: number }; removedMonsters: string[];
  marketLevel: number; marketDay: number; advancedDay?: number;
  boss: BossState | null; bossCycle: number; nextBossDay: number;
  customSkills: Skill[];
  customMonsters: MonsterTemplate[];
  chronicle: ChronicleEntry[];
  /** 当晚委托时段已经放到第几个。 */
  shift: ShiftState;
  /** 九辖区归属；每格必须有主。 */
  territories: Record<DistrictId, FactionId>;
  /** 最近 10 次易主。 */
  territoryLog: TerritoryShift[];
  incidents: Incident[];
  storylines: Storyline[];
  events: CharacterEvent[];
  /** 进行中的诊所治疗。 */
  treatments: Treatment[];
  /** 空白档案开局。 */
  blank?: boolean;
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
  | { type: 'decideOpinion'; opinionId: string; decision: 'accept' | 'defer' | 'reject' }
  | { type: 'startExpedition'; memberIds: string[] }
  | { type: 'recallExpedition'; expeditionId: string }
  | { type: 'clinic'; girlId: string; mode: 'treat' | 'wipe' | 'clone'; kink?: boolean }
  | { type: 'changeOutfit'; girlId: string; outfitId: string }
  | { type: 'setExpression'; girlId: string; expression: Expression }
  | { type: 'buyItem'; itemId?: string; stockId?: string }
  | { type: 'setPoolLimit'; pool: 'missions' | 'monsters' | 'candidates'; value: number }
  | { type: 'deleteMission'; missionId: string }
  | { type: 'deleteCandidate'; girlId: string }
  | { type: 'deleteMonster'; monsterId: string }
  | { type: 'addGeneratedContent'; monster: MonsterTemplate; girl: Girl; mission: Mission; opinion?: Opinion; envoyMission?: Mission }
  | { type: 'equipItem'; girlId: string; itemId: string; slot: 'weapon' | 'charm' }
  | { type: 'unequipItem'; girlId: string; slot: 'weapon' | 'charm' }
  | { type: 'useItem'; girlId: string; itemId: string }
  | { type: 'acceptFactionTask'; faction: FactionId }
  | { type: 'upgradeMarket' }
  | { type: 'advancedRecruit'; level: number }
  | { type: 'createGirl'; draft: GirlDraft }
  | { type: 'importCard'; card: GirlCard }
  | { type: 'setVariant'; girlId: string; key: string; dataUrl: string }
  | { type: 'endNight' }
  | { type: 'importWardrobe'; girlId: string; outfits: Outfit[]; outfitId?: string; mode?: 'merge' | 'replace'; source?: string }
  | { type: 'removeOutfit'; girlId: string; outfitId: string }
  | { type: 'renameOutfit'; girlId: string; outfitId: string; name: string; description?: string }
  | { type: 'setWitchForm'; girlId: string; outfit: Outfit | null }
  | { type: 'addIncident'; incident: Incident }
  | { type: 'resolveIncident'; incidentId: string; optionId: string }
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
  | { type: 'reset'; mode?: 'standard' | 'blank' };
export interface ActionResult { state: GameState; ok: boolean; message: string; battle?: BattleState }
