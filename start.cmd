@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 夜糖事务所 / Night Sugar Office
where npm >nul 2>nul
if errorlevel 1 (
  echo [夜糖] 没有找到 Node.js / npm。请先安装 Node 20 或更高版本。
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo [夜糖] 首次启动，正在安装依赖...
  call npm install
  if errorlevel 1 (
    echo [夜糖] 依赖安装失败，请检查网络或代理设置。
    pause
    exit /b 1
  )
)
echo [夜糖] 正在启动开发服务器...
call npm run dev -- --host 127.0.0.1 --port 5173
if errorlevel 1 pause