/**
 * 三方名册的描述回填（v179）。
 *
 * 名册是从卡库排出来的：卡索引里只有名字、头衔、台词这些短字段，性格与外形
 * 要读卡面原文才有。开局与「编成」换人都可能没读到，于是名册里的人只剩一行
 * 头衔——开会、访谈、约谈时提示词写不出她是什么样的人。
 *
 * 这里按 cardId 把那几张卡补读一次，只补空着的字段，已有的一个字不动。
 */
import { loadCardBox, readCardRaw } from './cardbox.ts';
import { parseGirlCard } from './cards.ts';
import { readLibraryFile, scanLibrary } from './cardLibrary.ts';
import type { Expression, GameState, Outfit, PortraitSpec } from './types.ts';

interface Described {
  cardId?: string;
  personality?: string;
  appearance?: string;
  quote?: string;
  title?: string;
  codename?: string;
  portrait?: string;
  portraitAsset?: string;
  portraitSpec?: PortraitSpec;
  wardrobe?: Outfit[];
  outfitId?: string;
  expression?: Expression;
  witchForm?: Outfit;
  importedVariants?: Record<string, string>;
}

function missing(person: Described | undefined): boolean {
  // 只按描述判断是否要读卡；读卡时顺手把立绘与表情差分一并补齐（老名册都没搬过）。
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
    const files = scan.ok ? scan.files : [];
    const byHash = new Map(box.map(entry => [entry.hash, entry]));
    const patch = new Map<string, {
      appearance?: string; personality?: string; quote?: string; title?: string; codename?: string;
      portrait?: string; portraitSpec?: PortraitSpec; wardrobe?: Outfit[]; outfitId?: string;
      expression?: Expression; witchForm?: Outfit; importedVariants?: Record<string, string>;
    }>();

    for (const person of targets) {
      const hash = person.cardId;
      if (!hash || patch.has(hash)) continue;
      // 卡库导入时正文就存在 cardbox 里，先走这条，不依赖文件目录权限。
      let raw = await readCardRaw(hash);
      if (!raw && scan.ok) {
        const entry = byHash.get(hash);
        const file = entry
          ? files.find(item => item.name === entry.fileName) ?? files.find(item => item.name.includes(hash))
          : files.find(item => item.name.includes(hash));
        if (!file) continue;
        const text = await readLibraryFile(file, { dir: scan.dir, kind: scan.kind });
        if (text.ok) raw = text.text;
      }
      if (!raw) continue;
      const parsed = parseGirlCard(raw);
      if (!parsed.ok) continue;
      const girl = parsed.card.girl;
      patch.set(hash, {
        appearance: girl.appearance?.trim() || undefined,
        personality: girl.personality?.trim() || undefined,
        quote: girl.quote?.trim() || undefined,
        title: girl.title?.trim() || undefined,
        codename: girl.codename?.trim() || undefined,
        // 老名册在编成时没搬差分，这里按 cardId 把卡面立绘与表情补齐。
        portrait: girl.portrait || undefined,
        portraitSpec: girl.portraitSpec,
        wardrobe: girl.wardrobe?.length ? girl.wardrobe : undefined,
        outfitId: girl.outfitId,
        expression: girl.expression,
        witchForm: girl.witchForm ? { ...girl.witchForm, id: 'witchform', form: 'witch' } : undefined,
        importedVariants: Object.keys(girl.importedVariants ?? {}).length ? girl.importedVariants : undefined,
      });
    }
    if (!patch.size) return null;

    const filled: string[] = [];
    const apply = <T extends Described>(person: T): T => {
      const extra = person.cardId ? patch.get(person.cardId) : undefined;
      if (!extra) return person;
      const next: T = { ...person };
      let touched = false;
      if (!next.appearance?.trim() && extra.appearance) { next.appearance = extra.appearance; touched = true; }
      if (!next.personality?.trim() && extra.personality) { next.personality = extra.personality; touched = true; }
      if (!next.quote?.trim() && extra.quote) { next.quote = extra.quote; touched = true; }
      if (!next.title?.trim() && extra.title) { next.title = extra.title; touched = true; }
      if (!next.codename?.trim() && extra.codename) { (next as Described).codename = extra.codename; touched = true; }
      if (!next.portrait?.trim() && !next.portraitAsset && extra.portrait) { next.portrait = extra.portrait; touched = true; }
      if (!next.portraitSpec && extra.portraitSpec) { next.portraitSpec = extra.portraitSpec; touched = true; }
      if (!next.wardrobe?.length && extra.wardrobe) { next.wardrobe = extra.wardrobe; touched = true; }
      if (!next.outfitId && extra.outfitId) { next.outfitId = extra.outfitId; touched = true; }
      if (!next.expression && extra.expression) { next.expression = extra.expression; touched = true; }
      if (!next.witchForm && extra.witchForm) { next.witchForm = extra.witchForm; touched = true; }
      if (!Object.keys(next.importedVariants ?? {}).length && extra.importedVariants) { next.importedVariants = extra.importedVariants; touched = true; }
      if (touched) filled.push(extra.title ?? person.cardId ?? '');
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
