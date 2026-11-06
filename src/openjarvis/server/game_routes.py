"""Game library routes: Steam scan, custom games, Playnite interop.

Sources:
- Steam: ``steamapps/appmanifest_*.acf`` files across every configured Steam
  library. Launch via the ``steam://rungameid/<appid>`` URI.
- Custom: user-added games stored in ``~/.openjarvis/games.json`` — the same
  role Playnite's "manually added" entries play.
- Playnite: detected when a ``Playnite.DesktopApp.exe`` (or the ``playnite``
  URI scheme) exists. Its library DB is LiteDB — not readable without the
  .NET runtime — so Jarvis launches Playnite itself rather than parsing it.
  If Playnite is present, ``POST /v1/games/launch`` with ``kind="playnite"``
  opens the app; game-level launches go through Playnite's own ``--start``
  argument once IDs are available.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

games_router = APIRouter(prefix="/v1/games", tags=["games"])

_ACF_NAME_RE = re.compile(r'"name"\s+"((?:[^"\\]|\\.)*)"')
_ACF_APPID_RE = re.compile(r'"appid"\s+"(\d+)"')
_ACF_DIR_RE = re.compile(r'"installdir"\s+"((?:[^"\\]|\\.)*)"')
_VDF_PATH_RE = re.compile(r'"path"\s+"([^"]+)"')

_STEAM_COVER = (
    "https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/library_600x900.jpg"
)

_GAMES_FILE = (
    Path(os.environ.get("OPENJARVIS_CONFIG_DIR", str(Path.home() / ".openjarvis")))
    / "games.json"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _acf_unescape(value: str) -> str:
    return value.replace('\\"', '"').replace("\\\\", "\\")


def _steam_install_paths() -> list[str]:
    """Return Steam install roots from the registry (Windows only)."""
    if os.name != "nt":
        return []
    import winreg

    roots: list[str] = []
    for hive, subkey in (
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Valve\Steam"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Valve\Steam"),
    ):
        try:
            with winreg.OpenKey(hive, subkey) as key:
                value = winreg.QueryValueEx(key, "InstallPath")[0]
            if value:
                roots.append(value)
        except OSError:
            continue
    return roots


def _steam_library_dirs() -> list[Path]:
    """All ``steamapps`` dirs: the install root plus libraryfolders.vdf entries."""
    dirs: list[Path] = []
    for root in _steam_install_paths():
        steamapps = Path(root) / "steamapps"
        vdf = steamapps / "libraryfolders.vdf"
        candidates = [steamapps]
        if vdf.is_file():
            try:
                text = vdf.read_text(encoding="utf-8", errors="replace")
            except OSError:
                text = ""
            for match in _VDF_PATH_RE.finditer(text):
                raw = match.group(1).replace("\\\\", "\\")
                candidates.append(Path(raw) / "steamapps")
        for cand in candidates:
            if cand.is_dir() and cand not in dirs:
                dirs.append(cand)
    return dirs


def _scan_steam() -> list[dict]:
    games: list[dict] = []
    for steamapps in _steam_library_dirs():
        try:
            manifests = list(steamapps.glob("appmanifest_*.acf"))
        except OSError:
            continue
        for manifest in manifests:
            try:
                text = manifest.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            appid_m = _ACF_APPID_RE.search(text)
            name_m = _ACF_NAME_RE.search(text)
            dir_m = _ACF_DIR_RE.search(text)
            if not appid_m or not name_m:
                continue
            appid = appid_m.group(1)
            name = _acf_unescape(name_m.group(1))
            installdir = _acf_unescape(dir_m.group(1)) if dir_m else ""
            install_path = steamapps / "common" / installdir
            games.append(
                {
                    "id": f"steam-{appid}",
                    "kind": "steam",
                    "appid": appid,
                    "title": name,
                    "install_dir": installdir,
                    "installed": install_path.is_dir(),
                    "cover": _STEAM_COVER.format(appid=appid),
                }
            )
    games.sort(key=lambda g: g["title"].lower())
    return games


# ---------------------------------------------------------------------------
# Custom games (user-added)
# ---------------------------------------------------------------------------


def _load_games() -> list[dict]:
    try:
        data = json.loads(_GAMES_FILE.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save_games(games: list[dict]) -> None:
    _GAMES_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = _GAMES_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(games, indent=2), encoding="utf-8")
    tmp.replace(_GAMES_FILE)


class CustomGameIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    exe: str = Field(min_length=1, max_length=1000)
    args: str = Field(default="", max_length=1000)
    cover_url: str = Field(default="", max_length=2000)
    working_dir: str = Field(default="", max_length=1000)


# ---------------------------------------------------------------------------
# Playnite detection
# ---------------------------------------------------------------------------


def _playnite_candidates() -> list[Path]:
    home = Path.home()
    candidates = [
        home / "Playnite",
        home / "Playnite-Portable",
        Path("C:/Playnite"),
        Path("D:/Playnite"),
        Path("E:/Playnite"),
    ]
    appdata = os.environ.get("APPDATA")
    if appdata:
        candidates.append(Path(appdata) / "Playnite")
    local = os.environ.get("LOCALAPPDATA")
    if local:
        candidates.append(Path(local) / "Playnite")
    return candidates


def _find_playnite() -> dict:
    """Locate a Playnite install; returns detection info."""
    found_exe: Optional[str] = None
    library_path: Optional[str] = None
    config_dir: Optional[str] = None

    for cand in _playnite_candidates():
        if not cand.is_dir():
            continue
        # Portable layout: exe at root or one level down.
        for exe in cand.glob("**/Playnite.DesktopApp.exe"):
            if exe.is_file():
                found_exe = str(exe)
                config_dir = str(cand)
                break
        if found_exe:
            break
        # Installed layout: %APPDATA%\Playnite has config.json + library\.
        config = cand / "config.json"
        if config.is_file():
            config_dir = str(cand)
            library = cand / "library"
            if library.is_dir():
                library_path = str(library)
            try:
                cfg = json.loads(config.read_text(encoding="utf-8", errors="replace"))
                db = cfg.get("DatabasePath") or ""
                if db:
                    db_path = Path(db)
                    if not db_path.is_absolute():
                        db_path = cand / db_path
                    library_path = str(db_path.parent)
            except (OSError, ValueError):
                pass

    scheme = False
    if os.name == "nt":
        try:
            import winreg

            with winreg.OpenKey(winreg.HKEY_CLASSES_ROOT, "playnite") as key:
                winreg.QueryValueEx(key, "URL Protocol")
            scheme = True
        except OSError:
            pass

    installed = bool(found_exe or scheme or config_dir)
    return {
        "installed": installed,
        "exe": found_exe,
        "config_dir": config_dir,
        "library_path": library_path,
        "scheme_registered": scheme,
        # LiteDB games.db isn't readable outside .NET; Jarvis launches
        # Playnite for Playnite-managed titles rather than parsing it.
        "library_readable": False,
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@games_router.get("/status")
def games_status() -> dict:
    steam_dirs = _steam_library_dirs()
    steam_count = len(_scan_steam()) if steam_dirs else 0
    return {
        "steam": {
            "installed": bool(steam_dirs),
            "libraries": [str(d) for d in steam_dirs],
            "game_count": steam_count,
        },
        "playnite": _find_playnite(),
        "custom_count": len(_load_games()),
    }


@games_router.get("/library")
def games_library() -> dict:
    steam = _scan_steam()
    custom = _load_games()
    return {
        "steam": steam,
        "custom": custom,
        "playnite": _find_playnite(),
    }


def _bundled_tool(*parts: str) -> Optional[Path]:
    """Locate a bundled tool under ``<repo>/tools/`` walking up from this file."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent.joinpath("tools", *parts)
        if candidate.is_file():
            return candidate
    return None


