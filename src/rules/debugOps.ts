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
