@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title 夜糖事务所 / Night Sugar Office

rem ── 唯一的 Windows 启动入口 ────────────────────────────────
rem   start.cmd           有构建产物就直接开门（没有就先构建一次）
rem   start.cmd rebuild   强制重新构建再开门
rem   start.cmd dev       开发服务器（改代码即时刷新）
rem   start.cmd build     只构建，不启动
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

set "MODE=%~1"
if /i "%MODE%"=="dev" goto dev
if /i "%MODE%"=="build" goto build_only
if /i "%MODE%"=="rebuild" goto build_serve
if exist "dist\index.html" goto serve
echo [夜糖] 还没有构建产物，先构建一次...
goto build_serve

:build_serve
echo [夜糖] 正在构建...
call npm run build
if errorlevel 1 (
  echo [夜糖] 构建失败，已停止。可以跑 start.cmd dev 看详细报错。
  pause
  exit /b 1
)
goto serve

:build_only
echo [夜糖] 正在构建...
call npm run build
if errorlevel 1 (
  echo [夜糖] 构建失败，已停止。
  pause
  exit /b 1
)
echo [夜糖] 构建完成，产物在 dist\ 。用 start.cmd 开门。
pause
exit /b 0

:serve
echo [夜糖] 正在开门... 浏览器会自动打开 http://127.0.0.1:5173
echo [夜糖] 要关掉事务所：按 Ctrl+C，或直接关闭这个窗口。
rem 先起服务再开浏览器：等两秒，免得浏览器比服务器先到、看到一片空白。
start "" cmd /c "timeout /t 2 >nul & start "" http://127.0.0.1:5173"
node scripts/serve.mjs
if errorlevel 1 (
  echo [夜糖] 服务没有起来。如果 5173 端口被占用，先关掉占用它的程序再试。
  pause
)
exit /b 0

:dev
echo [夜糖] 开发服务器启动中... http://127.0.0.1:5173
call npm run dev -- --host 127.0.0.1 --port 5173
if errorlevel 1 pause
exit /b 0
