/**
 * 立绘处理：4:5 裁剪、缩放到存档尺寸、以及一个「够用就好」的去背景。
 *
 * 去背景只处理与画布边缘连通的背景色：白底、灰底、单色渐变都能去掉，
 * 主体内部的同色区域（白衬衫、白猫）不会被误伤。发丝与复杂背景不保证干净。
 */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片读取失败。'));
    image.src = src;
  });
}

/** 按 4:5 取景并压成 768×960 的 WebP，用作立绘存档。 */
export function cropToDataUrl(image: HTMLImageElement, zoom: number, x: number, y: number): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const ratio = 4 / 5;
  const sw = Math.min(image.naturalWidth, image.naturalHeight * ratio) / zoom;
  const sh = sw / ratio;
  const maxX = image.naturalWidth - sw;
  const maxY = image.naturalHeight - sh;
  const sx = Math.max(0, Math.min(maxX, (image.naturalWidth - sw) / 2 + (x / 100) * (sw / 2)));
  const sy = Math.max(0, Math.min(maxY, (image.naturalHeight - sh) / 2 + (y / 100) * (sh / 2)));
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 768, 960);
  return canvas.toDataURL('image/webp', 0.78);
}

export interface CutoutOptions {
  /** 颜色容差，0–120；越大去掉得越多。 */
  tolerance?: number;
  /** 处理前把最长边缩到这个尺寸，控制耗时与存档体积。 */
  maxEdge?: number;
  /** 边缘羽化，减少锯齿。 */
  feather?: boolean;
}

export interface CutoutResult {
  dataUrl: string;
  removedRatio: number;
  width: number;
  height: number;
}

interface Rgb { r: number; g: number; b: number }

function distanceSq(data: Uint8ClampedArray, index: number, color: Rgb): number {
  const dr = data[index] - color.r;
  const dg = data[index + 1] - color.g;
  const db = data[index + 2] - color.b;
  return dr * dr + dg * dg + db * db;
}

/** 取四边出现最多的颜色（量化到 5 位）作为背景色。 */
function borderColor(data: Uint8ClampedArray, width: number, height: number): Rgb {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.r += data[i];
      bucket.g += data[i + 1];
      bucket.b += data[i + 2];
    } else {
      buckets.set(key, { count: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  };
  for (let x = 0; x < width; x += 1) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    add(0, y);
    add(width - 1, y);
  }
  let best = { count: 0, r: 255, g: 255, b: 255 };
  for (const bucket of buckets.values()) {
    if (bucket.count > best.count) best = bucket;
  }
  const count = Math.max(1, best.count);
  return { r: Math.round(best.r / count), g: Math.round(best.g / count), b: Math.round(best.b / count) };
}

/**
 * 从边缘做洪水填充，把与背景色相近且连通的像素设为透明。
 * 返回 PNG dataURL（保留透明通道）。
 */
export async function removeImageBackground(source: HTMLImageElement, options: CutoutOptions = {}): Promise<CutoutResult> {
  if (typeof document === 'undefined') throw new Error('去背景需要浏览器画布。');
  const tolerance = Math.max(4, Math.min(120, options.tolerance ?? 36));
  const maxEdge = Math.max(320, Math.min(2400, options.maxEdge ?? 1600));
  const scale = Math.min(1, maxEdge / Math.max(source.naturalWidth, source.naturalHeight));
  const width = Math.max(1, Math.round(source.naturalWidth * scale));
  const height = Math.max(1, Math.round(source.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('浏览器不支持画布，无法去背景。');
  ctx.drawImage(source, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const background = borderColor(data, width, height);
  const limit = tolerance * tolerance;
  const removed = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const seed = (x: number, y: number) => {
    const p = y * width + x;
    if (removed[p]) return;
    if (distanceSq(data, p * 4, background) > limit) return;
    removed[p] = 1;
    queue[tail++] = p;
  };
  for (let x = 0; x < width; x += 1) {
    seed(x, 0);
    seed(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    seed(0, y);
    seed(width - 1, y);
  }
  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p / width) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < width - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < height - 1) seed(x, y + 1);
  }

  let removedCount = 0;
  for (let p = 0; p < removed.length; p += 1) {
    if (!removed[p]) continue;
    removedCount += 1;
    data[p * 4 + 3] = 0;
  }

  if (options.feather !== false) {
    for (let p = 0; p < removed.length; p += 1) {
      if (removed[p]) continue;
      const x = p % width;
      const y = (p / width) | 0;
      const touches =
        (x > 0 && removed[p - 1]) ||
        (x < width - 1 && removed[p + 1]) ||
        (y > 0 && removed[p - width]) ||
        (y < height - 1 && removed[p + width]);
      if (touches) data[p * 4 + 3] = Math.min(data[p * 4 + 3], 190);
    }
  }

  ctx.putImageData(image, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    removedRatio: removedCount / (width * height),
    width,
    height,
  };
}
