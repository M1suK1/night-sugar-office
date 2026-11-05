/**
 * 调试用动作（控制台命令）。
 *
 * 只服务终端里的三条命令：让某位少女魔女化、把她重置回初始状态。
 * 刻意走正常 reducer 通道（clone + 校验 + 日志），这样和玩家操作留下的痕迹一致，
 * 不会绕过存档清洗或在状态里留下半个字段。
 */
import { loadBalance } from '../balance.ts';
import { defaultWitchPersonality } from '../personality.ts';
import { baseStatsAt } from '../progression.ts';
import type { ActionResult, GameAction, GameState } from '../types.ts';
import { clone, dateLabel, findRosterGirl } from './core.ts';
import { witchOutfitFor } from './outfits.ts';
import { importCardInto } from './cardOps.ts';

const findAny = (state: GameState, id: string) =>
  findRosterGirl(state, id) ?? state.candidates.find(girl => girl.id === id);

export function applyDebugGirl(state: GameState, action: Extract<GameAction, { type: 'debugGirl' }>): ActionResult {
  const next = clone(state);
  const girl = findAny(next, action.girlId);
  if (!girl) return { state, ok: false, message: '找不到这位契约者。' };

  if (action.mode === 'witch') {
    const threshold = Math.max(0, Math.round(loadBalance().corruptionThreshold));
    girl.corruption = Math.max(girl.corruption ?? 0, threshold);
    if (!girl.witchForm) girl.witchForm = { ...witchOutfitFor(girl), id: 'witchform', form: 'witch' };
    if (!girl.witchPersonality?.trim()) girl.witchPersonality = defaultWitchPersonality(girl);
    girl.witch = true;
    next.logs.unshift({
      id: `log-debug-witch-${girl.id}-${next.day}-${next.minutes}`,
      time: dateLabel(next.day, next.minutes), kind: 'care',
      text: `【调试】${girl.name}被直接推进了魔女形态（侵蚀 ${girl.corruption}）。`,
    });
    return { state: next, ok: true, message: `${girl.name}已进入魔女形态：侵蚀 ${girl.corruption}，魔女化立绘${girl.witchForm?.portrait ? '已就位' : '是程序化生成的'}。` };
  }

  // reset：回到「刚导入这张卡」时的样子（等级 1、四维基准、无疤痕无装备、侵蚀与疲劳清零）。
  const base = baseStatsAt(girl.stats, girl.level, girl.archetype);
  girl.level = 1;
  girl.exp = 0;
  girl.stats = { ...base };
  girl.baseStats = { ...base };
  girl.baseMaxHp = Math.round(96 + base.empathy * 0.3);
  girl.maxHp = girl.baseMaxHp;
  girl.hp = girl.maxHp;
  girl.spirit = 0;
  girl.maxSpirit = 0;
  girl.fatigue = 0;
  girl.corruption = 0;
  girl.bond = 20;
  girl.scars = [];
  girl.conditions = [];
  girl.equipment = {};
  girl.witch = false;
  girl.restProgress = undefined;
  girl.loan = undefined;
  girl.status = 'idle';
  girl.remaining = 0;
  girl.missionId = undefined;
  girl.unspentPoints = 0;
  girl.drugUntilDay = undefined;
  next.logs.unshift({
    id: `log-debug-reset-${girl.id}-${next.day}-${next.minutes}`,
    time: dateLabel(next.day, next.minutes), kind: 'base',
    text: `【调试】${girl.name}被重置回初始状态：等级 1、四维回到基准、疤痕与装备清空。`,
  });
  return { state: next, ok: true, message: `${girl.name}已重置：Lv.1 · 血量 ${girl.hp}/${girl.maxHp} · 疲劳 0 · 侵蚀 0 · 无疤痕。` };
}

/**
 * 从卡库直接契约（v96，控制台用）。
 *
 * 先走正常的「登记候选」，再把刚登记的那位移进事务所名册：不收费、不看席位，
 * 但经过同一套卡面解析，所以立绘、衣柜、故事线都跟正常导入一致。
 */
export function applyDebugContractCard(state: GameState, action: Extract<GameAction, { type: 'debugContractCard' }>): ActionResult {
  const next = clone(state);
  const before = new Set(next.candidates.map(girl => girl.id));
  const imported = importCardInto(next, action.card);
  if (!imported.ok) return { state, ok: false, message: imported.message };
  const girl = next.candidates.find(item => !before.has(item.id));
  if (!girl) return { state, ok: false, message: '这张卡没能登记成候选。' };
  next.candidates = next.candidates.filter(item => item.id !== girl.id);
  girl.candidateUntilDay = 0;
  girl.status = 'idle';
  girl.remaining = 0;
  girl.roomId = girl.roomId || 'lounge';
  next.girls.unshift(girl);
  next.logs.unshift({
    id: `log-debug-contract-${girl.id}-${next.day}-${next.minutes}`,
    time: dateLabel(next.day, next.minutes), kind: 'base',
    text: `【调试】直接从契约卡库契约了 ${girl.name}，跳过市场与费用。`,
  });
  return { state: next, ok: true, message: `${girl.name}已直接契约进事务所（Lv.${girl.level}）。` };
}

/** 移除一位已契约的少女（v96，控制台用）：名册、助手位、派遣与关系网一起清掉。 */
export function applyDebugRemoveGirl(state: GameState, action: Extract<GameAction, { type: 'debugRemoveGirl' }>): ActionResult {
  const next = clone(state);
  const girl = next.girls.find(item => item.id === action.girlId);
  if (!girl) return { state, ok: false, message: '名册里没有这位契约者。' };
  const name = girl.name;
  next.girls = next.girls.filter(item => item.id !== girl.id);
  next.candidates = next.candidates.filter(item => item.id !== girl.id);
  if (next.assistantId === girl.id) next.assistantId = next.girls.find(item => !item.retired && !item.dead)?.id;
  for (const mission of next.missions) {
    if (!mission.squad.includes(girl.id) && mission.girlId !== girl.id) continue;
    mission.squad = mission.squad.filter(id => id !== girl.id);
    if (mission.girlId === girl.id) mission.girlId = mission.squad[0];
    if (!mission.squad.length && mission.status === 'active') mission.status = 'open';
  }
  for (const other of [...next.girls, ...next.candidates]) {
    if (other.relationships?.[girl.id] !== undefined) delete other.relationships[girl.id];
  }
  // 她的个人故事线跟着人走：人不在名册里，线就不该继续挂在时间线上。
  next.storylines = next.storylines.filter(story => story.girlId !== girl.id);
  next.logs.unshift({
    id: `log-debug-remove-${girl.id}-${next.day}-${next.minutes}`,
    time: dateLabel(next.day, next.minutes), kind: 'base',
    text: `【调试】把 ${name} 从名册里移除了（连带清掉她的派遣、关系网与故事线）。`,
  });
  return { state: next, ok: true, message: `已移除 ${name}。` };
}
