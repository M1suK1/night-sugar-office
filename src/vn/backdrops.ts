/**
 * 背景查表（v93）。
 *
 * 现在没有任何背景图资产，所以这里只产出「渐变 + 暗角」的占位背景。
 * 以后要接真图时，只改这个文件：`image` 填上资产 id 或 data URL，
 * 组件会按 `image ? img : gradient` 渲染，剧本与适配器一行都不用动。
 */
import { districts, type DistrictId } from '../districts.ts';
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

/** 已经画好的背景图（放在 public/art 下，走 /art/* 静态路径）。 */
const IMAGES: Record<string, string> = {
  'room:lounge': '/art/council-lounge.jpg',
  lounge: '/art/council-lounge.jpg',
  // v178：九块辖区的夜景 —— 剧情发生在哪，就挂哪一块。
  candy: '/art/districts/candy.jpg',
  station: '/art/districts/station.jpg',
  plaza: '/art/districts/plaza.jpg',
  greenhouse: '/art/districts/greenhouse.jpg',
  cathedral: '/art/districts/cathedral.jpg',
  crossroad: '/art/districts/crossroad.jpg',
  oldtown: '/art/districts/oldtown.jpg',
  clocktower: '/art/districts/clocktower.jpg',
  docks: '/art/districts/docks.jpg',
};

export const DISTRICT_BACKDROP_IDS = ['candy', 'station', 'plaza', 'greenhouse', 'cathedral', 'crossroad', 'oldtown', 'clocktower', 'docks'] as const;

/** 室内背景：会客厅、诊所、宿舍、星象台。 */
export const ROOM_BACKDROP_IDS = ['room:lounge', 'room:clinic', 'room:dorm', 'room:observatory'] as const;

/** 剧情能选的背景 id：九块辖区 + 四个房间。 */
export const BACKDROP_IDS: readonly string[] = [...DISTRICT_BACKDROP_IDS, ...ROOM_BACKDROP_IDS];

export function isBackdropId(value: unknown): value is string {
  return typeof value === 'string' && BACKDROP_IDS.includes(value);
}

/** 提示词里的可选背景清单：id + 中文名，模型照着选。 */
export function backdropChoicesText(): string {
  const rooms: Record<string, string> = {
    'room:lounge': '会客厅', 'room:clinic': '月光诊所', 'room:dorm': '晚安宿舍', 'room:observatory': '星象台',
  };
  return BACKDROP_IDS.map(id => `${id}（${rooms[id] ?? districts[id as DistrictId]?.name ?? id}）`).join('、');
}

/** 同样的种子永远落回同一块辖区：这一段重开也不会换地方。 */
function districtBySeed(seed: string): string {
  let sum = 7;
  for (let index = 0; index < seed.length; index += 1) sum = (sum * 31 + seed.charCodeAt(index)) % 1000003;
  return DISTRICT_BACKDROP_IDS[sum % DISTRICT_BACKDROP_IDS.length] ?? 'night';
}

/**
 * 这一段剧情在哪（v178）。
 *
 * 优先级：会议地点写着哪块辖区 → 场景里点名的辖区 → 桩在屋里的场景照旧用房间；
 * 都没有时按事件 id 稳定地分一块辖区，免得每段故事都站在同一片空背景前。
 */
export function storyBackdropOf(event: {
  id: string;
  /** v191：模型在写这一段时选的背景；认不出来就退回下面的旧规则。 */
  backdrop?: string;
  meeting?: { placeId?: string };
  /** 事件场景各有各的形状，这里只认里面可能有的 scene 字段。 */
  scenes?: readonly unknown[];
  stage?: number;
}): VnBackdrop {
  const place = event.meeting?.placeId ?? '';
  // 会议地点是系统写死的事实，比叙事者选的背景更硬。
  if (place.startsWith('district:')) {
    const id = place.slice('district:'.length);
    if ((DISTRICT_BACKDROP_IDS as readonly string[]).includes(id)) return { id };
  }
  if (isBackdropId(event.backdrop)) return { id: event.backdrop };
  const scene = (event.scenes?.[event.stage ?? 0] as { scene?: unknown } | undefined)?.scene;
  if (typeof scene === 'string' && IMAGES[scene]) return { id: scene };
  if (place && IMAGES[place]) return { id: place };
  return { id: districtBySeed(event.id) };
}

export function resolveBackdrop(id: string, tint?: string): ResolvedBackdrop {
  const palette = PALETTE[id];
  const gradient = palette
    ? districtTint(id)
    : `radial-gradient(120% 90% at 50% 12%, ${(tint ?? '#2a1c28') + 'dd'} 0%, #150f1b 55%, #08060d 100%)`;
  return { gradient, image: IMAGES[id] ?? '' };
}

/** 元素色 → 占位背景（角色剧情没有场景线索时用）。 */
export function backdropForElement(element: string | undefined): VnBackdrop {
  const tint = element === '星光系' ? '#8f7fd0' : element === '月影系' ? '#c478b8' : element === '赤焰系' ? '#e08a72' : element === '霜雪系' ? '#8fc4d8' : undefined;
  return { id: tint ? 'street' : 'night', tint };
}
