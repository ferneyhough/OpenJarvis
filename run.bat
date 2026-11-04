@echo off
REM ================================================================
REM  OPEN JARVIS - launch the desktop app
REM ================================================================
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo [X] No virtual environment found. Run install.bat first.
    pause
    exit /b 1
)
if not exist src\openjarvis\server\static\index.html (
    echo [!] The web UI has not been built. Run install.bat to build it.
)
call .venv\Scripts\activate.bat
python jarvis_desktop.py
