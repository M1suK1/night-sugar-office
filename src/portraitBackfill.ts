import { sanitizePortraitSrc } from './image.ts';
import type { Girl } from './types.ts';

/**
 * 卡库里明明有图，名册里却是剪影——按 cardId 把立绘补回来。
 *
 * 出现的场合：卡在更早的版本里导入过（那时还不存立绘）、或者某一版导入时
 * 图片被降维失败清空了。这里只处理「有 cardId、没有立绘」的人，按 hash 读取原始
 * 卡 JSON，把 portrait 取出来写回。已经有人像的一个都不动。
 */
export function portraitsMissing(girls: readonly Girl[]): Girl[] {
  return girls.filter(girl => !girl.portrait && Boolean(girl.cardId));
}

/** 返回补回来的张数；没有可补的就返回 0，调用方据此决定要不要写回状态。 */
export async function backfillPortraits(
  girls: readonly Girl[],
  readCard: (hash: string) => Promise<string | undefined>,
  box: readonly { hash: string; name: string }[] = [],
): Promise<{ portraits: Map<string, string>; filled: number }> {
  // 没有 cardId 的人（现场登记、旧版本导入）按同名卡兜一层：
  // 名字是玩家自己给的，同名基本就是同一张卡。
  const byName = new Map(box.map(entry => [entry.name, entry.hash]));
  const targets = girls.filter(girl => !girl.portrait && (girl.cardId || byName.has(girl.name)));
  const portraits = new Map<string, string>();
  for (const girl of targets) {
    const hash = girl.cardId ?? byName.get(girl.name)!;
    let raw: string | undefined;
    try { raw = await readCard(hash); } catch { raw = undefined; }
    if (!raw) continue;
    let card: { girl?: { portrait?: unknown } } | undefined;
    try { card = JSON.parse(raw) as { girl?: { portrait?: unknown } }; } catch { card = undefined; }
    const portrait = sanitizePortraitSrc(card?.girl?.portrait);
    if (!portrait) continue;
    portraits.set(girl.id, portrait);
  }
  return { portraits, filled: portraits.size };
}
