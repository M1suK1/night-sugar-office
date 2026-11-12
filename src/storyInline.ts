/**
 * 台词写进正文（v258）。
 *
 * 以前模型把旁白写成一整块、台词另放在 \`lines\` 里，还要自己数「插在第几段之后」，
 * 经常数错，结果对白全堆在末尾。现在让它直接写在正文里：
 *
 *     @爱丽丝[calm]：今晚的委托，我不接。
 *
 * 这里把标记拆回 \`StoryLine[]\`（含 after），渲染层与存档结构都不变。
 * 认不出的行原样留成旁白——绝不因为格式写错就丢字。
 */
import type { Expression, StoryLine } from './types.ts';

export interface StoryCastEntry {
  id: string;
  name: string;
}

const EXPRESSIONS: Expression[] = ['calm', 'smile', 'surprise', 'sad', 'angry', 'shy'];
/** 中文也认，省得模型写「[生气]」就整句降级。 */
const EXPRESSION_ALIAS: Record<string, Expression> = {
  平静: 'calm', 冷静: 'calm', 微笑: 'smile', 笑: 'smile', 惊讶: 'surprise',
  难过: 'sad', 悲伤: 'sad', 生气: 'angry', 愤怒: 'angry', 害羞: 'shy',
};
/** 单句台词的字数上限，和 parseStoryLines 一致。 */
const INLINE_TEXT_LIMIT = 220;

const MARKER = /^@\s*([^\s[\]［］：:（(]{1,24})\s*(?:[\[［]([^\]］]{1,12})[\]］])?\s*(?:[（(](心想|心声)[）)])?\s*[：:]\s*(.*)$/;

export interface ParsedStory {
  /** 去掉标记行之后的旁白。 */
  text: string;
  lines: StoryLine[];
  /** 正文里至少认出一句台词。 */
  inline: boolean;
}

/** 名字先按 id 精确匹配，再按名字；重名取名单里第一个。 */
function findSpeaker(raw: string, cast: StoryCastEntry[]): StoryCastEntry | undefined {
  const key = raw.trim();
  if (!key) return undefined;
  // 所长/玩家这一轮的话已经由界面显示，正文里再写一遍会变成两个气泡；
  // 这里不认这两个名字，整行留在旁白里。
  if (key === 'player' || key === '所长' || key === '你') return undefined;
  return cast.find(person => person.id === key) ?? cast.find(person => person.name.trim() === key);
}

function expressionOf(raw?: string): Expression {
  const key = (raw ?? '').trim().toLowerCase();
  if (EXPRESSIONS.includes(key as Expression)) return key as Expression;
  return EXPRESSION_ALIAS[key] ?? 'calm';
}

/** 把一行拆成台词；不是标记行（或认不出说话人）就返回 undefined。 */
function readMarker(
  line: string,
  cast: StoryCastEntry[],
): { speaker: StoryCastEntry; expression: Expression; text: string; mode: 'speech' | 'thought' } | undefined {
  const match = MARKER.exec(line);
  if (!match) return undefined;
  const speaker = findSpeaker(match[1] ?? '', cast);
  if (!speaker) return undefined;
  const text = (match[4] ?? '').trim().slice(0, INLINE_TEXT_LIMIT);
  if (!text) return undefined;
  // （心想）/（心声）写在冒号前：这句是心里话，界面会标「· 心声」并换成虚线。
  const mode = match[3] ? 'thought' as const : 'speech' as const;
  return { speaker, expression: expressionOf(match[2]), text, mode };
}

/** 正文 → 旁白 + 台词。没有标记时 inline 为 false，调用方照旧用 JSON 的 lines。 */
export function splitInlineStory(narration: string, cast: StoryCastEntry[]): ParsedStory {
  const raw = (narration ?? '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return { text: '', lines: [], inline: false };
  const lines: StoryLine[] = [];
  const paragraphs: string[] = [];
  for (const source of raw.split('\n')) {
    const marker = readMarker(source.trim(), cast);
    if (marker) {
      // after = 这句之前已经写下的非空旁白行数（与 split(/\n+/) 的分段口径一致）。
      const after = paragraphs.filter(paragraph => paragraph.trim()).length;
      lines.push({
        speakerId: marker.speaker.id,
        speakerName: marker.speaker.name,
        expression: marker.expression,
        text: marker.text,
        mode: marker.mode,
        after,
      });
      continue;
    }
    paragraphs.push(source.trimEnd());
  }
  const text = humanizeMarkers(paragraphs.join('\n')).replace(/\n{3,}/g, '\n\n').trim();
  return { text, lines, inline: lines.length > 0 };
}

/**
 * 把残留的标记行改成人话。
 *
 * 说话人不在场的标记行会留在正文里；直接显示
 * \`@名字[表情]：\` 很扎眼，这里降级成「名字：「台词」」——内容一个字不丢，也不再有标记。
 */
export function humanizeMarkers(text: string): string {
  if (!text.includes('@')) return text;
  return text.split('\n').map(line => {
    const match = MARKER.exec(line.trim());
    if (!match) return line;
    const name = (match[1] ?? '').trim();
    const spoken = (match[4] ?? '').trim();
    if (!name || !spoken) return line;
    return match[3] ? `${name}（心想）：「${spoken}」` : `${name}：「${spoken}」`;
  }).join('\n');
}

/**
 * 正文优先：认出台词就用正文里的，一句都没认出来才退回 JSON 的 \`lines\`。
 * 两条路都不通时返回纯旁白轮次。
 */
export function storyWithLines(
  narration: string,
  jsonLines: StoryLine[],
  cast: StoryCastEntry[],
): ParsedStory {
  const parsed = splitInlineStory(narration, cast);
  if (parsed.inline) return parsed;
  return { text: (narration ?? '').trim(), lines: jsonLines, inline: false };
}
