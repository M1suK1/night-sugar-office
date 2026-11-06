/**
 * 立绘栏的表情判定（v173）。
 *
 * 说话的人用那句台词的 `expression`，其他人保持自己的表情；
 * 敌方单位往往只有 `uid` 没有 `girlId`，所以两种身份都认。
 * 抽成纯函数是因为「表情不再变化」这种回归只能在测试里盯住。
 */
import type { Expression, Girl } from './types.ts';

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

/**
 * 交给 `GirlPortrait` 的那份数据（v174）。
 *
 * 以前是 `{ ...person, expression }` —— 整份少女对象原样过去，表情差分、衣柜、
 * 魔女形态都在。抽组件时我换成了手写字段清单，漏掉 `variantAssets` 之类的字段，
 * 表现就是「表情差分全没了」。这里改成合并整份对象，只覆盖表情与立绘兜底。
 */
export function portraitSubjectOf(
  actor: { uid: string; girlId?: string; name: string; codename?: string; portrait: string; portraitAsset?: string; color: string; expression: Expression; portraitSpec?: unknown },
  expression: Expression,
  girl?: Girl,
): Girl {
  if (girl) {
    return {
      ...girl,
      expression,
      // 存档里可能只剩资产引用：这时用单位快照上的立绘兜底。
      portrait: girl.portrait || actor.portrait,
    } as Girl;
  }
  return {
    ...(actor as unknown as Girl),
    id: actor.girlId ?? actor.uid,
    expression,
    portrait: actor.portrait,
    portraitAsset: actor.portraitAsset,
  } as Girl;
}