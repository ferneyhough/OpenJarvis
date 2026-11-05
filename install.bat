@echo off
REM ================================================================
REM  OPEN JARVIS — Windows one-click installer (CMD / PowerShell)
REM ================================================================
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

echo.
echo  ============================================================
echo    OPEN JARVIS  :: Windows Installer
echo  ============================================================
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [X] Python is not installed or not on PATH.
    echo     Download Python 3.10+ from https://www.python.org/downloads/
    echo     IMPORTANT: tick "Add python.exe to PATH" during install.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version') do set PYVER=%%v
echo [+] Python detected: !PYVER!

echo [+] Creating virtual environment (.venv)
if exist .venv\Scripts\activate.bat (
    echo [+] Reusing existing .venv
) else (
    python -m venv .venv
)
if not exist .venv\Scripts\activate.bat (
    echo [X] venv creation failed.
    pause
    exit /b 1
)

call .venv\Scripts\activate.bat

echo [+] Upgrading pip
python -m pip install --upgrade pip --quiet

echo [+] Installing dependencies (this may take 2-3 minutes)
pip install -r requirements.txt
if errorlevel 1 (
    echo.
    echo [!] If PyAudio failed, install the Windows wheel manually:
    echo     pip install pipwin ^&^& pipwin install pyaudio
    echo.
)

if not exist config.json (
    copy config.example.json config.json >nul
    echo [+] Created config.json
)

echo [+] Installing OpenJarvis web UI, desktop window and voice (Kokoro / Whisper)
pip install -e . pywebview "kokoro>=0.9" soundfile "misaki[en]" faster-whisper --quiet
echo [+] Downloading voice and hands-free models into .\models
python scripts\download_voice_models.py

if exist src\openjarvis\server\static\index.html (
    echo [+] Web UI already built
) else (
    call :build_ui
)

echo.
set /p WANTMEDIA="Install optional local image/video generation packages (~150 MB + models on demand)? [y/N] "
if /i "!WANTMEDIA!"=="y" (
    echo [+] Installing image/video generation and converter packages
    pip install -r requirements-media.txt --quiet
) else (
    echo [-] Skipped. Later: pip install -r requirements-media.txt
)
echo [+] Image/video models are NOT downloaded by default.
echo     Enable them in Settings ^> Developer Mode ^> Local image/video generation,
echo     or run: python scripts\download_media_models.py all

where ollama >nul 2>&1
if errorlevel 1 (
    echo [+] Installing Ollama for local chat
    winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements --silent
)
if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" set "PATH=%LOCALAPPDATA%\Programs\Ollama;%PATH%"
ollama pull qwen3.5:4b
echo.
echo  ============================================================
echo    Install complete.
echo    Next:
echo      1. Open config.json and paste your Emergent LLM Key
echo         (or launch the app and use Settings to enter it)
echo      2. Run:  run.bat
echo  ============================================================
echo.
pause
exit /b 0

:build_ui
echo [+] Building the web UI (needs Node.js)
where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo [+] Node.js not found. Installing Node.js LTS
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent
    if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js is unavailable, so the web UI was not built.
    echo     Install Node.js LTS from https://nodejs.org/ then re-run install.bat.
    exit /b 0
)
pushd frontend
call npm ci --no-audit --no-fund
if errorlevel 1 (
    popd
    echo [!] npm ci failed. The web UI was not built.
    exit /b 0
)
call npm run build
popd
exit /b 0
