"""Local AI image generation, AI video generation and audio/video conversion.

Image:  sd-turbo (diffusers) on CPU/GPU.
Video:  AnimateDiff-Lightning on Stable Diffusion 1.5, exported as H.264 MP4.
Convert: ffmpeg binary bundled with ``imageio-ffmpeg``.

Generation runs in a background job (one at a time) so the UI can poll progress.
"""

from __future__ import annotations

import logging
import os
import re
import subprocess
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

media_router = APIRouter(prefix="/v1/media", tags=["media"])

_ROOT = Path(__file__).resolve().parents[3]
MODELS_CACHE = Path(
    os.environ.get("OPENJARVIS_MODELS_DIR", str(_ROOT / "models" / "huggingface"))
) / "hub"
MEDIA_DIR = Path(
    os.environ.get("OPENJARVIS_MEDIA_DIR", str(Path.home() / ".openjarvis" / "media"))
)

IMAGE_REPO = "stabilityai/sd-turbo"
VIDEO_BASE_REPO = "stable-diffusion-v1-5/stable-diffusion-v1-5"
VIDEO_ADAPTER_REPO = "ByteDance/AnimateDiff-Lightning"
VIDEO_ADAPTER_FILE = "animatediff_lightning_4step_diffusers.safetensors"
VIDEO_ADAPTER_CONFIG_REPO = "guoyww/animatediff-motion-adapter-v1-5-2"

AUDIO_FORMATS = {"mp3", "wav", "ogg", "flac", "aac", "m4a"}
VIDEO_FORMATS = {"mp4", "webm", "mkv", "avi", "mov", "gif"}

_gen_lock = threading.Lock()
_download_lock = threading.Lock()
_downloads: Dict[str, Dict[str, str]] = {
    "image": {"status": "idle", "error": ""},
    "video": {"status": "idle", "error": ""},
}

# Free hosted generators opened when local models are not selected.
FREE_SITES = {
    "image": "https://www.craiyon.com/",
    "video": "https://huggingface.co/spaces/ByteDance/AnimateDiff-Lightning",
}


class ModelDownloadRequest(BaseModel):
    kind: Literal["image", "video"]
_jobs: Dict[str, Dict[str, Any]] = {}
_pipes: Dict[str, Any] = {}


class ImageRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    width: int = Field(default=512, ge=256, le=768)
    height: int = Field(default=512, ge=256, le=768)
    steps: int = Field(default=2, ge=1, le=8)
    seed: Optional[int] = None


class VideoRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=1000)
    frames: int = Field(default=16, ge=8, le=24)
    width: int = Field(default=320, ge=256, le=512)
    height: int = Field(default=320, ge=256, le=512)
    fps: int = Field(default=8, ge=4, le=24)
    seed: Optional[int] = None


def _safe_name(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "_", name)[:80] or "file"


def _device() -> str:
    import torch

    return "cuda" if torch.cuda.is_available() else "cpu"


def _load_image_pipe():
    if "image" not in _pipes:
        import torch
        from diffusers import AutoPipelineForText2Image

        _pipes["image"] = AutoPipelineForText2Image.from_pretrained(
            IMAGE_REPO,
            variant="fp16",
            torch_dtype=torch.float32,
            cache_dir=str(MODELS_CACHE),
        ).to(_device())
    return _pipes["image"]


def _load_video_pipe():
    if "video" not in _pipes:
        import torch
        from diffusers import (
            AnimateDiffPipeline,
            EulerDiscreteScheduler,
            MotionAdapter,
        )
        from huggingface_hub import hf_hub_download
        from safetensors.torch import load_file

        adapter = MotionAdapter.from_pretrained(
            VIDEO_ADAPTER_CONFIG_REPO,
            cache_dir=str(MODELS_CACHE),
            torch_dtype=torch.float32,
        )
        weights = hf_hub_download(
            VIDEO_ADAPTER_REPO, VIDEO_ADAPTER_FILE, cache_dir=str(MODELS_CACHE)
        )
        adapter.load_state_dict(load_file(weights, device="cpu"))
        pipe = AnimateDiffPipeline.from_pretrained(
            VIDEO_BASE_REPO,
            motion_adapter=adapter,
            variant="fp16",
            safety_checker=None,
            torch_dtype=torch.float32,
            cache_dir=str(MODELS_CACHE),
        )
        pipe.scheduler = EulerDiscreteScheduler.from_config(
            pipe.scheduler.config,
            timestep_spacing="trailing",
            beta_schedule="linear",
        )
        _pipes["video"] = pipe.to(_device())
    return _pipes["video"]


