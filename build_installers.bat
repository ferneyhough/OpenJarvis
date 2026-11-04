@echo off
REM Build both independent Windows x64 NSIS installers.
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

echo [+] Building the legacy Tkinter installer
call "%~dp0build_exe.bat"
if errorlevel 1 exit /b 1

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
    echo [+] Restoring frontend dependencies
    pushd "%~dp0frontend"
    call npm ci
    if errorlevel 1 (
        popd
        exit /b 1
    )
    popd
)

echo [+] Building the Tauri x64 NSIS installer
set "RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc"
pushd "%~dp0frontend"
call npm run tauri -- build --target x86_64-pc-windows-msvc --bundles nsis
if errorlevel 1 (
    popd
    echo [X] Tauri build failed. Verify the Visual Studio C++ x64 build tools are installed.
    exit /b 1
)
popd

if not exist "%~dp0frontend\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\*.exe" (
    echo [X] Tauri build completed without producing an NSIS installer.
    exit /b 1
)

echo.
echo [+] Both installers were built:
echo     Legacy app: %~dp0Output\OpenJarvis-Setup-x64.exe
echo     Tauri app:  %~dp0frontend\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis
if not defined BUILD_INSTALLERS_NO_PAUSE pause
exit /b 0
