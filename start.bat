@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Chua cai Node.js. Truy cap https://nodejs.org de cai Node.js LTS.
  pause
  exit /b 1
)
echo PITCH PULSE dang chay tai http://localhost:3000
node server.js
pause
