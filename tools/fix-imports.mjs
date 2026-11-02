#!/usr/bin/env node
/**
 * v35 辅助工具：按最近一次 `tsc --noEmit` 的输出修正 import。
 *
 *   node ./node_modules/typescript/bin/tsc --noEmit > tools/.tsc.txt
 *   node tools/fix-imports.mjs
 *
 * 处理三类错误：
 *   TS2304 Cannot find name 'X'          → 从 src 里找到 X 的导出位置并补 import
 *   TS6133 'X' is declared but never read → 从 import 里删掉 X
 *   TS6192 All imports unused             → 整行删掉
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'src');
const rules = join(src, 'rules');
const IMPORTS = /^import (type )?\{([^}]*)\} from '([^']+)';$/;

const index = new Map();
const walk = dir => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.ts')) continue;
    if (full === join(src, 'game.ts')) continue;
    const rel = full.slice(src.length + 1).replace(/\\/g, '/');
    const text = readFileSync(full, 'utf8');
    for (const match of text.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|interface|type|class)\s+([A-Za-z0-9_$]+)/gm)) {
      if (!index.has(match[1])) index.set(match[1], rel);
    }
  }
};
walk(src);

const output = readFileSync(join(root, 'tools', '.tsc.txt'), 'utf8').replace(/^\uFEFF/, '').replace(/\r/g, '');
const missing = new Map();
const unused = new Map();
const deadLines = new Map();
for (const line of output.split('\n')) {
  const whole = /^(src\/[^(]+\.ts)\((\d+),\d+\): error TS6192:/.exec(line);
  if (whole) {
    if (!deadLines.has(whole[1])) deadLines.set(whole[1], new Set());
    deadLines.get(whole[1]).add(Number(whole[2]));
    continue;
  }
  const miss = /^(src\/[^(]+\.ts)\(\d+,\d+\): error TS2304: Cannot find name '([^']+)'/.exec(line);
  if (miss) {
    if (!missing.has(miss[1])) missing.set(miss[1], new Set());
    missing.get(miss[1]).add(miss[2]);
    continue;
  }
  const dead = /^(src\/[^(]+\.ts)\(\d+,\d+\): error TS6133: '([^']+)' is declared but its value is never read/.exec(line);
  if (dead) {
    if (!unused.has(dead[1])) unused.set(dead[1], new Set());
    unused.get(dead[1]).add(dead[2]);
  }
}

const specFor = (file, rel) => (file.startsWith('src/rules/') ? '../' + rel : './' + rel);
const parse = line => {
  const match = IMPORTS.exec(line);
  if (!match) return null;
  return { typeOnly: Boolean(match[1]), names: match[2].split(',').map(name => name.trim()).filter(Boolean), spec: match[3] };
};

let added = 0;
let removed = 0;
const files = new Set([...missing.keys(), ...unused.keys(), ...deadLines.keys()]);
for (const file of files) {
  const full = join(root, file);
  const lines = readFileSync(full, 'utf8').split('\n');
  const drop = unused.get(file) ?? new Set();
  const skip = deadLines.get(file) ?? new Set();
  const add = missing.get(file) ?? new Set();
  const next = [];
  for (let row = 0; row < lines.length; row += 1) {
    const line = lines[row];
    if (skip.has(row + 1)) continue;
    const parsed = parse(line);
    if (!parsed) { next.push(line); continue; }
    const kept = parsed.names.filter(name => !drop.has(name));
    if (kept.length !== parsed.names.length) removed += parsed.names.length - kept.length;
    if (!kept.length) continue;
    next.push(`import ${parsed.typeOnly ? 'type ' : ''}{ ${kept.join(', ')} } from '${parsed.spec}';`);
  }
  for (const name of add) {
    const rel = index.get(name);
    if (!rel) { console.error(`找不到 ${name} 的导出位置（${file}）`); continue; }
    const spec = specFor(file, rel);
    const at = next.findIndex(line => parse(line)?.spec === spec);
    if (at >= 0) {
      const parsed = parse(next[at]);
      const names = [...new Set([...parsed.names, name])].sort().join(', ');
      next[at] = `import ${parsed.typeOnly ? 'type ' : ''}{ ${names} } from '${spec}';`;
    } else {
      const insertAt = next.findIndex(line => line.startsWith('import '));
      next.splice(insertAt >= 0 ? insertAt : 0, 0, `import { ${name} } from '${spec}';`);
    }
    added += 1;
  }
  writeFileSync(full, next.join('\n'), 'utf8');
}
console.log(`fix-imports：补 ${added} 个、清 ${removed} 个（${files.size} 个文件）`);

// 最后一趟：按目标文件的导出种类，把只含类型的 import 改写成 import type。
// Node 的 --experimental-strip-types 不会消除类型导入，混着写会在运行时炸「does not provide an export」。
const typeCache = new Map();
const exportsOf = file => {
  if (typeCache.has(file)) return typeCache.get(file);
  const text = readFileSync(file, 'utf8');
  const typeOnly = new Set();
  const values = new Set();
  for (const match of text.matchAll(/^export\s+(?:async\s+)?(interface|type|const|let|function|class)\s+([A-Za-z0-9_$]+)/gm)) {
    if (match[1] === 'interface' || match[1] === 'type') typeOnly.add(match[2]);
    else values.add(match[2]);
  }
  for (const name of values) typeOnly.delete(name);
  const result = { typeOnly };
  typeCache.set(file, result);
  return result;
};

let normalised = 0;
for (const file of [...readdirSync(rules).map(name => join(rules, name)), join(src, 'game.ts')]) {
  const lines = readFileSync(file, 'utf8').replace(/\r/g, '').split('\n');
  const out = [];
  let touched = false;
  for (const line of lines) {
    const match = /^import (type )?\{([^}]*)\} from '([^']+)';$/.exec(line);
    if (!match || match[1] || !match[3].startsWith('.')) { out.push(line); continue; }
    const target = join(dirname(file), match[3]);
    if (!existsSync(target)) { out.push(line); continue; }
    const { typeOnly } = exportsOf(target);
    if (!typeOnly.size) { out.push(line); continue; }
    const names = match[2].split(',').map(name => name.trim()).filter(Boolean);
    const types = names.filter(name => typeOnly.has(name));
    const values = names.filter(name => !typeOnly.has(name));
    if (!types.length) { out.push(line); continue; }
    if (types.length) out.push(`import type { ${types.join(', ')} } from '${match[3]}';`);
    if (values.length) out.push(`import { ${values.join(', ')} } from '${match[3]}';`);
    touched = true;
  }
  if (touched) { writeFileSync(file, out.join('\n'), 'utf8'); normalised += 1; }
}
if (normalised) console.log(`fix-imports：${normalised} 个文件的类型 import 改成 import type`);
