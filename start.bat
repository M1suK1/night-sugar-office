@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
cd /d "%~dp0"
title 夜糖事务所 / Night Sugar Office

rem ── 唯一的 Windows 启动入口 ────────────────────────────────
rem   start.bat           有构建产物就直接开门（没有就先构建一次）
rem   start.bat rebuild   强制重新构建再开门
rem   start.bat dev       开发服务器（改代码即时刷新）
rem   start.bat build     只构建，不启动
rem
rem 构建模式用 scripts/serve.mjs 起本地服务：它同时提供 /api/* 本地文件通道，
rem 所以生产模式一样能读 data/cards 里的全部卡库。

where node >nul 2>nul
if errorlevel 1 (
  echo [夜糖] 没有找到 Node.js。请先安装 Node 20 或更高版本，再双击这个文件。
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [夜糖] 找到了 node 但没有 npm，请重新安装 Node.js（安装时勾选 npm）。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [夜糖] 首次启动，正在安装依赖，可能需要几分钟...
  call npm install
  if errorlevel 1 (
    echo [夜糖] 依赖安装失败，请检查网络或代理设置。
    pause
    exit /b 1
  )
)

rem 构建会 import 这个文件；仓库没更新到最新时它缺失，esbuild 只会丢一句难懂的错误。
if not exist "scripts\static-cards.mjs" (
  echo [夜糖] 缺少 scripts\static-cards.mjs（构建要用它）。请先在仓库里 git pull 更新。
  pause
  exit /b 1
)

set "MODE=%~1"
if /i "%MODE%"=="dev" goto dev
if /i "%MODE%"=="build" goto build_only
if /i "%MODE%"=="rebuild" goto build_serve
if /i "%MODE%"=="repair" goto repair
if exist "dist\index.html" goto serve
echo [夜糖] 还没有构建产物，先构建一次...
goto build_serve

:build_serve
echo [夜糖] 正在构建...
call :run_build
if errorlevel 1 exit /b 1
goto serve

:build_only
echo [夜糖] 正在构建...
call :run_build
if errorlevel 1 exit /b 1
echo [夜糖] 构建完成，产物在 dist\ 。用 start.bat 开门。
pause
exit /b 0

:repair
echo [夜糖] 正在修复依赖（esbuild 这类原生包装坏了会直接 build 报错）...
call npm install
if errorlevel 1 (
  echo [夜糖] npm install 失败，请检查网络或代理设置。
  pause
  exit /b 1
)
echo [夜糖] 重新绑定 esbuild 的原生二进制...
call npm rebuild esbuild
if errorlevel 1 (
  echo [夜糖] npm rebuild esbuild 失败。可以删掉 node_modules 再运行 start.bat 重装。
  pause
  exit /b 1
)
echo [夜糖] 修好了。现在运行 start.bat 试试；还报错就把 build-error.log 里的 ERROR 段落发出来。
pause
exit /b 0

rem ── 构建并保留日志 ──────────────────────────────────────────
rem 输出先写进 build-error.log 再整篇回放：这样窗口关掉、报错刷没了，
rem 日志也还在项目根目录，方便直接把 ERROR 段落贴出来。
:run_build
call npm run build > "build-error.log" 2>&1
if errorlevel 1 (
  echo.
  echo ───────── 构建输出 ─────────
  type "build-error.log"
  echo ───────────────────────────
  echo [夜糖] 构建失败。完整日志已存到 build-error.log。
  echo [夜糖] 想看浏览器里的报错浮层就运行 start.bat dev。
  echo [夜糖] 如果日志里是 esbuild 的原生包问题，运行 start.bat repair 重装一次。
  pause
  exit /b 1
)
del "build-error.log" >nul 2>nul
exit /b 0

:serve
echo [夜糖] 正在开门... 浏览器会自动打开 http://127.0.0.1:5173
echo [夜糖] 要关掉事务所：按 Ctrl+C，或直接关闭这个窗口。
echo [夜糖] 改了代码想跑最新版：先关掉窗口，再运行 start.bat rebuild
rem 交给 PowerShell 延迟两秒开浏览器：cmd 里再嵌一层带引号的 start 很容易被引号吃掉。
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:5173'"
node scripts/serve.mjs
rem 走到这里通常是 Ctrl+C 关掉了服务，不算失败；只有端口被占用才是真起不来。
set "CODE=%ERRORLEVEL%"
if not "%CODE%"=="0" (
  echo [夜糖] 服务已停止（退出码 %CODE%）。如果 5173 端口被占用，先关掉占用它的程序再试。
)
exit /b 0

:dev
echo [夜糖] 开发服务器启动中... http://127.0.0.1:5173
call npm run dev -- --host 127.0.0.1 --port 5173
if errorlevel 1 pause
exit /b 0
