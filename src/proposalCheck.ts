/**
 * 提案的本地审查力度。
 *
 * 「严格」是原来的行为：驳回里多写一个势力态度就整份作废，得重新 roll。
 * 「宽松」不再作废，而是就地把不合规的驳回改成「只掉提出者的羁绊」——
 * 结构问题（缺委托、缺议题）仍然会拦，但文案口味不再卡人。
 */
const KEY = 'night-sugar:proposal-check';

export type ProposalCheckMode = 'strict' | 'lenient';

export function loadProposalCheck(): ProposalCheckMode {
  try {
    return localStorage.getItem(KEY) === 'strict' ? 'strict' : 'lenient';
  } catch {
    return 'lenient';
  }
}

export function saveProposalCheck(mode: ProposalCheckMode): void {
  try { localStorage.setItem(KEY, mode); } catch { /* 存不进去就按默认 */ }
}

/** 把一份原始提案里的驳回选项改写成「只掉提出者羁绊」；其它内容原样保留。 */
export function repairRejectOptions(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const proposal = raw as Record<string, unknown>;
  if (!Array.isArray(proposal.opinions)) return raw;
  proposal.opinions = proposal.opinions.map(opinion => {
    if (!opinion || typeof opinion !== 'object') return opinion;
    const entry = opinion as Record<string, unknown>;
    if (!Array.isArray(entry.options)) return opinion;
    const authorId = typeof entry.authorId === 'string' ? entry.authorId : '';
    entry.options = entry.options.map(option => {
      if (!option || typeof option !== 'object') return option;
      const choice = option as Record<string, unknown>;
      if (choice.id !== 'reject') return option;
      const changes = Array.isArray(choice.changes) ? choice.changes : [];
      const bonds = changes.filter((change): change is Record<string, unknown> => Boolean(change) && typeof change === 'object'
        && (change as Record<string, unknown>).kind === 'girl'
        && (change as Record<string, unknown>).field === 'bond'
        && (change as Record<string, unknown>).girlId === authorId);
      // 一条都没有就补一条 −2：驳回总得有点代价。
      const kept = bonds.length ? bonds.slice(0, 1) : [{ kind: 'girl', girlId: authorId, field: 'bond', amount: -2 }];
      return { ...choice, changes: kept, outcomes: [] };
    });
    return entry;
  });
  return proposal;
}
