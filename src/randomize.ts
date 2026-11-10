/**
 * 预设与用户输入可用的随机数 / 随机颜色（v248）。
 *
 * 宏只在拼提示词或读取玩家输入的那一刻求值：同一条预设每次请求都会重新抽，
 * 写进存档的玩家原文保持原样（重开同一条输入会再抽一次）。
 */

/** 闭区间整数；min/max 反过来会自动交换。 */
export function randomInt(min: number, max: number): number {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  if (!Number.isFinite(low) || !Number.isFinite(high) || high < low) return low || 0;
  return low + Math.floor(Math.random() * (high - low + 1));
}

/**
 * 随机颜色：默认给出偏中高饱和、明度适中的颜色，避免纯黑纯白。
 * tone 支持 pastel（柔和）、neon（荧光）、dark（暗色），其余按默认。
 */
export function randomHexColor(tone?: string): string {
  const key = (tone ?? '').trim().toLowerCase();
  const hue = Math.random() * 360;
  const sat = key === 'pastel' ? 55 + Math.random() * 20
    : key === 'neon' ? 85 + Math.random() * 15
      : key === 'dark' ? 40 + Math.random() * 30
        : 55 + Math.random() * 35;
  const light = key === 'pastel' ? 78 + Math.random() * 10
    : key === 'neon' ? 55 + Math.random() * 10
      : key === 'dark' ? 22 + Math.random() * 16
        : 45 + Math.random() * 25;
  return hslToHex(hue, sat, light);
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = hue < 60 ? [c, x, 0]
    : hue < 120 ? [x, c, 0]
      : hue < 180 ? [0, c, x]
        : hue < 240 ? [0, x, c]
          : hue < 300 ? [x, 0, c]
            : [c, 0, x];
  const hex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** 宏参数：空 → 1–100；单个数字 → 1–N；`A-B` → A–B（支持负数）。 */
export function randomFromArg(arg?: string): number {
  const raw = (arg ?? '').trim();
  if (!raw) return randomInt(1, 100);
  const range = raw.match(/^(-?\d+)\s*-\s*(-?\d+)$/);
  if (range) return randomInt(Number(range[1]), Number(range[2]));
  const single = raw.match(/^-?\d+$/);
  if (single) return randomInt(1, Math.max(1, Number(raw)));
  return randomInt(1, 100);
}

/**
 * 只展开随机数与随机颜色，别的 `{{...}}` 原样留下（那些交给提示词的宏解析）。
 * 用于玩家输入：故事方向、开场种子、每一轮行动、聊天消息等。
 */
export function expandRandomMacros(text: string): string {
  return text.replace(/\{\{\s*(random|color)(?::([^{}]*))?\s*\}\}/g, (_match, key: string, arg?: string) => {
    if (key === 'color') return randomHexColor(arg);
    return String(randomFromArg(arg));
  });
}
