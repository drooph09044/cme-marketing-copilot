@echo off
setlocal EnableDelayedExpansion
REM ============================================================================
REM dev.bat - Windows convenience launcher for the dev stack.
REM
REM Usage:
REM   dev.bat                  Bootstrap (if needed) + open API and Web in two new windows
REM   dev.bat --api            Start only the FastAPI backend (foreground)
REM   dev.bat --web            Start only the Next.js dev server (foreground)
REM   dev.bat --setup          Install pnpm deps + create venv + pip install, then exit
REM
REM First run: creates apps\api\.venv if missing and runs `pip install -r requirements.txt`.
REM Subsequent runs: skips setup unless --setup is passed.
REM
REM Requires:
REM   - Node 20+ + pnpm 9+
REM   - Python 3.11+ on PATH
REM ============================================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

REM ---- Parse args -----------------------------------------------------------
set "MODE=both"
set "SETUP_ONLY=0"

:parse_args
if "%~1"=="" goto end_args
if /I "%~1"=="--api"   ( set "MODE=api"  & shift & goto parse_args )
if /I "%~1"=="--web"   ( set "MODE=web"  & shift & goto parse_args )
if /I "%~1"=="--setup" ( set "SETUP_ONLY=1" & shift & goto parse_args )
if /I "%~1"=="-h"      goto show_help
if /I "%~1"=="--help"  goto show_help
echo Unknown arg: %~1
exit /b 1

:show_help
echo Usage:
echo   dev.bat                  Bootstrap if needed, then open API + Web in two new windows
echo   dev.bat --api            Start only the FastAPI backend (foreground)
echo   dev.bat --web            Start only the Next.js dev server (foreground)
echo   dev.bat --setup          Install pnpm deps + Python venv + pip install, then exit
exit /b 0

:end_args

REM ---- Sanity checks --------------------------------------------------------
where pnpm >nul 2>nul
if errorlevel 1 (
    echo ERR: pnpm not found in PATH. Install from https://pnpm.io/installation
    exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
    where py >nul 2>nul
    if errorlevel 1 (
        echo ERR: Python not found in PATH. Install Python 3.11+ from python.org
        exit /b 1
    )
    set "PYCMD=py -3"
) else (
    set "PYCMD=python"
)

REM ---- Bootstrap (only if needed) -------------------------------------------
set "API_VENV=%ROOT%\apps\api\.venv"
set "WEB_NODE_MODULES=%ROOT%\node_modules"

if "%SETUP_ONLY%"=="1" (
    call :bootstrap
    if errorlevel 1 exit /b 1
    echo.
    echo Setup complete. Run 'dev.bat' to start the dev stack.
    exit /b 0
)

if not exist "%WEB_NODE_MODULES%" (
    echo node_modules missing - running pnpm install...
    call pnpm install
    if errorlevel 1 exit /b 1
)

if not exist "%API_VENV%\Scripts\python.exe" (
    call :bootstrap_python
    if errorlevel 1 exit /b 1
)

REM ---- Launch ---------------------------------------------------------------
if /I "%MODE%"=="api" goto run_api
if /I "%MODE%"=="web" goto run_web

REM Both: spawn two new windows so each runs in foreground in its own console.
echo Starting FastAPI backend (new window) and Next.js dev server (new window)...
start "Orchestrate API" cmd /k "cd /d %ROOT% && call dev.bat --api"
timeout /t 2 /nobreak >nul
start "Orchestrate Web" cmd /k "cd /d %ROOT% && call dev.bat --web"
echo.
echo Two windows opened. Close them or press Ctrl+C in each to stop.
echo   API:  http://localhost:8000/docs
echo   Web:  http://localhost:3000
exit /b 0

:run_api
echo Starting FastAPI on http://localhost:8000
echo (Ctrl+C to stop)
call "%API_VENV%\Scripts\activate.bat"
cd /d "%ROOT%\apps\api"
uvicorn app.main:app --reload --port 8000
goto :eof

:run_web
echo Starting Next.js on http://localhost:3000
echo (Ctrl+C to stop)
cd /d "%ROOT%"
call pnpm --filter @workflow-test/web dev
goto :eof

REM ---- Subroutines ----------------------------------------------------------
:bootstrap
echo Running pnpm install...
call pnpm install
if errorlevel 1 exit /b 1
call :bootstrap_python
exit /b %errorlevel%

:bootstrap_python
echo Creating Python venv at apps\api\.venv ...
%PYCMD% -m venv "%API_VENV%"
if errorlevel 1 (
    echo ERR: failed to create venv.
    exit /b 1
)
echo Installing Python dependencies...
call "%API_VENV%\Scripts\activate.bat"
"%API_VENV%\Scripts\pip.exe" install --upgrade pip

REM Core deps (no provider packages — keeps pip resolver fast)
"%API_VENV%\Scripts\pip.exe" install -r "%ROOT%\apps\api\requirements.txt"
if errorlevel 1 (
    echo ERR: pip install (core) failed.
    exit /b 1
)

REM Detect MODEL_PROVIDER from .env if present
set "PROVIDER_REQ="
if exist "%ROOT%\apps\api\.env" (
    for /f "usebackq tokens=1,2 delims==" %%A in ("%ROOT%\apps\api\.env") do (
        if /I "%%A"=="MODEL_PROVIDER" set "DETECTED_PROVIDER=%%B"
    )
)
if not defined DETECTED_PROVIDER set "DETECTED_PROVIDER=anthropic"

if /I "%DETECTED_PROVIDER%"=="anthropic"   set "PROVIDER_REQ=%ROOT%\apps\api\requirements-anthropic.txt"
if /I "%DETECTED_PROVIDER%"=="openai"      set "PROVIDER_REQ=%ROOT%\apps\api\requirements-openai.txt"
if /I "%DETECTED_PROVIDER%"=="azure_openai" set "PROVIDER_REQ=%ROOT%\apps\api\requirements-openai.txt"
if /I "%DETECTED_PROVIDER%"=="databricks"  set "PROVIDER_REQ=%ROOT%\apps\api\requirements-databricks.txt"

if defined PROVIDER_REQ (
    echo Installing provider extras for MODEL_PROVIDER=%DETECTED_PROVIDER%...
    "%API_VENV%\Scripts\pip.exe" install -r "%PROVIDER_REQ%"
    if errorlevel 1 (
        echo ERR: pip install (provider extras) failed.
        exit /b 1
    )
) else (
    echo [WARN] Unknown MODEL_PROVIDER=%DETECTED_PROVIDER% - skipping provider extras.
    echo        Install manually: pip install -r apps\api\requirements-^<provider^>.txt
)

echo Python deps installed.
exit /b 0
