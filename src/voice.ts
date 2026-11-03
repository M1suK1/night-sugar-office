import type { Girl, GirlVoice } from './types.ts';

/** 语料各段的上限：进提示词，所以要短。 */
export const VOICE_TONE_MAX = 30;
export const VOICE_HABIT_MAX = 18;
export const VOICE_SAMPLE_MAX = 40;
export const VOICE_HABITS_LIMIT = 3;
export const VOICE_SAMPLES_LIMIT = 3;
export const VOICE_LINE_MAX = 240;

function clean(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function cleanList(value: unknown, perItem: number, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const text = clean(item).slice(0, perItem);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

/** 收口 LLM 产出与手填内容：三段都空就当作没语料。 */
export function sanitizeVoice(raw: unknown): GirlVoice | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const input = raw as Record<string, unknown>;
  const tone = clean(input.tone).slice(0, VOICE_TONE_MAX);
  const habits = cleanList(input.habits, VOICE_HABIT_MAX, VOICE_HABITS_LIMIT);
  const samples = cleanList(input.samples, VOICE_SAMPLE_MAX, VOICE_SAMPLES_LIMIT);
  if (!tone && !habits.length && !samples.length) return undefined;
  return { tone, habits, samples };
}

/**
 * 语料进提示词的唯一出口。空语料返回空串——不要留一个「说话方式：」的空壳，
 * 模型会自己补一段语气词，比没有更糟。
 */
export function voiceLine(girl: Pick<Girl, 'voice'>): string {
  const voice = girl.voice;
  if (!voice) return '';
  const parts: string[] = [];
  if (voice.tone) parts.push(`说话方式：${voice.tone}`);
  if (voice.habits?.length) parts.push(`口头习惯：${voice.habits.join('、')}`);
  if (voice.samples?.length) parts.push(`例话：${voice.samples.map(sample => `「${sample}」`).join('')}`);
  const line = parts.join('；');
  return line ? line.slice(0, VOICE_LINE_MAX) : '';
}

/** 档案里那一行的短摘要（不进口语提示词）。 */
export function voiceSummary(girl: Pick<Girl, 'voice'>): string {
  const voice = girl.voice;
  if (!voice) return '还没写过语料';
  if (voice.tone) return voice.tone;
  if (voice.habits?.length) return voice.habits.join('、');
  return voice.samples?.[0] ?? '还没写过语料';
}
