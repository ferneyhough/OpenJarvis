@echo off
REM ============================================================================
REM  OpenJarvis installer builder — produces TWO Windows x64 installers:
REM
REM  1) LEGACY installer  -> Output\OpenJarvis-Setup-x64.exe
REM     What it is : Full bundled Python app (PyInstaller) + web UI, packaged by
REM                  installer.nsi. Installs to C:\Program Files\OpenJarvis,
REM                  requires admin (UAC prompt), registers mic + webcam consent,
REM                  adds Start Menu / Desktop / Startup shortcuts.
REM     Built by : build_exe.bat (PyInstaller) then makensis installer.nsi
REM
REM  2) TAURI installer   -> frontend\src-tauri\target\...\bundle\nsis\*.exe
REM     What it is : Native Rust/Tauri desktop shell around the same React UI.
REM                  NSIS bundle with installMode "both" — the user picks
REM                  per-machine (admin) or per-user at install time.
REM                  installer-hooks.nsh grants mic + webcam consent.
REM     Built by : npm run tauri build --bundles nsis
REM ============================================================================
setlocal
cd /d "%~dp0"
set "BUILD_INSTALLERS_NO_PAUSE=1"

if defined NSIS_HOME if exist "%NSIS_HOME%\makensis.exe" set "PATH=%NSIS_HOME%;%PATH%"
if exist "%ProgramFiles%\NSIS\makensis.exe" set "PATH=%ProgramFiles%\NSIS;%PATH%"
if exist "%ProgramFiles(x86)%\NSIS\makensis.exe" set "PATH=%ProgramFiles(x86)%\NSIS;%PATH%"

where makensis.exe >nul 2>nul
if errorlevel 1 (
    echo [X] NSIS is required. Install it and add makensis.exe to PATH, or set NSIS_HOME.
    exit /b 1
)

echo [+] STEP 1/4 - Building LEGACY installer payload (PyInstaller bundle)
echo     Output will be: Output\OpenJarvis-Setup-x64.exe  ^(full app, admin install^)
call "%~dp0build_exe.bat"
if errorlevel 1 exit /b 1

echo [+] STEP 2/4 - Packaging LEGACY installer with NSIS (installer.nsi)
"%ProgramFiles(x86)%\NSIS\makensis.exe" "%~dp0installer.nsi" 2>nul || makensis.exe "%~dp0installer.nsi"
if errorlevel 1 (
    echo [X] NSIS packaging failed for the legacy installer.
    exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js and npm are required for the Tauri desktop installer.
    exit /b 1
)
where cargo.exe >nul 2>nul
if errorlevel 1 (
    echo [X] Rust stable with the x86_64-pc-windows-msvc target is required.
    exit /b 1
)

if not exist "%~dp0frontend\node_modules" (
    echo [+] STEP 3/4 - Restoring frontend dependencies
    pushd "%~dp0frontend"
    call npm ci
    if errorlevel 1 (
        popd
        exit /b 1
    )
    popd
)

echo [+] STEP 4/4 - Building TAURI installer ^(Rust shell + NSIS, per-machine or per-user choice^)
pushd "%~dp0frontend"
call npm run tauri -- build --target x86_64-pc-windows-msvc --bundles nsis
if errorlevel 1 (
    popd
    echo [X] Tauri build failed. Verify the Visual Studio C++ x64 build tools are installed.
    exit /b 1
)
popd

set "TAURI_TARGET_DIR=%CARGO_TARGET_DIR%"
if not defined TAURI_TARGET_DIR set "TAURI_TARGET_DIR=%~dp0frontend\src-tauri\target"
if not exist "%TAURI_TARGET_DIR%\x86_64-pc-windows-msvc\release\bundle\nsis\*.exe" (
    echo [X] Tauri build completed without producing an NSIS installer.
    exit /b 1
)

echo.
echo [+] ============================================================================
echo     INSTALLERS READY - what each one is:
echo.
echo     1) LEGACY APP INSTALLER
echo        File : %~dp0Output\OpenJarvis-Setup-x64.exe
echo        Makes: Installs the full Python app to C:\Program Files\OpenJarvis.
echo        Needs: Administrator ^(UAC prompt on launch^). Grants mic + webcam.
echo.
echo     2) TAURI DESKTOP INSTALLER
echo        File : %TAURI_TARGET_DIR%\x86_64-pc-windows-msvc\release\bundle\nsis
echo        Makes: Native Rust desktop app; install screen offers per-machine
echo               ^(admin^) or per-user choice. Grants mic + webcam consent.
echo ============================================================================
if not defined BUILD_INSTALLERS_NO_PAUSE pause
exit /b 0
