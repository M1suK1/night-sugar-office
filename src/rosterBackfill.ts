/**
 * 三方名册的描述回填（v179）。
 *
 * 名册是从卡库排出来的：卡索引里只有名字、头衔、台词这些短字段，性格与外形
 * 要读卡面原文才有。开局与「编成」换人都可能没读到，于是名册里的人只剩一行
 * 头衔——开会、访谈、约谈时提示词写不出她是什么样的人。
 *
 * 这里按 cardId 把那几张卡补读一次，只补空着的字段，已有的一个字不动。
 */
import { loadCardBox } from './cardbox.ts';
import { parseGirlCard } from './cards.ts';
import { readLibraryFile, scanLibrary } from './cardLibrary.ts';
import type { GameState } from './types.ts';

interface Described {
  cardId?: string;
  personality?: string;
  appearance?: string;
  quote?: string;
  title?: string;
  codename?: string;
}

function missing(person: Described | undefined): boolean {
  return Boolean(person?.cardId) && (!person?.personality?.trim() || !person?.appearance?.trim());
}

/** 名册里还缺描述的人（用来决定要不要回填）。 */
export function rosterDescriptionsMissing(state: GameState): string[] {
  const list: Described[] = [...(state.customFactionLeaders ?? []), ...(state.customFactionGirls ?? [])];
  return list.filter(person => missing(person)).map(person => person.cardId ?? '').filter(Boolean);
}

export async function backfillFactionDescriptions(state: GameState): Promise<{ state: GameState; filled: string[] } | null> {
  const targets = [...(state.customFactionLeaders ?? []), ...(state.customFactionGirls ?? [])].filter(person => missing(person));
  if (!targets.length) return null;
  try {
    const box = await loadCardBox();
    const scan = await scanLibrary();
    if (!scan.ok) return null;
    const byHash = new Map(box.map(entry => [entry.hash, entry]));
    const patch = new Map<string, { appearance?: string; personality?: string; quote?: string; title?: string; codename?: string }>();

    for (const person of targets) {
      const hash = person.cardId;
      if (!hash || patch.has(hash)) continue;
      const entry = byHash.get(hash);
      const file = entry
        ? scan.files.find(item => item.name === entry.fileName) ?? scan.files.find(item => item.name.includes(hash))
        : scan.files.find(item => item.name.includes(hash));
      if (!file) continue;
      const text = await readLibraryFile(file, { dir: scan.dir, kind: scan.kind });
      if (!text.ok) continue;
      const parsed = parseGirlCard(text.text);
      if (!parsed.ok) continue;
      const girl = parsed.card.girl;
      patch.set(hash, {
        appearance: girl.appearance?.trim() || undefined,
        personality: girl.personality?.trim() || undefined,
        quote: girl.quote?.trim() || undefined,
        title: girl.title?.trim() || undefined,
        codename: girl.codename?.trim() || undefined,
      });
    }
    if (!patch.size) return null;

    const filled: string[] = [];
    const apply = <T extends Described>(person: T): T => {
      const extra = person.cardId ? patch.get(person.cardId) : undefined;
      if (!extra) return person;
      const next: T = { ...person };
      if (!next.appearance?.trim() && extra.appearance) next.appearance = extra.appearance;
      if (!next.personality?.trim() && extra.personality) next.personality = extra.personality;
      if (!next.quote?.trim() && extra.quote) next.quote = extra.quote;
      if (!next.title?.trim() && extra.title) next.title = extra.title;
      if (!next.codename?.trim() && extra.codename) (next as Described).codename = extra.codename;
      filled.push(extra.title ?? person.cardId ?? '');
      return next;
    };

    return {
      state: {
        ...state,
        customFactionLeaders: (state.customFactionLeaders ?? []).map(apply),
        customFactionGirls: (state.customFactionGirls ?? []).map(apply),
      },
      filled,
    };
  } catch {
    return null;
  }
}