def _roblox_player() -> Optional[Path]:
    """Find the newest RobloxPlayerBeta.exe (installed Roblox, not bundled)."""
    roots = [
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Roblox" / "Versions",
        Path(os.environ.get("LOCALAPPDATA", str(Path.home() / "AppData/Local")))
        / "Roblox"
        / "Versions",
    ]
    best: Optional[Path] = None
    best_mtime = 0.0
    for root in roots:
        if not root.is_dir():
            continue
        for version_dir in root.iterdir():
            exe = version_dir / "RobloxPlayerBeta.exe"
            try:
                mtime = exe.stat().st_mtime
            except OSError:
                continue
            if mtime > best_mtime:
                best, best_mtime = exe, mtime
    return best


def _launch_portablemc() -> dict:
    exe = _bundled_tool("portablemc", "portablemc.exe")
    if exe is None:
        raise HTTPException(status_code=404, detail="Bundled PortableMC not found")
    try:
        subprocess.Popen(
            [str(exe), "start", "release"],
            cwd=str(exe.parent),
            close_fds=True,
        )
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not start Minecraft: {exc}")
    return {"launched": str(exe)}


def _launch_roblox() -> dict:
    exe = _roblox_player()
    if exe is None:
        raise HTTPException(
            status_code=404,
            detail="Roblox is not installed — install it from roblox.com first.",
        )
    try:
        subprocess.Popen([str(exe)], cwd=str(exe.parent), close_fds=True)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not start Roblox: {exc}")
    return {"launched": str(exe)}


