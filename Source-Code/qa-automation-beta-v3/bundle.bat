@echo off
setlocal EnableDelayedExpansion
REM ============================================================================
REM bundle.bat - Windows equivalent of bundle.sh
REM Zips the repo into a portable archive, skipping build artifacts, venvs,
REM and anything else covered by .gitignore.
REM
REM Usage:
REM   bundle.bat                  Output to dist\orchestrate-YYYYMMDD-HHMMSS.zip
REM   bundle.bat my-name          Output to dist\my-name.zip
REM   bundle.bat --git            Use `git ls-files` (tracked + not-ignored)
REM
REM Requires:
REM   - PowerShell 5+ (preinstalled on Windows 10/11)
REM   - git (only when using --git)
REM ============================================================================

REM ---- Resolve repo root (script location) ----------------------------------
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

REM ---- Parse arguments ------------------------------------------------------
set "USE_GIT=0"
set "NAME="

:parse_args
if "%~1"=="" goto end_args
if /I "%~1"=="--git" (
    set "USE_GIT=1"
    shift
    goto parse_args
)
if /I "%~1"=="-h" goto show_help
if /I "%~1"=="--help" goto show_help
set "NAME=%~1"
shift
goto parse_args

:show_help
echo Usage:
echo   bundle.bat                  Output to dist\orchestrate-YYYYMMDD-HHMMSS.zip
echo   bundle.bat my-name          Output to dist\my-name.zip
echo   bundle.bat --git            Use `git ls-files` (tracked + not-ignored)
exit /b 0

:end_args

REM ---- Compute timestamp + default name -------------------------------------
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value 2^>nul') do set "DT=%%I"
if not defined DT (
    REM Fallback: PowerShell-based timestamp if wmic is unavailable
    for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "DT=%%I"
) else (
    set "DT=!DT:~0,8!-!DT:~8,6!"
)

if not defined NAME set "NAME=orchestrate-%DT%"

set "OUT_DIR=%ROOT%\dist"
set "OUT_FILE=%OUT_DIR%\%NAME%.zip"

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"

REM Delete any pre-existing archive of the same name
if exist "%OUT_FILE%" del /q "%OUT_FILE%"

REM ---- Sanity check ---------------------------------------------------------
where powershell >nul 2>nul
if errorlevel 1 (
    echo ERR: PowerShell not found in PATH. PowerShell 5+ is required.
    exit /b 1
)

REM ---- Bundle ---------------------------------------------------------------
if "%USE_GIT%"=="1" (
    if not exist ".git" (
        echo ERR: --git requested but this isn't a git repo.
        exit /b 1
    )
    echo Bundling tracked + untracked-not-ignored files via git...
    REM Get file list from git, hand to PowerShell for zipping
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$files = & git ls-files -co --exclude-standard;" ^
        "if (-not $files) { Write-Error 'No files returned from git ls-files'; exit 1 };" ^
        "Compress-Archive -Path $files -DestinationPath '%OUT_FILE%' -CompressionLevel Optimal -Force"
) else (
    echo Bundling all files except build artifacts and ignored paths...
    REM PowerShell handles recursive exclusion much better than batch / tar.
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$root = '%ROOT%';" ^
        "$out  = '%OUT_FILE%';" ^
        "$excludeDirs = @('.git','node_modules','.pnpm-store','.next','out','.vercel','.turbo','dist','build','__pycache__','.venv','venv','env','.pytest_cache','.mypy_cache','.ruff_cache','.nyc_output','coverage','playwright-report','test-results','.idea','.vscode','.fleet','.zed','.cursor','.cline','.continue');" ^
        "$excludeNames = @('.DS_Store','Thumbs.db','Desktop.ini','.env','.env.local');" ^
        "$excludePatterns = @('*.pyc','*.pyo','*.pyd','*.log','*.tsbuildinfo','*.bak','*.tmp','*.swp','*.swo','*.pid','*.egg-info','.env.*.local','next-env.d.ts');" ^
        "$rootLen = $root.Length + 1;" ^
        "$files = Get-ChildItem -Path $root -Recurse -File -Force | Where-Object {" ^
        "    $rel = $_.FullName.Substring($rootLen);" ^
        "    $parts = $rel -split [regex]::Escape([IO.Path]::DirectorySeparatorChar);" ^
        "    foreach ($d in $excludeDirs) { if ($parts -contains $d) { return $false } };" ^
        "    if ($excludeNames -contains $_.Name) { return $false };" ^
        "    foreach ($p in $excludePatterns) { if ($_.Name -like $p) { return $false } };" ^
        "    return $true;" ^
        "};" ^
        "if (-not $files) { Write-Error 'No files matched after exclusions'; exit 1 };" ^
        "Compress-Archive -Path $files.FullName -DestinationPath $out -CompressionLevel Optimal -Force"
)

if errorlevel 1 (
    echo ERR: archive creation failed.
    exit /b 1
)

REM ---- Summary --------------------------------------------------------------
for %%A in ("%OUT_FILE%") do set "SIZE_BYTES=%%~zA"
set /a "SIZE_KB=%SIZE_BYTES% / 1024"
set /a "SIZE_MB=%SIZE_KB% / 1024"

REM Get file count by listing the archive via PowerShell
for /f %%C in ('powershell -NoProfile -Command "(Get-ChildItem -LiteralPath '%OUT_FILE%' | Select-Object -ExpandProperty Length); $a = [IO.Compression.ZipFile]::OpenRead('%OUT_FILE%'); $a.Entries.Count; $a.Dispose()" 2^>nul ^| more +1') do set "COUNT=%%C"

echo.
echo Created %OUT_FILE%
echo   Size:   %SIZE_MB% MB ^(%SIZE_BYTES% bytes^)
if defined COUNT echo   Files:  %COUNT%
echo.
echo   Inspect:  powershell -Command "Get-ChildItem '%OUT_FILE%' ^| Format-List"
echo   Extract:  powershell -Command "Expand-Archive '%OUT_FILE%' -DestinationPath ^<target^>"

endlocal
exit /b 0
