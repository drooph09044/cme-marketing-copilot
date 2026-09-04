@echo off
setlocal EnableDelayedExpansion
REM ============================================================================
REM deploy-databricks.bat - Windows equivalent of deploy-databricks.sh
REM Packages the Journey QA Test Console as a Databricks App bundle and
REM deploys it via the Databricks CLI.
REM
REM Usage:
REM   scripts\deploy-databricks.bat                       Full build + deploy
REM   scripts\deploy-databricks.bat --bundle-only         Build the bundle, skip deploy
REM   scripts\deploy-databricks.bat --app-name my-orch    Override app name
REM   scripts\deploy-databricks.bat --skip-frontend       Reuse existing apps\web\out
REM   scripts\deploy-databricks.bat --verbose             Show robocopy + tool output
REM ============================================================================

REM ---- Resolve repo paths (script lives in scripts\) ------------------------
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%\..") do set "ROOT=%%~fI"

set "DEPLOY=%ROOT%\deploy"
set "WEB=%ROOT%\apps\web"
set "API=%ROOT%\apps\api"
set "EXAMPLES=%ROOT%\examples"
set "BUILD=%DEPLOY%\build"

REM ---- Defaults / args ------------------------------------------------------
set "BUNDLE_ONLY=0"
set "SKIP_FRONTEND=0"
set "VERBOSE=0"
set "APP_NAME=%DATABRICKS_APP_NAME%"
if "%APP_NAME%"=="" set "APP_NAME=orchestrate-qa"

:parse_args
if "%~1"=="" goto end_args
if /I "%~1"=="--bundle-only"   ( set "BUNDLE_ONLY=1"   & shift & goto parse_args )
if /I "%~1"=="--skip-frontend" ( set "SKIP_FRONTEND=1" & shift & goto parse_args )
if /I "%~1"=="--verbose"       ( set "VERBOSE=1"       & shift & goto parse_args )
if /I "%~1"=="-v"              ( set "VERBOSE=1"       & shift & goto parse_args )
if /I "%~1"=="--app-name" (
    if "%~2"=="" (
        echo [ERR] --app-name needs a value.
        exit /b 1
    )
    set "APP_NAME=%~2"
    shift
    shift
    goto parse_args
)
if /I "%~1"=="-h"     goto show_help
if /I "%~1"=="--help" goto show_help
echo [ERR] Unknown arg: %~1
exit /b 1

:show_help
echo Usage:
echo   scripts\deploy-databricks.bat                     Full build + deploy
echo   scripts\deploy-databricks.bat --bundle-only       Build deploy\build, skip deploy
echo   scripts\deploy-databricks.bat --app-name ^<slug^>   Override default 'orchestrate-qa'
echo   scripts\deploy-databricks.bat --skip-frontend     Reuse existing apps\web\out
echo   scripts\deploy-databricks.bat --verbose           Show tool output
exit /b 0

:end_args

REM ---- Print resolved paths for sanity --------------------------------------
echo ============================================================
echo Repo root:    %ROOT%
echo Bundle out:   %BUILD%
echo App name:     %APP_NAME%
echo Bundle only:  %BUNDLE_ONLY%
echo Skip frontend:%SKIP_FRONTEND%
echo Verbose:      %VERBOSE%
echo ============================================================

REM ---- Sanity checks --------------------------------------------------------
where pnpm >nul 2>nul
if errorlevel 1 (
    echo [ERR] 'pnpm' not found in PATH.
    echo       Install with: npm install -g pnpm
    echo       Or follow https://pnpm.io/installation
    exit /b 1
)

if "%BUNDLE_ONLY%"=="0" (
    where databricks >nul 2>nul
    if errorlevel 1 (
        echo [ERR] 'databricks' CLI not found in PATH.
        echo       Install: https://docs.databricks.com/en/dev-tools/cli/install.html
        echo       Tip: use --bundle-only if you just want to build the bundle.
        exit /b 1
    )
)

where powershell >nul 2>nul
if errorlevel 1 (
    echo [ERR] PowerShell not found in PATH. PowerShell 5+ is required.
    exit /b 1
)

