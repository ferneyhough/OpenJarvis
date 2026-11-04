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


def _allow_microphone(window) -> None:
    """Auto-allow microphone requests in the embedded WebView2 control."""
    if getattr(_allow_microphone, "done", False):
        return
    try:
        from Microsoft.Web.WebView2.Core import CoreWebView2PermissionKind as Kind
        from Microsoft.Web.WebView2.Core import CoreWebView2PermissionState as State

        core = window.native.browser.web_view.CoreWebView2

        def on_permission(_sender, args):
            if args.PermissionKind == Kind.Microphone:
                args.State = State.Allow

        core.PermissionRequested += on_permission
        _allow_microphone.done = True
    except Exception as exc:  # best effort; the in-app button still works
        print(f"[desktop] could not auto-allow microphone: {exc}")


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


if __name__ == "__main__":
    _start_server()
    window = webview.create_window("OpenJarvis", URL, width=1280, height=840)
    window.events.loaded += lambda: _allow_microphone(window)
    webview.start()
