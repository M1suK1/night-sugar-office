#!/usr/bin/env node
/**
 * Vite 的启动器：把 esbuild 的临时目录固定到仓库内的 `.tmp/`。
 *
 * 沙箱（以及部分 Windows 受限账户）只允许删除工作区内的文件，而 esbuild 默认把
 * 中转文件写到系统临时目录，转译完再 `remove` 就会撞上
 * `[vite:esbuild-transpile] remove C:\...\Temp\esbuild-...: Access is denied`。
 * 把 TEMP/TMP/TMPDIR 指到 `.tmp/` 之后，构建与开发服务器都不再碰系统临时目录。
 */
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tmp = join(root, '.tmp');
mkdirSync(tmp, { recursive: true });

const env = { ...process.env, TEMP: tmp, TMP: tmp, TMPDIR: tmp };
const cli = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: 'inherit', env });
child.on('exit', code => process.exit(code ?? 0));
child.on('error', error => {
  console.error(error);
  process.exit(1);
});
