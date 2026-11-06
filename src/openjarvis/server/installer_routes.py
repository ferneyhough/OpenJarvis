"""Installer discovery, download and launch for hub app links.

Flow: a hub tile links to a product page (often a GitHub repo or a vendor
site). ``/resolve`` finds the real installer file — GitHub release assets via
the API, ``releases/download`` links scraped from release pages, or direct
installer URLs on the page — ``/download`` saves it into the app-managed
``~/.openjarvis/installers`` folder, and ``/run`` launches it.
"""

from __future__ import annotations

import ipaddress
import json
import logging
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from openjarvis.server.guide_routes import _check_fetch_url

logger = logging.getLogger(__name__)

installer_router = APIRouter(prefix="/v1/installer", tags=["installer"])

INSTALLER_DIR = Path.home() / ".openjarvis" / "installers"
MAX_DOWNLOAD = 1024 * 1024 * 1024  # 1 GB
_PAGE_LIMIT = 3 * 1024 * 1024
_UA = {"User-Agent": "OpenJarvis/1.0", "Accept": "*/*"}

# Extensions we treat as installable artifacts.
_INSTALLER_EXTS = (
    ".exe", ".msi", ".msix", ".appx", ".zip", ".7z", ".rar",
    ".dmg", ".pkg", ".deb", ".rpm", ".AppImage", ".flatpak",
)
# Substrings that mark a Windows installer worth preferring.
_WIN_HINTS = ("win", "windows", "x64", "x86", "setup", "install", "offline")

_HREF_RE = re.compile(r'(?:href|src)=["\']([^"\']+)["\']', re.IGNORECASE)
_GH_RELEASE_ASSET_RE = re.compile(r'href=["\']([^"\']*?/releases/download/[^"\']+)["\']', re.IGNORECASE)
_CONTENT_DISPOSITION_RE = re.compile(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)"?', re.IGNORECASE)
_GITHUB_REPO_RE = re.compile(r"^/?([^/]+)/([^/?#]+?)(?:\.git)?/?(?:[?#].*)?$")


def _installers_dir() -> Path:
    INSTALLER_DIR.mkdir(parents=True, exist_ok=True)
    return INSTALLER_DIR


def _is_installer_url(url: str) -> bool:
    path = urllib.parse.urlparse(url).path.lower()
    return path.endswith(_INSTALLER_EXTS)


def _score_candidate(name: str, url: str) -> tuple[int, int]:
    """Lower score = better. Prefer Windows installers over archives/other OS."""
    lower = f"{name} {urllib.parse.urlparse(url).path}".lower()
    score = 0
    if lower.endswith(".exe") or lower.endswith(".msi"):
        score -= 4
    elif lower.endswith((".zip", ".7z")):
        score += 1
    if any(h in lower for h in _WIN_HINTS):
        score -= 2
    if any(os_ in lower for os_ in ("mac", "darwin", ".dmg", ".pkg", "linux", ".deb", ".rpm", ".appimage")):
        score += 3
    if "source" in lower or "src" in lower or "nightly" in lower:
        score += 2
    return (score, len(name))


def _github_repo(url: str) -> Optional[tuple[str, str]]:
    parsed = urllib.parse.urlparse(url)
    if parsed.hostname not in ("github.com", "www.github.com"):
        return None
    match = _GITHUB_REPO_RE.match(parsed.path)
    if not match:
        return None
    owner, repo = match.groups()
    if owner.lower() in ("features", "topics", "collections", "orgs", "users", "settings"):
        return None
    return owner, repo


