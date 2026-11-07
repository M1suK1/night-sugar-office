import { rules } from '../balance.ts';
import type { DistrictId } from '../districts.ts';
import { districts } from '../districts.ts';
import { applyHostility, pairOf } from '../hostility.ts';
import type { LevelUpMode } from '../progression.ts';
import { AUTO_MAIN_POINTS, AUTO_SECONDARY_POINTS, HP_PER_LEVEL, grantExp } from '../progression.ts';
import { canClaim, factionName } from '../territories.ts';
import type { ChronicleEntry, FactionId, GameNotice, GameState, Girl, Sample } from '../types.ts';
import { clock } from './labels.ts';
// v35 从 src/game.ts 拆出：到处都在用的小工具：找人、记账、公告。

export function dateLabel(day: number, minutes: number): string {
  return `第 ${day} 日 · ${clock(minutes)}`;
}

/** 推一条提示到通知中心；只留最近 20 条，新的在前。 */
export function pushNotice(state: GameState, notice: Omit<GameNotice, 'id'>): GameNotice {
  const entry: GameNotice = {
    ...notice,
    id: `notice-${notice.kind}-${notice.day}-${notice.minutes}-${(state.notices?.length ?? 0)}-${Math.random().toString(36).slice(2, 6)}`,
  };
  state.notices = [entry, ...(state.notices ?? [])].slice(0, 20);
  return entry;
}
/** 结算经验；升级时写一条通知，并把可分配点数带给玩家。 */

/** 结算经验；升级时写一条通知，并把可分配点数带给玩家。 */
export function grantExpWithNotice(state: GameState, girl: Girl, amount: number): void {
  const mode = (state.levelUpMode ?? 'auto') as LevelUpMode;
  const result = grantExp(girl, amount, mode);
  if (!result.leveled) return;
  pushNotice(state, {
    kind: 'level', day: state.day, minutes: state.minutes, girlId: girl.id,
    title: `${girl.name}升到 Lv.${result.to}`,
    text: mode === 'manual'
      ? `获得 ${result.points} 点可分配属性，现在还有 ${girl.unspentPoints ?? 0} 点没分配。去她的档案里决定成长方向。`
      : `按职阶自动成长：主属性 +${AUTO_MAIN_POINTS}、副属性 +${AUTO_SECONDARY_POINTS}，最大生命 +${HP_PER_LEVEL}。`,
  });
}
/** 每天能摆到议事桌上的议题上限：会客厅 2 级 3 条，3 级 4 条，4 级 5 条。 */

export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** 交互剧情最多走几轮玩家行动；到上限后只允许结束事件。 */

export function sampleFor(state: GameState, day: number): Sample {
  let sample = state.samples.find(s => s.day === day);
  if (!sample) {
    sample = { day, income: 0, expense: 0, reputation: state.reputation };
    state.samples.push(sample);
    state.samples.sort((a, b) => a.day - b.day);
  }
  return sample;
}

export function book(state: GameState, day: number, money: number): void {
  const sample = sampleFor(state, day);
  if (money > 0) sample.income += money;
  if (money < 0) sample.expense += -money;
  sample.reputation = state.reputation;
}

export function archive(state: GameState, kind: ChronicleEntry['kind'], title: string, summary: string): void {
  state.chronicle.unshift({ id: `chr-${Date.now()}-${state.chronicle.length}`, day: state.day, at: dateLabel(state.day, state.minutes), kind, title, summary });
  state.chronicle = state.chronicle.slice(0, 200);
}
// ---------------------------------------------------------------- 辖区与委托时段

// 委托模板池：seed-pack 的 7 条 + v24 补的 9 条 = 战斗 10 + 调查 6。

// ---------------------------------------------------------------- 辖区易主
export const clamp100 = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

/** 把一片辖区移交给某个势力。超过单势力上限时拒绝，并留下记录。 */

/** 把一片辖区移交给某个势力。超过单势力上限时拒绝，并留下记录。 */
export function shiftTerritory(state: GameState, districtId: DistrictId, faction: FactionId, source: string): boolean {
  const from = state.territories[districtId];
  if (from === faction) return false;
  if (!canClaim(state.territories, faction)) {
    state.logs.unshift({ id: `log-territory-full-${districtId}-${state.day}-${state.minutes}`, time: dateLabel(state.day, state.minutes), kind: 'territory', text: `${factionName[faction]}的辖区已达 ${rules().territoryLimit} 片上限，${districts[districtId].name}暂时维持现状。` });
    return false;
  }
  state.territories[districtId] = faction;
  state.territoryLog.unshift({ day: state.day, minutes: state.minutes, district: districtId, from, to: faction });
  state.territoryLog = state.territoryLog.slice(0, 60);
  const pair = pairOf(from as FactionId, faction);
  if (pair) applyHostility(state, [{ pair, delta: 6, reason: `${districts[districtId].name}换了手` }]);
  archive(state, '辖区', `${districts[districtId].name}易主`, `${factionName[from]} → ${factionName[faction]}（${source}）`);
  state.logs.unshift({ id: `log-territory-${districtId}-${state.day}-${state.minutes}`, time: dateLabel(state.day, state.minutes), kind: 'territory', text: `${districts[districtId].name}的夜巡权转交给${factionName[faction]}（${source}）。` });
  return true;
}

// ---------------------------------------------------------------- 强制事件

export function findGirl(state: GameState, id: string): Girl | undefined {
  return state.girls.find(g => g.id === id);
}
/** 差分也允许先给候选者准备；入队后随角色卡一起带走。 */

/** 差分也允许先给候选者准备；入队后随角色卡一起带走。 */
export function findRosterGirl(state: GameState, id: string): Girl | undefined {
  return state.girls.find(g => g.id === id) ?? state.candidates.find(g => g.id === id);
}
/** 服装被移除后，不再保留这套衣服的表情差分。 */

export function hashText(text: string): number {  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); }
  return hash >>> 0;
}