def _run_job(job_id: str, kind: str, req: BaseModel) -> None:
    job = _jobs[job_id]
    try:
        with _gen_lock:
            job["status"] = "running"
            job["started"] = time.time()
            import torch

            MEDIA_DIR.mkdir(parents=True, exist_ok=True)
            gen = torch.Generator("cpu")
            seed = getattr(req, "seed", None)
            gen.manual_seed(seed if seed is not None else int(time.time()) % 2**31)

            if kind == "image":
                job["stage"] = "loading model"
                pipe = _load_image_pipe()
                job["stage"] = "generating"
                image = pipe(
                    prompt=req.prompt,  # type: ignore[attr-defined]
                    num_inference_steps=req.steps,  # type: ignore[attr-defined]
                    guidance_scale=0.0,
                    width=req.width,  # type: ignore[attr-defined]
                    height=req.height,  # type: ignore[attr-defined]
                    generator=gen,
                ).images[0]
                name = f"image-{job_id}.png"
                image.save(MEDIA_DIR / name)
            else:
                import imageio

                job["stage"] = "loading model"
                pipe = _load_video_pipe()
                job["stage"] = "generating frames"

                def _progress(_pipe, step, _t, kwargs):
                    job["stage"] = f"denoising step {step + 1}/4"
                    return kwargs

                out = pipe(
                    prompt=req.prompt,  # type: ignore[attr-defined]
                    num_frames=req.frames,  # type: ignore[attr-defined]
                    guidance_scale=1.0,
                    num_inference_steps=4,
                    width=req.width,  # type: ignore[attr-defined]
                    height=req.height,  # type: ignore[attr-defined]
                    generator=gen,
                    callback_on_step_end=_progress,
                )
                job["stage"] = "encoding video"
                import numpy as np

                name = f"video-{job_id}.mp4"
                frames = [np.asarray(f) for f in out.frames[0]]
                imageio.mimsave(
                    MEDIA_DIR / name,
                    frames,
                    fps=req.fps,  # type: ignore[attr-defined]
                    codec="libx264",
                    macro_block_size=1,
                )
            job["url"] = f"/v1/media/files/{name}"
            job["status"] = "done"
    except Exception as exc:
        logger.exception("Media job %s failed", job_id)
        job["status"] = "error"
        job["error"] = f"{type(exc).__name__}: {exc}"[:500]
    finally:
        job["finished"] = time.time()


def _start(kind: str, req: BaseModel) -> Dict[str, str]:
    job_id = uuid.uuid4().hex[:12]
    _jobs[job_id] = {
        "id": job_id,
        "kind": kind,
        "status": "queued",
        "stage": "queued",
        "created": time.time(),
    }
    threading.Thread(target=_run_job, args=(job_id, kind, req), daemon=True).start()
    return {"job_id": job_id}


def _models_ready(repo: str) -> bool:
    return (MODELS_CACHE / f"models--{repo.replace('/', '--')}").is_dir()


@media_router.get("/health")
async def media_health():
    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        ffmpeg = ""
    try:
        import diffusers  # noqa: F401

        diffusers_ok = True
    except Exception:
        diffusers_ok = False
    return {
        "image": diffusers_ok and _models_ready(IMAGE_REPO),
        "video": diffusers_ok
        and _models_ready(VIDEO_BASE_REPO)
        and _models_ready(VIDEO_ADAPTER_REPO),
        "convert": bool(ffmpeg),
    }


@media_router.post("/image")
async def generate_image(req: ImageRequest):
    if not _models_ready(IMAGE_REPO):
        raise HTTPException(503, "Image model not downloaded yet")
    return _start("image", req)


@media_router.post("/video")
async def generate_video(req: VideoRequest):
    if not (_models_ready(VIDEO_BASE_REPO) and _models_ready(VIDEO_ADAPTER_REPO)):
        raise HTTPException(503, "Video models not downloaded yet")
    return _start("video", req)


@media_router.get("/jobs/{job_id}")
async def job_status(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "Unknown job")
    return job


def _local_only(request: Request) -> None:
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost"):
        raise HTTPException(403, "Local requests only")


