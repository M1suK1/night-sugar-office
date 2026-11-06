#!/usr/bin/env node
/**
 * 把老卡里内联的大图压成小卡（单张 ≤ 4MB，和 static-cards 的上限一致）。
 *
 *   node tools/shrink-cards.mjs <输入目录> [输出目录]
 *
 * 只重编码 data:image/... 的图片字段（立绘 / 衣柜 / 魔女化 / 表情差分），
 * 其它字段原样保留。原始文件不动，结果写到输出目录；每张都会用 parseGirlCard 校验。
 *
 * 为什么用浏览器：仓库里没有图像库，Chromium 的 canvas 能稳定输出 WebP。
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { parseGirlCard } from '../src/cards.ts';

const inputDir = process.argv[2];
const outputDir = process.argv[3] ?? path.join(inputDir ?? '.', 'small');
const MAX_BYTES = Math.round(4 * 1024 * 1024);

if (!inputDir) {
  console.error('用法：node tools/shrink-cards.mjs <输入目录> [输出目录]');
  process.exit(1);
}

const PRESETS = [
  { label: '1280/1024', portrait: 1280, portraitQuality: 0.86, variant: 1024, variantQuality: 0.82 },
  { label: '1152/960', portrait: 1152, portraitQuality: 0.82, variant: 960, variantQuality: 0.78 },
  { label: '1024/864', portrait: 1024, portraitQuality: 0.78, variant: 864, variantQuality: 0.74 },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
await page.goto('about:blank');

async function shrink(card, preset) {
  return page.evaluate(async ({ card, preset }) => {
    const encode = async (dataUrl, maxEdge, quality) => {
      const blob = await (await fetch(dataUrl)).blob();
      const bitmap = await createImageBitmap(blob);
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = new OffscreenCanvas(width, height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
      const encoded = await canvas.convertToBlob({ type: 'image/webp', quality });
      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(encoded);
      });
    };
    const failed = [];
    const cache = new Map();
    const shrinkOne = async (value, edge, quality) => {
      if (typeof value !== 'string' || !value.startsWith('data:image/')) return value;
      if (cache.has(value)) return cache.get(value);
      try {
        const next = await encode(value, edge, quality);
        const use = typeof next === 'string' && next.length > 0 && next.length < value.length ? next : value;
        cache.set(value, use);
        return use;
      } catch {
        failed.push(edge);
        return value;
      }
    };
    const g = card.girl ?? {};
    g.portrait = await shrinkOne(g.portrait, preset.portrait, preset.portraitQuality);
    if (Array.isArray(g.wardrobe)) for (const outfit of g.wardrobe) outfit.portrait = await shrinkOne(outfit.portrait, preset.portrait, preset.portraitQuality);
    if (g.witchForm) g.witchForm.portrait = await shrinkOne(g.witchForm.portrait, preset.portrait, preset.portraitQuality);
    if (g.importedVariants) for (const key of Object.keys(g.importedVariants)) {
      g.importedVariants[key] = await shrinkOne(g.importedVariants[key], preset.variant, preset.variantQuality);
    }
    return { card, failed: failed.length };
  }, { card, preset });
}

fs.mkdirSync(outputDir, { recursive: true });
const files = fs.readdirSync(inputDir).filter(name => name.toLowerCase().endsWith('.json'));
const rows = [];
for (const name of files.sort()) {
  const source = path.join(inputDir, name);
  let card;
  try { card = JSON.parse(fs.readFileSync(source, 'utf8')); } catch { rows.push({ name, note: '不是 JSON，跳过' }); continue; }
  if (card?.format !== 'night-sugar/girl-card') { rows.push({ name, note: '不是契约卡，跳过' }); continue; }
  const before = fs.statSync(source).size;
  let text = '';
  let used = PRESETS[PRESETS.length - 1].label;
  for (const preset of PRESETS) {
    const result = await shrink(card, preset);
    text = JSON.stringify(result.card);
    used = preset.label;
    if (Buffer.byteLength(text) <= MAX_BYTES) break;
  }
  const check = parseGirlCard(text);
  if (!check.ok) { rows.push({ name, note: '校验失败：' + check.message }); continue; }
  const target = path.join(outputDir, name);
  fs.writeFileSync(target, text);
  rows.push({ name, before, after: Buffer.byteLength(text), preset: used, ok: true });
}
await browser.close();

for (const row of rows) {
  if (!row.ok) { console.log('✖', row.name, row.note); continue; }
  console.log('✔', row.name, (row.before / 1048576).toFixed(2) + 'MB →', (row.after / 1048576).toFixed(2) + 'MB', '(' + row.preset + ')');
}
const ok = rows.filter(row => row.ok);
console.log('完成：' + ok.length + ' / ' + rows.length + ' 张，输出到 ' + outputDir);
