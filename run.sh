#!/usr/bin/env bash
# Launch OPEN JARVIS
if [ -f ".venv/Scripts/python.exe" ]; then
    .venv/Scripts/python.exe jarvis.py
elif [ -f ".venv/bin/python" ]; then
    .venv/bin/python jarvis.py
else
    echo "[X] No virtual environment found. Run ./install.sh first."
    exit 1
fi
