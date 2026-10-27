@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 夜糖事务所 / Night Sugar Office (production)
where npm >nul 2>nul
if errorlevel 1 (
  echo [夜糖] 没有找到 Node.js / npm。请先安装 Node 20 或更高版本。
  pause
  exit /b 1
)
call npm run build
if errorlevel 1 (
  echo [夜糖] 构建失败，已停止。
  pause
  exit /b 1
)
echo [夜糖] 构建完成，正在打开本地静态服务器...
start "" http://127.0.0.1:5173
node scripts/serve.mjs
pause