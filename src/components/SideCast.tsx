import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Expression, Girl, MonsterTemplate, PortraitSpec } from '../types';
import { rotateSide } from '../storySlots';
import { GirlPortrait } from './GirlPortrait';
import { castExpressionOf, portraitSubjectOf } from '../castExpression';
import type { SideCastActor, SideCastLine } from '../castExpression';

const expressionLabel: Record<Expression, string> = {
  calm: '平静', smile: '微笑', surprise: '惊讶', sad: '难过', angry: '生气', shy: '害羞',
};

/** 立绘栏的人比纯逻辑多几个只会用在画面上的字段。 */
interface CastFigure extends SideCastActor {
  monster?: MonsterTemplate;
  portraitSpec?: PortraitSpec;
}

// v174：整份少女对象交给 GirlPortrait（表情差分、衣柜、魔女形态都在），只覆盖表情；
// 单位快照只剩资产引用时用它的立绘兜底。见 castExpression.portraitSubjectOf。

/** 把焦点（说话 / 悬停的人）转到第一格，再取前三位；人不够就原样给。 */
function windowOf(order: string[], focusId: string, size: number): string[] {
  if (order.length <= size) return order;
  const at = order.indexOf(focusId);
  if (at <= 0) return order.slice(0, size);
  return [...order.slice(at), ...order.slice(0, at)].slice(0, size);
}

/**
 * 单侧立绘栏（v172 抽出，战斗札记与会议共用）。
 *
 * 三人时用前后三格（front-left / front-right / back），悬停或轮到谁说话就整体轮转过去；
 * 超过三人时只显示焦点所在的三人窗口 —— 以前直接把所有人塞成一排，立绘会被压成细条。
 */
export function SideCast({ side, list, activeLine, girlsById, hoverKey, litKeys, resetKey }: {
  side: 'left' | 'right';
  list: CastFigure[];
  activeLine: SideCastLine | null;
  girlsById: Map<string, Girl>;
  hoverKey: string;
  litKeys: string[];
  resetKey: string;
}) {
  const idsKey = list.map(actor => actor.girlId ?? actor.uid).join('|');
  const [order, setOrder] = useState<string[]>(() => list.map(actor => actor.girlId ?? actor.uid));
  useEffect(() => {
    setOrder(list.map(actor => actor.girlId ?? actor.uid));
  }, [idsKey, resetKey]);

  const hoveredId = hoverKey.startsWith(`${side}:`) ? hoverKey.slice(side.length + 1) : '';
  // 轮转时挂一段位移动画（见 combat.css 的 side-rotate-*）：
  // 三个格子同时沿弧线换位并转身，动画结束再回到静态站位。
  const [rotating, setRotating] = useState(false);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setRotating(false), 460);
    return () => window.clearTimeout(timer);
  }, [rotating]);
  // 只在悬停换人这一下轮转；order 用当前值，不放进依赖，免得轮转后自己再转一次。
  useEffect(() => {
    if (!hoveredId) return;
    const next = rotateSide(order, hoveredId);
    if (next === order) return;
    setOrder([...next]);
    setRotating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId]);

  const byId = new Map(list.map(actor => [actor.girlId ?? actor.uid, actor]));
  const focusId = hoveredId || activeLine?.speakerId || '';
  const windowIds = windowOf(order, focusId, 3);
  const shown = windowIds.flatMap(id => { const actor = byId.get(id); return actor ? [actor] : []; });
  const three = shown.length === 3;
  const slots = ['slot-front-left', 'slot-front-right', 'slot-back'];
  const label = list.every(actor => actor.side === 'ally') ? '我方' : list.every(actor => actor.side === 'enemy') ? '敌方' : '战场';

  return (
    <aside className={`battle-note-side ${side} ${list.length ? '' : 'empty'} ${list.length >= 3 ? 'dense' : ''} ${three ? 'three-up' : ''}`} aria-label={side === 'left' ? '左侧角色' : '右侧角色'}>
      {list.length > 0 && <span className="battle-note-side-label">{label}</span>}
      {shown.map((actor, index) => {
        const { expression, speaking } = castExpressionOf(actor, activeLine);
        return (
          <figure
            key={actor.uid}
            className={`battle-note-portrait ${actor.side} ${three ? slots[index] : ''} ${rotating ? 'rotating' : ''} ${litKeys.includes(`${side}:${actor.girlId ?? actor.uid}`) ? 'lit' : ''} ${speaking ? 'speaking' : ''} ${actor.down ? 'down' : ''}`}
            style={{ '--note-color': actor.color } as CSSProperties}
          >
            <div className="battle-note-portrait-art">
              <GirlPortrait girl={portraitSubjectOf(actor, expression, girlsById.get(actor.girlId ?? ''))} variant="full" />
              <span className="battle-note-expression">{expressionLabel[expression]}</span>
            </div>
            <figcaption>
              <b>{actor.name}</b>
              <small>{actor.codename ?? (actor.side === 'enemy' ? '敌方' : '契约者')}</small>
              {actor.side === 'enemy' && <em>敌方</em>}
              {actor.down && <em className="down">倒下</em>}
            </figcaption>
          </figure>
        );
      })}
    </aside>
  );
}
