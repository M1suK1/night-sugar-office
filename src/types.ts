export type StatKey = 'magic' | 'insight' | 'agility' | 'empathy';
export type Element = '星光系' | '糖霜系' | '月影系' | '梦境系' | '自然系' | '赤焰系' | '魔物';
export type Archetype = '输出' | '守护' | '控制' | '治愈' | '侦查' | '魔物';
export type GirlStatus = 'idle' | 'mission' | 'healing' | 'resting' | 'retired' | 'expedition';
export type WorkKind = 'combat' | 'investigation';
export type GoalKind = '战斗' | '调查' | '社交' | '生活' | '成长';
export type SkillResource = 'hp' | 'spirit';
export type SkillSide = 'enemy' | 'ally' | 'self';
export type SkillTier = 'basic' | 'signature' | 'ultimate';
export type EffectKind = 'dot' | 'stun' | 'shield' | 'buff' | 'debuff' | 'regen';
export type TraitPolarity = 'positive' | 'negative' | 'neutral';
export type Expression = 'calm' | 'smile' | 'surprise' | 'sad' | 'angry' | 'shy';
export type FactionId = 'witch' | 'association' | 'government';
export interface Outfit {
  id: string; name: string; description: string;
  palette: string[]; layerKey: string;
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
export interface GirlDraft {
  name: string; codename: string; title: string; element: Element; archetype: Archetype;
  color: string; quote: string; goal: string;
  appearance: string; personality: string; outfitDescription: string;
  stats: Record<StatKey, number>; skillIds: string[]; traits: string[];
  portrait?: string; appearanceSpec?: PortraitSpec;
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
}
export interface Opinion {
  id: string; day: number; authorId: string; topic: '经费' | '排班' | '设施' | '同伴' | '城市' | '私人心愿';
  title: string; text: string; request: string; status: 'pending' | 'accepted' | 'deferred' | 'rejected' | 'expired';
  options: OpinionOption[]; assistantNote?: string;
}
export interface Expedition {
  id: string; roomId: string; memberIds: string[];
  startedDay: number; startedMinutes: number; cyclesDone: number;
  lastSettledDay: number; lastSettledMinutes: number;
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
export interface MonsterTemplate {
  id: string; name: string; epithet: string; rank: '碎屑' | '游荡' | '灾厄' | '王座';
  element: Element; color: string; maxHp: number; maxSpirit: number;
  stats: Record<StatKey, number>; skillIds: string[];
  trait: string; description: string; spec: MonsterSpec;
  codex: { habit: string; weakness: string };
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
  goal: string; goalKind: GoalKind; traits: Trait[]; conditions: Condition[];
  cloneOf?: string; generation?: number;
  clinicRest?: boolean;
  contractEndDay: number; contractDays: number; contractRenewals: number;
  retiredReason?: 'contract' | 'injury'; pensionMissed: number;
  appearance: string; personality: string; outfitDescription: string;
  wardrobe: Outfit[]; outfitId: string; expression: Expression;
  corruption: number; witch?: boolean; drugUntilDay?: number; withdrawalDays?: number;
  equipment: { weapon?: string; charm?: string };
  importedVariants?: Record<string, string>;
  candidateUntilDay?: number; custom?: boolean;
}
export interface Memorial {
  girl: Girl; diedAt: string; cause: string; epitaph: string; lastBattleId: string;
}
export interface Mission {
  id: string; title: string; category: string; description: string; x: number; y: number;
  difficulty: string; duration: number; reward: number; requirement: StatKey; target: number;
  color: string; status: 'open' | 'active' | 'done'; girlId?: string; squad: string[];
  work: WorkKind; enemyIds?: string[]; rounds?: number; attempts: number; worsened?: boolean;
  lastOutcome?: 'victory' | 'repelled' | 'defeat' | 'draw'; generated?: boolean; sourcePack?: string;
  recommendedLevel: number; faction?: FactionId; envoy?: boolean; boss?: boolean;
}
export interface Room { id: string; name: string; type: 'lounge' | 'clinic' | 'dorm' | 'observatory'; level: number; capacity: number; description: string }
export interface Log { id: string; time: string; kind: 'dispatch' | 'finance' | 'care' | 'story' | 'base' | 'battle' | 'relationship' | 'memorial' | 'council' | 'expedition' | 'clinic'; text: string; delta?: number }
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
export interface GameState {
  version: 6; day: number; minutes: number; gold: number; reputation: number;
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
}
export type GameAction =
  | { type: 'dispatch'; girlIds: string[]; missionId: string }
  | { type: 'care'; girlId: string; mode: 'healing' | 'resting' }
  | { type: 'advance'; minutes: number }
  | { type: 'hire'; girlId: string }
  | { type: 'build'; roomId?: string }
  | { type: 'talk'; girlId: string; text: string; remote?: boolean }
  | { type: 'retire'; girlId: string }
  | { type: 'renewContract'; girlId: string }
  | { type: 'rehire'; girlId: string }
  | { type: 'setAssistant'; girlId?: string }
  | { type: 'decideOpinion'; opinionId: string; decision: 'accept' | 'defer' | 'reject' }
  | { type: 'startExpedition'; memberIds: string[] }
  | { type: 'recallExpedition'; expeditionId: string }
  | { type: 'clinic'; girlId: string; mode: 'heal' | 'rest' | 'wipe' | 'clone' }
  | { type: 'changeOutfit'; girlId: string; outfitId: string }
  | { type: 'setExpression'; girlId: string; expression: Expression }
  | { type: 'buyItem'; itemId?: string; stockId?: string }
  | { type: 'setPoolLimit'; pool: 'missions' | 'monsters' | 'candidates'; value: number }
  | { type: 'deleteMission'; missionId: string }
  | { type: 'deleteCandidate'; girlId: string }
  | { type: 'deleteMonster'; monsterId: string }
  | { type: 'addGeneratedContent'; monster: MonsterTemplate; girl: Girl; mission: Mission }
  | { type: 'equipItem'; girlId: string; itemId: string; slot: 'weapon' | 'charm' }
  | { type: 'unequipItem'; girlId: string; slot: 'weapon' | 'charm' }
  | { type: 'useItem'; girlId: string; itemId: string }
  | { type: 'acceptFactionTask'; faction: FactionId }
  | { type: 'upgradeMarket' }
  | { type: 'advancedRecruit'; level: number }
  | { type: 'createGirl'; draft: GirlDraft }
  | { type: 'setVariant'; girlId: string; key: string; dataUrl: string }
  | { type: 'reset' };
export interface ActionResult { state: GameState; ok: boolean; message: string; battle?: BattleState }
