"""Download the image and video generation models into <install>/models.

Run:  python scripts/download_media_models.py
"""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.environ["HF_HOME"] = str(ROOT / "models" / "huggingface")

PATTERNS = ["*.json", "*.txt", "*fp16.safetensors"]


def main() -> int:
    from huggingface_hub import hf_hub_download, snapshot_download

    print("Downloading image model (sd-turbo) ...", flush=True)
    snapshot_download("stabilityai/sd-turbo", allow_patterns=PATTERNS)

    print("Downloading video base model (Stable Diffusion 1.5) ...", flush=True)
    snapshot_download(
        "stable-diffusion-v1-5/stable-diffusion-v1-5",
        allow_patterns=PATTERNS,
        ignore_patterns=["safety_checker/*"],
    )

    print("Downloading AnimateDiff-Lightning motion adapter ...", flush=True)
    hf_hub_download(
        "ByteDance/AnimateDiff-Lightning",
        "animatediff_lightning_4step_diffusers.safetensors",
    )
    snapshot_download(
        "guoyww/animatediff-motion-adapter-v1-5-2",
        allow_patterns=["config.json"],
    )
    print("Media models ready in", ROOT / "models")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
