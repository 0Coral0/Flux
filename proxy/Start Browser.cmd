@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)
if not exist "node_modules\@mercuryworkshop\scramjet" (
  echo Installing the browser dependencies. This may take a moment...
  call npm ci
  if errorlevel 1 (
    echo Dependency installation failed. See README.md for help.
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:3030/ in your browser. Leave this window open while using Flux Browser.
call npm start
pause
