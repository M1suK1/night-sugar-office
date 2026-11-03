/**
 * 提案历史。
 *
 * 同一个作者连着几晚提同一类事，是模型"看不见自己写过什么"造成的：
 * 提示词里原本只有**待议**的议题（\`{{council}}\`），已经决议过的题目它一无所知。
 * 这里把最近提过的议题整理成一段紧凑文本，喂给每日提案，并要求它换角度。
 */
import type { GameState, Opinion } from './types.ts';

/** 折进提示词的条数上限。 */
export const OPINION_HISTORY_LIMIT = 12;
/** 只看最近几天的记录：太老的题目不再要求回避（玩家自己也可能想重提）。 */
export const OPINION_HISTORY_DAYS = 8;

const STATUS_LABEL: Record<Opinion['status'], string> = {
  pending: '待议',
  accepted: '通过',
  rejected: '驳回',
  deferred: '暂缓',
  expired: '过期',
  shelved: '转入档案',
};

/** 最近提过的议题，新的在前。 */
export function recentOpinions(state: GameState, limit = OPINION_HISTORY_LIMIT): Opinion[] {
  const floor = state.day - OPINION_HISTORY_DAYS;
  return [...(state.opinions ?? [])]
    .filter(opinion => opinion.day >= floor)
    .sort((a, b) => b.day - a.day || b.id.localeCompare(a.id))
    .slice(0, Math.max(0, limit));
}

/** 作者显示名：名册 → 纪念堂 → 三方代表 → id。 */
export function opinionAuthorName(state: GameState, opinion: Opinion): string {
  const girl = state.girls.find(entry => entry.id === opinion.authorId)
    ?? state.memorial.find(entry => entry.girl.id === opinion.authorId)?.girl;
  if (girl) return girl.name;
  const leader = state.customFactionLeaders?.find(entry => entry.id === opinion.authorId);
  if (leader) return leader.name;
  return opinion.authorId;
}

/** 折进提示词的多行文本；没有记录时返回空串（调用方据此决定要不要加这一块）。 */
export function opinionHistoryText(state: GameState, limit = OPINION_HISTORY_LIMIT): string {
  const rows = recentOpinions(state, limit);
  if (!rows.length) return '';
  return rows.map(opinion => {
    const author = opinionAuthorName(state, opinion);
    const status = STATUS_LABEL[opinion.status] ?? opinion.status;
    return `- 第 ${opinion.day} 日｜${author}｜${opinion.topic}｜「${opinion.title}」｜${status}`;
  }).join('\n');
}

/**
 * 直接喂给每日提案的那一块：先给结论（别重复），再给清单，最后给一条可执行的换法。
 * 没有历史时返回空串。
 */
export function dailyHistoryBlock(state: GameState, limit = OPINION_HISTORY_LIMIT): string {
  const rows = opinionHistoryText(state, limit);
  if (!rows) return '';
  return [
    '【最近提过的议题 · 不要重复】',
    '同一个人连着提同类的事会被玩家一眼看出来。新的提案不要与下面任何一条同题或同角度：',
    rows,
    '换法：换提出者、换辖区、换代价结构（批钱 / 担责 / 得罪一方 / 拿她自己的身体冒险），或把旧议題的后果当成新的由头。',
  ].join('\n');
}

/** 判定"这条是不是撞了最近提过的题目"：同作者 + 同标题。 */
export function repeatsRecentOpinion(state: GameState, authorId: string, title: string, limit = OPINION_HISTORY_LIMIT): boolean {
  const key = title.trim();
  if (!key) return false;
  return recentOpinions(state, limit).some(opinion => opinion.authorId === authorId && opinion.title.trim() === key);
}
