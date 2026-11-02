import type { StatKey } from '../types.ts';
// v35 从 src/game.ts 拆出：展示用的常量与映射，不含逻辑。

/** 衣柜上限：三套制式 + 一格自定义礼装。 */
export const WARDROBE_LIMIT = 4;

export const statLabels: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };

export const statusLabels: Record<string, string> = { idle: '待命', mission: '派遣中', healing: '治疗中', resting: '休息中', retired: '已退役', expedition: '远行中' };

export const workLabels = { combat: '战斗', investigation: '调查' } as const;

export const workDescriptions = { combat: '与魔物交战，按 15 分钟一轮自动结算。', investigation: '调查灵异现象，以队伍最高相关能力判定。' } as const;

export const stageLabels = ['厌恶', '疏离', '戒备', '平常', '亲近', '依恋', '爱意'] as const;

export const stageHints = ['她不想与你共处一室。', '她保持礼貌，也保持距离。', '她在观察你，尚未决定是否信任。', '日常相处，不近不远。', '她开始主动分享一些小事。', '她把你放进了自己的未来。', '她愿意把最脆弱的部分交给你。'] as const;

export function relationshipStage(score: number): number {
  const value = Math.max(0, Math.min(100, score));
  if (value < 10) return 0;
  if (value < 25) return 1;
  if (value < 40) return 2;
  if (value < 55) return 3;
  if (value < 70) return 4;
  if (value < 85) return 5;
  return 6;
}

export function clock(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
