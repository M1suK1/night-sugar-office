/**
 * 把本地存档里的预设导出成随包发布的两份 JSON（v178）。
 *
 * 本地调好的预设只活在浏览器与 data/kv 里，CF 试玩页是另一个人、另一台机器。
 * 这里把 data/kv 里的 `presets/custom` 与 `presets/binding` 抄一份到 public/presets/，
 * 构建时跟着 dist 一起发出去；应用启动时会把它补进预设列表（同 id 跳过）。
 *
 * 用法：node tools/export-local-presets.mjs
 * 注意：预设里的 `api`（provider / model / endpoint）一律剥掉，不把模型选择带到公共页面。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');
const kvDir = join(root, 'data', 'kv');
const outDir = join(root, 'public', 'presets');

function readKv(key) {
  const index = JSON.parse(readFileSync(join(kvDir, 'index.json'), 'utf8'));
  const entry = index[key];
  if (!entry) throw new Error(`data/kv 里没有「${key}」。先在本地玩一遍，让存档把预设写进去。`);
  return JSON.parse(readFileSync(join(kvDir, 'objects', entry.file), 'utf8'));
}

const presets = readKv('presets/custom');
if (!Array.isArray(presets)) throw new Error('presets/custom 不是一个数组。');

const cleaned = presets.map(preset => ({
  id: preset.id,
  name: preset.name,
  description: (preset.description ?? '').trim() || '从本地存档同步过来的预设。',
  schema: preset.schema,
  settings: preset.settings,
  prompts: preset.prompts,
  promptOrder: preset.promptOrder,
  regex: preset.regex,
  createdAt: preset.createdAt,
  updatedAt: preset.updatedAt,
}));

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'local.json'), JSON.stringify(cleaned), 'utf8');

let bindingLine = '';
try {
  const binding = readKv('presets/binding');
  writeFileSync(join(outDir, 'binding.json'), JSON.stringify(binding), 'utf8');
  bindingLine = `、绑定 ${Object.keys(binding).length} 个用途`;
} catch {
  bindingLine = '（没有找到绑定，跳过 binding.json）';
}

console.log(`已导出 ${cleaned.length} 份预设到 public/presets/local.json${bindingLine}。`);
console.log(cleaned.map(preset => `- ${preset.name}（${preset.prompts?.length ?? 0} 条词条）`).join('\n'));
