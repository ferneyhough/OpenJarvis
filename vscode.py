"""Find the file currently open in VS Code (via its window title) so Jarvis can 'fix this'."""
import os
import re
import sys
from pathlib import Path

TITLE_FORMAT = "${dirty}${activeEditorLong}${separator}${rootName}${separator}${appName}"
TRIGGER = re.compile(
    r"\b(fix|edit|refactor|explain|review|debug|change|update|improve|comment|optimi[sz]e)\s+(this|it)\b"
    r"|\b(this|current|open|active)\s+(file|code|script|function|class|bug|error)\b"
    r"|\bin vs ?code\b",
    re.IGNORECASE,
)


def _window_titles() -> list[str]:
    if sys.platform != "win32":
        return []
    import ctypes
    from ctypes import wintypes
    user32 = ctypes.windll.user32
    titles: list[str] = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            n = user32.GetWindowTextLengthW(hwnd)
            if n:
                buf = ctypes.create_unicode_buffer(n + 1)
                user32.GetWindowTextW(hwnd, buf, n + 1)
                if buf.value.endswith("Visual Studio Code"):
                    titles.append(buf.value)
        return True

    user32.EnumWindows(cb, 0)
    return titles  # z-order: most recently active VS Code window first


def active_file() -> tuple[Path | None, bool, str]:
    """Returns (path, has_unsaved_changes, hint)."""
    titles = _window_titles()
    if not titles:
        return None, False, "No VS Code window found. Open the file in VS Code first."
    for t in titles:
        first = t.split(" - ")[0]
        dirty = first.startswith("●")
        p = Path(first.lstrip("● ").strip())
        if p.is_absolute() and p.is_file():
            return p, dirty, ""
    return None, False, "VS Code isn't showing full file paths. Click 'Enable VS Code fix-this' in Settings, then try again."


def read_active(max_chars: int = 60000) -> str:
    p, dirty, hint = active_file()
    if not p:
        return f"[VSCODE] {hint}"
    text = p.read_text(encoding="utf-8", errors="replace")
    if len(text) > max_chars:
        return f"[VSCODE] {p} is too large ({len(text)} chars) to edit in one go."
    warn = "\nWARNING: this file has UNSAVED changes in VS Code; tell the user to save (Ctrl+S) first." if dirty else ""
    return f"[VSCODE] ACTIVE FILE: {p}{warn}\n```\n{text}\n```"


def enable_full_path_titles() -> str:
    """Patch VS Code user settings so window titles show the full file path."""
    if sys.platform != "win32":
        return "Only needed on Windows."
    settings = Path(os.environ.get("APPDATA", "")) / "Code" / "User" / "settings.json"
    line = f'"window.title": "{TITLE_FORMAT}"'
    if not settings.exists():
        settings.parent.mkdir(parents=True, exist_ok=True)
        settings.write_text("{\n  " + line + "\n}\n", encoding="utf-8")
        return "Done. VS Code will now show full file paths."
    text = settings.read_text(encoding="utf-8")
    if "activeEditorLong" in text:
        return "Already enabled."
    if '"window.title"' in text:
        return f'You already have a custom "window.title" in {settings}. Change it to include ${{activeEditorLong}} first.'
    i = text.find("{")
    if i < 0:
        return f"Couldn't read {settings}. Add {line} manually."
    sep = "," if text[i + 1:].strip() and not text[i + 1:].strip().startswith("}") else ""
    settings.write_text(text[: i + 1] + "\n  " + line + sep + text[i + 1:], encoding="utf-8")
    return "Done. VS Code will now show full file paths."
