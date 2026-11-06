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

import gzip
import hashlib
import ipaddress
import json
import logging
import mimetypes
import os
import re
import time
import urllib.parse
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response, StreamingResponse
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
def guide_catalog(media_type: str, genre: str = "") -> dict:
    """Top movies or series from the Cinemeta catalog, optionally by genre."""
    _require_online()
    media_type = media_type.lower()
    if media_type not in _CATALOG_TYPES:
        raise HTTPException(status_code=400, detail="type must be movie or series")
    suffix = ""
    if genre:
        safe_genre = urllib.parse.quote(genre.strip(), safe="")
        suffix = f"/genre={safe_genre}"
    url = f"{_CINEMETA}/catalog/{media_type}/top{suffix}.json"
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
        "episodes": [
            {
                "season": v.get("season"),
                "episode": v.get("episode"),
                "title": v.get("title"),
                "released": v.get("released"),
                "thumbnail": v.get("thumbnail"),
            }
            for v in videos
            if v.get("season") is not None and v.get("episode") is not None
        ],
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
    # In-app download folders (VOD torrents, etc.) are playable local media.
    dirs.append(Path.home() / ".openjarvis" / "downloads")
    dirs.append(Path.home() / ".openjarvis" / "torrents")
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


@guide_router.get("/media-file")
def guide_media_file(path: str, request: Request):
    """Stream a local media file for in-app playback.

    Only files inside the scanned media directories with a known media
    extension are served. Supports single-range requests so <video> seeking
    works.
    """
    try:
        target = Path(path).expanduser().resolve()
    except (OSError, RuntimeError):
        raise HTTPException(status_code=400, detail="invalid path")
    if target.suffix.lower() not in (_VIDEO_EXTS | _AUDIO_EXTS) or not target.is_file():
        raise HTTPException(status_code=404, detail="not a media file")
    allowed = False
    for root in _local_media_dirs():
        try:
            resolved_root = root.resolve()
        except OSError:
            continue
        if target == resolved_root or resolved_root in target.parents:
            allowed = True
            break
    if not allowed:
        raise HTTPException(status_code=403, detail="path outside media directories")

    media_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
    size = target.stat().st_size
    range_header = request.headers.get("range")
    if range_header:
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", range_header.strip())
        if match:
            start_s, end_s = match.groups()
            if start_s == "" and end_s == "":
                raise HTTPException(status_code=416, detail="invalid range")
            if start_s == "":
                length = int(end_s)
                start = max(0, size - length)
                end = size - 1
            else:
                start = int(start_s)
                end = min(int(end_s) if end_s else size - 1, size - 1)
            if start > end or start >= size:
                raise HTTPException(status_code=416, detail="range not satisfiable")
            with target.open("rb") as handle:
                handle.seek(start)
                data = handle.read(end - start + 1)
            return Response(
                content=data,
                status_code=206,
                media_type=media_type,
                headers={
                    "Content-Range": f"bytes {start}-{end}/{size}",
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(len(data)),
                },
            )
    return FileResponse(target, media_type=media_type)


# ---------------------------------------------------------------------------
# Remote document fetch (M3U playlists / XMLTV guides)
# ---------------------------------------------------------------------------

_FETCH_LIMITS = {"playlist": 4 * 1024 * 1024, "guide": 24 * 1024 * 1024}


def _check_fetch_url(url: str) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise HTTPException(
            status_code=400, detail="url must be http(s) without credentials"
        )
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="credentials in URL not allowed")
    # Block obvious local targets to keep this a public-document proxy.
    host = parsed.hostname.lower()
    if host in ("localhost",) or host.endswith(".local") or host.endswith(".internal"):
        raise HTTPException(status_code=400, detail="local hosts are not allowed")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise HTTPException(
                status_code=400, detail="private addresses are not allowed"
            )
    except ValueError:
        pass  # hostname, not a literal IP — allowed
    return parsed


