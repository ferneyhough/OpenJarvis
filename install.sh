#!/usr/bin/env bash
# ================================================================
#  OPEN JARVIS — Git Bash / WSL / macOS / Linux installer
# ================================================================
set -e

echo ""
echo " ============================================================"
echo "   OPEN JARVIS  ::  POSIX / Git Bash Installer"
echo " ============================================================"
echo ""

# ---- detect python ----
if command -v python >/dev/null 2>&1; then
    PY=python
elif command -v python3 >/dev/null 2>&1; then
    PY=python3
else
    echo "[X] Python not found. Install Python 3.10+ and re-run."
    exit 1
fi

echo "[+] Using $($PY --version)"

# ---- venv ----
echo "[+] Creating virtual environment (.venv)"
$PY -m venv .venv

# Activate (Git Bash on Windows uses .venv/Scripts/activate; POSIX uses .venv/bin/activate)
if [ -f ".venv/Scripts/activate" ]; then
    # shellcheck disable=SC1091
    source .venv/Scripts/activate
    PIP=".venv/Scripts/pip"
else
    # shellcheck disable=SC1091
    source .venv/bin/activate
    PIP=".venv/bin/pip"
fi

echo "[+] Upgrading pip"
$PIP install --upgrade pip --quiet

echo "[+] Installing dependencies"
$PIP install -r requirements.txt || {
    echo ""
    echo "[!] If PyAudio failed on Windows Git Bash, run in CMD:"
    echo "     pip install pipwin && pipwin install pyaudio"
    echo "    On macOS: brew install portaudio && pip install pyaudio"
    echo "    On Debian/Ubuntu: sudo apt install portaudio19-dev && pip install pyaudio"
    echo ""
}

# ---- config ----
if [ ! -f config.json ]; then
    cp config.example.json config.json
    echo "[+] Created config.json"
fi

echo ""
echo " ============================================================"
echo "   Install complete."
echo "   Next:"
echo "     1. Edit config.json and paste your Emergent LLM Key"
echo "        (or launch the app and use Settings → paste key)"
echo "     2. Run:  ./run.sh    (Git Bash / macOS / Linux)"
echo "              run.bat     (Windows CMD)"
echo " ============================================================"
echo ""
