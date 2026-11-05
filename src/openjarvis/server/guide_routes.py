"""Media guide routes: TV schedule, movie/show catalog, local media, links.

Data sources (all free, no API key):
- TVMaze ``/schedule`` — what's airing today per country (TV guide).
- Cinemeta (Stremio addon) — movie/series catalog, search, and metadata.

Local media is scanned from ``OPENJARVIS_MEDIA_DIRS`` (os.pathsep-separated)
plus the app media dir and ``~/Videos``. Guide links are user bookmarks stored
in ``~/.openjarvis/guide_links.json``.

Guide/catalog endpoints are cloud calls and return 503 while offline mode is
enabled; local media and links keep working.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

guide_router = APIRouter(prefix="/v1/guide", tags=["guide"])

_TVMAZE_SCHEDULE = "https://api.tvmaze.com/schedule"
_CINEMETA = "https://v3-cinemeta.strem.io"
_TIMEOUT = 15
_CACHE_TTL = 300.0

_VIDEO_EXTS = {
    ".mp4",
    ".mkv",
    ".avi",
    ".mov",
    ".wmv",
    ".flac",
    ".m4v",
    ".mpg",
    ".mpeg",
    ".webm",
    ".ts",
    ".m2ts",
    ".vob",
}
_AUDIO_EXTS = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac", ".opus", ".wma"}

_cache: dict[str, tuple[float, Any]] = {}


def _cached_get(url: str) -> Any:
    """GET JSON with a short TTL cache; raises on HTTP/parse errors."""
    now = time.monotonic()
    hit = _cache.get(url)
    if hit is not None and now - hit[0] < _CACHE_TTL:
        return hit[1]
    req = urllib.request.Request(url, headers={"User-Agent": "OpenJarvis/1.0"})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    _cache[url] = (now, data)
    return data


def _require_online() -> None:
    from openjarvis.core.config import load_config

    if getattr(load_config(), "offline_mode", False):
        raise HTTPException(
            status_code=503,
            detail="Offline mode is enabled; the media guide needs internet.",
        )


_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: Optional[str]) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", _TAG_RE.sub("", text)).strip()


def _size_str(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


# ---------------------------------------------------------------------------
# TV guide (TVMaze)
# ---------------------------------------------------------------------------


@guide_router.get("/tv")
def tv_guide(country: str = "US", date: Optional[str] = None) -> dict:
    """Episodes airing on ``date`` (YYYY-MM-DD, default today) in ``country``."""
    _require_online()
    country = re.sub(r"[^A-Za-z]", "", country or "US").upper()[:3] or "US"
    params: dict[str, str] = {"country": country}
    if date:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
        params["date"] = date
    url = f"{_TVMAZE_SCHEDULE}?{urllib.parse.urlencode(params)}"
    try:
        raw = _cached_get(url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"TVMaze unavailable: {exc}")

    episodes = []
    for ep in raw if isinstance(raw, list) else []:
        show = ep.get("show") or {}
        rating = (show.get("rating") or {}).get("average")
        episodes.append(
            {
                "id": ep.get("id"),
                "name": ep.get("name"),
                "season": ep.get("season"),
                "number": ep.get("number"),
                "airdate": ep.get("airdate"),
                "airtime": ep.get("airtime"),
                "runtime": ep.get("runtime"),
                "network": ((ep.get("network") or {}).get("name"))
                or ((show.get("network") or {}).get("name")),
                "show": {
                    "id": show.get("id"),
                    "name": show.get("name"),
                    "genres": show.get("genres") or [],
                    "rating": rating,
                    "image": ((show.get("image") or {}).get("medium")),
                    "url": show.get("url"),
                },
                "summary": _strip_html(ep.get("summary")),
                "image": ((ep.get("image") or {}).get("medium")),
                "url": ep.get("url"),
            }
        )
    return {"country": country, "date": date or "today", "episodes": episodes}


# ---------------------------------------------------------------------------
# Catalog + search + details (Cinemeta)
# ---------------------------------------------------------------------------

_CATALOG_TYPES = {"movie", "series"}


def _meta_brief(meta: dict) -> dict:
    imdb = str(meta.get("imdb_id") or meta.get("id") or "")
    return {
        "imdb_id": imdb,
        "name": meta.get("name"),
        "year": meta.get("releaseInfo") or meta.get("year"),
        "poster": meta.get("poster"),
        "genres": meta.get("genres") or [],
        "rating": meta.get("imdbRating") or meta.get("rating"),
        "description": _strip_html(meta.get("description")),
        "type": meta.get("type"),
    }


@guide_router.get("/catalog/{media_type}")
def guide_catalog(media_type: str) -> dict:
    """Top movies or series from the Cinemeta catalog."""
    _require_online()
    media_type = media_type.lower()
    if media_type not in _CATALOG_TYPES:
        raise HTTPException(status_code=400, detail="type must be movie or series")
    url = f"{_CINEMETA}/catalog/{media_type}/top.json"
    try:
        data = _cached_get(url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Catalog unavailable: {exc}")
    metas = (_meta_brief(m) for m in (data.get("metas") or []))
    return {"type": media_type, "items": list(metas)}


@guide_router.get("/search")
def guide_search(q: str, type: str = "all") -> dict:
    """Search movies/series by title via Cinemeta."""
    _require_online()
    q = (q or "").strip()
    if len(q) < 2:
        raise HTTPException(status_code=400, detail="query too short")
    types = ["movie", "series"] if type == "all" else [type]
    if any(t not in _CATALOG_TYPES for t in types):
        raise HTTPException(
            status_code=400, detail="type must be movie, series, or all"
        )
    encoded = urllib.parse.quote(q)
    items: list[dict] = []
    errors: list[str] = []
    for t in types:
        url = f"{_CINEMETA}/catalog/{t}/top/search={encoded}.json"
        try:
            data = _cached_get(url)
        except Exception as exc:
            errors.append(f"{t}: {exc}")
            continue
        for m in data.get("metas") or []:
            brief = _meta_brief(m)
            brief["type"] = t
            items.append(brief)
    if not items and errors:
        raise HTTPException(status_code=502, detail="; ".join(errors))
    return {"query": q, "items": items}


@guide_router.get("/meta/{media_type}/{imdb_id}")
def guide_meta(media_type: str, imdb_id: str) -> dict:
    """Full metadata for one movie/series (Cinemeta ``meta`` endpoint)."""
    _require_online()
    media_type = media_type.lower()
    if media_type not in _CATALOG_TYPES:
        raise HTTPException(status_code=400, detail="type must be movie or series")
    clean = re.sub(r"[^A-Za-z0-9]", "", imdb_id)
    if not clean:
        raise HTTPException(status_code=400, detail="invalid id")
    imdb = clean if clean.lower().startswith("tt") else f"tt{clean}"
    url = f"{_CINEMETA}/meta/{media_type}/{imdb}.json"
    try:
        data = _cached_get(url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Metadata unavailable: {exc}")
    meta = data.get("meta") or {}
    videos = meta.get("videos") or []
    return {
        "meta": _meta_brief(meta) | {"id": meta.get("id")},
        "trailers": [
            {"name": v.get("name"), "url": v.get("url"), "kind": v.get("kind")}
            for v in videos
            if v.get("kind") in ("Trailer", "Clip")
        ],
        "imdb_url": f"https://www.imdb.com/title/{imdb}/",
    }


# ---------------------------------------------------------------------------
# Local media scan
# ---------------------------------------------------------------------------


def _local_media_dirs() -> list[Path]:
    dirs: list[Path] = []
    env = os.environ.get("OPENJARVIS_MEDIA_DIRS", "")
    for part in env.split(os.pathsep):
        if part.strip():
            dirs.append(Path(part.strip()).expanduser())
    media_dir = Path(
        os.environ.get(
            "OPENJARVIS_MEDIA_DIR", str(Path.home() / ".openjarvis" / "media")
        )
    )
    dirs.append(media_dir)
    dirs.append(Path.home() / "Videos")
    # De-dupe while preserving order.
    seen: set[str] = set()
    unique = []
    for d in dirs:
        key = str(d.resolve()) if d.exists() else str(d)
        if key not in seen:
            seen.add(key)
            unique.append(d)
    return unique


_EPISODE_RE = re.compile(
    r"[sS](\d{1,2})[ ._-]*[eE](\d{1,3})|(?<!\d)(\d{1,2})x(\d{1,3})(?!\d)"
)


def _scan_dir(root: Path, max_depth: int = 4, max_files: int = 5000) -> list[dict]:
    files: list[dict] = []
    stack = [(root, 0)]
    while stack and len(files) < max_files:
        directory, depth = stack.pop()
        try:
            entries = list(directory.iterdir())
        except OSError:
            continue
        for entry in entries:
            if len(files) >= max_files:
                break
            try:
                if entry.is_dir():
                    if depth < max_depth and not entry.name.startswith("."):
                        stack.append((entry, depth + 1))
                elif entry.is_file() and entry.suffix.lower() in (
                    _VIDEO_EXTS | _AUDIO_EXTS
                ):
                    stat = entry.stat()
                    kind = "video" if entry.suffix.lower() in _VIDEO_EXTS else "audio"
                    ep = _EPISODE_RE.search(entry.stem)
                    files.append(
                        {
                            "name": entry.stem,
                            "filename": entry.name,
                            "path": str(entry),
                            "kind": kind,
                            "size": stat.st_size,
                            "size_str": _size_str(stat.st_size),
                            "modified": stat.st_mtime,
                            "season": int(ep.group(1) or ep.group(3)) if ep else None,
                            "episode": int(ep.group(2) or ep.group(4)) if ep else None,
                        }
                    )
            except OSError:
                continue
    files.sort(key=lambda f: (f["season"] or 0, f["episode"] or 0, f["name"].lower()))
    return files


@guide_router.get("/local")
def guide_local() -> dict:
    """Local media files grouped by their top-level folder under each root."""
    groups: dict[str, dict] = {}
    scanned_roots: list[str] = []
    for root in _local_media_dirs():
        if not root.is_dir():
            continue
        scanned_roots.append(str(root))
        files = _scan_dir(root)
        if not files:
            continue
        by_folder: dict[str, list[dict]] = {}
        for f in files:
            try:
                rel = Path(f["path"]).relative_to(root)
            except ValueError:
                rel = Path(f["path"])
            folder = rel.parts[0] if len(rel.parts) > 1 else "(root)"
            by_folder.setdefault(folder, []).append(f)
        for folder, items in by_folder.items():
            key = f"{root.name}/{folder}"
            groups[key] = {
                "name": folder if folder != "(root)" else root.name,
                "root": str(root),
                "folder": folder,
                "count": len(items),
                "items": items,
            }
    return {"roots": scanned_roots, "groups": list(groups.values())}


# ---------------------------------------------------------------------------
# User links (bookmarks)
# ---------------------------------------------------------------------------

_LINKS_FILE = (
    Path(os.environ.get("OPENJARVIS_CONFIG_DIR", str(Path.home() / ".openjarvis")))
    / "guide_links.json"
)


def _load_links() -> list[dict]:
    try:
        data = json.loads(_LINKS_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save_links(links: list[dict]) -> None:
    _LINKS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _LINKS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(links, indent=2), encoding="utf-8")
    tmp.replace(_LINKS_FILE)


class LinkIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=1, max_length=2000)
    category: str = Field(default="", max_length=100)
    note: str = Field(default="", max_length=500)


class LinkPatch(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    url: Optional[str] = Field(default=None, max_length=2000)
    category: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=500)


@guide_router.get("/links")
def list_links() -> dict:
    return {"links": _load_links()}


@guide_router.post("/links")
def add_link(body: LinkIn) -> dict:
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must start with http(s)://")
    links = _load_links()
    link = {
        "id": uuid.uuid4().hex[:12],
        "title": body.title.strip(),
        "url": url,
        "category": body.category.strip(),
        "note": body.note.strip(),
        "created": time.time(),
    }
    links.append(link)
    _save_links(links)
    return {"link": link}


@guide_router.patch("/links/{link_id}")
def patch_link(link_id: str, body: LinkPatch) -> dict:
    links = _load_links()
    for link in links:
        if link.get("id") == link_id:
            for field, value in body.model_dump(exclude_unset=True).items():
                if value is not None:
                    link[field] = value.strip() if isinstance(value, str) else value
            _save_links(links)
            return {"link": link}
    raise HTTPException(status_code=404, detail="link not found")


@guide_router.delete("/links/{link_id}")
def delete_link(link_id: str) -> dict:
    links = _load_links()
    kept = [link for link in links if link.get("id") != link_id]
    if len(kept) == len(links):
        raise HTTPException(status_code=404, detail="link not found")
    _save_links(kept)
    return {"deleted": link_id}
