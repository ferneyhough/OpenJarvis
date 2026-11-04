@echo off
REM ================================================================
REM  Build the legacy OpenJarvis app and its x64 NSIS installer
REM  Run AFTER install.bat has succeeded.
REM ================================================================
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo [X] Run install.bat first.
    if not defined BUILD_INSTALLERS_NO_PAUSE pause
    exit /b 1
)
call .venv\Scripts\activate.bat

python -c "import struct,sys; sys.exit(0 if struct.calcsize('P') == 8 else 1)"
if errorlevel 1 (
    echo [X] A 64-bit Python environment is required to build the x64 installer.
    if not defined BUILD_INSTALLERS_NO_PAUSE pause
    exit /b 1
)

echo [+] Installing PyInstaller
pip install pyinstaller --quiet

echo [+] Building OpenJarvis.exe (takes a few minutes)
pyinstaller --noconfirm --clean --windowed --name OpenJarvis ^
    --add-data "config.example.json;." ^
    --add-data "playnite_extension;playnite_extension" ^
    --collect-all litellm ^
    --collect-all emergentintegrations ^
    --collect-data speech_recognition ^
    --collect-submodules tiktoken_ext ^
    --hidden-import pyttsx3.drivers ^
    --hidden-import pyttsx3.drivers.sapi5 ^
    --hidden-import comtypes.client ^
    jarvis.py
if errorlevel 1 (
    echo [X] PyInstaller build failed. See the messages above.
    if not defined BUILD_INSTALLERS_NO_PAUSE pause
    exit /b 1
)

echo [+] Verifying production native dependencies
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\verify_production_bundle.ps1" -BundlePath "%CD%\dist\OpenJarvis"
if errorlevel 1 (
    echo [X] A debug-enabled libcurl artifact was found in the production bundle.
    echo     Rebuild libcurl in Release mode before packaging.
    if not defined BUILD_INSTALLERS_NO_PAUSE pause
    exit /b 1
)
echo [+] Built dist\OpenJarvis\OpenJarvis.exe

call :find_makensis
if not defined MAKENSIS (
    echo [X] NSIS was not found. Install NSIS or set NSIS_HOME to its installation folder.
    echo     The installer is not built until makensis.exe is available.
    if not defined BUILD_INSTALLERS_NO_PAUSE pause
    exit /b 1
)

echo [+] Building the x64 NSIS installer
if not exist Output mkdir Output
"%MAKENSIS%" /V2 installer.nsi
if errorlevel 1 (
    echo [X] NSIS setup build failed.
    if not defined BUILD_INSTALLERS_NO_PAUSE pause
    exit /b 1
)

echo.
echo  ============================================================
echo    Done! Share this x64 installer:
echo      %CD%\Output\OpenJarvis-Setup-x64.exe
echo    It installs per-user and does not require Python on the
echo    destination PC. User settings and memory are kept in AppData.
echo  ============================================================
if not defined BUILD_INSTALLERS_NO_PAUSE pause
exit /b 0

:find_makensis
set "MAKENSIS="
if defined NSIS_HOME if exist "%NSIS_HOME%\makensis.exe" set "MAKENSIS=%NSIS_HOME%\makensis.exe"
if not defined MAKENSIS if exist "%ProgramFiles%\NSIS\makensis.exe" set "MAKENSIS=%ProgramFiles%\NSIS\makensis.exe"
if not defined MAKENSIS if exist "%ProgramFiles(x86)%\NSIS\makensis.exe" set "MAKENSIS=%ProgramFiles(x86)%\NSIS\makensis.exe"
if not defined MAKENSIS (
    for /f "delims=" %%I in ('where makensis.exe 2^>nul') do if not defined MAKENSIS set "MAKENSIS=%%I"
)
exit /b 0
