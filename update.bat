@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>nul
cd /d "%~dp0"
title 夜糖事务所 / 更新与重新构建

rem ── 更新入口 ──────────────────────────────────────────────
rem   update.bat         拉依赖（缺了才装）+ 重新构建，产物写进 dist\
rem   update.bat pull    先 git pull --ff-only 再构建（本地有未提交改动时会被拒绝）
rem
rem 改了代码、或从远端拉了新版本之后跑这个：CF 试玩页那边也是把 dist\ 重新上传。

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

set "MODE=%~1"
if /i "%MODE%"=="pull" goto pull
goto deps

:pull
where git >nul 2>nul
if errorlevel 1 (
  echo [夜糖] 没找到 git，跳过拉取，直接按本地代码构建。
  goto deps
)
echo [夜糖] 正在从远端拉取最新代码...
git pull --ff-only
if errorlevel 1 (
  echo [夜糖] git pull 没成功（本地有改动或分支不一致）。
  echo [夜糖] 先自己处理一下再更新；这次先按当前代码继续构建。
)

:deps
if not exist "node_modules" (
  echo [夜糖] 正在安装依赖，可能需要几分钟...
  call npm install
  if errorlevel 1 (
    echo [夜糖] 依赖安装失败，请检查网络或代理设置。
    pause
    exit /b 1
  )
)

rem 构建要 import 这个文件；仓库没更新到最新时它缺失，esbuild 只会丢一句难懂的错误。
if not exist "scripts\static-cards.mjs" (
  echo [夜糖] 缺少 scripts\static-cards.mjs（构建要用它）。请先在仓库里 git pull 更新。
  pause
  exit /b 1
)

echo [夜糖] 正在构建... 输出会写进 build-error.log，失败时整篇回放。
call npm run build > "build-error.log" 2>&1
if errorlevel 1 (
  echo.
  echo ───────── 构建输出 ─────────
  type "build-error.log"
  echo ───────────────────────────
  echo [夜糖] 构建失败。完整日志留在 build-error.log。
  echo [夜糖] 如果日志里提到 esbuild 的原生包，运行 start.bat repair 重装一次。
  pause
  exit /b 1
)
del "build-error.log" >nul 2>nul

if not exist "dist\index.html" (
  echo [夜糖] 构建跑完了，但没有看到 dist\index.html，产物似乎不完整。
  echo [夜糖] 检查一下 vite 配置里的 outDir，或把上面窗口里的输出发出来。
  pause
  exit /b 1
)

echo [夜糖] 构建完成，产物在 dist\ 。
for %%F in ("dist\index.html") do echo [夜糖] index.html 更新时间：%%~tF
echo [夜糖] 本地试玩：运行 start.bat（会直接读取 dist\）。
echo [夜糖] CF 试玩页：把 dist\ 整个重新上传（或 gh-pages / Pages 部署）即可生效。
pause
exit /b 0

