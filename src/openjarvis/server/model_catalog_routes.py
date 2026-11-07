"""Smart model catalog, inference-engine status, and per-section presets.

Backed entirely by local/open-weight sources — no hosted catalog APIs.
Fit badges are computed from live hardware detection (GPU VRAM / system RAM).
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request

logger = logging.getLogger(__name__)

router = APIRouter(tags=["model-catalog"])

# ---------------------------------------------------------------------------
# Curated catalog
# ---------------------------------------------------------------------------
# size_gb  = approximate download size (Q4-class quant)
# params_b = parameter count (for display)
# verified = tag confirmed pullable from the Ollama registry; research-sourced
#            names are flagged False so the UI can mark them "unverified".
# cloud_only = weights exist but no local runtime tag — listed for awareness
#              only, never offered for download.

_CATALOG: List[Dict[str, Any]] = [
    # --- Qwen3.5 family (verified Ollama tags) ---
    {"id": "qwen3.5:0.8b", "name": "Qwen3.5 0.8B", "params_b": 0.8, "size_gb": 1.0,
     "desc": "Fastest, lightest — embedded/low-end hardware", "tags": ["chat", "fast"], "verified": True},
    {"id": "qwen3.5:2b", "name": "Qwen3.5 2B", "params_b": 2.0, "size_gb": 2.7,
     "desc": "Lightweight daily driver", "tags": ["chat", "fast"], "verified": True},
    {"id": "qwen3.5:4b", "name": "Qwen3.5 4B", "params_b": 4.0, "size_gb": 3.4,
     "desc": "Recommended default — good balance", "tags": ["chat", "fast", "default"], "verified": True},
    {"id": "qwen3.5:9b", "name": "Qwen3.5 9B", "params_b": 9.0, "size_gb": 6.6,
     "desc": "Stronger reasoning and coding", "tags": ["chat", "reasoning", "code"], "verified": True},
    {"id": "qwen3.5:27b", "name": "Qwen3.5 27B", "params_b": 27.0, "size_gb": 17.0,
     "desc": "Large local model — needs ~24 GB", "tags": ["chat", "reasoning", "code"], "verified": True},
    {"id": "qwen3.5:35b", "name": "Qwen3.5 35B", "params_b": 35.0, "size_gb": 24.0,
     "desc": "High-end local — workstation GPUs", "tags": ["chat", "reasoning", "code"], "verified": True},
    {"id": "qwen3.5:122b", "name": "Qwen3.5 122B", "params_b": 122.0, "size_gb": 81.0,
     "desc": "Largest — multi-GPU / big-RAM systems only", "tags": ["chat", "reasoning", "code"], "verified": True},
    # --- Other verified Ollama tags ---
    {"id": "llama3.3:latest", "name": "Llama 3.3 8B", "params_b": 8.0, "size_gb": 4.9,
     "desc": "Meta's solid general model", "tags": ["chat", "creative"], "verified": True},
    {"id": "mistral:latest", "name": "Mistral 7B", "params_b": 7.0, "size_gb": 4.1,
     "desc": "Efficient European model", "tags": ["chat", "creative"], "verified": True},
    {"id": "gemma3:latest", "name": "Gemma 3 4B", "params_b": 4.0, "size_gb": 3.3,
     "desc": "Google's compact multimodal model", "tags": ["chat", "vision"], "verified": True},
    {"id": "deepseek-r1:7b", "name": "DeepSeek R1 7B", "params_b": 7.0, "size_gb": 4.7,
     "desc": "Reasoning specialist with visible thinking", "tags": ["reasoning", "code"], "verified": True},
    {"id": "phi4:latest", "name": "Phi-4 14B", "params_b": 14.0, "size_gb": 9.1,
     "desc": "Microsoft's efficient reasoning/coding model", "tags": ["reasoning", "code"], "verified": True},
    # --- Research-sourced (article-listed, tag unverified) ---
    {"id": "mimo-v2.6:9b", "name": "MiMo-V2.6 9B", "params_b": 9.0, "size_gb": 6.6,
     "desc": "Laptop-tier candidate per DevToolLab local-LLM survey", "tags": ["chat"], "verified": False},
    {"id": "gemma4:12b", "name": "Gemma 4 12B", "params_b": 12.0, "size_gb": 8.0,
     "desc": "Laptop-tier candidate per DevToolLab local-LLM survey", "tags": ["chat"], "verified": False},
    {"id": "gemma4:26b", "name": "Gemma 4 26B", "params_b": 26.0, "size_gb": 17.0,
     "desc": "24 GB GPU tier per DevToolLab local-LLM survey", "tags": ["chat", "reasoning"], "verified": False},
    {"id": "qwen3.8:27b", "name": "Qwen3.8 27B", "params_b": 27.0, "size_gb": 18.0,
     "desc": "24 GB GPU tier per DevToolLab local-LLM survey", "tags": ["chat", "reasoning", "code"], "verified": False},
    {"id": "flint:latest", "name": "Flint 40B MoE", "params_b": 40.0, "size_gb": 22.9,
     "desc": "MoE — strong hardware tier per DevToolLab survey", "tags": ["chat", "reasoning"], "verified": False},
    # --- Cloud-only (weights public, no local tag) — awareness only ---
    {"id": "deepseek-v4", "name": "DeepSeek V4", "params_b": 0, "size_gb": 0,
     "desc": "Cloud-only — public weights but no local/Ollama tag", "tags": [], "verified": False, "cloud_only": True},
    {"id": "glm-5.3", "name": "GLM-5.3", "params_b": 0, "size_gb": 0,
     "desc": "Cloud-only — no local tag", "tags": [], "verified": False, "cloud_only": True},
    {"id": "kimi-k3", "name": "Kimi K3", "params_b": 0, "size_gb": 0,
     "desc": "Cloud-only — no local tag", "tags": [], "verified": False, "cloud_only": True},
    {"id": "minimax-m3", "name": "MiniMax M3", "params_b": 0, "size_gb": 0,
     "desc": "Cloud-only — no local tag", "tags": [], "verified": False, "cloud_only": True},
]

# Per-section size preference (GB of download) for preset recommendations.
_SECTION_PREF_GB: Dict[str, float] = {
    "chat": 5.0,
    "code": 9.0,
    "reasoning": 9.0,
    "creative": 5.0,
    "kids": 4.0,
    "vision": 4.0,
    "short": 3.0,
    "long": 17.0,
}

_PRESET_SECTIONS = list(_SECTION_PREF_GB.keys())

# ---------------------------------------------------------------------------
# Hardware / fit
# ---------------------------------------------------------------------------

_hw_cache: tuple[float, float, str] | None = None  # (avail_gb, ram_gb, gpu_name)
_hw_lock = threading.Lock()


def _hardware_snapshot() -> tuple[float, float, str]:
    """Return (available_gb, total_ram_gb, gpu_label), cached for the process."""
    global _hw_cache
    with _hw_lock:
        if _hw_cache is not None:
            return _hw_cache
    try:
        from openjarvis.core.config import _available_memory_gb, detect_hardware

        hw = detect_hardware()
        avail = _available_memory_gb(hw)
        gpu = hw.gpu.name if hw.gpu else ""
        snap = (round(avail, 1), round(hw.ram_gb, 1), gpu)
    except Exception:
        snap = (0.0, 0.0, "")
    with _hw_lock:
        _hw_cache = snap
    return snap


def _fit_for(size_gb: float) -> str:
    avail, _ram, _gpu = _hardware_snapshot()
    if avail <= 0 or size_gb <= 0:
        return "unknown"
    if size_gb <= avail * 0.75:
        return "great"
    if size_gb <= avail * 1.15:
        return "tight"
    return "toolarge"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/v1/models/catalog")
async def model_catalog(request: Request):
    """Curated open-weight model catalog with live hardware-fit badges."""
    avail_gb, ram_gb, gpu = _hardware_snapshot()
    installed = set(_installed_model_ids(request))

    entries = []
    for item in _CATALOG:
        if item.get("cloud_only"):
            entries.append({**item, "fit": "cloud", "installed": False})
            continue
        entries.append(
            {
                **item,
                "fit": _fit_for(item["size_gb"]),
                "installed": item["id"] in installed,
            }
        )
    return {
        "data": entries,
        "hardware": {
            "available_gb": avail_gb,
            "ram_gb": ram_gb,
            "gpu": gpu,
        },
    }


_engines_cache: tuple[float, list[dict]] | None = None
_engines_lock = threading.Lock()
_ENGINES_TTL = 30.0


@router.get("/v1/engines")
async def list_engines(request: Request):
    """Live status of probed local inference engines (30s cache)."""
    global _engines_cache
    now = time.time()
    with _engines_lock:
        if _engines_cache and now - _engines_cache[0] < _ENGINES_TTL:
            return {"engines": _engines_cache[1]}

    import asyncio

    from openjarvis.engine._discovery import EngineRegistry, _make_engine

    config = getattr(request.app.state, "config", None)
    # Port this server is bound to — engines defaulting to the same port
    # (uzu, vllm at :8000) would "probe" Jarvis itself and false-positive.
    server_port = request.url.port
    # This panel lists *local* inference servers. Exclude cloud routers and
    # non-localhost hosted engines (nim → integrate.api.nvidia.com, devin).
    _SKIP = {"cloud", "litellm", "multi", "devin", "nim"}
    keys = [k for k in EngineRegistry.keys() if k not in _SKIP]

    async def _probe(key: str) -> dict | None:
        host = ""
        healthy = False
        models: list[str] = []
        try:
            if config is not None:
                eng = await asyncio.to_thread(_make_engine, key, config)
            else:
                eng = EngineRegistry.get(key)()
            if getattr(eng, "is_cloud", False):
                return None  # cloud engines aren't local backends
            host = getattr(eng, "_host", "") or getattr(eng, "_default_host", "")
            from urllib.parse import urlparse

            host_port = urlparse(host).port
            if host_port == server_port:
                return None  # would probe this very server
            hostname = (urlparse(host).hostname or "").lower()
            if hostname and hostname not in ("localhost", "127.0.0.1", "::1"):
                return None  # not a local backend
            healthy = await asyncio.to_thread(eng.health)
            if healthy:
                try:
                    models = await asyncio.to_thread(eng.list_models)
                except Exception:
                    models = []
        except Exception:
            pass
        return {"key": key, "host": host, "healthy": healthy, "model_count": len(models)}

    probed = await asyncio.gather(*(_probe(k) for k in keys))
    engines = [e for e in probed if e is not None]
    result = sorted(engines, key=lambda e: (not e["healthy"], e["key"]))
    with _engines_lock:
        _engines_cache = (now, result)
    return {"engines": result}


_NON_LOCAL_ENGINES = {"nim", "cloud", "litellm", "devin"}


def _installed_model_ids(request: Request) -> List[str]:
    """Model IDs served by *local* backends only (no cloud-routed models)."""
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        return []
    try:
        ids = list(engine.list_models())
    except Exception:
        return []

    from openjarvis.engine.multi import MultiEngine
    from openjarvis.server.cloud_router import is_cloud_model

    key_for = engine.engine_key_for if isinstance(engine, MultiEngine) else None
    local: List[str] = []
    for mid in ids:
        if is_cloud_model(mid):
            continue
        key = key_for(mid) if key_for else getattr(engine, "engine_id", "")
        if key in _NON_LOCAL_ENGINES:
            continue
        local.append(mid)
    return local


def _recommend_for_section(section: str, request: Request) -> dict:
    """Pick the best installed (or downloadable) model for a section."""
    pref_gb = _SECTION_PREF_GB.get(section, 5.0)
    installed = _installed_model_ids(request)
    catalog_by_id = {c["id"]: c for c in _CATALOG if not c.get("cloud_only")}

    # 1) Prefer an installed model whose catalog entry fits the section.
    candidates = []
    for mid in installed:
        spec = catalog_by_id.get(mid)
        size = spec["size_gb"] if spec else _estimate_size_gb(mid)
        candidates.append((abs(size - pref_gb), mid, size))
    if candidates:
        candidates.sort()
        _, best_id, best_size = candidates[0]
        return {
            "section": section,
            "model": best_id,
            "source": "installed",
            "fit": _fit_for(best_size),
        }

    # 2) Otherwise recommend the catalog entry closest to the preference that fits.
    avail, _ram, _gpu = _hardware_snapshot()
    best = None
    for item in _CATALOG:
        if item.get("cloud_only") or not item.get("verified", True):
            continue
        fit = _fit_for(item["size_gb"])
        if fit in ("great", "tight"):
            score = abs(item["size_gb"] - pref_gb)
            if best is None or score < best[0]:
                best = (score, item)
    if best:
        item = best[1]
        return {
            "section": section,
            "model": item["id"],
            "source": "catalog",
            "fit": _fit_for(item["size_gb"]),
        }
    return {"section": section, "model": "", "source": "none", "fit": "unknown"}


def _estimate_size_gb(model_id: str) -> float:
    """Rough size estimate for installed models missing from the catalog."""
    leaf = model_id.lower().rsplit(":", 1)[0]
    for suffix, gb in (("122b", 81), ("35b", 24), ("32b", 20), ("30b", 19),
                       ("27b", 17), ("26b", 17), ("14b", 9), ("12b", 8),
                       ("9b", 6.6), ("8b", 5), ("7b", 4.7), ("4b", 3.4),
                       ("3b", 2.5), ("2b", 2), ("1b", 1), ("0b", 0.8)):
        if suffix in leaf:
            return gb
    return 5.0


@router.get("/v1/models/presets")
async def model_presets(request: Request):
    """Recommended model per section (chat/code/reasoning/...), with overrides."""
    config = getattr(request.app.state, "config", None)
    overrides: Dict[str, str] = {}
    if config is not None:
        try:
            overrides = dict(getattr(config.intelligence, "pill_models", {}) or {})
        except Exception:
            overrides = {}

    presets = []
    for section in _PRESET_SECTIONS:
        rec = _recommend_for_section(section, request)
        override = overrides.get(section)
        presets.append({**rec, "override": override or ""})
    return {"sections": _PRESET_SECTIONS, "presets": presets}


@router.post("/v1/models/presets")
async def save_model_preset(request: Request):
    """Persist a per-section model override to config.toml [intelligence.pill_models]."""
    body = await request.json()
    section = str(body.get("section", "")).strip()
    model = str(body.get("model", "")).strip()
    if section not in _PRESET_SECTIONS:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=f"Unknown section {section!r}")

    config = getattr(request.app.state, "config", None)
    config_path = getattr(config, "_config_path", None) if config is not None else None
    if config_path is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=500, detail="No config path available")

    import tomlkit

    path = Path(config_path)
    if path.exists():
        doc = tomlkit.parse(path.read_text(encoding="utf-8"))
    else:
        doc = tomlkit.document()
    intel = doc.get("intelligence")
    if intel is None or not hasattr(intel, "items"):
        intel = tomlkit.table()
        doc["intelligence"] = intel
    pm = intel.get("pill_models")
    if pm is None:
        pm = tomlkit.table()
        intel["pill_models"] = pm
    if model:
        pm[section] = model
    else:
        pm.pop(section, None)
    path.write_text(tomlkit.dumps(doc), encoding="utf-8")

    # Keep the live config object in sync.
    if config is not None:
        try:
            current = dict(getattr(config.intelligence, "pill_models", {}) or {})
            if model:
                current[section] = model
            else:
                current.pop(section, None)
            config.intelligence.pill_models = current
        except Exception:
            pass

    return {"status": "ok", "section": section, "model": model}


__all__ = ["router"]
