# models/

Placeholder for downloaded AI models. Nothing here is committed except this file.

| Folder | Contents | How it gets here |
|---|---|---|
| `huggingface/hub/` | Kokoro (George voice), Whisper (hands-free) | `scripts/download_voice_models.py` / `install.bat` |
| `huggingface/hub/` | Image model (`stabilityai/sd-turbo`, ~2 GB) | Settings > Developer Mode > Local image generation (on demand) |
| `huggingface/hub/` | Video models (SD 1.5 + AnimateDiff-Lightning, ~3 GB) | Settings > Developer Mode > Local video generation (on demand) |

Image and video models are **not** downloaded by default. If a local model is not
selected, the Image / Video buttons open a free hosted generator in your browser.

Manual download: `python scripts/download_media_models.py [image|video|all]`
