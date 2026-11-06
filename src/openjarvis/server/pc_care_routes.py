"""PC care + local file explorer endpoints.

- /v1/pc/scan     — junk/temp size, dead shortcuts, empty folders, disk free
- /v1/pc/clean    — delete temp junk, dead links, empty folders (opt-in flags)
- /v1/pc/defrag   — start/stop/status for an Optimize-Volume pass on C:
- /v1/files/*     — browse/delete/open/reveal local files
- /v1/pc/launch   — open whitelisted Windows system apps by voice
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

pc_router = APIRouter(prefix="/v1", tags=["pc-care"])

HOME = Path.home()
TEMP_DIRS = [
    Path(os.environ.get("TEMP", "")),
    Path(os.environ.get("TMP", "")),
    Path(os.environ.get("SystemRoot", os.environ.get("WINDIR", r"C:\Windows"))) / "Temp",
]
JUNK_EXT = {".tmp", ".temp", ".old", ".bak", ".dmp", ".chk", ".partial", ".crdownload"}
JUNK_NAMES = {"thumbs.db", "desktop.ini"}
SCAN_ROOTS = [
    HOME / "Desktop",
    HOME / "Downloads",
    HOME / "Documents",
    HOME / "Pictures",
    HOME / ".openjarvis",
]
EMPTY_DIR_MAX_DEPTH = 5
EMPTY_DIR_LIMIT = 300
DEEP_DIR_BUDGET_S = 45.0
DEEP_PRUNE_DIRS = {
    "appdata", "node_modules", ".git", ".hg", ".svn", ".venv", "venv",
    "__pycache__", "$recycle.bin", "system volume information",
    "windows", "program files", "program files (x86)", "programdata",
}
LINK_SCAN_DIRS = [
    HOME / "Desktop",
    HOME / "Downloads",
    HOME / "Documents",
    HOME / "Start Menu",
    HOME / "AppData" / "Roaming" / "Microsoft" / "Windows" / "Start Menu",
]

# ---------------------------------------------------------------- defrag state

_defrag_lock = threading.Lock()
_defrag_state: dict[str, Any] = {"running": False, "started": None, "finished": None, "output": "", "returncode": None}


def _run_defrag() -> None:
    with _defrag_lock:
        _defrag_state.update(running=True, started=time.time(), finished=None, output="", returncode=None)
    try:
        # /O = retrim/optimize (SSD-aware); /C would force defrag on HDDs too,
        # which Optimize-Volume handles correctly per media type anyway.
        proc = subprocess.run(
            ["defrag.exe", "C:", "/O", "/V"],
            capture_output=True, text=True, timeout=7200,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        with _defrag_lock:
            _defrag_state.update(running=False, finished=time.time(), output=out[-4000:], returncode=proc.returncode)
    except Exception as exc:  # noqa: BLE001
        with _defrag_lock:
            _defrag_state.update(running=False, finished=time.time(), output=str(exc), returncode=-1)


# ---------------------------------------------------------------- helpers

def _dir_size(path: Path) -> int:
    total = 0
    try:
        for p in path.rglob("*"):
            try:
                if p.is_file():
                    total += p.stat().st_size
            except OSError:
                continue
    except OSError:
        pass
    return total


def _scan_temp() -> dict[str, Any]:
    files: list[dict[str, Any]] = []
    seen: set[str] = set()
    for td in TEMP_DIRS:
        try:
            if not td.is_dir():
                continue
        except OSError:
            continue
        try:
            for p in td.iterdir():
                try:
                    if not p.is_file():
                        continue
                    key = str(p)
                    if key in seen:
                        continue
                    if p.suffix.lower() in JUNK_EXT or p.name.lower() in JUNK_NAMES or p.name.startswith("~"):
                        seen.add(key)
                        files.append({"path": str(p), "size": p.stat().st_size, "name": p.name})
                except OSError:
                    continue
        except OSError:
            continue
        if len(files) > 5000:
            break
    return {
        "count": len(files),
        "bytes": sum(f["size"] for f in files),
        "sample": files[:25],
    }


def _scan_empty_dirs(
    roots: list[Path] | None = None,
    deadline: float | None = None,
    prune: set[str] | None = None,
) -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    for root in (roots if roots is not None else SCAN_ROOTS):
        if len(found) >= EMPTY_DIR_LIMIT or not root.is_dir():
            continue
        base_depth = len(root.parts)
        try:
            for dirpath, dirnames, filenames in os.walk(root):
                if len(found) >= EMPTY_DIR_LIMIT:
                    break
                if deadline is not None and time.time() > deadline:
                    dirnames[:] = []
                    break
                if prune:
                    dirnames[:] = [
                        d for d in dirnames
                        if d.lower() not in prune and not d.startswith(".")
                    ]
                depth = len(Path(dirpath).parts) - base_depth
                if depth > EMPTY_DIR_MAX_DEPTH:
                    dirnames[:] = []
                    continue
                # Skip hidden/system dirs and anything with files.
                if filenames:
                    continue
                name = Path(dirpath).name
                if name.startswith(".") or name.lower() in {"appdata", "node_modules"}:
                    continue
                # Only count as empty if every subdir is also empty-ish:
                # cheap check — no files here; subdirs may hold files deeper,
                # so verify quickly.
                has_content = False
                try:
                    for sub in dirnames:
                        if any((Path(dirpath) / sub).iterdir()):
                            has_content = True
                            break
                except OSError:
                    has_content = True
                if not has_content:
                    found.append({"path": dirpath})
        except OSError:
            continue
    return found


def _scan_dead_links(roots: list[Path] | None = None) -> list[dict[str, str]]:
    """Resolve .lnk/.url shortcuts via PowerShell COM; report broken targets."""
    targets: list[Path] = []
    for d in (roots if roots is not None else LINK_SCAN_DIRS):
        try:
            if not d.is_dir():
                continue
            for p in d.rglob("*"):
                if len(targets) >= 400:
                    break
                if p.suffix.lower() in {".lnk", ".url"}:
                    targets.append(p)
        except OSError:
            continue
    if not targets:
        return []
    # Emit a PowerShell script that resolves each shortcut and prints
    # "path|target|exists" lines — one process for all links.
    ps_lines = [
        "$sh = New-Object -ComObject WScript.Shell",
        "$out = @()",
    ]
    for p in targets:
        esc = str(p).replace("'", "''")
        ps_lines.append(
            f"try {{ $s = $sh.CreateShortcut('{esc}'); "
            f"$t = $s.TargetPath; if ($t -and -not (Test-Path -LiteralPath $t)) {{ "
            f"Write-Output ('{esc}|' + $t) }} }} catch {{}}"
        )
    ps_lines.append("exit 0")
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", "\n".join(ps_lines)],
            capture_output=True, text=True, timeout=120,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("dead-link scan failed: %s", exc)
        return []
    dead = []
    for line in (proc.stdout or "").splitlines():
        if "|" not in line:
            continue
        link, target = line.split("|", 1)
        dead.append({"path": link.strip(), "target": target.strip()})
        if len(dead) >= 200:
            break
    return dead


# ---------------------------------------------------------------- endpoints

USERS_ROOT = HOME.parent  # e.g. C:\Users
PROGRAMDATA_ROOT = Path(os.environ.get("ProgramData", r"C:\ProgramData"))
DEEP_SCAN_ROOTS = [
    USERS_ROOT,
    PROGRAMDATA_ROOT,
]


def _deep_link_dirs() -> list[Path]:
    """Shortcut-heavy dirs across every user profile — avoids a full-drive rglob."""
    dirs: list[Path] = []
    skip = {"public", "default", "default user", "all users"}
    try:
        for prof in USERS_ROOT.iterdir():
            if not prof.is_dir() or prof.name.lower() in skip:
                continue
            for sub in ("Desktop", "Downloads", "Documents", "Start Menu"):
                d = prof / sub
                if d.is_dir():
                    dirs.append(d)
            sm = prof / "AppData" / "Roaming" / "Microsoft" / "Windows" / "Start Menu"
            if sm.is_dir():
                dirs.append(sm)
    except OSError:
        pass
    pd = PROGRAMDATA_ROOT / "Microsoft" / "Windows" / "Start Menu"
    if pd.is_dir():
        dirs.append(pd)
    return dirs


@pc_router.get("/pc/scan")
def scan(deep: bool = False) -> dict:
    t0 = time.time()
    temp = _scan_temp()
    if deep:
        deadline = t0 + DEEP_DIR_BUDGET_S
        empty = _scan_empty_dirs(
            SCAN_ROOTS + DEEP_SCAN_ROOTS, deadline=deadline, prune=DEEP_PRUNE_DIRS
        )
        dead = _scan_dead_links(LINK_SCAN_DIRS + _deep_link_dirs())
    else:
        empty = _scan_empty_dirs()
        dead = _scan_dead_links()
    usage = shutil.disk_usage("C:\\")
    return {
        "duration_s": round(time.time() - t0, 1),
        "disk": {
            "total": usage.total,
            "used": usage.used,
            "free": usage.free,
            "free_gb": round(usage.free / 1e9, 1),
        },
        "temp": temp,
        "empty_dirs": {"count": len(empty), "sample": empty[:50]},
        "dead_links": {"count": len(dead), "sample": dead[:50]},
    }


class CleanBody(BaseModel):
    temp: bool = False
    dead_links: bool = False
    empty_dirs: bool = False


def _safe_delete(path: str) -> bool:
    p = Path(path)
    try:
        rp = p.resolve()
        # Only delete inside the user's profile or known temp dirs.
        allowed = [HOME.resolve()] + [t.resolve() for t in TEMP_DIRS if t.exists()]
        if not any(str(rp).lower() == str(a).lower() or str(rp).lower().startswith(str(a).lower() + os.sep) for a in allowed):
            return False
        if p.is_file() or p.is_symlink():
            p.unlink(missing_ok=True)
            return True
        if p.is_dir() and not any(p.iterdir()):
            p.rmdir()
            return True
    except OSError:
        return False
    return False


@pc_router.post("/pc/clean")
def clean(body: CleanBody) -> dict:
    freed = 0
    removed_files = 0
    removed_dirs = 0
    errors = 0

    if body.temp:
        temp = _scan_temp()
        for f in temp["sample"] + _scan_temp_all():
            if _safe_delete(f["path"]):
                freed += f["size"]
                removed_files += 1
            else:
                errors += 1

    if body.dead_links:
        for link in _scan_dead_links():
            if _safe_delete(link["path"]):
                removed_files += 1
            else:
                errors += 1

    if body.empty_dirs:
        # Delete deepest first so parents become empty and removable.
        dirs = sorted(_scan_empty_dirs(), key=lambda d: d["path"].count(os.sep), reverse=True)
        for d in dirs:
            if _safe_delete(d["path"]):
                removed_dirs += 1
            else:
                errors += 1

    return {"freed_bytes": freed, "removed_files": removed_files, "removed_dirs": removed_dirs, "errors": errors}


def _scan_temp_all() -> list[dict[str, Any]]:
    """Full temp file list (scan endpoint caps the sample for speed)."""
    files: list[dict[str, Any]] = []
    seen: set[str] = set()
    for td in TEMP_DIRS:
        try:
            if not td.is_dir():
                continue
        except OSError:
            continue
        try:
            for p in td.iterdir():
                try:
                    if p.is_file() and str(p) not in seen and (
                        p.suffix.lower() in JUNK_EXT or p.name.lower() in JUNK_NAMES or p.name.startswith("~")
                    ):
                        seen.add(str(p))
                        files.append({"path": str(p), "size": p.stat().st_size})
                except OSError:
                    continue
        except OSError:
            continue
    return files


@pc_router.post("/pc/defrag/start")
def defrag_start() -> dict:
    with _defrag_lock:
        if _defrag_state["running"]:
            return {"started": False, "reason": "already running"}
        _defrag_state.update(running=True, started=time.time(), finished=None, output="", returncode=None)
    threading.Thread(target=_run_defrag, daemon=True).start()
    return {"started": True}


@pc_router.get("/pc/defrag/status")
def defrag_status() -> dict:
    with _defrag_lock:
        return dict(_defrag_state)


# ---------------------------------------------------------------- files

def _browse(path_str: str) -> dict:
    try:
        path = Path(path_str).expanduser()
        if not path.exists():
            raise HTTPException(status_code=404, detail="Path not found")
        if not path.is_dir():
            path = path.parent
        dirs, files = [], []
        try:
            children = sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except PermissionError:
            raise HTTPException(status_code=403, detail="Access denied")
        for child in children[:500]:
            try:
                if child.is_dir():
                    dirs.append({"name": child.name, "path": str(child)})
                elif child.is_file():
                    files.append({"name": child.name, "path": str(child), "size": child.stat().st_size})
            except OSError:
                continue
        return {
            "path": str(path),
            "parent": str(path.parent) if path.parent != path else None,
            "dirs": dirs,
            "files": files,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@pc_router.get("/files/browse")
def files_browse(path: Optional[str] = None) -> dict:
    return _browse(path or str(HOME))


class FileActionBody(BaseModel):
    path: str
    action: str  # open | reveal | delete


@pc_router.post("/files/action")
def files_action(body: FileActionBody) -> dict:
    p = Path(body.path).expanduser()
    if not p.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if body.action == "open":
        if p.is_dir():
            os.startfile(str(p))  # type: ignore[attr-defined]
        else:
            os.startfile(str(p))  # type: ignore[attr-defined]
        return {"ok": True}
    if body.action == "reveal":
        subprocess.Popen(["explorer", "/select,", str(p)])
        return {"ok": True}
    if body.action == "delete":
        if not _safe_delete(str(p)):
            raise HTTPException(status_code=400, detail="Cannot delete — file busy, non-empty folder, or outside allowed area")
        return {"ok": True}
    raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")


# ---------------------------------------------------------------- system apps

SYSTEM_APPS = {
    "explorer": ["explorer.exe"],
    "file explorer": ["explorer.exe"],
    "files": ["explorer.exe"],
    "notepad": ["notepad.exe"],
    "calculator": ["calc.exe"],
    "calc": ["calc.exe"],
    "paint": ["mspaint.exe"],
    "wordpad": ["write.exe"],
    "command prompt": ["cmd.exe"],
    "cmd": ["cmd.exe"],
    "powershell": ["powershell.exe"],
    "terminal": ["wt.exe"],
    "task manager": ["taskmgr.exe"],
    "settings": ["ms-settings:"],
    "control panel": ["control.exe"],
    "activation settings": ["ms-settings:activation"],
    "ms-settings:activation": ["ms-settings:activation"],
}

# Every launchable Windows target, grouped for the Toolbox UI. Commands ending
# in ":" are shell URIs opened via os.startfile; the rest are executables.
WINDOWS_GROUPS: dict[str, dict[str, str]] = {
    "Win+X menu": {
        "terminal": "wt.exe",
        "file explorer": "explorer.exe",
        "task manager": "taskmgr.exe",
        "settings": "ms-settings:",
        "control panel": "control.exe",
    },
    "Control Panel": {
        "programs and features": "appwiz.cpl",
        "uninstall a program": "appwiz.cpl",
        "power options": "powercfg.cpl",
        "internet options": "inetcpl.cpl",
        "mouse": "main.cpl",
        "keyboard": "main.cpl",
        "display": "desk.cpl",
        "sound": "mmsys.cpl",
        "speech recognition": "mmsys.cpl",
        "date and time": "timedate.cpl",
        "region": "intl.cpl",
        "user accounts": "netplwiz.exe",
        "windows defender": "windowsdefender:",
        "windows security": "windowsdefender:",
        "bitlocker": "BitLockerWizard.exe",
        "credential manager": "rundll32.exe keymgr.dll,KRShowKeyMgr",
        "indexing options": "control.exe /name Microsoft.IndexingOptions",
        "windows features": "optionalfeatures.exe",
        "environment variables": "SystemPropertiesAdvanced.exe",
        "system properties": "SystemPropertiesComputerName.exe",
    },
    "System tools": {
        "device manager": "devmgmt.msc",
        "disk management": "diskmgmt.msc",
        "computer management": "compmgmt.msc",
        "services": "services.msc",
        "event viewer": "eventvwr.msc",
        "task scheduler": "taskschd.msc",
        "system configuration": "msconfig.exe",
        "system information": "msinfo32.exe",
        "directx diagnostics": "dxdiag.exe",
        "resource monitor": "resmon.exe",
        "performance monitor": "perfmon.exe",
        "registry editor": "regedit.exe",
        "local users": "lusrmgr.msc",
        "group policy": "gpedit.msc",
        "windows security console": "secpol.msc",
        "disk cleanup": "cleanmgr.exe",
        "defrag and optimize": "dfrgui.exe",
        "memory diagnostic": "mdsched.exe",
        "print management": "printmanagement.msc",
        "shared folders": "fsmgmt.msc",
        "iSCSI initiator": "iscsicpl.exe",
        "odbc data sources": "odbcad32.exe",
    },
    "Windows apps": {
        "notepad": "notepad.exe",
        "calculator": "calc.exe",
        "paint": "mspaint.exe",
        "wordpad": "write.exe",
        "snipping tool": "SnippingTool.exe",
        "steps recorder": "psr.exe",
        "character map": "charmap.exe",
        "on-screen keyboard": "osk.exe",
        "magnifier": "magnify.exe",
        "narrator": "narrator.exe",
        "voice access": "ms-settings:easeofaccess-voice",
        "windows media player": "wmplayer.exe",
        "clock": "ms-clock:",
        "camera": "microsoft.windows.camera:",
        "photos": "ms-photos:",
        "store": "ms-windows-store:",
        "Xbox app": "xbox:",
        "get help": "ms-gethelp:",
        "feedback hub": "ms-feedback:",
    },
}

# Flat lookup used by /pc/launch. Values are command strings (may include args
# or be a shell URI like "ms-settings:").
_LAUNCH_TARGETS: dict[str, str] = {}
for _group in WINDOWS_GROUPS.values():
    _LAUNCH_TARGETS.update(_group)
for _key, _cmd in SYSTEM_APPS.items():
    _LAUNCH_TARGETS.setdefault(_key, " ".join(_cmd))


@pc_router.get("/pc/launchable")
def launchable_targets() -> dict:
    """Grouped list of Windows apps, Control Panel applets, and tools."""
    return {"groups": WINDOWS_GROUPS}


class LaunchBody(BaseModel):
    app: str


@pc_router.post("/pc/launch")
def launch_system(body: LaunchBody) -> dict:
    key = body.app.strip().lower()
    target = _LAUNCH_TARGETS.get(key) or _LAUNCH_TARGETS.get(key.replace(" ", "-"))
    if not target:
        # Fall back to the original flat map for aliases like "cmd".
        legacy = SYSTEM_APPS.get(key)
        target = " ".join(legacy) if legacy else None
    if not target:
        raise HTTPException(status_code=404, detail=f"Unknown system app: {body.app}")
    try:
        parts = target.split()
        first = parts[0]
        lower = first.lower()
        if ":" in first and not lower.endswith(".exe"):
            # Shell URI (ms-settings:, windowsdefender:, ms-photos:, …)
            os.startfile(first)  # type: ignore[attr-defined]
        elif lower.endswith(".msc"):
            # Microsoft Management Console snap-ins need mmc.exe
            subprocess.Popen(["mmc.exe", first])
        elif lower.endswith(".cpl"):
            # Control Panel applets need control.exe
            subprocess.Popen(["control.exe", first])
        else:
            subprocess.Popen(parts)
        return {"ok": True, "app": key}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---------------------------------------------------------------- toolbox
# IObit-Toolbox-style utilities rebuilt natively: system info, drives,
# processes, startup manager, registry orphans, duplicates, ports, shredder,
# power controls.

try:
    import psutil  # type: ignore
except ImportError:  # pragma: no cover
    psutil = None  # type: ignore

try:
    import winreg  # type: ignore  # Windows-only
except ImportError:  # pragma: no cover
    winreg = None  # type: ignore


@pc_router.get("/pc/info")
def system_info() -> dict:
    import platform

    info: dict[str, Any] = {
        "os": platform.platform(),
        "machine": platform.machine(),
        "python": platform.python_version(),
        "hostname": platform.node(),
    }
    if psutil is not None:
        info["cpu"] = {
            "model": platform.processor() or "unknown",
            "physical_cores": psutil.cpu_count(logical=False),
            "logical_cores": psutil.cpu_count(logical=True),
            "freq_mhz": (psutil.cpu_freq().current if psutil.cpu_freq() else None),
            "usage_pct": psutil.cpu_percent(interval=0.3),
        }
        vm = psutil.virtual_memory()
        info["memory"] = {
            "total": vm.total, "available": vm.available, "used": vm.used,
            "percent": vm.percent,
        }
        info["uptime_s"] = int(time.time() - psutil.boot_time())
    usage = shutil.disk_usage("C:\\")
    info["disk_c"] = {"total": usage.total, "free": usage.free, "used": usage.used}
    return info


@pc_router.get("/pc/drives")
def drives() -> dict:
    out = []
    for letter in "CDEFGHIJKLMNOPQRSTUVWXYZ":
        root = f"{letter}:\\"
        if not Path(root).exists():
            continue
        try:
            u = shutil.disk_usage(root)
            out.append({
                "drive": f"{letter}:", "total": u.total, "used": u.used, "free": u.free,
                "free_gb": round(u.free / 1e9, 1),
            })
        except OSError:
            continue
    return {"drives": out}


@pc_router.get("/pc/processes")
def processes(limit: int = 40) -> dict:
    if psutil is None:
        raise HTTPException(status_code=503, detail="psutil not installed")
    procs = []
    for p in psutil.process_iter(["pid", "name", "memory_info", "username"]):
        try:
            info = p.info
            procs.append({
                "pid": info["pid"],
                "name": info["name"],
                "mem_mb": round((info["memory_info"].rss if info["memory_info"] else 0) / 1e6, 1),
                "user": info["username"],
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    procs.sort(key=lambda x: x["mem_mb"], reverse=True)
    return {"processes": procs[:limit], "total": len(procs)}


@pc_router.post("/pc/process/kill")
def kill_process(body: dict) -> dict:
    pid = int(body.get("pid", 0))
    if psutil is None or pid <= 0:
        raise HTTPException(status_code=400, detail="Invalid pid")
    try:
        p = psutil.Process(pid)
        name = p.name()
        p.terminate()
        try:
            p.wait(timeout=5)
        except psutil.TimeoutExpired:
            p.kill()
        return {"ok": True, "killed": name}
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process not found")
    except psutil.AccessDenied:
        raise HTTPException(status_code=403, detail="Access denied — run as admin")


# ---- startup manager ------------------------------------------------------

RUN_KEYS = {
    "HKCU": (winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run"),
    "HKLM": (winreg.HKEY_LOCAL_MACHINE, r"Software\Microsoft\Windows\CurrentVersion\Run"),
} if winreg else {}
DISABLED_KEY = (winreg.HKEY_CURRENT_USER, r"Software\OpenJarvis\DisabledStartup") if winreg else (None, None)


def _enum_run_key(hive_name: str) -> list[dict[str, str]]:
    hive, sub = RUN_KEYS[hive_name]
    out = []
    try:
        with winreg.OpenKey(hive, sub) as key:
            i = 0
            while True:
                try:
                    name, value, _ = winreg.EnumValue(key, i)
                except OSError:
                    break
                out.append({"hive": hive_name, "name": name, "command": str(value), "enabled": "true"})
                i += 1
    except OSError:
        pass
    return out


@pc_router.get("/pc/startup")
def startup_items() -> dict:
    items = _enum_run_key("HKCU") + _enum_run_key("HKLM")
    # Startup folder shortcuts/programs.
    for folder in [HOME / "AppData" / "Roaming" / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Startup"]:
        try:
            for p in folder.iterdir():
                items.append({
                    "hive": "STARTUP", "name": p.stem, "command": str(p), "enabled": "true",
                })
        except OSError:
            pass
    # Disabled entries stored under OpenJarvis key.
    try:
        dhive, dsub = DISABLED_KEY
        with winreg.OpenKey(dhive, dsub) as dkey:
            i = 0
            while True:
                try:
                    name, value, _ = winreg.EnumValue(dkey, i)
                except OSError:
                    break
                parts = str(value).split("|", 1)
                items.append({
                    "hive": parts[0] if len(parts) > 1 else "HKCU",
                    "name": name.split("|", 1)[-1],
                    "command": parts[1] if len(parts) > 1 else value,
                    "enabled": "false",
                })
                i += 1
    except OSError:
        pass
    return {"items": items}


class StartupToggle(BaseModel):
    name: str
    hive: str
    enable: bool


@pc_router.post("/pc/startup/toggle")
def startup_toggle(body: StartupToggle) -> dict:
    hive_name = body.hive.upper()
    if hive_name not in RUN_KEYS:
        raise HTTPException(status_code=400, detail="hive must be HKCU or HKLM")
    hive, sub = RUN_KEYS[hive_name]
    dhive, dsub = DISABLED_KEY
    store_name = f"{hive_name}|{body.name}"
    try:
        if body.enable:
            with winreg.OpenKey(dhive, dsub) as dkey:
                value, _ = winreg.QueryValueEx(dkey, store_name)
            cmd = value.split("|", 1)[1] if "|" in value else value
            with winreg.OpenKey(hive, sub, 0, winreg.KEY_SET_VALUE) as key:
                winreg.SetValueEx(key, body.name, 0, winreg.REG_SZ, cmd)
            with winreg.OpenKey(dhive, dsub, 0, winreg.KEY_SET_VALUE) as dkey:
                winreg.DeleteValue(dkey, store_name)
        else:
            with winreg.OpenKey(hive, sub) as key:
                value, _ = winreg.QueryValueEx(key, body.name)
            try:
                winreg.CreateKey(dhive, dsub)
            except OSError:
                pass
            with winreg.OpenKey(dhive, dsub, 0, winreg.KEY_SET_VALUE) as dkey:
                winreg.SetValueEx(dkey, store_name, 0, winreg.REG_SZ, f"{hive_name}|{value}")
            with winreg.OpenKey(hive, sub, 0, winreg.KEY_SET_VALUE) as key:
                winreg.DeleteValue(key, body.name)
        return {"ok": True}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Startup entry not found")
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---- registry orphans ------------------------------------------------------

@pc_router.get("/pc/registry/orphans")
def registry_orphans() -> dict:
    """Uninstall entries whose InstallLocation/DisplayIcon no longer exists."""
    roots = [
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"),
        (winreg.HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"),
    ]
    orphans = []
    total = 0
    for hive, sub in roots:
        try:
            with winreg.OpenKey(hive, sub) as root:
                i = 0
                while True:
                    try:
                        subname = winreg.EnumKey(root, i)
                    except OSError:
                        break
                    i += 1
                    total += 1
                    try:
                        with winreg.OpenKey(root, subname) as k:
                            name = winreg.QueryValueEx(k, "DisplayName")[0]
                            loc = ""
                            for val in ("InstallLocation", "DisplayIcon", "UninstallString"):
                                try:
                                    loc = winreg.QueryValueEx(k, val)[0]
                                    break
                                except OSError:
                                    continue
                    except OSError:
                        continue
                    if not loc:
                        continue
                    candidate = loc.split(",")[0].strip('"')
                    if ":\\" not in candidate:
                        continue
                    probe = Path(candidate)
                    while not probe.exists() and probe != probe.parent:
                        probe = probe.parent
                    if not probe.exists():
                        orphans.append({"name": name, "location": candidate, "key": subname})
        except OSError:
            continue
    return {"total_programs": total, "orphans": orphans[:200], "count": len(orphans)}


# ---- duplicates ------------------------------------------------------------

@pc_router.get("/pc/duplicates")
def duplicates(path: str, max_files: int = 3000, min_size_kb: int = 100) -> dict:
    """Find duplicate files under a directory by size then SHA-1."""
    import hashlib

    root = Path(path).expanduser()
    if not root.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")
    files: list[Path] = []
    for p in root.rglob("*"):
        try:
            if p.is_file() and p.stat().st_size >= min_size_kb * 1024:
                files.append(p)
                if len(files) >= max_files:
                    break
        except OSError:
            continue
    by_size: dict[int, list[Path]] = {}
    for f in files:
        try:
            by_size.setdefault(f.stat().st_size, []).append(f)
        except OSError:
            continue
    groups = []
    for size, paths in by_size.items():
        if len(paths) < 2:
            continue
        by_hash: dict[str, list[str]] = {}
        for p in paths:
            try:
                h = hashlib.sha1()
                with open(p, "rb") as fh:
                    for chunk in iter(lambda: fh.read(1 << 20), b""):
                        h.update(chunk)
                by_hash.setdefault(h.hexdigest(), []).append(str(p))
            except OSError:
                continue
        for h, ps in by_hash.items():
            if len(ps) > 1:
                groups.append({"size": size, "hash": h[:12], "files": ps})
    wasted = sum(g["size"] * (len(g["files"]) - 1) for g in groups)
    return {"groups": groups[:100], "group_count": len(groups), "wasted_bytes": wasted}


# ---- ports / security -------------------------------------------------------

@pc_router.get("/pc/ports")
def listening_ports() -> dict:
    if psutil is None:
        raise HTTPException(status_code=503, detail="psutil not installed")
    ports = []
    for c in psutil.net_connections(kind="tcp"):
        if c.status == "LISTEN" and c.laddr:
            try:
                pname = psutil.Process(c.pid).name() if c.pid else "?"
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pname = "?"
            ports.append({"port": c.laddr.port, "addr": c.laddr.ip, "pid": c.pid, "process": pname})
    ports.sort(key=lambda x: x["port"])
    return {"ports": ports[:300], "count": len(ports)}


# ---- shredder ---------------------------------------------------------------

class ShredBody(BaseModel):
    path: str
    passes: int = 3


@pc_router.post("/pc/shred")
def shred(body: ShredBody) -> dict:
    p = Path(body.path).expanduser()
    if not p.is_file():
        raise HTTPException(status_code=400, detail="Shred only works on files")
    size = p.stat().st_size
    passes = max(1, min(7, body.passes))
    try:
        with open(p, "r+b") as fh:
            for i in range(passes):
                fh.seek(0)
                block = bytes([0x00, 0xFF, (i * 37) & 0xFF][i % 3]) * (1 << 20)
                remaining = size
                while remaining > 0:
                    chunk = block[: min(len(block), remaining)]
                    fh.write(chunk)
                    remaining -= len(chunk)
                fh.flush()
                os.fsync(fh.fileno())
        p.unlink()
        return {"ok": True, "bytes_shredded": size, "passes": passes}
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ---- power ------------------------------------------------------------------

class PowerBody(BaseModel):
    action: str  # lock | sleep | shutdown | restart | cancel-shutdown
    confirm: bool = False


@pc_router.post("/pc/power")
def power(body: PowerBody) -> dict:
    a = body.action.lower()
    destructive = {"shutdown", "restart"}
    if a in destructive and not body.confirm:
        raise HTTPException(status_code=400, detail="Pass confirm:true for shutdown/restart")
    try:
        if a == "lock":
            subprocess.Popen(["rundll32.exe", "user32.dll,LockWorkStation"])
        elif a == "sleep":
            subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
        elif a == "shutdown":
            subprocess.Popen(["shutdown", "/s", "/t", "60", "/c", "OpenJarvis shutdown"])
        elif a == "restart":
            subprocess.Popen(["shutdown", "/r", "/t", "60", "/c", "OpenJarvis restart"])
        elif a == "cancel-shutdown":
            subprocess.run(["shutdown", "/a"], capture_output=True, timeout=15)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown action: {a}")
        return {"ok": True, "action": a}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))




# ------------------------------------------------------------------ OS tools
# Operating-systems pill support: key-source fetching (user-triggered),
# activation status, and key install via slmgr /ipk (install only — Windows
# still requires legitimate activation; no KMS/auto-activation is performed).

import re
import urllib.request

_KEY_RE = re.compile(r"\b[A-Z0-9]{5}(?:-[A-Z0-9]{5}){4}\b")

OS_KEY_SOURCES: dict[str, dict[str, str]] = {
    "gist-keys": {
        "name": "sergeibystrov key list",
        "url": "https://gist.githubusercontent.com/sergeibystrov/b15d63ea7da8661bf921cb15b9ee1ede/raw",
        "kind": "raw",
    },
    "poweriso-keys": {
        "name": "PowerISO-KEYS repo",
        "url": "https://api.github.com/repos/benevides/PowerISO-KEYS/contents",
        "kind": "github-dir",
    },
}


def _fetch_text(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "OpenJarvis/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


@pc_router.get("/os/key-sources")
def os_key_sources() -> dict:
    return {"sources": [{"id": k, **v} for k, v in OS_KEY_SOURCES.items()]}


@pc_router.get("/os/keys")
def os_keys(source: str = "gist-keys") -> dict:
    src = OS_KEY_SOURCES.get(source)
    if not src:
        raise HTTPException(status_code=404, detail=f"Unknown source: {source}")
    keys: list[str] = []
    try:
        if src["kind"] == "raw":
            text = _fetch_text(src["url"])
            keys = sorted(set(_KEY_RE.findall(text.upper())))
        elif src["kind"] == "github-dir":
            listing = json.loads(_fetch_text(src["url"]))
            for item in listing:
                if item.get("type") != "file":
                    continue
                name = item.get("name", "")
                if not name.lower().endswith((".txt", ".md", ".json")):
                    continue
                raw = item.get("download_url")
                if not raw:
                    continue
                text = _fetch_text(raw)
                keys.extend(_KEY_RE.findall(text.upper()))
            keys = sorted(set(keys))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {exc}")
    return {"source": source, "count": len(keys), "keys": keys}


def _slmgr(*args: str) -> tuple[int, str]:
    """Run slmgr.vbs via cscript and return (returncode, decoded output)."""
    script = r"C:\Windows\System32\slmgr.vbs"
    proc = subprocess.run(
        ["cscript", "//nologo", script, *args],
        capture_output=True, timeout=60,
    )
    raw = proc.stdout or proc.stderr or b""
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")) or raw.count(b"\x00") > len(raw) // 4:
        for enc in ("utf-16", "utf-16-le", "utf-16-be"):
            try:
                return proc.returncode, raw.decode(enc, errors="strict").strip()
            except (UnicodeDecodeError, LookupError):
                continue
    for enc in ("utf-8", "mbcs"):
        try:
            return proc.returncode, raw.decode(enc, errors="strict").strip()
        except (UnicodeDecodeError, LookupError):
            continue
    return proc.returncode, raw.decode("utf-8", errors="replace").strip()


@pc_router.get("/os/activation-status")
def os_activation_status() -> dict:
    try:
        code, out = _slmgr("/xpr")
        return {"ok": code == 0, "output": out[:2000]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class InstallKeyBody(BaseModel):
    key: str


@pc_router.post("/os/install-key")
def os_install_key(body: InstallKeyBody) -> dict:
    key = body.key.strip().upper()
    if not _KEY_RE.fullmatch(key):
        raise HTTPException(status_code=400, detail="Invalid product key format")
    try:
        code, out = _slmgr("/ipk", key)
        ok = code == 0 and "error" not in out.lower()
        return {"ok": ok, "output": out[:2000]}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