class LaunchIn(BaseModel):
    kind: str = Field(pattern="^(steam|custom|playnite|exe|portablemc|roblox)$")
    appid: Optional[str] = None
    id: Optional[str] = None
    path: Optional[str] = Field(default=None, max_length=1000)
    args: str = Field(default="", max_length=1000)


@games_router.post("/launch")
def launch_game(body: LaunchIn) -> dict:
    if body.kind == "steam":
        appid = (body.appid or "").strip()
        if not appid.isdigit():
            raise HTTPException(
                status_code=400, detail="steam launch needs numeric appid"
            )
        uri = f"steam://rungameid/{appid}"
        try:
            os.startfile(uri)  # type: ignore[attr-defined]
        except OSError as exc:
            raise HTTPException(
                status_code=500, detail=f"Could not launch Steam: {exc}"
            )
        return {"launched": uri}

    if body.kind == "playnite":
        info = _find_playnite()
        exe = info.get("exe")
        if not exe:
            # Fall back to the URI scheme if the exe wasn't found.
            uri = "playnite://"
            try:
                os.startfile(uri)  # type: ignore[attr-defined]
                return {"launched": uri}
            except OSError as exc:
                raise HTTPException(
                    status_code=404,
                    detail="Playnite not detected — install it or add games manually.",
                ) from exc
        try:
            subprocess.Popen([exe], close_fds=True)
        except OSError as exc:
            raise HTTPException(
                status_code=500, detail=f"Could not start Playnite: {exc}"
            )
        return {"launched": exe}

    if body.kind == "portablemc":
        return _launch_portablemc()

    if body.kind == "roblox":
        return _launch_roblox()

    if body.kind == "exe":
        path = (body.path or "").strip()
        if not path:
            raise HTTPException(status_code=400, detail="exe launch needs a path")
        exe_path = Path(path).expanduser()
        if not exe_path.is_file():
            raise HTTPException(status_code=404, detail="file not found")
        try:
            subprocess.Popen(
                [str(exe_path), *body.args.split()],
                cwd=str(exe_path.parent),
                close_fds=True,
            )
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Launch failed: {exc}")
        return {"launched": str(exe_path)}

    # custom
    game_id = (body.id or "").strip()
    game = next((g for g in _load_games() if g.get("id") == game_id), None)
    if game is None:
        raise HTTPException(status_code=404, detail="game not found")
    exe_path = Path(str(game.get("exe", ""))).expanduser()
    if not exe_path.is_file():
        raise HTTPException(status_code=404, detail="game executable not found")
    args = str(game.get("args", ""))
    try:
        subprocess.Popen(
            [str(exe_path), *args.split()],
            cwd=str(game.get("working_dir") or exe_path.parent),
            close_fds=True,
        )
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Launch failed: {exc}")
    return {"launched": str(exe_path)}


@games_router.post("/custom")
def add_custom_game(body: CustomGameIn) -> dict:
    exe_path = Path(body.exe).expanduser()
    if not exe_path.is_file():
        raise HTTPException(status_code=400, detail="exe path does not exist")
    games = _load_games()
    game = {
        "id": uuid.uuid4().hex[:12],
        "kind": "custom",
        "title": body.title.strip(),
        "exe": str(exe_path),
        "args": body.args.strip(),
        "working_dir": body.working_dir.strip(),
        "cover": body.cover_url.strip(),
        "created": time.time(),
    }
    games.append(game)
    _save_games(games)
    return {"game": game}


# ---------------------------------------------------------------------------
# Bundled Minecraft dedicated server (downloaded on demand, runs globally)
# ---------------------------------------------------------------------------

_MC_DIR = (
    Path(os.environ.get("OPENJARVIS_CONFIG_DIR", str(Path.home() / ".openjarvis")))
    / "minecraft-server"
)
_MC_JAR = _MC_DIR / "server.jar"
_MC_EULA = _MC_DIR / "eula.txt"
_MC_VERSION_FILE = _MC_DIR / "version.txt"
_MC_SERVER_PROC: Optional[subprocess.Popen] = None

_PISTON_MANIFEST = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json"
_JRE_URL = (
    "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse"
)


