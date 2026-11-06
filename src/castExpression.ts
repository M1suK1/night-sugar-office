/**
 * 立绘栏的表情判定（v173）。
 *
 * 说话的人用那句台词的 `expression`，其他人保持自己的表情；
 * 敌方单位往往只有 `uid` 没有 `girlId`，所以两种身份都认。
 * 抽成纯函数是因为「表情不再变化」这种回归只能在测试里盯住。
 */
import type { Expression } from './types.ts';

export interface SideCastActor {
  uid: string;
  side: 'ally' | 'enemy';
  girlId?: string;
  name: string;
  codename?: string;
  portrait: string;
  portraitAsset?: string;
  color: string;
  expression: Expression;
  down?: boolean;
}

export interface SideCastLine {
  speakerId?: string;
  speakerSide?: 'ally' | 'enemy';
  expression: Expression;
}

/** 这一格现在该用哪张脸。 */
export function castExpressionOf(actor: Pick<SideCastActor, 'uid' | 'girlId' | 'side' | 'expression'>, activeLine: SideCastLine | null): { expression: Expression; speaking: boolean } {
  const speakingId = actor.girlId ?? actor.uid;
  const speaking = Boolean(
    activeLine
    && (activeLine.speakerSide ?? 'ally') === actor.side
    && activeLine.speakerId === speakingId,
  );
  return { expression: speaking ? activeLine!.expression : actor.expression, speaking };
}