def _github_release_assets(owner: str, repo: str) -> list[dict[str, Any]]:
    """Latest-release assets via the GitHub API; falls back to [] on failure."""
    api = f"https://api.github.com/repos/{owner}/{repo}/releases/latest"
    req = urllib.request.Request(api, headers={**_UA, "Accept": "application/vnd.github+json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read(2 * 1024 * 1024).decode("utf-8", "replace"))
    except Exception as exc:
        logger.debug("installer: github api failed for %s/%s: %s", owner, repo, exc)
        return []
    out = []
    for asset in data.get("assets") or []:
        name = str(asset.get("name") or "")
        dl = str(asset.get("browser_download_url") or "")
        lower = name.lower()
        # Skip signatures, checksums, manifests and source archives.
        if lower.endswith((".sig", ".asc", ".sha256", ".sha512", ".md5", ".txt")) or "source" in lower:
            continue
        if name and dl:
            out.append({"name": name, "url": dl, "size": asset.get("size")})
    return out


def _scrape_page_links(url: str) -> list[str]:
    """Fetch an HTML page and return installer-looking links found in it."""
    parsed = _check_fetch_url(url)
    target = urllib.parse.urlunparse(parsed)
    req = urllib.request.Request(target, headers=_UA)
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            ctype = (resp.headers.get("Content-Type") or "").lower()
            raw = resp.read(_PAGE_LIMIT + 1)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Page fetch failed: {exc}")
    if len(raw) > _PAGE_LIMIT:
        raise HTTPException(status_code=413, detail="Page too large to scan")
    if "html" not in ctype and not raw[:256].lstrip().lower().startswith(b"<!doctype") and b"<html" not in raw[:4096].lower():
        return []
    text = raw.decode("utf-8", "replace")
    links: list[str] = []
    base = target
    for href in _HREF_RE.findall(text):
        href = href.strip()
        if not href or href.startswith(("javascript:", "mailto:", "#", "data:")):
            continue
        absolute = urllib.parse.urljoin(base, href)
        if _is_installer_url(absolute):
            links.append(absolute)
    # GitHub release pages hide assets behind releases/download URLs.
    for href in _GH_RELEASE_ASSET_RE.findall(text):
        absolute = urllib.parse.urljoin(base, href.replace("&amp;", "&"))
        if _is_installer_url(absolute):
            links.append(absolute)
    # Dedupe preserving order.
    seen: set[str] = set()
    unique = []
    for link in links:
        if link not in seen:
            seen.add(link)
            unique.append(link)
    return unique[:12]


@installer_router.get("/resolve")
def installer_resolve(url: str) -> dict[str, Any]:
    """Find installer download candidates for a product/repo page URL."""
    url = url.strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must be http(s)")
    _check_fetch_url(url)

    candidates: list[dict[str, Any]] = []

    # 1) Direct installer file link — nothing to resolve.
    if _is_installer_url(url):
        name = Path(urllib.parse.unquote(urllib.parse.urlparse(url).path)).name or "installer"
        return {"candidates": [{"name": name, "url": url, "size": None}]}

    # 2) GitHub repo/release page -> latest release assets.
    repo = _github_repo(url)
    if repo:
        owner, name = repo
        for asset in _github_release_assets(owner, name):
            candidates.append({"name": asset["name"], "url": asset["url"], "size": asset.get("size")})
        if not candidates:
            # No releases — scrape the page for downloadable assets anyway.
            try:
                for link in _scrape_page_links(url):
                    candidates.append({"name": Path(urllib.parse.unquote(urllib.parse.urlparse(link).path)).name, "url": link, "size": None})
            except HTTPException:
                pass
    else:
        # 3) Generic product page — scrape for installer links.
        for link in _scrape_page_links(url):
            candidates.append({"name": Path(urllib.parse.unquote(urllib.parse.urlparse(link).path)).name or link, "url": link, "size": None})

    candidates.sort(key=lambda c: _score_candidate(str(c.get("name") or ""), str(c.get("url") or "")))
    return {"candidates": candidates[:10]}


class _DownloadRequest(BaseModel):
    url: str
    filename: Optional[str] = None


@installer_router.post("/download")
def installer_download(req: _DownloadRequest) -> dict[str, Any]:
    """Download an installer into ~/.openjarvis/installers and return its path."""
    url = req.url.strip()
    parsed = _check_fetch_url(url)
    target = urllib.parse.urlunparse(parsed)

    filename = (req.filename or "").strip()
    if not filename:
        cd_match = None
        head_req = urllib.request.Request(target, method="HEAD", headers=_UA)
        try:
            with urllib.request.urlopen(head_req, timeout=20) as resp:
                cd_match = _CONTENT_DISPOSITION_RE.search(resp.headers.get("Content-Disposition") or "")
        except Exception:
            pass
        if cd_match:
            filename = cd_match.group(1).strip().strip('"')
    if not filename:
        filename = Path(urllib.parse.unquote(parsed.path)).name or "installer.bin"
    filename = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", filename).strip(".") or "installer.bin"

    dest = _installers_dir() / filename
    tmp = dest.with_suffix(dest.suffix + ".part")
    req_obj = urllib.request.Request(target, headers=_UA)
    try:
        with urllib.request.urlopen(req_obj, timeout=60) as resp, open(tmp, "wb") as out:
            total = 0
            while True:
                chunk = resp.read(1024 * 256)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_DOWNLOAD:
                    tmp.unlink(missing_ok=True)
                    raise HTTPException(status_code=413, detail="Installer exceeds the 1 GB limit")
                out.write(chunk)
    except HTTPException:
        raise
    except Exception as exc:
        tmp.unlink(missing_ok=True)
        raise HTTPException(status_code=502, detail=f"Download failed: {exc}")
    tmp.replace(dest)
    return {"path": str(dest), "name": filename, "size": dest.stat().st_size}


class _RunRequest(BaseModel):
    path: str


def _extract_zip(zip_path: Path, dest_dir: Path) -> Optional[Path]:
    """Extract a zip into dest_dir; return the best .exe inside, if any."""
    import zipfile

    dest_dir.mkdir(parents=True, exist_ok=True)
    try:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(dest_dir)
    except Exception as exc:
        logger.warning("installer: zip extract failed for %s: %s", zip_path, exc)
        return None
    exes = [p for p in dest_dir.rglob("*") if p.suffix.lower() == ".exe" and p.is_file()]
    if not exes:
        return None
    # Prefer setup/install-named binaries, then the largest.
    def exe_score(p: Path) -> tuple[int, int]:
        lower = p.name.lower()
        score = 0
        if any(h in lower for h in ("setup", "install")):
            score -= 2
        if "unins" in lower or "uninstall" in lower:
            score += 5
        return (score, -p.stat().st_size)

    return min(exes, key=exe_score)


@installer_router.post("/run")
def installer_run(req: _RunRequest) -> dict[str, Any]:
    """Launch a downloaded installer — zips are extracted and their exe run."""
    root = _installers_dir().resolve()
    try:
        target = Path(req.path).resolve()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    if root not in target.parents and target != root:
        raise HTTPException(status_code=400, detail="Path is outside the installers folder")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Installer file not found")

    launch = target
    extracted_to: Optional[str] = None
    if target.suffix.lower() == ".zip":
        extract_dir = target.with_suffix("")
        exe = _extract_zip(target, extract_dir)
        if exe is not None:
            launch = exe
            extracted_to = str(exe.parent)
        # If no exe inside, fall through and try launching the zip anyway.

    try:
        if sys.platform.startswith("win"):
            os.startfile(str(launch))  # type: ignore[attr-defined]
        else:
            subprocess.Popen([str(launch)], start_new_session=True)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not launch installer: {exc}")
    return {"launched": str(launch), "extracted_to": extracted_to}