@guide_router.get("/fetch")
def guide_fetch_document(url: str, kind: str = "playlist") -> dict:
    """Fetch a remote M3U playlist or XMLTV guide as text (server-side, no CORS)."""
    _require_online()
    if kind not in _FETCH_LIMITS:
        raise HTTPException(status_code=400, detail="kind must be playlist or guide")
    parsed = _check_fetch_url(url)
    target = urllib.parse.urlunparse(parsed)
    req = urllib.request.Request(
        target, headers={"User-Agent": "OpenJarvis/1.0", "Accept": "*/*"}
    )
    max_bytes = _FETCH_LIMITS[kind]
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            chunks = []
            size = 0
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=(
                            f"source exceeds the {max_bytes // (1024 * 1024)} MB limit"
                        ),
                    )
                chunks.append(chunk)
            raw = b"".join(chunks)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"fetch failed: {exc}")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=502, detail="source is not valid UTF-8 text")
    content_type = resp.headers.get("Content-Type", "")
    return {"text": text, "bytes": size, "content_type": content_type}


@guide_router.post("/prefetch")
def guide_prefetch() -> dict:
    """Manually trigger the daily EPG warm-up (off by default at boot)."""
    prefetch_epg_sources()
    return {"started": True}


@guide_router.get("/probe")
def guide_probe(url: str, ua: str = "", ref: str = "") -> dict:
    """Quick reachability check for a stream URL (HEAD, GET fallback).

    Used before playback so dead streams report an error instead of a black
    player. Times out fast — this must never block the UI for long.
    """
    _require_online()
    parsed = _check_fetch_url(url)
    target = urllib.parse.urlunparse(parsed)
    headers = {"User-Agent": ua or "OpenJarvis/1.0", "Accept": "*/*"}
    if ref:
        headers["Referer"] = ref
    # Streams frequently use self-signed or oddly-chained certs — a probe only
    # checks reachability, so certificate verification is not required here.
    import ssl

    ctx = ssl._create_unverified_context()
    try:
        req = urllib.request.Request(target, headers=headers, method="HEAD")
        with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
            return {
                "ok": True,
                "status": resp.status,
                "content_type": resp.headers.get("Content-Type", ""),
            }
    except Exception:
        pass
    try:
        req = urllib.request.Request(
            target, headers={**headers, "Range": "bytes=0-0"}
        )
        with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
            return {
                "ok": resp.status in (200, 206),
                "status": resp.status,
                "content_type": resp.headers.get("Content-Type", ""),
            }
    except urllib.error.HTTPError as exc:
        # A 4xx/5xx still proves the host is reachable; only network-level
        # failures mean the stream is dead.
        return {"ok": False, "status": exc.code, "content_type": ""}
    except Exception as exc:
        return {"ok": False, "status": 0, "content_type": "", "error": str(exc)}


# ---------------------------------------------------------------------------
# Stream proxy — fetches channel streams server-side with the UA/Referer the
# playlist requires. This makes header-restricted ("geo") streams playable;
# true geo-IP blocks still fail and are caught by /probe.
# ---------------------------------------------------------------------------

_STREAM_MAX_BYTES = 8 * 1024 * 1024  # playlists are small; segments stream through


def _proxy_stream_url(target: str, ua: str, ref: str) -> str:
    params = urllib.parse.urlencode({"url": target, "ua": ua, "ref": ref})
    return f"/v1/guide/stream?{params}"


def _abs_url(uri: str, base: str) -> str:
    return urllib.parse.urljoin(base, uri)


def _rewrite_m3u8(text: str, base: str, ua: str, ref: str) -> str:
    out: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            out.append(line)
            continue
        if stripped.startswith("#"):
            # EXT-X-KEY / EXT-X-MAP carry URI="..." attributes to rewrite too.
            if 'URI="' in stripped:
                stripped = re.sub(
                    r'URI="([^"]+)"',
                    lambda m: f'URI="{_proxy_stream_url(_abs_url(m.group(1), base), ua, ref)}"',
                    stripped,
                )
            out.append(stripped)
            continue
        out.append(_proxy_stream_url(_abs_url(stripped, base), ua, ref))
    return "\n".join(out) + "\n"


