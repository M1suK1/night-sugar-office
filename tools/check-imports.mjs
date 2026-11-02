#!/usr/bin/env node
/**
 * v35 拆分护栏：检查 src/rules 的依赖图与文件体积。
 *
 *   node tools/check-imports.mjs
 *
 * 规则（来自 tasks/plan-v35.md）：
 *   1. 单文件 ≤ 450 行（act.ts ≤ 300）。
 *   2. src/rules 内不得成环。
 *   3. rules 模块不得反向 import ../game.ts（barrel 只能被 UI/测试使用）。
 *   4. persistence.ts 是终点：除了 act 之外没有模块可以 import 它。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'src', 'rules');
const LIMIT = 450;
const LIMITS = { 'act.ts': 300 };
const SINK = 'persistence.ts';

if (!existsSync(dir)) {
  console.log('src/rules 还不存在，跳过。');
  process.exit(0);
}

const files = readdirSync(dir).filter(name => name.endsWith('.ts')).sort();
const problems = [];
const graph = new Map();

for (const name of files) {
  const path = join(dir, name);
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n').length;
  const limit = LIMITS[name] ?? LIMIT;
  if (lines > limit) problems.push(`${name} 有 ${lines} 行，超过上限 ${limit}`);

  const deps = new Set();
  for (const match of text.matchAll(/from\s+'([^']+)'/g)) {
    const spec = match[1];
    if (spec === '../game.ts' || spec === '../game') {
      problems.push(`${name} 反向 import 了 barrel（${spec}）`);
      continue;
    }
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(path), spec);
    const targetName = relative(dir, target);
    if (!targetName.startsWith('..') && targetName.endsWith('.ts')) {
      deps.add(targetName);
      if (targetName === SINK && name !== 'act.ts') {
        problems.push(`${name} 依赖了终点模块 ${targetName}`);
      }
    }
  }
  graph.set(name, [...deps]);
}

const state = new Map();
const stack = [];
const walk = name => {
  if (state.get(name) === 'done') return;
  if (state.get(name) === 'open') {
    const at = stack.indexOf(name);
    problems.push(`循环依赖：${[...stack.slice(at), name].join(' → ')}`);
    return;
  }
  state.set(name, 'open');
  stack.push(name);
  for (const next of graph.get(name) ?? []) walk(next);
  stack.pop();
  state.set(name, 'done');
};
for (const name of files) walk(name);

/**
 * BOM 检查：PowerShell 5.1 的 Set-Content -Encoding utf8 会写入 BOM，
 * package.json 带 BOM 时 Vite 解析 PostCSS 配置会直接失败（v35 踩过）。
 */
const bomTargets = ['package.json', 'tsconfig.json', 'README.md', '.gitignore'];
const bomWalk = (dir, ext) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { bomWalk(full, ext); continue; }
    if (ext.test(entry.name)) bomTargets.push(relative(root, full));
  }
};
for (const dir of ['src', 'tools', 'tests', 'tasks']) {
  if (existsSync(join(root, dir))) bomWalk(join(root, dir), /\.(ts|tsx|mjs|js|json|md|css)$/);
}
for (const name of bomTargets) {
  const full = join(root, name);
  if (!statSync(full, { throwIfNoEntry: false })?.isFile()) continue;
  const buffer = readFileSync(full);
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) problems.push(`${name} 带 UTF-8 BOM，会让 JSON.parse / PostCSS 配置加载失败`);
}

if (problems.length) {
  console.error(`check-imports 失败（${problems.length} 项）：`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`check-imports 通过：${files.length} 个模块、无环、体积达标、无 BOM。`);
