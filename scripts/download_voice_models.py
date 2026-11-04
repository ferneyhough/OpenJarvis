"""Download every voice / hands-free model into <install>/models.

Run once after installing dependencies:  python scripts/download_voice_models.py
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ["HF_HOME"] = str(ROOT / "models" / "huggingface")

# Kokoro text-to-speech (all voices, including bm_george) and Whisper speech-to-text.
REPOS = ["hexgrad/Kokoro-82M", "Systran/faster-whisper-base"]


def main() -> int:
    from huggingface_hub import snapshot_download

    for repo in REPOS:
        print(f"Downloading {repo} ...", flush=True)
        path = snapshot_download(repo_id=repo)
        print(f"  -> {path}", flush=True)

    # Kokoro's English phonemiser needs this spaCy model.
    try:
        import spacy

        if not spacy.util.is_package("en_core_web_sm"):
            cmd = [sys.executable, "-m", "spacy", "download", "en_core_web_sm"]
            subprocess.check_call(cmd)
    except ImportError:
        print("spaCy not installed; skipping en_core_web_sm")

    print("Voice models ready in", ROOT / "models")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
