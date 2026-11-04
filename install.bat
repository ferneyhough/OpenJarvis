@echo off
REM ================================================================
REM  OPEN JARVIS — Windows one-click installer (CMD / PowerShell)
REM ================================================================
setlocal ENABLEDELAYEDEXPANSION

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

echo [+] Installing emergentintegrations
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ --quiet

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

echo [+] Installing image/video generation and converter packages
pip install diffusers accelerate peft pillow imageio imageio-ffmpeg python-multipart --quiet
echo [+] Downloading image and video models (about 5 GB, one time)
python scripts\download_media_models.py

where ollama >nul 2>&1
if errorlevel 1 (
    echo [+] Installing Ollama for local chat
    winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements --silent
)
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
