"""VOD source routes: Stremio-protocol stream resolution + torrent playback.

Streams are resolved through public Stremio addons (Torrentio, Comet,
MediaFusion) which return either direct HTTP(S) URLs or torrent info-hashes.
Torrent streams are downloaded progressively with libtorrent and served over
HTTP so they can be watched while downloading; files persist under
``~/.openjarvis/downloads`` and double as the download library.
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

vod_router = APIRouter(prefix="/v1/vod", tags=["vod"])

_TIMEOUT = 30
_STREAM_TIMEOUT = 45

# Public Stremio addons (manifest + stream resources, no auth required).
_ADDONS = [
    {"name": "Torrentio", "base": "https://torrentio.strem.fun"},
    {"name": "Comet", "base": "https://comet.elfhosted.com"},
    {"name": "MediaFusion", "base": "https://mediafusion.elfhosted.com"},
]

_CACHE_TTL = 120.0
_stream_cache: dict[str, tuple[float, Any]] = {}

_VIDEO_EXTS = {".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".mpg", ".mpeg", ".webm", ".ts", ".m2ts", ".vob"}
# Containers a browser <video> element can play natively.
_BROWSER_EXTS = {".mp4", ".m4v", ".webm", ".mov", ".ogv"}

_SEEDERS_RE = re.compile(r"[👤\U0001F464]\s*([\d.,]+[kKmM]?)")
_SIZE_RE = re.compile(r"[💾\U0001F4BE]\s*([\d.,]+\s*[KMGT]?i?B)")
_QUALITY_RE = re.compile(r"(2160p|1080p|720p|480p|4k|8k)", re.IGNORECASE)


def _require_online() -> None:
    from openjarvis.core.config import load_config

    if getattr(load_config(), "offline_mode", False):
        raise HTTPException(status_code=503, detail="Offline mode is enabled; VOD sources need internet.")


def _get_json(url: str, timeout: int = _TIMEOUT) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "OpenJarvis/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _cached_get(url: str) -> Any:
    now = time.monotonic()
    hit = _stream_cache.get(url)
    if hit is not None and now - hit[0] < _CACHE_TTL:
        return hit[1]
    data = _get_json(url)
    _stream_cache[url] = (now, data)
    if len(_stream_cache) > 200:
        _stream_cache.clear()
    return data


# ---------------------------------------------------------------------------
# Stream resolution (Stremio protocol)
# ---------------------------------------------------------------------------


def _quality_of(text: str) -> str:
    m = _QUALITY_RE.search(text or "")
    if not m:
        return ""
    q = m.group(1).lower()
    return "4K" if q in ("4k", "2160p") else q.upper()


def _seeders_of(text: str) -> Optional[int]:
    m = _SEEDERS_RE.search(text or "")
    if not m:
        return None
    raw = m.group(1).replace(",", "").strip().lower()
    try:
        if raw.endswith("k"):
            return int(float(raw[:-1]) * 1000)
        if raw.endswith("m"):
            return int(float(raw[:-1]) * 1_000_000)
        return int(float(raw))
    except ValueError:
        return None


def _size_of(text: str) -> str:
    m = _SIZE_RE.search(text or "")
    return m.group(1).replace(" ", "") if m else ""


def _normalize_stream(addon: str, raw: dict, idx: int) -> Optional[dict]:
    info_hash = raw.get("infoHash")
    url = raw.get("url") or ""
    external = raw.get("externalUrl") or ""
    name = raw.get("name") or ""
    title = raw.get("title") or ""
    blob = f"{name}\n{title}"
    is_http = url.lower().startswith("http")
    is_torrent = bool(info_hash)
    if not (is_http or is_torrent or external):
        return None
    out = {
        "id": f"{addon}:{idx}",
        "addon": addon,
        "name": name,
        "title": title,
        "quality": _quality_of(blob),
        "size": _size_of(blob),
        "seeders": _seeders_of(blob),
        "isTorrent": is_torrent,
        "browserPlayable": False,
    }
    if is_http:
        out["url"] = url
        out["browserPlayable"] = True
    elif is_torrent:
        out["infoHash"] = info_hash
        out["fileIdx"] = int(raw.get("fileIdx") or 0)
    if external:
        out["externalUrl"] = external
    return out


def _fetch_addon_streams(addon: dict, path: str) -> list[dict]:
    url = f"{addon['base']}{path}"
    try:
        data = _get_json(url, timeout=_STREAM_TIMEOUT)
    except Exception as exc:
        logger.info("vod: addon %s failed: %s", addon["name"], exc)
        return []
    streams = []
    for i, raw in enumerate(data.get("streams") or []):
        if not isinstance(raw, dict):
            continue
        norm = _normalize_stream(addon["name"], raw, i)
        if norm:
            streams.append(norm)
    return streams


@vod_router.get("/streams")
def vod_streams(
    type: str,
    id: str,
    season: Optional[int] = None,
    episode: Optional[int] = None,
) -> dict:
    """Resolve playable streams for a movie or series episode via Stremio addons."""
    _require_online()
    media_type = type.lower()
    if media_type not in ("movie", "series"):
        raise HTTPException(status_code=400, detail="type must be movie or series")
    clean = re.sub(r"[^A-Za-z0-9]", "", id)
    if not clean:
        raise HTTPException(status_code=400, detail="invalid id")
    stremio_id = clean if clean.lower().startswith("tt") else f"tt{clean}"
    if media_type == "series":
        if season is None or episode is None:
            raise HTTPException(status_code=400, detail="season and episode are required for series")
        path = f"/stream/series/{stremio_id}:{season}:{episode}.json"
    else:
        path = f"/stream/movie/{stremio_id}.json"

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=len(_ADDONS)) as pool:
        for streams in pool.map(lambda a: _fetch_addon_streams(a, path), _ADDONS):
            results.extend(streams)

    # Sort: browser-playable first, then by quality desc, then seeders desc.
    qrank = {"8K": 4, "4K": 3, "1080P": 2, "720P": 1}
    results.sort(
        key=lambda s: (
            0 if s.get("url") else 1,
            -(qrank.get(s.get("quality") or "", 0)),
            -(s.get("seeders") or 0),
        )
    )
    return {"type": media_type, "id": stremio_id, "season": season, "episode": episode, "streams": results}


# ---------------------------------------------------------------------------
# Torrent engine (libtorrent, progressive download -> HTTP stream)
# ---------------------------------------------------------------------------

try:
    import libtorrent as lt
except Exception:  # pragma: no cover - depends on optional native dep
    lt = None  # type: ignore[assignment]


class _TorrentManager:
    def __init__(self) -> None:
        # Downloads live in the app's own folder and show up under Media → Local.
        self.save_path = Path.home() / ".openjarvis" / "downloads"
        self.save_path.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._items: dict[str, dict[str, Any]] = {}
        self._session: Any = None
        if lt is not None:
            try:
                self._session = lt.session()
                settings = lt.default_settings()
                settings.update(
                    {
                        "listen_interfaces": "0.0.0.0:6881",
                        "enable_dht": True,
                        "enable_lsd": True,
                        "enable_upnp": True,
                        "announce_to_all_trackers": True,
                        "announce_to_all_tiers": True,
                    }
                )
                self._session.apply_settings(settings)
            except Exception as exc:
                logger.warning("vod: libtorrent session failed: %s", exc)
                self._session = None

    @property
    def available(self) -> bool:
        return self._session is not None

    def _new_id(self) -> str:
        import uuid

        return uuid.uuid4().hex[:12]

    def add(self, magnet: str, file_idx: Optional[int] = None) -> dict[str, Any]:
        if not self.available:
            raise HTTPException(status_code=503, detail="Torrent engine unavailable (libtorrent not installed).")
        if not magnet.lower().startswith("magnet:"):
            raise HTTPException(status_code=400, detail="Expected a magnet: URI")
        with self._lock:
            params = lt.parse_magnet_uri(magnet)
            params.save_path = str(self.save_path)
            # Download pieces in order so the file is watchable while downloading.
            seq_flag = getattr(lt.torrent_flags, "sequential_download", None)
            if seq_flag is not None:
                params.flags |= seq_flag
            handle = self._session.add_torrent(params)
            tid = self._new_id()
            item = {
                "handle": handle,
                "magnet": magnet,
                "file_index": None,
                "files": [],
                "added": time.time(),
            }
            self._items[tid] = item
        # Wait for metadata so we know the file list (up to ~30s).
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            st = handle.status()
            if st.has_metadata:
                break
            err = getattr(st, "errc", None)
            err_val = err.value() if err is not None and hasattr(err, "value") else 0
            if err_val:
                msg = err.message() if hasattr(err, "message") else str(err)
                raise HTTPException(status_code=502, detail=f"Torrent error: {msg}")
            time.sleep(0.5)
        else:
            # Keep the item; metadata may still arrive — return with empty files.
            return {"id": tid, "files": [], "selected": None, "metadata_pending": True}
        self._populate_files(tid, file_idx)
        return self._describe(tid)

    def _populate_files(self, tid: str, file_idx: Optional[int]) -> None:
        item = self._items.get(tid)
        if not item:
            return
        handle = item["handle"]
        ti = handle.torrent_file()
        fs = ti.files()
        files = []
        for i in range(fs.num_files()):
            p = fs.file_path(i)
            files.append(
                {
                    "index": i,
                    "name": p,
                    "size": fs.file_size(i),
                    "browserPlayable": Path(p).suffix.lower() in _BROWSER_EXTS,
                    "video": Path(p).suffix.lower() in _VIDEO_EXTS,
                }
            )
        item["files"] = files
        if file_idx is None:
            videos = [f for f in files if f["video"]]
            if videos:
                file_idx = max(videos, key=lambda f: f["size"])["index"]
            elif files:
                file_idx = max(files, key=lambda f: f["size"])["index"]
        if file_idx is not None:
            self.select_file(tid, file_idx)

    def select_file(self, tid: str, index: int) -> None:
        item = self._items.get(tid)
        if not item:
            raise HTTPException(status_code=404, detail="Unknown torrent")
        handle = item["handle"]
        files = item.get("files") or []
        if files and not any(f["index"] == index for f in files):
            raise HTTPException(status_code=400, detail="Invalid file index")
        n = len(files) if files else (handle.torrent_file().files().num_files() if handle.status().has_metadata else 0)
        priorities = [0] * n
        priorities[index] = 4
        handle.prioritize_files(priorities)
        item["file_index"] = index
        try:
            handle.force_recheck()
        except Exception:
            pass

    def _file_disk_path(self, tid: str) -> Optional[Path]:
        item = self._items.get(tid)
        if not item or item.get("file_index") is None:
            return None
        try:
            ti = item["handle"].torrent_file()
            rel = ti.files().file_path(item["file_index"])
            return Path(item["handle"].status().save_path or self.save_path) / rel
        except Exception:
            return None

    def _file_expected_size(self, tid: str) -> int:
        item = self._items.get(tid)
        if not item or item.get("file_index") is None:
            return 0
        try:
            ti = item["handle"].torrent_file()
            return ti.files().file_size(item["file_index"])
        except Exception:
            return 0

    def _file_progress(self, tid: str) -> float:
        """0..1 progress of the selected file."""
        item = self._items.get(tid)
        if not item or item.get("file_index") is None:
            return 0.0
        try:
            handle = item["handle"]
            per_file = handle.file_progress()
            if per_file and item["file_index"] < len(per_file):
                return float(per_file[item["file_index"]])
            return float(handle.status().progress)
        except Exception:
            return 0.0

    def status(self, tid: str) -> dict[str, Any]:
        item = self._items.get(tid)
        if not item:
            raise HTTPException(status_code=404, detail="Unknown torrent")
        handle = item["handle"]
        st = handle.status()
        state_names = {
            lt.torrent_status.checking_files: "checking",
            lt.torrent_status.downloading_metadata: "fetching_metadata",
            lt.torrent_status.downloading: "downloading",
            lt.torrent_status.finished: "finished",
            lt.torrent_status.seeding: "seeding",
            lt.torrent_status.checking_resume_data: "checking",
        }
        progress = self._file_progress(tid)
        expected = self._file_expected_size(tid)
        done = progress >= 0.999 or (expected and self._disk_size(tid) >= expected)
        return {
            "id": tid,
            "state": state_names.get(st.state, str(st.state)),
            "progress": round(progress, 4),
            "download_rate": st.download_rate,
            "upload_rate": st.upload_rate,
            "peers": st.num_peers,
            "has_metadata": st.has_metadata,
            "finished": done,
            "file_index": item.get("file_index"),
            "files": item.get("files") or [],
        }

    def _disk_size(self, tid: str) -> int:
        p = self._file_disk_path(tid)
        try:
            return p.stat().st_size if p else 0
        except OSError:
            return 0

    def _describe(self, tid: str) -> dict[str, Any]:
        item = self._items.get(tid)
        if not item:
            raise HTTPException(status_code=404, detail="Unknown torrent")
        return {
            "id": tid,
            "files": item.get("files") or [],
            "selected": item.get("file_index"),
        }

    def remove(self, tid: str) -> dict[str, Any]:
        with self._lock:
            item = self._items.pop(tid, None)
            if item is not None and self._session is not None:
                try:
                    self._session.remove(item["handle"])
                except Exception:
                    pass
        return {"removed": tid}


_manager = _TorrentManager()


class _TorrentAddRequest(BaseModel):
    magnet: str
    file_idx: Optional[int] = None


class _TorrentFileRequest(BaseModel):
    index: int


@vod_router.post("/torrent/add")
def torrent_add(req: _TorrentAddRequest) -> dict[str, Any]:
    return _manager.add(req.magnet, req.file_idx)


@vod_router.post("/torrent/{tid}/file")
def torrent_file(tid: str, req: _TorrentFileRequest) -> dict[str, Any]:
    _manager.select_file(tid, req.index)
    return _manager._describe(tid)


@vod_router.get("/torrent/{tid}/status")
def torrent_status(tid: str) -> dict[str, Any]:
    return _manager.status(tid)


@vod_router.delete("/torrent/{tid}")
def torrent_remove(tid: str) -> dict[str, Any]:
    return _manager.remove(tid)


def _iter_file(path: Path, offset: int = 0, is_incomplete=None) -> Any:
    """Yield file bytes from ``offset``, waiting for more data while the torrent downloads."""
    if is_incomplete is None:
        is_incomplete = lambda: False  # noqa: E731
    last_growth = time.monotonic()
    idle_limit = 180.0
    with open(path, "rb") as f:
        if offset:
            f.seek(offset)
        while True:
            chunk = f.read(512 * 1024)
            if chunk:
                last_growth = time.monotonic()
                yield chunk
                continue
            # EOF reached — wait for the torrent to write more, if any.
            try:
                size_now = os.path.getsize(path)
            except OSError:
                return
            pos = f.tell()
            if size_now > pos:
                continue
            if not is_incomplete() or time.monotonic() - last_growth > idle_limit:
                return
            time.sleep(0.4)


@vod_router.get("/torrent/{tid}/stream")
def torrent_stream(tid: str, request: Request, dl: bool = False) -> Any:
    path = _manager._file_disk_path(tid)
    if path is None:
        raise HTTPException(status_code=404, detail="No file selected or torrent unknown")
    expected = _manager._file_expected_size(tid) or (path.stat().st_size if path.exists() else 0)

    def is_incomplete() -> bool:
        try:
            return not _manager.status(tid)["finished"]
        except Exception:
            return False

    # Ensure the file exists on disk (may not be created until first piece lands).
    deadline = time.monotonic() + 60
    while not path.exists() and time.monotonic() < deadline:
        time.sleep(0.5)
    if not path.exists():
        raise HTTPException(status_code=409, detail="File not created yet; torrent still fetching metadata/pieces")

    range_header = request.headers.get("range")
    start = 0
    end: Optional[int] = None
    status_code = 200
    if range_header:
        m = re.match(r"bytes=(\d*)-(\d*)", range_header.strip())
        if m:
            if m.group(1):
                start = int(m.group(1))
            if m.group(2):
                end = int(m.group(2))
            status_code = 206

    def body():
        sent = 0
        limit = (end - start + 1) if end is not None else None
        for chunk in _iter_file(path, offset=start, is_incomplete=is_incomplete):
            if limit is not None:
                left = limit - sent
                if left <= 0:
                    break
                if len(chunk) > left:
                    chunk = chunk[:left]
                sent += len(chunk)
            yield chunk
            if limit is not None and sent >= limit:
                break

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": "application/octet-stream",
    }
    filename = path.name.replace('"', "")
    if dl:
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    else:
        headers["Content-Disposition"] = f'inline; filename="{filename}"'
    # Content-Length is the file's final size; the body streams progressively.
    headers["Content-Length"] = str(expected or path.stat().st_size)
    return StreamingResponse(body(), status_code=status_code, headers=headers, media_type="application/octet-stream")
