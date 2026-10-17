@echo off
setlocal
cd /d "%~dp0proxy"
if not exist "node_modules\@mercuryworkshop\scramjet" (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:3031/ and select Browser.
node start-flux.mjs
pause
