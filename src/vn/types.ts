/**
 * 视觉小说阅读器的数据形状（纯数据，不依赖 React）。
 *
 * 只服务角色剧情（`StoryPlayerDialog`）与以后的战斗札记：
 * 这里不描述「怎么演」，只描述「有哪些节拍」，渲染全在 `VnReader`。
 */
import type { Expression } from '../types.ts';
import type { PortraitSubjectLike } from '../portrait.ts';

/** 背景：只描述是哪一场，具体怎么画交给 `backdrops.ts` 查表。 */
export interface VnBackdrop {
  /** 语义 id：room:lounge / district:candy / night / void … */
  id: string;
  /** 主色；缺省由查表推导。 */
  tint?: string;
  /** 背景图（data URL 或资产 id）。现在一律为空，接口先留好。 */
  image?: string;
}

export type VnBeat =
  | { kind: 'say'; speakerId: string; name: string; text: string; expression?: Expression; action?: string; thought?: boolean }
  | { kind: 'choice'; prompt?: string; options: { id: string; label: string; hint?: string }[] }
  | { kind: 'bg'; backdrop: VnBackdrop; fadeMs?: number }
  /** 换场标题卡：战斗札记的分场、剧情换幕。 */
  | { kind: 'scene'; title: string }
  | { kind: 'end' };

/** 舞台上要画谁：说话人 → 立绘（直接交给 `GirlPortrait`）。 */
export interface VnCastMember {
  id: string;
  name: string;
  girl: Omit<PortraitSubjectLike, 'portrait'> & { id: string; name: string; color: string; portrait: string; codename?: string; expression?: Expression };
}
