import type { DistrictEffect } from './districts.ts';
import { loadBalance } from './balance.ts';
import { hashText } from './rules/core.ts';
import { SHIFT_START, WAVE_AT, dayOf, minutesOf } from './shift.ts';
import type { GameState } from './types.ts';

/**
 * 夜里的天气。
 *
 * 天气不是随机事件，是这盘存档的一个事实：同一天、同一段，算出来的永远是同一种。
 * 所以它不需要存档字段——`(day, 段号)` 两个数就够了，旧档读进来也自动有天气。
 * 段号跟着营业夜走：20:00 / 22:00 / 00:00 各换一段，00:00–02:00 仍算第三段。
 */

export type WeatherId = 'clear' | 'rain' | 'fog' | 'wind' | 'snow' | 'storm';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  /** 一句现象，界面与提示词共用。 */
  line: string;
  /** 给人物与排班看的影响，不写数字。 */
  hint: string;
  /** 参与取天的权重；薄雾是默认值。 */
  weight: number;
  effect: DistrictEffect;
}

export const WEATHERS: Record<WeatherId, WeatherDef> = {
  clear: {
    id: 'clear', name: '薄雾', weight: 40, effect: {},
    line: '云层散开一条缝，月光落在湿漉漉的瓦上。',
    hint: '没有额外修正。',
  },
  rain: {
    id: 'rain', name: '雨', weight: 18,
    effect: { targetPct: 4, damageDealtPct: -4, fatigueFlat: 2 },
    line: '雨丝斜着扫过路灯，排水沟一直在响。',
    hint: '线索被雨泡软，追击慢了半拍；淋了一夜的人更累。',
  },
  fog: {
    id: 'fog', name: '浓雾', weight: 16,
    effect: { targetPct: 6, enemyHpPct: -6, spiritPerHour: -1 },
    line: '雾贴着地面走，隔着一条街就看不见人。',
    hint: '调查更难；雾同样遮住敌人的要害，但在外待久了精神被磨掉。',
  },
  wind: {
    id: 'wind', name: '风', weight: 12,
    effect: { damageDealtPct: 6, fatigueFlat: 1 },
    line: '风从河口灌进来，把招牌吹得哐哐响。',
    hint: '出手更利落，逆风赶路仍要多费一点力气。',
  },
  snow: {
    id: 'snow', name: '雪', weight: 8,
    effect: { fatigueFlat: 3, damageTakenPct: 5 },
    line: '雪落在霓虹上不化，脚下一层薄脆的壳。',
    hint: '每一步都更费劲，脚下打滑时也更容易挨打。',
  },
  storm: {
    id: 'storm', name: '雷暴', weight: 6,
    effect: { damageDealtPct: 8, damageTakenPct: 8, rewardPct: 12 },
    line: '雷声压着屋顶走，整条街的灯一起闪。',
    hint: '双方都更容易打出重伤；肯在这种夜里出门的委托，报酬也更高。',
  },
};

export const WEATHER_ORDER: WeatherId[] = ['clear', 'rain', 'fog', 'wind', 'snow', 'storm'];

/** 三段的时段名，只用于界面与提示词。 */
export const WAVE_LABELS = ['20:00–22:00', '22:00–00:00', '00:00–02:00'] as const;

const WEATHER_TOTAL = WEATHER_ORDER.reduce((sum, id) => sum + WEATHERS[id].weight, 0);

/** 当夜分钟（1200–1560）→ 段号 0–2。越界一律夹在最后一段。 */
export function waveOf(minutes: number): number {
  const local = ((minutes % 1440) + 1440) % 1440;
  const offset = (local - SHIFT_START + 1440) % 1440;
  return Math.max(0, Math.min(WAVE_AT.length - 1, Math.floor(offset / 120)));
}

/** 天气的唯一取法：一天一段落一次桶，换存档不会换天。 */
export function weatherOf(day: number, wave: number): WeatherId {
  const key = `weather:${Math.max(0, Math.floor(day))}:${Math.max(0, Math.min(WAVE_AT.length - 1, Math.floor(wave)))}`;
  let roll = hashText(key) % WEATHER_TOTAL;
  for (const id of WEATHER_ORDER) {
    roll -= WEATHERS[id].weight;
    if (roll < 0) return id;
  }
  return 'clear';
}

export function weatherAt(day: number, minutes: number): WeatherId {
  return weatherOf(day, waveOf(minutes));
}

export function weatherNow(state: Pick<GameState, 'day' | 'minutes'>): WeatherId {
  return weatherAt(state.day, state.minutes);
}

/** 下一段的天气，给顶栏预告用；已经是最后一段就返回自己。 */
export function nextWeather(state: Pick<GameState, 'day' | 'minutes'>): WeatherId {
  const wave = waveOf(state.minutes);
  return weatherOf(state.day, Math.min(WAVE_AT.length - 1, wave + 1));
}

/**
 * 一份委托发布时的天气。
 *
 * 老委托没有 `spawnedAt`：按当夜第一段算，不抛错，也不去猜。
 */
export function weatherForSpawn(spawnedAt: number | undefined, fallbackDay: number): WeatherId {
  if (typeof spawnedAt !== 'number' || !Number.isFinite(spawnedAt)) return weatherOf(fallbackDay, 0);
  const day = dayOf(spawnedAt);
  return weatherAt(day, minutesOf(spawnedAt, day));
}

/** 天气对应的环境修正；强度旋钮只缩放数值，不改变天气本身。 */
export function weatherEffect(id: WeatherId): DistrictEffect {
  const pct = Math.max(0, loadBalance().weatherIntensity) / 100;
  const out: DistrictEffect = {};
  for (const [key, value] of Object.entries(WEATHERS[id].effect) as [keyof DistrictEffect, number | undefined][]) {
    const scaled = Math.round((value ?? 0) * pct);
    if (scaled) out[key] = scaled;
  }
  return out;
}

/**
 * 写进提示词的天气事实。
 *
 * 只给名字、现象与体感，不给数值：数值会让模型忍不住复述加成。
 * 最后一句是硬约束——天气由系统定，模型只能顺着写。
 */
export function weatherPrompt(state: Pick<GameState, 'day' | 'minutes'>): string {
  const wave = waveOf(state.minutes);
  const id = weatherNow(state);
  const def = WEATHERS[id];
  const nextId = nextWeather(state);
  const lines = [
    `【今夜天气】第 ${state.day} 日 · 第 ${wave + 1} 段（${WAVE_LABELS[wave]}）：${def.name}。${def.line}`,
    `影响：${def.hint}`,
    wave < WAVE_AT.length - 1
      ? `下一段（${WAVE_LABELS[wave + 1]}）会转成${WEATHERS[nextId].name}；人物可以提前收伞、关窗，但不要替它写定。`
      : '这是今夜最后一段，天亮前不会变。',
    '天气由系统给定：不要改写它、不要让它在场景中途转晴或停雨，也不要写出任何数值与加成。只写人物与场景对它的反应——湿掉的袖口、贴在皮肤上的雾、被风吹得说不完整的话。',
  ];
  return lines.join('\n');
}
