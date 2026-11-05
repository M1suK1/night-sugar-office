/**
 * 背景查表（v93）。
 *
 * 现在没有任何背景图资产，所以这里只产出「渐变 + 暗角」的占位背景。
 * 以后要接真图时，只改这个文件：`image` 填上资产 id 或 data URL，
 * 组件会按 `image ? img : gradient` 渲染，剧本与适配器一行都不用动。
 */
import type { VnBackdrop } from './types.ts';

export interface ResolvedBackdrop {
  /** CSS 渐变（直接塞进 style.backgroundImage）。 */
  gradient: string;
  /** 背景图：data URL；为空表示只用渐变。 */
  image: string;
}

const PALETTE: Record<string, [string, string, string]> = {
  'room:lounge': ['#2a1c28', '#191320', '#0d0a12'],
  'room:clinic': ['#1d2733', '#151a24', '#0b0d12'],
  'room:dorm': ['#2b1f2c', '#1a1420', '#0d0a11'],
  'room:observatory': ['#1c2434', '#141722', '#0a0b11'],
  street: ['#241c30', '#171224', '#0b0913'],
  night: ['#191424', '#120f1b', '#08060d'],
  void: ['#120f18', '#0d0b12', '#050408'],
};

const districtTint = (id: string): string => {
  const [first, second, third] = PALETTE[id] ?? PALETTE.night!;
  return `radial-gradient(120% 90% at 50% 12%, ${first}dd 0%, ${second}f0 45%, ${third} 100%)`;
};

export function resolveBackdrop(id: string, tint?: string): ResolvedBackdrop {
  const palette = PALETTE[id];
  const gradient = palette
    ? districtTint(id)
    : `radial-gradient(120% 90% at 50% 12%, ${(tint ?? '#2a1c28') + 'dd'} 0%, #150f1b 55%, #08060d 100%)`;
  return { gradient, image: '' };
}

/** 元素色 → 占位背景（角色剧情没有场景线索时用）。 */
export function backdropForElement(element: string | undefined): VnBackdrop {
  const tint = element === '星光系' ? '#8f7fd0' : element === '月影系' ? '#c478b8' : element === '赤焰系' ? '#e08a72' : element === '霜雪系' ? '#8fc4d8' : undefined;
  return { id: tint ? 'street' : 'night', tint };
}