@guide_router.get("/stream")
def guide_stream(request: Request, url: str, ua: str = "", ref: str = "") -> Response:
    _require_online()
    parsed = _check_fetch_url(url)
    target = urllib.parse.urlunparse(parsed)
    headers = {
        "User-Agent": ua or "OpenJarvis/1.0",
        "Accept": "*/*",
    }
    if ref:
        headers["Referer"] = ref
    range_header = request.headers.get("range")
    if range_header:
        headers["Range"] = range_header
    try:
        req = urllib.request.Request(target, headers=headers)
        resp = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as exc:
        return Response(status_code=exc.code, content=b"", media_type="text/plain")
    except Exception as exc:
        return Response(
            status_code=502, content=f"stream fetch failed: {exc}".encode(), media_type="text/plain"
        )

    content_type = resp.headers.get("Content-Type", "") or "application/octet-stream"
    is_playlist = "mpegurl" in content_type.lower() or target.lower().split("?")[0].endswith(
        (".m3u8", ".m3u")
    )
    if is_playlist:
        raw = resp.read(_STREAM_MAX_BYTES + 1)
        resp.close()
        if len(raw) > _STREAM_MAX_BYTES:
            return Response(status_code=413, content=b"playlist too large")
        text = raw.decode("utf-8-sig", errors="replace")
        if "#EXTM3U" in text:
            text = _rewrite_m3u8(text, target, ua, ref)
        return Response(content=text, media_type="application/vnd.apple.mpegurl")

    # Segment / key / direct stream: pipe bytes through, honouring Range.
    def _iter():
        try:
            while True:
                chunk = resp.read(65536)
                if not chunk:
                    break
                yield chunk
        finally:
            resp.close()

    passthrough = {
        k: v
        for k, v in {
            "Content-Type": content_type,
            "Content-Length": resp.headers.get("Content-Length"),
            "Content-Range": resp.headers.get("Content-Range"),
            "Accept-Ranges": resp.headers.get("Accept-Ranges", "bytes"),
        }.items()
        if v
    }
    return StreamingResponse(_iter(), status_code=resp.status, headers=passthrough)


# ---------------------------------------------------------------------------
# Windowed XMLTV EPG (server-side parse keeps payloads small)
# ---------------------------------------------------------------------------

_EPG_MAX_COMPRESSED = 32 * 1024 * 1024
_EPG_MAX_DECOMPRESSED = 256 * 1024 * 1024
_EPG_CACHE_TTL = 900.0

_xmltv_attr_re = {
    "id": re.compile(r'\bid="([^"]*)"', re.IGNORECASE),
    "channel": re.compile(r'\bchannel="([^"]*)"', re.IGNORECASE),
    "start": re.compile(r'\bstart="([^"]*)"', re.IGNORECASE),
    "stop": re.compile(r'\bstop="([^"]*)"', re.IGNORECASE),
}
_xmltv_channel_re = re.compile(r"<channel\b([^>]*)>([\s\S]*?)</channel>", re.IGNORECASE)
_xmltv_programme_re = re.compile(
    r"<programme\b([^>]*)>([\s\S]*?)</programme>", re.IGNORECASE
)
_xmltv_title_re = re.compile(r"<title\b[^>]*>([\s\S]*?)</title>", re.IGNORECASE)
_xmltv_display_re = re.compile(
    r"<display-name\b[^>]*>([\s\S]*?)</display-name>", re.IGNORECASE
)
_xmltv_time_re = re.compile(
    r"(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-])(\d{2})(\d{2}))?"
)


def _xmltv_time(value: str) -> Optional[float]:
    match = _xmltv_time_re.search(value.strip())
    if not match:
        return None
    (
        year,
        month,
        day,
        hour,
        minute,
        second,
        sign,
        offset_hour,
        offset_minute,
    ) = match.groups()
    try:
        stamp = datetime(
            int(year),
            int(month),
            int(day),
            int(hour),
            int(minute),
            int(second),
            tzinfo=timezone.utc,
        ).timestamp()
    except ValueError:
        return None
    if sign:
        offset = (int(offset_hour) * 60 + int(offset_minute)) * (
            1 if sign == "+" else -1
        )
        stamp -= offset * 60
    return stamp


