@echo off
setlocal
cd /d "%~dp0proxy"
if not exist "node_modules\@mercuryworkshop\scramjet" (
  call npm ci
  if errorlevel 1 exit /b 1
)
node tunnel-launcher.mjs
pause