if not exist "%DEPLOY%\app.yaml.tmpl" (
    echo [ERR] deploy\app.yaml.tmpl is missing.
    exit /b 1
)
if not exist "%API%\requirements.txt" (
    echo [ERR] %API%\requirements.txt is missing.
    exit /b 1
)
if not exist "%EXAMPLES%" (
    echo [ERR] %EXAMPLES% is missing.
    exit /b 1
)

REM ---- Step 1: Clean ^& scaffold --------------------------------------------
echo.
echo [1/5] Preparing %BUILD%
if exist "%BUILD%" (
    rmdir /s /q "%BUILD%"
    if errorlevel 1 (
        echo [ERR] Could not clean %BUILD% - is a process holding files open?
        exit /b 1
    )
)
mkdir "%BUILD%"
mkdir "%BUILD%\app"
mkdir "%BUILD%\static"
mkdir "%BUILD%\examples"

REM ---- Step 2: Build the Next.js frontend -----------------------------------
echo.
echo [2/5] Building frontend
if "%SKIP_FRONTEND%"=="1" (
    echo       Skipping ^(--skip-frontend^), using existing %WEB%\out
    goto frontend_done
)

REM Next.js 14 + Windows has a known SWC bug when the project path contains
REM patterns like "_<digits>\\" (e.g. "xe_vishalv1\\Desktop\\..."). The
REM minifier treats the underscore as a numeric separator and fails with
REM "A numeric separator is only allowed between two digits". Workaround:
REM map the project to a virtual drive letter via 'subst' so Next.js sees a
REM clean path like Q:\apps\web\... when generating + minifying.

set "BUILD_DRIVE="
for %%L in (Q R S T U V W X Y Z) do (
    if not defined BUILD_DRIVE (
        if not exist %%L:\ (
            subst %%L: "%ROOT%" >nul 2>nul
            if not errorlevel 1 (
                set "BUILD_DRIVE=%%L:"
            )
        )
    )
)

if defined BUILD_DRIVE (
    echo       Mapped %ROOT% to !BUILD_DRIVE!\ to dodge Next.js Windows path bug
    echo       Running: NEXT_BUILD_STATIC=1 pnpm --filter @workflow-test/web build
    pushd !BUILD_DRIVE!\
    set "NEXT_BUILD_STATIC=1"
    call pnpm --filter @workflow-test/web build
    set "FRONTEND_RC=!errorlevel!"
    set "NEXT_BUILD_STATIC="
    popd
    subst !BUILD_DRIVE! /D >nul 2>nul
) else (
    echo       [WARN] Could not allocate a virtual drive ^(subst failed^).
    echo              Falling back to direct path; build may fail if the path
    echo              contains "_<digits>\\" patterns ^(Next.js Windows bug^).
    pushd "%ROOT%"
    set "NEXT_BUILD_STATIC=1"
    call pnpm --filter @workflow-test/web build
    set "FRONTEND_RC=!errorlevel!"
    set "NEXT_BUILD_STATIC="
    popd
)

if not "!FRONTEND_RC!"=="0" (
    echo [ERR] Frontend build failed ^(exit code !FRONTEND_RC!^).
    echo       Try running manually to see full output:
    echo         set NEXT_BUILD_STATIC=1
    echo         pnpm --filter @workflow-test/web build
    echo.
    echo       If you see "A numeric separator is only allowed between two
    echo       digits" — that's a known Next.js 14 + Windows path bug. The
    echo       script tried to work around it via subst; if that failed too,
    echo       move the project to a path without "_<digit>" segments,
    echo       e.g. C:\dev\qa-automation, and rerun.
    exit /b 1
)
:frontend_done

if not exist "%WEB%\out" (
    echo [ERR] %WEB%\out not found after build.
    echo       Verify apps\web\next.config.mjs uses output:'export' when NEXT_BUILD_STATIC=1.
    echo       See docs\databricks-apps-deployment.md section 4a.
    exit /b 1
)
if not exist "%WEB%\out\index.html" (
    echo [ERR] %WEB%\out\index.html missing - Next.js export looks incomplete.
    exit /b 1
)

REM ---- Step 3: Assemble bundle ----------------------------------------------
echo.
echo [3/5] Assembling bundle

REM robocopy verbosity flags
if "%VERBOSE%"=="1" (
    set "RC_FLAGS=/E"
) else (
    set "RC_FLAGS=/E /NFL /NDL /NJH /NJS /NP"
)

