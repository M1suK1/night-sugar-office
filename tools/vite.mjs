#!/usr/bin/env node
/**
 * Vite 的启动器：把 esbuild 的临时目录固定到仓库内的 `.tmp/`，并换掉配置文件的加载方式。
 *
 * 1) 临时目录：沙箱（以及部分 Windows 受限账户）只允许删除工作区内的文件，而 esbuild
 *    默认把中转文件写到系统临时目录，转译完再 `remove` 就会撞上
 *    `[vite:esbuild-transpile] remove C:\...\Temp\esbuild-...: Access is denied`。
 *    把 TEMP/TMP/TMPDIR 指到 `.tmp/` 之后，构建与开发服务器都不再碰系统临时目录。
 *
 * 2) 配置加载：Vite 默认先用 esbuild 打包 `vite.config.ts`。esbuild 解析路径时会一路
 *    向上找 `node_modules`，在受限账户/沙箱里读到工作区外的目录就直接
 *    `Cannot read directory "../../../..": Access is denied`，整个 build/dev/preview 起不来。
 *    Node 22.6+ 能原生加载 TypeScript，所以改用 `--configLoader runner`：
 *    配置走 Node 原生 import，不再触发那次向上解析。旧版 Node 仍按默认方式加载。
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

const args = process.argv.slice(2);
// `process.features.typescript` 在能原生跑 TS 的 Node 上是 'strip' / 'transform'。
const nativeTypeScript = Boolean(process.features?.typescript);
if (nativeTypeScript && !args.some(arg => arg === '--configLoader' || arg.startsWith('--configLoader='))) {
  args.push('--configLoader', 'runner');
}

const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit', env });
child.on('exit', code => process.exit(code ?? 0));
child.on('error', error => {
  console.error(error);
  process.exit(1);
});
