import type { GameState, Girl, Mission } from '../types.ts';
import type { BalanceRules } from '../balance.ts';
import { loadBalance } from '../balance.ts';
import { hashText } from './core.ts';
import { mulberry32 } from '../content/archetypes.ts';

/**
 * 灯下私语：结算之后「她会不会主动说话」。
 *
 * 只入队、不发消息——真正的内容由 App 调模型生成，成功后才写未读。
 * 概率全部读「数值规则」里的私语四项；正在走故事线的角色单独一档，
 * 默认 100%（只要出勤就必发），并优先占用当晚名额。
 * 判定用 day/girl/mission 做确定性随机，同一天同一场不会重复抽。
 */

/** 单次判定的输入：只放真正参与计算的那几个数，便于测试。 */
export interface WhisperChanceInput {
  success: boolean;
  bond: number;
  fatigue: number;
  corruption: number;
  hp: number;
  maxHp: number;
  /** 是否正在走故事线（status === 'active'）。 */
  storyline: boolean;
}

/** 疲劳到这个值以上会更容易开口。 */
export const WHISPER_TIRED_AT = 70;
/** 侵蚀到这个值以上，或残血到这个比例以下，也会更容易开口。 */
export const WHISPER_HURT_CORRUPTION = 60;
export const WHISPER_HURT_HP_RATIO = 0.4;
/** 失败分支里「羁绊越低越容易来安慰你」的权重上限（百分点）。 */
export const WHISPER_LOW_BOND_PCT = 10;

/** 返回 0–1 的概率。故事线角色直接取专用档，不吃疲劳/侵蚀修正。 */
export function whisperChance(input: WhisperChanceInput, balance: BalanceRules = loadBalance()): number {
  const storyPct = Math.max(0, Math.min(100, balance.whisperStoryPct));
  if (input.storyline) return storyPct / 100;
  const bond = Math.max(0, Math.min(100, input.bond)) / 100;
  const basePct = input.success ? balance.whisperVictoryPct : balance.whisperDefeatPct;
  // 成功时羁绊越高越容易开口；失败时羁绊越低越容易来安慰你。
  const bondPct = input.success ? bond * balance.whisperBondMaxPct : (1 - bond) * WHISPER_LOW_BOND_PCT;
  const tiredPct = input.fatigue >= WHISPER_TIRED_AT ? 10 : 0;
  const hurtPct = input.corruption >= WHISPER_HURT_CORRUPTION || input.hp <= input.maxHp * WHISPER_HURT_HP_RATIO ? 15 : 0;
  const capPct = Math.max(1, Math.min(100, balance.whisperMaxPct));
  const pct = Math.max(0, Math.min(capPct, basePct + bondPct + tiredPct + hurtPct));
  return pct / 100;
}

/** 结算后决定谁会在今晚开口。原地改 `state.whisperQueue` 与 `state.lastWhisperDay`。 */
export function maybeQueueWhisper(state: GameState, mission: Mission, squad: Girl[], outcome: 'victory' | 'defeat' | 'success' | 'failure', battleId?: string): void {
  const balance = loadBalance();
  const cap = Math.max(1, Math.min(6, Math.round(balance.whisperDailyCap)));
  const queue = state.whisperQueue ?? [];
  const queuedToday = () => queue.filter(job => job.day === state.day).length;
  if (queuedToday() >= cap) return;
  const lastDay = state.lastWhisperDay ?? {};
  const activeStory = new Set(
    (state.storylines ?? []).filter(line => line.status === 'active').map(line => line.girlId),
  );
  const success = outcome === 'victory' || outcome === 'success';
  const eligible = squad.filter(girl => {
    if (girl.dead || girl.retired) return false;
    if (lastDay[girl.id] === state.day) return false;
    if ((state.whisperUnread?.[girl.id] ?? 0) > 0) return false;
    if (queue.some(job => job.girlId === girl.id && job.day === state.day)) return false;
    return true;
  });
  // 故事线角色优先占位：先判他们，再轮到普通角色。
  eligible.sort((a, b) => Number(activeStory.has(b.id)) - Number(activeStory.has(a.id)));
  for (const girl of eligible) {
    if (queuedToday() >= cap) break;
    const chance = whisperChance({
      success,
      bond: girl.bond,
      fatigue: girl.fatigue,
      corruption: girl.corruption ?? 0,
      hp: girl.hp,
      maxHp: girl.maxHp,
      storyline: activeStory.has(girl.id),
    }, balance);
    const roll = mulberry32(hashText(`${state.day}:${girl.id}:${mission.id}`))();
    if (roll >= chance) continue;
    queue.push({ id: `${state.day}-${mission.id}-${girl.id}`, girlId: girl.id, missionId: mission.id, day: state.day, outcome, battleId, createdAt: Date.now() });
    lastDay[girl.id] = state.day;
  }
  state.whisperQueue = queue;
  state.lastWhisperDay = lastDay;
}