def _fetch_epg_bytes(url: str) -> bytes:
    parsed = _check_fetch_url(url)
    target = urllib.parse.urlunparse(parsed)
    req = urllib.request.Request(
        target, headers={"User-Agent": "OpenJarvis/1.0", "Accept": "*/*"}
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read(_EPG_MAX_COMPRESSED + 1)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"EPG fetch failed: {exc}")
    if len(raw) > _EPG_MAX_COMPRESSED:
        raise HTTPException(
            status_code=413,
            detail=f"EPG source exceeds the {_EPG_MAX_COMPRESSED // (1024 * 1024)} MB limit",
        )
    if raw[:2] == b"\x1f\x8b":
        try:
            decompressed = gzip.decompress(raw)
        except OSError as exc:
            raise HTTPException(status_code=502, detail=f"EPG gunzip failed: {exc}")
        if len(decompressed) > _EPG_MAX_DECOMPRESSED:
            raise HTTPException(
                status_code=413,
                detail="EPG source expands beyond the 256 MB limit",
            )
        return decompressed
    return raw


# Parsed-XMLTV document cache: url -> (monotonic_ts, channels, programmes).
# Programmes are kept for [now-24h, now+72h] so any windowed request inside
# that span is answered without re-downloading or re-parsing the guide file.
# Persisted to disk so server restarts don't trigger a multi-minute cold load.
_epg_doc_cache: dict[str, tuple[float, dict, dict]] = {}
_EPG_DOC_TTL = 6 * 3600
_EPG_DISK_DIR = (
    Path(os.environ.get("OPENJARVIS_CONFIG_DIR", str(Path.home() / ".openjarvis")))
    / "epg_cache"
)


def _epg_disk_path(url: str) -> Path:
    return _EPG_DISK_DIR / (hashlib.sha1(url.encode()).hexdigest() + ".json")


def _epg_cache_load() -> None:
    """Load persisted parsed guides into memory (called once at import)."""
    try:
        for f in _EPG_DISK_DIR.glob("*.json"):
            try:
                doc = json.loads(f.read_text(encoding="utf-8"))
                fetched = float(doc.get("fetched_at", 0))
                age = time.time() - fetched
                if age < _EPG_DOC_TTL:
                    _epg_doc_cache[doc["url"]] = (
                        time.monotonic() - age, doc["channels"], doc["programmes"]
                    )
            except Exception:
                continue
    except OSError:
        pass


def _epg_cache_save(url: str, channels: dict, programmes: dict) -> None:
    try:
        _EPG_DISK_DIR.mkdir(parents=True, exist_ok=True)
        doc = {
            "url": url,
            "fetched_at": time.time(),
            "channels": channels,
            "programmes": programmes,
        }
        tmp = _epg_disk_path(url).with_suffix(".tmp")
        tmp.write_text(json.dumps(doc), encoding="utf-8")
        tmp.replace(_epg_disk_path(url))
    except OSError:
        pass


_epg_cache_load()


def _epg_document(url: str) -> tuple[dict, dict]:
    now = time.time()
    hit = _epg_doc_cache.get(url)
    if hit is not None and time.monotonic() - hit[0] < _EPG_DOC_TTL:
        return hit[1], hit[2]

    raw = _fetch_epg_bytes(url)
    try:
        text = raw.decode("utf-8-sig", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"EPG is not valid text: {exc}")

    channels: dict[str, str] = {}
    for match in _xmltv_channel_re.finditer(text):
        attrs, body = match.groups()
        cid = _xmltv_attr_re["id"].search(attrs)
        if not cid:
            continue
        name_match = _xmltv_display_re.search(body) or _xmltv_title_re.search(body)
        channels[cid.group(1)] = _strip_html(name_match.group(1)) if name_match else cid.group(1)

    keep_start = now - 24 * 3600
    keep_stop = now + 72 * 3600
    programmes: dict[str, list[dict]] = {}
    for match in _xmltv_programme_re.finditer(text):
        attrs, body = match.groups()
        channel = _xmltv_attr_re["channel"].search(attrs)
        start_raw = _xmltv_attr_re["start"].search(attrs)
        stop_raw = _xmltv_attr_re["stop"].search(attrs)
        if not (channel and start_raw and stop_raw):
            continue
        start = _xmltv_time(start_raw.group(1))
        stop = _xmltv_time(stop_raw.group(1))
        if start is None or stop is None or stop <= start:
            continue
        if stop < keep_start or start > keep_stop:
            continue
        title_match = _xmltv_title_re.search(body)
        title = _strip_html(title_match.group(1)) if title_match else ""
        programmes.setdefault(channel.group(1), []).append(
            {"title": title, "start": start, "stop": stop}
        )
    for entries in programmes.values():
        entries.sort(key=lambda p: p["start"])

    _epg_doc_cache[url] = (time.monotonic(), channels, programmes)
    _epg_cache_save(url, channels, programmes)
    return channels, programmes


