"""Download the optional image/video generation models into <install>/models.

Run:  python scripts/download_media_models.py [image|video|all]

The app also does this on demand when you select a local model in
Settings > Developer Mode, so running this script is optional.
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ.setdefault("HF_HOME", str(ROOT / "models" / "huggingface"))


def main(argv: list) -> int:
    from openjarvis.server.media_routes import download_models

    which = argv[1] if len(argv) > 1 else "all"
    kinds = ["image", "video"] if which == "all" else [which]
    for kind in kinds:
        print(f"Downloading {kind} model ...", flush=True)
        download_models(kind)
    print("Media models ready in", ROOT / "models")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
