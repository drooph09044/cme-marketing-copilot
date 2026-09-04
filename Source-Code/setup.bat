@echo off
setlocal EnableExtensions

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

echo.
echo ==========================================
echo  EXL Marketing Copilot - Environment Setup
echo ==========================================
echo.

call :find_python
if errorlevel 1 exit /b 1

if not exist ".venv\Scripts\python.exe" (
  echo Creating Python virtual environment...
  %PYTHON_CMD% -m venv .venv
  if errorlevel 1 (
    echo.
    echo Failed to create .venv. Install Python 3.10+ and make sure it is on PATH.
    exit /b 1
  )
) else (
  echo Python virtual environment already exists.
)

".venv\Scripts\python.exe" -m pip --version >nul 2>nul
if errorlevel 1 (
  echo Existing .venv is missing pip. Recreating Python virtual environment...
  rmdir /s /q .venv
  %PYTHON_CMD% -m venv .venv
  if errorlevel 1 (
    echo.
    echo Failed to recreate .venv. Install Python 3.10+ and make sure venv/ensurepip are available.
    exit /b 1
  )
)

echo Installing backend dependencies...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if errorlevel 1 exit /b 1
".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt
if errorlevel 1 exit /b 1

call :find_npm
if errorlevel 1 exit /b 1

echo Installing frontend dependencies...
"%NPM_CMD%" install
if errorlevel 1 exit /b 1

echo.
echo Setup complete.
echo Run start.bat to launch the backend and frontend.
echo.
exit /b 0

:find_python
set "PYTHON_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py -3"

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
  echo Python was not found. Install Python 3.10+ from https://www.python.org/downloads/
  exit /b 1
)

echo Using Python command: %PYTHON_CMD%
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
  echo npm was not found. Install Node.js 20+ from https://nodejs.org/
  echo If this repo includes a .tools Node bundle, run setup again after extracting/installing npm support.
  exit /b 1
)

echo Using npm: %NPM_CMD%
exit /b 0
