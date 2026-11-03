@echo off
REM Launch OPEN JARVIS
if not exist .venv\Scripts\python.exe (
    echo [X] No virtual environment found. Run install.bat first.
    pause
    exit /b 1
)
call .venv\Scripts\activate.bat
python jarvis.py
