/** 出厂预设清单：由 tools/import-presets.mjs 生成，请勿手改。 */
import { PRESET as ARC_PRESET } from './arc.ts';
import { PRESET as BATTLE_PRESET } from './battle.ts';
import { PRESET as STORYLINE_PRESET } from './storyline.ts';
import { PRESET as OUTFIT_PRESET } from './outfit.ts';
import { PRESET as DAILY_PRESET } from './daily.ts';
import { PRESET as EVENT_PRESET } from './event.ts';
import { PRESET as CHAT_PRESET } from './chat.ts';
import { PRESET as PROFILE_PRESET } from './profile.ts';

export interface ShippedPreset {
  id: string;
  /** 这份预设服务哪个任务作用域。 */
  scope: string;
  name: string;
  raw: unknown;
}

export const SHIPPED_PRESETS: ShippedPreset[] = [
  { id: 'shipped-arc', scope: 'arc', name: "完整剧情", raw: ARC_PRESET },
  { id: 'shipped-battle', scope: 'battle', name: "战斗札记", raw: BATTLE_PRESET },
  { id: 'shipped-storyline', scope: 'storyline', name: "故事线", raw: STORYLINE_PRESET },
  { id: 'shipped-outfit', scope: 'outfit', name: "服装词条", raw: OUTFIT_PRESET },
  { id: 'shipped-daily', scope: 'daily', name: "每日提案", raw: DAILY_PRESET },
  { id: 'shipped-event', scope: 'event', name: "私人事件", raw: EVENT_PRESET },
  { id: 'shipped-chat', scope: 'chat', name: "角色对话", raw: CHAT_PRESET },
  { id: 'shipped-profile', scope: 'profile', name: "角色起草", raw: PROFILE_PRESET },
];
