"""Desktop window for OpenJarvis: serves the web UI and shows it in a native window."""

import atexit
import os
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Keep every voice / speech model inside the install folder.
os.environ.setdefault("HF_HOME", str(ROOT / "models" / "huggingface"))

import webview  # noqa: E402

HOST, PORT = "127.0.0.1", 8000
URL = f"http://{HOST}:{PORT}/"


def _allow_media_permissions(window) -> None:
    """Auto-allow WebView2 permission requests (mic, camera, screen, etc.)."""
    if getattr(_allow_media_permissions, "done", False):
        return
    try:
        from Microsoft.Web.WebView2.Core import CoreWebView2PermissionState as State

        core = window.native.browser.web_view.CoreWebView2

        def on_permission(_sender, args):
            args.State = State.Allow

        core.PermissionRequested += on_permission
        _allow_media_permissions.done = True
    except Exception as exc:  # best effort; the in-app button still works
        print(f"[desktop] could not auto-allow media permissions: {exc}")


def _port_open() -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex((HOST, PORT)) == 0


def _start_server():
    if _port_open():
        return None
    scripts = Path(sys.executable).parent
    exe = scripts / "jarvis.exe"
    cmd = [str(exe) if exe.exists() else shutil.which("jarvis") or "jarvis"]
    proc = subprocess.Popen(
        cmd + ["serve", "--host", HOST, "--port", str(PORT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    atexit.register(proc.terminate)
    deadline = time.time() + 120
    while time.time() < deadline and not _port_open():
        if proc.poll() is not None:
            raise SystemExit("jarvis serve exited unexpectedly")
        time.sleep(0.5)
    return proc


def _refresh_stale_cache(window) -> None:
    """Drop cached service workers so the window always shows the latest UI build."""
    if getattr(_refresh_stale_cache, "done", False):
        return
    _refresh_stale_cache.done = True
    window.evaluate_js(
        "(async()=>{let n=0;"
        "if(navigator.serviceWorker){for(const r of await navigator.serviceWorker.getRegistrations()){await r.unregister();n++}}"
        "if(window.caches){for(const k of await caches.keys()){await caches.delete(k);n++}}"
        "if(n>0)location.reload();})()"
    )


class _DesktopApi:
    """JS bridge: lets the web UI toggle real window fullscreen.

    The DOM Fullscreen API is unreliable inside the WebView2 host, so the
    Guides page calls window.pywebview.api.set_fullscreen() instead.
    """

    def __init__(self):
        self._window = None
        self._fullscreen = False

    def attach(self, window) -> None:
        self._window = window

    def set_fullscreen(self, fullscreen: bool) -> None:
        want = bool(fullscreen)
        if self._window is None or want == self._fullscreen:
            return
        try:
            self._window.toggle_fullscreen()
            self._fullscreen = want
        except Exception as exc:
            print(f"[desktop] fullscreen toggle failed: {exc}")

    def is_fullscreen(self) -> bool:
        return self._fullscreen


def _shutdown_server(_window) -> None:
    """Window closed (Alt+F4, X button): stop the backend too so the whole
    program exits instead of leaving an orphaned server on :8000."""
    try:
        import urllib.request

        req = urllib.request.Request(
            "http://127.0.0.1:8000/v1/app/shutdown", method="POST"
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass


if __name__ == "__main__":
    _start_server()
    api = _DesktopApi()
    window = webview.create_window("OpenJarvis", URL, width=1280, height=840, js_api=api)
    api.attach(window)
    window.events.loaded += lambda: _allow_media_permissions(window)
    window.events.loaded += lambda: _refresh_stale_cache(window)
    window.events.closed += _shutdown_server
    webview.start()
