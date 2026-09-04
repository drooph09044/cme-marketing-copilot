@echo off
setlocal EnableExtensions

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo.
echo =========================================
echo  EXL Marketing Copilot - Starting App
echo =========================================
echo.

if not exist ".venv\Scripts\python.exe" (
  echo .venv was not found. Running setup.bat first...
  call "%APP_DIR%setup.bat"
  if errorlevel 1 exit /b 1
)

if not exist "node_modules" (
  echo node_modules was not found. Running setup.bat first...
  call "%APP_DIR%setup.bat"
  if errorlevel 1 exit /b 1
)

call :find_npm
if errorlevel 1 exit /b 1

echo Starting Flask backend on http://127.0.0.1:5001
start "EXL Marketing Copilot Backend" cmd /k "cd /d ""%APP_DIR%"" && ""%APP_DIR%.venv\Scripts\python.exe"" backend\app.py"

echo Starting Vite frontend on http://127.0.0.1:5173
start "EXL Marketing Copilot Frontend" cmd /k "cd /d ""%APP_DIR%"" && ""%NPM_CMD%"" run dev -- --host 127.0.0.1"

echo.
echo App is starting in two terminal windows.
echo Frontend: http://127.0.0.1:5173/
echo Backend:  http://127.0.0.1:5001/
echo.
exit /b 0

:find_npm
set "NPM_CMD="

for /f "delims=" %%N in ('where npm.cmd 2^>nul') do (
  if /I not "%%~fN"=="%APP_DIR%npm.cmd" (
    if not defined NPM_CMD set "NPM_CMD=%%~fN"
  )
)

if not defined NPM_CMD (
  if exist "%APP_DIR%.tools\node-v22.22.2-win-x64\node_modules\npm\bin\npm-cli.js" (
    set "NPM_CMD=%APP_DIR%npm.cmd"
  )
)

if not defined NPM_CMD (
  echo npm was not found. Install Node.js 20+ from https://nodejs.org/ or run setup.bat after preparing the bundled Node tools.
  exit /b 1
)

exit /b 0
