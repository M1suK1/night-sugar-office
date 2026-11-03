import { getSkill } from '../content/skills.ts';
import type { BattleNote, Equipment, GameState, Girl, StatKey } from '../types.ts';
﻿// v35 从 game.ts 拆出：生成内容与战斗札记的校验。


/** 生成前的池容量预检，避免自动补充先花掉 API 请求再被拒。 */
export function canAcceptGeneratedContent(_state: GameState): { ok: boolean; message: string } {
  // 每日提案只产出委托与议题，不再产出魔物；池子满时由 addGeneratedContent 替换最旧的自动委托。
  return { ok: true, message: '' };
}

export function validGeneratedItem(item: unknown): item is Equipment {
  if (!item || typeof item !== 'object') return false;
  const entry = item as Equipment;
  if (typeof entry.id !== 'string' || !entry.id.startsWith('lm_item_')) return false;
  if (typeof entry.name !== 'string' || !entry.name || typeof entry.description !== 'string') return false;
  if (!['weapon', 'charm', 'consumable'].includes(entry.slot)) return false;
  if (!['witch', 'association', 'government'].includes(entry.faction)) return false;
  if (entry.stats && (typeof entry.stats !== 'object' || Array.isArray(entry.stats))) return false;
  // 只会说漂亮话的装备：没有数值、没有被动、没有效果，买回去什么都不会变。
  const hasNumbers = Boolean(entry.stats && Object.values(entry.stats).some(value => typeof value === 'number' && value !== 0))
    || Boolean(entry.maxHpBonus || entry.spiritBonusPct || entry.damageBonus || entry.initiativeBonus || entry.corruptionPerBattle);
  const hasFlavor = Boolean(entry.passive?.trim()) || Boolean(entry.effect) || Boolean(entry.skillId);
  if (!hasNumbers && !hasFlavor) return false;
  return true;
}

export const characterIds = new Set(['yue', 'tang', 'ling', 'wu', 'zhi', 'lu']);

export function safeId(id: unknown): id is string {
  // 契约卡的 id 是 `g_card_<hash>`：中间那道下划线也得放行，否则带卡的档一读就被判成坏档。
  return typeof id === 'string' && (characterIds.has(id) || /^g_[a-z0-9_]{6,}$/.test(id));
}

export function validGirl(value: unknown): value is Girl {
  if (!value || typeof value !== 'object') return false;
  const g = value as Girl;
  if (!safeId(g.id) || typeof g.name !== 'string' || !g.name) return false;
  if (!g.stats || typeof g.stats !== 'object') return false;
  for (const key of ['magic', 'insight', 'agility', 'empathy'] as StatKey[]) if (!Number.isFinite(g.stats[key])) return false;
  if (!['idle', 'mission', 'healing', 'resting', 'retired', 'expedition'].includes(g.status)) return false;
  if (!Number.isFinite(g.hp) || !Number.isFinite(g.maxHp) || !Number.isFinite(g.fatigue) || !Number.isFinite(g.bond)) return false;
  if (!Array.isArray(g.skills) || !g.skills.every(s => typeof s === 'string' && getSkill(s))) return false;
  return true;
}


export const BATTLE_NOTE_EXPRESSIONS = new Set(['calm', 'smile', 'surprise', 'sad', 'angry', 'shy']);

export function validBattleNote(value: unknown): value is BattleNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as Partial<BattleNote>;
  if (typeof note.battleId !== 'string' || !note.battleId) return false;
  if (typeof note.title !== 'string' || typeof note.hook !== 'string' || typeof note.summary !== 'string') return false;
  if (note.source !== 'llm' && note.source !== 'template') return false;
  if (!Number.isFinite(note.charCount) || typeof note.createdAt !== 'string') return false;
  if (!Array.isArray(note.scenes) || note.scenes.length < 1 || note.scenes.length > 8) return false;
  let lineTotal = 0;
  for (const scene of note.scenes) {
    if (!scene || typeof scene !== 'object') return false;
    if (typeof scene.id !== 'string' || typeof scene.title !== 'string' || typeof scene.narration !== 'string') return false;
    if (!Number.isFinite(scene.roundFrom) || !Number.isFinite(scene.roundTo) || scene.roundTo < scene.roundFrom) return false;
    if (!Array.isArray(scene.lines) || scene.lines.length > 80) return false;
    lineTotal += scene.lines.length;
    for (const line of scene.lines) {
      if (!line || typeof line !== 'object') return false;
      if (!Number.isFinite(line.round) || !BATTLE_NOTE_EXPRESSIONS.has(line.expression)) return false;
      if (line.speakerSide !== 'ally' && line.speakerSide !== 'enemy') return false;
      if (typeof line.speakerId !== 'string' || !line.speakerId || typeof line.text !== 'string' || !line.text.trim()) return false;
      if (line.mode !== undefined && line.mode !== 'speech' && line.mode !== 'thought') return false;
    }
  }
  return lineTotal <= 240;
}

