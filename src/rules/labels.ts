import type { StatKey } from '../types.ts';
// v35 从 src/game.ts 拆出：展示用的常量与映射，不含逻辑。

/** 衣柜上限：三套制式 + 一格自定义礼装。 */
export const WARDROBE_LIMIT = 4;

export const statLabels: Record<StatKey, string> = { magic: '魔力', insight: '洞察', agility: '敏捷', empathy: '共情' };

export const statusLabels: Record<string, string> = { idle: '待命', mission: '派遣中', healing: '治疗中', resting: '休息中', retired: '已退役', expedition: '远行中' };

export const workLabels = { combat: '战斗', investigation: '调查' } as const;

export const workDescriptions = {
  combat: '正面直击街区畸变实体，全员按 15 分钟一轮交替展开战术攻防与创伤结算。',
  investigation: '深入诡异现场排查隐秘线索，以出勤队伍中对应特长的最高天赋主导胜负判定。',
} as const;

export const stageLabels = ['厌恶', '疏离', '戒备', '平常', '亲近', '依恋', '爱意'] as const;

export const stageHints = [
  '她本能地抗拒与你在同一张桌前停留，眼神始终游移在紧闭的门把手上。',
  '她对你维持着无可挑剔的执勤礼节，但言辞之间隔着一层不易察觉的透明高墙。',
  '她习惯在交接时暗中审视你的一举一动，在彻底确立安全前绝不卸下防备。',
  '彼此已适应了深夜并肩共处的工作节律，平淡对坐，无声亦无隔阂。',
  '她会在泡茶或擦拭法杖的间隙，主动向你讲起一些无关紧要的生活琐事。',
  '在构想未来的每一种可能时，她已习惯在身侧的位置自然而然地留出你的身影。',
  '她终于卸下了灵魂全部的心防死锁，甘愿将自己最隐秘、最脆弱的伤痕完全托付给你。',
] as const;

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
