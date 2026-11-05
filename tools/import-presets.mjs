/**
 * 把导出的「夜糖-对话预设-*.json」转成仓库里的 TS 模块。
 *
 * 为什么是 TS 而不是直接 import JSON：Node 的 ESM 读 JSON 需要 import attributes，
 * 而测试是用 `node --experimental-strip-types` 直接跑 .ts 的；转成 TS 模块两边都能跑，
 * 也不必为打包器加配置。
 *
 * 用法：node tools/import-presets.mjs <预设目录>
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/** 文件名里的中文用途 → 任务作用域 + 内置预设 id。 */
const SCOPES = [
  { keyword: '每日提案', scope: 'daily' },
  { keyword: '故事线', scope: 'storyline' },
  { keyword: '完整剧情', scope: 'arc' },
  { keyword: '角色对话', scope: 'chat' },
  { keyword: '私人事件', scope: 'event' },
  { keyword: '战斗札记', scope: 'battle' },
  { keyword: '角色起草', scope: 'profile' },
  { keyword: '服装词条', scope: 'outfit' },
];

const root = process.cwd();
const outDir = path.join(root, 'src', 'content', 'presets', 'shipped');
const sourceDir = process.argv[2];

if (!sourceDir) {
  console.error('用法：node tools/import-presets.mjs <预设目录> [--only <scope>]');
  process.exit(1);
}

// 只更新某一份（例如只想换「完整剧情」）：--only arc
const onlyAt = process.argv.indexOf('--only');
const only = onlyAt > 0 ? process.argv[onlyAt + 1] : '';

const files = await fs.readdir(sourceDir);
const picked = new Map();
for (const name of files) {
  if (!name.toLowerCase().endsWith('.json')) continue;
  // 「角色对话 (1).json」这种副本跳过：同名只留最短的那个文件名（没有空格括号）。
  const hit = SCOPES.find(item => name.includes(item.keyword));
  if (!hit) continue;
  if (only && hit.scope !== only) continue;
  const known = picked.get(hit.scope);
  if (!known || name.length < known.length) picked.set(hit.scope, name);
}
if (only && picked.size === 0) {
  console.error(`没在 ${sourceDir} 里找到「${only}」对应的导出文件。`);
  process.exit(1);
}

await fs.mkdir(outDir, { recursive: true });
const index = [];
for (const [scope, name] of picked) {
  const raw = JSON.parse(await fs.readFile(path.join(sourceDir, name), 'utf8'));
  const presetName = typeof raw.name === 'string' ? raw.name : scope;
  // 只保留我们自己认识的字段，避免把导出时的临时字段带进来。
  const keep = ['schema', 'temp_openai', 'top_p_openai', 'openai_max_tokens', 'openai_max_context',
    'pres_pen_openai', 'freq_pen_openai', 'main', 'jailbreak', 'prompts', 'extensions', 'description', 'prompt_order'];
  const cleaned = Object.fromEntries(keep.filter(key => key in raw).map(key => [key, raw[key]]));
  const id = `shipped-${scope}`;
  const body = `/** 出厂预设：${presetName}（${scope}）· 由 tools/import-presets.mjs 从导出文件生成，请勿手改。 */\nexport const PRESET = ${JSON.stringify(cleaned, null, 2)} as unknown;\n`;
  await fs.writeFile(path.join(outDir, `${scope}.ts`), body, 'utf8');
  index.push({ scope, name: presetName, id });
  console.log(`✓ ${scope} ← ${name}（${(JSON.stringify(cleaned).length / 1024).toFixed(0)}KB）`);
}

// 只更新一份时不重写清单：清单是「全部」的产物，局部导入不该动它。
if (only) {
  console.log(`只更新了 ${only}，清单 index.ts 保持原样。`);
} else {
  const indexBody = `/** 出厂预设清单：由 tools/import-presets.mjs 生成，请勿手改。 */\n${index
  .map(item => `import { PRESET as ${item.scope.toUpperCase()}_PRESET } from './${item.scope}.ts';`)
  .join('\n')}\n\nexport interface ShippedPreset {\n  id: string;\n  /** 这份预设服务哪个任务作用域。 */\n  scope: string;\n  name: string;\n  raw: unknown;\n}\n\nexport const SHIPPED_PRESETS: ShippedPreset[] = [\n${index
  .map(item => `  { id: '${item.id}', scope: '${item.scope}', name: ${JSON.stringify(item.name)}, raw: ${item.scope.toUpperCase()}_PRESET },`)
  .join('\n')}\n];\n`;
  await fs.writeFile(path.join(outDir, 'index.ts'), indexBody, 'utf8');
}
console.log(`共 ${index.length} 份，写到 src/content/presets/shipped/`);
