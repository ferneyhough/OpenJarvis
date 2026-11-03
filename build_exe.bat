@echo off
REM ================================================================
REM  Build OpenJarvis.exe + OpenJarvis-Setup.exe on this Windows PC
REM  Run AFTER install.bat has succeeded.
REM ================================================================
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo [X] Run install.bat first.
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat

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
    pause
    exit /b 1
)

echo [+] Verifying production native dependencies
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\verify_production_bundle.ps1" -BundlePath "%CD%\dist\OpenJarvis"
if errorlevel 1 (
    echo [X] A debug-enabled libcurl artifact was found in the production bundle.
    echo     Rebuild libcurl in Release mode before packaging.
    pause
    exit /b 1
)
echo [+] Built dist\OpenJarvis\OpenJarvis.exe

call :find_iscc
if not defined ISCC (
    echo [+] Installing Inno Setup (makes the Setup.exe installer)
    winget install -e --id JRSoftware.InnoSetup --accept-source-agreements --accept-package-agreements
    call :find_iscc
)
if not defined ISCC (
    echo [!] Inno Setup not found. You can still share the dist\OpenJarvis folder as a zip.
    pause
    exit /b 0
)

echo [+] Building OpenJarvis-Setup.exe
"%ISCC%" installer.iss
if errorlevel 1 (
    echo [X] Setup build failed.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo    Done!  Share this file with friends:
echo      %CD%\Output\OpenJarvis-Setup.exe
echo    They don't need Python. On first launch Jarvis asks for
echo    their own Emergent LLM key.
echo  ============================================================
pause
exit /b 0

:find_iscc
set "ISCC="
if exist "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" set "ISCC=%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
exit /b 0
