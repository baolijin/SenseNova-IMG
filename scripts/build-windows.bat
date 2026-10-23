@echo off
setlocal
cd /d "%~dp0.."

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the packaging script.
  echo Install it from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

node scripts\build-sea.js --platform win --arch x64
if errorlevel 1 (
  echo.
  echo Packaging failed.
  pause
  exit /b 1
)

echo.
pause
endlocal
