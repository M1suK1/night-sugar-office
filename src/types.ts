export type StatKey = 'magic' | 'insight' | 'agility' | 'empathy';
export type Element = '星光系' | '糖霜系' | '月影系' | '梦境系' | '自然系' | '赤焰系' | '魔物';
export type Archetype = '输出' | '守护' | '控制' | '治愈' | '侦查' | '魔物';
export type GirlStatus = 'idle' | 'mission' | 'healing' | 'resting' | 'retired';
export type WorkKind = 'combat' | 'investigation';
export type SkillResource = 'hp' | 'spirit';
export type SkillSide = 'enemy' | 'ally' | 'self';
export type SkillTier = 'basic' | 'signature' | 'ultimate';
export type EffectKind = 'dot' | 'stun' | 'shield' | 'buff' | 'debuff' | 'regen';

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
  stats: Record<StatKey, number>; status: GirlStatus; roomId: string; remaining: number; missionId?: string;
  skill: string; skills: string[]; description: string; cost: number;
  scars: Scar[]; relationships: Record<string, number>; appearance?: PortraitSpec;
  retired?: boolean; dead?: boolean; diedAt?: string; archetype?: Archetype; quote?: string;
  lastTalkDay?: number; talksToday?: number;
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
}
export interface Room { id: string; name: string; type: 'lounge' | 'clinic' | 'dorm' | 'observatory'; level: number; capacity: number; description: string }
export interface Log { id: string; time: string; kind: 'dispatch' | 'finance' | 'care' | 'story' | 'base' | 'battle' | 'relationship' | 'memorial'; text: string; delta?: number }
export interface Sample { day: number; income: number; expense: number; reputation: number }
export interface Message { role: 'girl' | 'player' | 'system'; text: string }

export interface BattleUnit {
  uid: string; side: 'ally' | 'enemy'; name: string; portrait: string; color: string;
  hp: number; maxHp: number; spirit: number; maxSpirit: number;
  stats: Record<StatKey, number>; skills: string[]; cooldown: Record<string, number>;
  effects: ActiveEffect[]; down: boolean; insightRoll: number; scarHit: number;
  dealt: number; taken: number; healed: number; controlled: number; kills: number;
}
export interface BattleEvent {
  round: number; at: { day: number; minutes: number }; actor: string; skillId: string; skillName: string;
  targets: string[]; hit: boolean; resource?: SkillResource; amount?: number; effects?: string[]; note?: string;
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
  id: string; hash: string; schemaVersion: 2; promptVersion: string; source: 'seed' | 'generated';
  createdAt: string; palette: { ink: string; rose: string; blush: string; mist: string; frost: string };
  girls: Girl[]; monsters: MonsterTemplate[]; skills: Skill[]; missions: Mission[];
  notes: string;
}
export interface GameState {
  version: 3; day: number; minutes: number; gold: number; reputation: number;
  girls: Girl[]; candidates: Girl[]; missions: Mission[]; rooms: Room[];
  logs: Log[]; samples: Sample[]; completed: string[]; messages: Record<string, Message[]>;
  memorial: Memorial[]; battles: BattleState[]; packHash: string;
}
export type GameAction =
  | { type: 'dispatch'; girlIds: string[]; missionId: string }
  | { type: 'care'; girlId: string; mode: 'healing' | 'resting' }
  | { type: 'advance'; minutes: number }
  | { type: 'hire'; girlId: string }
  | { type: 'build'; roomId?: string }
  | { type: 'talk'; girlId: string; text: string }
  | { type: 'retire'; girlId: string }
  | { type: 'reset' };
export interface ActionResult { state: GameState; ok: boolean; message: string; battle?: BattleState }
