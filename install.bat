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
python -m venv .venv
if errorlevel 1 (
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
