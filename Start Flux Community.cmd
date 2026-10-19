@echo off
cd /d "%~dp0discord-bridge"
if not exist node_modules\discord.js\package.json (
  echo Install the community service packages first: npm --prefix discord-bridge ci
  pause
  exit /b 1
)
if not exist .env copy .env.example .env >nul
node --env-file=.env pc-launcher.mjs
pause