def _mc_java() -> Optional[Path]:
    """Bundled JRE first, then java on PATH."""
    for candidate in (_MC_DIR / "jre" / "bin" / "java.exe",):
        if candidate.is_file():
            return candidate
    import shutil

    found = shutil.which("java")
    return Path(found) if found else None


def _mc_server_jar_url(version: str = "") -> str:
    import urllib.request

    with urllib.request.urlopen(_PISTON_MANIFEST, timeout=30) as r:
        manifest = json.loads(r.read().decode())
    if version:
        entry = next(
            (v for v in manifest["versions"] if v["id"] == version), None
        )
    else:
        entry = next(
            (v for v in manifest["versions"] if v["type"] == "release"), None
        )
    if entry is None:
        raise HTTPException(status_code=404, detail="Minecraft version not found")
    with urllib.request.urlopen(entry["url"], timeout=30) as r:
        meta = json.loads(r.read().decode())
    return meta["downloads"]["server"]["url"]


def _mc_setup(body_version: str = "") -> dict:
    _MC_DIR.mkdir(parents=True, exist_ok=True)
    # Accept the EULA once — it only gates first launch of a self-hosted server.
    _MC_EULA.write_text("eula=true\n", encoding="utf-8")
    if not _MC_JAR.is_file():
        url = _mc_server_jar_url(body_version)
        import urllib.request

        tmp = _MC_DIR / "server.jar.part"
        with urllib.request.urlopen(url, timeout=120) as r, open(tmp, "wb") as f:
            shutil.copyfileobj(r, f)
        tmp.replace(_MC_JAR)
    if _mc_java() is None:
        import urllib.request
        import zipfile

        jre_zip = _MC_DIR / "jre.zip"
        with urllib.request.urlopen(_JRE_URL, timeout=300) as r, open(jre_zip, "wb") as f:
            shutil.copyfileobj(r, f)
        with zipfile.ZipFile(jre_zip) as z:
            z.extractall(_MC_DIR / "jre-extract")
        inner = next((_MC_DIR / "jre-extract").iterdir())
        target = _MC_DIR / "jre"
        if target.exists():
            shutil.rmtree(target)
        inner.rename(target)
        shutil.rmtree(_MC_DIR / "jre-extract")
        jre_zip.unlink(missing_ok=True)
    return {"ready": True, "dir": str(_MC_DIR), "java": str(_mc_java())}


class McServerIn(BaseModel):
    action: str = Field(pattern="^(setup|start|stop|status)$")
    version: str = Field(default="", max_length=80)


@games_router.post("/mcserver")
def mc_server(body: McServerIn) -> dict:
    global _MC_SERVER_PROC
    if body.action == "setup":
        return _mc_setup(body.version)
    if body.action == "status":
        running = _MC_SERVER_PROC is not None and _MC_SERVER_PROC.poll() is None
        return {
            "installed": _MC_JAR.is_file(),
            "running": running,
            "java": str(_mc_java() or ""),
            "dir": str(_MC_DIR),
        }
    if body.action == "stop":
        if _MC_SERVER_PROC is not None and _MC_SERVER_PROC.poll() is None:
            _MC_SERVER_PROC.terminate()
        _MC_SERVER_PROC = None
        return {"stopped": True}
    # start
    if not _MC_JAR.is_file():
        _mc_setup(body.version)
    java = _mc_java()
    if java is None:
        raise HTTPException(status_code=500, detail="No Java runtime available")
    if _MC_SERVER_PROC is not None and _MC_SERVER_PROC.poll() is None:
        return {"running": True, "already": True}
    _MC_DIR.mkdir(parents=True, exist_ok=True)
    _MC_EULA.write_text("eula=true\n", encoding="utf-8")
    log_path = _MC_DIR / "server.log"
    try:
        log_file = open(log_path, "ab")
        _MC_SERVER_PROC = subprocess.Popen(
            [str(java), "-Xmx2G", "-jar", str(_MC_JAR), "nogui"],
            cwd=str(_MC_DIR),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            close_fds=True,
        )
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Could not start server: {exc}")
    return {"running": True, "pid": _MC_SERVER_PROC.pid, "log": str(log_path)}


@games_router.delete("/custom/{game_id}")
def delete_custom_game(game_id: str) -> dict:
    games = _load_games()
    kept = [g for g in games if g.get("id") != game_id]
    if len(kept) == len(games):
        raise HTTPException(status_code=404, detail="game not found")
    _save_games(kept)
    return {"deleted": game_id}
