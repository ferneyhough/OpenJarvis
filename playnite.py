"""Playnite bridge: find Playnite, install the export extension, search/launch/recommend games."""
import os
import json
import random
import shutil
import difflib
import subprocess
from pathlib import Path

EXT_ID = "OpenJarvisBridge"
INSTALL_HINT = "Say 'install Playnite' or get it from https://playnite.link"


def _env_path(var: str, fallback: str) -> Path:
    return Path(os.environ.get(var) or fallback)


def find_exe(cfg: dict, fullscreen: bool = False) -> Path | None:
    name = "Playnite.FullscreenApp.exe" if fullscreen else "Playnite.DesktopApp.exe"
    custom = cfg.get("playnite_path", "")
    dirs = [Path(custom)] if custom else []
    dirs += [
        _env_path("LOCALAPPDATA", str(Path.home() / "AppData/Local")) / "Playnite",
        _env_path("ProgramFiles", "C:/Program Files") / "Playnite",
        _env_path("ProgramFiles(x86)", "C:/Program Files (x86)") / "Playnite",
    ]
    for d in dirs:
        exe = d / name if d.is_dir() else d
        if exe.name.lower() != name.lower():
            exe = exe.parent / name
        if exe.exists():
            return exe
    return None


def _data_dirs(cfg: dict) -> list[Path]:
    dirs = [_env_path("APPDATA", str(Path.home() / "AppData/Roaming")) / "Playnite"]
    exe = find_exe(cfg)
    if exe:
        dirs.append(exe.parent)  # portable installs keep data next to the exe
    return dirs


def install_bridge(cfg: dict, res_dir: Path) -> str:
    exe = find_exe(cfg)
    if not exe:
        return f"[PLAYNITE] Playnite not found. {INSTALL_HINT}"
    src = res_dir / "playnite_extension" / EXT_ID
    roaming = _data_dirs(cfg)[0]
    ext_root = roaming / "Extensions" if roaming.exists() else exe.parent / "Extensions"
    dest = ext_root / EXT_ID
    dest.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        shutil.copy2(f, dest / f.name)
    return f"[PLAYNITE] Bridge installed to {dest}. Restart Playnite once so it exports your library."


def bridge_installed(cfg: dict) -> bool:
    return any((d / "Extensions" / EXT_ID / "extension.yaml").exists() for d in _data_dirs(cfg))


def install_playnite() -> str:
    try:
        proc = subprocess.run(
            "winget install -e --id Playnite.Playnite --accept-source-agreements --accept-package-agreements",
            shell=True, capture_output=True, text=True, timeout=600,
        )
        if proc.returncode == 0:
            return "[PLAYNITE] Playnite installed. Open it once, then say 'connect Playnite'."
        return f"[PLAYNITE] winget failed ({proc.returncode}). Download it from https://playnite.link\n{proc.stdout[-500:]}"
    except Exception as e:
        return f"[PLAYNITE] install error: {e}. Download it from https://playnite.link"


def load_library(cfg: dict) -> list[dict] | None:
    for d in _data_dirs(cfg):
        p = d / "ExtensionsData" / EXT_ID / "library.json"
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8-sig") or "[]")
            return data if isinstance(data, list) else [data]
    return None


def _no_library(cfg: dict) -> str:
    if not find_exe(cfg):
        return f"[PLAYNITE] Playnite is not installed. {INSTALL_HINT}"
    if not bridge_installed(cfg):
        return "[PLAYNITE] Not connected yet. Say 'connect Playnite'."
    return "[PLAYNITE] No library export yet. Open (or restart) Playnite once and try again."


def _hours(g: dict) -> float:
    return round((g.get("playtime") or 0) / 3600, 1)


def _line(g: dict) -> str:
    tags = ", ".join((g.get("genres") or [])[:3])
    state = "installed" if g.get("installed") else "not installed"
    return f"- {g['name']} ({state}, {_hours(g)}h played{', ' + tags if tags else ''}{', ' + g['source'] if g.get('source') else ''})"


def _best_match(games: list[dict], name: str) -> dict | None:
    q = name.lower().strip()
    exact = [g for g in games if g["name"].lower() == q]
    if exact:
        return exact[0]
    contains = [g for g in games if q in g["name"].lower()]
    if contains:
        return sorted(contains, key=lambda g: (not g.get("installed"), len(g["name"])))[0]
    names = [g["name"].lower() for g in games]
    close = difflib.get_close_matches(q, names, n=1, cutoff=0.5)
    return games[names.index(close[0])] if close else None


def search(cfg: dict, query: str = "", installed_only: bool = False) -> str:
    games = load_library(cfg)
    if games is None:
        return _no_library(cfg)
    games = [g for g in games if not g.get("hidden")]
    if installed_only:
        games = [g for g in games if g.get("installed")]
    q = (query or "").lower().strip()
    if q:
        def hit(g):
            hay = " ".join([g["name"], *(g.get("genres") or []), *(g.get("platforms") or []), g.get("source") or ""]).lower()
            return all(tok in hay for tok in q.split())
        games = [g for g in games if hit(g)]
    games.sort(key=lambda g: g["name"].lower())
    head = f"[PLAYNITE] {len(games)} game(s) match '{query or 'all'}'"
    return head + "\n" + "\n".join(_line(g) for g in games[:30])


def play(cfg: dict, name: str) -> str:
    games = load_library(cfg)
    if games is None:
        return _no_library(cfg)
    g = _best_match(games, name)
    if not g:
        return f"[PLAYNITE] No game matching '{name}'."
    os.startfile(f"playnite://playnite/start/{g['id']}")  # type: ignore[attr-defined]
    note = "" if g.get("installed") else " (not installed, Playnite will offer to install it)"
    return f"[PLAYNITE] Launching {g['name']}{note}"


def recommend(cfg: dict, genre: str = "") -> str:
    games = load_library(cfg)
    if games is None:
        return _no_library(cfg)
    done = {"completed", "beaten", "abandoned"}
    pool = [g for g in games if g.get("installed") and not g.get("hidden")
            and (g.get("completion") or "").lower() not in done]
    if genre:
        pool = [g for g in pool if any(genre.lower() in x.lower() for x in (g.get("genres") or []))]
    if not pool:
        return f"[PLAYNITE] No installed, unfinished games{' in ' + genre if genre else ''}."
    pool.sort(key=lambda g: (g.get("playtime") or 0) - (36000 if g.get("favorite") else 0))
    picks = random.sample(pool[:10], k=min(3, len(pool[:10])))
    return "[PLAYNITE] Suggestions (installed, barely played or favourites):\n" + "\n".join(_line(g) for g in picks)


def open_app(cfg: dict, mode: str = "desktop") -> str:
    exe = find_exe(cfg, fullscreen=(mode == "fullscreen"))
    if not exe:
        return f"[PLAYNITE] Playnite is not installed. {INSTALL_HINT}"
    subprocess.Popen([str(exe)], cwd=str(exe.parent))
    return f"[PLAYNITE] Opened Playnite ({mode})."