def download_models(kind: str) -> None:
    """Download the model files for ``kind`` ('image' or 'video') into the cache."""
    from huggingface_hub import hf_hub_download, snapshot_download

    cache = str(MODELS_CACHE)
    patterns = ["*.json", "*.txt", "*fp16.safetensors"]
    if kind == "image":
        snapshot_download(IMAGE_REPO, allow_patterns=patterns, cache_dir=cache)
    elif kind == "video":
        snapshot_download(
            VIDEO_BASE_REPO,
            allow_patterns=patterns,
            ignore_patterns=["safety_checker/*"],
            cache_dir=cache,
        )
        hf_hub_download(VIDEO_ADAPTER_REPO, VIDEO_ADAPTER_FILE, cache_dir=cache)
        snapshot_download(
            VIDEO_ADAPTER_CONFIG_REPO,
            allow_patterns=["config.json"],
            cache_dir=cache,
        )
    else:
        raise ValueError(f"Unknown model kind: {kind}")


def _download_worker(kind: str) -> None:
    state = _downloads[kind]
    try:
        download_models(kind)
        state.update(status="done", error="")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Model download failed for %s", kind)
        state.update(status="error", error=str(exc)[:300])


@media_router.get("/models/status")
async def models_status():
    ready = {
        "image": _models_ready(IMAGE_REPO),
        "video": _models_ready(VIDEO_BASE_REPO) and _models_ready(VIDEO_ADAPTER_REPO),
    }
    return {
        k: {
            "ready": ready[k] and _downloads[k]["status"] != "downloading",
            "status": _downloads[k]["status"],
            "error": _downloads[k]["error"],
        }
        for k in ("image", "video")
    }


@media_router.post("/models/download")
async def models_download(req: ModelDownloadRequest, request: Request):
    _local_only(request)
    state = _downloads[req.kind]
    with _download_lock:
        if state["status"] == "downloading":
            return {"status": "downloading"}
        state.update(status="downloading", error="")
    threading.Thread(target=_download_worker, args=(req.kind,), daemon=True).start()
    return {"status": "downloading"}


@media_router.post("/open-site")
async def open_free_site(req: ModelDownloadRequest, request: Request):
    """Open a free hosted generator in the default browser (local only)."""
    _local_only(request)
    import webbrowser

    url = FREE_SITES[req.kind]
    webbrowser.open(url)
    return {"url": url}


@media_router.get("/library")
async def media_library():
    """List generated/converted files, newest first."""
    kinds = {
        ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
        ".mp4": "video", ".webm": "video", ".mkv": "video", ".mov": "video",
        ".mp3": "audio", ".wav": "audio", ".ogg": "audio", ".flac": "audio",
    }
    items = []
    if MEDIA_DIR.is_dir():
        for p in MEDIA_DIR.iterdir():
            kind = kinds.get(p.suffix.lower())
            if p.is_file() and kind and not p.name.startswith("upload-"):
                items.append((p.stat().st_mtime, kind, p.name))
    items.sort(reverse=True)
    return [
        {"name": n, "kind": k, "url": f"/v1/media/files/{n}", "modified": m}
        for m, k, n in items[:100]
    ]


@media_router.get("/files/{name}")
async def get_file(name: str):
    path = MEDIA_DIR / _safe_name(name)
    if not path.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(path)


@media_router.post("/convert")
async def convert(file: UploadFile = File(...), target: str = Form(...)):
    target = target.lower().lstrip(".")
    if target not in AUDIO_FORMATS | VIDEO_FORMATS:
        raise HTTPException(400, f"Unsupported format: {target}")
    try:
        import imageio_ffmpeg

        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:
        raise HTTPException(503, "ffmpeg is not available") from exc

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    stem = _safe_name(Path(file.filename or "input").stem)
    safe_in = _safe_name(file.filename or "in")
    src = MEDIA_DIR / f"upload-{uuid.uuid4().hex[:8]}-{safe_in}"
    out_name = f"{stem}-{uuid.uuid4().hex[:6]}.{target}"
    dst = MEDIA_DIR / out_name
    src.write_bytes(await file.read())
    cmd = [ffmpeg, "-y", "-i", str(src)]
    if target in AUDIO_FORMATS:
        cmd.append("-vn")
    cmd.append(str(dst))
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    finally:
        src.unlink(missing_ok=True)
    if proc.returncode != 0 or not dst.is_file():
        raise HTTPException(422, f"Conversion failed: {proc.stderr[-300:]}")
    return {"url": f"/v1/media/files/{out_name}", "name": out_name}
