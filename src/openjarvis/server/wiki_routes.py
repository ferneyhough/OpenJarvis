"""Optional offline Wikipedia (ZIM) knowledge source.

The user downloads a Kiwix ``.zim`` file into ``~/.openjarvis/wiki`` from
Settings (or asks Jarvis). Articles are read locally via ``libzim`` — no
network needed once a file is present.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

wiki_router = APIRouter(prefix="/v1/wiki", tags=["wiki"])

WIKI_DIR = Path.home() / ".openjarvis" / "wiki"
_STATE_FILE = "active.json"
_UA = {"User-Agent": "OpenJarvis/1.0"}
_MAX_ZIM = 4 * 1024 * 1024 * 1024  # 4 GB safety cap for downloads

_lock = threading.Lock()
_archives: dict[str, Any] = {}


def _wiki_dir() -> Path:
    WIKI_DIR.mkdir(parents=True, exist_ok=True)
    return WIKI_DIR


def _zim_files() -> list[Path]:
    return sorted(_wiki_dir().glob("*.zim"), key=lambda p: p.stat().st_size, reverse=True)


def _active_name() -> Optional[str]:
    try:
        data = json.loads((_wiki_dir() / _STATE_FILE).read_text(encoding="utf-8"))
        name = data.get("active")
        if name and (_wiki_dir() / name).exists():
            return name
    except (OSError, json.JSONDecodeError):
        pass
    files = _zim_files()
    return files[0].name if files else None


def _resolve_zim(name: Optional[str]) -> Path:
    files = _zim_files()
    if not files:
        raise HTTPException(status_code=404, detail="No .zim files — download one in Settings → Offline knowledge")
    if name:
        candidate = _wiki_dir() / Path(name).name
        if candidate not in files:
            raise HTTPException(status_code=404, detail=f"ZIM not found: {name}")
        return candidate
    active = _active_name()
    return _wiki_dir() / active if active else files[0]


def _archive(path: Path):
    key = str(path)
    with _lock:
        if key not in _archives:
            try:
                import libzim
            except ImportError as exc:
                raise HTTPException(status_code=503, detail="libzim is not installed on the server") from exc
            _archives[key] = libzim.Archive(str(path))
        return _archives[key]


def _entry_dict(entry) -> dict:
    return {
        "path": getattr(entry, "path", "") or "",
        "title": getattr(entry, "title", "") or getattr(entry, "path", "") or "",
        "mimetype": getattr(entry, "mimetype", "") or "",
    }


@wiki_router.get("/status")
def status() -> dict:
    try:
        import libzim  # noqa: F401
        available = True
    except ImportError:
        available = False
    files = _zim_files()
    return {
        "available": available,
        "dir": str(_wiki_dir()),
        "active": _active_name(),
        "files": [
            {"name": p.name, "size": p.stat().st_size, "size_mb": round(p.stat().st_size / 1e6, 1)}
            for p in files
        ],
    }


@wiki_router.post("/activate")
def activate(body: dict) -> dict:
    name = str(body.get("name", ""))
    candidate = _wiki_dir() / Path(name).name
    if not candidate.exists() or candidate.suffix.lower() != ".zim":
        raise HTTPException(status_code=404, detail="ZIM file not found")
    (_wiki_dir() / _STATE_FILE).write_text(json.dumps({"active": candidate.name}), encoding="utf-8")
    return {"active": candidate.name}


@wiki_router.delete("/file/{name}")
def delete_file(name: str) -> dict:
    path = _wiki_dir() / Path(name).name
    if path.suffix.lower() != ".zim" or not path.exists():
        raise HTTPException(status_code=404, detail="ZIM file not found")
    path.unlink()
    _archives.pop(str(path), None)
    active = _active_name()
    if active is None:
        try:
            (_wiki_dir() / _STATE_FILE).unlink()
        except OSError:
            pass
    return {"deleted": path.name}


@wiki_router.post("/download")
def download(body: dict) -> dict:
    url = str(body.get("url", "")).strip()
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.path.lower().endswith(".zim"):
        raise HTTPException(status_code=400, detail="URL must be an http(s) .zim file")
    name = Path(urllib.parse.unquote(parsed.path)).name or "download.zim"
    dest = _wiki_dir() / name
    if dest.exists() and dest.stat().st_size > 0:
        return {"name": name, "size": dest.stat().st_size, "already": True}
    tmp = dest.with_suffix(dest.suffix + ".part")
    try:
        req = urllib.request.Request(url, headers=_UA)
        with urllib.request.urlopen(req, timeout=60) as resp, open(tmp, "wb") as out:
            total = int(resp.headers.get("Content-Length") or 0)
            if total > _MAX_ZIM:
                tmp.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="File exceeds the 4 GB download limit")
            downloaded = 0
            while True:
                chunk = resp.read(1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                downloaded += len(chunk)
                if downloaded > _MAX_ZIM:
                    tmp.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="File exceeds the 4 GB download limit")
        tmp.replace(dest)
    except HTTPException:
        raise
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        raise HTTPException(status_code=502, detail=f"Download failed: {exc}") from exc
    return {"name": name, "size": dest.stat().st_size, "already": False}


@wiki_router.get("/search")
def search(
    q: str = Query(..., min_length=1),
    zim: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
) -> dict:
    path = _resolve_zim(zim)
    archive = _archive(path)
    try:
        searcher = archive.get_searcher()
        results = searcher.search(q)
        items = []
        for i, result in enumerate(results):
            if i >= limit:
                break
            try:
                entry = result.get_entry()
                items.append(_entry_dict(entry))
            except Exception:
                continue
        return {"zim": path.name, "query": q, "results": items}
    except Exception as exc:
        # Fall back to path-prefix matching when the Xapian index is absent.
        needle = q.strip().lower()
        items = []
        try:
            for entry in archive:
                title = (getattr(entry, "title", "") or "").lower()
                p = (getattr(entry, "path", "") or "").lower()
                if needle in title or needle in p:
                    items.append(_entry_dict(entry))
                    if len(items) >= limit:
                        break
        except Exception:
            pass
        return {"zim": path.name, "query": q, "results": items, "note": f"index search unavailable ({exc}); path match only"}


@wiki_router.get("/article")
def article(path_: str = Query(..., alias="path"), zim: Optional[str] = None) -> dict:
    zim_path = _resolve_zim(zim)
    archive = _archive(zim_path)
    try:
        entry = archive.get_entry_by_path(path_)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Entry not found: {path_} ({exc})") from exc
    try:
        item = entry.get_item()
        content = item.get_data().decode("utf-8", errors="replace")
    except Exception:
        content = ""
    mimetype = getattr(entry, "mimetype", "") or ""
    return {
        "zim": zim_path.name,
        "path": path_,
        "title": getattr(entry, "title", "") or path_,
        "mimetype": mimetype,
        "content": content,
        "is_html": "html" in mimetype,
    }
