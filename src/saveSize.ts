/**
 * 存档体积体检。
 *
 * 一个存档撑到几十兆，多半是**内联的 data URL**：立绘、衣柜、魔女化立绘都已经搬进
 * IndexedDB 资产（\`portraitAsset\`），但表情差分（\`importedVariants\`）还是
 * \`Record<string, dataURL>\`，一个角色四套服装 × 六种表情就是二十四张图。
 *
 * 这里不猜：把 state 按区块量一遍，报出前几名，让「存不进去」变成可操作的信息。
 */
import type { GameState, Girl } from './types.ts';

export interface SizePart {
  label: string;
  bytes: number;
}

const size = (value: unknown): number => {
  try { return JSON.stringify(value)?.length ?? 0; } catch { return 0; }
};

/** 单个角色身上各块的大小：先是差分，再是立绘/衣柜/魔女化，剩下的算其他。 */
export function measureGirl(girl: Girl): SizePart[] {
  const variants = size(girl.importedVariants);
  const wardrobe = size(girl.wardrobe);
  const witch = size(girl.witchForm);
  const portraits = size({ portrait: girl.portrait, portraitAsset: girl.portraitAsset, portraitSpec: girl.portraitSpec });
  const total = size(girl);
  const rest = Math.max(0, total - variants - wardrobe - witch - portraits);
  return [
    { label: `${girl.name} · 表情差分`, bytes: variants },
    { label: `${girl.name} · 衣柜`, bytes: wardrobe },
    { label: `${girl.name} · 魔女化`, bytes: witch },
    { label: `${girl.name} · 立绘引用`, bytes: portraits },
    { label: `${girl.name} · 其他`, bytes: rest },
  ];
}

/** 整份存档按区块量一遍，从大到小排。 */
export function measureState(state: GameState): SizePart[] {
  const girlParts = (state.girls ?? []).flatMap(measureGirl);
  const candidateParts = (state.candidates ?? []).flatMap(measureGirl);
  const parts: SizePart[] = [
    ...girlParts,
    ...candidateParts,
    { label: '纪念堂', bytes: size(state.memorial) },
    { label: '势力所属少女 / 首领', bytes: size(state.customFactionGirls) + size(state.customFactionLeaders) },
    { label: '战报', bytes: size(state.battles) },
    { label: '事件与剧情', bytes: size(state.events) + size(state.storylines) },
    { label: '对话记录', bytes: size(state.messages) },
    { label: '日志与通知', bytes: size(state.logs) + size(state.notices) },
    { label: '其他', bytes: 0 },
  ];
  const total = size(state);
  const known = parts.reduce((sum, part) => sum + part.bytes, 0);
  parts[parts.length - 1] = { label: '其他', bytes: Math.max(0, total - known) };
  return parts.filter(part => part.bytes > 0).sort((a, b) => b.bytes - a.bytes);
}

/** 给「存不进去」的提示补一段人话：前三名是谁、占多少。 */
export function describeStateSize(state: GameState, limit = 3): string {
  const parts = measureState(state).slice(0, limit);
  if (!parts.length) return '';
  return parts.map(part => `${part.label} ${Math.round(part.bytes / 1000)}KB`).join('；');
}