@guide_router.get("/epg")
def guide_epg(url: str, hours: float = 24.0) -> dict:
    """Fetch an XMLTV guide and return channel names + programmes in a window.

    Only programmes overlapping ``[now - 1h, now + hours]`` are returned so the
    payload stays small even for multi-day guide files. ``hours`` is clamped
    to 1-72.
    """
    _require_online()
    hours = min(max(float(hours or 24.0), 1.0), 72.0)
    cache_key = f"epg:{url}:{hours:g}:{int(time.time() // 900)}"
    hit = _cache.get(cache_key)
    if hit is not None and time.monotonic() - hit[0] < _EPG_CACHE_TTL:
        return hit[1]

    channels, all_programmes = _epg_document(url)

    now = time.time()
    window_start = now - 3600
    window_stop = now + hours * 3600
    programmes: dict[str, list[dict]] = {}
    for cid, entries in all_programmes.items():
        windowed = [
            p for p in entries
            if p["stop"] >= window_start and p["start"] <= window_stop
        ]
        if windowed:
            programmes[cid] = windowed

    result = {
        "channels": channels,
        "programmes": programmes,
        "window_start": window_start,
        "window_stop": window_stop,
        "fetched_at": now,
    }
    _cache[cache_key] = (time.monotonic(), result)
    return result


# ---------------------------------------------------------------------------
# EPG boot prefetch — warms the parsed-guide cache once a day, progressively
# expanding the window 1h -> 6h -> 12h -> 24h so first paint stays fast.
# ---------------------------------------------------------------------------

EPG_SOURCES: list[str] = [
    "https://epgshare01.online/epgshare01/epg_ripper_US2.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_CA2.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_UK1.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_IE1.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_AU1.xml.gz",
    "https://epgshare01.online/epgshare01/epg_ripper_NZ1.xml.gz",
    "https://magnetic.website/jet/epg/merged_epg.xml.gz",
]

_PREFETCH_MARKER = (
    Path(os.environ.get("OPENJARVIS_CONFIG_DIR", str(Path.home() / ".openjarvis")))
    / "epg_prefetch.json"
)
_prefetch_started = False


def prefetch_epg_sources() -> None:
    """Background thread: once per day, warm EPG docs at 1h/6h/12h/24h."""
    global _prefetch_started
    if _prefetch_started:
        return
    _prefetch_started = True

    def _run() -> None:
        import datetime as _dt
        import json as _json

        today = _dt.date.today().isoformat()
        try:
            marker = _json.loads(_PREFETCH_MARKER.read_text())
            # Skip only if we already warmed today AND have cached docs —
            # an empty cache (fresh install / cleared files) must re-warm.
            if marker.get("date") == today and _epg_doc_cache:
                return
        except Exception:
            pass
        time.sleep(20)  # let the server finish booting first
        # Fetch all sources in parallel — sequential multi-MB XML downloads
        # were the main cold-start delay.
        from concurrent.futures import ThreadPoolExecutor

        def _warm(hours: float) -> None:
            with ThreadPoolExecutor(max_workers=len(EPG_SOURCES)) as pool:
                list(pool.map(lambda u: _safe_epg(u, hours), EPG_SOURCES))

        def _safe_epg(url: str, hours: float) -> None:
            try:
                guide_epg(url, hours)
            except Exception as exc:  # noqa: BLE001
                logger.debug("EPG prefetch failed %s @%sh: %s", url, hours, exc)

        for hours in (1, 24):
            _warm(hours)
            time.sleep(10)
        try:
            _PREFETCH_MARKER.parent.mkdir(parents=True, exist_ok=True)
            _PREFETCH_MARKER.write_text(_json.dumps({"date": today}))
        except Exception:
            pass

    import threading

    threading.Thread(target=_run, daemon=True, name="epg-prefetch").start()


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
