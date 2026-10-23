export type StatKey = 'magic' | 'insight' | 'agility' | 'empathy';
export type GirlStatus = 'idle' | 'mission' | 'healing' | 'resting';
export interface Girl {
  id: string; name: string; codename: string; title: string; element: string; color: string; portrait: string;
  level: number; hp: number; maxHp: number; fatigue: number; bond: number;
  stats: Record<StatKey, number>; status: GirlStatus; roomId: string; remaining: number; missionId?: string;
  skill: string; description: string; cost: number;
}
export interface Mission {
  id: string; title: string; category: string; description: string; x: number; y: number;
  difficulty: string; duration: number; reward: number; requirement: StatKey; target: number;
  color: string; status: 'open' | 'active' | 'done'; girlId?: string;
}
export interface Room { id: string; name: string; type: 'lounge' | 'clinic' | 'dorm' | 'observatory'; level: number; capacity: number; description: string }
export interface Log { id: string; time: string; kind: 'dispatch' | 'finance' | 'care' | 'story' | 'base'; text: string; delta?: number }
export interface Sample { day: number; income: number; expense: number; reputation: number }
export interface Message { role: 'girl' | 'player' | 'system'; text: string }
export interface GameState {
  version: 1; day: number; minutes: number; gold: number; reputation: number; girls: Girl[]; candidates: Girl[];
  missions: Mission[]; rooms: Room[]; logs: Log[]; samples: Sample[]; completed: string[]; messages: Record<string, Message[]>;
}
export type GameAction =
  | { type: 'dispatch'; girlId: string; missionId: string }
  | { type: 'care'; girlId: string; mode: 'healing' | 'resting' }
  | { type: 'advance'; minutes: number }
  | { type: 'hire'; girlId: string }
  | { type: 'build'; roomId?: string }
  | { type: 'talk'; girlId: string; text: string }
  | { type: 'reset' };
export interface ActionResult { state: GameState; ok: boolean; message: string }