echo       Copy %API%\app -^> %BUILD%\app
robocopy "%API%\app" "%BUILD%\app" %RC_FLAGS%
if errorlevel 8 (
    echo [ERR] robocopy app failed ^(exit code %errorlevel%^).
    exit /b 1
)

echo       Copy requirements.txt
copy /Y "%API%\requirements.txt" "%BUILD%\requirements.txt" >nul
if errorlevel 1 (
    echo [ERR] copy requirements.txt failed.
    exit /b 1
)

echo       Copy %WEB%\out -^> %BUILD%\static
robocopy "%WEB%\out" "%BUILD%\static" %RC_FLAGS%
if errorlevel 8 (
    echo [ERR] robocopy static failed ^(exit code %errorlevel%^).
    exit /b 1
)

echo       Copy %EXAMPLES% -^> %BUILD%\examples
robocopy "%EXAMPLES%" "%BUILD%\examples" %RC_FLAGS%
if errorlevel 8 (
    echo [ERR] robocopy examples failed ^(exit code %errorlevel%^).
    exit /b 1
)

echo       Render app.yaml from template
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$tmpl='%DEPLOY%\app.yaml.tmpl'.Replace('\\','\\\\');" ^
    "$out='%BUILD%\app.yaml'.Replace('\\','\\\\');" ^
    "(Get-Content -Raw -LiteralPath '%DEPLOY%\app.yaml.tmpl') -replace '__APP_NAME__', '%APP_NAME%' | Set-Content -NoNewline -LiteralPath '%BUILD%\app.yaml'"
if errorlevel 1 (
    echo [ERR] Failed to render app.yaml from template.
    exit /b 1
)

REM ---- Step 4: Bundle summary -----------------------------------------------
echo.
echo [4/5] Bundle summary
for /f %%S in ('powershell -NoProfile -Command "(Get-ChildItem -LiteralPath '%BUILD%' -Recurse -File ^| Measure-Object Length -Sum).Sum"') do set "BUNDLE_BYTES=%%S"
for /f %%C in ('powershell -NoProfile -Command "(Get-ChildItem -LiteralPath '%BUILD%' -Recurse -File).Count"') do set "FILE_COUNT=%%C"
set /a "BUNDLE_KB=%BUNDLE_BYTES% / 1024"
echo       %BUNDLE_KB% KB, %FILE_COUNT% files at %BUILD%

REM ---- Step 5: Deploy (unless --bundle-only) --------------------------------
echo.
echo [5/5] Deploy
if "%BUNDLE_ONLY%"=="1" (
    echo       --bundle-only - skipping push.
    echo       To deploy manually:
    echo         databricks apps deploy %APP_NAME% --source-code-path "%BUILD%"
    endlocal & exit /b 0
)

echo       databricks apps deploy %APP_NAME%
call databricks apps deploy "%APP_NAME%" --source-code-path "%BUILD%"
if errorlevel 1 (
    echo [ERR] databricks apps deploy failed.
    echo       Common causes:
    echo         - app '%APP_NAME%' does not exist yet: run
    echo             databricks apps create %APP_NAME% --description "Journey QA Test Console"
    echo         - workspace auth not set up: run
    echo             databricks auth login --host https://your-workspace.cloud.databricks.com
    echo         - service principal lacks 'Can Query' on serving endpoints.
    exit /b 1
)

REM Try to fetch app URL for convenience
for /f "delims=" %%U in ('powershell -NoProfile -Command "try { (& databricks apps get '%APP_NAME%' --output json ^| ConvertFrom-Json).url } catch { '' }"') do set "APP_URL=%%U"

echo.
echo ============================================================
echo Deploy complete.
echo   App name:  %APP_NAME%
if defined APP_URL (
    echo   App URL:   %APP_URL%
) else (
    echo   App URL:   ^(check 'databricks apps get %APP_NAME%'^)
)
echo.
echo   Logs:      databricks apps logs %APP_NAME% --follow
echo   Status:    databricks apps get  %APP_NAME%
echo   Rollback:  databricks apps deployments list %APP_NAME%
echo ============================================================

endlocal
exit /b 0
